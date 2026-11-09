# Yukktha — Timeless Royal Weaves (storefront)

A static storefront for Yukktha Sarees, Hyderabad. The layout and feel follow a
luxury saree boutique collection page (blush announcement bar, centred uppercase
navigation with mega menus, image banner with breadcrumb, sticky toolbar with
grid density / product count / sort, filter sidebar with facet counts, 4-up
product grid with hover image and wishlist, "load more" with progress), dressed
in Yukktha's own plum and gold with the peacock logo.

No build step and no framework — open with any static server.

## Pages

| Page | What it does |
| --- | --- |
| `index.html` | Full-screen hero film under a transparent header with rotating slide titles, trust strip, trending tabs, Discover mosaic (live design counts), Kanjivaram carousel with progress, shop by occasion, heirloom-weaves hover showcase, story with live stats, video-shopping booking, stores with Google Maps, Instagram, WhatsApp new-arrival alerts |
| `collection.html?c=<slug>` | Collection listing: filters (availability, price range, base colour, weave, occasion, material), sort, density, search (`&q=`), filters kept in the URL |
| `product.html?id=<id>` | Gallery with hover zoom, price / discount, stock, add to bag, order on WhatsApp, details, related sarees |

Collection slugs: `all`, `new-arrivals`, `under-10000`, one per weave
(`kanjivaram-silk`, `banarasi`, `kuppadam-pattu`, `soft-silk`, `soft-cotton`,
`designer-party`, `other`) and one per occasion (`occasion-wedding`,
`occasion-reception`, `occasion-festive`, `occasion-puja`,
`occasion-housewarming`, `occasion-special-occasion`, `occasion-daily-wear`).

Bag and wishlist live in the visitor's browser. `checkout.html` takes the order
online (UPI, cards, net banking, cash on delivery); WhatsApp ordering stays
available.

## Checkout service (netlify/functions)

Yukktha's own serverless checkout, served at `/api/*`:

| Function | Does |
| --- | --- |
| `create-order` | Re-prices the bag from Firestore, checks stock, validates the coupon, applies the first-order discount (only for a verified signed-in customer — the Firebase ID token is checked), GST (included), COD limit and enabled payment methods; writes the order; creates the Razorpay order |
| `verify-payment` | Checks Razorpay's signature, marks the order paid once (stock down, coupon used, customer updated) |
| `razorpay-webhook` | Same, triggered by Razorpay `payment.captured` if the customer closes the browser |
| `checkout-status` | Which mode is running (shown in Admin → Payments) |

Environment variables (Netlify → yukktha-sarees → Environment variables, scope Functions):
`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (from a Firebase service-account key),
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, optional `RAZORPAY_WEBHOOK_SECRET`.

- No Firebase key yet → requests are forwarded to the previous checkout service.
- Firebase key, no Razorpay keys → test mode (no money charged; orders marked TEST in the admin).
- Both → live payments.

## Banners

`js/banners.js` + `css/banners.css` show the live banners from
`projects/yukktha/banners` (managed in Admin → Banners): a spotlight
slideshow after the trust strip on the home page (animated silk light,
sparkles, letter-by-letter gold headline, 3D-tilting framed photo, flip
countdown, coupon ticket with confetti), a dismissible shimmering ribbon above
the announcement bar, and a once-per-visit pop-up with falling petals.
`banner-preview.html` renders previews sent from the admin editor.

## Customer accounts & reviews

`account.html`: sign in, create an account, reset password; then My orders,
profile and delivery address, and My reviews. Accounts are the same Firebase
email/password logins and `projects/yukktha/customers/{uid}` profiles the
BrightLoop store page uses, so existing customers can sign in here. Orders
placed while signed in carry `customerUid` (first-order discount, order
history), and checkout fills in saved details.

Product pages show the average rating, star breakdown and published reviews;
signed-in customers can write one. Reviews are saved as *pending* in
`projects/yukktha/reviews` and appear after approval in Admin → Reviews.
Cards show stars, and collections can be sorted by *Top rated*. Reviews need the
Firestore rule in `yukktha-admin/README.md`.

## Catalogue

`js/store.js` reads the live saree list from the BrightLoop Yukktha project in
Firestore (`projects/yukktha/sarees`, project `yukk-1cf77`), so sarees added in
the BrightLoop admin appear here automatically. If Firestore can't be reached
it falls back to `data/sarees.json`, a snapshot of the same 102 sarees.
Set `liveCatalogue: false` in `js/config.js` to always use the snapshot.

Colour family, occasion and material are worked out from each saree's name,
description and category.

## Assets

Logos, favicon and photos come from the BrightLoop Yukktha project
(brightloopgroup.netlify.app/?project=yukktha):

- `assets/logo-horizontal-light.svg`, `assets/logo-stacked-light.svg`, `assets/favicon.svg` — original light (blush) versions; the header and footer inline the same peacock mark in plum
- `assets/img/saree-1..4.jpg` — store photos used by the BrightLoop site
- `assets/img/kanjivaram-peacock.jpg`, `banarasi-red-butta.jpg`, `kanjivaram-model.jpg` — photos uploaded in the BrightLoop admin

## Hero film

`assets/video/hero.*` (desktop, 1920×820) and `hero-mobile.*` (720×1280) are
looping films made from the Yukktha saree photos with slow zooms and
crossfades; WebM (VP9) is used where the browser supports it, MP4 (H.264)
otherwise, with JPEG posters. To use a real shoot or Instagram reel instead,
replace those files with the same names (keep them muted-friendly, 10–20 s,
under ~4 MB).

## Run locally

```bash
python3 -m http.server 8080 --directory yukktha
```

Then open http://localhost:8080.

## Deploy on Netlify

New site from this repository with **Base directory** `yukktha` and no build
command; `netlify.toml` publishes the folder as is.
