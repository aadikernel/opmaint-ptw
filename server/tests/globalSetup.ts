import { execSync } from "node:child_process";

/** Applies Prisma migrations to the TEST database before the tests run. */
export default function setup() {
  if (process.env.SKIP_MIGRATE === "1") return;
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://ptw:ptw@localhost:5432/ptw_test";
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
