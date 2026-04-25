import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { connectDB } from './db'
import User from '@/models/User'
import { checkRateLimit } from './rateLimit'

// 5 failed attempts per 15 min per email. Tuned for the typical "user
// forgot their password and is trying variants" case (legit) without
// letting a script blast through. See lib/rateLimit.ts for caveats.
const LOGIN_MAX_ATTEMPTS = 5
const LOGIN_WINDOW_MS = 15 * 60 * 1000

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email.toLowerCase().trim()

        // Rate limit by email. Keying by IP would be more robust against
        // credential-stuffing, but we don't have a reliable IP here from
        // NextAuth's authorize() — it's the wrong layer. Per-email is a
        // pragmatic compromise and stops the most common bad pattern
        // (script hammering one account).
        const rl = checkRateLimit(`login:${email}`, {
          maxAttempts: LOGIN_MAX_ATTEMPTS,
          windowMs: LOGIN_WINDOW_MS,
        })
        if (!rl.allowed) {
          // NextAuth's authorize() can't return a structured error code, so
          // we throw — the message becomes the `error` query param. Frontend
          // could special-case this if we wanted a friendlier UX.
          throw new Error('Muitas tentativas. Tente novamente em alguns minutos.')
        }

        await connectDB()
        const user = await User.findOne({ email }).select('+password')
        if (!user) return null

        const isValid = await user.comparePassword(credentials.password)
        if (!isValid) return null

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.companyName,
          companyName: user.companyName,
          cnpj: user.cnpj,
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.companyName = user.companyName
        token.cnpj = user.cnpj
      }
      if (trigger === 'update' && session) {
        token = { ...token, ...session }
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      session.user.companyName = token.companyName
      session.user.cnpj = token.cnpj
      if (token.id) {
        await connectDB()
        const user = await User.findById(token.id).select('logoBase64')
        session.user.logoBase64 = user?.logoBase64 ?? undefined
      }
      return session
    },
  },
}