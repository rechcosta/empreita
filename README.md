# Empreita

Plataforma web para construtoras e prestadores de serviços criarem, gerenciarem e enviarem orçamentos profissionais em PDF.

---

## Quick start

```bash
git clone <repo>
cd empreita
npm install
cp .env.local.example .env.local  # edite as variáveis
npm run dev
```

Abra `http://localhost:3000`.

**Variáveis de ambiente obrigatórias:**

```env
MONGODB_URI=mongodb://localhost:27017/empreita
NEXTAUTH_SECRET=<gerar com: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
```

---

## O que faz

Empreita resolve um problema específico: **empresas de construção civil de pequeno porte que ainda fazem orçamentos em planilha**, com erro de cálculo recorrente e apresentação pouco profissional para o cliente final.

A plataforma permite:

- **Cadastrar a empresa prestadora** com logo, CNPJ e dados fiscais
- **Compor orçamentos** combinando materiais e mão de obra no mesmo documento
- **Misturar três tipos de mão de obra** no mesmo orçamento — preço fixo (lista de serviços com valor único), por unidade (cálculo por quantidade) e por m² (cálculo por área)
- **Deixar materiais sem preço** quando o valor ainda não foi cotado, mantendo o item no orçamento sem afetar o subtotal
- **Gerar PDF profissional** com identidade visual da empresa, pronto para envio ao cliente
- **Listar e editar orçamentos anteriores** em dashboard privado por conta

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router) |
| Linguagem | TypeScript |
| Banco | MongoDB (via Mongoose) |
| Autenticação | NextAuth.js (JWT, Credentials Provider) |
| UI | Tailwind CSS |
| Geração de PDF | jsPDF + jspdf-autotable (client-side) |
| Deploy | Vercel + MongoDB Atlas |

