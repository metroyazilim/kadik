import { mergeTests } from "@playwright/test";
import { log } from "@seontechnologies/playwright-utils";
import { test as apiRequestFixture } from "@seontechnologies/playwright-utils/api-request/fixtures";
import { test as interceptFixture } from "@seontechnologies/playwright-utils/intercept-network-call/fixtures";
import { test as networkErrorFixture } from "@seontechnologies/playwright-utils/network-error-monitor/fixtures";
import { test as recurseFixture } from "@seontechnologies/playwright-utils/recurse/fixtures";
import { test as authFixture } from "./auth-fixture";
import { test as adminSeedFixture } from "./fixtures/admin-seed-fixture";
import { test as e2eDataFixture } from "./fixtures/e2e-data-fixture";
import { test as story01Fixture } from "./fixtures/story-0-1-fixture";

export const test = mergeTests(
  apiRequestFixture,
  interceptFixture,
  networkErrorFixture,
  recurseFixture,
  authFixture,
  adminSeedFixture,
  e2eDataFixture,
  story01Fixture,
);

export { expect } from "@playwright/test";
export { log };
