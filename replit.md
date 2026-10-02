# Pariallon

An online homewares shop for Nigerian customers, branded Pariallon (PA), with a searchable catalog, Google sign-in, persistent cart, and order checkout.

## Product

- The storefront is `artifacts/pariallon` and uses Supabase for its catalog, cart, orders, and Google OAuth.
- The storefront submits orders; it does not take card payments until a payment provider is selected and configured.
- Mailgun order confirmations run in a Supabase Edge Function so its private API key stays server-side.
- See `supabase/README.md` for the manual Supabase SQL, Google provider, and Mailgun setup.

## Run & Operate

- `pnpm --filter @workspace/pariallon run dev` — run the Pariallon storefront
- `pnpm --filter @workspace/api-server run dev` — run the shared API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## User preferences

- Use Supabase and the already-configured Google auth provider for Pariallon; do not switch its app data to the Replit database.
- Keep the brand name Pariallon and short name PA.

## Gotchas

- Run `supabase/schema.sql` in the Supabase SQL Editor before testing catalog, cart, or checkout data.
- Deploy `supabase/functions/order-confirmation` and add Mailgun function secrets before expecting confirmation emails.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
