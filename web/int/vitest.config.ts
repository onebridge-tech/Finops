// Integration tests: they write real rows, so they only run against a throwaway database on this computer.
//   DATABASE_URL=postgresql://postgres:pw@localhost:5544/finops npx prisma db push && npm run test:int
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "")) throw new Error("test:int needs DATABASE_URL to point at a database on localhost");
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "server-only": path.resolve(__dirname, "empty.ts"), "@": path.resolve(__dirname, "../src") } },
  test: { include: ["int/**/*.int.ts"], testTimeout: 60000, hookTimeout: 60000, fileParallelism: false },
});
