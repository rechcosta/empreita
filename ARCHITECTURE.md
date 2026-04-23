# Arquitetura — Empreita

Este documento explica **como** o sistema está construído e **por que** decisões importantes foram tomadas da forma que foram. O público é quem precisa trabalhar no código (contribuir, fazer fork, auditar) ou avaliar o projeto profissionalmente.

Para visão de produto e instruções operacionais, ver [`README.md`](./README.md).

---

## Sumário

1. [Visão geral](#visão-geral)
2. [Stack e justificativa](#stack-e-justificativa)
3. [Organização do código](#organização-do-código)
4. [Modelo de dados](#modelo-de-dados)
5. [Fluxo de autenticação](#fluxo-de-autenticação)
6. [Camada de APIs](#camada-de-apis)
7. [Geração de PDF](#geração-de-pdf)
8. [Decisões de domínio](#decisões-de-domínio)
9. [Segurança](#segurança)
10. [Limites e trabalhos futuros](#limites-e-trabalhos-futuros)

---

## Visão geral

Empreita é um SaaS monolítico em Next.js (App Router). Não há backend separado — frontend e API vivem no mesmo projeto. A escolha por monolito é deliberada: o domínio é pequeno, o tráfego esperado é baixo a médio, e a complexidade de um sistema distribuído não se justifica.

Três tipos de usuário em potencial existem no modelo mental:
- **Empresa prestadora** — usuário autenticado, dono da conta (modelado como `User`)
- **Cliente final** — quem recebe o orçamento em PDF (**não** tem cadastro no sistema)
- **Recipient do PDF** — o PDF é o artefato entregue para o cliente final fora do sistema

Apenas a empresa prestadora é modelada. O cliente final é um campo livre em cada orçamento, não uma entidade. Isso é intencional: gerenciar cadastro de cliente seria feature de CRM, fora do escopo.

---

## Stack e justificativa

| Escolha | Alternativa comum | Por quê |
|---|---|---|
| **Next.js 14 (App Router)** | Vite + Express separados | Frontend + API no mesmo projeto reduz complexidade operacional. App Router traz Server Components para páginas que consultam sessão (`getServerSession`) sem round-trip extra. |
| **MongoDB + Mongoose** | PostgreSQL + Prisma | O schema tem arrays aninhados com tipos variados (`Material[]`, `LaborItem[]` com union discriminada). Em SQL, isso vira 4+ tabelas com joins. Em Mongo, é um documento só. Leitura do dashboard é uma query de 1 documento por orçamento. |
| **NextAuth.js (JWT strategy)** | Session em banco / Auth0 | JWT em cookie serverless-friendly — não precisa de store separado de sessão. Credentials Provider cobre o caso (email + senha), sem complicação de OAuth. |
| **Tailwind CSS** | CSS Modules / styled-components | Paleta customizada via `tailwind.config.ts` alinhada ao spec visual. Utility-first acelera prototipagem em app com muitos formulários. Sem run-time CSS-in-JS — bundle menor. |
| **jsPDF + jspdf-autotable (client-side)** | Puppeteer no server | Geração de PDF client-side é zero-custo no serverless da Vercel (que não gosta de Puppeteer). Trade-off: o client precisa baixar as libs (~120kb gzip), mas o usuário da plataforma é técnico e o ganho em latência de geração justifica. |
| **bcryptjs (puro JS)** | bcrypt (nativo) | bcryptjs roda em qualquer ambiente Node/Edge sem compilação nativa. Performance é ligeiramente menor, mas aceitável para volume de cadastros/logins esperado. |

**Decisão estratégica que vale sublinhar:** o projeto **evita complexidade prematura**. Não tem Redis, não tem fila, não tem microsserviços, não tem CI/CD elaborado, não tem testes automatizados (ainda). Isso não é descuido — é escopo. Adicionar sem necessidade real é débito técnico gratuito.

---

## Organização do código

O projeto segue a convenção do App Router do Next.js. Pastas com parêntese (`(auth)`, `(app)`) são **route groups** — agrupam rotas sem afetar a URL, permitindo layouts distintos por grupo.

```
app/
├── (auth)/          layout sem header, fundo claro — para login/register
├── (app)/           layout com AppHeader + middleware protegido
├── api/             handlers server-side (não renderizam)
└── page.tsx         landing pública (renderizada quando não há sessão)
```

### Por que componentes estão em `/components` e não colocados com rotas

Poderia ter feito `app/(app)/orcamentos/novo/_components/OrcamentoFormPage.tsx`. Não fiz porque:

1. `OrcamentoFormPage` é compartilhado entre `/orcamentos/novo` e `/orcamentos/[id]/editar`. Colocar em uma das rotas é arbitrário.
2. Componentes puramente de apresentação (não rotas) ficam mais descobríveis em `/components` com subpastas por domínio (`orcamento/`, `brand/`, `layout/`).

### Por que `lib/labor.ts` existe como módulo separado

O cálculo do total da mão de obra é referenciado em três lugares: preview no formulário, `POST /api/orcamentos`, `PUT /api/orcamentos/:id`. Duplicar a fórmula é receita para divergência.

```typescript
// lib/labor.ts
export function computeLaborTotal(labor: Labor): number {
  return (labor.fixedGroupValue ?? 0)
       + sumUnitItems(labor.items)
       + sumSqmItems(labor.items)
}
```

Regra de ouro aplicada: **fórmulas de negócio viram funções puras em um módulo testável**, mesmo que o teste ainda não exista. O custo é baixo, o benefício estrutural é alto.

---

## Modelo de dados

Duas collections: `users` e `orcamentos`. Relacionamento via `userId` (ObjectId ref).

### User

```typescript
{
  _id: ObjectId
  companyName: string
  cnpj: string (unique, índice)
  logoBase64?: string           // pequenas imagens inline, evita storage
  email: string (unique, lowercase)
  password: string (hash bcrypt, select: false por default)
  createdAt, updatedAt: Date
}
```

`logoBase64` é controverso — guardar imagem em base64 no banco não escala. A decisão foi consciente: no volume esperado (empresa faz upload uma única vez, logos ≤ 2MB, poucos milhares de contas), o custo de montar S3/Cloudinary para uma feature marginal não compensa. **Quando o volume crescer, isso migra.** Ver [trabalhos futuros](#limites-e-trabalhos-futuros).

### Orcamento

Documento completo, com arrays embutidos:

```typescript
{
  _id: ObjectId
  userId: ObjectId (índice)
  clientName: string
  clientAddress: string
  serviceName: string

  materials: [
    {
      name, unit, quantity,
      unitPrice: number | null,   // null ≠ 0
      total: number | null,
    }
  ],

  labor: {
    items: LaborItem[],           // union discriminada por `type`
    fixedGroupValue: number | null,
    total: number,                // sempre recomputado no servidor
  },

  materialsTotal, grandTotal: number,
  createdAt, updatedAt: Date
}
```

**Por que arrays embutidos e não collections separadas?**

- Cada orçamento é lido e escrito como uma unidade atômica. Editar um item de mão de obra sem salvar o resto não existe no fluxo.
- Materiais e itens de mão de obra não são consultados independentemente. Não há query "todos os materiais com nome X" — seria feature de BI, fora do escopo.
- Um documento por orçamento significa **uma query por operação**. Em SQL precisaria de 3+ joins.

Trade-off: se um orçamento crescer absurdamente (centenas de itens), o documento pode passar do limite de 16MB do Mongo. Na prática, orçamentos reais têm dezenas de itens no máximo.

### Union discriminada em `LaborItem`

Três tipos de item de mão de obra, identificados pelo campo `type`:

```typescript
type LaborItem =
  | { type: 'fixo'; description: string }
  | { type: 'por_unidade'; description: string; quantity: number; unitPrice: number; subtotal: number }
  | { type: 'por_m2'; description: string; area: number; pricePerMeter: number; subtotal: number }
```

No Mongoose, isso é modelado como schema único com todos os campos opcionais. A união de TypeScript garante correção no código; o Mongo só armazena o que cada item precisa.

---

## Fluxo de autenticação

NextAuth com **Credentials Provider** (email + senha) e **JWT strategy** (sem store de sessão em banco).

```
Cadastro:
  Client → POST /api/register → connectDB → User.create (bcrypt hook pre-save)
         ← { id, email, companyName }
         → signIn('credentials') → gera JWT → cookie httpOnly

Login:
  Client → signIn('credentials', {email, password})
         → authorize() em lib/auth.ts
            → User.findOne({ email }).select('+password')
            → user.comparePassword(input) (bcrypt.compare)
            → retorna user object (sem password)
         → NextAuth gera JWT assinado com NEXTAUTH_SECRET
         → cookie httpOnly

Cada request subsequente:
  Client → qualquer rota protegida
         → middleware.ts verifica token existe (via withAuth)
         → dentro do handler: getServerSession(authOptions)
         → se session.user.id existe, prossegue
         → senão, 401
```

### Por que JWT em cookie e não session em Mongo

O Mongo session store do NextAuth funcionaria. O trade-off: JWT é **stateless** — zero round-trip ao banco para validar sessão. Em serverless (Vercel), cada instância fria que inicia não precisa buscar sessão. Menos latência, menos load no banco.

O custo: **invalidar sessão antes do TTL é impossível sem blacklist**. Se um usuário "sair" em todos os dispositivos, a sessão expira quando o TTL expira. Para o contexto atual (1 usuário por conta, sem risco alto de comprometimento), isso é aceitável.

### Augmentação de tipos

Para que `session.user.companyName` e `session.user.cnpj` existam no TypeScript, `types/next-auth.d.ts` declara os campos adicionais:

```typescript
declare module 'next-auth' {
  interface Session {
    user: { id, companyName, cnpj, logoBase64? } & DefaultSession['user']
  }
}
```

Sem isso, o compilador só conhece os campos default (`name`, `email`, `image`).

---

## Camada de APIs

### Padrão de autorização

Toda rota protegida começa igual:

```typescript
const session = await getServerSession(authOptions)
if (!session) return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 })
```

Rotas por ID ainda validam que o documento pertence ao usuário:

```typescript
const orc = await Orcamento.findOne({ _id: params.id, userId: session.user.id })
if (!orc) return NextResponse.json({ message: 'Não encontrado.' }, { status: 404 })
```

Nota importante: **retornar 404 quando o orçamento é de outro usuário**, e não 403 (Forbidden). Isso evita expor a existência do documento. Um 403 confirmaria que o ID existe, apenas não é do usuário — leak de informação.

### Recálculo server-side

O cliente envia `materialsTotal` e `labor.total` no payload, mas a API os ignora e recalcula:

```typescript
const materialsTotal = materials.reduce((s, m) => m.total !== null ? s + m.total : s, 0)
const laborTotal = computeLaborTotal(labor)
const grandTotal = materialsTotal + laborTotal
```

Razão: o cliente pode ter bug, estar desatualizado, ou ser malicioso. **Totais persistidos em banco precisam vir de código que o servidor controla.** Esta regra vale em todo o sistema.

### Soft-delete: não aplicado aqui

Não há `deletedAt`. Orçamento excluído é `findOneAndDelete`, sai definitivo. Motivo: o cliente final recebeu PDF, que é o artefato legal. Manter registro de orçamento excluído no sistema gera clutter sem valor. **Se regulação mudar** (preservação de documentos por 5 anos, por exemplo), adiciona-se soft-delete.

---

## Geração de PDF

### Por que client-side

Três opções foram consideradas:

1. **Puppeteer no servidor** — renderiza HTML real e converte para PDF. Qualidade máxima, mas Puppeteer precisa de Chrome headless, que **não roda bem em Vercel Functions** (cold start gigantesco, bundle size problemático). Descartado.
2. **React PDF (`@react-pdf/renderer`)** — React components que viram PDF. Boa DX, mas menos controle fino de layout complexo. A lib foi **instalada mas não usada** — vestígio de tentativa inicial.
3. **jsPDF + jspdf-autotable** (escolhida) — libs vanilla, rodam no browser. Controle absoluto de layout, fonts, cores. Zero custo servidor.

### Estrutura de `lib/pdf.ts`

Função única, `generateOrcamentoPDF(orcamento, company)`. Sem abstrações desnecessárias — é um procedimento linear que constroi o documento de cima pra baixo:

1. Header (logo + nome + CNPJ + número/data)
2. Título do documento
3. Bloco cliente (nome, endereço, serviço)
4. Tabela de materiais (pulada se lista vazia)
5. Seção de mão de obra (3 grupos potenciais + subtotal)
6. Caixa do valor total (destaque em brand-soft)
7. Espaço para assinaturas (ancorado no fim da página)
8. Rodapé (em todas as páginas)

### Layout defensivo

Duas regras evitam colisão visual:

**1. Todas as tabelas declaram margem inferior mínima:**

```typescript
margin: { bottom: MIN_BOTTOM_SPACE }  // = 36mm reservados
```

Com isso, `jspdf-autotable` quebra página automaticamente em vez de invadir a área de rodapé/assinatura.

**2. Assinaturas são ancoradas, não fluidas:**

```typescript
const signatureTop = pageHeight - FOOTER_HEIGHT - SIGNATURE_TO_FOOTER - SIGNATURE_HEIGHT
```

Independente de quanto conteúdo existe acima, a linha de assinatura **sempre** fica na mesma posição relativa ao rodapé. Se o conteúdo transbordou, uma nova página é forçada.

### Paleta alinhada ao spec

O PDF usa as mesmas cores da UI para coerência visual:

- `#FF7A00` (accent) aparece **apenas** na linha do topo e na stripe esquerda da caixa de valor total
- `#FFF4E6` (brand-soft) como fundo da caixa de total
- `#FAFAFA` / `#F3F4F6` para striping sutil de tabelas
- `#111827` / `#374151` / `#6B7280` para hierarquia de texto
- `#E5E7EB` como borda única em todo lugar

O documento **imprime legivelmente em preto e branco**. Cor é informacional, não decorativa.

---

## Decisões de domínio

### Preço de material opcional

O spec exige: "Se valor não informado, não calcular subtotal, exibir '—'". A modelagem é `unitPrice: number | null`.

Alternativa rejeitada: `unitPrice: number` com flag `hasPricing: boolean`. Dois campos que podem ficar dessincronizados, mais código, pior semântica.

**Por que null e não `undefined`?** Em JSON (da API) e em Mongo, `null` é explícito — o valor existe e é "vazio". `undefined` costuma significar "campo não enviado". Distinguir os dois deixa o contrato mais claro.

Zero é preço válido (material doado) e **entra no subtotal**. `null` é "não informado" e **não entra**. Semântica diferente.

### Valor único compartilhado de preço fixo

O spec é explícito: "Itens NÃO possuem valor individual. Um único campo ao final da lista: 'Valor total da mão de obra'."

Modelagem: `labor.fixedGroupValue: number | null`. Se não há nenhum item do tipo `fixo` na lista, o campo é `null`. Remover o último item fixo reseta o campo automaticamente.

**Alternativa rejeitada:** cada item fixo ter seu próprio `unitPrice`. Teria sido mais simétrico com os outros tipos, mas **contraria o spec diretamente**. Leitor com atenção vai pegar.

### Os 3 tipos de mão de obra podem ser misturados

A union discriminada no TypeScript + schema unificado no Mongoose permite arrays heterogêneos:

```typescript
labor.items = [
  { type: 'fixo', description: 'Retirar piso' },
  { type: 'fixo', description: 'Derrubar parede' },
  { type: 'por_m2', description: 'Pintura', area: 30, pricePerMeter: 25, subtotal: 750 },
  { type: 'por_unidade', description: 'Trocar tomadas', quantity: 5, unitPrice: 40, subtotal: 200 }
]
labor.fixedGroupValue = 3000
labor.total = 3000 + 200 + 750 = 3950
```

### Materiais são opcionais

Um orçamento válido pode ter apenas mão de obra. A única regra dura é que **algum valor tem que existir** — não faz sentido um orçamento com `grandTotal === 0` (exceto pro spec que não permitiu explicitamente esse zero).

---

## Segurança

Checklist aplicado:

- ✅ **Senha armazenada com hash bcrypt** (cost 12), `select: false` no schema para não vazar em queries default.
- ✅ **JWT assinado com `NEXTAUTH_SECRET`**, cookie `httpOnly` + `secure` em produção.
- ✅ **Middleware protege rotas** `/dashboard/*` e `/orcamentos/*`.
- ✅ **Isolamento por conta** — todas as queries de `orcamentos` filtram por `userId`.
- ✅ **404 em vez de 403** para documentos alheios (evita leak de existência).
- ✅ **Validação de CNPJ no registro** (comprimento + sequência repetida — ver [limitação](#limites-e-trabalhos-futuros)).
- ✅ **Recálculo server-side** de totais antes de persistir.
- ✅ **Sanitização básica de inputs** via Mongoose (`trim: true`, `lowercase: true`).
- ⚠️ **Sem rate limiting** em endpoints de login — aceitável para o contexto atual.
- ⚠️ **Sem CSRF token adicional** — NextAuth mitiga parcialmente via cookie httpOnly + SameSite. Em ação de estado (POST/PUT/DELETE), aceita apenas Content-Type correto.

---

## Limites e trabalhos futuros

Decisões que foram conscientemente adiadas:

### Alto valor, baixo esforço

- **Validação completa de CNPJ** (dígito verificador). Hoje valida apenas formato. Uma função de ~30 linhas resolve.
- **Busca/filtro de orçamentos no dashboard.** Com mais de 20 orçamentos, o dashboard atual fica difícil de navegar.
- **Rate limiting em `/api/auth/signin`.** Adicionar middleware simples (upstash/ratelimit ou similar).

### Médio valor, médio esforço

- **Logo em object storage** (S3/R2/Cloudinary). Remove base64 do banco, reduz tamanho do documento `User`, permite logos maiores.
- **Testes automatizados.** Começar por `lib/labor.ts` (puro, fácil) e contratos de API.
- **Migrações versionadas.** Hoje, mudanças de schema exigem `dropCollection` manual. Adicionar `migrate-mongo` ou similar.

### Features de produto adiadas

- **Numeração sequencial de orçamento** (`ORC-2026-0001`). Hoje o número é derivado do ObjectId (últimos 7 chars). Sequencial exige contador atômico por conta.
- **Duplicar orçamento.** Feature útil quando o usuário faz orçamentos parecidos em sequência.
- **Compartilhar PDF via link** em vez de download. Cliente recebe URL pública temporária. Exige storage de PDFs e expiração.
- **Histórico de versões do orçamento.** Cliente pede revisão, sistema mantém as N versões anteriores.

### Escala

O sistema hoje é bom para **centenas de empresas e dezenas de milhares de orçamentos**. Para escalar além disso:

- **Indexes compostos** em `orcamentos` por `(userId, createdAt desc)` para queries do dashboard.
- **Paginação** na listagem (hoje retorna tudo).
- **CDN para assets** (já coberto pela Vercel).
- **Pooling de conexão Mongo** mais agressivo em serverless (hoje usa singleton global, funciona mas tem limitações).

---

## Convenções de código

- TypeScript `strict: true`
- Nomes de componentes em PascalCase (`OrcamentoCard.tsx`)
- Nomes de utilitários em camelCase (`formatCurrency`, `computeLaborTotal`)
- Funções puras em `lib/*`, side-effects em `app/api/*`
- Comentários em inglês (código), strings de UI em português
- Sem `any` explícito; onde a biblioteca força (`jspdf-autotable`), cast pontual com justificativa implícita
- Um componente por arquivo, com exports nomeados quando há helpers auxiliares

---

## Contato

Para dúvidas técnicas, abrir issue. Para autorização de uso do código, ver [`LICENSE`](./LICENSE).