# Yukktha admin

Back office for Yukktha Sarees: everything a boutique owner does day to day.
It is a static site (no build step) that works on the **same Firebase project**
as the storefront and the BrightLoop admin (`yukk-1cf77`, store `yukktha`), so a
saree, price, discount or offer saved here is live on the website at once.

## Sections

| Section | What you can do |
| --- | --- |
| Dashboard | Today / month sales, expenses and profit, open orders, 30-day chart, sales by weave, low stock, quick actions |
| In-store billing | Point-of-sale: tap or scan (SKU) sarees, weave chips, customer lookup by mobile, salesperson, coupons, extra discount, cash / UPI / card, GST, hold & resume bills, printable invoice, WhatsApp receipt. Reduces stock and adds the customer |
| Orders | Online and in-store orders, filters, status changes (cancel / return put stock back once), refunds, invoice, WhatsApp the customer, CSV export |
| Customers | List with orders and lifetime spend, tags (VIP, Bridal…), birthdays & anniversaries with one-tap WhatsApp wishes, CSV import / export |
| Sarees | Add / edit with up to 5 photos (auto-resized), MRP, discount, cost price, SKU, colour, stock mode; bulk discount / weave / out-of-stock / delete; CSV export |
| Stock & suppliers | Stock levels and value, add / remove with reasons, full stock history, suppliers (weavers) and purchase bills with balance due and payments |
| Reviews | Approve, hide or reply to customer reviews; shows whether the reviewer bought the saree; average rating |
| Discounts & offers | Single-use coupons (bulk generate, WhatsApp message), sale % by weave, first-order discount, offer banners |
| Employees | Staff directory, daily attendance (present / half / absent / leave), monthly salary with absence deduction, sales commission and advances, mark salary paid |
| Expenses | Monthly expenses by category, copy fixed costs from last month, CSV export |
| Payments | Website checkout methods, GST (GSTIN, rate), UPI / bank details for invoices, Razorpay key ID, COD to collect, refunds to process |
| Reports | Sales, average bill, discounts, gross profit (from cost prices), expenses, net, GST, trends, by weave / payment / channel / salesperson, top sarees, CSV |
| Team access | Invite admins (owner or staff), owner toggle, remove access |
| Store settings | Name, tagline, WhatsApp, Instagram, weaves, stores, price visibility |

**Roles.** Super admins and *owners* (master admins) see everything. Staff admins
can bill and manage sarees, orders, customers, coupons and attendance, but not
payments, salaries, expenses, reports, team or settings, and can't cancel orders.

**Demo mode.** "Explore the demo" on the sign-in page loads the real catalogue
with sample orders, customers, staff and expenses, saved only in that browser.
Nothing is written to Firebase. "Reset demo" starts it over.

## Signing in

Use the same email and password as the BrightLoop admin. New team members are
invited from **Team access**; they open this admin, choose *Invited? Create your
password* and sign up with the invited email.

## Firestore rules

Sarees, orders, customers (including customer logins), coupons, banners,
users, invites and the store document already work with the rules the BrightLoop admin uses. The new sections
store data in new collections under `projects/{slug}/`, which your rules have to
allow. Until they do, those screens show a "Not allowed yet" message. Add this
inside `match /databases/{database}/documents { … }` in Firebase console →
Firestore → Rules (keep your existing rules):

```
function yUser() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data; }
function yAdmin(slug) {
  return request.auth != null && exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
         (yUser().role == 'super_admin' || (yUser().role == 'admin' && slug in yUser().projectIds));
}
function yOwner(slug) { return yAdmin(slug) && (yUser().role == 'super_admin' || yUser().get('isMaster', false) == true); }

match /projects/{slug}/employees/{id}  { allow read: if yAdmin(slug); allow write: if yOwner(slug); }
match /projects/{slug}/attendance/{id} { allow read, write: if yAdmin(slug); }
match /projects/{slug}/payroll/{id}    { allow read, write: if yOwner(slug); }
match /projects/{slug}/expenses/{id}   { allow read, write: if yOwner(slug); }
match /projects/{slug}/suppliers/{id}  { allow read, write: if yAdmin(slug); }
match /projects/{slug}/purchases/{id}  { allow read, write: if yAdmin(slug); }
match /projects/{slug}/stockMoves/{id} { allow read, create: if yAdmin(slug); }

// Customer reviews: anyone can read published ones; a signed-in customer of
// this store can submit one (always "pending") and see their own; admins moderate.
match /projects/{slug}/reviews/{id} {
  allow read: if resource.data.status == 'approved'
              || (request.auth != null && resource.data.uid == request.auth.uid)
              || yAdmin(slug);
  allow create: if request.auth != null
              && exists(/databases/$(database)/documents/projects/$(slug)/customers/$(request.auth.uid))
              && request.resource.data.uid == request.auth.uid
              && request.resource.data.status == 'pending'
              && request.resource.data.verified == false
              && request.resource.data.rating is int
              && request.resource.data.rating >= 1 && request.resource.data.rating <= 5
              && request.resource.data.text is string && request.resource.data.text.size() <= 2000;
  allow update, delete: if yAdmin(slug);
}
```

If your rules check which fields of the store document may change, also allow
`paymentConfig` (UPI, bank, invoice prefix, Razorpay key ID).

Never put the Razorpay **secret** in the admin; it belongs in the Netlify
environment variables of the site that runs the checkout functions.

## Photos

Photos are resized in the browser to about 1000 px JPEG and stored in the saree
document, the same way the BrightLoop admin does it. Firestore allows 1 MB per
document, so a saree holds up to five photos.

## Run locally

```bash
python3 -m http.server 8090 --directory yukktha-admin
```
