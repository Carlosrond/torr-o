# Sistema de Vendas Torrão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App web mobile-first para lançar pedidos do café Torrão com preço automático por faixa de volume, e ler métricas de venda, prazo/caixa e alerta de recompra.

**Architecture:** SPA React standalone consumindo Supabase direto (sem backend próprio). Toda regra de negócio vive em módulos puros e testados em `src/lib/` (preço, prazo, recompra, consignado, métricas); as telas só chamam esses módulos e os hooks de dados. Banco Postgres com RLS por papel.

**Tech Stack:** Vite · React 18 · TypeScript · Tailwind CSS v4 · shadcn/ui · TanStack Query v5 · React Router v6 · Supabase (Postgres + Auth) · Vitest

**Spec:** [`docs/superpowers/specs/2026-08-03-torrao-vendas-design.md`](../specs/2026-08-03-torrao-vendas-design.md)

## Global Constraints

- **Supabase:** projeto `wqihhxcfjwgjrqrlvkrc`, URL `https://wqihhxcfjwgjrqrlvkrc.supabase.co`. Chave anon/publishable vem do dashboard e vai em `.env` (nunca commitada).
- **Idioma:** toda a UI em PT-BR. Nomes de tabela e coluna também em PT-BR (`clientes`, `pedidos`, `precos_faixa`) — decisão do spec aprovado, não "corrigir" para inglês.
- **SKU → kg:** `250g` = 0.25 kg, `500g` = 0.5 kg. Constante única em `KG_POR_SKU`, nunca número solto no código.
- **Dinheiro:** todo valor em reais arredondado para 2 casas com a função `arredondar2`. Nunca comparar dinheiro com `===` em teste sem arredondar antes.
- **Datas:** sempre string ISO `YYYY-MM-DD`. Nunca `new Date()` dentro de função de cálculo — a data "hoje" é sempre parâmetro, senão o teste não é determinístico.
- **Preço congelado:** `pedido_itens.preco_unit_aplicado` é gravado no insert. Nenhuma tela recalcula preço de pedido já salvo.
- **RLS:** todas as tabelas com RLS habilitada. **Nenhuma policy `USING (true)`.**
- **Fora de escopo (não implementar):** contas a receber, baixa de pagamento, inadimplência, aging de vencido, NF-e, estoque de produção. Quem cobra é o ERP.
- **Testes:** Vitest cobre a lógica pura de `src/lib/`. Telas têm checklist manual objetivo no fim da task — sem Testing Library, sem E2E na v1.
- **Shell:** os comandos deste plano são para Git Bash. No PowerShell, trocar `&&` por `;`.
- **Commits:** conventional commits, um por task no mínimo. Mensagem em PT-BR.

---

## File Structure

### Lógica pura (testada) — `src/lib/`
| Arquivo | Responsabilidade |
|---|---|
| `tipos.ts` | tipos de domínio e constantes (`Sku`, `Canal`, `CondicaoPagamento`, `KG_POR_SKU`) |
| `numero.ts` | `arredondar2` |
| `data.ts` | aritmética de data ISO: `addDias`, `diffDias`, `segundaDaSemana` |
| `preco.ts` | kg total do pedido, faixa vigente, precificação dos itens |
| `prazo.ts` | vencimentos implícitos da condição, prazo médio ponderado, caixa previsto por semana |
| `recompra.ts` | cadência, próxima compra, quantidade sugerida, confiança, sinais |
| `consignado.ts` | saldo por SKU, saldo em kg, venda apurada diária, dias restantes, dias parado |
| `metricas-venda.ts` | kg/receita, ticket médio, preço realizado vs tabela, mix, série semanal, ranking, por canal, base de clientes |

### Infra e dados
| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20260803120000_init_torrao.sql` | enums, 5 tabelas, `profiles`, `is_admin()`, RLS |
| `supabase/seed.sql` | faixas de preço de exemplo (substituídas na tela) |
| `src/lib/supabase.ts` | cliente Supabase único |
| `src/hooks/useAuth.tsx` | contexto de sessão + papel |
| `src/hooks/useClientes.ts` · `usePrecos.ts` · `usePedidos.ts` · `useConsignado.ts` | queries e mutations TanStack |

### Telas — `src/paginas/`
| Arquivo | Responsabilidade |
|---|---|
| `Login.tsx` | email + senha |
| `NovoPedido.tsx` | a tela mais usada, mobile-first |
| `Clientes.tsx` · `FichaCliente.tsx` | lista/cadastro e ficha do cliente |
| `Painel.tsx` | blocos A + B + C |
| `TabelaPrecos.tsx` | faixas, criando versão nova |

### Casca
`src/App.tsx` (rotas) · `src/componentes/AppShell.tsx` (nav inferior mobile) · `src/componentes/RotaProtegida.tsx` · `src/componentes/Estado.tsx` (loading/erro/vazio)

---

## Task 1: Scaffold do projeto e primeiro teste verde

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `.gitignore`, `.env.example`, `src/main.tsx`, `src/index.css`, `src/App.tsx`, `src/lib/numero.ts`
- Test: `src/lib/numero.test.ts`

**Interfaces:**
- Consumes: nada (primeira task)
- Produces: `arredondar2(valor: number): number` — usada por todo módulo que lida com dinheiro. Scripts npm `dev`, `build`, `test`, `typecheck`.

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "torrao",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "@tanstack/react-query": "^5.59.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@types/node": "^22.7.0",
    "@types/react": "^18.3.10",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.2",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.6.2",
    "vite": "^5.4.8",
    "vitest": "^2.1.2"
  }
}
```

- [ ] **Step 2: Criar `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 3: Criar `tsconfig.json` e `tsconfig.node.json`**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "types": ["vitest/globals"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "composite": true,
    "noEmit": false,
    "emitDeclarationOnly": true,
    "declarationDir": "./dist-tsconfig",
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Criar `index.html`, `src/main.tsx`, `src/index.css`, `src/App.tsx`**

`index.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Torrão — Vendas</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/index.css`:

```css
@import "tailwindcss";
```

`src/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

`src/App.tsx`:

```tsx
export default function App() {
  return <h1 className="p-6 text-2xl font-bold">Torrão</h1>
}
```

- [ ] **Step 5: Criar `.gitignore` e `.env.example`**

`.gitignore`:

```
node_modules
dist
dist-tsconfig
.env
.env.local
*.tsbuildinfo
.DS_Store
```

`.env.example`:

```
VITE_SUPABASE_URL=https://wqihhxcfjwgjrqrlvkrc.supabase.co
VITE_SUPABASE_ANON_KEY=cole-aqui-a-publishable-key-do-dashboard
```

- [ ] **Step 6: Instalar dependências**

Run: `npm install`
Expected: instala sem erro, cria `package-lock.json`.

- [ ] **Step 7: Escrever o teste que falha**

Criar `src/lib/numero.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { arredondar2 } from './numero'

describe('arredondar2', () => {
  it('arredonda para 2 casas', () => {
    expect(arredondar2(10.456)).toBe(10.46)
    expect(arredondar2(10.454)).toBe(10.45)
  })

  it('resolve o erro classico de ponto flutuante', () => {
    expect(arredondar2(0.1 + 0.2)).toBe(0.3)
    expect(arredondar2(1.005)).toBe(1.01)
  })

  it('preserva inteiros e zero', () => {
    expect(arredondar2(0)).toBe(0)
    expect(arredondar2(7)).toBe(7)
  })
})
```

- [ ] **Step 8: Rodar o teste e confirmar que falha**

Run: `npm run test`
Expected: FAIL — `Failed to resolve import "./numero"`.

- [ ] **Step 9: Implementar `src/lib/numero.ts`**

```ts
/** Arredonda para 2 casas decimais evitando o erro de ponto flutuante do JS. */
export function arredondar2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}
```

- [ ] **Step 10: Rodar o teste e confirmar que passa**

Run: `npm run test`
Expected: PASS — 3 testes.

- [ ] **Step 11: Confirmar que typecheck e build passam**

Run: `npm run typecheck`
Expected: sem saída (nenhum erro).

Run: `npm run build`
Expected: `✓ built in ...`, cria `dist/`.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold do projeto (vite + react + ts + tailwind + vitest)"
```

---

## Task 2: Tipos de domínio e cálculo de preço por faixa

**Files:**
- Create: `src/lib/tipos.ts`, `src/lib/preco.ts`
- Test: `src/lib/preco.test.ts`

**Interfaces:**
- Consumes: `arredondar2` de `@/lib/numero` (Task 1)
- Produces:
  - `src/lib/tipos.ts`: `Sku = '250g' | '500g'`; `KG_POR_SKU: Record<Sku, number>`; `Canal`; `CondicaoPagamento`; `StatusPedido`; `TipoMovConsignado`; `FaixaPreco { id, sku, kgMin, kgMax: number | null, precoUnit, vigenteDesde }`; `ItemPedidoInput { sku, qtdPacotes }`; `ItemPrecificado { sku, qtdPacotes, precoUnit, subtotal }`
  - `src/lib/preco.ts`: `kgTotal(itens: ItemPedidoInput[]): number`; `faixaVigente(faixas, sku, kgTotalPedido, data): FaixaPreco | null`; `precificar(itens, faixas, data): ItemPrecificado[]`; `totalPedido(itens: ItemPrecificado[]): { totalKg, totalValor }`; `proximaFaixa(faixas, sku, kgTotalPedido, data): FaixaPreco | null`

- [ ] **Step 1: Criar `src/lib/tipos.ts`**

```ts
export type Sku = '250g' | '500g'

/** Peso em kg de cada pacote. Fonte única — nunca escrever 0.25 solto no código. */
export const KG_POR_SKU: Record<Sku, number> = { '250g': 0.25, '500g': 0.5 }

export const SKUS: Sku[] = ['250g', '500g']

export type Canal = 'loja_rondelli' | 'revenda' | 'bar_padaria' | 'hotel' | 'consumidor'

export const ROTULO_CANAL: Record<Canal, string> = {
  loja_rondelli: 'Loja Rondelli',
  revenda: 'Revenda',
  bar_padaria: 'Bar / Padaria',
  hotel: 'Hotel',
  consumidor: 'Consumidor final',
}

export type CondicaoPagamento =
  | 'avista'
  | 'prazo_7'
  | 'prazo_14'
  | 'prazo_28'
  | 'prazo_30'
  | 'prazo_30_60'
  | 'consignado'

export const ROTULO_CONDICAO: Record<CondicaoPagamento, string> = {
  avista: 'À vista',
  prazo_7: '7 dias',
  prazo_14: '14 dias',
  prazo_28: '28 dias',
  prazo_30: '30 dias',
  prazo_30_60: '30/60 dias',
  consignado: 'Consignado',
}

export type StatusPedido = 'aberto' | 'entregue' | 'cancelado'

export type TipoMovConsignado = 'entrega' | 'venda_apurada' | 'retorno'

export interface FaixaPreco {
  id: string
  sku: Sku
  /** Piso da faixa, em kg do pedido inteiro. */
  kgMin: number
  /** Teto da faixa em kg; null = sem teto. */
  kgMax: number | null
  /** Preço do pacote nessa faixa. */
  precoUnit: number
  /** ISO YYYY-MM-DD. */
  vigenteDesde: string
}

export interface ItemPedidoInput {
  sku: Sku
  qtdPacotes: number
}

export interface ItemPrecificado {
  sku: Sku
  qtdPacotes: number
  precoUnit: number
  subtotal: number
}
```

- [ ] **Step 2: Escrever o teste que falha**

Criar `src/lib/preco.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { FaixaPreco } from './tipos'
import { faixaVigente, kgTotal, precificar, proximaFaixa, totalPedido } from './preco'

/** Tabela de exemplo: faixas em kg do pedido inteiro, por SKU. */
const FAIXAS: FaixaPreco[] = [
  { id: 'a1', sku: '250g', kgMin: 0, kgMax: 10, precoUnit: 12, vigenteDesde: '2026-01-01' },
  { id: 'a2', sku: '250g', kgMin: 10.001, kgMax: 50, precoUnit: 11, vigenteDesde: '2026-01-01' },
  { id: 'a3', sku: '250g', kgMin: 50.001, kgMax: null, precoUnit: 10, vigenteDesde: '2026-01-01' },
  { id: 'b1', sku: '500g', kgMin: 0, kgMax: 10, precoUnit: 22, vigenteDesde: '2026-01-01' },
  { id: 'b2', sku: '500g', kgMin: 10.001, kgMax: 50, precoUnit: 20, vigenteDesde: '2026-01-01' },
  { id: 'b3', sku: '500g', kgMin: 50.001, kgMax: null, precoUnit: 18, vigenteDesde: '2026-01-01' },
  // reajuste posterior do 500g na faixa do meio
  { id: 'b2v2', sku: '500g', kgMin: 10.001, kgMax: 50, precoUnit: 21, vigenteDesde: '2026-06-01' },
]

describe('kgTotal', () => {
  it('soma 250g e 500g em kg', () => {
    expect(kgTotal([{ sku: '250g', qtdPacotes: 4 }])).toBe(1)
    expect(kgTotal([{ sku: '500g', qtdPacotes: 3 }])).toBe(1.5)
    expect(
      kgTotal([
        { sku: '250g', qtdPacotes: 40 },
        { sku: '500g', qtdPacotes: 20 },
      ]),
    ).toBe(20)
  })

  it('pedido vazio tem 0 kg', () => {
    expect(kgTotal([])).toBe(0)
  })
})

describe('faixaVigente', () => {
  it('escolhe a faixa pelo kg TOTAL do pedido, nao pelo kg do SKU', () => {
    // 8 pacotes de 250g = 2 kg, mas com 500g o pedido vai a 12 kg -> faixa do meio
    const itens = [
      { sku: '250g' as const, qtdPacotes: 8 },
      { sku: '500g' as const, qtdPacotes: 20 },
    ]
    const total = kgTotal(itens) // 2 + 10 = 12
    expect(total).toBe(12)
    expect(faixaVigente(FAIXAS, '250g', total, '2026-03-01')?.precoUnit).toBe(11)
  })

  it('respeita o teto e o piso da faixa', () => {
    expect(faixaVigente(FAIXAS, '250g', 10, '2026-03-01')?.precoUnit).toBe(12)
    expect(faixaVigente(FAIXAS, '250g', 50, '2026-03-01')?.precoUnit).toBe(11)
    expect(faixaVigente(FAIXAS, '250g', 300, '2026-03-01')?.precoUnit).toBe(10)
  })

  it('usa a versao vigente na data do pedido, nao a mais recente', () => {
    expect(faixaVigente(FAIXAS, '500g', 20, '2026-03-01')?.precoUnit).toBe(20)
    expect(faixaVigente(FAIXAS, '500g', 20, '2026-07-01')?.precoUnit).toBe(21)
  })

  it('devolve null quando nao ha faixa aplicavel', () => {
    expect(faixaVigente(FAIXAS, '500g', 20, '2025-12-31')).toBeNull()
  })
})

describe('precificar', () => {
  it('aplica a faixa do kg total a todos os itens e calcula subtotal', () => {
    const itens = [
      { sku: '250g' as const, qtdPacotes: 8 },
      { sku: '500g' as const, qtdPacotes: 20 },
    ]
    const precificados = precificar(itens, FAIXAS, '2026-03-01')
    expect(precificados).toEqual([
      { sku: '250g', qtdPacotes: 8, precoUnit: 11, subtotal: 88 },
      { sku: '500g', qtdPacotes: 20, precoUnit: 20, subtotal: 400 },
    ])
  })

  it('ignora item com quantidade zero', () => {
    const precificados = precificar(
      [
        { sku: '250g', qtdPacotes: 0 },
        { sku: '500g', qtdPacotes: 4 },
      ],
      FAIXAS,
      '2026-03-01',
    )
    expect(precificados).toHaveLength(1)
    expect(precificados[0].sku).toBe('500g')
  })

  it('lanca erro quando falta faixa para o SKU na data', () => {
    expect(() => precificar([{ sku: '500g', qtdPacotes: 4 }], FAIXAS, '2025-01-01')).toThrow(
      /sem faixa de preço/i,
    )
  })
})

describe('totalPedido', () => {
  it('soma kg e valor dos itens precificados', () => {
    const total = totalPedido([
      { sku: '250g', qtdPacotes: 8, precoUnit: 11, subtotal: 88 },
      { sku: '500g', qtdPacotes: 20, precoUnit: 20, subtotal: 400 },
    ])
    expect(total).toEqual({ totalKg: 12, totalValor: 488 })
  })
})

describe('proximaFaixa', () => {
  it('devolve a faixa seguinte para virar argumento de venda', () => {
    const proxima = proximaFaixa(FAIXAS, '250g', 45, '2026-03-01')
    expect(proxima?.kgMin).toBe(50.001)
    expect(proxima?.precoUnit).toBe(10)
  })

  it('devolve null quando o cliente ja esta na melhor faixa', () => {
    expect(proximaFaixa(FAIXAS, '250g', 80, '2026-03-01')).toBeNull()
  })
})
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npm run test -- preco`
Expected: FAIL — `Failed to resolve import "./preco"`.

- [ ] **Step 4: Implementar `src/lib/preco.ts`**

```ts
import { arredondar2 } from './numero'
import { KG_POR_SKU, type FaixaPreco, type ItemPedidoInput, type ItemPrecificado, type Sku } from './tipos'

/** Kg total do pedido — é isso que define a faixa de volume. */
export function kgTotal(itens: ItemPedidoInput[]): number {
  const kg = itens.reduce((soma, item) => soma + KG_POR_SKU[item.sku] * item.qtdPacotes, 0)
  return arredondar2(kg)
}

/** Faixas do SKU que já estavam vigentes na data, da versão mais nova para a mais velha. */
function faixasDoSku(faixas: FaixaPreco[], sku: Sku, data: string): FaixaPreco[] {
  return faixas
    .filter((f) => f.sku === sku && f.vigenteDesde <= data)
    .sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde))
}

function contemKg(faixa: FaixaPreco, kg: number): boolean {
  return kg >= faixa.kgMin && (faixa.kgMax === null || kg <= faixa.kgMax)
}

/**
 * Faixa aplicável ao SKU, dado o kg TOTAL do pedido e a data.
 * Entre versões concorrentes, ganha a de `vigenteDesde` mais recente que seja <= data.
 */
export function faixaVigente(
  faixas: FaixaPreco[],
  sku: Sku,
  kgTotalPedido: number,
  data: string,
): FaixaPreco | null {
  return faixasDoSku(faixas, sku, data).find((f) => contemKg(f, kgTotalPedido)) ?? null
}

/** Faixa imediatamente melhor que a atual — vira argumento de venda ("faltam X kg"). */
export function proximaFaixa(
  faixas: FaixaPreco[],
  sku: Sku,
  kgTotalPedido: number,
  data: string,
): FaixaPreco | null {
  const atual = faixaVigente(faixas, sku, kgTotalPedido, data)
  if (!atual) return null
  const acima = faixasDoSku(faixas, sku, data).filter((f) => f.kgMin > atual.kgMin)
  if (acima.length === 0) return null
  const menorPiso = Math.min(...acima.map((f) => f.kgMin))
  // entre versões do mesmo piso, a mais recente que já vigia na data
  return (
    acima
      .filter((f) => f.kgMin === menorPiso)
      .sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde))[0] ?? null
  )
}

/** Precifica os itens aplicando a faixa do kg total. Congela o preço no item. */
export function precificar(
  itens: ItemPedidoInput[],
  faixas: FaixaPreco[],
  data: string,
): ItemPrecificado[] {
  const total = kgTotal(itens)
  return itens
    .filter((item) => item.qtdPacotes > 0)
    .map((item) => {
      const faixa = faixaVigente(faixas, item.sku, total, data)
      if (!faixa) {
        throw new Error(`Sem faixa de preço para ${item.sku} com ${total} kg em ${data}`)
      }
      return {
        sku: item.sku,
        qtdPacotes: item.qtdPacotes,
        precoUnit: faixa.precoUnit,
        subtotal: arredondar2(faixa.precoUnit * item.qtdPacotes),
      }
    })
}

