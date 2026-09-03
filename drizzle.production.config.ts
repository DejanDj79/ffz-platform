import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` does not need a live database connection.
// The fallback exists only so the same config can be imported when no
// DATABASE_URL is present. `migrate` receives the real production URL
// from Docker Compose.
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://ffz:generate_only@127.0.0.1:5432/ffz_generate";

export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./src/db/schema.ts",
    "./src/db/custom-rule-presets-schema.ts",
    "./src/db/trading-guardrails-schema.ts",
    "./src/db/user-plans-schema.ts",
    "./src/db/founder-slots-schema.ts",
  ],
  out: "./drizzle-production",

  dbCredentials: {
    url: databaseUrl,
  },

  migrations: {
    schema: "drizzle",
    table: "__drizzle_migrations",
  },

  strict: true,
  verbose: true,
});
