import { esc, $, $$, toast, field, input, checkbox } from '../ui.js';
import { CONFIG } from '../config.js';

export default {
  id: 'settings', title: 'Store settings', group: 'Store', icon: 'gear', ownerOnly: true,
  async render(view, ctx) {
    const p = ctx.project; let stores = (p.stores || []).map((s) => ({ ...s }));
    const storeRow = (s, i) => '<div class="form-grid card" data-i="' + i + '" style="margin:0 0 12px">' + field('Store name', '<input data-k="label" value="' + esc(s.label || '') + '">') + field('Google Maps search', '<input data-k="mapsQuery" value="' + esc(s.mapsQuery || '') + '">') + '<div class="full">' + field('Address', '<input data-k="address" value="' + esc(s.address || '') + '">') + '</div><div class="full"><button type="button" class="btn sm" data-rm>Remove store</button></div></div>';
    view.innerHTML = '<form id="f" class="stack" style="max-width:900px">' +
      '<div class="card"><h3>Brand</h3><div class="form-grid">' + field('Store name', input('name', p.name || 'Yukktha', 'required')) + field('Tagline', input('tagline', p.tagline || '')) +
      field('WhatsApp number', input('whatsappNumber', p.whatsappNumber || '', 'inputmode="tel"'), 'With country code, e.g. 918341448340') + field('Instagram handle', input('instagramHandle', p.instagramHandle || '')) +
      '<div class="full">' + field('Footer quote', input('footerQuote', p.footerQuote || '')) + '</div><div class="full">' + checkbox('showPrices', p.showPrices !== false, 'Show prices on the website') + '</div></div></div>' +
      '<div class="card"><h3>Weaves / categories</h3><p class="muted">One per line. These appear in the saree form and as collections on the website.</p><label class="field"><textarea name="categories" rows="7">' + esc((p.categories || []).join('\n')) + '</textarea></label></div>' +
      '<div class="card"><h3>Stores <button type="button" class="btn sm" id="addStore">+ Add store</button></h3><div id="stores"></div></div>' +
      '<div class="card"><h3>Links</h3><p>Website: <a href="' + CONFIG.storefrontUrl + '" target="_blank" rel="noopener">' + CONFIG.storefrontUrl + '</a><br>Firebase project: <code>' + esc(CONFIG.firebase.projectId) + '</code> · store <code>' + esc(CONFIG.projectSlug) + '</code></p></div>' +
      '<div><button class="btn primary">Save settings</button></div></form>';
    const drawStores = () => { $('#stores').innerHTML = stores.map(storeRow).join('') || '<p class="muted">No stores.</p>'; $$('[data-rm]', view).forEach((b) => b.addEventListener('click', () => { collect(); stores.splice(Number(b.closest('[data-i]').dataset.i), 1); drawStores(); })); };
    const collect = () => { stores = $$('#stores [data-i]').map((row) => { const o = {}; $$('[data-k]', row).forEach((i) => { o[i.dataset.k] = i.value.trim(); }); return o; }); };
    $('#addStore').addEventListener('click', () => { collect(); stores.push({ label: '', address: '', mapsQuery: '' }); drawStores(); });
    drawStores();
    $('#f').addEventListener('submit', async (e) => {
      e.preventDefault(); collect(); const f = e.target;
      const categories = f.categories.value.split('\n').map((s) => s.trim()).filter(Boolean);
      const clean = stores.filter((s) => s.label || s.address);
      try {
        await ctx.api.updateProject({ name: f.name.value.trim(), tagline: f.tagline.value.trim(), whatsappNumber: f.whatsappNumber.value.replace(/\D/g, ''), instagramHandle: f.instagramHandle.value.trim().replace(/^@/, ''), footerQuote: f.footerQuote.value.trim(), showPrices: f.showPrices.checked, categories, stores: clean, addresses: clean.map((s) => s.address) });
        await ctx.reloadProject(); toast('Settings saved');
      } catch (err) { toast(err.message, 'err'); }
    });
  }
};
