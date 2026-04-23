import 'next-auth'
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      companyName: string
      cnpj: string
      logoBase64?: string
    } & DefaultSession['user']
  }

  interface User {
    id: string
    companyName: string
    cnpj: string
    logoBase64?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    companyName: string
    cnpj: string
    logoBase64?: string
  }
}
