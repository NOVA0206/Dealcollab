import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "./db";
import { accounts, sessions, users, verificationTokens } from "./db/schema";
import authConfig from "./auth.config";
import Credentials from "next-auth/providers/credentials";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

const adapter = DrizzleAdapter(db, {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
});

// Override createUser to support WhatsApp -> Google account linking
const originalCreateUser = adapter.createUser!;
adapter.createUser = async (user) => {
  const cookieStore = await cookies();
  const whatsappPhone = cookieStore.get("whatsapp_phone")?.value;

  if (whatsappPhone) {
    // Check if a placeholder user exists with this phone
    const existing = await db.query.users.findFirst({
      where: eq(users.phone, whatsappPhone),
    });

    // If it's a WhatsApp placeholder (placeholder email), merge the Google profile into it
    if (existing && existing.email?.endsWith('@dealcollab.ai')) {
      const [updatedUser] = await db.update(users)
        .set({
          email: user.email,
          name: user.name,
          image: user.image,
          emailVerified: user.emailVerified,
          source: 'whatsapp',
        })
        .where(eq(users.id, existing.id))
        .returning();
      
      cookieStore.delete("whatsapp_phone");
      return updatedUser;
    }
  }

  return originalCreateUser(user);
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  ...authConfig,
  trustHost: true,
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
  ],
  session: { strategy: "jwt" },
  callbacks: {
    // @ts-expect-error - callbacks might not be present in authConfig
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user.id) return true;

      const cookieStore = await cookies();
      const whatsappPhone = cookieStore.get("whatsapp_phone")?.value;

      if (whatsappPhone) {
        const existingUserWithPhone = await db.query.users.findFirst({
          where: eq(users.phone, whatsappPhone),
        });

        // Case: User logs in with an EXISTING Google account, but we have a WhatsApp phone to link
        if (existingUserWithPhone && existingUserWithPhone.id !== user.id) {
          // If the conflict is with a placeholder, delete the placeholder and take the phone
          if (existingUserWithPhone.email?.endsWith('@dealcollab.ai')) {
            await db.delete(users).where(eq(users.id, existingUserWithPhone.id));
          } else {
            // Actual conflict with another real user
            return "/?error=phone_linked_to_other";
          }
        }

        // Link the phone to this real Google user
        await db.update(users)
          .set({ 
            phone: whatsappPhone, 
            isPhoneVerified: true 
          })
          .where(eq(users.id, user.id));

        cookieStore.delete("whatsapp_phone");
      }

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
    async session({ session, token }) {
      if (session.user) {
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
      return session;
    },
  },
});

export const { GET, POST } = handlers;
