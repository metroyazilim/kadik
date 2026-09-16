import { randomUUID } from "node:crypto";
import type { MessageStatus } from "@prisma/client";
import { expect, test } from "../support/merged-fixtures";
import type { AdminContext } from "../../lib/content-model/admin-context";
import { issueTestAdminContext } from "../../lib/content-model/admin-context-test-support";
import { adminUpdateMessageStatus } from "../../lib/content-model/message-store";
import { createMessageSubmission } from "../../lib/content-model/message-submission";
import { ContentModelError } from "../../lib/content-model/errors";

test.setTimeout(120_000);

async function issueActor(
  client: Parameters<typeof createMessageSubmission>[0],
  label: string,
): Promise<AdminContext> {
  const user = await client.adminUser.create({
    data: {
      email: `${label}-${randomUUID()}@example.test`,
      passwordHash: "unused-in-story-6-3-contract-tests",
      name: "Story 6.3 Contract Actor",
    },
  });
  return issueTestAdminContext({ id: user.id, email: user.email });
}

function submission(overrides: Partial<Parameters<typeof createMessageSubmission>[1]> = {}) {
  return {
    locale: "en",
    name: "Test Visitor",
    email: `visitor-${randomUUID()}@example.test`,
    phone: null,
    subject: null,
    message: "A test contact message.",
    ...overrides,
  };
}

test.describe("AC-6.3-05 - authorized, audited, conflict-protected status transitions (CAP-5/CAP-6/CAP-7)", () => {
  test("a forged actor context is rejected before any query runs", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const message = await createMessageSubmission(client, submission());
    const forged = { actorId: "attacker", actorEmail: "attacker@example.test" } as unknown as AdminContext;

    await expect(
      adminUpdateMessageStatus(client, forged, { messageId: message.id, expectedVersion: 0, nextStatus: "READ" }),
    ).rejects.toBeInstanceOf(ContentModelError);
    expect((await client.message.findUniqueOrThrow({ where: { id: message.id } })).status).toBe("UNREAD");
    expect(await client.auditLog.count({ where: { entityId: message.id } })).toBe(0);
  });

  test("a valid transition updates status, bumps version, and writes exactly one PII-free audit row in the same commit", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "status-transition");
    const message = await createMessageSubmission(client, submission({ name: "Sensitive Name", email: "sensitive@example.test", message: "Sensitive body text." }));

    const result = await adminUpdateMessageStatus(client, actor, {
      messageId: message.id,
      expectedVersion: 0,
      nextStatus: "READ",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("status transition unexpectedly conflicted");
    expect(result.message.status).toBe("READ");
    expect(result.message.version).toBe(1);

    const auditRows = await client.auditLog.findMany({ where: { entityId: message.id } });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].action).toBe("message.status.changed");
    expect(auditRows[0].entity).toBe("Message");
    expect(auditRows[0].userId).toBe(actor.actorId);
    expect(auditRows[0].metadata).toEqual({ priorStatus: "UNREAD", nextStatus: "READ", version: 1 });
    // The closed MessageAuditMetadata shape must never carry PII - assert
    // the actual persisted JSON keys are exactly the three safe fields.
    expect(Object.keys(auditRows[0].metadata as object).sort()).toEqual(["nextStatus", "priorStatus", "version"]);
    const serialized = JSON.stringify(auditRows[0]);
    expect(serialized).not.toContain("Sensitive Name");
    expect(serialized).not.toContain("sensitive@example.test");
    expect(serialized).not.toContain("Sensitive body text");
  });

  test("a stale expectedVersion returns a safe conflict, changes nothing, and writes no audit row", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "stale-transition");
    const message = await createMessageSubmission(client, submission());
    const firstMove = await adminUpdateMessageStatus(client, actor, {
      messageId: message.id,
      expectedVersion: 0,
      nextStatus: "READ",
    });
    if (!firstMove.ok) throw new Error("setup transition unexpectedly conflicted");

    const stale = await adminUpdateMessageStatus(client, actor, {
      messageId: message.id,
      expectedVersion: 0,
      nextStatus: "REPLIED",
    });

    expect(stale.ok).toBe(false);
    if (stale.ok) throw new Error("stale status transition unexpectedly succeeded");
    expect(stale.conflict).toBe(true);
    expect(stale.current.status).toBe("READ");
    expect(stale.current.version).toBe(1);
    expect(await client.auditLog.count({ where: { entityId: message.id } })).toBe(1);
  });

  test("every one of the six statuses is reachable and each transition is independently audited", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "all-statuses");
    const message = await createMessageSubmission(client, submission());
    const sequence: readonly MessageStatus[] = ["READ", "REPLIED", "PROCESSED", "SPAM", "UNREAD", "ARCHIVED"];

    let version = 0;
    for (const nextStatus of sequence) {
      const result = await adminUpdateMessageStatus(client, actor, {
        messageId: message.id,
        expectedVersion: version,
        nextStatus,
      });
      if (!result.ok) throw new Error(`transition to ${nextStatus} unexpectedly conflicted`);
      expect(result.message.status).toBe(nextStatus);
      version = result.message.version;
    }
    expect(await client.auditLog.count({ where: { entityId: message.id, action: "message.status.changed" } })).toBe(sequence.length);
    expect((await client.message.findUniqueOrThrow({ where: { id: message.id } })).status).toBe("ARCHIVED");
  });

  test("archiving is the same audited CAS mutation, not a separate delete path - the row still exists afterward", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const actor = await issueActor(client, "archive-only");
    const message = await createMessageSubmission(client, submission());

    const archived = await adminUpdateMessageStatus(client, actor, {
      messageId: message.id,
      expectedVersion: 0,
      nextStatus: "ARCHIVED",
    });

    expect(archived.ok).toBe(true);
    if (!archived.ok) throw new Error("archive unexpectedly conflicted");
    const stillExists = await client.message.findUnique({ where: { id: message.id } });
    expect(stillExists).not.toBeNull();
    expect(stillExists?.status).toBe("ARCHIVED");
  });
});
