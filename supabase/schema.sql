-- Pariallon (PA) shop schema for Supabase.
-- Run this file once in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null,
  category text not null,
  price_naira integer not null check (price_naira >= 0),
  image_url text not null,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.carts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  email text not null,
  customer_name text not null,
  phone text not null,
  address_line1 text not null,
  city text not null,
  state text not null,
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  subtotal_naira integer not null check (subtotal_naira >= 0),
  shipping_naira integer not null check (shipping_naira >= 0),
  total_naira integer not null check (total_naira = subtotal_naira + shipping_naira),
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.carts enable row level security;
alter table public.orders enable row level security;

drop policy if exists "Pariallon products are visible to everyone" on public.products;
create policy "Pariallon products are visible to everyone"
  on public.products for select
  using (true);

drop policy if exists "Users can read their Pariallon cart" on public.carts;
create policy "Users can read their Pariallon cart"
  on public.carts for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their Pariallon cart" on public.carts;
create policy "Users can create their Pariallon cart"
  on public.carts for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their Pariallon cart" on public.carts;
create policy "Users can update their Pariallon cart"
  on public.carts for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their Pariallon cart" on public.carts;
create policy "Users can delete their Pariallon cart"
  on public.carts for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read their Pariallon orders" on public.orders;
create policy "Users can read their Pariallon orders"
  on public.orders for select to authenticated
  using (auth.uid() = user_id);

grant select on public.products to anon, authenticated;
grant select, insert, update, delete on public.carts to authenticated;
grant select on public.orders to authenticated;

create or replace function public.place_order(
  p_customer_name text,
  p_email text,
  p_phone text,
  p_address_line1 text,
  p_city text,
  p_state text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_auth_email text := auth.jwt() ->> 'email';
  v_line jsonb;
  v_product public.products%rowtype;
  v_product_id uuid;
  v_quantity integer;
  v_items jsonb := '[]'::jsonb;
  v_subtotal integer := 0;
  v_shipping integer;
  v_order_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in before placing an order.';
  end if;

  if v_auth_email is null or lower(trim(p_email)) <> lower(v_auth_email) then
    raise exception 'Use the email address on your signed-in account.';
  end if;

  if nullif(trim(p_customer_name), '') is null
    or nullif(trim(p_phone), '') is null
    or nullif(trim(p_address_line1), '') is null
    or nullif(trim(p_city), '') is null
    or nullif(trim(p_state), '') is null then
    raise exception 'Complete all delivery details before placing an order.';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.';
  end if;

  for v_line in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_product_id := (v_line ->> 'product_id')::uuid;
      v_quantity := (v_line ->> 'quantity')::integer;
    exception when others then
      raise exception 'An item in your cart is invalid.';
    end;

    if v_quantity < 1 or v_quantity > 20 then
      raise exception 'Choose a quantity between 1 and 20.';
    end if;

    update public.products
      set stock_quantity = stock_quantity - v_quantity
      where id = v_product_id and stock_quantity >= v_quantity
      returning * into v_product;

    if not found then
      raise exception 'An item is out of stock or no longer available.';
    end if;

    v_subtotal := v_subtotal + (v_product.price_naira * v_quantity);
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'name', v_product.name,
      'quantity', v_quantity,
      'unit_price_naira', v_product.price_naira,
      'image_url', v_product.image_url,
      'subtotal_naira', v_product.price_naira * v_quantity
    ));
  end loop;

  v_shipping := case when v_subtotal > 75000 then 0 else 3500 end;

  insert into public.orders (
    user_id, email, customer_name, phone, address_line1, city, state,
    items, subtotal_naira, shipping_naira, total_naira
  )
  values (
    v_user_id, v_auth_email, trim(p_customer_name), trim(p_phone),
    trim(p_address_line1), trim(p_city), trim(p_state), v_items,
    v_subtotal, v_shipping, v_subtotal + v_shipping
  )
  returning id into v_order_id;

  return v_order_id;
end;
$$;

revoke all on function public.place_order(text, text, text, text, text, text, jsonb) from public;
grant execute on function public.place_order(text, text, text, text, text, text, jsonb) to authenticated;

insert into public.products
  (slug, name, description, category, price_naira, image_url, stock_quantity, is_featured)
values
  ('table-lamp', 'Table Lamp', 'A sculptural lamp with a warm, softly diffused glow for slow evenings.', 'Decor', 89500, '/products/table-lamp.jpg', 12, true),
  ('olive-vase', 'Olive Ceramic Vase', 'A hand-finished stoneware vase made to bring a little quiet to a shelf or table.', 'Decor', 38500, '/products/olive-vase.jpg', 18, true),
  ('teak-stool', 'Teak Side Stool', 'Solid teak and softly rounded edges make this a useful seat or bedside companion.', 'Furniture', 168000, '/products/teak-stool.jpg', 7, true),
  ('yellow-peeler', 'Yellow Peeler', 'A bright, comfortable kitchen essential with a sharp stainless-steel blade.', 'Kitchen', 12000, '/products/yellow-peeler.jpg', 34, true),
  ('cotton-throw', 'Cotton Throw', 'A generously sized handwoven cotton throw in warm rust and natural cream.', 'Textiles', 56000, '/products/cotton-throw.jpg', 14, false),
  ('serving-bowls', 'Ceramic Serving Bowls', 'A set of tactile, speckled stoneware bowls for everyday meals and gatherings.', 'Kitchen', 26500, '/products/serving-bowls.jpg', 20, false)
on conflict (slug) do nothing;