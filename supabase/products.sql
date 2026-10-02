-- Pariallon public catalog: run this standalone in the Supabase SQL Editor.
-- Safe to run more than once; existing slugs are left unchanged.

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

alter table public.products enable row level security;

drop policy if exists "Pariallon products are visible to everyone" on public.products;
create policy "Pariallon products are visible to everyone"
  on public.products for select to anon, authenticated
  using (true);

grant select on public.products to anon, authenticated;

insert into public.products
  (slug, name, description, category, price_naira, image_url, stock_quantity, is_featured)
values
  ('arc-floor-lamp', 'Arc Floor Lamp', 'A slim reading lamp with a warm, softly diffused glow.', 'Lighting', 78500, 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=900&q=82', 12, true),
  ('oak-bookcase', 'Oak Bookcase', 'An open oak shelf for books, ceramics, and the things you keep close.', 'Storage', 195000, 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=900&q=82', 6, true),
  ('walnut-dining-chair', 'Walnut Dining Chair', 'A sculpted wood chair with a comfortable, understated profile.', 'Furniture', 68000, 'https://images.unsplash.com/photo-1598300056393-4aac492f4344?auto=format&fit=crop&w=900&q=82', 14, true),
  ('round-coffee-table', 'Round Coffee Table', 'A low, rounded centrepiece for slow mornings and shared evenings.', 'Furniture', 142000, 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82', 5, true),
  ('stone-bath-collection', 'Stone Bath Collection', 'A calm, considered bathroom setting in soft stone and natural tones.', 'Bath', 32000, 'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=900&q=82', 16, false),
  ('linen-sofa', 'Linen Sofa', 'A generous, relaxed sofa with room for everyone to settle in.', 'Furniture', 485000, 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=82', 3, true),
  ('entryway-console', 'Entryway Console', 'A clean-lined console to make a welcoming first impression.', 'Furniture', 185000, 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82', 5, false),
  ('boucle-lounge-chair', 'Bouclé Lounge Chair', 'A soft, supportive chair for reading, resting, or doing nothing at all.', 'Furniture', 165000, 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=82', 7, true),
  ('reeded-sideboard', 'Reeded Sideboard', 'A warm, practical storage piece with display space above.', 'Furniture', 270000, 'https://images.unsplash.com/photo-1615874694520-474822394e73?auto=format&fit=crop&w=900&q=82', 4, false),
  ('clay-linen-duvet', 'Clay Linen Duvet Set', 'Breathable, relaxed bedding in a soft clay-toned palette.', 'Textiles', 98000, 'https://images.unsplash.com/photo-1615874959474-d609969a20ed?auto=format&fit=crop&w=900&q=82', 9, true),
  ('bedside-table', 'Bedside Table', 'A compact bedside companion with room for a book and a glass of water.', 'Furniture', 112000, 'https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a?auto=format&fit=crop&w=900&q=82', 8, false),
  ('modular-lounge-sofa', 'Modular Lounge Sofa', 'A deep, flexible sofa for stretching out or gathering together.', 'Furniture', 620000, 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82', 2, true),
  ('dining-room-set', 'Dining Room Set', 'A light-filled dining setting made for long meals and good company.', 'Furniture', 420000, 'https://images.unsplash.com/photo-1617104551722-3b2d51366400?auto=format&fit=crop&w=900&q=82', 3, false),
  ('platform-bed', 'Platform Bed', 'A grounded bedroom centrepiece with a simple, sturdy frame.', 'Furniture', 550000, 'https://images.unsplash.com/photo-1617104678098-de229db51175?auto=format&fit=crop&w=900&q=82', 2, true),
  ('mustard-accent-chair', 'Mustard Accent Chair', 'A cheerful upholstered chair that brings warmth to a quiet corner.', 'Furniture', 158000, 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=900&q=82', 6, true),
  ('nested-coffee-tables', 'Nested Coffee Tables', 'A pair of low tables that tuck neatly together when not in use.', 'Furniture', 225000, 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=900&q=82', 4, false),
  ('cloud-two-seat-sofa', 'Cloud Two-Seat Sofa', 'A comfortable two-seat sofa with a relaxed, easy shape.', 'Furniture', 360000, 'https://images.unsplash.com/photo-1618221710640-c0eaaa2adb49?auto=format&fit=crop&w=900&q=82', 3, true),
  ('freestanding-bath', 'Freestanding Bath', 'A sculptural bath for turning an everyday routine into a slower one.', 'Bath', 250000, 'https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=900&q=82', 2, false),
  ('king-platform-bed', 'King Platform Bed', 'A spacious, low-profile bed for a restful, uncluttered room.', 'Furniture', 575000, 'https://images.unsplash.com/photo-1631679706909-1844bbd07221?auto=format&fit=crop&w=900&q=82', 2, true),
  ('blue-accent-chair', 'Blue Accent Chair', 'A compact upholstered chair with a considered pop of colour.', 'Furniture', 145000, 'https://images.unsplash.com/photo-1634712282287-14ed57b9cc89?auto=format&fit=crop&w=900&q=82', 5, false)
on conflict (slug) do nothing;