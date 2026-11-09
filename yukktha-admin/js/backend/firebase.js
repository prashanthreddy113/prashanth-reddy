// Live backend: Firebase Auth + Firestore, the Yukktha store's documents.
import { CONFIG } from '../config.js';

const SDK = CONFIG.firebaseSdk;
const TOP_LEVEL = ['users', 'invites'];   // everything else lives under projects/<slug>/

export async function createFirebaseBackend() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(SDK + 'firebase-app.js'),
    import(SDK + 'firebase-auth.js'),
    import(SDK + 'firebase-firestore.js')
  ]);
  const app = initializeApp(CONFIG.firebase, 'yukktha-admin');
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const slug = CONFIG.projectSlug;

  const ref = (coll) => TOP_LEVEL.includes(coll) ? F.collection(db, coll) : F.collection(db, 'projects', slug, coll);
  const docRef = (coll, id) => TOP_LEVEL.includes(coll) ? F.doc(db, coll, id) : F.doc(db, 'projects', slug, coll, id);

  // Firestore Timestamps -> ISO strings so pages only ever see plain data.
  const plain = (v) => {
    if (v && typeof v.toDate === 'function') return v.toDate().toISOString();
    if (Array.isArray(v)) return v.map(plain);
    if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = plain(v[k]); return o; }
    return v;
  };
  // "now" placeholders become server timestamps.
  const prep = (data) => {
    const o = {};
    for (const k in data) {
      if (data[k] === undefined) continue;
      o[k] = data[k] === NOW ? F.serverTimestamp() : data[k];
    }
    return o;
  };
  const friendly = (err) => {
    if (err && err.code === 'permission-denied') {
      const e = new Error('Permission denied by the Firestore security rules. See README → "Firestore rules" to allow this section.');
      e.code = 'permission-denied'; return e;
    }
    return err;
  };
  const wrap = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { throw friendly(e); } };

  let session = null;
  async function loadSession(user) {
    if (!user) return null;
    const snap = await F.getDoc(F.doc(db, 'users', user.uid));
    if (!snap.exists() || !snap.data().role) { await A.signOut(auth); throw new Error('This account has no admin access. Ask the owner to invite you.'); }
    const u = snap.data();
    if (u.role !== 'super_admin' && !(u.projectIds || []).includes(slug)) { await A.signOut(auth); throw new Error('This account is not linked to the ' + slug + ' store.'); }
    return { uid: user.uid, email: user.email, role: u.role, isOwner: u.role === 'super_admin' || u.isMaster === true, label: u.role === 'super_admin' ? 'Super Admin' : (u.isMaster ? 'Owner' : 'Staff Admin') };
  }

  return {
    mode: 'live',
    NOW,
    async signIn(email, password) {
      const cred = await A.signInWithEmailAndPassword(auth, email, password);
      session = await loadSession(cred.user); return session;
    },
    async signUp(email, password) {
      // Invite flow: an owner creates invites/<email>; the
      // invited person chooses a password here and claims it.
      const lower = email.toLowerCase();
      const cred = await A.createUserWithEmailAndPassword(auth, email, password);
      const inv = await F.getDoc(F.doc(db, 'invites', lower));
      if (!inv.exists() || inv.data().status !== 'pending') { await cred.user.delete().catch(() => {}); throw new Error('No pending invite for that email. Ask the owner to invite you first.'); }
      const d = inv.data();
      await F.setDoc(F.doc(db, 'users', cred.user.uid), { email, role: d.role, projectIds: d.projectIds || [slug], ...(d.isMaster ? { isMaster: true } : {}) });
      await F.updateDoc(F.doc(db, 'invites', lower), { status: 'claimed' });
      session = await loadSession(cred.user); return session;
    },
    resetPassword: (email) => A.sendPasswordResetEmail(auth, email),
    async signOut() { session = null; await A.signOut(auth); },
    restore() {
      return new Promise((resolve) => {
        const off = A.onAuthStateChanged(auth, async (user) => {
          off();
          try { session = await loadSession(user); } catch (e) { session = null; }
          resolve(session);
        });
      });
    },
    session: () => session,
    list: wrap(async (coll, opts) => {
      let q = ref(coll);
      if (opts && opts.where) q = F.query(q, F.where(opts.where[0], opts.where[1], opts.where[2]));
      const snap = await F.getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...plain(d.data()) }));
    }),
    get: wrap(async (coll, id) => { const s = await F.getDoc(docRef(coll, id)); return s.exists() ? { id: s.id, ...plain(s.data()) } : null; }),
    add: wrap(async (coll, data) => (await F.addDoc(ref(coll), prep({ createdAt: NOW, ...data }))).id),
    set: wrap(async (coll, id, data) => { await F.setDoc(docRef(coll, id), prep(data), { merge: true }); return id; }),
    update: wrap(async (coll, id, patch) => { await F.updateDoc(docRef(coll, id), prep(patch)); }),
    remove: wrap(async (coll, id) => { await F.deleteDoc(docRef(coll, id)); }),
    getProject: wrap(async () => { const s = await F.getDoc(F.doc(db, 'projects', slug)); return s.exists() ? plain(s.data()) : {}; }),
    updateProject: wrap(async (patch) => { await F.updateDoc(F.doc(db, 'projects', slug), prep(patch)); })
  };
}

export const NOW = { __now: true };
