import dotenv from "dotenv";

// Load environment variables before anything else
dotenv.config();

export const env = {
  DATABASE_URL: process.env.DATABASE_URL || "",
  WEB_URL: process.env.WEB_URL || "http://localhost:3000",
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
  PORT: parseInt(process.env.PORT || "3001"),
  NODE_ENV: process.env.NODE_ENV || "development",
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
};

// Validate required env vars only when actually used
export function validateEnv() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }
}
