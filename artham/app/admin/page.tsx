"use client";

import { useState } from "react";

type Day = {
  date: string;
  newWallets: number;
  documents: number;
  failedDocuments: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  orders: number;
  revenuePaise: number;
  byModel: Record<string, number>;
};
type Stats = {
  days: Day[];
  config: { ai: boolean; model: string; effort: string; payments: boolean; liveKeys: boolean; webhook: boolean };
};

const USD_TO_INR = 85;
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export default function Admin() {
  const [key, setKey] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/stats", { headers: { "x-admin-key": key }, cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 401 ? "Wrong admin key." : "Could not load stats.");
      setStats(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const sum = (f: (d: Day) => number) => (stats?.days ?? []).reduce((n, d) => n + f(d), 0);
  const revenue = sum((d) => d.revenuePaise) / 100;
  const aiCost = sum((d) => d.costUsd) * USD_TO_INR;
  const fees = revenue * 0.0236; // ~2% Razorpay fee + 18% GST on the fee

  return (
    <div className="wrap legal">
      <h1>Admin</h1>
      {!stats ? (
        <form onSubmit={load} className="card" style={{ maxWidth: 420 }}>
          <label className="field-label" htmlFor="key" style={{ marginTop: 0 }}>
            Admin key
          </label>
          <input id="key" type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="current-password" />
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={!key || loading}>
            {loading ? "Loading…" : "Show stats"}
          </button>
        </form>
      ) : (
        <>
          <p className="muted">Last 30 days. AI cost is an estimate at ₹{USD_TO_INR}/US$.</p>
          <div className="stat-grid">
            <div className="stat">
              <div className="muted small">Documents explained</div>
              <div className="v">{sum((d) => d.documents)}</div>
            </div>
            <div className="stat">
              <div className="muted small">Revenue</div>
              <div className="v">{inr(revenue)}</div>
            </div>
            <div className="stat">
              <div className="muted small">AI cost (est.)</div>
              <div className="v">{inr(aiCost)}</div>
            </div>
            <div className="stat">
              <div className="muted small">Profit after AI + fees</div>
              <div className="v">{inr(revenue - aiCost - fees)}</div>
            </div>
            <div className="stat">
              <div className="muted small">Paid orders</div>
              <div className="v">{sum((d) => d.orders)}</div>
            </div>
            <div className="stat">
              <div className="muted small">New visitors (wallets)</div>
              <div className="v">{sum((d) => d.newWallets)}</div>
            </div>
            <div className="stat">
              <div className="muted small">Failed (refunded)</div>
              <div className="v">{sum((d) => d.failedDocuments)}</div>
            </div>
            <div className="stat">
              <div className="muted small">Avg AI cost / document</div>
              <div className="v">{sum((d) => d.documents) ? inr(aiCost / sum((d) => d.documents)) : "–"}</div>
            </div>
          </div>

          <h2>Setup</h2>
          <ul>
            <li>AI key: {stats.config.ai ? "✅ set" : "❌ missing (ANTHROPIC_API_KEY)"}</li>
            <li>
              Model: {stats.config.model} (effort {stats.config.effort})
            </li>
            <li>Razorpay: {stats.config.payments ? (stats.config.liveKeys ? "✅ live keys" : "🟡 test keys") : "❌ not configured"}</li>
            <li>Razorpay webhook: {stats.config.webhook ? "✅ set" : "❌ missing (RAZORPAY_WEBHOOK_SECRET)"}</li>
          </ul>

          <h2>By day</h2>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Docs</th>
                  <th>Failed</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                  <th>AI cost</th>
                  <th>New</th>
                </tr>
              </thead>
              <tbody>
                {stats.days.map((d) => (
                  <tr key={d.date}>
                    <td>{d.date}</td>
                    <td>{d.documents}</td>
                    <td>{d.failedDocuments}</td>
                    <td>{d.orders}</td>
                    <td>{inr(d.revenuePaise / 100)}</td>
                    <td>{inr(d.costUsd * USD_TO_INR)}</td>
                    <td>{d.newWallets}</td>
                  </tr>
                ))}
                {stats.days.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">
                      No activity yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => load()}>
            Refresh
          </button>
        </>
      )}
    </div>
  );
}
