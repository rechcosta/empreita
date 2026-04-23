import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { connectDB } from './db'
import User from '@/models/User'

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

        await connectDB()
        const user = await User.findOne({ email: credentials.email.toLowerCase() }).select('+password')
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