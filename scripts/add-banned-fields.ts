import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config();

const sql = postgres(process.env.DATABASE_URL!);

async function addBannedFields() {
  try {
    console.log("Adding banned and banned_at columns to user table...");
    
    await sql`
      ALTER TABLE "user" 
      ADD COLUMN IF NOT EXISTS "banned" boolean DEFAULT false NOT NULL
    `;
    
    await sql`
      ALTER TABLE "user" 
      ADD COLUMN IF NOT EXISTS "banned_at" timestamp
    `;
    
    console.log("✓ Successfully added banned fields to user table");
  } catch (error) {
    console.error("Error adding banned fields:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

addBannedFields();