export function totalPedido(itens: ItemPrecificado[]): { totalKg: number; totalValor: number } {
  return {
    totalKg: kgTotal(itens),
    totalValor: arredondar2(itens.reduce((soma, item) => soma + item.subtotal, 0)),
  }
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npm run test -- preco`
Expected: PASS — todos os testes de `kgTotal`, `faixaVigente`, `precificar`, `totalPedido`, `proximaFaixa`.

- [ ] **Step 6: Rodar typecheck**

Run: `npm run typecheck`
Expected: sem saída.

- [ ] **Step 7: Commit**

```bash
git add src/lib/tipos.ts src/lib/preco.ts src/lib/preco.test.ts
git commit -m "feat: calculo de preco por faixa de volume em kg com versionamento por data"
```

---

## Task 3: Aritmética de datas e cálculo de prazo/caixa

**Files:**
- Create: `src/lib/data.ts`, `src/lib/prazo.ts`
- Test: `src/lib/data.test.ts`, `src/lib/prazo.test.ts`

**Interfaces:**
- Consumes: `arredondar2` de `@/lib/numero` (Task 1); `CondicaoPagamento` de `@/lib/tipos` (Task 2)
- Produces:
  - `src/lib/data.ts`: `addDias(iso: string, dias: number): string`; `diffDias(de: string, ate: string): number`; `segundaDaSemana(iso: string): string`; `hojeIso(): string`
  - `src/lib/prazo.ts`: `DIAS_POR_CONDICAO: Record<CondicaoPagamento, number[] | null>`; `Vencimento { data: string; valor: number }`; `PedidoPrazo { data: string; condicao: CondicaoPagamento; totalValor: number }`; `vencimentos(dataPedido, condicao, valorTotal): Vencimento[]`; `prazoMedioDias(condicao): number | null`; `prazoMedioPonderado(pedidos): number | null`; `caixaPrevistoPorSemana(pedidos): { semana: string; valor: number }[]`

- [ ] **Step 1: Escrever o teste de `data.ts`**

Criar `src/lib/data.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { addDias, diffDias, segundaDaSemana } from './data'

describe('addDias', () => {
  it('soma dias dentro do mes', () => {
    expect(addDias('2026-08-03', 7)).toBe('2026-08-10')
  })

  it('atravessa mes e ano', () => {
    expect(addDias('2026-08-25', 30)).toBe('2026-09-24')
    expect(addDias('2026-12-20', 60)).toBe('2027-02-18')
  })

  it('respeita ano bissexto', () => {
    expect(addDias('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('aceita dias negativos', () => {
    expect(addDias('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('diffDias', () => {
  it('conta dias entre duas datas', () => {
    expect(diffDias('2026-08-03', '2026-08-10')).toBe(7)
    expect(diffDias('2026-08-10', '2026-08-03')).toBe(-7)
    expect(diffDias('2026-08-03', '2026-08-03')).toBe(0)
  })
})

describe('segundaDaSemana', () => {
  it('devolve a segunda-feira da semana da data', () => {
    // 2026-08-03 e uma segunda-feira
    expect(segundaDaSemana('2026-08-03')).toBe('2026-08-03')
    expect(segundaDaSemana('2026-08-06')).toBe('2026-08-03')
    expect(segundaDaSemana('2026-08-09')).toBe('2026-08-03') // domingo -> segunda anterior
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test -- data`
Expected: FAIL — `Failed to resolve import "./data"`.

- [ ] **Step 3: Implementar `src/lib/data.ts`**

```ts
/**
 * Aritmética de data em string ISO YYYY-MM-DD, sempre em UTC.
 * UTC evita o bug clássico de fuso: em UTC-3, new Date('2026-08-03') cai no dia 2.
 */

function paraUtc(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia))
}

function paraIso(data: Date): string {
  return data.toISOString().slice(0, 10)
}

export function addDias(iso: string, dias: number): string {
  const data = paraUtc(iso)
  data.setUTCDate(data.getUTCDate() + dias)
  return paraIso(data)
}

/** Dias de `de` até `ate`. Negativo se `ate` for anterior. */
export function diffDias(de: string, ate: string): number {
  const MS_DIA = 86_400_000
  return Math.round((paraUtc(ate).getTime() - paraUtc(de).getTime()) / MS_DIA)
}

/** Segunda-feira da semana da data — chave de agrupamento das séries semanais. */
export function segundaDaSemana(iso: string): string {
  const diaSemana = paraUtc(iso).getUTCDay() // 0 = domingo
  const recuo = diaSemana === 0 ? 6 : diaSemana - 1
  return addDias(iso, -recuo)
}

/** Data de hoje. Só para a UI — função de cálculo recebe `hoje` por parâmetro. */
export function hojeIso(): string {
  return paraIso(new Date())
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test -- data`
Expected: PASS — 8 testes.

- [ ] **Step 5: Escrever o teste de `prazo.ts`**

Criar `src/lib/prazo.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { arredondar2 } from './numero'
import {
  caixaPrevistoPorSemana,
  prazoMedioDias,
  prazoMedioPonderado,
  vencimentos,
  type PedidoPrazo,
} from './prazo'

describe('vencimentos', () => {
  it('a vista vence no dia do pedido', () => {
    expect(vencimentos('2026-08-03', 'avista', 500)).toEqual([{ data: '2026-08-03', valor: 500 }])
  })

  it('prazo simples soma os dias', () => {
    expect(vencimentos('2026-08-03', 'prazo_28', 500)).toEqual([{ data: '2026-08-31', valor: 500 }])
    expect(vencimentos('2026-08-03', 'prazo_30', 500)).toEqual([{ data: '2026-09-02', valor: 500 }])
  })

  it('30/60 divide em duas parcelas iguais', () => {
    expect(vencimentos('2026-08-03', 'prazo_30_60', 500)).toEqual([
      { data: '2026-09-02', valor: 250 },
      { data: '2026-10-02', valor: 250 },
    ])
  })

  it('30/60 com valor impar nao perde centavo', () => {
    const parcelas = vencimentos('2026-08-03', 'prazo_30_60', 100.01)
    // soma arredondada: 50.01 + 50 em ponto flutuante da 100.00999999999999
    expect(arredondar2(parcelas.reduce((soma, p) => soma + p.valor, 0))).toBe(100.01)
  })

  it('consignado nao gera vencimento', () => {
    expect(vencimentos('2026-08-03', 'consignado', 500)).toEqual([])
  })
})

describe('prazoMedioDias', () => {
  it('devolve os dias da condicao', () => {
    expect(prazoMedioDias('avista')).toBe(0)
    expect(prazoMedioDias('prazo_14')).toBe(14)
  })

  it('30/60 tem prazo medio 45', () => {
    expect(prazoMedioDias('prazo_30_60')).toBe(45)
  })

  it('consignado nao tem prazo', () => {
    expect(prazoMedioDias('consignado')).toBeNull()
  })
})

describe('prazoMedioPonderado', () => {
  const pedidos: PedidoPrazo[] = [
    { data: '2026-08-03', condicao: 'avista', totalValor: 100 },
    { data: '2026-08-03', condicao: 'prazo_30', totalValor: 900 },
  ]

  it('pondera por R$, nao por numero de pedidos', () => {
    // media simples daria 15; ponderada = (100*0 + 900*30) / 1000 = 27
    expect(prazoMedioPonderado(pedidos)).toBe(27)
  })

  it('ignora consignado no calculo', () => {
    expect(
      prazoMedioPonderado([
        ...pedidos,
        { data: '2026-08-03', condicao: 'consignado', totalValor: 5000 },
      ]),
    ).toBe(27)
  })

  it('devolve null quando nao ha pedido com prazo', () => {
    expect(prazoMedioPonderado([])).toBeNull()
    expect(
      prazoMedioPonderado([{ data: '2026-08-03', condicao: 'consignado', totalValor: 100 }]),
    ).toBeNull()
  })
})

describe('caixaPrevistoPorSemana', () => {
  it('joga cada parcela na semana do vencimento', () => {
    const pedidos: PedidoPrazo[] = [
      { data: '2026-08-03', condicao: 'avista', totalValor: 100 },
      { data: '2026-08-03', condicao: 'prazo_30_60', totalValor: 400 },
    ]
    // avista -> 03/08 (semana 03/08); 30d -> 02/09 (semana 31/08); 60d -> 02/10 (semana 28/09)
    expect(caixaPrevistoPorSemana(pedidos)).toEqual([
      { semana: '2026-08-03', valor: 100 },
      { semana: '2026-08-31', valor: 200 },
      { semana: '2026-09-28', valor: 200 },
    ])
  })

  it('soma parcelas da mesma semana e ordena por data', () => {
    expect(
      caixaPrevistoPorSemana([
        { data: '2026-08-05', condicao: 'avista', totalValor: 50 },
        { data: '2026-08-03', condicao: 'avista', totalValor: 70 },
      ]),
    ).toEqual([{ semana: '2026-08-03', valor: 120 }])
  })

  it('consignado fica fora da previsao de caixa', () => {
    expect(
      caixaPrevistoPorSemana([{ data: '2026-08-03', condicao: 'consignado', totalValor: 900 }]),
    ).toEqual([])
  })
})
```

- [ ] **Step 6: Rodar e confirmar que falha**

Run: `npm run test -- prazo`
Expected: FAIL — `Failed to resolve import "./prazo"`.

- [ ] **Step 7: Implementar `src/lib/prazo.ts`**

```ts
import { addDias, segundaDaSemana } from './data'
import { arredondar2 } from './numero'
import type { CondicaoPagamento } from './tipos'

/**
 * Dias de vencimento implícitos de cada condição. null = sem prazo definido
 * (consignado só vira dinheiro na apuração, então fica fora de qualquer projeção).
 * Isto NÃO é contas a receber: quem cobra é o ERP. Aqui é insumo de cálculo.
 */
export const DIAS_POR_CONDICAO: Record<CondicaoPagamento, number[] | null> = {
  avista: [0],
  prazo_7: [7],
  prazo_14: [14],
  prazo_28: [28],
  prazo_30: [30],
  prazo_30_60: [30, 60],
  consignado: null,
}

export interface Vencimento {
  data: string
  valor: number
}

export interface PedidoPrazo {
  data: string
  condicao: CondicaoPagamento
  totalValor: number
}

/** Vencimentos implícitos do pedido. Parcelas iguais; a última absorve a sobra de centavo. */
export function vencimentos(
  dataPedido: string,
  condicao: CondicaoPagamento,
  valorTotal: number,
): Vencimento[] {
  const dias = DIAS_POR_CONDICAO[condicao]
  if (!dias) return []
  const parcela = arredondar2(valorTotal / dias.length)
  return dias.map((d, indice) => {
    const ultima = indice === dias.length - 1
    const valor = ultima ? arredondar2(valorTotal - parcela * (dias.length - 1)) : parcela
    return { data: addDias(dataPedido, d), valor }
  })
}

/** Prazo médio da condição em dias. Null para consignado. */
export function prazoMedioDias(condicao: CondicaoPagamento): number | null {
  const dias = DIAS_POR_CONDICAO[condicao]
  if (!dias) return null
  return dias.reduce((soma, d) => soma + d, 0) / dias.length
}

/** Prazo médio da carteira ponderado por R$ — não por número de pedidos. */
export function prazoMedioPonderado(pedidos: PedidoPrazo[]): number | null {
  let valorTotal = 0
  let somaPonderada = 0
  for (const pedido of pedidos) {
    const prazo = prazoMedioDias(pedido.condicao)
    if (prazo === null) continue
    valorTotal += pedido.totalValor
    somaPonderada += pedido.totalValor * prazo
  }
  if (valorTotal === 0) return null
  return arredondar2(somaPonderada / valorTotal)
}

/**
 * Entrada de caixa PREVISTA por semana, derivada da condição de pagamento.
 * Previsto nunca é realizado: o realizado mora no ERP.
 */
export function caixaPrevistoPorSemana(
  pedidos: PedidoPrazo[],
): { semana: string; valor: number }[] {
  const porSemana = new Map<string, number>()
  for (const pedido of pedidos) {
    for (const vencimento of vencimentos(pedido.data, pedido.condicao, pedido.totalValor)) {
      const semana = segundaDaSemana(vencimento.data)
      porSemana.set(semana, (porSemana.get(semana) ?? 0) + vencimento.valor)
    }
  }
  return [...porSemana.entries()]
    .map(([semana, valor]) => ({ semana, valor: arredondar2(valor) }))
    .sort((a, b) => a.semana.localeCompare(b.semana))
}
```

- [ ] **Step 8: Rodar toda a suíte e confirmar que passa**

Run: `npm run test`
Expected: PASS — `numero`, `preco`, `data`, `prazo`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/data.ts src/lib/data.test.ts src/lib/prazo.ts src/lib/prazo.test.ts
git commit -m "feat: datas em UTC + prazo medio ponderado e caixa previsto por semana"
```

---

## Task 4: Previsão de recompra e sinais do cliente

**Files:**
- Create: `src/lib/recompra.ts`
- Test: `src/lib/recompra.test.ts`

**Interfaces:**
- Consumes: `addDias`, `diffDias` de `@/lib/data` (Task 3); `arredondar2` de `@/lib/numero` (Task 1); `faixaVigente`, `proximaFaixa` de `@/lib/preco` (Task 2); `FaixaPreco`, `Sku` de `@/lib/tipos` (Task 2)
- Produces:
  - `PedidoHistorico { data: string; totalKg: number }`
  - `Confianca = 'sem_historico' | 'baixa' | 'media' | 'alta'`
  - `OrigemCadencia = 'calculada' | 'declarada' | 'nenhuma'`
  - `PrevisaoRecompra { cadenciaDias: number | null; origemCadencia: OrigemCadencia; proximaCompraPrevista: string | null; atrasoDias: number | null; qtdSugeridaKg: number | null; confianca: Confianca }` — `atrasoDias` positivo = previsão já passou (é a chave de ordenação da lista "na hora de recomprar")
  - `prever(pedidos: PedidoHistorico[], cadenciaDeclaradaDias: number | null, hoje: string): PrevisaoRecompra`
  - `Sinal = 'novo' | 'na_hora' | 'em_risco' | 'caindo' | 'ok'`
  - `sinais(pedidos: PedidoHistorico[], previsao: PrevisaoRecompra, hoje: string): Sinal[]`
  - `OportunidadeFaixa { kgFaltando: number; precoAtual: number; precoMelhor: number; economiaPorPacote: number }`
  - `oportunidadeFaixa(faixas: FaixaPreco[], sku: Sku, kgTipico: number, data: string): OportunidadeFaixa | null`

**Regras (do spec, seção 7):**
- cadência = média dos intervalos entre os **últimos até 5 pedidos** (5 pedidos = 4 intervalos), arredondada para dia inteiro
- confiança: 0–1 pedido = `sem_historico` · 2 = `baixa` · 3–5 = `media` · 6+ = `alta`
- quantidade sugerida = média de kg dos **últimos 3** pedidos
- com menos de 2 pedidos, usa `cadenciaDeclaradaDias` se existir, marcada como `declarada`
- `caindo` compara o último pedido com a média dos **anteriores** (incluir o último na média mascararia a queda)

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/recompra.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { oportunidadeFaixa, prever, sinais, type PedidoHistorico } from './recompra'
import type { FaixaPreco } from './tipos'

/** Pedidos a cada 10 dias, 20 kg cada. */
const REGULAR: PedidoHistorico[] = [
  { data: '2026-07-04', totalKg: 20 },
  { data: '2026-07-14', totalKg: 20 },
  { data: '2026-07-24', totalKg: 20 },
]

describe('prever', () => {
  it('calcula cadencia, proxima compra e quantidade sugerida', () => {
    const p = prever(REGULAR, null, '2026-07-28')
    expect(p.cadenciaDias).toBe(10)
    expect(p.origemCadencia).toBe('calculada')
    expect(p.proximaCompraPrevista).toBe('2026-08-03')
    expect(p.atrasoDias).toBe(-6) // faltam 6 dias
    expect(p.qtdSugeridaKg).toBe(20)
    expect(p.confianca).toBe('media')
  })

  it('atrasoDias fica positivo quando a previsao ja passou', () => {
    expect(prever(REGULAR, null, '2026-08-10').atrasoDias).toBe(7)
  })

  it('nao depende da ordem dos pedidos na entrada', () => {
    const desordenado = [REGULAR[2], REGULAR[0], REGULAR[1]]
    expect(prever(desordenado, null, '2026-07-28')).toEqual(prever(REGULAR, null, '2026-07-28'))
  })

  it('usa so os ultimos 5 pedidos para a cadencia', () => {
    // 6 pedidos: os 2 primeiros com intervalo de 60 dias, o resto de 10
    const pedidos: PedidoHistorico[] = [
      { data: '2026-01-01', totalKg: 20 },
      { data: '2026-03-01', totalKg: 20 },
      { data: '2026-03-11', totalKg: 20 },
      { data: '2026-03-21', totalKg: 20 },
      { data: '2026-03-31', totalKg: 20 },
      { data: '2026-04-10', totalKg: 20 },
    ]
    expect(prever(pedidos, null, '2026-04-15').cadenciaDias).toBe(10)
    expect(prever(pedidos, null, '2026-04-15').confianca).toBe('alta')
  })

  it('quantidade sugerida usa a media dos ultimos 3', () => {
    const pedidos: PedidoHistorico[] = [
      { data: '2026-07-04', totalKg: 100 },
      { data: '2026-07-14', totalKg: 10 },
      { data: '2026-07-24', totalKg: 20 },
      { data: '2026-08-03', totalKg: 30 },
    ]
    expect(prever(pedidos, null, '2026-08-05').qtdSugeridaKg).toBe(20)
  })

  it('com 2 pedidos a confianca e baixa', () => {
    expect(prever(REGULAR.slice(0, 2), null, '2026-07-20').confianca).toBe('baixa')
  })

  it('com 1 pedido cai na cadencia declarada', () => {
    const p = prever([{ data: '2026-07-24', totalKg: 15 }], 15, '2026-07-28')
    expect(p.cadenciaDias).toBe(15)
    expect(p.origemCadencia).toBe('declarada')
    expect(p.proximaCompraPrevista).toBe('2026-08-08')
    expect(p.qtdSugeridaKg).toBe(15)
    expect(p.confianca).toBe('sem_historico')
  })

  it('com 1 pedido e sem cadencia declarada nao ha previsao', () => {
    const p = prever([{ data: '2026-07-24', totalKg: 15 }], null, '2026-07-28')
    expect(p.cadenciaDias).toBeNull()
    expect(p.origemCadencia).toBe('nenhuma')
    expect(p.proximaCompraPrevista).toBeNull()
    expect(p.confianca).toBe('sem_historico')
  })

  it('sem nenhum pedido nao inventa numero', () => {
    const p = prever([], 20, '2026-07-28')
    expect(p.proximaCompraPrevista).toBeNull()
    expect(p.qtdSugeridaKg).toBeNull()
    expect(p.confianca).toBe('sem_historico')
  })
})

describe('sinais', () => {
  it('marca na_hora quando a previsao cai em ate 3 dias', () => {
    const hoje = '2026-08-01' // previsao 2026-08-03
    expect(sinais(REGULAR, prever(REGULAR, null, hoje), hoje)).toContain('na_hora')
  })

  it('nao marca na_hora quando ainda falta mais de 3 dias', () => {
    const hoje = '2026-07-26'
    expect(sinais(REGULAR, prever(REGULAR, null, hoje), hoje)).not.toContain('na_hora')
  })

  it('marca em_risco quando passou 1,5x a cadencia', () => {
    const hoje = '2026-08-09' // 16 dias desde 24/07, cadencia 10 -> limite 15
    expect(sinais(REGULAR, prever(REGULAR, null, hoje), hoje)).toContain('em_risco')
  })

  it('marca caindo quando o ultimo pedido fica abaixo de 70% da media anterior', () => {
    const pedidos: PedidoHistorico[] = [
      { data: '2026-07-04', totalKg: 20 },
      { data: '2026-07-14', totalKg: 20 },
      { data: '2026-07-24', totalKg: 10 },
    ]
    const hoje = '2026-07-26'
    expect(sinais(pedidos, prever(pedidos, null, hoje), hoje)).toContain('caindo')
  })

  it('nao marca caindo numa variacao pequena', () => {
    const pedidos: PedidoHistorico[] = [
      { data: '2026-07-04', totalKg: 20 },
      { data: '2026-07-14', totalKg: 20 },
      { data: '2026-07-24', totalKg: 18 },
    ]
    const hoje = '2026-07-26'
    expect(sinais(pedidos, prever(pedidos, null, hoje), hoje)).not.toContain('caindo')
  })

  it('cliente sem historico e novo', () => {
    const pedidos = [{ data: '2026-07-24', totalKg: 15 }]
    expect(sinais(pedidos, prever(pedidos, null, '2026-07-26'), '2026-07-26')).toEqual(['novo'])
  })

  it('cliente em dia fica ok', () => {
    const hoje = '2026-07-26'
    expect(sinais(REGULAR, prever(REGULAR, null, hoje), hoje)).toEqual(['ok'])
  })
})

describe('oportunidadeFaixa', () => {
  const FAIXAS: FaixaPreco[] = [
    { id: 'a2', sku: '250g', kgMin: 10.001, kgMax: 50, precoUnit: 11, vigenteDesde: '2026-01-01' },
    { id: 'a3', sku: '250g', kgMin: 50.001, kgMax: null, precoUnit: 10, vigenteDesde: '2026-01-01' },
  ]

  it('diz quantos kg faltam para o preco melhor', () => {
    const o = oportunidadeFaixa(FAIXAS, '250g', 45, '2026-03-01')
    expect(o).toEqual({
      kgFaltando: 5,
      precoAtual: 11,
      precoMelhor: 10,
      economiaPorPacote: 1,
    })
  })

  it('devolve null quando o cliente ja esta na melhor faixa', () => {
    expect(oportunidadeFaixa(FAIXAS, '250g', 80, '2026-03-01')).toBeNull()
  })

  it('devolve null quando nao ha faixa na data', () => {
    expect(oportunidadeFaixa(FAIXAS, '250g', 45, '2025-01-01')).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test -- recompra`
Expected: FAIL — `Failed to resolve import "./recompra"`.

- [ ] **Step 3: Implementar `src/lib/recompra.ts`**

```ts
import { addDias, diffDias } from './data'
import { arredondar2 } from './numero'
import { faixaVigente, proximaFaixa } from './preco'
import type { FaixaPreco, Sku } from './tipos'

export interface PedidoHistorico {
  data: string
  totalKg: number
}

export type Confianca = 'sem_historico' | 'baixa' | 'media' | 'alta'
export type OrigemCadencia = 'calculada' | 'declarada' | 'nenhuma'

export interface PrevisaoRecompra {
  cadenciaDias: number | null
  origemCadencia: OrigemCadencia
  proximaCompraPrevista: string | null
  /** Positivo = a previsão já passou. É a chave de ordenação da lista de recompra. */
  atrasoDias: number | null
  qtdSugeridaKg: number | null
  confianca: Confianca
}

const PEDIDOS_PARA_CADENCIA = 5
const PEDIDOS_PARA_QUANTIDADE = 3
const DIAS_DE_ANTECEDENCIA = 3
const FATOR_RISCO = 1.5
const PISO_QUEDA = 0.7

function ordenados(pedidos: PedidoHistorico[]): PedidoHistorico[] {
  return [...pedidos].sort((a, b) => a.data.localeCompare(b.data))
}

function confiancaDe(quantidade: number): Confianca {
  if (quantidade < 2) return 'sem_historico'
  if (quantidade < 3) return 'baixa'
  if (quantidade <= 5) return 'media'
  return 'alta'
}

function mediaKg(pedidos: PedidoHistorico[]): number {
  return arredondar2(pedidos.reduce((soma, p) => soma + p.totalKg, 0) / pedidos.length)
}

/**
 * Previsão de recompra por média móvel simples.
 * Sem sazonalidade e sem modelo — se o histórico revelar padrão mensal, troca-se aqui.
 */
export function prever(
  pedidos: PedidoHistorico[],
  cadenciaDeclaradaDias: number | null,
  hoje: string,
): PrevisaoRecompra {
  const lista = ordenados(pedidos)
  const confianca = confiancaDe(lista.length)

  if (lista.length === 0) {
    return {
      cadenciaDias: cadenciaDeclaradaDias,
      origemCadencia: cadenciaDeclaradaDias === null ? 'nenhuma' : 'declarada',
      proximaCompraPrevista: null,
      atrasoDias: null,
      qtdSugeridaKg: null,
      confianca,
    }
  }

  const ultimo = lista[lista.length - 1]
  const qtdSugeridaKg = mediaKg(lista.slice(-PEDIDOS_PARA_QUANTIDADE))

  let cadenciaDias: number | null = null
  let origemCadencia: OrigemCadencia = 'nenhuma'

  if (lista.length >= 2) {
    const recentes = lista.slice(-PEDIDOS_PARA_CADENCIA)
    const intervalos = recentes
      .slice(1)
      .map((pedido, indice) => diffDias(recentes[indice].data, pedido.data))
    cadenciaDias = Math.round(intervalos.reduce((soma, d) => soma + d, 0) / intervalos.length)
    origemCadencia = 'calculada'
  } else if (cadenciaDeclaradaDias !== null) {
    cadenciaDias = cadenciaDeclaradaDias
    origemCadencia = 'declarada'
  }

  const proximaCompraPrevista = cadenciaDias === null ? null : addDias(ultimo.data, cadenciaDias)

  return {
    cadenciaDias,
    origemCadencia,
    proximaCompraPrevista,
    atrasoDias: proximaCompraPrevista === null ? null : diffDias(proximaCompraPrevista, hoje),
    qtdSugeridaKg,
    confianca,
  }
}

export type Sinal = 'novo' | 'na_hora' | 'em_risco' | 'caindo' | 'ok'

/** Sinais que a tela usa para priorizar a ligação do vendedor. */
export function sinais(
  pedidos: PedidoHistorico[],
  previsao: PrevisaoRecompra,
  hoje: string,
): Sinal[] {
  const lista = ordenados(pedidos)
  if (previsao.confianca === 'sem_historico') return ['novo']

  const encontrados: Sinal[] = []
  const ultimo = lista[lista.length - 1]

  if (previsao.atrasoDias !== null && previsao.atrasoDias >= -DIAS_DE_ANTECEDENCIA) {
    encontrados.push('na_hora')
  }

  if (
    previsao.cadenciaDias !== null &&
    diffDias(ultimo.data, hoje) > previsao.cadenciaDias * FATOR_RISCO
  ) {
    encontrados.push('em_risco')
  }

  // compara com a média dos ANTERIORES: incluir o último na média mascararia a queda
  const anteriores = lista.slice(0, -1).slice(-PEDIDOS_PARA_CADENCIA)
  if (anteriores.length > 0 && ultimo.totalKg < mediaKg(anteriores) * PISO_QUEDA) {
    encontrados.push('caindo')
  }

  return encontrados.length > 0 ? encontrados : ['ok']
}

export interface OportunidadeFaixa {
  kgFaltando: number
  precoAtual: number
  precoMelhor: number
  economiaPorPacote: number
}

/** Argumento de venda: quanto falta em kg para o cliente cair na faixa melhor. */
export function oportunidadeFaixa(
  faixas: FaixaPreco[],
  sku: Sku,
  kgTipico: number,
  data: string,
): OportunidadeFaixa | null {
  const atual = faixaVigente(faixas, sku, kgTipico, data)
  const melhor = proximaFaixa(faixas, sku, kgTipico, data)
  if (!atual || !melhor || melhor.precoUnit >= atual.precoUnit) return null
  return {
    kgFaltando: arredondar2(melhor.kgMin - kgTipico),
    precoAtual: atual.precoUnit,
    precoMelhor: melhor.precoUnit,
    economiaPorPacote: arredondar2(atual.precoUnit - melhor.precoUnit),
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test -- recompra`
Expected: PASS — todos os testes de `prever`, `sinais` e `oportunidadeFaixa`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recompra.ts src/lib/recompra.test.ts
git commit -m "feat: previsao de recompra por cadencia, sinais do cliente e oportunidade de faixa"
```

---

## Task 5: Saldo, giro e reposição do consignado

**Files:**
- Create: `src/lib/consignado.ts`
- Test: `src/lib/consignado.test.ts`

**Interfaces:**
- Consumes: `addDias`, `diffDias` de `@/lib/data` (Task 3); `arredondar2` de `@/lib/numero` (Task 1); `KG_POR_SKU`, `SKUS`, `Sku`, `TipoMovConsignado` de `@/lib/tipos` (Task 2)
- Produces:
  - `MovConsignado { sku: Sku; tipo: TipoMovConsignado; qtdPacotes: number; data: string }`
  - `saldoPorSku(movs: MovConsignado[]): Record<Sku, number>`
  - `saldoKg(movs: MovConsignado[]): number`
  - `vendaApuradaDiariaKg(movs: MovConsignado[], hoje: string): number | null`
  - `diasRestantes(movs: MovConsignado[], hoje: string): number | null`
  - `diasParado(movs: MovConsignado[], hoje: string): number | null`
  - `previsaoReposicao(movs: MovConsignado[], hoje: string): string | null`

**Regra (do spec, seção 7):** consignado não usa intervalo entre pedidos. A previsão sai de `saldo_kg ÷ venda_apurada_diária`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/consignado.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  diasParado,
  diasRestantes,
  previsaoReposicao,
  saldoKg,
  saldoPorSku,
  vendaApuradaDiariaKg,
  type MovConsignado,
} from './consignado'

/** Entrega de 40 pacotes de 500g (20 kg) e 10 kg já apurados em 20 dias. */
const MOVS: MovConsignado[] = [
  { sku: '500g', tipo: 'entrega', qtdPacotes: 40, data: '2026-07-01' },
  { sku: '500g', tipo: 'venda_apurada', qtdPacotes: 10, data: '2026-07-11' },
  { sku: '500g', tipo: 'venda_apurada', qtdPacotes: 10, data: '2026-07-21' },
]

describe('saldoPorSku', () => {
  it('soma entrega e subtrai venda apurada e retorno', () => {
    expect(saldoPorSku(MOVS)).toEqual({ '250g': 0, '500g': 20 })
  })

  it('retorno reduz o saldo', () => {
    const comRetorno: MovConsignado[] = [
      ...MOVS,
      { sku: '500g', tipo: 'retorno', qtdPacotes: 5, data: '2026-07-25' },
    ]
    expect(saldoPorSku(comRetorno)['500g']).toBe(15)
  })

  it('sem movimento o saldo e zero em todos os SKUs', () => {
    expect(saldoPorSku([])).toEqual({ '250g': 0, '500g': 0 })
  })
})

describe('saldoKg', () => {
  it('converte o saldo de pacotes para kg', () => {
    expect(saldoKg(MOVS)).toBe(10) // 20 pacotes de 500g
  })
})

describe('vendaApuradaDiariaKg', () => {
  it('divide o kg apurado pelos dias desde a primeira entrega', () => {
    // 20 pacotes de 500g = 10 kg apurados em 20 dias (01/07 -> 21/07)
    expect(vendaApuradaDiariaKg(MOVS, '2026-07-21')).toBe(0.5)
  })

  it('devolve null quando nunca houve apuracao', () => {
    const soEntrega: MovConsignado[] = [MOVS[0]]
    expect(vendaApuradaDiariaKg(soEntrega, '2026-07-21')).toBeNull()
  })
})

describe('diasRestantes', () => {
  it('estima quantos dias o saldo ainda cobre', () => {
    // saldo 10 kg / 0,5 kg por dia = 20 dias
    expect(diasRestantes(MOVS, '2026-07-21')).toBe(20)
  })

  it('devolve null sem apuracao — nao ha ritmo para dividir', () => {
    expect(diasRestantes([MOVS[0]], '2026-07-21')).toBeNull()
  })
})

describe('diasParado', () => {
  it('conta os dias desde a ultima apuracao', () => {
    expect(diasParado(MOVS, '2026-07-31')).toBe(10)
  })

  it('sem apuracao conta desde a primeira entrega', () => {
    expect(diasParado([MOVS[0]], '2026-07-31')).toBe(30)
  })

  it('devolve null sem nenhum movimento', () => {
    expect(diasParado([], '2026-07-31')).toBeNull()
  })
})

describe('previsaoReposicao', () => {
  it('projeta a data em que o saldo acaba', () => {
    expect(previsaoReposicao(MOVS, '2026-07-21')).toBe('2026-08-10')
  })

  it('devolve null quando nao da para estimar', () => {
    expect(previsaoReposicao([MOVS[0]], '2026-07-21')).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test -- consignado`
Expected: FAIL — `Failed to resolve import "./consignado"`.

- [ ] **Step 3: Implementar `src/lib/consignado.ts`**

```ts
import { addDias, diffDias } from './data'
import { arredondar2 } from './numero'
import { KG_POR_SKU, SKUS, type Sku, type TipoMovConsignado } from './tipos'

export interface MovConsignado {
  sku: Sku
  tipo: TipoMovConsignado
  qtdPacotes: number
  data: string
}

const SINAL: Record<TipoMovConsignado, number> = {
  entrega: 1,
  venda_apurada: -1,
  retorno: -1,
}

/**
 * Saldo em pacotes por SKU. Sempre calculado pela soma dos movimentos —
 * campo `saldo` guardado dessincroniza, soma não.
 */
export function saldoPorSku(movs: MovConsignado[]): Record<Sku, number> {
  const saldo = Object.fromEntries(SKUS.map((sku) => [sku, 0])) as Record<Sku, number>
  for (const mov of movs) {
    saldo[mov.sku] += SINAL[mov.tipo] * mov.qtdPacotes
  }
  return saldo
}

export function saldoKg(movs: MovConsignado[]): number {
  const saldo = saldoPorSku(movs)
  return arredondar2(SKUS.reduce((soma, sku) => soma + saldo[sku] * KG_POR_SKU[sku], 0))
}

function kgDe(movs: MovConsignado[]): number {
  return arredondar2(movs.reduce((soma, m) => soma + m.qtdPacotes * KG_POR_SKU[m.sku], 0))
}

function primeiraEntrega(movs: MovConsignado[]): string | null {
  const entregas = movs.filter((m) => m.tipo === 'entrega').map((m) => m.data).sort()
  return entregas[0] ?? null
}

/** Ritmo de venda no cliente: kg apurado ÷ dias desde a primeira entrega. */
export function vendaApuradaDiariaKg(movs: MovConsignado[], hoje: string): number | null {
  const apuradas = movs.filter((m) => m.tipo === 'venda_apurada')
  const inicio = primeiraEntrega(movs)
  if (apuradas.length === 0 || inicio === null) return null
  const dias = Math.max(1, diffDias(inicio, hoje))
  return arredondar2(kgDe(apuradas) / dias)
}

/** Dias que o saldo atual ainda cobre no ritmo apurado. */
export function diasRestantes(movs: MovConsignado[], hoje: string): number | null {
  const ritmo = vendaApuradaDiariaKg(movs, hoje)
  if (ritmo === null || ritmo <= 0) return null
  return Math.round(saldoKg(movs) / ritmo)
}

/** Giro: dias desde a última apuração — ou desde a primeira entrega, se nunca apurou. */
export function diasParado(movs: MovConsignado[], hoje: string): number | null {
  const apuradas = movs.filter((m) => m.tipo === 'venda_apurada').map((m) => m.data).sort()
  const referencia = apuradas[apuradas.length - 1] ?? primeiraEntrega(movs)
  if (!referencia) return null
  return diffDias(referencia, hoje)
}

/** Data prevista em que o saldo consignado acaba — o gatilho de reposição. */
export function previsaoReposicao(movs: MovConsignado[], hoje: string): string | null {
  const dias = diasRestantes(movs, hoje)
  if (dias === null) return null
  return addDias(hoje, dias)
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test`
Expected: PASS — `numero`, `preco`, `data`, `prazo`, `recompra`, `consignado`.

- [ ] **Step 5: Rodar typecheck**

Run: `npm run typecheck`
Expected: sem saída.

- [ ] **Step 6: Commit**

```bash
git add src/lib/consignado.ts src/lib/consignado.test.ts
git commit -m "feat: saldo, giro e previsao de reposicao do consignado"
```

---

## Task 6: Schema do banco com RLS por papel

**Files:**
- Create: `supabase/migrations/20260803120000_init_torrao.sql`, `supabase/seed.sql`

**Interfaces:**
- Consumes: nada em código (só o projeto Supabase `wqihhxcfjwgjrqrlvkrc`)
- Produces: tabelas `profiles`, `clientes`, `precos_faixa`, `pedidos`, `pedido_itens`, `consignado_movimentos`; enums `sku`, `canal_cliente`, `condicao_pagamento`, `status_pedido`, `tipo_mov_consignado`, `papel_usuario`; funções `is_admin()`, `pode_ver_cliente(uuid)`

**Adendo ao spec:** `clientes.vendedor_id` não estava no spec, mas sem ele a regra "vendedor vê os próprios clientes" (spec §9) não tem como ser implementada. Entra como coluna obrigatória com default `auth.uid()`.

- [ ] **Step 1: Criar a migration**

Criar `supabase/migrations/20260803120000_init_torrao.sql`:

```sql
-- Torrão — schema inicial de vendas.
-- Não existe contas a receber aqui: quem cobra é o ERP que emite a NF.
-- A condição de pagamento é guardada só como insumo de cálculo (prazo médio, caixa previsto).

create type sku as enum ('250g', '500g');
create type canal_cliente as enum ('loja_rondelli', 'revenda', 'bar_padaria', 'hotel', 'consumidor');
create type condicao_pagamento as enum (
  'avista', 'prazo_7', 'prazo_14', 'prazo_28', 'prazo_30', 'prazo_30_60', 'consignado'
);
create type status_pedido as enum ('aberto', 'entregue', 'cancelado');
create type tipo_mov_consignado as enum ('entrega', 'venda_apurada', 'retorno');
create type papel_usuario as enum ('admin', 'vendedor');

-- ---------------------------------------------------------------- perfis

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  nome text not null,
  papel papel_usuario not null default 'vendedor',
  created_at timestamptz not null default now()
);

create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- security definer para não recursar na RLS de profiles
create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and papel = 'admin');
$$;

-- ---------------------------------------------------------------- clientes

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  canal canal_cliente not null,
  cidade text,
  whatsapp text,
  condicao_padrao condicao_pagamento not null default 'avista',
  cadencia_declarada_dias int check (cadencia_declarada_dias > 0),
  vendedor_id uuid not null default auth.uid() references auth.users on delete restrict,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create index clientes_vendedor_idx on clientes (vendedor_id);
create index clientes_nome_idx on clientes (nome);

create function pode_ver_cliente(p_cliente_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.clientes c
    where c.id = p_cliente_id and c.vendedor_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------- tabela de preço

create table precos_faixa (
  id uuid primary key default gen_random_uuid(),
  sku sku not null,
  kg_min numeric(10, 3) not null check (kg_min >= 0),
  kg_max numeric(10, 3) check (kg_max > kg_min),
  preco_unit numeric(10, 2) not null check (preco_unit > 0),
  vigente_desde date not null,
  created_at timestamptz not null default now(),
  unique (sku, kg_min, vigente_desde)
);

create index precos_faixa_busca_idx on precos_faixa (sku, vigente_desde desc);

-- ---------------------------------------------------------------- pedidos

create table pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes on delete restrict,
  data date not null default current_date,
  condicao_pagamento condicao_pagamento not null,
  status status_pedido not null default 'aberto',
  total_kg numeric(10, 3) not null check (total_kg > 0),
  total_valor numeric(12, 2) not null check (total_valor >= 0),
  observacao text,
  created_by uuid not null default auth.uid() references auth.users on delete restrict,
  created_at timestamptz not null default now()
);

create index pedidos_cliente_data_idx on pedidos (cliente_id, data desc);
create index pedidos_data_idx on pedidos (data desc);

create table pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos on delete cascade,
  sku sku not null,
  qtd_pacotes int not null check (qtd_pacotes > 0),
  -- congelado no insert: reajuste de tabela nunca reescreve faturamento passado
  preco_unit_aplicado numeric(10, 2) not null check (preco_unit_aplicado > 0),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  unique (pedido_id, sku)
);

create index pedido_itens_pedido_idx on pedido_itens (pedido_id);

-- ---------------------------------------------------------------- consignado

create table consignado_movimentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes on delete restrict,
  pedido_id uuid references pedidos on delete set null,
  sku sku not null,
  tipo tipo_mov_consignado not null,
  qtd_pacotes int not null check (qtd_pacotes > 0),
  data date not null default current_date,
  created_by uuid not null default auth.uid() references auth.users on delete restrict,
  created_at timestamptz not null default now()
);

create index consignado_cliente_idx on consignado_movimentos (cliente_id, data);

-- ---------------------------------------------------------------- RLS
-- Nenhuma policy USING (true). Leitura de preço exige usuário logado.

alter table profiles enable row level security;
alter table clientes enable row level security;
alter table precos_faixa enable row level security;
alter table pedidos enable row level security;
alter table pedido_itens enable row level security;
alter table consignado_movimentos enable row level security;

create policy profiles_select on profiles for select
  using (id = auth.uid() or is_admin());
-- sem policy de update para o próprio usuário: uma subquery em profiles dentro de
-- uma policy de profiles recursa. Mudança de papel é do admin, e nada mais no
-- perfil precisa ser editável na v1.
create policy profiles_admin_all on profiles for all
  using (is_admin()) with check (is_admin());

create policy clientes_select on clientes for select
  using (is_admin() or vendedor_id = auth.uid());
create policy clientes_insert on clientes for insert
  with check (is_admin() or vendedor_id = auth.uid());
create policy clientes_update on clientes for update
  using (is_admin() or vendedor_id = auth.uid())
  with check (is_admin() or vendedor_id = auth.uid());
create policy clientes_delete on clientes for delete
  using (is_admin());

create policy precos_select on precos_faixa for select
  using (auth.uid() is not null);
create policy precos_admin_write on precos_faixa for all
  using (is_admin()) with check (is_admin());

create policy pedidos_select on pedidos for select
  using (pode_ver_cliente(cliente_id));
create policy pedidos_insert on pedidos for insert
  with check (pode_ver_cliente(cliente_id));
create policy pedidos_update on pedidos for update
  using (pode_ver_cliente(cliente_id)) with check (pode_ver_cliente(cliente_id));
create policy pedidos_delete on pedidos for delete
  using (is_admin());

create policy pedido_itens_select on pedido_itens for select
  using (exists (select 1 from pedidos p where p.id = pedido_id and pode_ver_cliente(p.cliente_id)));
create policy pedido_itens_insert on pedido_itens for insert
  with check (exists (select 1 from pedidos p where p.id = pedido_id and pode_ver_cliente(p.cliente_id)));
create policy pedido_itens_delete on pedido_itens for delete
  using (exists (select 1 from pedidos p where p.id = pedido_id and pode_ver_cliente(p.cliente_id)));

create policy consignado_select on consignado_movimentos for select
  using (pode_ver_cliente(cliente_id));
create policy consignado_insert on consignado_movimentos for insert
  with check (pode_ver_cliente(cliente_id));
create policy consignado_delete on consignado_movimentos for delete
  using (is_admin());

grant execute on function is_admin() to authenticated;
grant execute on function pode_ver_cliente(uuid) to authenticated;
```

- [ ] **Step 2: Criar o seed com faixas de exemplo**

Criar `supabase/seed.sql`:

```sql
-- Faixas de EXEMPLO só para a tela ter dado. Os preços reais são cadastrados
-- pelo Carlos na tela Tabela de Preços — não tratar estes números como oficiais.
insert into precos_faixa (sku, kg_min, kg_max, preco_unit, vigente_desde) values
  ('250g',  0,     10,   12.00, '2026-01-01'),
  ('250g', 10.001, 50,   11.00, '2026-01-01'),
  ('250g', 50.001, null, 10.00, '2026-01-01'),
  ('500g',  0,     10,   22.00, '2026-01-01'),
  ('500g', 10.001, 50,   20.00, '2026-01-01'),
  ('500g', 50.001, null, 18.00, '2026-01-01');
```

- [ ] **Step 3: Aplicar a migration no projeto**

Com a Supabase CLI instalada:

```bash
supabase link --project-ref wqihhxcfjwgjrqrlvkrc
supabase db push
```

Se a CLI não estiver disponível, abrir o SQL Editor do projeto no dashboard, colar o conteúdo de `20260803120000_init_torrao.sql`, executar, e depois colar e executar `seed.sql`.

Expected: `Finished supabase db push.` (ou "Success. No rows returned" no SQL Editor).

- [ ] **Step 4: Verificar que as 6 tabelas existem com RLS ligada**

Rodar no SQL Editor:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

Expected: 6 linhas — `clientes`, `consignado_movimentos`, `pedido_itens`, `pedidos`, `precos_faixa`, `profiles` — todas com `rowsecurity = true`.

- [ ] **Step 5: Verificar que nenhuma policy é permissiva demais**

Rodar no SQL Editor:

```sql
select tablename, policyname, qual
from pg_policies
where schemaname = 'public' and (qual = 'true' or with_check = 'true');
```

Expected: **0 linhas.** Se aparecer alguma, corrigir antes de seguir.

- [ ] **Step 6: Criar o usuário admin e confirmar o papel**

No dashboard, Authentication → Users → Add user, com o email do Carlos. Depois, no SQL Editor:

```sql
update profiles set papel = 'admin' where id = (select id from auth.users where email = 'carlos.eduardo@rondelli.com.br');
select nome, papel from profiles;
```

Expected: a linha do Carlos com `papel = admin`.

- [ ] **Step 7: Commit**

```bash
git add supabase/
git commit -m "feat: schema inicial com 6 tabelas, enums e RLS por papel"
```

---

## Task 7: Cliente Supabase, autenticação e casca do app

**Files:**
- Create: `src/lib/supabase.ts`, `src/hooks/useAuth.tsx`, `src/componentes/RotaProtegida.tsx`, `src/componentes/Estado.tsx`, `src/componentes/AppShell.tsx`, `src/paginas/Login.tsx`, `.env`
- Modify: `src/App.tsx`, `src/main.tsx`

**Interfaces:**
- Consumes: nada de `src/lib/` (é infra)
- Produces:
  - `supabase` (cliente único) de `@/lib/supabase`
  - `useAuth(): { sessao, usuarioId, papel, carregando, entrar, sair }` e `<ProvedorAuth>` de `@/hooks/useAuth`
  - `<RotaProtegida soAdmin?: boolean>` de `@/componentes/RotaProtegida`
  - `<Carregando />`, `<Erro mensagem />`, `<Vazio mensagem />` de `@/componentes/Estado`
  - `<AppShell>` de `@/componentes/AppShell`

- [ ] **Step 1: Criar `.env` com a chave real**

Copiar `.env.example` para `.env` e colar a publishable key de Project Settings → API Keys:

```bash
cp .env.example .env
```

Confirmar que `.env` está no `.gitignore` (Task 1) antes de seguir.

- [ ] **Step 2: Criar `src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !chave) {
  throw new Error('Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env')
}

export const supabase = createClient(url, chave)
```

- [ ] **Step 3: Criar `src/hooks/useAuth.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type Papel = 'admin' | 'vendedor'

interface Auth {
  sessao: Session | null
  usuarioId: string | null
  papel: Papel | null
  carregando: boolean
  entrar: (email: string, senha: string) => Promise<void>
  sair: () => Promise<void>
}

const Contexto = createContext<Auth | null>(null)

export function ProvedorAuth({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [papel, setPapel] = useState<Papel | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session)
      setCarregando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSessao(novaSessao)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!sessao) {
      setPapel(null)
      return
    }
    supabase
      .from('profiles')
      .select('papel')
      .eq('id', sessao.user.id)
      .single()
      .then(({ data }) => setPapel((data?.papel as Papel) ?? 'vendedor'))
  }, [sessao])

  const valor: Auth = {
    sessao,
    usuarioId: sessao?.user.id ?? null,
    papel,
    carregando,
    entrar: async (email, senha) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) throw new Error('E-mail ou senha inválidos')
    },
    sair: async () => {
      await supabase.auth.signOut()
    },
  }

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useAuth(): Auth {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error('useAuth precisa estar dentro de ProvedorAuth')
  return contexto
}
```

- [ ] **Step 4: Criar `src/componentes/Estado.tsx`**

```tsx
export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return <p className="p-6 text-center text-sm text-stone-500">{texto}</p>
}

export function Erro({ mensagem }: { mensagem: string }) {
  return (
    <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p className="font-medium">Algo deu errado</p>
      <p>{mensagem}</p>
    </div>
  )
}

export function Vazio({ mensagem }: { mensagem: string }) {
  return <p className="p-8 text-center text-sm text-stone-500">{mensagem}</p>
}
```

- [ ] **Step 5: Criar `src/componentes/RotaProtegida.tsx`**

```tsx
import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Carregando } from './Estado'

export function RotaProtegida({
  children,
  soAdmin = false,
}: {
  children: ReactNode
  soAdmin?: boolean
}) {
  const { sessao, papel, carregando } = useAuth()
  if (carregando) return <Carregando />
  if (!sessao) return <Navigate to="/entrar" replace />
  if (soAdmin && papel !== null && papel !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}
```

- [ ] **Step 6: Criar `src/componentes/AppShell.tsx`**

```tsx
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

const ABAS = [
  { para: '/', rotulo: 'Pedido' },
  { para: '/clientes', rotulo: 'Clientes' },
  { para: '/painel', rotulo: 'Painel' },
  { para: '/precos', rotulo: 'Preços' },
]

export function AppShell() {
  const { sair } = useAuth()
  return (
    <div className="min-h-screen bg-stone-50 pb-16 text-stone-900">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
        <span className="text-lg font-bold">Torrão</span>
        <button onClick={sair} className="text-sm text-stone-500 underline">
          Sair
        </button>
      </header>

      <main className="mx-auto max-w-3xl">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 grid grid-cols-4 border-t border-stone-200 bg-white">
        {ABAS.map((aba) => (
          <NavLink
            key={aba.para}
            to={aba.para}
            end={aba.para === '/'}
            className={({ isActive }) =>
              `py-3 text-center text-sm ${isActive ? 'font-semibold text-amber-800' : 'text-stone-500'}`
            }
          >
            {aba.rotulo}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
```

- [ ] **Step 7: Criar `src/paginas/Login.tsx`**

```tsx
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function Login() {
  const { sessao, entrar } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (sessao) return <Navigate to="/" replace />

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      await entrar(email, senha)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao entrar')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-6">
      <form onSubmit={enviar} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">Torrão</h1>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          className="w-full rounded-lg border border-stone-300 px-3 py-3"
        />
        <input
          type="password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha"
          className="w-full rounded-lg border border-stone-300 px-3 py-3"
        />
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-amber-800 py-3 font-semibold text-white disabled:opacity-50"
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 8: Reescrever `src/App.tsx` com as rotas**

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/componentes/AppShell'
import { RotaProtegida } from '@/componentes/RotaProtegida'
import { ProvedorAuth } from '@/hooks/useAuth'
import Login from '@/paginas/Login'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

function EmBreve({ nome }: { nome: string }) {
  return <p className="p-6 text-stone-500">{nome} — em construção</p>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProvedorAuth>
        <BrowserRouter>
          <Routes>
            <Route path="/entrar" element={<Login />} />
            <Route
              element={
                <RotaProtegida>
                  <AppShell />
                </RotaProtegida>
              }
            >
              <Route path="/" element={<EmBreve nome="Novo pedido" />} />
              <Route path="/clientes" element={<EmBreve nome="Clientes" />} />
              <Route path="/painel" element={<EmBreve nome="Painel" />} />
              <Route
                path="/precos"
                element={
                  <RotaProtegida soAdmin>
                    <EmBreve nome="Tabela de preços" />
                  </RotaProtegida>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </ProvedorAuth>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 9: Verificar typecheck e build**

Run: `npm run typecheck`
Expected: sem saída.

Run: `npm run build`
Expected: `✓ built in ...`.

- [ ] **Step 10: Checklist manual**

Run: `npm run dev` e abrir `http://localhost:5173`.

- [ ] Sem sessão, qualquer rota redireciona para `/entrar`
- [ ] Senha errada mostra "E-mail ou senha inválidos" e não trava o botão
- [ ] Login com o admin criado na Task 6 leva para `/` com a nav inferior visível
- [ ] As 4 abas navegam e a aba ativa fica destacada
- [ ] "Sair" volta para `/entrar`
- [ ] Em 390 px de largura (DevTools, iPhone) nada estoura na horizontal

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: auth supabase, rota protegida e casca do app com nav mobile"
```

---

## Task 8: RPC de criação de pedido e hooks de dados

**Files:**
- Create: `supabase/migrations/20260803130000_rpc_criar_pedido.sql`, `src/hooks/useClientes.ts`, `src/hooks/usePrecos.ts`, `src/hooks/usePedidos.ts`, `src/hooks/useConsignado.ts`

**Interfaces:**
- Consumes: `supabase` de `@/lib/supabase` (Task 7); tipos de `@/lib/tipos` (Task 2); `MovConsignado` de `@/lib/consignado` (Task 5)
- Produces:
  - `Cliente { id, nome, canal, cidade, whatsapp, condicaoPadrao, cadenciaDeclaradaDias, ativo }`
  - `useClientes(): UseQueryResult<Cliente[]>` · `useSalvarCliente()` (insert e update pelo `id` opcional)
  - `usePrecos(): UseQueryResult<FaixaPreco[]>` · `useSalvarFaixas()`
  - `PedidoCompleto { id, clienteId, clienteNome, canal, data, condicao, status, totalKg, totalValor, itens: ItemPrecificado[] }`
  - `usePedidos(): UseQueryResult<PedidoCompleto[]>` · `useCriarPedido()`
  - `useConsignado(clienteId): UseQueryResult<MovConsignado[]>` · `useApurarConsignado()`
  - chaves de cache: `['clientes']`, `['precos']`, `['pedidos']`, `['consignado', clienteId]`

**Por que RPC e não dois inserts:** pedido e itens têm que entrar juntos. Dois inserts pelo REST podem deixar um pedido sem item (total certo, mix errado). O RPC fecha na mesma transação e ainda cria os movimentos de entrega quando a condição é consignado — assim ninguém esquece.

- [ ] **Step 1: Criar a migration do RPC**

Criar `supabase/migrations/20260803130000_rpc_criar_pedido.sql`:

```sql
-- Cria pedido + itens (+ movimentos de consignado) em UMA transação.
-- SECURITY INVOKER de propósito: a RLS do vendedor continua valendo aqui dentro.
create function criar_pedido(
  p_cliente_id uuid,
  p_data date,
  p_condicao condicao_pagamento,
  p_status status_pedido,
  p_observacao text,
  p_total_kg numeric,
  p_total_valor numeric,
  p_itens jsonb
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_pedido_id uuid;
begin
  if jsonb_array_length(p_itens) = 0 then
    raise exception 'Pedido sem itens';
  end if;

  insert into pedidos (
    cliente_id, data, condicao_pagamento, status, observacao, total_kg, total_valor
  ) values (
    p_cliente_id, p_data, p_condicao, p_status, p_observacao, p_total_kg, p_total_valor
  )
  returning id into v_pedido_id;

  insert into pedido_itens (pedido_id, sku, qtd_pacotes, preco_unit_aplicado, subtotal)
  select
    v_pedido_id,
    (item ->> 'sku')::sku,
    (item ->> 'qtd_pacotes')::int,
    (item ->> 'preco_unit_aplicado')::numeric,
    (item ->> 'subtotal')::numeric
  from jsonb_array_elements(p_itens) as item;

  -- consignado: a entrega física é registrada junto, senão o saldo nasce errado
  if p_condicao = 'consignado' then
    insert into consignado_movimentos (cliente_id, pedido_id, sku, tipo, qtd_pacotes, data)
    select
      p_cliente_id,
      v_pedido_id,
      (item ->> 'sku')::sku,
      'entrega'::tipo_mov_consignado,
      (item ->> 'qtd_pacotes')::int,
      p_data
    from jsonb_array_elements(p_itens) as item;
  end if;

  return v_pedido_id;
end;
$$;

grant execute on function criar_pedido(uuid, date, condicao_pagamento, status_pedido, text, numeric, numeric, jsonb) to authenticated;
```

- [ ] **Step 2: Aplicar a migration**

```bash
supabase db push
```

Expected: `Finished supabase db push.` (ou executar o arquivo no SQL Editor).

- [ ] **Step 3: Criar `src/hooks/useClientes.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Canal, CondicaoPagamento } from '@/lib/tipos'

export interface Cliente {
  id: string
  nome: string
  canal: Canal
  cidade: string | null
  whatsapp: string | null
  condicaoPadrao: CondicaoPagamento
  cadenciaDeclaradaDias: number | null
  ativo: boolean
}

export type ClienteInput = Omit<Cliente, 'id'> & { id?: string }

interface LinhaCliente {
  id: string
  nome: string
  canal: Canal
  cidade: string | null
  whatsapp: string | null
  condicao_padrao: CondicaoPagamento
  cadencia_declarada_dias: number | null
  ativo: boolean
}

function mapear(linha: LinhaCliente): Cliente {
  return {
    id: linha.id,
    nome: linha.nome,
    canal: linha.canal,
    cidade: linha.cidade,
    whatsapp: linha.whatsapp,
    condicaoPadrao: linha.condicao_padrao,
    cadenciaDeclaradaDias: linha.cadencia_declarada_dias,
    ativo: linha.ativo,
  }
}

export function useClientes() {
  return useQuery({
    queryKey: ['clientes'],
    queryFn: async (): Promise<Cliente[]> => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, canal, cidade, whatsapp, condicao_padrao, cadencia_declarada_dias, ativo')
        .order('nome')
      if (error) throw new Error(error.message)
      return (data as LinhaCliente[]).map(mapear)
    },
  })
}

export function useSalvarCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (cliente: ClienteInput) => {
      const linha = {
        nome: cliente.nome,
        canal: cliente.canal,
        cidade: cliente.cidade,
        whatsapp: cliente.whatsapp,
        condicao_padrao: cliente.condicaoPadrao,
        cadencia_declarada_dias: cliente.cadenciaDeclaradaDias,
        ativo: cliente.ativo,
      }
      const resposta = cliente.id
        ? await supabase.from('clientes').update(linha).eq('id', cliente.id)
        : await supabase.from('clientes').insert(linha)
      if (resposta.error) throw new Error(resposta.error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes'] }),
  })
}
```

- [ ] **Step 4: Criar `src/hooks/usePrecos.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { FaixaPreco, Sku } from '@/lib/tipos'

interface LinhaFaixa {
  id: string
  sku: Sku
  kg_min: number
  kg_max: number | null
  preco_unit: number
  vigente_desde: string
}

export function usePrecos() {
  return useQuery({
    queryKey: ['precos'],
    queryFn: async (): Promise<FaixaPreco[]> => {
      const { data, error } = await supabase
        .from('precos_faixa')
        .select('id, sku, kg_min, kg_max, preco_unit, vigente_desde')
        .order('vigente_desde', { ascending: false })
        .order('kg_min')
      if (error) throw new Error(error.message)
      return (data as LinhaFaixa[]).map((linha) => ({
        id: linha.id,
        sku: linha.sku,
        kgMin: Number(linha.kg_min),
        kgMax: linha.kg_max === null ? null : Number(linha.kg_max),
        precoUnit: Number(linha.preco_unit),
        vigenteDesde: linha.vigente_desde,
      }))
    },
    // preço muda raramente; 5 min evita ida ao banco em cada tela de pedido
    staleTime: 5 * 60_000,
  })
}

export type NovaFaixa = Omit<FaixaPreco, 'id'>

/** Grava um lote de faixas como uma nova versão. Nunca faz UPDATE em faixa antiga. */
export function useSalvarFaixas() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (faixas: NovaFaixa[]) => {
      const { error } = await supabase.from('precos_faixa').insert(
        faixas.map((f) => ({
          sku: f.sku,
          kg_min: f.kgMin,
          kg_max: f.kgMax,
          preco_unit: f.precoUnit,
          vigente_desde: f.vigenteDesde,
        })),
      )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['precos'] }),
  })
}
```

- [ ] **Step 5: Criar `src/hooks/usePedidos.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  Canal,
  CondicaoPagamento,
  ItemPrecificado,
  Sku,
  StatusPedido,
} from '@/lib/tipos'

export interface PedidoCompleto {
  id: string
  clienteId: string
  clienteNome: string
  canal: Canal
  data: string
  condicao: CondicaoPagamento
  status: StatusPedido
  totalKg: number
  totalValor: number
  itens: ItemPrecificado[]
}

interface LinhaPedido {
  id: string
  cliente_id: string
  data: string
  condicao_pagamento: CondicaoPagamento
  status: StatusPedido
  total_kg: number
  total_valor: number
  clientes: { nome: string; canal: Canal } | null
  pedido_itens: {
    sku: Sku
    qtd_pacotes: number
    preco_unit_aplicado: number
    subtotal: number
  }[]
}

const SELECT_PEDIDO =
  'id, cliente_id, data, condicao_pagamento, status, total_kg, total_valor, clientes(nome, canal), pedido_itens(sku, qtd_pacotes, preco_unit_aplicado, subtotal)'

export function usePedidos() {
  return useQuery({
    queryKey: ['pedidos'],
    queryFn: async (): Promise<PedidoCompleto[]> => {
      const { data, error } = await supabase
        .from('pedidos')
        .select(SELECT_PEDIDO)
        .order('data', { ascending: false })
      if (error) throw new Error(error.message)
      return (data as unknown as LinhaPedido[]).map((linha) => ({
        id: linha.id,
        clienteId: linha.cliente_id,
        clienteNome: linha.clientes?.nome ?? '(cliente removido)',
        canal: linha.clientes?.canal ?? 'consumidor',
        data: linha.data,
        condicao: linha.condicao_pagamento,
        status: linha.status,
        totalKg: Number(linha.total_kg),
        totalValor: Number(linha.total_valor),
        itens: linha.pedido_itens.map((item) => ({
          sku: item.sku,
          qtdPacotes: item.qtd_pacotes,
          precoUnit: Number(item.preco_unit_aplicado),
          subtotal: Number(item.subtotal),
        })),
      }))
    },
  })
}

export interface NovoPedido {
  clienteId: string
  data: string
  condicao: CondicaoPagamento
  status: StatusPedido
  observacao: string | null
  totalKg: number
  totalValor: number
  itens: ItemPrecificado[]
}

export function useCriarPedido() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (pedido: NovoPedido): Promise<string> => {
      const { data, error } = await supabase.rpc('criar_pedido', {
        p_cliente_id: pedido.clienteId,
        p_data: pedido.data,
        p_condicao: pedido.condicao,
        p_status: pedido.status,
        p_observacao: pedido.observacao,
        p_total_kg: pedido.totalKg,
        p_total_valor: pedido.totalValor,
        p_itens: pedido.itens.map((item) => ({
          sku: item.sku,
          qtd_pacotes: item.qtdPacotes,
          preco_unit_aplicado: item.precoUnit,
          subtotal: item.subtotal,
        })),
      })
      if (error) throw new Error(error.message)
      return data as string
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] })
      queryClient.invalidateQueries({ queryKey: ['consignado'] })
    },
  })
}
```

- [ ] **Step 6: Criar `src/hooks/useConsignado.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MovConsignado } from '@/lib/consignado'
import type { Sku, TipoMovConsignado } from '@/lib/tipos'

interface LinhaMov {
  sku: Sku
  tipo: TipoMovConsignado
  qtd_pacotes: number
  data: string
}

export function useConsignado(clienteId: string | null) {
  return useQuery({
    queryKey: ['consignado', clienteId],
    enabled: clienteId !== null,
    queryFn: async (): Promise<MovConsignado[]> => {
      const { data, error } = await supabase
        .from('consignado_movimentos')
        .select('sku, tipo, qtd_pacotes, data')
        .eq('cliente_id', clienteId!)
        .order('data')
      if (error) throw new Error(error.message)
      return (data as LinhaMov[]).map((linha) => ({
        sku: linha.sku,
        tipo: linha.tipo,
        qtdPacotes: linha.qtd_pacotes,
        data: linha.data,
      }))
    },
  })
}

export interface ApuracaoConsignado {
  clienteId: string
  sku: Sku
  tipo: Extract<TipoMovConsignado, 'venda_apurada' | 'retorno'>
  qtdPacotes: number
  data: string
}

export function useApurarConsignado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (apuracao: ApuracaoConsignado) => {
      const { error } = await supabase.from('consignado_movimentos').insert({
        cliente_id: apuracao.clienteId,
        sku: apuracao.sku,
        tipo: apuracao.tipo,
        qtd_pacotes: apuracao.qtdPacotes,
        data: apuracao.data,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['consignado'] }),
  })
}
```

- [ ] **Step 7: Verificar typecheck**

Run: `npm run typecheck`
Expected: sem saída.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260803130000_rpc_criar_pedido.sql src/hooks/
git commit -m "feat: rpc atomica de pedido e hooks de clientes, precos, pedidos e consignado"
```

---

## Task 9: Tela de clientes

**Files:**
- Create: `src/paginas/Clientes.tsx`
- Modify: `src/App.tsx` (trocar o placeholder de `/clientes`)

**Interfaces:**
- Consumes: `useClientes`, `useSalvarCliente`, `Cliente`, `ClienteInput` de `@/hooks/useClientes` (Task 8); `ROTULO_CANAL`, `ROTULO_CONDICAO`, `Canal`, `CondicaoPagamento` de `@/lib/tipos` (Task 2); `Carregando`, `Erro`, `Vazio` de `@/componentes/Estado` (Task 7)
- Produces: rota `/clientes` funcional; `default export Clientes`

- [ ] **Step 1: Criar `src/paginas/Clientes.tsx`**

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Carregando, Erro, Vazio } from '@/componentes/Estado'
import { useClientes, useSalvarCliente, type Cliente } from '@/hooks/useClientes'
import { ROTULO_CANAL, ROTULO_CONDICAO, type Canal, type CondicaoPagamento } from '@/lib/tipos'

const VAZIO = {
  nome: '',
  canal: 'revenda' as Canal,
  cidade: '',
  whatsapp: '',
  condicaoPadrao: 'avista' as CondicaoPagamento,
  cadenciaDeclaradaDias: '' as string,
  ativo: true,
}

export default function Clientes() {
  const { data: clientes, isLoading, error } = useClientes()
  const salvar = useSalvarCliente()
  const [form, setForm] = useState(VAZIO)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')

  function abrirNovo() {
    setForm(VAZIO)
    setEditandoId(null)
    setAberto(true)
  }

  function abrirEdicao(cliente: Cliente) {
    setForm({
      nome: cliente.nome,
      canal: cliente.canal,
      cidade: cliente.cidade ?? '',
      whatsapp: cliente.whatsapp ?? '',
      condicaoPadrao: cliente.condicaoPadrao,
      cadenciaDeclaradaDias:
        cliente.cadenciaDeclaradaDias === null ? '' : String(cliente.cadenciaDeclaradaDias),
      ativo: cliente.ativo,
    })
    setEditandoId(cliente.id)
    setAberto(true)
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    await salvar.mutateAsync({
      id: editandoId ?? undefined,
      nome: form.nome.trim(),
      canal: form.canal,
      cidade: form.cidade.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      condicaoPadrao: form.condicaoPadrao,
      cadenciaDeclaradaDias: form.cadenciaDeclaradaDias
        ? Number(form.cadenciaDeclaradaDias)
        : null,
      ativo: form.ativo,
    })
    setAberto(false)
  }

  if (isLoading) return <Carregando />
  if (error) return <Erro mensagem={error.message} />

  const filtrados = (clientes ?? []).filter((cliente) =>
    cliente.nome.toLowerCase().includes(busca.toLowerCase()),
  )

  return (
    <div className="p-4">
      <div className="mb-4 flex gap-2">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar cliente"
          className="flex-1 rounded-lg border border-stone-300 px-3 py-2"
        />
        <button
          onClick={abrirNovo}
          className="rounded-lg bg-amber-800 px-4 py-2 font-semibold text-white"
        >
          Novo
        </button>
      </div>

      {aberto && (
        <form onSubmit={enviar} className="mb-4 space-y-3 rounded-xl bg-white p-4 shadow">
          <input
            required
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Nome do cliente"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
          <select
            value={form.canal}
            onChange={(e) => setForm({ ...form, canal: e.target.value as Canal })}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          >
            {Object.entries(ROTULO_CANAL).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              value={form.cidade}
              onChange={(e) => setForm({ ...form, cidade: e.target.value })}
              placeholder="Cidade"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2"
            />
            <input
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              placeholder="WhatsApp"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>
          <select
            value={form.condicaoPadrao}
            onChange={(e) =>
              setForm({ ...form, condicaoPadrao: e.target.value as CondicaoPagamento })
            }
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          >
            {Object.entries(ROTULO_CONDICAO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
          <label className="block text-sm text-stone-600">
            Compra a cada quantos dias? (opcional — some quando o histórico assumir)
            <input
              type="number"
              min={1}
              value={form.cadenciaDeclaradaDias}
              onChange={(e) => setForm({ ...form, cadenciaDeclaradaDias: e.target.value })}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            />
            Cliente ativo
          </label>
          {salvar.error && <p className="text-sm text-red-700">{salvar.error.message}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={salvar.isPending}
              className="flex-1 rounded-lg bg-amber-800 py-3 font-semibold text-white disabled:opacity-50"
            >
              {salvar.isPending ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="rounded-lg border border-stone-300 px-4 py-3"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {filtrados.length === 0 ? (
        <Vazio mensagem="Nenhum cliente cadastrado ainda." />
      ) : (
        <ul className="divide-y divide-stone-200 overflow-hidden rounded-xl bg-white shadow">
          {filtrados.map((cliente) => (
            <li key={cliente.id} className="flex items-center justify-between p-4">
              <div>
                <Link to={`/clientes/${cliente.id}`} className="font-medium underline">
                  {cliente.nome}
                </Link>
                <p className="text-sm text-stone-500">
                  {ROTULO_CANAL[cliente.canal]} · {ROTULO_CONDICAO[cliente.condicaoPadrao]}
                  {cliente.ativo ? '' : ' · inativo'}
                </p>
              </div>
              <button onClick={() => abrirEdicao(cliente)} className="text-sm text-stone-500 underline">
                Editar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Ligar a rota em `src/App.tsx`**

Trocar o import e a rota de `/clientes`:

```tsx
import Clientes from '@/paginas/Clientes'
```

```tsx
<Route path="/clientes" element={<Clientes />} />
```

- [ ] **Step 3: Verificar typecheck e build**

Run: `npm run typecheck`
Expected: sem saída.

Run: `npm run build`
Expected: `✓ built in ...`.

- [ ] **Step 4: Checklist manual**

Run: `npm run dev`, entrar como admin e abrir `/clientes`.

- [ ] Lista vazia mostra "Nenhum cliente cadastrado ainda."
- [ ] "Novo" abre o formulário; salvar cria o cliente e ele aparece na lista sem recarregar a página
- [ ] Os 5 canais aparecem no seletor com rótulo em PT-BR (incluindo Hotel)
- [ ] As 7 condições aparecem, incluindo "30 dias" e "30/60 dias"
- [ ] "Editar" preenche o formulário com os dados atuais e salvar altera a lista
- [ ] Cadência em branco salva como vazio (não como 0)
- [ ] Busca filtra por parte do nome, sem diferenciar maiúscula
- [ ] Em 390 px, campos e botões ficam com pelo menos 44 px de altura de toque

- [ ] **Step 5: Commit**

```bash
git add src/paginas/Clientes.tsx src/App.tsx
git commit -m "feat: tela de clientes com cadastro, edicao e busca"
```

---

## Task 10: Tela de novo pedido

**Files:**
- Create: `src/paginas/NovoPedido.tsx`
- Modify: `src/App.tsx` (rota `/`)

**Interfaces:**
- Consumes: `useClientes` (Task 8); `usePrecos` (Task 8); `useCriarPedido` (Task 8); `precificar`, `kgTotal`, `totalPedido`, `faixaVigente` de `@/lib/preco` (Task 2); `oportunidadeFaixa` de `@/lib/recompra` (Task 4); `vencimentos` de `@/lib/prazo` (Task 3); `hojeIso` de `@/lib/data` (Task 3); `SKUS`, `ROTULO_CONDICAO`, tipos (Task 2); `Carregando`, `Erro` (Task 7)
- Produces: rota `/` funcional; `default export NovoPedido`

**Comportamento esperado:** o preço aparece sozinho conforme o vendedor digita a quantidade. O vendedor pode sobrescrever, e nesse caso a tela avisa que o desconto vai aparecer no painel — transparência em vez de bloqueio (spec §5).

- [ ] **Step 1: Criar `src/paginas/NovoPedido.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { Carregando, Erro } from '@/componentes/Estado'
import { useClientes } from '@/hooks/useClientes'
import { useCriarPedido } from '@/hooks/usePedidos'
import { usePrecos } from '@/hooks/usePrecos'
import { hojeIso } from '@/lib/data'
import { faixaVigente, kgTotal, precificar, totalPedido } from '@/lib/preco'
import { vencimentos } from '@/lib/prazo'
import { oportunidadeFaixa } from '@/lib/recompra'
import { ROTULO_CONDICAO, SKUS, type CondicaoPagamento, type ItemPrecificado, type Sku } from '@/lib/tipos'

const reais = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function NovoPedido() {
  const { data: clientes, isLoading: carregandoClientes, error: erroClientes } = useClientes()
  const { data: faixas, isLoading: carregandoPrecos, error: erroPrecos } = usePrecos()
  const criar = useCriarPedido()

  const [clienteId, setClienteId] = useState('')
  const [data, setData] = useState(hojeIso())
  const [quantidades, setQuantidades] = useState<Record<Sku, string>>({ '250g': '', '500g': '' })
  const [condicao, setCondicao] = useState<CondicaoPagamento | ''>('')
  const [observacao, setObservacao] = useState('')
  const [ajustando, setAjustando] = useState(false)
  const [precosManuais, setPrecosManuais] = useState<Record<Sku, string>>({ '250g': '', '500g': '' })
  const [salvo, setSalvo] = useState<string | null>(null)

  const cliente = (clientes ?? []).find((c) => c.id === clienteId) ?? null
  const condicaoEfetiva: CondicaoPagamento = condicao || cliente?.condicaoPadrao || 'avista'

  const itensInput = SKUS.map((sku) => ({ sku, qtdPacotes: Number(quantidades[sku]) || 0 })).filter(
    (item) => item.qtdPacotes > 0,
  )

  const calculo = useMemo(() => {
    if (!faixas || itensInput.length === 0) return null
    try {
      const daTabela = precificar(itensInput, faixas, data)
      const itens: ItemPrecificado[] = daTabela.map((item) => {
        const manual = Number(precosManuais[item.sku])
        if (!ajustando || !manual || manual <= 0) return item
        return {
          ...item,
          precoUnit: manual,
          subtotal: Math.round(manual * item.qtdPacotes * 100) / 100,
        }
      })
      return { itens, total: totalPedido(itens), tabela: daTabela }
    } catch (e) {
      return { erro: e instanceof Error ? e.message : 'Erro no cálculo' } as const
    }
  }, [faixas, JSON.stringify(itensInput), data, ajustando, JSON.stringify(precosManuais)])

  const kg = kgTotal(itensInput)
  const oportunidade =
    faixas && kg > 0 ? oportunidadeFaixa(faixas, '500g', kg, data) : null

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    if (!calculo || 'erro' in calculo) return
    const id = await criar.mutateAsync({
      clienteId,
      data,
      condicao: condicaoEfetiva,
      status: 'entregue',
      observacao: observacao.trim() || null,
      totalKg: calculo.total.totalKg,
      totalValor: calculo.total.totalValor,
      itens: calculo.itens,
    })
    setSalvo(id)
    setQuantidades({ '250g': '', '500g': '' })
    setPrecosManuais({ '250g': '', '500g': '' })
    setObservacao('')
    setAjustando(false)
  }

  if (carregandoClientes || carregandoPrecos) return <Carregando />
  if (erroClientes) return <Erro mensagem={erroClientes.message} />
  if (erroPrecos) return <Erro mensagem={erroPrecos.message} />

  const ativos = (clientes ?? []).filter((c) => c.ativo)

  return (
    <form onSubmit={enviar} className="space-y-4 p-4">
      <h1 className="text-xl font-bold">Novo pedido</h1>

      <select
        required
        value={clienteId}
        onChange={(e) => {
          setClienteId(e.target.value)
          setCondicao('')
          setSalvo(null)
        }}
        className="w-full rounded-lg border border-stone-300 px-3 py-3"
      >
        <option value="">Selecione o cliente…</option>
        {ativos.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>

      <input
        type="date"
        required
        value={data}
        onChange={(e) => setData(e.target.value)}
        className="w-full rounded-lg border border-stone-300 px-3 py-3"
      />

      <div className="grid grid-cols-2 gap-3">
        {SKUS.map((sku) => (
          <label key={sku} className="text-sm text-stone-600">
            Pacotes de {sku}
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={quantidades[sku]}
              onChange={(e) => setQuantidades({ ...quantidades, [sku]: e.target.value })}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-3 text-lg"
            />
          </label>
        ))}
      </div>

      <div className="rounded-xl bg-white p-4 shadow">
        <p className="text-sm text-stone-500">Volume do pedido</p>
        <p className="text-2xl font-bold">{kg.toLocaleString('pt-BR')} kg</p>

        {calculo && 'erro' in calculo && <p className="mt-2 text-sm text-red-700">{calculo.erro}</p>}

        {calculo && !('erro' in calculo) && (
          <>
            <ul className="mt-3 space-y-1 text-sm">
              {calculo.itens.map((item) => {
                const daTabela = calculo.tabela.find((t) => t.sku === item.sku)
                const alterado = daTabela && daTabela.precoUnit !== item.precoUnit
                return (
                  <li key={item.sku} className="flex justify-between">
                    <span>
                      {item.qtdPacotes} × {item.sku} a {reais(item.precoUnit)}
                      {alterado && (
                        <span className="text-amber-700"> (tabela {reais(daTabela!.precoUnit)})</span>
                      )}
                    </span>
                    <span>{reais(item.subtotal)}</span>
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-2xl font-bold">{reais(calculo.total.totalValor)}</p>
            {vencimentos(data, condicaoEfetiva, calculo.total.totalValor).length > 0 && (
              <p className="text-sm text-stone-500">
                Previsto entrar:{' '}
                {vencimentos(data, condicaoEfetiva, calculo.total.totalValor)
                  .map((v) => `${reais(v.valor)} em ${v.data.split('-').reverse().join('/')}`)
                  .join(' · ')}
              </p>
            )}
          </>
        )}

        {oportunidade && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Faltam {oportunidade.kgFaltando.toLocaleString('pt-BR')} kg para o pacote de 500g cair
            de {reais(oportunidade.precoAtual)} para {reais(oportunidade.precoMelhor)}.
          </p>
        )}
      </div>

      <select
        value={condicaoEfetiva}
        onChange={(e) => setCondicao(e.target.value as CondicaoPagamento)}
        className="w-full rounded-lg border border-stone-300 px-3 py-3"
      >
        {Object.entries(ROTULO_CONDICAO).map(([valor, rotulo]) => (
          <option key={valor} value={valor}>
            {rotulo}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={ajustando} onChange={(e) => setAjustando(e.target.checked)} />
        Ajustar preço manualmente
      </label>

      {ajustando && (
        <div className="space-y-2 rounded-xl bg-amber-50 p-3">
          <p className="text-sm text-amber-900">
            O desconto concedido aparece no painel como preço realizado abaixo da tabela.
          </p>
          {SKUS.map((sku) => (
            <label key={sku} className="block text-sm">
              Preço do {sku}
              <input
                type="number"
                min={0}
                step="0.01"
                value={precosManuais[sku]}
                onChange={(e) => setPrecosManuais({ ...precosManuais, [sku]: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
              />
            </label>
          ))}
        </div>
      )}

      <textarea
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
        placeholder="Observação (opcional)"
        className="w-full rounded-lg border border-stone-300 px-3 py-2"
      />

      {criar.error && <Erro mensagem={criar.error.message} />}
      {salvo && <p className="text-sm font-medium text-green-700">Pedido salvo.</p>}

      <button
        type="submit"
        disabled={!clienteId || itensInput.length === 0 || criar.isPending}
        className="w-full rounded-lg bg-amber-800 py-4 text-lg font-semibold text-white disabled:opacity-50"
      >
        {criar.isPending ? 'Salvando…' : 'Salvar pedido'}
      </button>

      {faixas && faixas.length > 0 && kg > 0 && !faixaVigente(faixas, '250g', kg, data) && (
        <p className="text-sm text-red-700">
          Não há faixa de preço cadastrada para 250g nessa data. Ajuste a tabela de preços.
        </p>
      )}
    </form>
  )
}
```

- [ ] **Step 2: Ligar a rota em `src/App.tsx`**

```tsx
import NovoPedido from '@/paginas/NovoPedido'
```

```tsx
<Route path="/" element={<NovoPedido />} />
```

- [ ] **Step 3: Verificar typecheck e build**

Run: `npm run typecheck`
Expected: sem saída.

Run: `npm run build`
Expected: `✓ built in ...`.

- [ ] **Step 4: Checklist manual**

Run: `npm run dev`, entrar e abrir `/`.

- [ ] Escolher cliente traz a condição padrão dele já selecionada
- [ ] Digitar 8 pacotes de 250g e 20 de 500g mostra **12 kg** e aplica a faixa de 10–50 kg nos dois SKUs
- [ ] Aumentar para passar de 50 kg troca o preço dos dois SKUs sozinho
- [ ] Com 45 kg aparece o aviso de quantos kg faltam para o preço melhor
- [ ] Condição "30/60" mostra duas datas de entrada previstas, metade do valor em cada
- [ ] Condição "Consignado" não mostra previsão de entrada
- [ ] Marcar "Ajustar preço" e baixar o preço mostra o valor de tabela ao lado, em destaque
- [ ] Salvar limpa as quantidades e mostra "Pedido salvo."
- [ ] Salvar com condição consignado cria os movimentos de entrega (conferir na tabela `consignado_movimentos` no dashboard)
- [ ] Botão fica desabilitado sem cliente ou sem nenhuma quantidade
- [ ] Em 390 px, os campos de quantidade são grandes o bastante para digitar com o dedo

- [ ] **Step 5: Commit**

```bash
git add src/paginas/NovoPedido.tsx src/App.tsx
git commit -m "feat: tela de novo pedido com preco automatico por faixa e previsao de entrada"
```

---

## Task 11: Tela da tabela de preços

**Files:**
- Create: `src/paginas/TabelaPrecos.tsx`
- Modify: `src/App.tsx` (rota `/precos`)

**Interfaces:**
- Consumes: `usePrecos`, `useSalvarFaixas`, `NovaFaixa` de `@/hooks/usePrecos` (Task 8); `hojeIso` de `@/lib/data` (Task 3); `SKUS`, `FaixaPreco`, `Sku` (Task 2); `Carregando`, `Erro`, `Vazio` (Task 7)
- Produces: rota `/precos` (só admin); `default export TabelaPrecos`

**Regra:** salvar **insere uma versão nova** com a data escolhida. Nunca faz UPDATE — pedido antigo mantém o preço que teve.

- [ ] **Step 1: Criar `src/paginas/TabelaPrecos.tsx`**

```tsx
import { useState } from 'react'
import { Carregando, Erro, Vazio } from '@/componentes/Estado'
import { useSalvarFaixas, usePrecos, type NovaFaixa } from '@/hooks/usePrecos'
import { hojeIso } from '@/lib/data'
import { SKUS, type FaixaPreco, type Sku } from '@/lib/tipos'

interface LinhaForm {
  sku: Sku
  kgMin: string
  kgMax: string
  precoUnit: string
}

const reais = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Faixas em vigor hoje: para cada (sku, kgMin), a versão mais recente já vigente. */
function vigentesHoje(faixas: FaixaPreco[], hoje: string): FaixaPreco[] {
  const porChave = new Map<string, FaixaPreco>()
  for (const faixa of faixas.filter((f) => f.vigenteDesde <= hoje)) {
    const chave = `${faixa.sku}|${faixa.kgMin}`
    const atual = porChave.get(chave)
    if (!atual || faixa.vigenteDesde > atual.vigenteDesde) porChave.set(chave, faixa)
  }
  return [...porChave.values()].sort(
    (a, b) => a.sku.localeCompare(b.sku) || a.kgMin - b.kgMin,
  )
}

export default function TabelaPrecos() {
  const { data: faixas, isLoading, error } = usePrecos()
  const salvar = useSalvarFaixas()
  const [vigenteDesde, setVigenteDesde] = useState(hojeIso())
  const [linhas, setLinhas] = useState<LinhaForm[]>([])
  const [erroForm, setErroForm] = useState<string | null>(null)

  if (isLoading) return <Carregando />
  if (error) return <Erro mensagem={error.message} />

  const emVigor = vigentesHoje(faixas ?? [], hojeIso())

  function carregarDoAtual() {
    setLinhas(
      emVigor.map((faixa) => ({
        sku: faixa.sku,
        kgMin: String(faixa.kgMin),
        kgMax: faixa.kgMax === null ? '' : String(faixa.kgMax),
        precoUnit: String(faixa.precoUnit),
      })),
    )
  }

  function adicionarLinha() {
    setLinhas([...linhas, { sku: '250g', kgMin: '', kgMax: '', precoUnit: '' }])
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setErroForm(null)
    const novas: NovaFaixa[] = linhas.map((linha) => ({
      sku: linha.sku,
      kgMin: Number(linha.kgMin),
      kgMax: linha.kgMax === '' ? null : Number(linha.kgMax),
      precoUnit: Number(linha.precoUnit),
      vigenteDesde,
    }))

    for (const faixa of novas) {
      if (!Number.isFinite(faixa.kgMin) || faixa.kgMin < 0) {
        setErroForm('Todo piso de faixa precisa ser um número maior ou igual a zero.')
        return
      }
      if (faixa.kgMax !== null && faixa.kgMax <= faixa.kgMin) {
        setErroForm('O teto da faixa tem que ser maior que o piso.')
        return
      }
      if (!Number.isFinite(faixa.precoUnit) || faixa.precoUnit <= 0) {
        setErroForm('Todo preço precisa ser maior que zero.')
        return
      }
    }

    for (const sku of SKUS) {
      const doSku = novas.filter((f) => f.sku === sku)
      if (doSku.length > 0 && !doSku.some((f) => f.kgMax === null)) {
        setErroForm(`Falta a faixa sem teto (o "51+ kg") do ${sku}, senão pedido grande fica sem preço.`)
        return
      }
    }

    await salvar.mutateAsync(novas)
    setLinhas([])
  }

  return (
    <div className="space-y-6 p-4">
      <section>
        <h1 className="text-xl font-bold">Tabela de preços em vigor</h1>
        {emVigor.length === 0 ? (
          <Vazio mensagem="Nenhuma faixa cadastrada." />
        ) : (
          <table className="mt-3 w-full overflow-hidden rounded-xl bg-white text-sm shadow">
            <thead className="bg-stone-100 text-left">
              <tr>
                <th className="p-2">Pacote</th>
                <th className="p-2">Faixa (kg do pedido)</th>
                <th className="p-2">Preço</th>
                <th className="p-2">Desde</th>
              </tr>
            </thead>
            <tbody>
              {emVigor.map((faixa) => (
                <tr key={faixa.id} className="border-t border-stone-200">
                  <td className="p-2">{faixa.sku}</td>
                  <td className="p-2">
                    {faixa.kgMin} – {faixa.kgMax === null ? 'sem teto' : faixa.kgMax}
                  </td>
                  <td className="p-2">{reais(faixa.precoUnit)}</td>
                  <td className="p-2">{faixa.vigenteDesde.split('-').reverse().join('/')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <form onSubmit={enviar} className="space-y-3 rounded-xl bg-white p-4 shadow">
        <h2 className="font-semibold">Nova versão da tabela</h2>
        <p className="text-sm text-stone-500">
          Salvar cria uma versão nova. Os pedidos já lançados continuam com o preço que tiveram.
        </p>

        <label className="block text-sm">
          Vigente a partir de
          <input
            type="date"
            required
            value={vigenteDesde}
            onChange={(e) => setVigenteDesde(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={carregarDoAtual}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          >
            Copiar a tabela atual
          </button>
          <button
            type="button"
            onClick={adicionarLinha}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          >
            + Faixa
          </button>
        </div>

        {linhas.map((linha, indice) => (
          <div key={indice} className="grid grid-cols-4 gap-2">
            <select
              value={linha.sku}
              onChange={(e) => {
                const copia = [...linhas]
                copia[indice] = { ...linha, sku: e.target.value as Sku }
                setLinhas(copia)
              }}
              className="rounded-lg border border-stone-300 px-2 py-2"
            >
              {SKUS.map((sku) => (
                <option key={sku} value={sku}>
                  {sku}
                </option>
              ))}
            </select>
            <input
              placeholder="kg min"
              inputMode="decimal"
              value={linha.kgMin}
              onChange={(e) => {
                const copia = [...linhas]
                copia[indice] = { ...linha, kgMin: e.target.value }
                setLinhas(copia)
              }}
              className="rounded-lg border border-stone-300 px-2 py-2"
            />
            <input
              placeholder="kg max"
              inputMode="decimal"
              value={linha.kgMax}
              onChange={(e) => {
                const copia = [...linhas]
                copia[indice] = { ...linha, kgMax: e.target.value }
                setLinhas(copia)
              }}
              className="rounded-lg border border-stone-300 px-2 py-2"
            />
            <input
              placeholder="preço"
              inputMode="decimal"
              value={linha.precoUnit}
              onChange={(e) => {
                const copia = [...linhas]
                copia[indice] = { ...linha, precoUnit: e.target.value }
                setLinhas(copia)
              }}
              className="rounded-lg border border-stone-300 px-2 py-2"
            />
          </div>
        ))}

        {erroForm && <p className="text-sm text-red-700">{erroForm}</p>}
        {salvar.error && <p className="text-sm text-red-700">{salvar.error.message}</p>}

        <button
          type="submit"
          disabled={linhas.length === 0 || salvar.isPending}
          className="w-full rounded-lg bg-amber-800 py-3 font-semibold text-white disabled:opacity-50"
        >
          {salvar.isPending ? 'Salvando…' : 'Salvar nova versão'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Ligar a rota em `src/App.tsx`**

```tsx
import TabelaPrecos from '@/paginas/TabelaPrecos'
```

```tsx
<Route
  path="/precos"
  element={
    <RotaProtegida soAdmin>
      <TabelaPrecos />
    </RotaProtegida>
  }
/>
```

- [ ] **Step 3: Verificar typecheck e build**

Run: `npm run typecheck`
Expected: sem saída.

Run: `npm run build`
Expected: `✓ built in ...`.

- [ ] **Step 4: Checklist manual**

Run: `npm run dev`, entrar como admin e abrir `/precos`.

- [ ] A tabela em vigor mostra as 6 faixas do seed, ordenadas por pacote e faixa
- [ ] "Copiar a tabela atual" preenche o formulário com os valores atuais
- [ ] Salvar com teto menor que o piso mostra erro e não grava
- [ ] Salvar sem a faixa "sem teto" de um SKU mostra o erro explicando o motivo
- [ ] Salvar uma versão com data de hoje passa a valer: um pedido novo já sai com o preço novo
- [ ] Um pedido lançado antes continua com o valor antigo na lista de pedidos
- [ ] Entrando como vendedor, `/precos` redireciona para `/`

- [ ] **Step 5: Commit**

```bash
git add src/paginas/TabelaPrecos.tsx src/App.tsx
git commit -m "feat: tela de tabela de precos com versionamento por data"
```

---

## Task 12: Métricas de venda e painel — bloco A

**Files:**
- Create: `src/lib/metricas-venda.ts`, `src/paginas/Painel.tsx`, `src/componentes/Cartao.tsx`
- Modify: `src/App.tsx` (rota `/painel`)
- Test: `src/lib/metricas-venda.test.ts`

**Interfaces:**
- Consumes: `arredondar2` (Task 1); `segundaDaSemana`, `diffDias`, `addDias` (Task 3); `faixaVigente` (Task 2); `KG_POR_SKU`, `SKUS`, tipos (Task 2); `usePedidos`, `PedidoCompleto` (Task 8); `usePrecos` (Task 8)
- Produces:
  - `apenasValidos(pedidos: PedidoCompleto[]): PedidoCompleto[]` — tira os cancelados
  - `noPeriodo(pedidos, inicio, fim): PedidoCompleto[]`
  - `resumo(pedidos): { kg, receita, quantidade, ticketMedio, precoMedioKg }`
  - `precoRealizadoVsTabela(pedidos, faixas): { realizadoKg, tabelaKg, descontoPercentual } | null`
  - `mixPorSku(pedidos): { sku: Sku; pacotes: number; kg: number; receita: number }[]`
  - `seriePorSemana(pedidos): { semana: string; kg: number; receita: number }[]`
  - `rankingClientes(pedidos, limite): { clienteId: string; clienteNome: string; kg: number; receita: number }[]`
  - `porCanal(pedidos): { canal: Canal; kg: number; receita: number }[]`
  - `baseDeClientes(pedidos, inicio, fim): { ativos: number; novos: number; perdidos: number }`
  - `<Cartao titulo valor detalhe? />` de `@/componentes/Cartao`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/metricas-venda.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  apenasValidos,
  baseDeClientes,
  mixPorSku,
  noPeriodo,
  porCanal,
  precoRealizadoVsTabela,
  rankingClientes,
  resumo,
  seriePorSemana,
  type PedidoMetrica,
} from './metricas-venda'
import type { FaixaPreco } from './tipos'

const FAIXAS: FaixaPreco[] = [
  { id: 'b2', sku: '500g', kgMin: 10.001, kgMax: 50, precoUnit: 20, vigenteDesde: '2026-01-01' },
]

/** Dois pedidos de 500g: um no preço de tabela, um com desconto. */
const PEDIDOS: PedidoMetrica[] = [
  {
    data: '2026-07-06',
    clienteId: 'c1',
    clienteNome: 'Hotel Praia',
    canal: 'hotel',
    condicao: 'prazo_30',
    status: 'entregue',
    totalKg: 20,
    totalValor: 800,
    itens: [{ sku: '500g', qtdPacotes: 40, precoUnit: 20, subtotal: 800 }],
  },
  {
    data: '2026-07-14',
    clienteId: 'c2',
    clienteNome: 'Mercadinho Sol',
    canal: 'revenda',
    condicao: 'avista',
    status: 'entregue',
    totalKg: 20,
    totalValor: 720,
    itens: [{ sku: '500g', qtdPacotes: 40, precoUnit: 18, subtotal: 720 }],
  },
  {
    data: '2026-07-20',
    clienteId: 'c2',
    clienteNome: 'Mercadinho Sol',
    canal: 'revenda',
    condicao: 'avista',
    status: 'cancelado',
    totalKg: 100,
    totalValor: 9999,
    itens: [{ sku: '500g', qtdPacotes: 200, precoUnit: 50, subtotal: 9999 }],
  },
]

describe('apenasValidos', () => {
  it('tira pedido cancelado de qualquer metrica', () => {
    expect(apenasValidos(PEDIDOS)).toHaveLength(2)
  })
})

describe('noPeriodo', () => {
  it('filtra pelo intervalo inclusivo', () => {
    expect(noPeriodo(apenasValidos(PEDIDOS), '2026-07-10', '2026-07-31')).toHaveLength(1)
  })
})

describe('resumo', () => {
  it('soma kg, receita, ticket medio e preco medio por kg', () => {
    expect(resumo(apenasValidos(PEDIDOS))).toEqual({
      kg: 40,
      receita: 1520,
      quantidade: 2,
      ticketMedio: 760,
      precoMedioKg: 38,
    })
  })

  it('sem pedido nao divide por zero', () => {
    expect(resumo([])).toEqual({
      kg: 0,
      receita: 0,
      quantidade: 0,
      ticketMedio: 0,
      precoMedioKg: 0,
    })
  })
})

describe('precoRealizadoVsTabela', () => {
  it('expoe o desconto medio concedido', () => {
    // tabela: 80 pacotes x R$20 = 1600 em 40 kg = R$40/kg; realizado = R$38/kg
    expect(precoRealizadoVsTabela(apenasValidos(PEDIDOS), FAIXAS)).toEqual({
      realizadoKg: 38,
      tabelaKg: 40,
      descontoPercentual: 5,
    })
  })

  it('devolve null quando nao ha faixa para comparar', () => {
    expect(precoRealizadoVsTabela(apenasValidos(PEDIDOS), [])).toBeNull()
  })
})

describe('mixPorSku', () => {
  it('devolve pacotes, kg e receita por SKU', () => {
    expect(mixPorSku(apenasValidos(PEDIDOS))).toEqual([
      { sku: '250g', pacotes: 0, kg: 0, receita: 0 },
      { sku: '500g', pacotes: 80, kg: 40, receita: 1520 },
    ])
  })
})

describe('seriePorSemana', () => {
  it('agrupa por segunda-feira e ordena', () => {
    expect(seriePorSemana(apenasValidos(PEDIDOS))).toEqual([
      { semana: '2026-07-06', kg: 20, receita: 800 },
      { semana: '2026-07-13', kg: 20, receita: 720 },
    ])
  })
})

describe('rankingClientes', () => {
  it('ordena por receita e respeita o limite', () => {
    const ranking = rankingClientes(apenasValidos(PEDIDOS), 1)
    expect(ranking).toEqual([
      { clienteId: 'c1', clienteNome: 'Hotel Praia', kg: 20, receita: 800 },
    ])
  })
})

describe('porCanal', () => {
  it('soma kg e receita por canal, ordenado por receita', () => {
    expect(porCanal(apenasValidos(PEDIDOS))).toEqual([
      { canal: 'hotel', kg: 20, receita: 800 },
      { canal: 'revenda', kg: 20, receita: 720 },
    ])
  })
})

describe('baseDeClientes', () => {
  const historico: PedidoMetrica[] = [
    { ...PEDIDOS[0], data: '2026-06-10', clienteId: 'antigo', clienteNome: 'Bar Velho' },
    { ...PEDIDOS[0], data: '2026-07-10', clienteId: 'antigo', clienteNome: 'Bar Velho' },
    { ...PEDIDOS[0], data: '2026-07-12', clienteId: 'novo', clienteNome: 'Padaria Nova' },
    { ...PEDIDOS[0], data: '2026-06-15', clienteId: 'sumiu', clienteNome: 'Hotel Sumido' },
  ]

  it('conta ativos, novos e perdidos na janela', () => {
    // janela de 30 dias: 2026-07-01 a 2026-07-30; anterior: 2026-06-01 a 2026-06-30
    expect(baseDeClientes(historico, '2026-07-01', '2026-07-30')).toEqual({
      ativos: 2, // antigo e novo
      novos: 1, // novo (primeiro pedido de todos caiu na janela)
      perdidos: 1, // sumiu (comprou na janela anterior e nao voltou)
    })
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test -- metricas`
Expected: FAIL — `Failed to resolve import "./metricas-venda"`.

- [ ] **Step 3: Implementar `src/lib/metricas-venda.ts`**

```ts
import { addDias, diffDias, segundaDaSemana } from './data'
import { arredondar2 } from './numero'
import { faixaVigente } from './preco'
import {
  KG_POR_SKU,
  SKUS,
  type Canal,
  type CondicaoPagamento,
  type FaixaPreco,
  type ItemPrecificado,
  type Sku,
  type StatusPedido,
} from './tipos'

export interface PedidoMetrica {
  data: string
  clienteId: string
  clienteNome: string
  canal: Canal
  condicao: CondicaoPagamento
  status: StatusPedido
  totalKg: number
  totalValor: number
  itens: ItemPrecificado[]
}

/** Pedido cancelado não entra em métrica nenhuma. */
export function apenasValidos(pedidos: PedidoMetrica[]): PedidoMetrica[] {
  return pedidos.filter((pedido) => pedido.status !== 'cancelado')
}

export function noPeriodo(
  pedidos: PedidoMetrica[],
  inicio: string,
  fim: string,
): PedidoMetrica[] {
  return pedidos.filter((pedido) => pedido.data >= inicio && pedido.data <= fim)
}

export function resumo(pedidos: PedidoMetrica[]): {
  kg: number
  receita: number
  quantidade: number
  ticketMedio: number
  precoMedioKg: number
} {
  const kg = arredondar2(pedidos.reduce((soma, p) => soma + p.totalKg, 0))
  const receita = arredondar2(pedidos.reduce((soma, p) => soma + p.totalValor, 0))
  const quantidade = pedidos.length
  return {
    kg,
    receita,
    quantidade,
    ticketMedio: quantidade === 0 ? 0 : arredondar2(receita / quantidade),
    precoMedioKg: kg === 0 ? 0 : arredondar2(receita / kg),
  }
}

/**
 * Preço realizado vs tabela: expõe o desconto que o vendedor deu de fato.
 * O preço de tabela é reconstruído com a faixa vigente na data de cada pedido.
 */
export function precoRealizadoVsTabela(
  pedidos: PedidoMetrica[],
  faixas: FaixaPreco[],
): { realizadoKg: number; tabelaKg: number; descontoPercentual: number } | null {
  let kg = 0
  let realizado = 0
  let tabela = 0

  for (const pedido of pedidos) {
    for (const item of pedido.itens) {
      const faixa = faixaVigente(faixas, item.sku, pedido.totalKg, pedido.data)
      if (!faixa) continue
      kg += KG_POR_SKU[item.sku] * item.qtdPacotes
      realizado += item.subtotal
      tabela += faixa.precoUnit * item.qtdPacotes
    }
  }

  if (kg === 0 || tabela === 0) return null
  const realizadoKg = arredondar2(realizado / kg)
  const tabelaKg = arredondar2(tabela / kg)
  return {
    realizadoKg,
    tabelaKg,
    descontoPercentual: arredondar2(((tabelaKg - realizadoKg) / tabelaKg) * 100),
  }
}

export function mixPorSku(
  pedidos: PedidoMetrica[],
): { sku: Sku; pacotes: number; kg: number; receita: number }[] {
  return SKUS.map((sku) => {
    const itens = pedidos.flatMap((p) => p.itens.filter((item) => item.sku === sku))
    const pacotes = itens.reduce((soma, item) => soma + item.qtdPacotes, 0)
    return {
      sku,
      pacotes,
      kg: arredondar2(pacotes * KG_POR_SKU[sku]),
      receita: arredondar2(itens.reduce((soma, item) => soma + item.subtotal, 0)),
    }
  })
}

export function seriePorSemana(
  pedidos: PedidoMetrica[],
): { semana: string; kg: number; receita: number }[] {
  const porSemana = new Map<string, { kg: number; receita: number }>()
  for (const pedido of pedidos) {
    const semana = segundaDaSemana(pedido.data)
    const atual = porSemana.get(semana) ?? { kg: 0, receita: 0 }
    porSemana.set(semana, {
      kg: atual.kg + pedido.totalKg,
      receita: atual.receita + pedido.totalValor,
    })
  }
  return [...porSemana.entries()]
    .map(([semana, valores]) => ({
      semana,
      kg: arredondar2(valores.kg),
      receita: arredondar2(valores.receita),
    }))
    .sort((a, b) => a.semana.localeCompare(b.semana))
}

export function rankingClientes(
  pedidos: PedidoMetrica[],
  limite: number,
): { clienteId: string; clienteNome: string; kg: number; receita: number }[] {
  const porCliente = new Map<string, { clienteNome: string; kg: number; receita: number }>()
  for (const pedido of pedidos) {
    const atual = porCliente.get(pedido.clienteId) ?? {
      clienteNome: pedido.clienteNome,
      kg: 0,
      receita: 0,
    }
    porCliente.set(pedido.clienteId, {
      clienteNome: pedido.clienteNome,
      kg: atual.kg + pedido.totalKg,
      receita: atual.receita + pedido.totalValor,
    })
  }
  return [...porCliente.entries()]
    .map(([clienteId, valores]) => ({
      clienteId,
      clienteNome: valores.clienteNome,
      kg: arredondar2(valores.kg),
      receita: arredondar2(valores.receita),
    }))
    .sort((a, b) => b.receita - a.receita)
    .slice(0, limite)
}

export function porCanal(
  pedidos: PedidoMetrica[],
): { canal: Canal; kg: number; receita: number }[] {
  const porCanalMapa = new Map<Canal, { kg: number; receita: number }>()
  for (const pedido of pedidos) {
    const atual = porCanalMapa.get(pedido.canal) ?? { kg: 0, receita: 0 }
    porCanalMapa.set(pedido.canal, {
      kg: atual.kg + pedido.totalKg,
      receita: atual.receita + pedido.totalValor,
    })
  }
  return [...porCanalMapa.entries()]
    .map(([canal, valores]) => ({
      canal,
      kg: arredondar2(valores.kg),
      receita: arredondar2(valores.receita),
    }))
    .sort((a, b) => b.receita - a.receita)
}

/**
 * Base de clientes na janela. "Perdidos" compara com a janela anterior de mesmo tamanho:
 * comprou antes, não comprou agora.
 */
export function baseDeClientes(
  pedidos: PedidoMetrica[],
  inicio: string,
  fim: string,
): { ativos: number; novos: number; perdidos: number } {
  const validos = apenasValidos(pedidos)
  const tamanho = diffDias(inicio, fim)
  const inicioAnterior = addDias(inicio, -(tamanho + 1))
  const fimAnterior = addDias(inicio, -1)

  const naJanela = new Set(noPeriodo(validos, inicio, fim).map((p) => p.clienteId))
  const naAnterior = new Set(
    noPeriodo(validos, inicioAnterior, fimAnterior).map((p) => p.clienteId),
  )

  const primeiraCompra = new Map<string, string>()
  for (const pedido of validos) {
    const atual = primeiraCompra.get(pedido.clienteId)
    if (!atual || pedido.data < atual) primeiraCompra.set(pedido.clienteId, pedido.data)
  }

  let novos = 0
  for (const clienteId of naJanela) {
    const primeira = primeiraCompra.get(clienteId)
    if (primeira && primeira >= inicio && primeira <= fim) novos += 1
  }

  let perdidos = 0
  for (const clienteId of naAnterior) {
    if (!naJanela.has(clienteId)) perdidos += 1
  }

  return { ativos: naJanela.size, novos, perdidos }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test -- metricas`
Expected: PASS — todos os describes.

- [ ] **Step 5: Criar `src/componentes/Cartao.tsx`**

```tsx
export function Cartao({
  titulo,
  valor,
  detalhe,
  alerta = false,
}: {
  titulo: string
  valor: string
  detalhe?: string
  alerta?: boolean
}) {
  return (
    <div className={`rounded-xl p-4 shadow ${alerta ? 'bg-amber-50' : 'bg-white'}`}>
      <p className="text-xs uppercase tracking-wide text-stone-500">{titulo}</p>
      <p className="mt-1 text-2xl font-bold">{valor}</p>
      {detalhe && <p className="mt-1 text-sm text-stone-500">{detalhe}</p>}
    </div>
  )
}
```

- [ ] **Step 6: Criar `src/paginas/Painel.tsx` com o bloco A**

```tsx
import { useMemo, useState } from 'react'
import { Cartao } from '@/componentes/Cartao'
import { Carregando, Erro, Vazio } from '@/componentes/Estado'
import { usePedidos } from '@/hooks/usePedidos'
import { usePrecos } from '@/hooks/usePrecos'
import { addDias, hojeIso } from '@/lib/data'
import {
  apenasValidos,
  baseDeClientes,
  mixPorSku,
  noPeriodo,
  porCanal,
  precoRealizadoVsTabela,
  rankingClientes,
  resumo,
  seriePorSemana,
} from '@/lib/metricas-venda'
import { ROTULO_CANAL } from '@/lib/tipos'

const reais = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const kgTexto = (valor: number) => `${valor.toLocaleString('pt-BR')} kg`
const dataCurta = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7)

const JANELAS = [
  { dias: 30, rotulo: '30 dias' },
  { dias: 90, rotulo: '90 dias' },
  { dias: 365, rotulo: '12 meses' },
]

export default function Painel() {
  const { data: pedidos, isLoading, error } = usePedidos()
  const { data: faixas } = usePrecos()
  const [dias, setDias] = useState(30)

  const hoje = hojeIso()
  const inicio = addDias(hoje, -(dias - 1))

  const dados = useMemo(() => {
    const validos = apenasValidos(pedidos ?? [])
    const janela = noPeriodo(validos, inicio, hoje)
    return {
      validos,
      janela,
      resumo: resumo(janela),
      preco: faixas ? precoRealizadoVsTabela(janela, faixas) : null,
      mix: mixPorSku(janela),
      serie: seriePorSemana(janela),
      ranking: rankingClientes(janela, 5),
      canais: porCanal(janela),
      base: baseDeClientes(validos, inicio, hoje),
    }
  }, [pedidos, faixas, inicio, hoje])

  if (isLoading) return <Carregando />
  if (error) return <Erro mensagem={error.message} />
  if ((pedidos ?? []).length === 0)
    return <Vazio mensagem="Nenhum pedido lançado ainda — o painel acende no primeiro pedido." />

  const { resumo: r, preco, mix, serie, ranking, canais, base } = dados
  const maiorReceitaSemana = Math.max(1, ...serie.map((s) => s.receita))

  return (
    <div className="space-y-6 p-4">
      <div className="flex gap-2">
        {JANELAS.map((janela) => (
          <button
            key={janela.dias}
            onClick={() => setDias(janela.dias)}
            className={`rounded-full px-4 py-1 text-sm ${
              dias === janela.dias ? 'bg-amber-800 text-white' : 'bg-white text-stone-600'
            }`}
          >
            {janela.rotulo}
          </button>
        ))}
      </div>

      <section>
        <h2 className="mb-2 font-semibold">Venda</h2>
        <div className="grid grid-cols-2 gap-3">
          <Cartao titulo="Volume" valor={kgTexto(r.kg)} detalhe={`${r.quantidade} pedidos`} />
          <Cartao titulo="Receita" valor={reais(r.receita)} />
          <Cartao titulo="Ticket médio" valor={reais(r.ticketMedio)} />
          <Cartao
            titulo="Preço médio"
            valor={`${reais(r.precoMedioKg)}/kg`}
            detalhe={
              preco
                ? preco.descontoPercentual > 0
                  ? `${preco.descontoPercentual}% abaixo da tabela`
                  : 'no preço de tabela'
                : undefined
            }
            alerta={!!preco && preco.descontoPercentual >= 5}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Mix de pacote</h2>
        <div className="grid grid-cols-2 gap-3">
          {mix.map((item) => (
            <Cartao
              key={item.sku}
              titulo={item.sku}
              valor={kgTexto(item.kg)}
              detalhe={`${item.pacotes} pacotes · ${reais(item.receita)}`}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Evolução semanal</h2>
        {serie.length === 0 ? (
          <Vazio mensagem="Sem pedido nessa janela." />
        ) : (
          <ul className="space-y-2 rounded-xl bg-white p-4 shadow">
            {serie.map((semana) => (
              <li key={semana.semana}>
                <div className="flex justify-between text-sm">
                  <span>{dataCurta(semana.semana)}</span>
                  <span>
                    {kgTexto(semana.kg)} · {reais(semana.receita)}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded bg-stone-100">
                  <div
                    className="h-2 rounded bg-amber-700"
                    style={{ width: `${(semana.receita / maiorReceitaSemana) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Top 5 clientes</h2>
        <ul className="divide-y divide-stone-200 rounded-xl bg-white shadow">
          {ranking.map((cliente) => (
            <li key={cliente.clienteId} className="flex justify-between p-3 text-sm">
              <span>{cliente.clienteNome}</span>
              <span>
                {kgTexto(cliente.kg)} · {reais(cliente.receita)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Por canal</h2>
        <ul className="divide-y divide-stone-200 rounded-xl bg-white shadow">
          {canais.map((canal) => (
            <li key={canal.canal} className="flex justify-between p-3 text-sm">
              <span>{ROTULO_CANAL[canal.canal]}</span>
              <span>
                {kgTexto(canal.kg)} · {reais(canal.receita)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Base de clientes</h2>
        <div className="grid grid-cols-3 gap-3">
          <Cartao titulo="Ativos" valor={String(base.ativos)} />
          <Cartao titulo="Novos" valor={String(base.novos)} />
          <Cartao titulo="Perdidos" valor={String(base.perdidos)} alerta={base.perdidos > 0} />
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 7: Ligar a rota em `src/App.tsx`**

```tsx
import Painel from '@/paginas/Painel'
```

```tsx
<Route path="/painel" element={<Painel />} />
```

- [ ] **Step 8: Verificar typecheck e build**

Run: `npm run typecheck`
Expected: sem saída.

Run: `npm run build`
Expected: `✓ built in ...`.

- [ ] **Step 9: Checklist manual**

Lançar pelo menos 3 pedidos em datas diferentes (um com preço ajustado para baixo) e abrir `/painel`.

- [ ] Sem nenhum pedido, a tela mostra "o painel acende no primeiro pedido"
- [ ] Volume, receita e ticket médio batem com a soma manual dos pedidos
- [ ] Preço médio mostra "% abaixo da tabela" quando houve desconto, e o cartão fica destacado a partir de 5%
- [ ] Mix mostra 250g e 500g separados, com pacotes e kg coerentes
- [ ] Evolução semanal agrupa por semana e a barra maior é a semana de maior receita
- [ ] Trocar a janela (30/90/365) muda os números
- [ ] Um pedido marcado como cancelado no banco desaparece de todos os números

- [ ] **Step 10: Commit**

```bash
git add src/lib/metricas-venda.ts src/lib/metricas-venda.test.ts src/componentes/Cartao.tsx src/paginas/Painel.tsx src/App.tsx
git commit -m "feat: metricas de venda e painel bloco A"
```

---

## Task 13: Painel — bloco B (prazo e caixa)

**Files:**
- Create: `src/componentes/BlocoPrazo.tsx`
- Modify: `src/paginas/Painel.tsx` (renderizar o bloco)

**Interfaces:**
- Consumes: `prazoMedioPonderado`, `caixaPrevistoPorSemana`, `prazoMedioDias`, `PedidoPrazo` de `@/lib/prazo` (Task 3); `arredondar2` (Task 1); `ROTULO_CONDICAO` (Task 2); `PedidoMetrica` de `@/lib/metricas-venda` (Task 12); `Cartao` (Task 12); `Vazio` (Task 7)
- Produces: `<BlocoPrazo pedidos={PedidoMetrica[]} />`

**Recado que a tela precisa passar:** isto é **previsto pela condição**, não realizado. Quem baixa pagamento é o ERP.

- [ ] **Step 1: Criar `src/componentes/BlocoPrazo.tsx`**

```tsx
import { Cartao } from './Cartao'
import { Vazio } from './Estado'
import type { PedidoMetrica } from '@/lib/metricas-venda'
import { arredondar2 } from '@/lib/numero'
import { caixaPrevistoPorSemana, prazoMedioDias, prazoMedioPonderado } from '@/lib/prazo'
import { ROTULO_CONDICAO, type CondicaoPagamento } from '@/lib/tipos'

const reais = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export function BlocoPrazo({ pedidos }: { pedidos: PedidoMetrica[] }) {
  const paraPrazo = pedidos.map((pedido) => ({
    data: pedido.data,
    condicao: pedido.condicao,
    totalValor: pedido.totalValor,
  }))

  const prazoMedio = prazoMedioPonderado(paraPrazo)
  const caixa = caixaPrevistoPorSemana(paraPrazo)
  const receita = arredondar2(pedidos.reduce((soma, p) => soma + p.totalValor, 0))

  const porCondicao = new Map<CondicaoPagamento, number>()
  for (const pedido of pedidos) {
    porCondicao.set(pedido.condicao, (porCondicao.get(pedido.condicao) ?? 0) + pedido.totalValor)
  }
  const condicoes = [...porCondicao.entries()]
    .map(([condicao, valor]) => ({
      condicao,
      valor: arredondar2(valor),
      percentual: receita === 0 ? 0 : arredondar2((valor / receita) * 100),
    }))
    .sort((a, b) => b.valor - a.valor)

  const porCliente = new Map<string, { nome: string; valor: number; ponderado: number }>()
  for (const pedido of pedidos) {
    const prazo = prazoMedioDias(pedido.condicao)
    if (prazo === null) continue
    const atual = porCliente.get(pedido.clienteId) ?? {
      nome: pedido.clienteNome,
      valor: 0,
      ponderado: 0,
    }
    porCliente.set(pedido.clienteId, {
      nome: pedido.clienteNome,
      valor: atual.valor + pedido.totalValor,
      ponderado: atual.ponderado + pedido.totalValor * prazo,
    })
  }
  const prazoPorCliente = [...porCliente.values()]
    .map((cliente) => ({
      nome: cliente.nome,
      dias: cliente.valor === 0 ? 0 : arredondar2(cliente.ponderado / cliente.valor),
      valor: arredondar2(cliente.valor),
    }))
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 5)

  const maiorSemana = Math.max(1, ...caixa.map((semana) => semana.valor))

  return (
    <section className="space-y-4">
      <div>
        <h2 className="mb-1 font-semibold">Prazo e caixa</h2>
        <p className="text-sm text-stone-500">
          Previsto pela condição de pagamento. A cobrança e a baixa ficam no ERP que emite a NF.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Cartao
          titulo="Prazo médio"
          valor={prazoMedio === null ? '—' : `${prazoMedio} dias`}
          detalhe="ponderado por R$"
        />
        <Cartao
          titulo="Consignado"
          valor={`${condicoes.find((c) => c.condicao === 'consignado')?.percentual ?? 0}%`}
          detalhe="da receita — fora da previsão de caixa"
        />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-stone-600">Venda por condição</h3>
        <ul className="divide-y divide-stone-200 rounded-xl bg-white shadow">
          {condicoes.map((item) => (
            <li key={item.condicao} className="flex justify-between p-3 text-sm">
              <span>{ROTULO_CONDICAO[item.condicao]}</span>
              <span>
                {item.percentual}% · {reais(item.valor)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-stone-600">Entrada prevista por semana</h3>
        {caixa.length === 0 ? (
          <Vazio mensagem="Nada previsto — só consignado nessa janela." />
        ) : (
          <ul className="space-y-2 rounded-xl bg-white p-4 shadow">
            {caixa.map((semana) => (
              <li key={semana.semana}>
                <div className="flex justify-between text-sm">
                  <span>{dataCurta(semana.semana)}</span>
                  <span>{reais(semana.valor)}</span>
                </div>
                <div className="mt-1 h-2 rounded bg-stone-100">
                  <div
                    className="h-2 rounded bg-emerald-700"
                    style={{ width: `${(semana.valor / maiorSemana) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-stone-600">
          Quem paga mais devagar (top 5)
        </h3>
        {prazoPorCliente.length === 0 ? (
          <Vazio mensagem="Sem venda a prazo nessa janela." />
        ) : (
          <ul className="divide-y divide-stone-200 rounded-xl bg-white shadow">
            {prazoPorCliente.map((cliente) => (
              <li key={cliente.nome} className="flex justify-between p-3 text-sm">
                <span>{cliente.nome}</span>
                <span>
                  {cliente.dias} dias · {reais(cliente.valor)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Renderizar o bloco em `src/paginas/Painel.tsx`**

Adicionar o import:

```tsx
import { BlocoPrazo } from '@/componentes/BlocoPrazo'
```

E inserir depois da seção "Por canal", antes de "Base de clientes":

```tsx
<BlocoPrazo pedidos={dados.janela} />
```

- [ ] **Step 3: Verificar typecheck e build**

Run: `npm run typecheck`
Expected: sem saída.

Run: `npm run build`
Expected: `✓ built in ...`.

- [ ] **Step 4: Checklist manual**

Lançar pedidos em condições diferentes (um à vista, um 30/60, um consignado) e abrir `/painel`.

- [ ] O texto explica que é previsto pela condição, e que cobrança fica no ERP
- [ ] Prazo médio ponderado sobe quando o pedido grande é a prazo (não é média simples de pedidos)
- [ ] "Venda por condição" mostra 30/60 e consignado com rótulo em PT-BR
- [ ] Entrada prevista mostra o 30/60 dividido em duas semanas, metade em cada
- [ ] O pedido consignado **não** aparece na entrada prevista
- [ ] "Quem paga mais devagar" ordena do maior prazo para o menor
- [ ] Só com pedidos consignados, a entrada prevista mostra o estado vazio explicando o motivo

- [ ] **Step 5: Commit**

```bash
git add src/componentes/BlocoPrazo.tsx src/paginas/Painel.tsx
git commit -m "feat: painel bloco B com prazo medio ponderado e caixa previsto"
```

---

## Task 14: Painel — bloco C (insight de revenda) e ficha do cliente

**Files:**
- Create: `src/lib/insights.ts`, `src/componentes/BlocoInsight.tsx`, `src/paginas/FichaCliente.tsx`
- Modify: `src/paginas/Painel.tsx`, `src/App.tsx` (rota `/clientes/:id`)
- Test: `src/lib/insights.test.ts`

**Interfaces:**
- Consumes: `prever`, `sinais`, `oportunidadeFaixa`, `PrevisaoRecompra`, `Sinal` de `@/lib/recompra` (Task 4); `saldoKg`, `diasParado`, `previsaoReposicao`, `saldoPorSku`, `MovConsignado` de `@/lib/consignado` (Task 5); `PedidoMetrica`, `apenasValidos` de `@/lib/metricas-venda` (Task 12); `useClientes` (Task 8); `usePedidos` (Task 8); `usePrecos` (Task 8); `useConsignado` (Task 8); `Cartao` (Task 12); `Carregando`, `Erro`, `Vazio` (Task 7)
- Produces:
  - `LinhaCliente { clienteId, clienteNome, previsao: PrevisaoRecompra, sinais: Sinal[], kgUltimo: number, ultimaCompra: string }`
  - `porCliente(pedidos: PedidoMetrica[], cadencias: Record<string, number | null>, hoje: string): LinhaCliente[]`
  - `<BlocoInsight linhas={LinhaCliente[]} />`
  - `default export FichaCliente`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/insights.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { porCliente } from './insights'
import type { PedidoMetrica } from './metricas-venda'

function pedido(clienteId: string, data: string, totalKg: number): PedidoMetrica {
  return {
    data,
    clienteId,
    clienteNome: clienteId === 'c1' ? 'Hotel Praia' : 'Mercadinho Sol',
    canal: 'hotel',
    condicao: 'avista',
    status: 'entregue',
    totalKg,
    totalValor: totalKg * 40,
    itens: [{ sku: '500g', qtdPacotes: totalKg * 2, precoUnit: 20, subtotal: totalKg * 40 }],
  }
}

describe('porCliente', () => {
  const pedidos: PedidoMetrica[] = [
    pedido('c1', '2026-07-04', 20),
    pedido('c1', '2026-07-14', 20),
    pedido('c1', '2026-07-24', 20),
    pedido('c2', '2026-07-20', 10),
  ]

  it('devolve uma linha por cliente com previsao e sinais', () => {
    const linhas = porCliente(pedidos, {}, '2026-08-01')
    const c1 = linhas.find((linha) => linha.clienteId === 'c1')!
    expect(c1.previsao.cadenciaDias).toBe(10)
    expect(c1.previsao.proximaCompraPrevista).toBe('2026-08-03')
    expect(c1.sinais).toContain('na_hora')
    expect(c1.ultimaCompra).toBe('2026-07-24')
    expect(c1.kgUltimo).toBe(20)
  })

  it('cliente com um pedido so fica marcado como novo', () => {
    const c2 = porCliente(pedidos, {}, '2026-08-01').find((linha) => linha.clienteId === 'c2')!
    expect(c2.sinais).toEqual(['novo'])
  })

  it('usa a cadencia declarada quando o cliente ainda nao tem historico', () => {
    const c2 = porCliente(pedidos, { c2: 15 }, '2026-08-01').find(
      (linha) => linha.clienteId === 'c2',
    )!
    expect(c2.previsao.origemCadencia).toBe('declarada')
    expect(c2.previsao.proximaCompraPrevista).toBe('2026-08-04')
  })

  it('ordena pelos mais atrasados primeiro', () => {
    const linhas = porCliente(pedidos, {}, '2026-08-20')
    expect(linhas[0].clienteId).toBe('c1') // 27 dias sem comprar, cadencia 10
  })

  it('ignora pedido cancelado', () => {
    const comCancelado: PedidoMetrica[] = [
      ...pedidos,
      { ...pedido('c1', '2026-08-15', 500), status: 'cancelado' },
    ]
    const c1 = porCliente(comCancelado, {}, '2026-08-01').find((l) => l.clienteId === 'c1')!
    expect(c1.ultimaCompra).toBe('2026-07-24')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test -- insights`
Expected: FAIL — `Failed to resolve import "./insights"`.

- [ ] **Step 3: Implementar `src/lib/insights.ts`**

```ts
import { apenasValidos, type PedidoMetrica } from './metricas-venda'
import { prever, sinais, type PrevisaoRecompra, type Sinal } from './recompra'

export interface LinhaCliente {
  clienteId: string
  clienteNome: string
  previsao: PrevisaoRecompra
  sinais: Sinal[]
  kgUltimo: number
  ultimaCompra: string
}

/**
 * Uma linha por cliente com previsão de recompra e sinais, ordenada pelos
 * mais atrasados primeiro — é a fila de ligação do vendedor.
 */
export function porCliente(
  pedidos: PedidoMetrica[],
  cadenciasDeclaradas: Record<string, number | null>,
  hoje: string,
): LinhaCliente[] {
  const agrupado = new Map<string, PedidoMetrica[]>()
  for (const pedido of apenasValidos(pedidos)) {
    const lista = agrupado.get(pedido.clienteId) ?? []
    lista.push(pedido)
    agrupado.set(pedido.clienteId, lista)
  }

  const linhas: LinhaCliente[] = []
  for (const [clienteId, doCliente] of agrupado) {
    const ordenado = [...doCliente].sort((a, b) => a.data.localeCompare(b.data))
    const historico = ordenado.map((pedido) => ({ data: pedido.data, totalKg: pedido.totalKg }))
    const previsao = prever(historico, cadenciasDeclaradas[clienteId] ?? null, hoje)
    const ultimo = ordenado[ordenado.length - 1]
    linhas.push({
      clienteId,
      clienteNome: ultimo.clienteNome,
      previsao,
      sinais: sinais(historico, previsao, hoje),
      kgUltimo: ultimo.totalKg,
      ultimaCompra: ultimo.data,
    })
  }

  return linhas.sort((a, b) => (b.previsao.atrasoDias ?? -9999) - (a.previsao.atrasoDias ?? -9999))
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test -- insights`
Expected: PASS.

- [ ] **Step 5: Criar `src/componentes/BlocoInsight.tsx`**

```tsx
import { Vazio } from './Estado'
import type { LinhaCliente } from '@/lib/insights'
import type { Sinal } from '@/lib/recompra'

const ROTULO_SINAL: Record<Sinal, { texto: string; classe: string }> = {
  na_hora: { texto: 'Na hora de recomprar', classe: 'bg-amber-100 text-amber-900' },
  em_risco: { texto: 'Em risco', classe: 'bg-red-100 text-red-900' },
  caindo: { texto: 'Caindo', classe: 'bg-orange-100 text-orange-900' },
  novo: { texto: 'Novo — acompanhar', classe: 'bg-stone-100 text-stone-700' },
  ok: { texto: 'Em dia', classe: 'bg-emerald-100 text-emerald-900' },
}

const ROTULO_CONFIANCA: Record<LinhaCliente['previsao']['confianca'], string> = {
  sem_historico: 'sem histórico',
  baixa: 'confiança baixa',
  media: 'confiança média',
  alta: 'confiança alta',
}

const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export function BlocoInsight({ linhas }: { linhas: LinhaCliente[] }) {
  const prioritarias = linhas.filter(
    (linha) => !linha.sinais.includes('ok') && !linha.sinais.includes('novo'),
  )
  const novos = linhas.filter((linha) => linha.sinais.includes('novo'))

  return (
    <section className="space-y-3">
      <div>
        <h2 className="mb-1 font-semibold">Quem ligar agora</h2>
        <p className="text-sm text-stone-500">
          Ordenado pelos mais atrasados. A previsão vem do histórico de pedidos.
        </p>
      </div>

      {prioritarias.length === 0 ? (
        <Vazio mensagem="Ninguém atrasado — todos dentro da cadência." />
      ) : (
        <ul className="divide-y divide-stone-200 rounded-xl bg-white shadow">
          {prioritarias.map((linha) => (
            <li key={linha.clienteId} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{linha.clienteNome}</p>
                  <p className="text-sm text-stone-500">
                    Última compra {dataCurta(linha.ultimaCompra)} ·{' '}
                    {linha.kgUltimo.toLocaleString('pt-BR')} kg
                    {linha.previsao.cadenciaDias !== null &&
                      ` · a cada ${linha.previsao.cadenciaDias} dias`}
                  </p>
                  <p className="text-xs text-stone-400">
                    {ROTULO_CONFIANCA[linha.previsao.confianca]}
                    {linha.previsao.origemCadencia === 'declarada' && ' · cadência informada'}
                    {linha.previsao.qtdSugeridaKg !== null &&
                      ` · sugerir ${linha.previsao.qtdSugeridaKg.toLocaleString('pt-BR')} kg`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {linha.sinais.map((sinal) => (
                    <span
                      key={sinal}
                      className={`rounded-full px-2 py-0.5 text-xs ${ROTULO_SINAL[sinal].classe}`}
                    >
                      {ROTULO_SINAL[sinal].texto}
                    </span>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {novos.length > 0 && (
        <p className="text-sm text-stone-500">
          {novos.length} cliente(s) sem histórico suficiente para prever:{' '}
          {novos.map((linha) => linha.clienteNome).join(', ')}.
        </p>
      )}
    </section>
  )
}
```

- [ ] **Step 6: Renderizar o bloco em `src/paginas/Painel.tsx`**

Adicionar os imports:

```tsx
import { BlocoInsight } from '@/componentes/BlocoInsight'
import { useClientes } from '@/hooks/useClientes'
import { porCliente } from '@/lib/insights'
```

Dentro do componente, depois de `const { data: faixas } = usePrecos()`:

```tsx
const { data: clientes } = useClientes()

const cadencias = useMemo(
  () =>
    Object.fromEntries(
      (clientes ?? []).map((cliente) => [cliente.id, cliente.cadenciaDeclaradaDias]),
    ),
  [clientes],
)

const linhasInsight = useMemo(
  () => porCliente(dados.validos, cadencias, hoje),
  [dados.validos, cadencias, hoje],
)
```

E renderizar como **primeira** seção do painel (é o que move venda):

```tsx
<BlocoInsight linhas={linhasInsight} />
```

- [ ] **Step 7: Criar `src/paginas/FichaCliente.tsx`**

```tsx
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Cartao } from '@/componentes/Cartao'
import { Carregando, Erro, Vazio } from '@/componentes/Estado'
import { useClientes } from '@/hooks/useClientes'
import { useConsignado } from '@/hooks/useConsignado'
import { usePedidos } from '@/hooks/usePedidos'
import { usePrecos } from '@/hooks/usePrecos'
import { hojeIso } from '@/lib/data'
import { diasParado, previsaoReposicao, saldoKg, saldoPorSku } from '@/lib/consignado'
import { porCliente } from '@/lib/insights'
import { oportunidadeFaixa } from '@/lib/recompra'
import { prazoMedioPonderado } from '@/lib/prazo'
import { ROTULO_CANAL, ROTULO_CONDICAO, SKUS } from '@/lib/tipos'

const reais = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataCurta = (iso: string) => iso.split('-').reverse().join('/')

export default function FichaCliente() {
  const { id = '' } = useParams()
  const { data: clientes, isLoading: carregandoClientes, error } = useClientes()
  const { data: pedidos, isLoading: carregandoPedidos } = usePedidos()
  const { data: faixas } = usePrecos()
  const { data: movimentos } = useConsignado(id || null)

  const hoje = hojeIso()
  const cliente = (clientes ?? []).find((c) => c.id === id) ?? null

  // filtra direto de PedidoCompleto (mantém o `id`, usado na lista de histórico)
  const doCliente = useMemo(
    () =>
      (pedidos ?? []).filter((pedido) => pedido.clienteId === id && pedido.status !== 'cancelado'),
    [pedidos, id],
  )

  if (carregandoClientes || carregandoPedidos) return <Carregando />
  if (error) return <Erro mensagem={error.message} />
  if (!cliente) return <Erro mensagem="Cliente não encontrado." />

  const linha = porCliente(doCliente, { [id]: cliente.cadenciaDeclaradaDias }, hoje)[0] ?? null
  const kgTipico = linha?.previsao.qtdSugeridaKg ?? 0
  const oportunidade =
    faixas && kgTipico > 0 ? oportunidadeFaixa(faixas, '500g', kgTipico, hoje) : null
  const prazoMedio = prazoMedioPonderado(
    doCliente.map((pedido) => ({
      data: pedido.data,
      condicao: pedido.condicao,
      totalValor: pedido.totalValor,
    })),
  )
  const movs = movimentos ?? []
  const saldo = saldoPorSku(movs)
  const temConsignado = SKUS.some((sku) => saldo[sku] !== 0)

  return (
    <div className="space-y-6 p-4">
      <div>
        <Link to="/clientes" className="text-sm text-stone-500 underline">
          ← Clientes
        </Link>
        <h1 className="mt-1 text-xl font-bold">{cliente.nome}</h1>
        <p className="text-sm text-stone-500">
          {ROTULO_CANAL[cliente.canal]} · {ROTULO_CONDICAO[cliente.condicaoPadrao]}
          {cliente.cidade ? ` · ${cliente.cidade}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Cartao
          titulo="Cadência"
          valor={linha?.previsao.cadenciaDias === null || !linha ? '—' : `${linha.previsao.cadenciaDias} dias`}
          detalhe={linha?.previsao.origemCadencia === 'declarada' ? 'informada' : 'calculada'}
        />
        <Cartao
          titulo="Próxima compra"
          valor={
            linha?.previsao.proximaCompraPrevista
              ? dataCurta(linha.previsao.proximaCompraPrevista)
              : '—'
          }
          detalhe={
            linha && linha.previsao.atrasoDias !== null && linha.previsao.atrasoDias > 0
              ? `${linha.previsao.atrasoDias} dias de atraso`
              : undefined
          }
          alerta={!!linha && (linha.previsao.atrasoDias ?? -1) > 0}
        />
        <Cartao
          titulo="Sugerir"
          valor={
            linha?.previsao.qtdSugeridaKg === null || !linha
              ? '—'
              : `${linha.previsao.qtdSugeridaKg.toLocaleString('pt-BR')} kg`
          }
        />
        <Cartao
          titulo="Prazo médio"
          valor={prazoMedio === null ? '—' : `${prazoMedio} dias`}
          detalhe="ponderado por R$"
        />
      </div>

      {oportunidade && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          Argumento de venda: com {oportunidade.kgFaltando.toLocaleString('pt-BR')} kg a mais, o
          pacote de 500g cai de {reais(oportunidade.precoAtual)} para{' '}
          {reais(oportunidade.precoMelhor)} — {reais(oportunidade.economiaPorPacote)} por pacote.
        </p>
      )}

      {temConsignado && (
        <section>
          <h2 className="mb-2 font-semibold">Consignado</h2>
          <div className="grid grid-cols-2 gap-3">
            <Cartao titulo="Saldo no cliente" valor={`${saldoKg(movs).toLocaleString('pt-BR')} kg`} />
            <Cartao
              titulo="Parado há"
              valor={diasParado(movs, hoje) === null ? '—' : `${diasParado(movs, hoje)} dias`}
              alerta={(diasParado(movs, hoje) ?? 0) > 30}
            />
            <Cartao
              titulo="Acaba em"
              valor={previsaoReposicao(movs, hoje) ? dataCurta(previsaoReposicao(movs, hoje)!) : '—'}
              detalhe="no ritmo apurado"
            />
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Histórico de pedidos</h2>
        {doCliente.length === 0 ? (
          <Vazio mensagem="Esse cliente ainda não comprou." />
        ) : (
          <ul className="divide-y divide-stone-200 rounded-xl bg-white shadow">
            {[...doCliente]
              .sort((a, b) => b.data.localeCompare(a.data))
              .map((pedido) => (
                <li key={pedido.id} className="flex justify-between p-3 text-sm">
                  <span>
                    {dataCurta(pedido.data)} · {ROTULO_CONDICAO[pedido.condicao]}
                  </span>
                  <span>
                    {pedido.totalKg.toLocaleString('pt-BR')} kg · {reais(pedido.totalValor)}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 8: Ligar a rota em `src/App.tsx`**

```tsx
import FichaCliente from '@/paginas/FichaCliente'
```

```tsx
<Route path="/clientes/:id" element={<FichaCliente />} />
```

- [ ] **Step 9: Rodar a suíte, typecheck e build**

Run: `npm run test`
Expected: PASS — `numero`, `preco`, `data`, `prazo`, `recompra`, `consignado`, `metricas-venda`, `insights`.

Run: `npm run typecheck`
Expected: sem saída.

Run: `npm run build`
Expected: `✓ built in ...`.

- [ ] **Step 10: Checklist manual**

- [ ] No painel, "Quem ligar agora" é a primeira seção
- [ ] Um cliente com 3 pedidos a cada 10 dias, com o último há 16 dias, aparece como "Em risco"
- [ ] Um cliente cujo último pedido caiu para menos de 70% da média aparece como "Caindo"
- [ ] Cliente com 1 pedido só não entra na fila e aparece na linha de "sem histórico suficiente"
- [ ] O selo de confiança aparece em cada linha (baixa / média / alta)
- [ ] Clicar no nome do cliente em `/clientes` abre a ficha
- [ ] A ficha mostra cadência, próxima compra, sugestão de kg e prazo médio
- [ ] Cliente com atraso mostra "N dias de atraso" com o cartão destacado
- [ ] Cliente com saldo consignado mostra saldo em kg, dias parado e data prevista de acabar
- [ ] Cliente sem consignado não mostra a seção de consignado
- [ ] O histórico lista do pedido mais novo para o mais antigo

- [ ] **Step 11: Commit**

```bash
git add src/lib/insights.ts src/lib/insights.test.ts src/componentes/BlocoInsight.tsx src/paginas/FichaCliente.tsx src/paginas/Painel.tsx src/App.tsx
git commit -m "feat: painel bloco C com fila de recompra e ficha do cliente"
```

---

## Cobertura do spec

| Requisito do spec | Task |
|---|---|
| §3 stack e arquitetura standalone | 1, 7 |
| §4 `clientes` | 6, 9 |
| §4 `precos_faixa` versionada | 6, 11 |
| §4 `pedidos` / `pedido_itens` com preço congelado | 6, 8, 10 |
| §4 `consignado_movimentos` como livro de movimento | 6, 8, 14 |
| §5 faixa pelo kg total, override com transparência | 2, 10 |
| §6 bloco A (venda) | 12 |
| §6 bloco B (prazo e caixa, sem cobrança) | 3, 13 |
| §6 bloco C (insight de revenda) | 4, 14 |
| §7 previsão por cadência com selo de confiança | 4, 14 |
| §7 consignado por saldo ÷ ritmo | 5, 14 |
| §8 as 4 telas | 9, 10, 11, 12 + ficha em 14 |
| §9 auth, 2 papéis, RLS sem `USING (true)` | 6, 7 |
| §10 fora de escopo respeitado (sem contas a receber) | — |
| §11 riscos: previsão cega, desconto invisível, consignado parado, cancelado no ERP | 4, 12, 14, 6 |

## Depois da v1 (não fazer agora)

- Deploy (Vercel/Netlify) com as variáveis de ambiente do projeto
- Consignado entrando na previsão de caixa por giro estimado — hoje fica fora, que é o conservador
- Sazonalidade na previsão de recompra, se o histórico mostrar padrão mensal
