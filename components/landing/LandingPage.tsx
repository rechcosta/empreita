import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ═══════════════════════ NAVBAR ═══════════════════════ */}
      <header className="border-b border-gray-200 bg-white">
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Logo variant="lockup" size={36} />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 sm:px-4 py-2"
            >
              Entrar
            </Link>
            <Link href="/register" className="btn-primary text-sm">
              Começar grátis
            </Link>
          </div>
        </nav>
      </header>

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-20 sm:pb-28">
        <div className="max-w-3xl mx-auto text-center">

          {/* Headline: line 1 neutral, line 2 in brand orange (per spec) */}
          {/* EDIT: change headline copy here */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight">
            <span className="block text-gray-900">Orçamentos de obras</span>
            <span className="block text-brand-500 mt-1 sm:mt-2">
              profissionais em minutos
            </span>
          </h1>

          {/* EDIT: change subheadline copy here */}
          <p className="mt-6 sm:mt-8 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Monte orçamentos detalhados de materiais e mão de obra, calcule
            totais em tempo real e envie PDFs profissionais para seus clientes.
          </p>

          {/* CTAs — stack on mobile, inline on desktop; primary first */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/register"
              className="btn-primary w-full sm:w-auto px-8 py-3 text-base"
            >
              Criar conta grátis
            </Link>
            <Link
              href="/login"
              className="btn-secondary w-full sm:w-auto px-8 py-3 text-base"
            >
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ BENEFITS ═══════════════════════ */}
      <section className="bg-[#FAFAFA] border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">

          <div className="max-w-2xl mx-auto text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {/* EDIT: change section heading */}
              Tudo o que você precisa para fechar negócios
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">

            {/* Card 1: Real-time calculation */}
            <BenefitCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              }
              title="Cálculo em tempo real"
              description="Adicione materiais e mão de obra e veja o total atualizar automaticamente. Sem planilha, sem conta na mão."
            />

            {/* Card 2: PDF ready to send */}
            <BenefitCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              title="PDF pronto para envio"
              description="Gere um PDF com a identidade da sua empresa em um clique. Logo, CNPJ, tabela completa e total destacado."
            />

            {/* Card 3: Data security */}
            <BenefitCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              }
              title="Segurança dos dados"
              description="Seus orçamentos ficam salvos com autenticação e isolamento por conta. Só você acessa o que é seu."
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════ FOOTER CTA ═══════════════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Pronto para acelerar seus orçamentos?
        </h2>
        <p className="mt-4 text-gray-600 max-w-xl mx-auto">
          Cadastre-se em menos de um minuto e crie seu primeiro orçamento hoje.
        </p>
        <Link
          href="/register"
          className="btn-primary inline-flex mt-8 px-8 py-3 text-base"
        >
          Criar conta grátis
        </Link>
      </section>

      {/* ═══════════════════════ FOOTER ═══════════════════════ */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo variant="lockup" size={28} />
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} Empreita. Gestão de orçamentos.
          </p>
        </div>
      </footer>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────

interface BenefitCardProps {
  icon: React.ReactNode
  title: string
  description: string
}

function BenefitCard({ icon, title, description }: BenefitCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8 hover:border-gray-300 hover:shadow-sm transition-all">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-brand-50 text-brand-600 mb-5">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  )
}