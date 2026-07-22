import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { hashPassword } from "@/lib/auth";
import { organizations, users } from "./schema";
config({ path: ".env.local" });

async function run() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not configured"); process.exit(1); }
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);
  console.log("Creating seed data...");
  const [org] = await db.insert(organizations).values({
    name: "Demo Corp", slug: "demo-corp",
  } as any).returning();
  const pw = await hashPassword("ccEH@fNU7VEhbccW");
  await db.insert(users).values({ organizationId: org.id, email: "admin@demo.com", name: "Admin", role: "admin", passwordHash: pw } as any);
  console.log("Seed done! admin@demo.com / ccEH@fNU7VEhbccW");
  await client.end();
  process.exit(0);
}
run().catch((err) => { console.error("Seed error:", err); process.exit(1); });
