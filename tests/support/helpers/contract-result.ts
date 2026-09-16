export const CAPABILITY_IDS = ["CAP-1", "CAP-2", "CAP-3"] as const;
export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export const ACCEPTANCE_CRITERION_IDS = [
  "AC-0.1-01",
  "AC-0.1-02",
  "AC-0.1-03",
  "AC-0.1-04",
  "AC-0.1-05",
  "AC-0.1-06",
  "AC-0.1-07",
] as const;

export type AcceptanceCriterionId = (typeof ACCEPTANCE_CRITERION_IDS)[number];

export const CONTRACT_OUTCOMES = [
  "ok",
  "invalid",
  "conflict",
  "forbidden",
  "notFound",
  "setupFailure",
  "cleanupFailure",
] as const;

export type ContractOutcome = (typeof CONTRACT_OUTCOMES)[number];

export const FAILURE_CLASSIFICATIONS = [
  "invalidInput",
  "unsupportedFixture",
  "conflict",
  "forbidden",
  "notFound",
  "databaseUnavailable",
  "databaseCapabilityMissing",
  "migrationFailed",
  "ownershipMismatch",
  "cleanupFailed",
  "internal",
] as const;

export type FailureClassification = (typeof FAILURE_CLASSIFICATIONS)[number];
const SAFE_REASON_BY_CLASSIFICATION: Record<FailureClassification, string> = {
  invalidInput: "The contract input is invalid.",
  unsupportedFixture: "The requested fixture is not supported.",
  conflict: "The fixture operation conflicted with current state.",
  forbidden: "The fixture operation was forbidden.",
  notFound: "The fixture target was not found.",
  databaseUnavailable: "The dedicated test database is unavailable.",
  databaseCapabilityMissing: "The test database role lacks a required capability.",
  migrationFailed: "The isolated schema migration failed.",
  ownershipMismatch: "Fixture schema ownership could not be verified.",
  cleanupFailed: "The isolated test schema cleanup failed.",
  internal: "An internal contract failure occurred.",
};

export type SanitizedFailure = Readonly<{
  classification: FailureClassification;
  reason: string;
}>;

type ContractSafeErrorOptions = ErrorOptions & {
  cleanupFailure?: SanitizedFailure;
};

export class ContractSafeError extends Error {
  readonly classification: FailureClassification;
  readonly safeReason: string;
  readonly cleanupFailure?: SanitizedFailure;

  constructor(
    classification: FailureClassification,
    safeReason: string,
    options?: ContractSafeErrorOptions,
  ) {
    super(safeReason, options);
    this.name = "ContractSafeError";
    this.classification = classification;
    this.safeReason = safeReason;
    this.cleanupFailure = options?.cleanupFailure;
  }
}

export type ContractResult = Readonly<{
  capabilityId: CapabilityId;
  acceptanceCriterionId: AcceptanceCriterionId;
  runIdentity: string;
  fixtureIdentity: string;
  outcome: ContractOutcome;
  statusCode?: number;
  failure?: SanitizedFailure;
}>;

export type ContractResultInput = Readonly<{
  capabilityId: CapabilityId;
  acceptanceCriterionId: AcceptanceCriterionId;
  runIdentity: string;
  fixtureIdentity: string;
  outcome: ContractOutcome;
  statusCode?: number;
  failure?: unknown;
}>;

const SAFE_RUN_IDENTITY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_FIXTURE_IDENTITY = /^[a-z0-9][a-z0-9:-]{1,159}$/;
const capabilityLookup: Record<CapabilityId, true> = {
  "CAP-1": true,
  "CAP-2": true,
  "CAP-3": true,
};
const acceptanceCriterionLookup: Record<AcceptanceCriterionId, true> = {
  "AC-0.1-01": true,
  "AC-0.1-02": true,
  "AC-0.1-03": true,
  "AC-0.1-04": true,
  "AC-0.1-05": true,
  "AC-0.1-06": true,
  "AC-0.1-07": true,
};
const acceptanceCriteriaByCapability: Record<
  CapabilityId,
  Partial<Record<AcceptanceCriterionId, true>>
> = {
  "CAP-1": {
    "AC-0.1-01": true,
    "AC-0.1-02": true,
    "AC-0.1-04": true,
  },
  "CAP-2": {
    "AC-0.1-03": true,
    "AC-0.1-06": true,
    "AC-0.1-07": true,
  },
  "CAP-3": {
    "AC-0.1-01": true,
    "AC-0.1-04": true,
    "AC-0.1-05": true,
    "AC-0.1-06": true,
    "AC-0.1-07": true,
  },
};
const outcomeLookup: Record<ContractOutcome, true> = {
  ok: true,
  invalid: true,
  conflict: true,
  forbidden: true,
  notFound: true,
  setupFailure: true,
  cleanupFailure: true,
};

function assertSafeRunIdentity(value: string) {
  if (
    value.length < 3 ||
    value.length > 48 ||
    !SAFE_RUN_IDENTITY.test(value)
  ) {
    throw new ContractSafeError("invalidInput", "Run identity is invalid.");
  }
}

function assertSafeFixtureIdentity(value: string, runIdentity: string) {
  if (
    !SAFE_FIXTURE_IDENTITY.test(value) ||
    !value.startsWith(`${runIdentity}:`)
  ) {
    throw new ContractSafeError("invalidInput", "Fixture identity is invalid.");
  }
}

export function sanitizeUnknownFailure(failure: unknown): SanitizedFailure {
  if (
    failure instanceof ContractSafeError &&
    Object.hasOwn(SAFE_REASON_BY_CLASSIFICATION, failure.classification)
  ) {
    return {
      classification: failure.classification,
      reason: SAFE_REASON_BY_CLASSIFICATION[failure.classification],
    };
  }

  return {
    classification: "internal",
    reason: "An internal contract failure occurred.",
  };
}

export function createContractResult(input: ContractResultInput): ContractResult {
  assertSafeRunIdentity(input.runIdentity);
  assertSafeFixtureIdentity(input.fixtureIdentity, input.runIdentity);

  if (!Object.hasOwn(capabilityLookup, input.capabilityId)) {
    throw new ContractSafeError("invalidInput", "Capability is invalid.");
  }
  if (!Object.hasOwn(acceptanceCriterionLookup, input.acceptanceCriterionId)) {
    throw new ContractSafeError("invalidInput", "Acceptance criterion is invalid.");
  }
  if (
    !Object.hasOwn(
      acceptanceCriteriaByCapability[input.capabilityId],
      input.acceptanceCriterionId,
    )
  ) {
    throw new ContractSafeError(
      "invalidInput",
      "The capability and acceptance criterion are not traceable.",
    );
  }
  if (!Object.hasOwn(outcomeLookup, input.outcome)) {
    throw new ContractSafeError("invalidInput", "Contract outcome is invalid.");
  }

  if (
    input.statusCode !== undefined &&
    (!Number.isInteger(input.statusCode) || input.statusCode < 100 || input.statusCode > 599)
  ) {
    throw new ContractSafeError("invalidInput", "Transport status is invalid.");
  }

  const result: ContractResult = {
    capabilityId: input.capabilityId,
    acceptanceCriterionId: input.acceptanceCriterionId,
    runIdentity: input.runIdentity,
    fixtureIdentity: input.fixtureIdentity,
    outcome: input.outcome,
    ...(input.statusCode === undefined ? {} : { statusCode: input.statusCode }),
    ...(input.failure === undefined ? {} : { failure: sanitizeUnknownFailure(input.failure) }),
  };

  return result;
}
