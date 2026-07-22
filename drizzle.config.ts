import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
config({ path: ".env.local" });
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: migrationUrl },
});
