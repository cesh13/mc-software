import dotenv from "dotenv";
dotenv.config({ path: "./apps/api/.env" });

async function createAdminUser(email: string, password: string, name: string) {
  const API_URL = process.env.BETTER_AUTH_URL || "http://localhost:3001";
  
  try {
    console.log("Creating admin user via Better Auth API...");
    
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
        console.log("   Run: pnpm delete-user ${email}");
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

    // Update user to add admin role and verify email
    const postgres = (await import("postgres")).default;
    const sql = postgres(process.env.DATABASE_URL!);

    await sql`
      UPDATE "user" 
      SET metadata = ${JSON.stringify({ role: "admin" })},
          email_verified = true
      WHERE id = ${userId}
    `;

    await sql.end();

    console.log("✅ Admin user created successfully!");
    console.log(`   Email: ${email}`);
    console.log(`   Name: ${name}`);
    console.log(`   Role: admin`);
    console.log("\nYou can now log in at http://localhost:3000/login");
  } catch (error: any) {
    console.error("❌ Error creating admin user:", error.message || error);
    throw error;
  }
}

// Get arguments from command line
const email = process.argv[2];
const password = process.argv[3];
const name = process.argv[4] || "Admin User";

if (!email || !password) {
  console.error("Usage: pnpm create-admin <email> <password> [name]");
  console.error("Example: pnpm create-admin admin@example.com SecurePass123 \"Admin User\"");
  console.error("\nNote: Make sure the API dev server is running (pnpm dev)");
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

createAdminUser(email, password, name).catch(console.error);
