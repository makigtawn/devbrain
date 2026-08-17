import argon2 from "argon2";

/**
 * Hashes a plain-text password using Argon2id.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
  });
}

/**
 * Verifies a plain-text password against an Argon2id hash.
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    console.error("Error verifying password with argon2:", error);
    return false;
  }
}
