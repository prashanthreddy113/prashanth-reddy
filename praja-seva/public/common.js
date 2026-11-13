'use strict';
/* Shared helpers for the Praja Seva portal (/), citizen app (/app/) and office console (/office/). */

const S = {
  cfg: null,
  token: load('ps_token'),
  user: JSON.parse(load('ps_user') || 'null'),
  lang: load('ps_lang') || 'en',
};

function load(k) { try { return localStorage.getItem(k); } catch { return null; } }
function keep(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage blocked */ } }
const t = (k) => (window.I18N[S.lang] && window.I18N[S.lang][k]) || window.I18N.en[k] || k;
const label = (o) => (o ? (S.lang === 'te' && o.te ? o.te : o.en) : '');
const locale = () => (S.lang === 'te' ? 'te-IN' : 'en-IN');
const fmt = (iso) => (iso ? new Date(iso).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' }) : '');
const fmtDate = (iso) => (iso ? new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString(locale(), { dateStyle: 'medium' }) : '');
const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
// Large rupee amounts in lakh / crore, the way municipal budgets are read.
function inr(n) {
  const v = Number(n || 0);
  if (v >= 1e7) return `₹${(v / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toLocaleString('en-IN', { maximumFractionDigits: 1 })} L`;
  return money(v);
}
function setLang(lang) { S.lang = lang; keep('ps_lang', lang); document.documentElement.lang = lang; }

// DOM helper. It never uses innerHTML, so text from users is always escaped.
function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v;
    else if (k === 'value') n.value = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}

function toast(msg, kind = 'ok') {
  document.querySelectorAll('.toast').forEach((x) => x.remove());
  const n = el('div', { class: `toast ${kind}`, role: 'status' }, msg);
  document.body.append(n);
  setTimeout(() => n.remove(), 3500);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: `Bearer ${S.token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (opts.raw && res.ok) return res;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && S.token) { setSession(null, null); if (window.onAuthLost) window.onAuthLost(); }
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

function setSession(token, user) {
  S.token = token; S.user = user;
  keep('ps_token', token); keep('ps_user', user ? JSON.stringify(user) : null);
}

// Runs an async action from a form or button and shows errors as a toast.
function act(fn) {
  return async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const btn = e && e.submitter ? e.submitter : e && e.currentTarget && e.currentTarget.tagName === 'BUTTON' ? e.currentTarget : null;
    if (btn) btn.disabled = true;
    try { await fn(e); } catch (err) { toast(err.message, 'err'); } finally { if (btn) btn.disabled = false; }
  };
}
const formData = (form) => Object.fromEntries(new FormData(form).entries());

function statusPill(s) { return el('span', { class: `pill st-${s}` }, t('s_' + s)); }
function field(lbl, input, hint) { return el('label', { class: 'field' }, el('span', {}, lbl), input, hint ? el('small', {}, hint) : null); }
function stat(n, l, kind) { return el('div', { class: `stat ${kind || ''}` }, el('b', {}, n ?? '—'), el('span', {}, l)); }
function empty() { return el('p', { class: 'muted' }, t('none')); }
function bar(value, max, kind) {
  const fill = el('i', { class: kind || null });
  fill.style.width = `${max ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0}%`; // CSSOM: allowed by the CSP
  return el('div', { class: 'bar' }, fill);
}
// Rating of a KPI against its target: good / warning / critical / none.
function kpiValue(k) { return k.value == null ? '—' : `${k.value}${k.unit === '/5' ? ' / 5' : k.unit}`; }
async function downloadCsv(path, filename) {
  const res = await api(path, { raw: true });
  const blob = await res.blob();
  const a = el('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
