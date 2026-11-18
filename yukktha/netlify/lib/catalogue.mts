// Read-only view of the live saree catalogue for the AI stylist (public Firestore read,
// same data and price rules as the website). Cached for a few minutes per function instance.
import { env } from './env.mts';

const WEB_KEY = () => env('FIREBASE_WEB_API_KEY') || 'AIzaSyCWGe8E6CoE9D2lIzt2DaajSGK05oTtebg'; // public web key (also in the website)
const PROJECT = () => env('FIREBASE_PROJECT_ID') || 'yukk-1cf77';
const SLUG = () => env('STORE_SLUG') || 'yukktha';

export type Saree = { id: string; name: string; weave: string; price: number; mrp: number; discount: number; inStock: boolean; colour: string; occasion: string | null; description: string; image: string };

const COLOURS: [string, RegExp][] = [['Maroon', /maroon|wine/i], ['Pink', /pink|magenta|rani/i], ['Red', /red|coral/i], ['Orange', /orange|rust/i], ['Brown', /copper|brown/i], ['Yellow', /yellow|mustard|turmeric|gold/i], ['Green', /green|teal|emerald/i], ['Blue', /blue|navy/i], ['Purple', /purple|violet|lavender/i], ['Cream', /cream|ivory|white/i], ['Black', /black/i], ['Grey', /grey|gray|silver/i]];
const OCC: Record<string, string> = { weddings: 'Wedding', receptions: 'Reception', festivals: 'Festive', pujas: 'Puja', housewarmings: 'Housewarming', 'special occasions': 'Special occasion', 'daily elegance': 'Daily wear' };
const num = (v: any) => { const n = Number(String(v ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; };
function val(v: any): any { const k = Object.keys(v || {})[0]; const x = v ? v[k] : undefined; if (k === 'integerValue' || k === 'doubleValue') return Number(x); if (k === 'booleanValue') return !!x; if (k === 'nullValue') return null; if (k === 'arrayValue') return (x.values || []).map(val); if (k === 'mapValue') { const o: any = {}; for (const f of Object.keys(x.fields || {})) o[f] = val(x.fields[f]); return o; } return x; }

function normalise(id: string, s: any): Saree {
  const mrp = num(s.sellPrice) || num(s.price); const discount = Math.min(100, Math.max(0, num(s.discountPercent)));
  const stock = s.stockMode === 'availability' ? (s.available === false ? 0 : 1) : (s.quantity == null ? 1 : num(s.quantity));
  const name = String(s.name || 'Saree').trim().replace(/\b([a-z])/g, (m) => m.toUpperCase());
  const occ = /ideal for ([^.]+)\./i.exec(s.description || '');
  const imgs = [s.imageUrl, ...(Array.isArray(s.images) ? s.images : [])].filter((u) => typeof u === 'string' && u);
  const img = (imgs.find((u: string) => !u.startsWith('data:')) || '').replace(/^assets\/saree-(\d)\.jpg$/, 'assets/img/saree-$1.jpg');
  return { id, name: /saree$/i.test(name) ? name : name + ' Saree', weave: String(s.category || 'Other'), price: Math.round(mrp * (1 - discount / 100)), mrp, discount, inStock: stock > 0,
    colour: (COLOURS.find(([, re]) => re.test(name)) || ['Multi'])[0], occasion: occ ? OCC[occ[1].toLowerCase()] || null : null, description: String(s.description || '').slice(0, 400), image: img };
}

let cache: { at: number; items: Saree[] } | null = null;
export async function catalogue(): Promise<Saree[]> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.items;
  const base = 'https://firestore.googleapis.com/v1/projects/' + PROJECT() + '/databases/(default)/documents/projects/' + SLUG() + '/sarees';
  const items: Saree[] = []; let token = '';
  do {
    const res = await fetch(base + '?pageSize=300&mask.fieldPaths=name&mask.fieldPaths=category&mask.fieldPaths=sellPrice&mask.fieldPaths=price&mask.fieldPaths=discountPercent&mask.fieldPaths=stockMode&mask.fieldPaths=available&mask.fieldPaths=quantity&mask.fieldPaths=description&mask.fieldPaths=imageUrl&key=' + encodeURIComponent(WEB_KEY()) + (token ? '&pageToken=' + encodeURIComponent(token) : ''));
    if (!res.ok) throw new Error('Catalogue unavailable (' + res.status + ')');
    const body: any = await res.json();
    for (const d of body.documents || []) { const o: any = {}; for (const f of Object.keys(d.fields || {})) o[f] = val(d.fields[f]); items.push(normalise(d.name.split('/').pop(), o)); }
    token = body.nextPageToken || '';
  } while (token);
  cache = { at: Date.now(), items };
  return items;
}

export type Query = { text?: string; weave?: string; colour?: string; occasion?: string; min_price?: number; max_price?: number; include_sold_out?: boolean; limit?: number };
export function search(items: Saree[], q: Query) {
  const words = String(q.text || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const has = (s: string, part?: string) => !part || s.toLowerCase().includes(part.toLowerCase());
  const scored = items
    .filter((s) => s.price > 0 && (q.include_sold_out || s.inStock))
    .filter((s) => has(s.weave, q.weave) && (!q.colour || has(s.colour + ' ' + s.name, q.colour)) && (!q.occasion || has(String(s.occasion || '') + ' ' + s.description, q.occasion)))
    .filter((s) => (!q.min_price || s.price >= q.min_price) && (!q.max_price || s.price <= q.max_price))
    .map((s) => { const hay = (s.name + ' ' + s.weave + ' ' + s.colour + ' ' + (s.occasion || '') + ' ' + s.description).toLowerCase(); return { s, score: words.reduce((a, w) => a + (hay.includes(w) ? 1 : 0), 0) + (s.image && !/saree-\d\.jpg$/.test(s.image) ? 0.5 : 0) }; })
    .sort((a, b) => b.score - a.score || a.s.price - b.s.price);
  return { total: scored.length, results: scored.slice(0, Math.min(8, Math.max(1, q.limit || 6))).map((x) => x.s) };
}
/** Compact text the model reads (no image data, no internal fields). */
export const brief = (s: Saree) => ({ id: s.id, name: s.name, weave: s.weave, colour: s.colour, price: s.price, ...(s.discount ? { mrp: s.mrp, discount_percent: s.discount } : {}), in_stock: s.inStock, occasion: s.occasion, description: s.description });
