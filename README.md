<div align="center">

# 🏗️ Empreita

### Gestão de orçamentos, recibos e folha para pequenas empresas de construção civil

*Do orçamento em planilha com erro de cálculo ao documento profissional em PDF — com controle de funcionários, presença e pagamentos no mesmo lugar.*

![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38BDF8?logo=tailwindcss&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-96%20testes-6E9F18?logo=vitest&logoColor=white)

</div>

---

## O problema

Pequenas construtoras e prestadores de serviço ainda montam orçamentos em planilha: cálculo manual sujeito a erro, apresentação amadora para o cliente e nenhum controle do que foi pago a quem. **Empreita** resolve isso ponta a ponta — orçar, formalizar em recibo e gerir a folha — num produto único, com identidade visual da empresa em cada documento.

---

## O que a plataforma faz

A aplicação é dividida em três módulos que compartilham a mesma conta e identidade visual.

### 📄 Orçamentos
- Compõe **materiais + mão de obra** no mesmo documento.
- **Três tipos de mão de obra** que coexistem: preço fixo (serviços combinados, com valor de grupo compartilhado + valores individuais), por unidade (qtd × valor) e por m² (área × valor/m²).
- **Preço opcional**: material sem cotação aparece no documento mas não entra no subtotal — e `R$ 0,00` (doado) é distinto de "não informado".
- **Numeração sequencial por empresa** (`ORC-0001`, `ORC-0002`…), atômica e à prova de colisão.
- **PDF profissional** com logo e dados fiscais, pronto para enviar ao cliente.
- Dashboard privado com busca por cliente, serviço ou número.

### 🧾 Recibos de Prestação de Serviços
- **Digitalização do bloco de papel**: gera o "Recibo de Prestação de Serviços" a partir de um orçamento, com todos os campos **editáveis**.
- **Numeração própria** (`REC-0001`…), independente da dos orçamentos.
- **PDF fiel ao formulário** físico: cabeçalho da empresa, dados do tomador, tabela *Quant. / Descrição dos Serviços / Valores* e o bloco *Mão de Obra / Material Empregado / TOTAL* — obedecendo a regra de preço fixo sem contar valor em dobro.

### 👷 Gestão de Funcionários
- Cadastro com dados pessoais, cargo e **ciclo salarial** (diário, semanal, quinzenal, mensal).
- **Registro de presença (roll-call) diário** para toda a equipe: diaristas **acumulam** por dia presente; mensais/semanais/quinzenais têm **uma diária descontada por falta** (cálculo por **dias úteis** — semana 5, quinzena 10, mês 22).
- **Adiantamentos e dívidas** que reduzem o próximo pagamento — e o que não for descontado num pagamento **permanece pendente e reaparece** no ciclo seguinte.
- **Pagamento com fechamento de ciclo**: líquido calculado no servidor, próximo vencimento agendado automaticamente (sempre na sexta).
- **Comprovante em PDF** com assinaturas e **QR Code de validação** (abre a página do comprovante e rebaixa o arquivo).
- **Histórico financeiro auditável**: lançamentos imutáveis, *soft delete*, responsável e data/hora.
- Dashboard com indicadores e gráficos (folha, adiantamentos, dívidas, próximos pagamentos).

---

## ✨ Destaques de engenharia

O que este projeto demonstra além de "CRUD que funciona":

- **Domínio como funções puras e testáveis.** As fórmulas de dinheiro (`lib/labor.ts`, `lib/payroll.ts`) vivem isoladas de banco e request, cobertas por testes — e são **recalculadas no servidor** a cada escrita, nunca confiando nos números enviados pelo cliente.
- **Numeração sequencial à prova de corrida.** Contador atômico via `$inc` do MongoDB (`findOneAndUpdate` + `upsert`): dois pedidos simultâneos recebem números distintos sem lock de aplicação. Trade-off documentado (gap é preferível a colisão).
- **Ledger financeiro auditável.** Pagamentos são lançamentos imutáveis; adiantamentos/dívidas viram `quitado` ao serem descontados, com rastro de quem e quando. Nada é apagado de verdade (*soft delete*).
- **PDFs client-side com layout defensivo.** Geração vetorial (jsPDF) com quebra de página automática, área de assinatura ancorada ao rodapé e legibilidade garantida em preto e branco — cor é informação, não decoração.
- **Isolamento multi-conta real.** Toda query filtra por `userId` da sessão; não há endpoint administrativo. Um usuário nunca alcança dados de outro, nem adivinhando ID.
- **Type-safety ponta a ponta.** TypeScript estrito, união discriminada para os tipos de mão de obra e augmentação dos tipos do NextAuth para a sessão.
- **Cuidado com casos de borda.** Distinção `null` vs `0` (preço não informado vs. doado), *float drift* arredondado, e a diferença entre "lista vazia enviada" e "campo ausente" no fechamento de pagamento.

Discussão completa das decisões e alternativas consideradas em **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**.

---

## 🛠️ Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router) |
| Linguagem | TypeScript (estrito) |
| Banco | MongoDB + Mongoose |
| Autenticação | NextAuth.js (JWT, Credentials) |
| UI | Tailwind CSS |
| PDF | jsPDF + jspdf-autotable (client-side) + QRCode |
| Testes | Vitest |
| Deploy | Vercel + MongoDB Atlas |

---

## 🧭 Arquitetura em uma imagem

```
Cliente (React + Tailwind, App Router)
   ├─ Landing / Auth
   ├─ Dashboards (orçamentos · recibos · funcionários)
   └─ Formulários + geradores de PDF (client-side)
          │  HTTPS · JWT em cookie
Servidor (Next.js API Routes)
   ├─ /api/auth · /api/register
   ├─ /api/orcamentos · /api/recibos
   └─ /api/funcionarios (presença · adiantamentos · pagamentos · dashboard)
          │
   Domínio puro e testável (lib/labor · lib/payroll · lib/recibo)
          │
   Camada de dados (Mongoose)
   └─ User · Orcamento · Recibo · Employee · EmployeeTransaction · Attendance · Counter
          │
   MongoDB Atlas
```

---

## ✅ Qualidade

- **96 testes unitários** (Vitest) focados no que quebra silenciosamente: a fórmula canônica do total de mão de obra, o cálculo da folha (valor da diária, desconto de falta, líquido), a derivação de recibo a partir do orçamento e a validação de CNPJ/CPF.
- **Recompute server-side** como rede de segurança contra dados adulterados.
- Tipos compartilhados entre cliente, API e PDF — uma mudança de contrato quebra no compilador, não em produção.

```bash
npm test        # 96 passed
```

---

## ▶️ Rodando localmente

```bash
npm install
cp .env.local.example .env.local     # MONGODB_URI · NEXTAUTH_SECRET · NEXTAUTH_URL
npm run dev                          # http://localhost:3000
```

Precisa apenas de Node.js ≥ 18 e um MongoDB (local ou Atlas).

---

## 👤 Autor

**Gustavo Rech Costa**

Produto pensado e construído de ponta a ponta — do problema real de uma pequena construtora ao design de domínio, à experiência de uso e à geração dos documentos que o cliente final recebe.

---

## 📄 Licença

Distribuído sob a licença **MIT** — sinta-se à vontade para explorar, rodar e aprender com o código. Ver [`LICENSE`](./LICENSE).
