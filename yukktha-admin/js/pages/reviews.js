import { esc, $, $$, toast, modal, confirmBox, field, input, select, fmtDate, ts, today, imageUrl, empty } from '../ui.js';
import { CONFIG } from '../config.js';

export const SOURCES = { store: 'Shared in store', whatsapp: 'Shared on WhatsApp', phone: 'Shared on a call', email: 'Shared by email', instagram: 'Shared on Instagram' };
const STATUS = { pending: ['Waiting', 'warn'], approved: ['Published', 'ok'], rejected: ['Hidden', 'err'] };
const stars = (n) => '<span class="rv-stars" aria-label="' + n + ' out of 5">' + '★'.repeat(Math.round(n)) + '<i>' + '★'.repeat(5 - Math.round(n)) + '</i></span>';

export default {
  id: 'reviews', title: 'Reviews', group: 'Catalogue', icon: 'star',
  async render(view, ctx) {
    const { api } = ctx;
    let [rows, sarees, orders] = await Promise.all([api.list('reviews'), api.list('sarees'), api.list('orders').catch(() => [])]);
    if (ctx.stale()) return;
    let tab = ['pending', 'approved', 'rejected', 'all'].includes(ctx.param) ? ctx.param : 'pending';
    // Did this reviewer buy this saree? (signed-in orders carry customerUid)
    const bought = (r) => orders.some((o) => o.customerUid && o.customerUid === r.uid && !['cancelled', 'pending_payment'].includes(o.status) && (o.items || []).some((i) => i.itemId === r.productId));
    const draw = () => {
      const n = (s) => rows.filter((r) => (r.status || 'pending') === s).length;
      const list = rows.filter((r) => tab === 'all' || (r.status || 'pending') === tab).sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
      const pub = rows.filter((r) => r.status === 'approved'); const avg = pub.length ? pub.reduce((a, r) => a + Number(r.rating || 0), 0) / pub.length : 0;
      view.innerHTML = '<div class="kpis"><div class="kpi accent"><span>Waiting for approval</span><strong>' + n('pending') + '</strong></div><div class="kpi"><span>Published</span><strong>' + n('approved') + '</strong></div><div class="kpi"><span>Average rating</span><strong>' + (pub.length ? avg.toFixed(1) + ' ★' : '—') + '</strong><small>of published reviews</small></div><div class="kpi"><span>Hidden</span><strong>' + n('rejected') + '</strong></div></div>' +
        '<div class="tabs">' + [['pending', 'Waiting (' + n('pending') + ')'], ['approved', 'Published'], ['rejected', 'Hidden'], ['all', 'All']].map(([k, l]) => '<button data-t="' + k + '" class="' + (k === tab ? 'on' : '') + '">' + l + '</button>').join('') + '</div>' +
        '<div class="bar"><p class="muted tiny grow" style="margin:0">Customers write reviews from the saree page after signing in; they appear only after you publish them. “Bought it” means the reviewer has an order for this saree. To get more reviews, use “Ask for review” on delivered orders.</p><button class="btn primary" id="addRv">+ Add a customer’s review</button></div>' +
        '<div class="rv-admin">' + (list.length ? list.map((r) => {
          const s = sarees.find((x) => x.id === r.productId); const st = STATUS[r.status || 'pending']; const b = bought(r);
          return '<article class="card rv-card" data-id="' + esc(r.id) + '"><div class="rv-prod">' + (s ? '<img class="thumb" src="' + esc(imageUrl(s.imageUrl)) + '" alt="">' : '') + '<div><a href="' + CONFIG.storefrontUrl + 'product.html?id=' + encodeURIComponent(r.productId) + '" target="_blank" rel="noopener" class="cell-main">' + esc(r.productName || (s && s.name) || 'Saree') + ' ↗</a><div class="cell-sub">' + esc(r.name || 'Customer') + ' · ' + fmtDate(r.createdAt) + '</div></div><span class="pill ' + st[1] + '">' + st[0] + '</span></div>' +
            '<div class="rv-body">' + (r.source ? '<span class="pill plum">' + esc(SOURCES[r.source] || r.source) + ' · added by ' + esc(r.addedBy || 'staff') + '</span> ' : '') + stars(Number(r.rating) || 0) + (b ? ' <span class="pill ok">✓ Bought it</span>' : ' <span class="pill">No matching order</span>') + (r.title ? '<h4>' + esc(r.title) + '</h4>' : '') + '<p>' + esc(r.text) + '</p>' + (r.storeReply ? '<div class="rv-reply"><b>Your reply</b> ' + esc(r.storeReply) + '</div>' : '') + '</div>' +
            '<div class="rv-acts">' + (r.status !== 'approved' ? '<button class="btn sm primary" data-a="approve">Publish</button>' : '') + (r.status !== 'rejected' ? '<button class="btn sm" data-a="reject">Hide</button>' : '') + '<button class="btn sm" data-a="reply">' + (r.storeReply ? 'Edit reply' : 'Reply') + '</button><button class="icon-btn" data-a="delete" title="Delete">🗑</button></div></article>';
        }).join('') : empty(tab === 'pending' ? 'No reviews waiting. New reviews from customers will appear here.' : 'Nothing here.')) + '</div>';
      $$('[data-t]', view).forEach((b) => b.addEventListener('click', () => { tab = b.dataset.t; history.replaceState(null, '', '#/reviews/' + tab); draw(); }));
      view.querySelector('.rv-admin').addEventListener('click', act);
      $('#addRv').addEventListener('click', addReview);
    };
    const reload = async () => { rows = await api.list('reviews'); draw(); };
    // Feedback a real customer gave in the store, on WhatsApp or on a call, typed in by staff.
    async function addReview() {
      const opts = sarees.slice().sort((a, b) => String(a.name).localeCompare(b.name)).map((s) => [s.id, s.name + (s.category ? ' — ' + s.category : '')]);
      const v = await modal({ title: 'Add a customer’s review', wide: true, submit: 'Publish review',
        body: '<div class="alert info"><strong>Only real feedback</strong><p>Use this for what an actual customer told you in the store, on WhatsApp or on a call. The review shows publicly with where it came from (e.g. “Shared on WhatsApp”). Never enter reviews nobody gave — fake reviews mislead shoppers and are against consumer-protection rules.</p></div>' +
          '<div class="form-grid">' + '<div class="full">' + field('Saree', select('productId', opts)) + '</div>' +
          field('Customer’s name (shown as first name + initial)', input('cname', '', 'required placeholder="e.g. Lakshmi Reddy"')) + field('Where they shared it', select('source', Object.keys(SOURCES).map((k) => [k, SOURCES[k]]))) +
          field('Rating they gave', select('rating', [['5', '★★★★★  5'], ['4', '★★★★  4'], ['3', '★★★  3'], ['2', '★★  2'], ['1', '★  1']])) + field('Date they shared it', input('date', today(), 'type="date" max="' + today() + '"')) +
          '<div class="full">' + field('Headline (optional)', input('title', '', 'maxlength="120"')) + '</div>' +
          '<div class="full">' + field('Their words', '<textarea name="text" rows="4" maxlength="2000" placeholder="Paste or type what the customer said"></textarea>', 'Use their own words. You can tidy spelling but not change the meaning.') + '</div>' +
          '<div class="full"><label class="check"><input type="checkbox" name="consent"> This customer really gave this feedback and is happy for it to be shown on the website.</label></div></div>',
        onOpen(f, onSubmit) {
          onSubmit(async () => {
            if (!f.cname.value.trim()) throw new Error('Enter the customer’s name.');
            if (f.text.value.trim().length < 10) throw new Error('Enter what the customer said.');
            if (!f.consent.checked) throw new Error('Tick the box to confirm this is a real customer’s feedback and they agreed to it being shown.');
            const s = sarees.find((x) => x.id === f.productId.value); const parts = f.cname.value.trim().split(/\s+/);
            await api.add('reviews', { productId: s.id, productName: s.name, rating: Number(f.rating.value), title: f.title.value.trim(), text: f.text.value.trim(),
              name: parts[0] + (parts[1] ? ' ' + parts[1][0] + '.' : ''), uid: 'staff:' + ctx.session.uid, source: f.source.value, addedBy: ctx.session.email,
              status: 'approved', verified: false, createdAt: new Date(f.date.value || today()).toISOString(), moderatedBy: ctx.session.email });
            return true;
          });
        } });
      if (v) { toast('Review published'); tab = 'approved'; await reload(); }
    }
    async function act(e) {
      const b = e.target.closest('[data-a]'); if (!b) return; const card = b.closest('[data-id]'); const r = rows.find((x) => x.id === card.dataset.id);
      try {
        if (b.dataset.a === 'approve') { await api.update('reviews', r.id, { status: 'approved', verified: bought(r), moderatedBy: ctx.session.email, moderatedAt: api.NOW }); toast('Published on the website'); }
        else if (b.dataset.a === 'reject') { await api.update('reviews', r.id, { status: 'rejected', moderatedBy: ctx.session.email, moderatedAt: api.NOW }); toast('Hidden from the website'); }
        else if (b.dataset.a === 'reply') {
          const v = await modal({ title: 'Reply to ' + (r.name || 'customer'), submit: 'Save reply', body: '<p class="muted">' + esc(r.text) + '</p>' + field('Your reply (shown under the review)', '<textarea name="storeReply" rows="4" maxlength="600">' + esc(r.storeReply || '') + '</textarea>', 'Leave empty to remove the reply.') });
          if (!v) return; await api.update('reviews', r.id, { storeReply: v.storeReply || null }); toast('Reply saved');
        } else if (b.dataset.a === 'delete') { if (!await confirmBox('Delete this review permanently?')) return; await api.remove('reviews', r.id); toast('Deleted'); }
        await reload();
      } catch (ex) { toast(ex.message, 'err'); }
    }
    draw();
  }
};
