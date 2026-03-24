import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: "./apps/api/.env" });

const connectionString = process.env.DATABASE_URL!;

async function deleteUser(email: string) {
  const sql = postgres(connectionString);

  try {
    // Delete account first (foreign key constraint)
    const deletedAccounts = await sql`
      DELETE FROM account WHERE account_id = ${email}
      RETURNING id
    `;

    // Delete user
    const deletedUsers = await sql`
      DELETE FROM "user" WHERE email = ${email}
      RETURNING id, email
    `;

    if (deletedUsers.length === 0) {
      console.log(`❌ User with email ${email} not found`);
      process.exit(1);
    }

    console.log(`✅ User ${email} deleted successfully`);
    console.log(`   Deleted ${deletedAccounts.length} account(s)`);
    console.log(`   Deleted ${deletedUsers.length} user(s)`);
  } catch (error) {
    console.error("❌ Error deleting user:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

const email = process.argv[2];

if (!email) {
  console.error("Usage: pnpm delete-user <email>");
  console.error("Example: pnpm delete-user admin@example.com");
  process.exit(1);
}

deleteUser(email).catch(console.error);
