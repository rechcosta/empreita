'use client'

import { Session } from 'next-auth'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'

interface Props { session: Session }

export default function AppHeader({ session }: Props) {
  const { companyName, logoBase64 } = session.user

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* Brand — icon only per design decision */}
        <Link href="/dashboard" className="flex items-center">
          <Logo variant="icon" size={36} />
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {logoBase64 && (
            <img
              src={logoBase64}
              alt="Logo"
              className="h-8 w-8 rounded-md object-cover border border-gray-200"
            />
          )}
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{companyName}</p>
            <p className="text-xs text-gray-500">{session.user.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            Sair
          </button>
        </div>

      </div>
    </header>
  )
} 