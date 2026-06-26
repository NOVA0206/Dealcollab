import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import authConfig from "./auth.config";
import { db } from "./db";
import { accounts, sessions, users, verificationTokens } from "./db/schema";

// Debug logging for Production/Vercel (Masked)
if (process.env.NODE_ENV === "production") {
  console.log("Auth Configuration Check:", {
    hasSecret: !!(process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET),
    hasGoogleId: !!process.env.GOOGLE_CLIENT_ID,
    hasGoogleSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    authUrl: process.env.AUTH_URL ? "Set" : "Not Set (Inferred)",
    trustHost: process.env.AUTH_TRUST_HOST || "Not Set",
  });
}

import { eq } from "drizzle-orm";

const adapter = DrizzleAdapter(db, {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
});

console.log("[AUTH] SESSION STRATEGY: jwt");

const { handlers, auth: originalAuth, signIn, signOut } = NextAuth({
  adapter,
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  basePath: "/api/auth",
  ...authConfig,
  trustHost: true,
  debug: process.env.NODE_ENV === 'development',
  logger: {
    error(error) {
      console.error("NEXTAUTH ERROR:", error);
    },
    warn(code) {
      console.warn("NEXTAUTH WARN:", code);
    },
    debug(code, metadata) {
      console.log("NEXTAUTH DEBUG:", code, metadata);
    },
  },
  providers: [
    ...authConfig.providers,
    Credentials({
      id: "credentials",
      name: "Phone OTP",
      credentials: {
        phone: { label: "Phone", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.phone) return null;

        // Find the user by verified phone number
        const user = await db.query.users.findFirst({
          where: eq(users.phone, credentials.phone as string),
        });

        if (user && user.isPhoneVerified) {
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            isPhoneVerified: user.isPhoneVerified,
          };
        }
        return null;
      },
    }),
    Credentials({
      id: "gmail-otp",
      name: "Gmail OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.code) return null;

        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email as string),
        });

        if (!user || !user.otpCode || !user.otpExpires) return null;
        if (new Date() > user.otpExpires) return null;
        if (user.otpCode !== credentials.code) {
          await db.update(users)
            .set({ otpAttempts: (user.otpAttempts ?? 0) + 1 })
            .where(eq(users.id, user.id));
          return null;
        }

        // Clear OTP after successful verification
        await db.update(users)
          .set({ otpCode: null, otpExpires: null, otpAttempts: 0, emailVerified: new Date() })
          .where(eq(users.id, user.id));

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          isPhoneVerified: user.isPhoneVerified,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    // @ts-expect-error - callbacks might not be present in authConfig
    ...authConfig.callbacks,
    async signIn({ user }) {
      console.log("[AUTH] signIn — userId:", user.id, "email:", user.email);
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        // @ts-expect-error - isPhoneVerified is a custom property added via callbacks
        token.isPhoneVerified = user.isPhoneVerified === true || String(user.isPhoneVerified) === 'true';
        // @ts-expect-error - phone is a custom property added via callbacks
        token.phone = user.phone;
        // @ts-expect-error - tokens is a custom property added via callbacks
        token.tokens = user.tokens || 0;
        // @ts-expect-error - profileCompletion is a custom property added via callbacks
        token.profileCompletion = user.profileCompletion || 0;
      }

      // Sync DB → JWT: on explicit update() call OR when phone hasn't been loaded yet
      if (trigger === "update" || token.phone === undefined || token.phone === null) {
        try {
          const dbUser = await db.query.users.findFirst({
            where: eq(users.id, token.id as string),
          });
          if (dbUser) {
            token.isPhoneVerified = dbUser.isPhoneVerified === true || String(dbUser.isPhoneVerified) === 'true';
            token.phone = dbUser.phone ?? null;
            token.tokens = dbUser.tokens || 0;
            token.profileCompletion = dbUser.profileCompletion || 0;
          }
        } catch (error: unknown) {
          console.error("FULL ERROR:", error);
          console.error("STRINGIFIED:", JSON.stringify(error, null, 2));
          // Return existing token — do NOT throw, keeps user logged in
        }
      }

      return token;
    },
    async session({ session, token, user }) {
      if (session.user) {
        // In database strategy, 'user' is passed. In jwt strategy, 'token' is passed.
        if (user) {
          session.user.id = user.id;
          // @ts-expect-error - Custom properties on user object from database
          session.user.isPhoneVerified = user.isPhoneVerified;
          // @ts-expect-error - Custom properties on user object from database
          session.user.phone = user.phone;
          // @ts-expect-error - Custom properties on user object from database
          session.user.tokens = user.tokens;
          // @ts-expect-error - Custom properties on user object from database
          session.user.profileCompletion = user.profileCompletion;
        } else if (token) {
          session.user.id = token.id as string;
          // @ts-expect-error - isPhoneVerified is added to session user via JWT token
          session.user.isPhoneVerified = token.isPhoneVerified;
          // @ts-expect-error - phone is added to session user via JWT token
          session.user.phone = token.phone;
          // @ts-expect-error - tokens is added to session user via JWT token
          session.user.tokens = token.tokens;
          // @ts-expect-error - profileCompletion is added to session user via JWT token
          session.user.profileCompletion = token.profileCompletion;
        }
      }
      return session;
    },
  },
});

export { handlers, signIn, signOut };

export const auth = (async (...args: unknown[]) => {
  try {
    const fn = originalAuth as (...args: unknown[]) => Promise<unknown>;
    return await fn(...args);
  } catch (error: unknown) {
    console.error("[AUTH WRAPPER] Caught authentication error:", error);

    const err = error as Record<string, unknown> | null | undefined;
    const errMsg = String(err?.message || "");
    const errStack = String(err?.stack || "");
    const errCode = String(err?.code || "");
    const errType = String(err?.type || "");
    // NextAuth wraps the JWE error: outer has type:'JWTSessionError', inner cause has code:'ERR_JWE_INVALID'
    const causeCode = String((err?.cause as Record<string, unknown>)?.code || "");
    const causeErr = (err?.cause as Record<string, unknown>)?.err;
    const causeErrCode = String((causeErr as Record<string, unknown>)?.code || "");

    if (
      errType === "JWTSessionError" ||
      errMsg.includes("JWTSessionError") ||
      errStack.includes("JWEInvalid") ||
      errCode === "ERR_JWE_INVALID" ||
      causeCode === "ERR_JWE_INVALID" ||
      causeErrCode === "ERR_JWE_INVALID"
    ) {
      console.warn("[AUTH WRAPPER] Invalid compact JWE token detected, attempting to clear session cookies.");
      try {
        const { cookies } = await import('next/headers');
        const cookieStore = await cookies();
        cookieStore.delete('authjs.session-token');
        cookieStore.delete('next-auth.session-token');
        cookieStore.delete('__Secure-authjs.session-token');
        cookieStore.delete('__Secure-next-auth.session-token');
        console.log("[AUTH WRAPPER] Stale cookies deleted successfully.");
      } catch (cookieErr) {
        console.warn("[AUTH WRAPPER] Failed to delete cookies automatically:", cookieErr);
      }
    }
    return null;
  }
}) as unknown as typeof originalAuth;
