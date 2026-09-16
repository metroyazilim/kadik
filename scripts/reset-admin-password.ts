// Recovery CLI: reset an AdminUser's password without a working "forgot
// password" email round-trip. Same hashing/invalidation contract as
// `resetAdminUserPasswordAction` (app/manage/(panel)/users/actions.ts) and
// the bootstrap seed (prisma/seed.ts) - bcrypt cost 12, 12-char minimum,
// tokenVersion bump so every existing session for that user is invalidated.
//
// Usage:
//   npx tsx scripts/reset-admin-password.ts <email> [newPassword]
//   npm run db:reset-admin-password -- <email> [newPassword]
//
// If [newPassword] is omitted, a random 20-character password is generated
// and printed once - it is never stored anywhere but the database's bcrypt
// hash, so capture it from the terminal output.
//
// If <email> does not match an existing AdminUser, the row is created as
// SUPER_ADMIN (mirrors prisma/seed.ts's first-admin bootstrap) instead of
// silently failing - the common case for this script is "I'm locked out
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db";

const MIN_PASSWORD_LENGTH = 12;
const BCRYPT_COST = 12;
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%";

function generatePassword(length = 20): string {
  let out = "";
  for (let i = 0; i < length; i++) out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  return out;
}

async function run(): Promise<void> {
  const [rawEmail, providedPassword] = process.argv.slice(2);
  if (!rawEmail) {
    console.error("Usage: npx tsx scripts/reset-admin-password.ts <email> [newPassword]");
    process.exitCode = 1;
    return;
  }

  const email = rawEmail.trim().toLowerCase();
  const password = providedPassword ?? generatePassword();
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const existing = await prisma.adminUser.findUnique({ where: { email } });

  if (!existing) {
    const created = await prisma.adminUser.create({
      data: { email, passwordHash, name: "Recovery Admin", role: "SUPER_ADMIN" },
    });
    await prisma.auditLog.create({
      data: { action: "user.password.reset", entity: "AdminUser", entityId: created.id, metadata: { email, via: "cli", created: true } },
    });
    console.log(`Created SUPER_ADMIN ${email}`);
  } else {
    await prisma.adminUser.update({
      where: { id: existing.id },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });
    await prisma.auditLog.create({
      data: { action: "user.password.reset", entity: "AdminUser", entityId: existing.id, metadata: { email, via: "cli" } },
    });
    console.log(`Reset password for ${existing.role} ${email}; existing sessions invalidated.`);
  }

  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  if (!providedPassword) console.log("(generated - shown once, not stored in plaintext anywhere)");
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
