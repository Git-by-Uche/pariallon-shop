# Pariallon Supabase setup

The storefront uses this Supabase project for its product catalog, carts, orders, and Google sign-in. The browser only uses the public anon key; never put the service-role key in the website.

## 1. Create the tables and sample products

Open the Supabase SQL Editor, paste in `supabase/schema.sql`, and run it. It creates the `products`, `carts`, and `orders` tables, row-level security policies, a checkout function that calculates prices and delivery on the database, and six sample products.

The sample catalog references product images served by the Pariallon website from `/products/`.

If you only need the public catalog, `supabase/products.sql` is a standalone script that creates the app-compatible `products` table, grants public read access, and adds 16 more sample products using the supplied Pexels image links.

## 2. Confirm Google sign-in

In Supabase Dashboard, open **Authentication → Sign In / Providers → Google**. Confirm the Google provider is enabled and that your Google OAuth client is configured. Add the published Pariallon site URL to the Supabase authentication URL configuration after publishing.

## 3. Enable order confirmation email

Deploy the included Supabase Edge Function named `order-confirmation` from `supabase/functions/order-confirmation/index.ts`. With the Supabase CLI:

```sh
supabase functions deploy order-confirmation
```

Add these function secrets in Supabase (or with `supabase secrets set`):

- `MAILGUN_API_KEY` — the Mailgun private API key
- `MAILGUN_DOMAIN` — your verified Mailgun sending domain
- `MAILGUN_FROM` — the sender, for example `Pariallon <orders@your-domain.example>`
- `MAILGUN_BASE_URL` — optional; use `https://api.mailgun.net` for the US region or `https://api.eu.mailgun.net` for the EU region

Keep these secrets in Supabase; they do not belong in Vite variables or browser code. The function verifies the signed-in user and reads the order through that user's Supabase permissions before it sends the email.

The storefront creates an order without charging a card. A payment provider has not been connected.