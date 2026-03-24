import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { publicDb } from "../db/client.js";
import { env } from "../env.js";
import * as schema from "../db/public-schema.js";

export const auth = betterAuth({
  database: drizzleAdapter(publicDb, {
    provider: "pg",
    schema: {
      user: schema.user,
      account: schema.account,
      session: schema.session,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.WEB_URL],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  user: {
    additionalFields: {
      metadata: {
        type: "string",
        required: false,
        returned: true,
      },
      banned: {
        type: "boolean",
        required: false,
        defaultValue: false,
        returned: true,
      },
      bannedAt: {
        type: "date",
        required: false,
        returned: true,
      },
    },
  },
  advanced: {
    generateId: () => crypto.randomUUID(),
  },
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
