create table if not exists public.h52_orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null default 'h52',
  client_order_id text not null,
  table_number text not null,
  items jsonb not null,
  totals jsonb not null default '{}'::jsonb,
  customer_notes text not null default '',
  status text not null default 'new' check (status in ('new','sent_to_kitchen','preparing','ready','delivered','cancelled')),
  kitchen_status text not null default 'waiting' check (kitchen_status in ('waiting','preparing','ready')),
  sent_to_kitchen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, client_order_id),
  check (jsonb_typeof(items) = 'array')
);

create index if not exists h52_orders_restaurant_created_idx on public.h52_orders (restaurant_id, created_at desc);
create index if not exists h52_orders_status_idx on public.h52_orders (restaurant_id, status);

create or replace function public.h52_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists h52_orders_touch_updated_at on public.h52_orders;
create trigger h52_orders_touch_updated_at
before update on public.h52_orders
for each row execute function public.h52_touch_updated_at();

alter table public.h52_orders enable row level security;

grant insert on public.h52_orders to anon;
grant select, update on public.h52_orders to authenticated;

drop policy if exists "Clientes crean pedidos nuevos" on public.h52_orders;
create policy "Clientes crean pedidos nuevos"
on public.h52_orders
for insert
to anon
with check (
  restaurant_id = 'h52'
  and status = 'new'
  and kitchen_status = 'waiting'
  and jsonb_array_length(items) between 1 and 60
);

drop policy if exists "Equipo ve pedidos H52" on public.h52_orders;
create policy "Equipo ve pedidos H52"
on public.h52_orders
for select
to authenticated
using (restaurant_id = 'h52');

drop policy if exists "Equipo actualiza estados H52" on public.h52_orders;
create policy "Equipo actualiza estados H52"
on public.h52_orders
for update
to authenticated
using (restaurant_id = 'h52')
with check (restaurant_id = 'h52');

do $$
begin
  alter publication supabase_realtime add table public.h52_orders;
exception
  when duplicate_object then null;
end;
$$;
