"use client";

import { useEffect, useState } from "react";
import { findLanguage, SITE } from "@/lib/config.ts";
import type { Explanation } from "@/lib/schema.ts";
import { hasVoiceFor, speak, speechSupported, stopSpeaking } from "@/lib/client/speech.ts";

type Props = { result: Explanation; languageCode: string; onReset: () => void };

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export default function ResultView({ result: r, languageCode, onReset }: Props) {
  const lang = findLanguage(languageCode);
  const h = r.headings;
  const [speaking, setSpeaking] = useState(false);
  const [voiceOk, setVoiceOk] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (lang && speechSupported()) hasVoiceFor(lang.speech).then(setVoiceOk);
    return () => stopSpeaking();
  }, [lang]);

  const flags = [...r.red_flags].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const spokenText = [
    r.title,
    r.summary,
    flags.length ? `${h.red_flags}. ${flags.map((f) => `${f.title}. ${f.explanation}`).join(" ")}` : "",
    r.next_steps.length ? `${h.next_steps}. ${r.next_steps.join(". ")}` : "",
  ]
    .filter(Boolean)
    .join(". ");

  const shareText = [
    `*${r.title}*`,
    r.summary,
    flags.length ? `\n*${h.red_flags}*\n` + flags.map((f) => `• ${f.title}: ${f.explanation}`).join("\n") : "",
    r.next_steps.length ? `\n*${h.next_steps}*\n` + r.next_steps.map((s, i) => `${i + 1}. ${s}`).join("\n") : "",
    `\n— ${SITE.name}${typeof window !== "undefined" ? " " + window.location.origin : ""}`,
  ]
    .filter(Boolean)
    .join("\n");

  function toggleSpeak() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    void speak(spokenText, lang?.speech ?? "en-IN", () => setSpeaking(false));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareText.replace(/\*/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  if (!r.readable) {
    return (
      <div className="result" lang={languageCode}>
        <div className="alert alert-error">{r.summary}</div>
        {r.unclear_parts && <p className="muted">{r.unclear_parts}</p>}
        <p className="small muted" lang="en">No credit was used. Tip: use good light, keep the page flat and fill the frame with the page.</p>
        <div className="result-actions">
          <button className="btn btn-primary" onClick={onReset}>
            Try again with a clearer photo
          </button>
        </div>
      </div>
    );
  }

  return (
    <article className="result" lang={languageCode}>
      <div className="result-top">
        <span className="tag">{r.document_type}</span>
        {lang && <span className="tag">{lang.native}</span>}
      </div>
      <h2>{r.title}</h2>

      {speechSupported() && (
        <div className="no-print" style={{ margin: "8px 0 4px" }}>
          <button type="button" className="btn btn-sm btn-ghost" onClick={toggleSpeak} aria-pressed={speaking}>
            {speaking ? "⏹ Stop" : "🔊 Listen"}
          </button>
          {voiceOk === false && (
            <span className="small muted" style={{ marginLeft: 8 }}>
              Your phone may not have a {lang?.name} voice; it may read in another accent.
            </span>
          )}
        </div>
      )}

      <section>
        <h3>{h.summary}</h3>
        <div className="summary-box">{r.summary}</div>
      </section>

      <section>
        <h3>⚠️ {h.red_flags}</h3>
        {flags.length === 0 ? (
          <div className="no-flags">✓ {h.no_red_flags}</div>
        ) : (
          flags.map((f, i) => (
            <div key={i} className={`flag flag-${f.severity}`}>
              <strong>{f.title}</strong>
              {f.explanation}
            </div>
          ))
        )}
      </section>

      {r.amounts.length > 0 && (
        <section>
          <h3>💰 {h.amounts}</h3>
          <table className="kv">
            <tbody>
              {r.amounts.map((a, i) => (
                <tr key={i}>
                  <td>
                    {a.label}
                    {a.note && <span className="note">{a.note}</span>}
                  </td>
                  <td className="amount">{a.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {r.dates.length > 0 && (
        <section>
          <h3>📅 {h.dates}</h3>
          <table className="kv">
            <tbody>
              {r.dates.map((d, i) => (
                <tr key={i}>
                  <td>
                    {d.label}
                    {d.why_it_matters && <span className="note">{d.why_it_matters}</span>}
                  </td>
                  <td className="amount">{d.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {r.key_points.length > 0 && (
        <section>
          <h3>📌 {h.key_points}</h3>
          <ul>
            {r.key_points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
      )}

      {r.next_steps.length > 0 && (
        <section>
          <h3>✅ {h.next_steps}</h3>
          <ol>
            {r.next_steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </section>
      )}

      {r.questions_to_ask.length > 0 && (
        <section>
          <h3>❓ {h.questions_to_ask}</h3>
          <ul>
            {r.questions_to_ask.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </section>
      )}

      {r.expert.recommended && (
        <section>
          <h3>👩‍⚖️ {h.expert}</h3>
          <div className="expert-box">
            {r.expert.expert_type && <strong>{r.expert.expert_type}: </strong>}
            {r.expert.reason}
          </div>
        </section>
      )}

      {r.unclear_parts && (
        <section>
          <h3>🔍 {h.unclear_parts}</h3>
          <p className="muted">{r.unclear_parts}</p>
        </section>
      )}

      <div className="result-actions">
        <a
          className="btn btn-primary"
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Share on WhatsApp
        </a>
        <button type="button" className="btn btn-ghost" onClick={copy}>
          {copied ? "Copied ✓" : "Copy"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
          Print / Save PDF
        </button>
        <button type="button" className="btn btn-ghost" onClick={onReset}>
          Explain another document
        </button>
      </div>

      <p className="disclaimer" lang="en">
        This explanation is generated by AI from your document and may contain mistakes. It is for understanding only
        and is not legal, medical or financial advice. Check important details with the issuing office or a qualified
        professional before you act.
      </p>
    </article>
  );
}
