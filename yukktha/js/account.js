// Customer accounts and reviews.
//
// Accounts use the same Firebase Auth + projects/<slug>/customers/<uid> profile
// as the earlier Yukktha store page, so existing customer logins work here too, and
// orders placed while signed in carry customerUid (which unlocks the first-order
// discount and the "My orders" list).
//
// Reviews live in projects/<slug>/reviews. Customers submit them as "pending";
// the shop approves them in the Yukktha admin before they appear.
(function () {
  const Y = window.Yukktha; const CFG = Y.CFG; const F = CFG.firebase; const slug = F.projectSlug;
  const listeners = [];
  const state = { ready: false, user: null, profile: null };
  let sdk = null; let readyResolve; const readyP = new Promise((r) => { readyResolve = r; });

  async function boot() {
    if (sdk) return sdk;
    sdk = (async () => {
      const base = CFG.firebaseSdk;
      const [{ initializeApp }, A, D] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')]);
      const app = initializeApp({ apiKey: F.apiKey, authDomain: F.authDomain, projectId: F.projectId, storageBucket: F.storageBucket, messagingSenderId: F.messagingSenderId, appId: F.appId }, 'yukktha-customer');
      const auth = A.getAuth(app); const db = D.getFirestore(app);
      A.onAuthStateChanged(auth, async (user) => {
        // Keep a profile signUp() just wrote for this same user (the read below can race it).
        if (!user || !state.profile || state.profile.uid !== user.uid) state.profile = null;
        state.user = user || null;
        if (user) {
          try { const snap = await D.getDoc(D.doc(db, 'projects', slug, 'customers', user.uid)); if (snap.exists()) state.profile = snap.data(); } catch (e) { /* keep what we have */ }
          if (state.profile) D.setDoc(D.doc(db, 'projects', slug, 'customers', user.uid), { lastLoginAt: new Date().toISOString(), loginCount: (Number(state.profile.loginCount) || 0) + 1 }, { merge: true }).catch(() => {});
        }
        state.ready = true; readyResolve(); emit();
      });
      return { A, D, auth, db };
    })();
    return sdk;
  }
  const emit = () => listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } });
  const plain = (v) => {
    if (v && typeof v.toDate === 'function') return v.toDate().toISOString();
    if (Array.isArray(v)) return v.map(plain);
    if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach((k) => { o[k] = plain(v[k]); }); return o; }
    return v;
  };
  const friendly = (e) => {
    const c = (e && e.code) || '';
    if (/invalid-credential|wrong-password|user-not-found/.test(c)) return 'Email or password is incorrect.';
    if (/email-already-in-use/.test(c)) return 'An account already exists for this email — please sign in.';
    if (/weak-password/.test(c)) return 'Choose a password with at least 6 characters.';
    if (/invalid-email/.test(c)) return 'Please check the email address.';
    if (/too-many-requests/.test(c)) return 'Too many attempts. Please wait a few minutes.';
    if (/network/.test(c)) return 'No internet connection. Please try again.';
    if (/permission-denied/.test(c)) return 'This isn’t switched on yet. Please try again later or WhatsApp us.';
    return (e && e.message) || 'Something went wrong. Please try again.';
  };
  const wrap = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { const err = new Error(friendly(e)); err.code = e && e.code; throw err; } };
  const tenDigits = (v) => String(v || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');

  const account = {
    state, ready: () => { boot(); return readyP; },
    on(fn) { listeners.push(fn); if (state.ready) fn(state); },
    signedIn: () => !!(state.user && state.profile),
    firstName: () => String((state.profile && state.profile.name) || (state.user && state.user.email) || '').split(/[\s@]/)[0],
    signIn: wrap(async (email, password) => { const { A, auth } = await boot(); await A.signInWithEmailAndPassword(auth, email.trim(), password); await waitProfile(); }),
    signUp: wrap(async ({ name, phone, email, password }) => {
      const { A, D, auth, db } = await boot();
      if (!name.trim()) throw new Error('Please enter your name.');
      if (!/^[6-9]\d{9}$/.test(tenDigits(phone))) throw new Error('Please enter a valid 10-digit mobile number.');
      let user = auth.currentUser;
      if (!user || user.email !== email.trim()) user = (await A.createUserWithEmailAndPassword(auth, email.trim(), password)).user;
      const profile = { name: name.trim(), mobile: tenDigits(phone), email: email.trim(), uid: user.uid, hasAccount: true, orderCount: 0, projectSlug: slug, createdAt: new Date().toISOString() };
      await D.setDoc(D.doc(db, 'projects', slug, 'customers', user.uid), profile, { merge: true });
      state.user = user; state.profile = profile; emit();
    }),
    // Signed in with a login that has no Yukktha profile yet: add one to it.
    joinStore: wrap(async ({ name, phone }) => {
      const { D, auth, db } = await boot(); const user = auth.currentUser; if (!user) throw new Error('Please sign in first.');
      if (!/^[6-9]\d{9}$/.test(tenDigits(phone))) throw new Error('Please enter a valid 10-digit mobile number.');
      const profile = { name: name.trim(), mobile: tenDigits(phone), email: user.email, uid: user.uid, hasAccount: true, orderCount: 0, projectSlug: slug, createdAt: new Date().toISOString() };
      await D.setDoc(D.doc(db, 'projects', slug, 'customers', user.uid), profile, { merge: true });
      state.profile = profile; emit();
    }),
    // Firebase ID token so the checkout service can verify who is ordering
    idToken: async () => { try { const { auth } = await boot(); return auth.currentUser ? await auth.currentUser.getIdToken() : null; } catch (e) { return null; } },
    signOut: wrap(async () => { const { A, auth } = await boot(); await A.signOut(auth); }),
    resetPassword: wrap(async (email) => { const { A, auth } = await boot(); await A.sendPasswordResetEmail(auth, email.trim()); }),
    updateProfile: wrap(async (patch) => {
      const { D, db } = await boot(); if (!state.user) throw new Error('Please sign in first.');
      if (patch.mobile != null) { patch.mobile = tenDigits(patch.mobile); if (!/^[6-9]\d{9}$/.test(patch.mobile)) throw new Error('Please enter a valid 10-digit mobile number.'); }
      await D.setDoc(D.doc(db, 'projects', slug, 'customers', state.user.uid), patch, { merge: true });
      state.profile = { ...state.profile, ...patch }; emit();
    }),
    orders: wrap(async () => {
      const { D, db } = await boot(); if (!state.user) return [];
      const snap = await D.getDocs(D.query(D.collection(db, 'projects', slug, 'orders'), D.where('customerUid', '==', state.user.uid)));
      return snap.docs.map((d) => ({ id: d.id, ...plain(d.data()) })).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    }),
    myReviews: wrap(async () => {
      const { D, db } = await boot(); if (!state.user) return [];
      const snap = await D.getDocs(D.query(D.collection(db, 'projects', slug, 'reviews'), D.where('uid', '==', state.user.uid)));
      return snap.docs.map((d) => ({ id: d.id, ...plain(d.data()) }));
    }),
    submitReview: wrap(async ({ product, rating, title, text }) => {
      const { D, db } = await boot(); if (!account.signedIn()) throw new Error('Please sign in to write a review.');
      rating = Math.round(Number(rating));
      if (!(rating >= 1 && rating <= 5)) throw new Error('Please choose a star rating.');
      if (String(text || '').trim().length < 10) throw new Error('Please write at least a sentence about the saree.');
      const parts = String(state.profile.name || 'Customer').trim().split(/\s+/);
      await D.addDoc(D.collection(db, 'projects', slug, 'reviews'), {
        productId: product.id, productName: product.title, rating, title: String(title || '').trim().slice(0, 120), text: String(text).trim().slice(0, 2000),
        name: parts[0] + (parts[1] ? ' ' + parts[1][0] + '.' : ''), uid: state.user.uid, status: 'pending', verified: false, createdAt: new Date().toISOString()
      });
    })
  };
  async function waitProfile() { await readyP; for (let i = 0; i < 30 && state.user && !state.profile; i++) await new Promise((r) => setTimeout(r, 100)); }

  // ---------- public reviews (no login needed) ----------
  let reviewsP = null;
  account.loadReviews = function () {
    if (reviewsP) return reviewsP;
    reviewsP = (async () => {
      try {
        const res = await fetch('https://firestore.googleapis.com/v1/projects/' + F.projectId + '/databases/(default)/documents/projects/' + slug + ':runQuery?key=' + encodeURIComponent(F.apiKey), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'reviews' }], where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'approved' } } }, limit: 1000 } })
        });
        if (!res.ok) return [];
        const rows = await res.json();
        const val = (v) => { const k = Object.keys(v)[0]; const x = v[k]; if (k === 'integerValue' || k === 'doubleValue') return Number(x); if (k === 'mapValue') { const o = {}; Object.keys(x.fields || {}).forEach((f) => { o[f] = val(x.fields[f]); }); return o; } if (k === 'arrayValue') return (x.values || []).map(val); if (k === 'nullValue') return null; return x; };
        return rows.filter((r) => r.document).map((r) => { const o = { id: r.document.name.split('/').pop() }; Object.keys(r.document.fields || {}).forEach((f) => { o[f] = val(r.document.fields[f]); }); return o; })
          .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      } catch (e) { return []; }
    })();
    return reviewsP;
  };
  account.ratingFor = async function (productId) {
    const list = (await account.loadReviews()).filter((r) => r.productId === productId);
    const avg = list.length ? list.reduce((a, r) => a + Number(r.rating || 0), 0) / list.length : 0;
    return { list, count: list.length, avg };
  };
  account.stars = function (value, cls) {
    const pct = Math.max(0, Math.min(100, (Number(value) || 0) / 5 * 100));
    return '<span class="stars ' + (cls || '') + '" role="img" aria-label="' + (Math.round(value * 10) / 10) + ' out of 5 stars"><span class="stars-bg">★★★★★</span><span class="stars-fg" style="width:' + pct + '%">★★★★★</span></span>';
  };

  Y.account = account;
  // Start the session quietly once the page is idle (keeps first paint fast).
  const start = () => boot().catch((e) => { console.warn('Accounts unavailable:', e.message); state.ready = true; readyResolve(); emit(); });
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1500 }); else setTimeout(start, 400);
})();
