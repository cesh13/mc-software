-- Add banned and bannedAt columns to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banned" boolean DEFAULT false NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banned_at" timestamp;
