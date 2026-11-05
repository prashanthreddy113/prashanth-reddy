import { esc, $, toast, modal, confirmBox, field, input, select, checkbox, empty } from '../ui.js';
import { CONFIG } from '../config.js';

export default {
  id: 'access', title: 'Team access', group: 'Team', icon: 'key', ownerOnly: true,
  async render(view, ctx) {
    const { api, session } = ctx; const slug = CONFIG.projectSlug;
    let users = [], invites = [], err = null;
    const load = async () => {
      err = null;
      try {
        [users, invites] = await Promise.all([api.list('users', { where: ['projectIds', 'array-contains', slug] }), api.list('invites', { where: ['projectIds', 'array-contains', slug] })]);
      } catch (e) { err = e; }
    };
    await load();
    if (ctx.stale()) return;
    const role = (u) => u.role === 'super_admin' ? 'Super Admin' : (u.isMaster ? 'Owner' : 'Staff Admin');
    const draw = () => {
      view.innerHTML = '<div class="alert info"><strong>Who can log in to this admin</strong><p>Owners can do everything. Staff admins can bill, manage sarees, orders, customers, coupons and attendance — but not payments, salaries, expenses, reports or settings, and they can’t cancel orders.</p></div>' +
        (err ? '<div class="alert warn"><strong>Can’t list team members</strong><p>' + esc(err.message) + ' The BrightLoop admin (Team tab) can always manage access.</p></div>' : '') +
        '<div class="bar"><span class="grow"></span><button class="btn primary" id="inv">+ Invite someone</button></div>' +
        '<div class="grid2"><div class="card"><h3>Active logins</h3>' + (users.length ? '<div class="list">' + users.map((u) => '<div class="list-row" data-id="' + esc(u.id) + '"><div class="grow"><div class="cell-main">' + esc(u.email) + (u.id === session.uid ? ' (you)' : '') + '</div><div class="cell-sub">' + role(u) + '</div></div>' +
          (u.role !== 'super_admin' && u.id !== session.uid ? '<label class="check tiny"><input type="checkbox" data-master' + (u.isMaster ? ' checked' : '') + '> Owner</label><button class="icon-btn" data-rm title="Remove access">🗑</button>' : '') + '</div>').join('') + '</div>' : empty('No other logins yet.')) + '</div>' +
        '<div class="card"><h3>Pending invites</h3>' + (invites.filter((i) => i.status === 'pending').length ? '<div class="list">' + invites.filter((i) => i.status === 'pending').map((i) => '<div class="list-row" data-inv="' + esc(i.id) + '"><div class="grow"><div class="cell-main">' + esc(i.email || i.id) + '</div><div class="cell-sub">' + (i.isMaster ? 'Owner' : 'Staff Admin') + ' · asked to create a password on this admin’s sign-in page</div></div><button class="icon-btn" data-cancel title="Cancel invite">✕</button></div>').join('') + '</div>' : empty('No pending invites.')) + '</div></div>';
      $('#inv').onclick = invite;
      view.querySelectorAll('[data-master]').forEach((cb) => cb.addEventListener('change', async () => { const id = cb.closest('[data-id]').dataset.id; try { await api.update('users', id, { isMaster: cb.checked }); toast('Updated'); } catch (e) { toast(e.message, 'err'); cb.checked = !cb.checked; } }));
      view.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', async () => { const id = b.closest('[data-id]').dataset.id; const u = users.find((x) => x.id === id); if (await confirmBox('Remove admin access for ' + u.email + '?', 'Remove')) { try { await api.remove('users', id); toast('Access removed'); await load(); draw(); } catch (e) { toast(e.message, 'err'); } } }));
      view.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', async () => { const id = b.closest('[data-inv]').dataset.inv; try { await api.remove('invites', id); await load(); draw(); } catch (e) { toast(e.message, 'err'); } }));
    };
    const invite = async () => {
      const v = await modal({ title: 'Invite to Yukktha admin', submit: 'Send invite', body: field('Email', input('email', '', 'type="email" required')) + '<div style="margin-top:12px">' + checkbox('isMaster', false, 'Owner access (payments, salaries, reports, settings)') + '</div><p class="tiny muted">They open this admin, choose “Invited? Create your password” and sign up with this email.</p>' });
      if (!v || !v.email) return;
      const email = v.email.toLowerCase();
      try {
        await api.set('invites', email, { email, role: 'admin', projectIds: [slug], isMaster: !!v.isMaster, status: 'pending', invitedBy: session.email, createdAt: api.NOW });
        toast('Invite saved — share the admin link with ' + email); await load(); draw();
      } catch (e) { toast(e.message, 'err'); }
    };
    draw();
  }
};
