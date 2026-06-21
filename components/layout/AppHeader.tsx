'use client'

import { Session } from 'next-auth'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/brand/Logo'
import { cn } from '@/lib/utils'

interface Props { session: Session }

const NAV = [
  { href: '/dashboard', label: 'Orçamentos', match: ['/dashboard', '/orcamentos'] },
  { href: '/recibos', label: 'Recibos', match: ['/recibos'] },
  { href: '/funcionarios', label: 'Funcionários', match: ['/funcionarios'] },
]

export default function AppHeader({ session }: Props) {
  const { companyName, logoBase64 } = session.user
  const pathname = usePathname()

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* Brand + nav */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center">
            <Logo variant="icon" size={36} />
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = item.match.some((m) => pathname?.startsWith(m))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

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