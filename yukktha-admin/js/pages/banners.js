import { esc, $, $$, toast, modal, confirmBox, field, input, select, checkbox, fmtDate, ts, compressImage, empty } from '../ui.js';
import { CONFIG } from '../config.js';

const STYLES = [['spotlight', 'Spotlight — big animated feature on the home page'], ['ribbon', 'Top ribbon — slim animated strip on every page'], ['popup', 'Pop-up — offer card that opens once per visit']];
const STYLE_SHORT = { spotlight: 'Spotlight', ribbon: 'Top ribbon', popup: 'Pop-up' };
const THEMES = [['maroon', 'Royal maroon & gold'], ['gold', 'Antique gold'], ['emerald', 'Emerald & gold'], ['rose', 'Rose blush'], ['midnight', 'Midnight & gold']];
const SWATCH = { maroon: 'linear-gradient(135deg,#a8384f,#2a0811)', gold: 'linear-gradient(135deg,#fff6dc,#d9b56f)', emerald: 'linear-gradient(135deg,#2d8a69,#062218)', rose: 'linear-gradient(135deg,#fff3f5,#e7aebb)', midnight: 'linear-gradient(135deg,#3a2f6b,#05040c)' };
const LINKS = [['', '— no link —'], ['collection.html?c=new-arrivals', 'What’s New'], ['collection.html?c=all', 'All sarees'], ['collection.html?c=kanjivaram-silk', 'Kanjivaram Silk'], ['collection.html?c=banarasi', 'Banarasi'], ['collection.html?c=kuppadam-pattu', 'Kuppadam Pattu'], ['collection.html?c=soft-silk', 'Soft Silk'], ['collection.html?c=soft-cotton', 'Soft Cotton'], ['collection.html?c=designer-party', 'Designer & Party'], ['collection.html?c=under-10000', 'Under ₹10,000'], ['collection.html?c=occasion-wedding', 'Wedding'], ['collection.html?c=occasion-festive', 'Festive'], ['custom', 'Other link or phone number…']];

const toLocal = (iso) => { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return ''; const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); };
const fromLocal = (v) => v ? new Date(v).toISOString() : null;
function status(b) {
  const now = Date.now();
  if (!b.active) return ['Hidden', ''];
  if (b.startAt && ts(b.startAt) > now) return ['Scheduled', 'info'];
  if (b.endAt && ts(b.endAt) <= now) return ['Ended', 'warn'];
  return ['Live', 'ok'];
}

