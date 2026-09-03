import { config } from "dotenv";
config({ path: ".env.local" });

import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set.");
}

export default defineConfig({
  schema: [
    "./src/db/schema.ts",
    "./src/db/custom-rule-presets-schema.ts",
    "./src/db/trading-guardrails-schema.ts",
    "./src/db/user-plans-schema.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
