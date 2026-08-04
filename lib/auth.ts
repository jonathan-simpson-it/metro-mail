import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { getMongoClient, getMongoDb } from "@/lib/mongodb";

/** Comma-separated allowlist of emails permitted to sign up. */
export function isEmailAllowed(email: string): boolean {
  const raw = process.env.ALLOWED_EMAILS ?? "";
  const allowed = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return false;
  return allowed.includes(email.trim().toLowerCase());
}

let instancePromise: ReturnType<typeof createAuth> | null = null;

async function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET is not defined. Add it to your environment variables.",
    );
  }

  const baseURL =
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const [client, db] = await Promise.all([getMongoClient(), getMongoDb()]);

  // Browser fetch sends an Origin header. Localhost must be trusted in dev,
  // even when BETTER_AUTH_URL / NEXT_PUBLIC_APP_URL point at production.
  const localDevOrigins =
    process.env.NODE_ENV === "development"
      ? ["http://localhost:3000", "http://127.0.0.1:3000"]
      : [];

  return betterAuth({
    secret,
    baseURL,
    trustedOrigins: [baseURL, ...localDevOrigins],
    database: mongodbAdapter(db, { client }),
    rateLimit: {
      enabled: true,
      window: 60, // seconds
      max: 20, // requests per window per IP: brute-force guard
    },
    emailAndPassword: {
      enabled: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days for an internal mail client
      updateAge: 60 * 60 * 24, // sliding renewal daily
    },
    user: {
      additionalFields: {
        fromName: {
          type: "string",
          required: false,
          defaultValue: "",
        },
        fromAlias: {
          type: "string",
          required: false,
          defaultValue: "",
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!isEmailAllowed(user.email)) {
              throw new Error("NOT_ALLOWED");
            }
          },
        },
        update: {
          before: async (user) => {
            // Account email changes must also respect the allowlist.
            if (user.email && !isEmailAllowed(user.email)) {
              throw new Error("NOT_ALLOWED");
            }
          },
        },
      },
    },
  });
}

/**
 * Lazy Better Auth instance. Built on first use so missing credentials
 * never crash module evaluation (build/CI), only the requests that need it.
 */
export function getAuth() {
  instancePromise ??= createAuth();
  return instancePromise;
}