export default {
  id: 'banners', title: 'Banners', group: 'Catalogue', icon: 'flag',
  async render(view, ctx) {
    const { api } = ctx;
    let [rows, coupons] = await Promise.all([api.list('banners'), api.list('coupons').catch(() => [])]);
    if (ctx.stale()) return;
    const draw = () => {
      rows.sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0) || ts(b.createdAt) - ts(a.createdAt));
      const live = rows.filter((b) => status(b)[0] === 'Live');
      view.innerHTML = '<div class="kpis"><div class="kpi accent"><span>Live now</span><strong>' + live.length + '</strong><small>' + (live.map((b) => STYLE_SHORT[b.style || 'ribbon']).join(' · ') || 'nothing showing') + '</small></div><div class="kpi"><span>Scheduled</span><strong>' + rows.filter((b) => status(b)[0] === 'Scheduled').length + '</strong></div><div class="kpi"><span>All banners</span><strong>' + rows.length + '</strong></div></div>' +
        '<div class="bar"><p class="muted grow" style="margin:0">One spotlight slideshow on the home page (all live spotlights rotate), plus the highest-priority live ribbon and pop-up. Schedule start and end times, and add a countdown to create urgency.</p><a class="btn" href="' + CONFIG.storefrontUrl + '" target="_blank" rel="noopener">View website ↗</a><button class="btn primary" id="new">+ New banner</button></div>' +
        '<div class="bnr-list">' + (rows.length ? rows.map((b) => { const st = status(b); return '<article class="card bnr" data-id="' + esc(b.id) + '">' +
          '<div class="bnr-thumb" style="background:' + (SWATCH[b.theme] || SWATCH.maroon) + '">' + (b.imageUrl ? '<img src="' + esc(b.imageUrl) + '" alt="">' : '') + '<span>' + esc(STYLE_SHORT[b.style || 'ribbon']) + '</span></div>' +
          '<div class="bnr-body"><div class="bnr-top"><strong>' + esc(b.title || 'Untitled') + '</strong><span class="pill ' + st[1] + '">' + st[0] + '</span>' + (Number(b.priority) ? '<span class="pill">Priority ' + Number(b.priority) + '</span>' : '') + '</div>' +
          '<p>' + esc(b.message || '') + '</p><p class="cell-sub">' + (b.startAt || b.endAt ? (b.startAt ? 'From ' + fmtDate(b.startAt, true) : 'Now') + ' → ' + (b.endAt ? fmtDate(b.endAt, true) : 'no end') : 'No schedule') + (b.couponCode ? ' · Code ' + esc(b.couponCode) : '') + (b.countdown && b.endAt ? ' · Countdown' : '') + '</p></div>' +
          '<div class="bnr-acts"><label class="switch" title="Show on website"><input type="checkbox" data-toggle' + (b.active ? ' checked' : '') + '><span></span></label><button class="btn sm" data-edit>Edit</button><button class="btn sm" data-copy>Duplicate</button><button class="icon-btn" data-del title="Delete">🗑</button></div></article>'; }).join('')
          : empty('No banners yet. Create a festive spotlight, a sale ribbon or an offer pop-up.', '<button class="btn primary" data-first>Create your first banner</button>')) + '</div>';
      $('#new').addEventListener('click', () => edit(null));
      const first = view.querySelector('[data-first]'); if (first) first.addEventListener('click', () => edit(null));
      view.querySelector('.bnr-list').addEventListener('click', async (e) => {
        const card = e.target.closest('[data-id]'); if (!card) return; const b = rows.find((x) => x.id === card.dataset.id);
        if (e.target.closest('[data-edit]')) edit(b);
        else if (e.target.closest('[data-copy]')) { const c = { ...b }; delete c.id; c.title = (c.title || '') + ' (copy)'; c.active = false; await api.add('banners', c); toast('Duplicated (hidden)'); await reload(); }
        else if (e.target.closest('[data-del]')) { if (await confirmBox('Delete the banner “' + (b.title || '') + '”?')) { await api.remove('banners', b.id); toast('Deleted'); await reload(); } }
      });
      view.querySelectorAll('[data-toggle]').forEach((t) => t.addEventListener('change', async () => {
        const b = rows.find((x) => x.id === t.closest('[data-id]').dataset.id);
        try { await api.update('banners', b.id, { active: t.checked }); toast(t.checked ? 'Showing on the website' : 'Hidden from the website'); await reload(); } catch (er) { toast(er.message, 'err'); t.checked = !t.checked; }
      }));
    };
    const reload = async () => { rows = await api.list('banners'); draw(); };

    async function edit(b) {
      const d = b ? { ...b } : { style: 'spotlight', theme: 'maroon', active: true, priority: 0, pages: 'all', kicker: 'Festive edit', title: 'The Wedding Season Edit', message: 'Handpicked Kanjivaram and Banarasi silks for every muhurtham. Visit our stores or shop online.', ctaLabel: 'Shop the edit', ctaLink: 'collection.html?c=occasion-wedding' };
      let image = d.imageUrl || '';
      const linkKnown = LINKS.some((l) => l[0] === (d.ctaLink || '') && l[0] !== 'custom');
      const couponOpts = [['', '— none —']].concat(coupons.filter((c) => !c.used).map((c) => [c.code, c.code + ' · ' + (c.discountType === 'percent' ? c.discountValue + '% off' : '₹' + c.discountValue + ' off')]));
      const body = '<div class="bnr-editor"><div class="bnr-form form-grid">' +
        '<p class="section-h">Type & look</p><div class="full">' + field('Banner style', select('style', STYLES, d.style || 'ribbon')) + '</div>' +
        '<div class="full field"><span>Colour theme</span><div class="theme-pick">' + THEMES.map(([k, l]) => '<label title="' + esc(l) + '"><input type="radio" name="theme" value="' + k + '"' + ((d.theme || 'maroon') === k ? ' checked' : '') + '><i style="background:' + SWATCH[k] + '"></i><small>' + esc(l.split(' ')[0] === 'Royal' ? 'Maroon' : l.split(' ')[0]) + '</small></label>').join('') + '</div></div>' +
        '<p class="section-h">Words</p>' + field('Small line above the title', input('kicker', d.kicker, 'maxlength="40" placeholder="e.g. Diwali 2026"')) + field('Title', input('title', d.title, 'required maxlength="60"')) +
        '<div class="full">' + field('Message', '<textarea name="message" rows="2" maxlength="220">' + esc(d.message || '') + '</textarea>') + '</div>' +
        field('Button text', input('ctaLabel', d.ctaLabel, 'maxlength="28" placeholder="Shop now"')) + field('Button goes to', select('linkPick', LINKS, linkKnown ? (d.ctaLink || '') : 'custom')) +
        '<div class="full" id="customWrap">' + field('Link or phone number', input('ctaLinkCustom', linkKnown ? '' : d.ctaLink, 'placeholder="https://… or 8341448340"')) + '</div>' +
        field('Coupon to show', select('couponCode', couponOpts.concat(d.couponCode && !couponOpts.some((c) => c[0] === d.couponCode) ? [[d.couponCode, d.couponCode]] : []), d.couponCode || '')) +
        field('Show on', select('pages', [['all', 'Every page'], ['home', 'Home page only']], d.pages || 'all'), 'Spotlights always show on the home page.') +
        '<p class="section-h">Photo</p><div class="full"><div class="img-pick" id="bImg"></div><small class="muted">Optional. A portrait photo looks best (it’s framed and tilts in 3D). Resized automatically.</small></div>' +
        '<p class="section-h">When</p>' + field('Start', input('startAt', toLocal(d.startAt), 'type="datetime-local"'), 'Empty = straight away') + field('End', input('endAt', toLocal(d.endAt), 'type="datetime-local"'), 'Empty = until you hide it') +
        '<div class="full">' + checkbox('countdown', d.countdown, 'Show a live countdown to the end time') + '</div>' +
        field('Priority', input('priority', d.priority || 0, 'type="number" min="0" max="99"'), 'Higher shows first') + '<div class="field"><span>Visibility</span>' + checkbox('active', d.active !== false, 'Show on the website') + '</div>' +
        '</div><div class="bnr-preview"><div class="bnr-preview-head"><b>Live preview</b><span class="pv-mode"><button type="button" class="on" data-mode="desk">Desktop</button><button type="button" data-mode="phone">Phone</button></span><button type="button" class="btn sm" id="replay">Replay</button></div><div class="pv-wrap desk" id="pvWrap"><iframe id="pv" title="Banner preview" src="' + CONFIG.storefrontUrl + 'banner-preview.html"></iframe></div><p class="tiny muted">Exactly as it will look on the website (Ivory design).</p></div></div>';
      const v = await modal({ title: b ? 'Edit banner' : 'New banner', wide: true, submit: b ? 'Save banner' : 'Create banner', body,
        onOpen(f, onSubmit) {
          f.closest('.modal').classList.add('xwide');
          const pick = $('#bImg', f);
          const drawImg = () => {
            pick.innerHTML = (image ? '<figure><img src="' + esc(image) + '" alt=""><button type="button" data-rm aria-label="Remove">✕</button></figure>' : '') + '<label class="img-add">' + (image ? 'Change' : '+ Add') + '<br>photo<input type="file" accept="image/*" hidden></label>';
            const rm = $('[data-rm]', pick); if (rm) rm.addEventListener('click', () => { image = ''; drawImg(); send(); });
            $('input[type=file]', pick).addEventListener('change', async (e) => { const file = e.target.files[0]; if (!file) return; try { image = await compressImage(file, 1400, 0.76); } catch (er) { toast(er.message, 'err'); } drawImg(); send(); });
          };
          drawImg();
          const syncLink = () => { $('#customWrap', f).hidden = f.linkPick.value !== 'custom'; };
          f.linkPick.addEventListener('change', syncLink); syncLink();
          const data = () => ({
            style: f.style.value, theme: (f.querySelector('input[name=theme]:checked') || {}).value || 'maroon',
            kicker: f.kicker.value.trim(), title: f.title.value.trim(), message: f.message.value.trim(), ctaLabel: f.ctaLabel.value.trim(),
            ctaLink: f.linkPick.value === 'custom' ? f.ctaLinkCustom.value.trim() : f.linkPick.value,
            couponCode: f.couponCode.value || null, pages: f.pages.value, imageUrl: image || null,
            startAt: fromLocal(f.startAt.value), endAt: fromLocal(f.endAt.value), countdown: f.countdown.checked && !!f.endAt.value,
            priority: Math.max(0, Math.min(99, Number(f.priority.value) || 0)), active: f.active.checked
          });
          const frame = $('#pv', f); const origin = new URL(CONFIG.storefrontUrl).origin;
          const send = () => { try { const x = data(); if (x.countdown === false && f.countdown.checked && !f.endAt.value) x.countdown = false; frame.contentWindow.postMessage({ yukkthaBanner: { ...x, endAt: x.endAt || (f.countdown.checked ? new Date(Date.now() + 3 * 86400000).toISOString() : null), countdown: f.countdown.checked } }, origin); } catch (e) { /* frame not ready */ } };
          let timer; const later = () => { clearTimeout(timer); timer = setTimeout(send, 250); };
          f.addEventListener('input', later); f.addEventListener('change', later);
          const onMsg = (e) => { if (e.origin === origin && e.data && e.data.yukkthaPreviewReady) send(); };
          window.addEventListener('message', onMsg);
          frame.addEventListener('load', () => setTimeout(send, 300));
          $('#replay', f).addEventListener('click', send);
          // desktop preview = the real 1440px layout scaled down to fit; phone = 390px wide
          const wrap = $('#pvWrap', f);
          const fit = () => { const k = wrap.classList.contains('desk') ? wrap.clientWidth / 1440 : Math.min(1, (wrap.clientHeight - 10) / 760); frame.style.setProperty('--k', k.toFixed(4)); };
          f.querySelectorAll('[data-mode]').forEach((bt) => bt.addEventListener('click', () => { f.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x === bt)); wrap.className = 'pv-wrap ' + bt.dataset.mode; fit(); setTimeout(send, 150); }));
          setTimeout(fit, 30); window.addEventListener('resize', fit);
          const stop = new MutationObserver(() => { if (!document.body.contains(f)) { window.removeEventListener('message', onMsg); stop.disconnect(); } }); stop.observe(document.body, { childList: true });
          onSubmit(async () => {
            const x = data();
            if (!x.title) throw new Error('Give the banner a title.');
            if (x.startAt && x.endAt && ts(x.endAt) <= ts(x.startAt)) throw new Error('The end time must be after the start time.');
            if (f.countdown.checked && !x.endAt) throw new Error('Set an end time to show a countdown.');
            const size = (x.imageUrl || '').length; if (size > 850000) throw new Error('The photo is too large. Please choose a smaller one.');
            if (b) await api.update('banners', b.id, x); else await api.add('banners', x);
            return true;
          });
        } });
      if (v) { toast(b ? 'Banner saved' : 'Banner created'); await reload(); }
    }
    draw();
  }
};
