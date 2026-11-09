// My account: sign in / create account / reset password; orders, profile, address, reviews.
(function () {
  const Y = window.Yukktha; const A = Y.account; const esc = Y.esc;
  const $ = (id) => document.getElementById(id);
  const root = $('acct');
  const next = new URLSearchParams(location.search).get('next');
  const STATUS = { pending_payment: ['Payment pending', 'warn'], paid: ['Paid', 'ok'], confirmed: ['Confirmed', 'ok'], preparing: ['Being prepared', 'info'], ready: ['Ready / shipped', 'info'], completed: ['Delivered', 'ok'], cancelled: ['Cancelled', 'err'], returned: ['Returned', 'err'] };
  const REVIEW = { pending: ['Awaiting approval', 'warn'], approved: ['Published', 'ok'], rejected: ['Not published', 'err'] };
  const fmt = (d) => { const t = new Date(d); return isNaN(t) ? '' : t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const msg = (el, text, kind) => { el.textContent = text || ''; el.className = 'acct-msg ' + (kind || ''); el.hidden = !text; };
  let tab = 'signin';

  function authView() {
    const fod = (projectCache || {}).firstOrderDiscount;
    const perk = fod && fod.enabled && fod.value ? '<div class="acct-perk">🎁 Create an account and get <b>' + (fod.type === 'percent' ? fod.value + '% off' : Y.inr(fod.value) + ' off') + '</b> your first order.</div>' : '';
    root.innerHTML = '<section class="acct-auth"><div class="acct-auth-art"><img src="assets/img/kanjivaram-model.jpg" alt=""><div><p class="sec-kicker light">Welcome to Yukktha</p><h2>Your saree wardrobe, in one place</h2><ul><li>Track your orders</li><li>Faster checkout with saved address</li><li>Review the sarees you love</li><li>First-order offers</li></ul></div></div>' +
      '<div class="acct-auth-card"><div class="acct-tabs" role="tablist"><button data-tab="signin" class="' + (tab === 'signin' ? 'on' : '') + '">Sign in</button><button data-tab="signup" class="' + (tab === 'signup' ? 'on' : '') + '">Create account</button></div>' + perk +
      (tab === 'signin'
        ? '<form id="fIn" class="stack-f" novalidate><label class="ck-field"><span>Email</span><input name="email" type="email" autocomplete="username" required></label><label class="ck-field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label><p class="acct-msg" id="m" hidden></p><button class="btn btn-solid btn-block">Sign in</button><button type="button" class="link-btn" id="forgot">Forgot password?</button></form>'
        : '<form id="fUp" class="stack-f" novalidate><label class="ck-field"><span>Full name</span><input name="name" autocomplete="name" required></label><label class="ck-field"><span>Mobile number</span><input name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" required></label><label class="ck-field"><span>Email</span><input name="email" type="email" autocomplete="email" required></label><label class="ck-field"><span>Password</span><input name="password" type="password" autocomplete="new-password" minlength="6" required><small>At least 6 characters</small></label><p class="acct-msg" id="m" hidden></p><button class="btn btn-solid btn-block">Create account</button><p class="tiny-note">Already shopped with us on the BrightLoop store page? Use that same email and password to sign in.</p></form>') +
      '</div></section>';
    root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; authView(); }));
    const m = $('m');
    const busy = (f, on, label) => { const b = f.querySelector('.btn'); b.disabled = on; if (label) b.textContent = label; };
    if ($('fIn')) {
      $('fIn').addEventListener('submit', async (e) => { e.preventDefault(); const f = e.target; busy(f, true, 'Signing in…'); msg(m, ''); try { await A.signIn(f.email.value, f.password.value); afterLogin(); } catch (ex) { msg(m, ex.message, 'err'); busy(f, false, 'Sign in'); } });
      $('forgot').addEventListener('click', async () => { const em = $('fIn').email.value.trim(); if (!em) { msg(m, 'Type your email above, then tap “Forgot password?”.', 'info'); return; } try { await A.resetPassword(em); msg(m, 'We’ve emailed a password reset link to ' + em + '. Check spam if you don’t see it.', 'ok'); } catch (ex) { msg(m, ex.message, 'err'); } });
    } else {
      $('fUp').addEventListener('submit', async (e) => { e.preventDefault(); const f = e.target; busy(f, true, 'Creating account…'); msg(m, ''); try { await A.signUp({ name: f.name.value, phone: f.phone.value, email: f.email.value, password: f.password.value }); afterLogin(); } catch (ex) { msg(m, ex.message, 'err'); busy(f, false, 'Create account'); } });
    }
  }
  function afterLogin() { if (next && /^[a-z0-9-]+\.html(\?[^#]*)?$/i.test(next)) location.href = next; else render(); }

  function joinView() {
    root.innerHTML = '<section class="acct-join"><h1>Complete your Yukktha profile</h1><p>You’re signed in as <b>' + esc(A.state.user.email) + '</b> from another store. Add your details to shop at Yukktha with the same login.</p>' +
      '<form id="fJ" class="stack-f" novalidate><label class="ck-field"><span>Full name</span><input name="name" required></label><label class="ck-field"><span>Mobile number</span><input name="phone" type="tel" inputmode="numeric" required></label><p class="acct-msg" id="m" hidden></p><button class="btn btn-solid btn-block">Continue</button><button type="button" class="link-btn" id="out">Use a different account</button></form></section>';
    $('fJ').addEventListener('submit', async (e) => { e.preventDefault(); try { await A.joinStore({ name: e.target.name.value, phone: e.target.phone.value }); afterLogin(); } catch (ex) { msg($('m'), ex.message, 'err'); } });
    $('out').addEventListener('click', () => A.signOut());
  }

  async function dashView() {
    const p = A.state.profile;
    root.innerHTML = '<section class="acct-dash"><header class="acct-hello"><div><p class="sec-kicker left">My account</p><h1>Namaste, ' + esc(A.firstName()) + '</h1><p>' + esc(p.email || A.state.user.email) + (p.mobile ? ' · ' + esc(p.mobile) : '') + '</p></div><button class="btn btn-outline" id="out">Sign out</button></header>' +
      '<div class="acct-grid"><div><div class="acct-card"><h2>My orders</h2><div id="orders"><p class="muted-p">Loading…</p></div></div><div class="acct-card"><h2>My reviews</h2><div id="reviews"><p class="muted-p">Loading…</p></div></div></div>' +
      '<div><div class="acct-card"><h2>Profile & delivery address</h2><form id="fP" class="stack-f" novalidate><label class="ck-field"><span>Full name</span><input name="name" value="' + esc(p.name || '') + '"></label><label class="ck-field"><span>Mobile</span><input name="mobile" value="' + esc(p.mobile || '') + '" inputmode="numeric"></label>' +
      '<label class="ck-field"><span>Delivery address</span><textarea name="address" rows="3">' + esc(p.address || '') + '</textarea></label><label class="ck-field"><span>Pincode</span><input name="pincode" maxlength="6" inputmode="numeric" value="' + esc(p.pincode || '') + '"></label><p class="acct-msg" id="pm" hidden></p><button class="btn btn-solid btn-block">Save</button></form></div>' +
      '<div class="acct-card acct-links"><a href="collection.html?c=new-arrivals">New arrivals →</a><a href="#" data-open="wish">My wishlist →</a><a target="_blank" rel="noopener" href="' + Y.waLink('Hello Yukktha, I need help with my order.') + '">Help on WhatsApp →</a></div></div></div></section>';
    $('out').addEventListener('click', async () => { await A.signOut(); });
    $('fP').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target; const m = $('pm');
      if (f.pincode.value && !/^\d{6}$/.test(f.pincode.value.trim())) { msg(m, 'Pincode should be 6 digits.', 'err'); return; }
      try { await A.updateProfile({ name: f.name.value.trim(), mobile: f.mobile.value, address: f.address.value.trim(), pincode: f.pincode.value.trim() }); msg(m, 'Saved.', 'ok'); } catch (ex) { msg(m, ex.message, 'err'); }
    });
    try {
      const orders = await A.orders();
      $('orders').innerHTML = orders.length ? orders.map((o) => { const s = STATUS[o.status] || [o.status || 'Placed', 'info']; const total = Number(o.total || 0) || (o.items || []).reduce((a, i) => a + Number(i.price || 0) * Number(i.qty || 1), 0);
        return '<article class="acct-order"><div class="ao-top"><div><b>Order ' + esc(o.invoiceNumber || o.invoiceNo || o.id.slice(0, 8).toUpperCase()) + '</b><small>' + fmt(o.createdAt) + '</small></div><span class="pill ' + s[1] + '">' + esc(s[0]) + '</span></div>' +
          '<div class="ao-items">' + (o.items || []).map((i) => '<span>' + esc(i.name || 'Saree') + ' × ' + (i.qty || 1) + '</span>').join('') + '</div>' +
          '<div class="ao-foot"><strong>' + Y.inr(total) + '</strong><a target="_blank" rel="noopener" href="' + Y.waLink('Hello Yukktha, about my order ' + (o.invoiceNumber || o.id) + ': ') + '">Need help?</a></div></article>'; }).join('')
        : '<div class="acct-empty"><p>No orders yet.</p><a class="btn btn-solid" href="collection.html?c=all">Start shopping</a></div>';
    } catch (ex) { $('orders').innerHTML = '<p class="muted-p">' + esc(ex.message) + '</p>'; }
    try {
      const rv = await A.myReviews();
      $('reviews').innerHTML = rv.length ? rv.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map((r) => { const s = REVIEW[r.status] || REVIEW.pending;
        return '<article class="acct-review"><div class="ao-top"><a href="product.html?id=' + encodeURIComponent(r.productId) + '">' + esc(r.productName || 'Saree') + '</a><span class="pill ' + s[1] + '">' + s[0] + '</span></div>' + A.stars(r.rating) + (r.title ? '<b>' + esc(r.title) + '</b>' : '') + '<p>' + esc(r.text) + '</p></article>'; }).join('')
        : '<p class="muted-p">You haven’t reviewed any sarees yet. Open a saree you bought and tap “Write a review”.</p>';
    } catch (ex) { $('reviews').innerHTML = '<p class="muted-p">Reviews will appear here once they’re switched on.</p>'; }
  }

  let projectCache = null;
  function render() {
    if (!A.state.ready) return;
    if (!A.state.user) authView(); else if (!A.state.profile) joinView(); else dashView();
  }
  Y.loadProject().then((p) => { projectCache = p; if (A.state.ready && !A.state.user) authView(); });
  if (new URLSearchParams(location.search).get('tab') === 'signup') tab = 'signup';
  A.ready();
  let last = '';
  A.on((s) => { const key = (s.user ? s.user.uid : '-') + (s.profile ? '+' : ''); if (key !== last) { last = key; render(); } });
})();
