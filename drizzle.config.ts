import { defineConfig } from "drizzle-kit";

// Генерация миграций: npm run db:generate
// Применяются автоматически при первом обращении к базе (src/server/db/index.ts).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
});
