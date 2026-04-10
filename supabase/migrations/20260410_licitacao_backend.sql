-- Backend mínimo para suportar o módulo de licitação no Supabase (Postgres).
-- Tabelas:
-- - bid_products: produto base da licitação
-- - bid_product_suppliers: vínculo fornecedor x produto base (cotações + atendimento)
-- RPC:
-- - get_bid_product_comparison: consulta de comparativo + stats + validação min 3
-- Regra:
-- - Para definir bid_products.status = 'active', exige >= 3 fornecedores vinculados.

-- Enable UUID generation (if not already)
create extension if not exists "pgcrypto";

-- =========================
-- Produtos base
-- =========================
create table if not exists public.bid_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text not null default '',
  technical_description text not null default '',
  unit text not null default 'UN',
  status text not null default 'draft' check (status in ('draft', 'active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bid_products_user_id_idx on public.bid_products (user_id);
create index if not exists bid_products_user_name_idx on public.bid_products (user_id, name);

-- =========================
-- Vínculos fornecedor x produto
-- =========================
create table if not exists public.bid_product_suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.bid_products (id) on delete cascade,

  supplier_name text not null,
  supplier_document text not null default '',

  brand text not null default '',
  model text not null default '',
  unit_price numeric(14,2) not null default 0,
  lead_time_days integer not null default 0,
  warranty text not null default '',
  proposal_validity text not null default '',
  tech_characteristics text not null default '',
  meets_minimum boolean not null default true,
  notes text not null default '',
  quote_date date null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bid_product_suppliers_user_product_idx on public.bid_product_suppliers (user_id, product_id);
create index if not exists bid_product_suppliers_price_idx on public.bid_product_suppliers (user_id, product_id, unit_price);

-- =========================
-- updated_at trigger
-- =========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_bid_products_updated_at on public.bid_products;
create trigger trg_bid_products_updated_at
before update on public.bid_products
for each row execute function public.set_updated_at();

drop trigger if exists trg_bid_product_suppliers_updated_at on public.bid_product_suppliers;
create trigger trg_bid_product_suppliers_updated_at
before update on public.bid_product_suppliers
for each row execute function public.set_updated_at();

-- =========================
-- Validação: mínimo 3 fornecedores para status active
-- =========================
create or replace function public.enforce_min_suppliers_on_active()
returns trigger
language plpgsql
as $$
declare
  suppliers_count integer;
begin
  if new.status = 'active' and (old.status is distinct from new.status) then
    select count(*) into suppliers_count
    from public.bid_product_suppliers s
    where s.user_id = new.user_id and s.product_id = new.id;

    if suppliers_count < 3 then
      raise exception 'Produto precisa de no mínimo 3 fornecedores vinculados para ativar (atual: %).', suppliers_count;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bid_products_min_suppliers on public.bid_products;
create trigger trg_bid_products_min_suppliers
before update on public.bid_products
for each row execute function public.enforce_min_suppliers_on_active();

-- =========================
-- RPC: Comparativo + stats
-- =========================
create or replace function public.get_bid_product_comparison(p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_supplier_count integer;
  v_min_price numeric(14,2);
  v_max_price numeric(14,2);
  v_avg_price numeric(14,2);
  v_product jsonb;
  v_offers jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select to_jsonb(p) into v_product
  from public.bid_products p
  where p.id = p_product_id and p.user_id = v_user_id;

  if v_product is null then
    raise exception 'Product not found';
  end if;

  select count(*)::int,
         min(nullif(s.unit_price, 0)),
         max(nullif(s.unit_price, 0)),
         avg(nullif(s.unit_price, 0))
    into v_supplier_count, v_min_price, v_max_price, v_avg_price
  from public.bid_product_suppliers s
  where s.user_id = v_user_id and s.product_id = p_product_id;

  select coalesce(jsonb_agg(to_jsonb(s) order by (case when s.meets_minimum then 0 else 1 end), nullif(s.unit_price,0) asc nulls last), '[]'::jsonb)
    into v_offers
  from public.bid_product_suppliers s
  where s.user_id = v_user_id and s.product_id = p_product_id;

  return jsonb_build_object(
    'product', v_product,
    'offers', v_offers,
    'supplier_count', coalesce(v_supplier_count, 0),
    'min_price', coalesce(v_min_price, 0),
    'max_price', coalesce(v_max_price, 0),
    'avg_price', coalesce(v_avg_price, 0),
    'min_suppliers_ok', (coalesce(v_supplier_count, 0) >= 3)
  );
end;
$$;

-- =========================
-- RLS
-- =========================
alter table public.bid_products enable row level security;
alter table public.bid_product_suppliers enable row level security;

drop policy if exists bid_products_select_own on public.bid_products;
create policy bid_products_select_own on public.bid_products
for select using (auth.uid() = user_id);

drop policy if exists bid_products_insert_own on public.bid_products;
create policy bid_products_insert_own on public.bid_products
for insert with check (auth.uid() = user_id);

drop policy if exists bid_products_update_own on public.bid_products;
create policy bid_products_update_own on public.bid_products
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists bid_products_delete_own on public.bid_products;
create policy bid_products_delete_own on public.bid_products
for delete using (auth.uid() = user_id);

drop policy if exists bid_product_suppliers_select_own on public.bid_product_suppliers;
create policy bid_product_suppliers_select_own on public.bid_product_suppliers
for select using (auth.uid() = user_id);

drop policy if exists bid_product_suppliers_insert_own on public.bid_product_suppliers;
create policy bid_product_suppliers_insert_own on public.bid_product_suppliers
for insert with check (auth.uid() = user_id);

drop policy if exists bid_product_suppliers_update_own on public.bid_product_suppliers;
create policy bid_product_suppliers_update_own on public.bid_product_suppliers
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists bid_product_suppliers_delete_own on public.bid_product_suppliers;
create policy bid_product_suppliers_delete_own on public.bid_product_suppliers
for delete using (auth.uid() = user_id);

