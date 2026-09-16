import { expect, test } from "../support/merged-fixtures";
import { createMessageSubmission } from "../../lib/content-model/message-submission";
import { checkRateLimit, hashRateLimitKey, cleanupExpiredRateLimitWindows } from "../../lib/content-model/rate-limit";

test.setTimeout(120_000);

function submission(overrides: Partial<Parameters<typeof createMessageSubmission>[1]> = {}) {
  return {
    locale: "tr",
    name: "Ayşe Yılmaz",
    email: "ayse@example.test",
    phone: null,
    subject: "Teklif talebi",
    message: "Merhaba, bir teklif almak istiyorum.",
    ...overrides,
  };
}

test.describe("AC-6.3-03 - idempotent contact submission (CAP-2)", () => {
  test("an identical resubmit within the idempotency window returns the same row instead of creating a duplicate", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const first = await createMessageSubmission(client, submission());
    const second = await createMessageSubmission(client, submission());

    expect(second.id).toBe(first.id);
    expect(await client.message.count({ where: { email: "ayse@example.test" } })).toBe(1);
  });

  test("two genuinely different submissions from the same visitor both persist as distinct messages", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const first = await createMessageSubmission(client, submission({ message: "First inquiry." }));
    const second = await createMessageSubmission(client, submission({ message: "Second, unrelated inquiry." }));

    expect(second.id).not.toBe(first.id);
    expect(await client.message.count({ where: { email: "ayse@example.test" } })).toBe(2);
  });

  test("a fresh message starts UNREAD at version 0 with a stable id and the submitted fields intact", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const created = await createMessageSubmission(client, submission({ phone: "+90 555 000 00 00" }));

    expect(created.status).toBe("UNREAD");
    expect(created.version).toBe(0);
    expect(created.phone).toBe("+90 555 000 00 00");
    expect(created.submissionHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

test.describe("AC-6.3-02 - PostgreSQL fixed-window rate limit (CAP-3)", () => {
  test("allows submissions under the limit and rejects the one that crosses it, without ever storing the raw identifier", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const bucketKey = hashRateLimitKey("203.0.113.9", "contact-message-test");
    const now = new Date("2026-09-07T12:00:00.000Z");

    for (let i = 0; i < 3; i += 1) {
      const result = await checkRateLimit(client, {
        scope: "contact-message-test",
        bucketKey,
        windowMs: 60_000,
        limit: 3,
        now,
      });
      expect(result.allowed).toBe(true);
    }
    const fourth = await checkRateLimit(client, {
      scope: "contact-message-test",
      bucketKey,
      windowMs: 60_000,
      limit: 3,
      now,
    });
    expect(fourth.allowed).toBe(false);
    expect(fourth.count).toBe(4);

    const rows = await client.contactRateLimit.findMany({ where: { scope: "contact-message-test" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].bucketKey).not.toContain("203.0.113.9");
  });

  test("two concurrent checks from the same key in the same window both land on one row and both see a correct, non-lost increment", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const bucketKey = hashRateLimitKey("203.0.113.10", "contact-message-race");
    const now = new Date("2026-09-07T12:00:00.000Z");

    const [a, b] = await Promise.all([
      checkRateLimit(client, { scope: "contact-message-race", bucketKey, windowMs: 60_000, limit: 5, now }),
      checkRateLimit(client, { scope: "contact-message-race", bucketKey, windowMs: 60_000, limit: 5, now }),
    ]);

    expect(new Set([a.count, b.count])).toEqual(new Set([1, 2]));
    const row = await client.contactRateLimit.findFirstOrThrow({ where: { scope: "contact-message-race", bucketKey } });
    expect(row.count).toBe(2);
  });

  test("a new fixed window resets the count independently of the prior window", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const bucketKey = hashRateLimitKey("203.0.113.11", "contact-message-window");
    const windowOne = new Date("2026-09-07T12:00:00.000Z");
    const windowTwo = new Date("2026-09-07T12:01:00.000Z");

    const first = await checkRateLimit(client, { scope: "contact-message-window", bucketKey, windowMs: 60_000, limit: 1, now: windowOne });
    const second = await checkRateLimit(client, { scope: "contact-message-window", bucketKey, windowMs: 60_000, limit: 1, now: windowOne });
    const third = await checkRateLimit(client, { scope: "contact-message-window", bucketKey, windowMs: 60_000, limit: 1, now: windowTwo });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
    expect(third.allowed).toBe(true);
    expect(await client.contactRateLimit.count({ where: { scope: "contact-message-window", bucketKey } })).toBe(2);
  });

  test("cleanup removes only windows older than the retention cutoff, never the current one", async ({ testDatabase }) => {
    const { client } = testDatabase;
    const bucketKey = hashRateLimitKey("203.0.113.12", "contact-message-cleanup");
    const now = new Date("2026-09-07T12:00:00.000Z");
    const old = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    await checkRateLimit(client, { scope: "contact-message-cleanup", bucketKey, windowMs: 60_000, limit: 5, now: old });
    await checkRateLimit(client, { scope: "contact-message-cleanup", bucketKey, windowMs: 60_000, limit: 5, now });
    expect(await client.contactRateLimit.count({ where: { scope: "contact-message-cleanup" } })).toBe(2);

    await cleanupExpiredRateLimitWindows(client, 60 * 60 * 1000, now);

    const remaining = await client.contactRateLimit.findMany({ where: { scope: "contact-message-cleanup" } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].windowStart.getTime()).toBe(now.getTime());
  });
});
