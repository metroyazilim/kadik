const MIN_AUTH_SECRET_LENGTH = 32;

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}
export function hasAuthSecret() {
  return Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= MIN_AUTH_SECRET_LENGTH);
}

export function requireDatabase() {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("DATABASE_URL is required for Metro Yazılım admin and database-backed content.");
  }
  return value;
}

export function requireAuthSecret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < MIN_AUTH_SECRET_LENGTH) {
    throw new Error("AUTH_SECRET must be at least 32 characters long.");
  }
  return value;
}

export function getAdminBootstrap() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required to seed the first admin.");
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters long.");
  }
  return { email: email.trim().toLowerCase(), password };
}
