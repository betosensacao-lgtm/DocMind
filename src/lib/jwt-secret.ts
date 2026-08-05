const secret = process.env.JWT_SECRET;

if (!secret && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET environment variable must be set in production");
}

export const JWT_SECRET = new TextEncoder().encode(
  secret ?? "dev-secret-insecure-do-not-use-in-production"
);
