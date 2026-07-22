import { compare, genSaltSync, hashSync } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { AdminSession } from "@/types";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret");
const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return hashSync(password, genSaltSync(SALT_ROUNDS));
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return compare(password, hash);
}

export async function createSessionToken(payload: AdminSession): Promise<string> {
  return new SignJWT({ ...payload }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("24h").sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<AdminSession> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as AdminSession;
}

export async function getUserByEmail(email: string) {
  const result = await db.select().from(users).where(eq(users.email, email));
  return result[0] ?? null;
}

export async function getUserById(id: string) {
  const result = await db.select().from(users).where(eq(users.id, id));
  return result[0] ?? null;
}

export async function updateLastLogin(userId: string) {
  await db.update(users).set({ lastLoginAt: new Date() } as any).where(eq(users.id, userId));
}
