# Yukktha Platform

Multi-tenant commerce SaaS for boutiques. One deployment, one SQL Server database, every store isolated by `StoreId`.
Built to the Product Requirements Document v1.0 (Phase 1 / P0 scope). The existing Yukktha Saree Studio site is untouched — this is a new codebase.

```
src/Yukktha.Api        .NET 8 Web API + EF Core          → api.yukktha.in
apps/admin             React PWA for store owners (te/en) → app.yukktha.in
apps/storefront        React storefront per store         → {slug}.yukktha.in
azure-pipelines.yml    Build + deploy (App Service slots, Static Web Apps)
```

## Run locally

Prereqs: .NET 8 SDK, Node 20, SQL Server (LocalDB or Docker `mcr.microsoft.com/mssql/server`).

```bash
# 1. API
cd src/Yukktha.Api
dotnet restore
dotnet tool install --global dotnet-ef        # once
dotnet ef migrations add Initial              # creates Migrations/
dotnet ef database update
dotnet run --urls http://localhost:5000        # Swagger at /swagger

# 2. Admin PWA
cd apps/admin && npm install && npm run dev    # http://localhost:5173

# 3. Storefront (pick the tenant with VITE_STORE_SLUG in dev)
cd apps/storefront && npm install
VITE_STORE_SLUG=sri-lakshmi-sarees npm run dev # http://localhost:5174
```

`Otp:DevMode` is `true` in `appsettings.json`, so the OTP is returned in the API response and shown on the login screen. Turn it off before production.

## First store

Open the admin, tap **Create your store**, enter shop name + phone, enter the dev OTP. You land in the 3-step onboarding: add products → delivery options → share link. The slug is derived from the shop name; the storefront is `https://{slug}.yukktha.in` (or the dev URL with `VITE_STORE_SLUG`).

## Tenancy model (read this before touching data access)

* `TenantResolutionMiddleware` resolves the store from `X-Store-Slug` header → custom domain → subdomain, and puts it in the scoped `TenantContext`.
* `AppDbContext` applies a global query filter `StoreId == tenant.StoreId` to every `ITenantEntity`, stamps `StoreId` on inserts, and throws on cross-tenant updates.
* Admin controllers inherit `TenantControllerBase`, which **overrides** the tenant with the `store_id` claim from the JWT. A token for store A can never act on store B regardless of the URL.
* Super-admin and auth code use `IgnoreQueryFilters()` explicitly and nowhere else. If you write `IgnoreQueryFilters()` in a tenant controller, that is a bug.

## PRD coverage

| PRD ID | Where |
|---|---|
| PL-1 tenancy, PL-2 signup, PL-3 super-admin, PL-4 roles, PL-6 Google review config | `Tenancy/`, `AuthController`, `SuperAdminController`, `StoreController` |
| CT-1 phone add, CT-2 Telugu names, CT-3 variants, CT-4 bulk | `ProductsController`, `ProductEdit.tsx` |
| WA-1/2 links, WA-3 confirmations, WA-4 status, WA-5 manual orders | `WhatsAppService`, `StorefrontController.Checkout`, `OrdersController` |
| OR-1 checkout, OR-2 UPI/COD, OR-3 order list, OR-7 summary | `StorefrontController`, `Checkout.tsx`, `OrdersController.Summary` |
| MK-1 customers, MK-2 review prompt (config), MK-6 weekly card | `Customer` entity, `Home.tsx` |
| BL-1 plans, BL-2 trial, BL-3 grace/suspend | `SubscriptionService`, `WebhooksController.Razorpay` |
| AD-1 mobile PWA, AD-2 te/en, AD-3 guided first run | `apps/admin` |

## Not built yet (next)

1. **Razorpay subscription checkout** in Settings → Upgrade (webhook handling is done; the create-subscription call and the Razorpay Route onboarding for store payouts are not).
2. **WhatsApp templates** must be created and approved in Meta Business Manager: `login_otp`, `new_order_owner`, `order_confirmed`, `order_status`. Until approved, the API logs the message and the storefront falls back to a wa.me link.
3. **Evening WhatsApp summary (OR-7)** — add a hosted service that calls the summary query per active store at 20:00 IST.
4. **Image compression (CT-6)** — resize on upload (SixLabors.ImageSharp) before pushing to Blob.
5. **Order-number sequence** — currently `MAX+1` per store; switch to a `StoreCounters` row with an atomic update before traffic grows.
6. **Custom-domain SSL (PL-5)** — App Service managed certificates via the super-admin console.
7. Automated test: one xUnit test that creates two stores and asserts every admin endpoint returns nothing from the other store.

## Config for production

Set these as App Service settings (never commit them): `ConnectionStrings__Default`, `Jwt__Key`, `WhatsApp__PhoneNumberId`, `WhatsApp__AccessToken`, `WhatsApp__VerifyToken`, `Razorpay__KeyId`, `Razorpay__KeySecret`, `Razorpay__WebhookSecret`, `Storage__BlobConnectionString`, `Storage__CdnBaseUrl`, `Otp__DevMode=false`.
Wildcard DNS `*.yukktha.in` → storefront Static Web App; `api.yukktha.in` → App Service.
