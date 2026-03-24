import dotenv from "dotenv";
dotenv.config({ path: "./apps/api/.env" });

async function createClientUser(email: string, password: string, name: string, clientSlug: string) {
  const API_URL = process.env.BETTER_AUTH_URL || "http://localhost:3001";
  
  try {
    console.log(`Creating client user for: ${clientSlug}...`);
    
    // First, sign up the user through Better Auth
    const signupResponse = await fetch(`${API_URL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": process.env.WEB_URL || "http://localhost:3000",
      },
      body: JSON.stringify({
        email,
        password,
        name,
      }),
    });

    const signupData = await signupResponse.json();
    
    if (!signupResponse.ok) {
      if (signupData.message?.includes("already exists")) {
        console.log(`❌ User with email ${email} already exists`);
        console.log(`   Run: pnpm delete-user ${email}`);
      } else {
        console.log("❌ Signup failed:", signupData);
      }
      process.exit(1);
    }

    const userId = signupData.user?.id;
    if (!userId) {
      console.error("❌ User ID not found in response");
      process.exit(1);
    }

    // Update user to add clientSlug and verify email
    const postgres = (await import("postgres")).default;
    const sql = postgres(process.env.DATABASE_URL!);

    // Verify the client exists
    const client = await sql`
      SELECT organization_slug, display_name, is_provisioned, is_active
      FROM client_registry
      WHERE organization_slug = ${clientSlug}
    `;

    if (client.length === 0) {
      console.error(`❌ Client '${clientSlug}' not found`);
      console.log("   Create the client first in the admin panel");
      await sql.end();
      process.exit(1);
    }

    if (!client[0].is_provisioned) {
      console.error(`❌ Client '${clientSlug}' is not provisioned`);
      console.log(`   Run: pnpm provision-client ${clientSlug}`);
      await sql.end();
      process.exit(1);
    }

    if (!client[0].is_active) {
      console.error(`❌ Client '${clientSlug}' is not active`);
      console.log("   Enable the client in the admin panel");
      await sql.end();
      process.exit(1);
    }

    await sql`
      UPDATE "user" 
      SET metadata = ${JSON.stringify({ clientSlug })},
          email_verified = true
      WHERE id = ${userId}
    `;

    await sql.end();

    console.log("✅ Client user created successfully!");
    console.log(`   Email: ${email}`);
    console.log(`   Name: ${name}`);
    console.log(`   Client: ${client[0].display_name} (${clientSlug})`);
    console.log("\nUser can now log in at http://localhost:3000/login");
    console.log(`Note: User will need to select their client or the app needs to detect it from their metadata`);
  } catch (error: any) {
    console.error("❌ Error creating client user:", error.message || error);
    throw error;
  }
}

// Get arguments from command line
const email = process.argv[2];
const password = process.argv[3];
const clientSlug = process.argv[4];
const name = process.argv[5] || "Client User";

if (!email || !password || !clientSlug) {
  console.error("Usage: pnpm create-client-user <email> <password> <client-slug> [name]");
  console.error("Example: pnpm create-client-user user@acme.com SecurePass123 acme_corp \"John Doe\"");
  console.error("\nNote: Make sure the API dev server is running (pnpm dev)");
  console.error("      and the client has been created and provisioned");
  process.exit(1);
}

// Validate email format
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("❌ Invalid email format");
  process.exit(1);
}

// Validate password length
if (password.length < 8) {
  console.error("❌ Password must be at least 8 characters long");
  process.exit(1);
}

// Validate client slug format
if (!/^[a-z0-9_]+$/.test(clientSlug)) {
  console.error("❌ Invalid client slug format (use lowercase letters, numbers, and underscores only)");
  process.exit(1);
}

createClientUser(email, password, name, clientSlug).catch(console.error);
