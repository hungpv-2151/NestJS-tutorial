import * as argon2 from 'argon2';

// v1 benchmark target: interactive login on the deployment baseline; increase only after re-benchmarking.
export const ARGON2ID_POLICY_VERSION = 'argon2id-v1';
export const ARGON2ID_OPTIONS: argon2.Options & { type: typeof argon2.argon2id } = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};
