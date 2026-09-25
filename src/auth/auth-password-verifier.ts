import * as argon2 from 'argon2';

export const TIMING_PARITY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$5KRxbfPDDZVDeWkvkmtU/A$S35kHKRLUx3/W9bsRHOpGrKsMfGn3d/ttbh08m4GWGg';

export async function matchesPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
