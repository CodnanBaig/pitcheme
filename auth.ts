import NextAuth from "next-auth"
import type { NextAuthOptions, Account, Profile, User } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import EmailProvider from "next-auth/providers/email"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { verifyPassword } from "@/lib/auth-utils"
import { assertRuntimeEnvironment } from "@/lib/env"
import { enforceCredentialsLoginRateLimit } from "@/lib/auth-rate-limit"

assertRuntimeEnvironment()

const credentialsProvider = CredentialsProvider({
  name: "credentials",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" }
  },
  async authorize(credentials, request) {
    const email = typeof credentials?.email === "string"
      ? credentials.email.trim().toLowerCase()
      : ""
    const password = typeof credentials?.password === "string" ? credentials.password : ""

    if (!email || !password) {
      return null
    }

    if (process.env.NODE_ENV !== "test") {
      const rateLimit = await enforceCredentialsLoginRateLimit(email, request)
      if (!rateLimit.allowed) return null
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      }
    })

    if (!user || !user.password) {
      return null
    }

    const isValidPassword = await verifyPassword(password, user.password)

    if (!isValidPassword) {
      return null
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    }
  }
})

// NextAuth normalizes provider options at request time. Keeping the handler on
// the provider itself as well makes the exported configuration directly
// inspectable in tests and tooling without changing runtime behaviour.
const credentialsProviderWithHandler = credentialsProvider as typeof credentialsProvider & {
  authorize: NonNullable<typeof credentialsProvider.options>['authorize']
}
credentialsProviderWithHandler.authorize = credentialsProvider.options.authorize
credentialsProviderWithHandler.name = "credentials"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // Credentials authentication is always available for local and production
    // accounts. The email provider is added only when SMTP is configured.
    credentialsProviderWithHandler,
    ...(process.env.EMAIL_SERVER_HOST && process.env.EMAIL_SERVER_USER && process.env.EMAIL_SERVER_PASSWORD
      ? [
          EmailProvider({
            server: {
              host: process.env.EMAIL_SERVER_HOST,
              port: parseInt(process.env.EMAIL_SERVER_PORT || "587", 10),
              auth: {
                user: process.env.EMAIL_SERVER_USER,
                pass: process.env.EMAIL_SERVER_PASSWORD,
              },
            },
            from: process.env.EMAIL_FROM || "noreply@example.com",
          }),
        ]
      : []),
  ],
  session: {
    // Credentials authentication requires JWT sessions in NextAuth. The
    // adapter remains available for user/account persistence and email login.
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth/error",
    verifyRequest: "/auth/verify-request",
  },
  callbacks: {
    async session({ session, user, token }) {
      if (user) {
        session.user.id = user.id
      } else if (token?.id) {
        // Keep the callback useful if a deployment switches to JWT sessions.
        session.user.id = String(token.id)
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
  },
  events: {
    async signIn(message: { user: User; account: Account | null; profile?: Profile; isNewUser?: boolean }) {
      const { account, isNewUser } = message
      console.log("User signed in", {
        provider: account?.provider || "credentials",
        isNewUser: Boolean(isNewUser),
      })
    },
    async signOut() {
      console.log("User signed out")
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
}

export const auth = () => getServerSession(authOptions)

export default NextAuth(authOptions)
