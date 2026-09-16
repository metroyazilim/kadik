import { expect, test } from "@playwright/test";
import { ContentModelError } from "../../lib/content-model/errors";
import { assertAdminContext } from "../../lib/content-model/admin-context";
import { issueTestAdminContext } from "../../lib/content-model/admin-context-test-support";

test.describe("Story 0.3 AdminContext (AC-0.3-01)", () => {
  test("CAP-1 issueTestAdminContext produces a context that passes assertAdminContext and carries the given actor identity", () => {
    const context = issueTestAdminContext({ id: "actor-1", email: "actor@example.com" });
    expect(() => assertAdminContext(context)).not.toThrow();
    expect(context.actorId).toBe("actor-1");
    expect(context.actorEmail).toBe("actor@example.com");
  });

  test("CAP-1 rejects a hand-built object with the same visible shape but no brand and no WeakSet membership", () => {
    const forged = { actorId: "actor-1", actorEmail: "actor@example.com" };
    expect(() => assertAdminContext(forged)).toThrow(ContentModelError);
  });

  test("CAP-1 rejects null, undefined and non-object values", () => {
    for (const value of [null, undefined, "actor-1", 42, []]) {
      expect(() => assertAdminContext(value)).toThrow(ContentModelError);
    }
  });

  test("CAP-1 rejects an object created via Object.create(realContext) that inherits the brand but is a different object", () => {
    const real = issueTestAdminContext({ id: "actor-1", email: "actor@example.com" });
    // Inherits every own+inherited property of `real` (including its brand
    // symbol, discoverable via Object.getOwnPropertySymbols) through the
    // prototype chain, yet is never a member of admin-context.ts's
    // WeakSet - a different object identity than the one that was issued.
    const impostor = Object.create(real) as object;
    expect(() => assertAdminContext(impostor)).toThrow(ContentModelError);
  });

  test("CAP-1 rejects a JSON round-trip of a real context (identity is lost across serialization)", () => {
    const real = issueTestAdminContext({ id: "actor-1", email: "actor@example.com" });
    const roundTripped = JSON.parse(JSON.stringify(real));
    expect(() => assertAdminContext(roundTripped)).toThrow(ContentModelError);
  });
});
