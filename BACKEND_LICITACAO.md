# Backend do Módulo de Licitação (Supabase)

Este projeto não tem servidor próprio. O "backend real" é o Supabase (Auth + Postgres).

## O que já existia

- `public.workbooks`: usado para sync das planilhas (precificação) via `src/js/storage/cloud.js`.
- Autenticação Supabase (`checkSession/login/signUp/logout`) em `src/js/storage/cloud.js`.

## O que foi criado (mínimo necessário)

SQL em `supabase/migrations/20260410_licitacao_backend.sql`:

- `public.bid_products`
  - CRUD de produto base da licitação.
  - Campos principais: `name`, `category`, `technical_description`, `unit`, `status`.
  - Regra: para mudar `status` para `active`, exige no mínimo 3 fornecedores vinculados.

- `public.bid_product_suppliers`
  - Vínculo fornecedor x produto base (cotações e atendimento da especificação mínima).
  - Mantém fornecedor como campos (`supplier_name`, `supplier_document`) para não criar uma entidade nova de fornecedor sem necessidade.

- RPC `public.get_bid_product_comparison(p_product_id uuid) -> jsonb`
  - Retorna: produto, ofertas, contagem de fornecedores, menor/maior/média de preços e `min_suppliers_ok`.

- RLS/policies em ambas as tabelas: cada usuário enxerga apenas seus dados (`auth.uid() = user_id`).

## O que foi reaproveitado

Em `src/js/storage/cloud.js`:

- `supabase` client já existente.
- `checkSession()` já existente para garantir usuário logado.

## API (JS) adicionada

Em `src/js/storage/cloud.js`:

- `listBidProducts()`, `createBidProduct()`, `updateBidProduct()`, `deleteBidProduct()`
- `listBidProductSuppliers()`, `upsertBidProductSupplier()`, `deleteBidProductSupplier()`
- `getBidProductComparison()`

## Como aplicar no Supabase

1. Abra o SQL editor do seu projeto Supabase.
2. Rode o arquivo `supabase/migrations/20260410_licitacao_backend.sql`.
3. Garanta que `.env` tenha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

