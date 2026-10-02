import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  DATABASE_URL: required("DATABASE_URL"),
  JWT_SECRET: required("JWT_SECRET"),
  PORT: Number(process.env.PORT ?? 4000),
  // Comma separated list of allowed browser origins
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  RUN_EXPIRY_JOB: (process.env.RUN_EXPIRY_JOB ?? "true") !== "false",
};
