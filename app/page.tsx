import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import LandingPage from '@/components/landing/LandingPage'

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  // Already signed in → go straight to dashboard
  if (session) redirect('/dashboard')

  // Otherwise show the public landing page
  return <LandingPage />
}