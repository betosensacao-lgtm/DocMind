import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";
import type { AdminSession } from "@/types";

export async function getSessionFromRequest(request: Request): Promise<AdminSession | null> {
  const cookie = (request.headers.get("cookie") || "")
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE_NAME}=`))
    ?.split("=")[1];

  if (!cookie) return null;

  try {
    return await verifySessionToken(cookie);
  } catch {
    return null;
  }
}
