import { expect, test } from "@playwright/test";
import { computeSubmissionHash, SUBMISSION_IDEMPOTENCY_WINDOW_MS } from "../../lib/content-model/message-idempotency";
import { hashRateLimitKey } from "../../lib/content-model/rate-limit";

// hashRateLimitKey is now a keyed HMAC (AUTH_SECRET) - load .env so this
// file runs correctly in isolation, not only as part of a larger batch
// where another file's fixture happens to load it first. Same guard as
// tests/support/fixtures/admin-seed-fixture.ts.
try {
  process.loadEnvFile();
} catch {
  // No .env file present - fine when AUTH_SECRET is supplied directly (CI).
}

const BASE_FIELDS = {
  locale: "tr",
  name: "Ayşe Yılmaz",
  email: "ayse@example.test",
  phone: "+90 555 000 00 00",
  subject: "Teklif talebi",
  message: "Merhaba, bir teklif almak istiyorum.",
};

test.describe("Story 6.3 Unit - CAP-2 computeSubmissionHash", () => {
  test("is deterministic: two independent calls with identical fields and the same instant produce byte-identical hashes", () => {
    const now = Date.parse("2026-09-07T10:00:00Z");
    expect(computeSubmissionHash(BASE_FIELDS, now)).toBe(computeSubmissionHash(BASE_FIELDS, now));
  });

  test("normalizes whitespace, case, and null/undefined-optional-field equivalence before hashing", () => {
    const now = Date.parse("2026-09-07T10:00:00Z");
    const canonical = computeSubmissionHash(BASE_FIELDS, now);
    const padded = computeSubmissionHash(
      { ...BASE_FIELDS, name: `  ${BASE_FIELDS.name}  `, email: BASE_FIELDS.email.toUpperCase() },
      now,
    );
    expect(padded).toBe(canonical);

    const withNullOptional = computeSubmissionHash({ ...BASE_FIELDS, phone: null, subject: null }, now);
    const withEmptyOptional = computeSubmissionHash({ ...BASE_FIELDS, phone: "", subject: "" }, now);
    expect(withNullOptional).toBe(withEmptyOptional);
  });

  test("a different field value produces a different hash", () => {
    const now = Date.parse("2026-09-07T10:00:00Z");
    const a = computeSubmissionHash(BASE_FIELDS, now);
    const b = computeSubmissionHash({ ...BASE_FIELDS, message: "Different message body." }, now);
    expect(a).not.toBe(b);
  });

  test("the same content stays within one hash inside the idempotency window and changes once the window elapses", () => {
    const windowStart = Math.floor(Date.parse("2026-09-07T10:00:00Z") / SUBMISSION_IDEMPOTENCY_WINDOW_MS) * SUBMISSION_IDEMPOTENCY_WINDOW_MS;
    const stillInWindow = windowStart + SUBMISSION_IDEMPOTENCY_WINDOW_MS - 1;
    const nextWindow = windowStart + SUBMISSION_IDEMPOTENCY_WINDOW_MS;

    expect(computeSubmissionHash(BASE_FIELDS, windowStart)).toBe(computeSubmissionHash(BASE_FIELDS, stillInWindow));
    expect(computeSubmissionHash(BASE_FIELDS, windowStart)).not.toBe(computeSubmissionHash(BASE_FIELDS, nextWindow));
  });

  test("returns a fixed-length hex digest that never embeds a raw field verbatim (defense-in-depth: never logs PII through this value)", () => {
    const hash = computeSubmissionHash(BASE_FIELDS, Date.now());
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(BASE_FIELDS.email);
    expect(hash).not.toContain(BASE_FIELDS.name);
  });
});

test.describe("Story 6.3 Unit - CAP-3 hashRateLimitKey", () => {
  test("is deterministic per (identifier, scope) pair and never returns the raw identifier", () => {
    const key = hashRateLimitKey("203.0.113.7", "contact-message");
    expect(key).toBe(hashRateLimitKey("203.0.113.7", "contact-message"));
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain("203.0.113.7");
  });

  test("different identifiers or different scopes never collide for the same fixed test input", () => {
    const a = hashRateLimitKey("203.0.113.7", "contact-message");
    const b = hashRateLimitKey("203.0.113.8", "contact-message");
    const c = hashRateLimitKey("203.0.113.7", "other-scope");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});
