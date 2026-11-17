# Artham – understand any document in your own language

People take a photo of a confusing paper (hospital bill, rental agreement, loan letter, government notice…)
and get a plain-language explanation in Telugu, Hindi, English, Tamil, Kannada, Malayalam, Marathi, Bengali or
Gujarati: summary, red flags, amounts, dates, next steps, questions to ask and whether they need an expert.

- **2 free documents** per new visitor, then paid packs: ₹29 / 1, ₹99 / 5, ₹249 / 15 (edit `PLANS` in `lib/config.ts`).
- **Payments:** Razorpay (UPI, cards, net banking) with server-side signature checks and a webhook, so a
  payment is credited exactly once even if the customer closes the browser.
- **No login:** credits live in an anonymous wallet tied to an httpOnly cookie.
- **Privacy:** documents are never stored; only wallet balances, orders and daily counts.
- **Extras:** read-aloud in the chosen language (phone's built-in voices), share on WhatsApp, print/save as PDF,
  `/admin` page with documents, revenue, AI cost and profit.

| Part | Tech |
| --- | --- |
| App | Next.js 16 (App Router) + React 19, TypeScript |
| AI | Claude API (`@anthropic-ai/sdk`), structured outputs, server-side refusal fallback |
| Storage | Netlify Blobs (strong consistency + conditional writes); local JSON file in development |
| Hosting | Netlify (free plan is enough to start) |

## Run locally

```bash
cd artham
npm install
npm run dev        # http://localhost:3000
```

Without `ANTHROPIC_API_KEY` the app runs in **demo mode** (sample explanation) and Razorpay is replaced by a
**test payment** button, so you can click through the whole flow for free. Copy `.env.example` to `.env.local`
to set real keys.

```bash
npm test           # credits, payments, signatures, concurrency
npm run typecheck
npm run build
```

## Environment variables

See `.env.example` for the full list. The important ones:

| Variable | Needed for | Where to get it |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | AI explanations | console.anthropic.com → API keys (add prepaid credit) |
| `ARTHAM_MODEL` | Optional. Default `claude-opus-5-5` | `claude-sonnet-5-5` / `claude-haiku-5-5` are cheaper |
| `ARTHAM_EFFORT` | Optional. `low` / `medium` (default) / `high` | |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Payments | Razorpay Dashboard → Account & Settings → API keys |
| `RAZORPAY_WEBHOOK_SECRET` | Reliable crediting | Razorpay Dashboard → Webhooks (see below) |
| `NEXT_PUBLIC_BUSINESS_NAME`, `NEXT_PUBLIC_BUSINESS_ADDRESS`, `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_SUPPORT_PHONE` | Legal + contact pages (Razorpay KYC checks them) | Your details |
| `STORE_BACKEND` | `blobs` on Netlify | |
| `HASH_SALT`, `ADMIN_KEY` | Security, `/admin` page | Any long random strings |

`NEXT_PUBLIC_*` values are baked in at build time: redeploy after changing them.

## Cost per document (AI)

| Model | ≈ cost for a 2-page document |
| --- | --- |
| `claude-opus-5-5` (default) | ₹4 |
| `claude-sonnet-5-5` | ₹2 |
| `claude-haiku-5-5` | ₹0.10 |

The `/admin` page shows the real average once people use it.

## Go-live checklist

1. **Anthropic:** create an API key and add credit. Set `ANTHROPIC_API_KEY` on Netlify (scope: Functions).
2. **Business details:** set the four `NEXT_PUBLIC_*` business variables and redeploy. Check `/terms`,
   `/privacy`, `/refunds`, `/contact` show no orange placeholders.
3. **Razorpay:** sign up, complete KYC (PAN, bank account, website URL = your Netlify URL). Test with
   `rzp_test_…` keys first (Razorpay test UPI/cards), then switch to `rzp_live_…` keys.
4. **Webhook:** Razorpay Dashboard → Webhooks → add `https://YOUR-SITE/api/payments/webhook`, events
   `payment.captured` and `order.paid`, set a secret and put the same value in `RAZORPAY_WEBHOOK_SECRET`.
5. **Admin:** set `ADMIN_KEY`, open `/admin` to confirm every item under *Setup* is ✅.
6. Optional: buy a domain and add it in Netlify → Domain management.

## Code map

```
app/page.tsx                 Landing page (tool, use cases, pricing, FAQ)
components/Explainer.tsx     Upload, language, progress, credits
components/ResultView.tsx    Explanation, listen, WhatsApp share, print
components/BuyModal.tsx      Packs + Razorpay Checkout
app/api/explain              Validates upload, reserves a credit, calls Claude, refunds on failure
app/api/payments/*           Create order, verify checkout signature, webhook
app/api/wallet               Current balance (creates a wallet with free credits)
app/api/admin/stats          Daily stats (needs ADMIN_KEY)
lib/ai.ts                    Prompt + Claude call
lib/schema.ts                The JSON shape Claude must return
lib/accounts.ts, lib/kv.ts   Wallets, orders, stats on Netlify Blobs with compare-and-set
```
