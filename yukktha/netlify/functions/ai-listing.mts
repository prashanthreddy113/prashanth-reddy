// AI listing writer for the Yukktha admin — POST /ai/listing (admins only)
// { images: [dataURL…1-3], categories: [...], notes?: string } → draft name, weave, colour, description…
// Staff review and edit every draft before publishing.
import { z } from 'zod';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { claude, MODEL, FALLBACK, aiConfigured, aiErrorMessage } from '../lib/ai.mts';
import { verifyIdToken, bearer } from '../lib/idtoken.mts';
import { env } from '../lib/env.mts';

const ADMIN_ORIGINS = ['https://yukktha-sarees-admin.netlify.app'];
const OCCASIONS = ['Wedding', 'Reception', 'Festive', 'Puja', 'Housewarming', 'Special occasion', 'Daily wear', 'Office', 'Party'] as const;
const OCCASION_SENTENCE: Record<string, string> = { Wedding: 'weddings', Reception: 'receptions', Festive: 'festivals', Puja: 'pujas', Housewarming: 'housewarmings', 'Special occasion': 'special occasions', 'Daily wear': 'daily elegance', Office: 'daily elegance', Party: 'special occasions' };

const cors = (origin: string | null) => {
  const h: Record<string, string> = { 'content-type': 'application/json', 'cache-control': 'no-store', vary: 'Origin' };
  if (origin && (ADMIN_ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin) && env('ALLOW_LOCALHOST_ADMIN') === '1')) {
    h['access-control-allow-origin'] = origin; h['access-control-allow-methods'] = 'POST, OPTIONS'; h['access-control-allow-headers'] = 'authorization, content-type'; h['access-control-max-age'] = '600';
  }
  return h;
};
const reply = (data: unknown, status: number, origin: string | null) => new Response(JSON.stringify(data), { status, headers: cors(origin) });

/** The caller must be a Yukktha admin: read users/{uid} with the caller's own login token (Firestore rules let users read themselves). */
async function isAdmin(token: string, uid: string) {
  const pid = env('FIREBASE_PROJECT_ID') || 'yukk-1cf77'; const slug = env('STORE_SLUG') || 'yukktha';
  const res = await fetch('https://firestore.googleapis.com/v1/projects/' + pid + '/databases/(default)/documents/users/' + encodeURIComponent(uid), { headers: { authorization: 'Bearer ' + token } });
  if (!res.ok) return false;
  const f: any = (await res.json()).fields || {};
  const role = f.role && f.role.stringValue; const ids = ((f.projectIds && f.projectIds.arrayValue && f.projectIds.arrayValue.values) || []).map((v: any) => v.stringValue);
  return role === 'super_admin' || (role === 'admin' && ids.includes(slug));
}

const Draft = z.object({
  name: z.string().describe('Shop-style product name, 3-6 words, colour first, e.g. "Peacock Blue Kanjivaram Silk" (no "Saree" at the end)'),
  category: z.string().describe('Exactly one of the provided categories'),
  colour: z.string().describe('Main body colour shade, 1-3 words, e.g. "Peacock blue"'),
  border_and_pallu: z.string().describe('Short note on border/pallu colours and zari, e.g. "Magenta border, gold zari pallu"'),
  motifs: z.array(z.string()).describe('2-5 visible motifs or techniques, e.g. "temple border", "buttas", "checks", "peacock"'),
  occasions: z.array(z.enum(OCCASIONS)).describe('1-3 best occasions'),
  description: z.string().describe('2-4 warm, specific sentences for the website. Describe only what is visible; say "appears" when unsure of fabric. No prices, no claims of pure silk, silk mark, handloom or real zari unless the staff notes say so.'),
  highlights: z.array(z.string()).describe('3 short bullet points for shoppers'),
  check_with_staff: z.string().describe('What staff should confirm before publishing (fabric, weave, blouse piece, length), one sentence')
});

export default async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405, origin);
  if (!aiConfigured()) return reply({ error: 'AI is not switched on yet. Add ANTHROPIC_API_KEY in Netlify (yukktha-sarees → Environment variables).' }, 503, origin);

  const token = bearer(req); const uid = await verifyIdToken(token);
  if (!token || !uid) return reply({ error: 'Please sign in to the admin with your store account.' }, 401, origin);
  if (!(await isAdmin(token, uid))) return reply({ error: 'Only Yukktha admins can use the AI listing writer.' }, 403, origin);

  let body: any; try { body = await req.json(); } catch { return reply({ error: 'Invalid request.' }, 400, origin); }
  const images = (Array.isArray(body.images) ? body.images : []).slice(0, 3)
    .map((u: string) => /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(u || '')))
    .filter(Boolean) as RegExpExecArray[];
  if (!images.length) return reply({ error: 'Add at least one photo first.' }, 400, origin);
  if (images.reduce((a, m) => a + m[2].length, 0) > 4_500_000) return reply({ error: 'The photos are too large — use smaller ones.' }, 413, origin);
  const categories = (Array.isArray(body.categories) ? body.categories : []).map((c: any) => String(c).slice(0, 40)).filter(Boolean).slice(0, 20);
  const cats = categories.length ? categories : ['Kanjivaram Silk', 'Banarasi', 'Kuppadam Pattu', 'Soft Silk', 'Soft Cotton', 'Designer / Party', 'Other'];
  const notes = String(body.notes || '').slice(0, 400);

  try {
    const msg = await claude().beta.messages.parse({
      model: MODEL, max_tokens: 4000, ...FALLBACK,
      system: 'You write product listings for Yukktha, a saree boutique in Hyderabad. You see photos of one saree taken by the shop. Be accurate and specific about what is visible (colours, border, pallu, motifs, zari), warm in tone, and never invent facts such as fabric purity, certification, weaver origin, price or length. Staff will review your draft.',
      output_config: { format: betaZodOutputFormat(Draft) },
      messages: [{ role: 'user', content: [
        ...images.map((m) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: m[1] as 'image/jpeg' | 'image/png' | 'image/webp', data: m[2] } })),
        { type: 'text' as const, text: 'Categories (choose exactly one for "category"): ' + cats.join(', ') + '.' + (notes ? '\nStaff notes (treat as facts): ' + notes : '') + '\nWrite the listing draft for this saree.' }
      ] }]
    });
    if (msg.stop_reason === 'refusal' || !msg.parsed_output) return reply({ error: 'The AI couldn’t write a draft for these photos. Please write it by hand.' }, 422, origin);
    const d = msg.parsed_output;
    const category = cats.find((c: string) => c.toLowerCase() === d.category.toLowerCase()) || cats.find((c: string) => c.toLowerCase().includes(d.category.toLowerCase().split(' ')[0])) || cats[0];
    // The website's occasion filter reads "Ideal for …." from the description.
    const occ = d.occasions[0] ? OCCASION_SENTENCE[d.occasions[0]] : '';
    const description = d.description.trim() + (occ && !/ideal for/i.test(d.description) ? ' Ideal for ' + occ + '.' : '');
    return reply({ draft: { ...d, category, description } }, 200, origin);
  } catch (e) {
    const { status, message } = aiErrorMessage(e);
    return reply({ error: message }, status, origin);
  }
};

export const config = { path: '/ai/listing', method: ['POST', 'OPTIONS'] };