Decisões de stack e justificativa: ver [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Arquitetura em uma imagem

```
┌──────────────────────────────────────────────────┐
│                    Cliente                       │
│  ┌────────────────────────────────────────────┐  │
│  │  React + Tailwind (App Router)             │  │
│  │  ├─ Landing / Auth                         │  │
│  │  ├─ Dashboard                              │  │
│  │  └─ Formulário de orçamento + Gerador PDF  │  │
│  └────────────────────────────────────────────┘  │
└────────────────────────┬─────────────────────────┘
                         │ HTTPS (JWT em cookie)
┌────────────────────────▼─────────────────────────┐
│              Servidor (Next.js)                  │
│  ┌────────────────────────────────────────────┐  │
│  │  API Routes                                │  │
│  │  ├─ /api/auth/*    (NextAuth)              │  │
│  │  ├─ /api/register  (cadastro de empresa)   │  │
│  │  └─ /api/orcamentos (CRUD)                 │  │
│  └──────────────────┬─────────────────────────┘  │
│                     │                            │
│  ┌──────────────────▼─────────────────────────┐  │
│  │  Camada de dados (Mongoose)                │  │
│  │  ├─ User                                   │  │
│  │  └─ Orcamento                              │  │
│  └──────────────────┬─────────────────────────┘  │
└─────────────────────┼────────────────────────────┘
                      │
              ┌───────▼────────┐
              │  MongoDB Atlas │
              └────────────────┘
```

---

## Estrutura do projeto

```
empreita/
├── app/
│   ├── (auth)/                    # Rotas públicas
│   │   ├── login/
│   │   └── register/
│   ├── (app)/                     # Rotas protegidas (middleware)
│   │   ├── dashboard/
│   │   └── orcamentos/
│   ├── api/
│   │   ├── auth/[...nextauth]/    # NextAuth handlers
│   │   ├── register/              # Cadastro de empresa
│   │   └── orcamentos/            # CRUD de orçamentos
│   └── page.tsx                   # Landing page (pública)
│
├── components/
│   ├── brand/                     # Logo reutilizável
│   ├── landing/                   # Landing page
│   ├── layout/                    # Header autenticado
│   └── orcamento/                 # Formulário + card + seção de labor
│
├── lib/
│   ├── auth.ts                    # Config NextAuth
│   ├── db.ts                      # Singleton Mongo
│   ├── labor.ts                   # Cálculos centralizados de mão de obra
│   ├── pdf.ts                     # Geração de PDF
│   └── utils.ts                   # Formatação (moeda, CNPJ, datas)
│
├── models/
│   ├── User.ts                    # Empresa prestadora
│   └── Orcamento.ts               # Orçamento com materiais + labor
│
├── types/
│   ├── index.ts                   # Tipos compartilhados
│   └── next-auth.d.ts             # Augmentação de tipos do NextAuth
│
├── middleware.ts                  # Proteção de rotas
└── tailwind.config.ts             # Paleta + tokens do design system
```

Detalhes em [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Setup detalhado

### Pré-requisitos

- Node.js ≥ 18
- MongoDB local (via `mongod`) **ou** URI do MongoDB Atlas

### Instalação

```bash
git clone <repo>
cd empreita
npm install
```

### Variáveis de ambiente

Copie o arquivo de exemplo:

```bash
cp .env.local.example .env.local
```

Edite `.env.local`:

| Variável | Descrição | Exemplo |
|---|---|---|
| `MONGODB_URI` | URI de conexão do MongoDB | `mongodb://localhost:27017/empreita` |
| `NEXTAUTH_SECRET` | Secret para assinatura do JWT | `$(openssl rand -base64 32)` |
| `NEXTAUTH_URL` | URL base da aplicação | `http://localhost:3000` |

### Executar em desenvolvimento

```bash
npm run dev
```

### Build de produção

```bash
npm run build
npm start
```

### Lint

```bash
npm run lint
```

---

## Deploy

### MongoDB Atlas

1. Criar conta em `https://cloud.mongodb.com`
2. Criar cluster gratuito (tier M0)
3. Em **Database Access** → adicionar usuário com senha
4. Em **Network Access** → adicionar IP `0.0.0.0/0` (ou IPs específicos)
5. Em **Connect** → **Drivers** → copiar a URI

### Vercel

1. Push do código para GitHub
2. Importar repositório em `https://vercel.com/new`
3. Em **Environment Variables**, configurar:
   - `MONGODB_URI` — URI do Atlas
   - `NEXTAUTH_SECRET` — string aleatória (mesmo comando `openssl rand -base64 32`)
   - `NEXTAUTH_URL` — URL final de produção (ex: `https://empreita.vercel.app`)
4. Deploy automático a cada push na branch principal

---

## Modelo de dados

### User (empresa prestadora)

```typescript
{
  companyName: string
  cnpj: string (unique)
  logoBase64?: string
  email: string (unique)
  password: string (bcrypt hash, select: false)
}
```

### Orcamento

```typescript
{
  userId: ObjectId → User
  clientName: string
  clientAddress: string
  serviceName: string

  materials: Material[]
  labor: Labor

  materialsTotal: number       // soma apenas de materiais com preço informado
  grandTotal: number            // materialsTotal + labor.total
  createdAt / updatedAt: Date
}

Material {
  name: string
  unit: 'unidade' | 'm3' | 'kg'
  quantity: number
  unitPrice: number | null      // null = preço não informado (renderiza "—")
  total: number | null
}

Labor {
  items: LaborItem[]
  fixedGroupValue: number | null // único valor que cobre TODOS os itens "fixo"
  total: number                  // (fixedGroupValue ?? 0) + sum(por_unidade) + sum(por_m2)
}

LaborItem =
  | { type: 'fixo', description }
  | { type: 'por_unidade', description, quantity, unitPrice, subtotal }
  | { type: 'por_m2', description, area, pricePerMeter, subtotal }
```

Discussão completa do modelo e das regras de negócio em [`ARCHITECTURE.md`](./ARCHITECTURE.md#modelo-de-dados).

---

## API

Todas as rotas exceto `/api/register` e `/api/auth/*` exigem sessão autenticada. A verificação é feita em `middleware.ts` + `getServerSession` em cada handler.

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/register` | Cadastro de empresa prestadora |
| `POST` | `/api/auth/signin` | Login (gerenciado pelo NextAuth) |
| `GET` | `/api/orcamentos` | Lista orçamentos do usuário autenticado |
| `POST` | `/api/orcamentos` | Cria orçamento |
| `GET` | `/api/orcamentos/:id` | Busca orçamento (apenas do dono) |
| `PUT` | `/api/orcamentos/:id` | Atualiza orçamento |
| `DELETE` | `/api/orcamentos/:id` | Exclui orçamento |

**Isolamento por conta:** todas as queries de `orcamentos` filtram por `userId: session.user.id`. Não existe endpoint administrativo — um usuário nunca acessa dados de outro, mesmo por adivinhação de ID.

---

## Regras de negócio não-triviais

Algumas regras valem destaque porque não são óbvias:

- **Materiais são opcionais.** Um orçamento pode ser só de mão de obra.
- **Preço de material é opcional.** Um material sem preço aparece no PDF com "—" e **não entra no subtotal**. `R$ 0,00` é preço válido (material doado), diferente de "preço não informado".
- **Os 3 tipos de mão de obra podem coexistir no mesmo orçamento.** Preço fixo (lista de serviços com valor único compartilhado), por unidade (qtd × valor) e por m² (área × valor/m²) se somam no total final.
- **Totais são recalculados no servidor.** O cliente envia os números, mas a API sempre recomputa `materialsTotal`, `labor.total` e `grandTotal` antes de persistir. Protege contra dados adulterados.
- **O `fixedGroupValue` é compartilhado.** Se o orçamento tem 5 itens "preço fixo", todos compartilham um único valor. Remover o último item fixo zera o campo automaticamente.

Justificativa e alternativas consideradas em [`ARCHITECTURE.md`](./ARCHITECTURE.md#decisões-de-domínio).

---

## Testando manualmente

Fluxo mínimo que cobre as regras principais:

1. Criar conta com CNPJ válido e logo opcional
2. Criar orçamento com:
   - Cliente com endereço longo (para validar quebra de linha no PDF)
   - 1 material com preço, 1 material sem preço
   - 2 itens de mão de obra "preço fixo" com valor compartilhado
   - 1 item "por unidade"
   - 1 item "por m²"
3. Verificar no dashboard: total bate com a soma
4. Gerar PDF: materiais sem preço aparecem com "—"; os 3 grupos de mão de obra aparecem separados; total geral correto
5. Editar orçamento, remover item fixo, salvar: `fixedGroupValue` é zerado se não sobrar nenhum item "fixo"

---

## Licença

**Proprietary — All rights reserved.** Ver [`LICENSE`](./LICENSE).

Este repositório está disponível para **leitura, avaliação acadêmica e portfolio**. Qualquer uso, cópia, modificação, distribuição ou comercialização do código requer autorização expressa por escrito do autor.

---

## Autor

Gustavo Rech Costa 

Projeto desenvolvido como solução para pequenas empresas do setor de construção civil.
