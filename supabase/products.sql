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
  ('walnut-living-room-coffee-table', 'Walnut Living Room Coffee Table', 'A warm wood coffee table anchoring a relaxed, modern living room.', 'Furniture', 245000, 'https://images.pexels.com/photos/7001068/pexels-photo-7001068.jpeg', 5, true),
  ('natural-wood-accent-chair', 'Natural Wood Accent Chair', 'A clean-lined wooden chair that brings an organic touch to a quiet corner.', 'Furniture', 158000, 'https://images.pexels.com/photos/6633450/pexels-photo-6633450.jpeg', 8, true),
  ('striped-folding-outdoor-chair', 'Striped Folding Outdoor Chair', 'A lightweight folding chair with a bold striped seat for outdoor lounging.', 'Outdoor', 48500, 'https://images.pexels.com/photos/10559701/pexels-photo-10559701.jpeg', 15, false),
  ('mid-century-wood-lounge-chair', 'Mid-Century Wood Lounge Chair', 'A mid-century inspired wood lounge chair with a relaxed upholstered seat.', 'Furniture', 220000, 'https://images.pexels.com/photos/7319279/pexels-photo-7319279.jpeg', 6, true),
  ('vintage-carved-armchair', 'Vintage Carved Armchair', 'An ornate accent chair with carved details and a distinctive vintage look.', 'Furniture', 320000, 'https://images.pexels.com/photos/17592269/pexels-photo-17592269.jpeg', 3, false),
  ('orange-folding-garden-chair', 'Orange Folding Garden Chair', 'A bright, portable outdoor chair that folds away between uses.', 'Outdoor', 45000, 'https://images.pexels.com/photos/2996279/pexels-photo-2996279.jpeg', 12, false),
  ('curved-back-dining-chair', 'Curved-Back Dining Chair', 'A sculpted dining chair with a rounded back and pale wood frame.', 'Furniture', 135000, 'https://images.pexels.com/photos/30813173/pexels-photo-30813173.png', 8, true),
  ('rattan-lounge-chair', 'Rattan Lounge Chair', 'A woven rattan chair with an airy frame for relaxed indoor seating.', 'Furniture', 198000, 'https://images.pexels.com/photos/3705539/pexels-photo-3705539.jpeg', 5, true),
  ('gathering-dining-table', 'Gathering Dining Table', 'A long dining table arranged for shared meals and family gatherings.', 'Furniture', 465000, 'https://images.pexels.com/photos/15500247/pexels-photo-15500247.jpeg', 3, true),
  ('upholstered-dining-chair-set', 'Upholstered Dining Chair Set', 'Comfortable upholstered chairs for a welcoming dining space.', 'Furniture', 240000, 'https://images.pexels.com/photos/13993981/pexels-photo-13993981.jpeg', 4, false),
  ('scandinavian-dining-set', 'Scandinavian Dining Set', 'A bright, minimal dining setting with light-toned furniture.', 'Furniture', 380000, 'https://images.pexels.com/photos/16284496/pexels-photo-16284496.jpeg', 3, true),
  ('white-modern-dining-chair', 'White Modern Dining Chair', 'A simple white dining chair with a clean, contemporary silhouette.', 'Furniture', 92000, 'https://images.pexels.com/photos/930390/pexels-photo-930390.jpeg', 10, false),
  ('ceramic-holder-kitchen-utensils', 'Ceramic Holder and Kitchen Utensils', 'A practical utensil set with a ceramic holder for everyday cooking.', 'Kitchen', 36500, 'https://images.pexels.com/photos/9098766/pexels-photo-9098766.jpeg', 20, true),
  ('teal-silicone-utensil-set', 'Teal Silicone Utensil Set', 'Colourful cooking tools gathered in a countertop holder for easy access.', 'Kitchen', 29500, 'https://images.pexels.com/photos/10117711/pexels-photo-10117711.jpeg', 18, false),
  ('dark-wood-cooking-utensils', 'Dark Wood Cooking Utensils', 'A set of dark wooden spoons and spatulas in a sturdy countertop crock.', 'Kitchen', 34500, 'https://images.pexels.com/photos/30798748/pexels-photo-30798748.jpeg', 16, true),
  ('wooden-spoon-and-spatula-set', 'Wooden Spoon and Spatula Set', 'Natural wood cooking utensils stored neatly in a matching holder.', 'Kitchen', 32000, 'https://images.pexels.com/photos/11001668/pexels-photo-11001668.jpeg', 18, false)
on conflict (slug) do nothing;