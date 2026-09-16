import { expect, test } from "../support/merged-fixtures";

test.use({ runIdentity: "story-0-1-assertion-probe" });
test.skip(
  process.env.RUN_STORY_01_FAILURE_PROBE !== "1",
  "Executed only by the Story 0.1 integration cleanup proof.",
);

test("AC-0.1-05 assertion-failure cleanup probe", async ({ testDatabase }) => {
  expect(testDatabase.migrationApplied).toBe(false);
});
