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
7. [Numeração de orçamentos](#numeração-de-orçamentos)
8. [Geração de PDF](#geração-de-pdf)
9. [Testes](#testes)
10. [Decisões de domínio](#decisões-de-domínio)
11. [Segurança](#segurança)
12. [Limites e trabalhos futuros](#limites-e-trabalhos-futuros)

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
| **Vitest** | Jest | Para um projeto que não tinha testes, Vitest evita configurar `ts-jest` + Babel. Roda TS nativamente, API compatível com Jest. Em 2026 é a escolha óbvia para projeto novo. |

**Decisão estratégica que vale sublinhar:** o projeto **evita complexidade prematura**. Não tem Redis, não tem fila, não tem microsserviços, não tem CI/CD elaborado. Os testes existentes cobrem o que mais quebra silenciosamente — não há ambição de chegar a 100% de cobertura. Adicionar sem necessidade real é débito técnico gratuito.

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
       + sumFixedItemValues(labor.items)
       + sumUnitItems(labor.items)
       + sumSqmItems(labor.items)
}
```

Regra de ouro aplicada: **fórmulas de negócio viram funções puras em um módulo testável**. Isso permitiu cobrir a fórmula com testes (ver [Testes](#testes)) sem nenhuma infraestrutura — sem mock de banco, sem mock de request.

### Por que testes ficam em `tests/` e não ao lado do código

Duas convenções funcionam: `tests/lib/labor.test.ts` (separado) ou `lib/labor.test.ts` (co-localizado). Escolhi separado porque:

1. `lib/` fica visualmente limpo — quando alguém abre o projeto pela primeira vez, vê apenas código de produção.
2. É trivial excluir do bundle de produção via glob — não precisa torcer pra que o bundler ignore arquivos `*.test.ts`.
3. Em projetos Node tradicionais (que é o que o backend de Empreita é), `tests/` separado é mais comum.

A escolha não é fortemente opinada — co-localizar funcionaria igualmente bem. O que importa é manter a convenção consistente.

---

## Modelo de dados

Três collections: `users`, `orcamentos` e `counters`. Relacionamento via `userId` (ObjectId ref).

### User

```typescript
{
  _id: ObjectId
  companyName: string
  cnpj: string (unique, índice, valida dígitos verificadores no registro)
  logoBase64?: string           // pequenas imagens inline, evita storage
  email: string (unique, lowercase)
  password: string (hash bcrypt, select: false por default)
  createdAt, updatedAt: Date
}
```

`logoBase64` é controverso — guardar imagem em base64 no banco não escala. A decisão foi consciente: no volume esperado (empresa faz upload uma única vez, logos ≤ 2MB, poucos milhares de contas), o custo de montar S3/Cloudinary para uma feature marginal não compensa. **Quando o volume crescer, isso migra.** Ver [trabalhos futuros](#limites-e-trabalhos-futuros).

A validação de CNPJ no cadastro confere comprimento, sequência repetida, **e os dois dígitos verificadores** segundo o algoritmo da Receita Federal. Isso não substitui consulta à base oficial (a Receita não disponibiliza API pública confiável), mas elimina os erros de digitação mais comuns. O algoritmo está coberto por testes em `tests/lib/utils.test.ts`.

### Orcamento

Documento completo, com arrays embutidos:

```typescript
{
  _id: ObjectId
  userId: ObjectId (índice)
  number?: number                // sequencial por conta — ver seção dedicada
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

**Índices:**
- `userId` (já existia, para isolamento por conta)
- `(userId, createdAt: -1)` — cobre o `find().sort()` do dashboard
- `(userId, number)` — para futuras buscas por número

**Por que arrays embutidos e não collections separadas?**

- Cada orçamento é lido e escrito como uma unidade atômica. Editar um item de mão de obra sem salvar o resto não existe no fluxo.
- Materiais e itens de mão de obra não são consultados independentemente. Não há query "todos os materiais com nome X" — seria feature de BI, fora do escopo.
- Um documento por orçamento significa **uma query por operação**. Em SQL precisaria de 3+ joins.

Trade-off: se um orçamento crescer absurdamente (centenas de itens), o documento pode passar do limite de 16MB do Mongo. Na prática, orçamentos reais têm dezenas de itens no máximo.

### Counter

Collection auxiliar usada para gerar a numeração sequencial de orçamentos. Detalhada em [Numeração de orçamentos](#numeração-de-orçamentos).

```typescript
{
  _id: ObjectId
  name: string (unique, índice)   // ex: "orcamento:{userId}"
  seq: number                     // próximo valor disponível
}
```

### Union discriminada em `LaborItem`

Três tipos de item de mão de obra, identificados pelo campo `type`:

```typescript
type LaborItem =
  | { type: 'fixo'; description: string; itemValue?: number | null }
  | { type: 'por_unidade'; description: string; quantity: number; unitPrice: number; subtotal: number }
  | { type: 'por_m2'; description: string; area: number; pricePerMeter: number; subtotal: number }
```

No Mongoose, isso é modelado como schema único com todos os campos opcionais. A união de TypeScript garante correção no código; o Mongo só armazena o que cada item precisa.

O `itemValue` em itens fixos é opcional (`null` = não informado). Ver [decisões de domínio](#decisões-de-domínio) para a semântica completa.

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
            → checkRateLimit(`login:{email}`)        ← rate limiting in-memory
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

### Rate limiting no login

`lib/rateLimit.ts` implementa um limitador de janela deslizante in-memory (Map por instância). Aplicado em `authorize()` no NextAuth: máximo de **5 tentativas a cada 15 minutos** por email.

**Limitações conhecidas, documentadas no código:**

- **Per-instance state.** Cada instância serverless tem seu próprio Map. Em ambiente com N instâncias quentes, o limite efetivo vira `N × 5`. Adequado contra scripts ingênuos; insuficiente contra ataques distribuídos.
- **Keying por email.** Um botnet com pool de senhas comuns e milhares de emails passa por baixo. Para esse cenário, a mitigação correta é um limitador baseado em IP via Upstash/Redis com análise de padrões — não cabe no escopo atual.
- **Não há IP confiável aqui.** O `authorize()` do NextAuth não recebe o request, então não conseguimos limitar por IP nesta camada sem refatorar. É uma escolha consciente: per-email cobre o pior caso prático sem complicar a arquitetura.

Trade-off explícito: o limitador atual é melhor do que nenhum, e pior do que o ideal. O custo de ir até "ideal" não se justifica para o estágio atual do produto.

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

## Numeração de orçamentos

Cada orçamento tem um campo `number: number` (inteiro, ≥ 1) atribuído na criação. No PDF e na UI, é formatado como `ORC-{number padded para 4 dígitos}` — `ORC-0001`, `ORC-0042`, `ORC-0173`, etc.

### Geração atômica via collection `Counter`

```typescript
// models/Counter.ts
export async function nextSequence(name: string): Promise<number> {
  const result = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  )
  return result.seq
}
```

Chamado no `POST /api/orcamentos` com `name = "orcamento:{userId}"`. A atomicidade vem do `$inc` do MongoDB — dois requests simultâneos para o mesmo usuário recebem valores distintos sem coordenação no app.

### Por que sequencial **por conta**, não global

Empresa A pode estar no orçamento 47, Empresa B no 3. Cada uma vê sua própria progressão, que é o que faz sentido para o usuário final.

### Por que sequencial **contínuo**, não reiniciado por ano

Considerei `ORC-2026-0001` (reinicia em janeiro). Rejeitei: a data já está visível no PDF; o reset complica o counter (precisa key composta `(userId, ano)`); e o ganho percebido pelo usuário é marginal. Continuidade é mais simples e suficiente.

### Trade-off explícito: gaps possíveis

Se `Orcamento.create` falhar **depois** de `nextSequence` ter incrementado, o número fica "queimado" — o próximo orçamento pula um. Aceitei isso porque a alternativa (incrementar só após sucesso) abre janela de race condition entre dois requests simultâneos, levando a colisões.

**Gap > colisão.** Dois orçamentos com o mesmo número é um bug visível para o usuário. Um número faltando não é.

### Compatibilidade com documentos antigos

`number` é opcional no schema. Documentos criados antes da feature (sem o campo) continuam funcionando: o PDF e o card no dashboard caem em fallback baseado no ObjectId (`ABCD-1234`). Não há backfill — desnecessário enquanto não há dados de produção.

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

## Testes

O projeto usa **Vitest** para testes unitários. A cobertura é seletiva e intencional: apenas funções puras que codificam regras de domínio críticas. Não há testes de componentes React, de rotas de API, ou end-to-end.

### Princípio: testar o que mais quebra silenciosamente

Bug em UI é visível — quebra a tela, o usuário reclama. Bug em fórmula de cálculo é invisível: o orçamento sai com valor errado e a empresa cobra o cliente errado. Esse é exatamente o tipo de regressão que testes evitam de forma desproporcionalmente eficaz.

A cobertura atual reflete esse princípio:

| Arquivo testado | Por que testar |
|---|---|
| `lib/labor.ts` | Fórmula central do produto. Referenciada em 3 lugares (preview, POST, PUT). Tem casos sutis (`itemValue: null` vs `0`, mistura de tipos, arredondamento contra float drift). Refatoração sem rede acaba em divergência. |
| `lib/utils.ts/validateCNPJ` | Algoritmo da Receita Federal. Errar deixa malformados entrarem ou bloqueia legítimos. Algoritmo é estável, então o teste é "para sempre". |
| `lib/utils.ts/formatCurrencyOrDash` | Codifica a regra de domínio "null vira `—`, mas 0 é R$ 0,00". A confusão entre os dois muda o que o cliente paga. |

### O que **não** é testado, e por quê

- **API routes (`app/api/*`)** — exigiriam mock de Mongo ou banco em memória. Os handlers são finos: validação, recálculo via `computeLaborTotal` (já testado), e write. O retorno marginal de testar não compensa a infra.
- **Componentes React** — UI muda muito durante prototipagem. Testes de componente em projeto pré-produção tendem a quebrar a cada iteração de design e viram peso morto.
- **Geração de PDF** — output binário de difícil verificação. Inspeção visual continua sendo a forma certa de validar PDF.

Quando o projeto tiver usuários reais e bugs em produção, esses testes serão escritos *reproduzindo o caso* — transformando cada bug em regressão protegida. Antes disso, são esforço sem retorno.

### Estrutura

```
tests/
└── lib/
    ├── labor.test.ts    # 24 testes — fórmula canônica + casos de borda
    └── utils.test.ts    # 22 testes — validateCNPJ + formatação
```

`vitest.config.ts` na raiz, com `include: ['tests/**/*.test.ts']` e alias `@` espelhando o `tsconfig`. Sem setup adicional necessário.

### Comandos

```bash
npm test              # roda uma vez, sai com código 0/1 — adequado para CI
npm run test:watch    # observa arquivos, re-roda ao salvar
```

### Como adicionar testes novos

Regra prática: **toda função pura nova em `lib/` ganha um arquivo espelhado em `tests/lib/`**. Funções com side effect (DB, network, filesystem) não — o custo de mockar passa do retorno do teste em projeto deste tamanho.

Quando aparecer um bug de cálculo na vida real, o fluxo é:

1. Escrever um teste que reproduz o caso (vermelho).
2. Corrigir a função (verde).
3. Commit.

Isso protege contra a regressão voltar e documenta o caso de borda para quem ler o teste no futuro.

---

## Decisões de domínio

### Preço de material opcional

O spec exige: "Se valor não informado, não calcular subtotal, exibir '—'". A modelagem é `unitPrice: number | null`.

Alternativa rejeitada: `unitPrice: number` com flag `hasPricing: boolean`. Dois campos que podem ficar dessincronizados, mais código, pior semântica.

**Por que null e não `undefined`?** Em JSON (da API) e em Mongo, `null` é explícito — o valor existe e é "vazio". `undefined` costuma significar "campo não enviado". Distinguir os dois deixa o contrato mais claro.

Zero é preço válido (material doado) e **entra no subtotal**. `null` é "não informado" e **não entra**. Semântica diferente. Esse é o caso testado em `formatCurrencyOrDash` — confundir os dois muda o que o cliente paga.

### Preço fixo: grupo compartilhado + valores individuais opcionais

Itens de preço fixo têm duas fontes de valor que **somam** para formar o subtotal do grupo:

1. **`labor.fixedGroupValue`** — um único valor que se aplica a todos os itens fixos do grupo como um custo combinado.
2. **`LaborFixedItem.itemValue`** — valor individual opcional, por item.

Fórmula canônica:

```
total_preço_fixo = (fixedGroupValue ?? 0) + Σ (itemValue dos itens fixos)
```

Ambas as fontes são opcionais (`null`/vazio). Um grupo pode usar só a compartilhada, só as individuais, ambas, ou nenhuma (neste último caso, a validação global `grandTotal > 0` impede o orçamento de ser salvo sem algum valor em algum lugar).

**Histórico desta decisão.** A modelagem original tinha apenas `fixedGroupValue` — itens fixos não podiam ter valor individual. A restrição foi relaxada em favor do modelo atual.

**Custo assumido explicitamente.** O modelo atual permite expressar a mesma realidade de duas formas diferentes: um item `fixo` com `itemValue` preenchido é funcionalmente igual a um item `por_unidade` com `quantity = 1`. Isso é débito conhecido. Relatórios futuros que agrupem por tipo vão tratar essas entradas como categorias distintas mesmo quando o conteúdo econômico é o mesmo. Se um dia aparecer necessidade de normalizar (BI, export para contabilidade, etc.), será preciso decidir uma forma canônica.

### Os 3 tipos de mão de obra podem ser misturados

A union discriminada no TypeScript + schema unificado no Mongoose permite arrays heterogêneos:

```typescript
labor.items = [
  { type: 'fixo', description: 'Retirar piso' },                              // coberto só pelo grupo
  { type: 'fixo', description: 'Derrubar parede', itemValue: 800 },           // grupo + individual
  { type: 'por_m2', description: 'Pintura', area: 30, pricePerMeter: 25, subtotal: 750 },
  { type: 'por_unidade', description: 'Trocar tomadas', quantity: 5, unitPrice: 40, subtotal: 200 }
]
labor.fixedGroupValue = 3000
labor.total = 3000 + 800 + 750 + 200 = 4750
```

Esse cenário exato é um dos testes em `tests/lib/labor.test.ts` — funciona como âncora de regressão para qualquer refatoração futura na fórmula.

### Materiais são opcionais

Um orçamento válido pode ter apenas mão de obra. A única regra dura é que **algum valor tem que existir** — não faz sentido um orçamento com `grandTotal === 0`.

---

## Segurança

Checklist aplicado:

- ✅ **Senha armazenada com hash bcrypt** (cost 12), `select: false` no schema para não vazar em queries default.
- ✅ **JWT assinado com `NEXTAUTH_SECRET`**, cookie `httpOnly` + `secure` em produção.
- ✅ **Middleware protege rotas** `/dashboard/*` e `/orcamentos/*`.
- ✅ **Isolamento por conta** — todas as queries de `orcamentos` filtram por `userId`.
- ✅ **404 em vez de 403** para documentos alheios (evita leak de existência).
- ✅ **Validação de CNPJ no registro** — formato + sequência repetida + dígitos verificadores (algoritmo da Receita), coberta por testes.
- ✅ **Rate limiting em login** — 5 tentativas / 15 min por email, in-memory (ver caveats em [Fluxo de autenticação](#rate-limiting-no-login)).
- ✅ **Recálculo server-side** de totais antes de persistir.
- ✅ **Sanitização básica de inputs** via Mongoose (`trim: true`, `lowercase: true`).
- ⚠️ **Sem CSRF token adicional** — NextAuth mitiga parcialmente via cookie httpOnly + SameSite. Em ação de estado (POST/PUT/DELETE), aceita apenas Content-Type correto.

---

## Limites e trabalhos futuros

Decisões que foram conscientemente adiadas:

### Médio valor, médio esforço

- **Logo em object storage** (S3/R2/Cloudinary). Remove base64 do banco, reduz tamanho do documento `User`, permite logos maiores.
- **Cobertura de testes mais ampla.** Hoje só funções puras. Quando bugs aparecerem em rotas ou componentes, escrever testes reproduzindo o caso.
- **Migrações versionadas.** Hoje, mudanças de schema exigem `dropCollection` manual. Adicionar `migrate-mongo` ou similar.
- **Rate limiting distribuído via Upstash/Redis** — quando o tráfego justificar (e quando o atacante distribuído for ameaça real).
- **Paginação no dashboard** — quando um usuário típico passar de algumas centenas de orçamentos. A busca client-side atual é suficiente até lá.

### Features de produto adiadas

- **Histórico de versões do orçamento.** Cliente pede revisão, sistema mantém as N versões anteriores.
- **Numeração reiniciada por ano** (`ORC-2026-0001`). Considerada e rejeitada na implementação atual (ver [Numeração de orçamentos](#por-que-sequencial-contínuo-não-reiniciado-por-ano)). Se uma demanda real aparecer, a migração é localizada (key do counter).

### Escala

O sistema hoje é bom para **centenas de empresas e dezenas de milhares de orçamentos**. Para escalar além disso:

- **CDN para assets** (já coberto pela Vercel).
- **Pooling de conexão Mongo** mais agressivo em serverless (hoje usa singleton global, funciona mas tem limitações).
- **Busca server-side com índice de texto** quando a busca client-side ficar lenta (passa a fazer sentido por volta de 500+ orçamentos por usuário).

---

## Convenções de código

- TypeScript `strict: true`
- Nomes de componentes em PascalCase (`OrcamentoCard.tsx`)
- Nomes de utilitários em camelCase (`formatCurrency`, `computeLaborTotal`)
- Funções puras em `lib/*`, side-effects em `app/api/*`
- Comentários em inglês (código), strings de UI em português
- Sem `any` explícito; onde a biblioteca força (`jspdf-autotable`), cast pontual com justificativa implícita
- Um componente por arquivo, com exports nomeados quando há helpers auxiliares
- Funções puras novas em `lib/` ganham arquivo espelhado em `tests/lib/`

---

## Contato

Para dúvidas técnicas, abrir issue. Para autorização de uso do código, ver [`LICENSE`](./LICENSE).