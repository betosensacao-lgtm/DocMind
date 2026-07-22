import { config } from "dotenv";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
config({ path: ".env.local" });

async function run() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not configured"); process.exit(1); }
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "src/db/migrations" });
  console.log("Migrations applied successfully!");
  await client.end();
  process.exit(0);
}
run().catch((err) => { console.error("Migration error:", err); process.exit(1); });
