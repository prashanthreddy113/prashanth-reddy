"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IMAGE_TYPES, LANGUAGES, LIMITS, PDF_TYPE, findLanguage } from "@/lib/config.ts";
import type { Explanation } from "@/lib/schema.ts";
import { compressImage } from "@/lib/client/image.ts";
import ResultView from "./ResultView.tsx";
import BuyModal from "./BuyModal.tsx";

type Item = { id: string; file: File; preview: string | null };
type WalletInfo = { credits: number; freeCredits: number; payments: "razorpay" | "test" | "unavailable"; demo: boolean };
type Status = "idle" | "working" | "done";

const STEPS = ["Uploading your document", "Reading every line", "Checking money and dates", "Looking for risks", "Writing it in simple words"];

const LANG_KEY = "artham.lang";

export default function Explainer() {
  const [language, setLanguage] = useState("te");
  const [items, setItems] = useState<Item[]>([]);
  const [question, setQuestion] = useState("");
  const [showQuestion, setShowQuestion] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<Explanation | null>(null);
  const [resultLang, setResultLang] = useState("te");
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved && findLanguage(saved)) setLanguage(saved);
    } catch {
      /* storage unavailable */
    }
    fetch("/api/wallet", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((w) => w && setWallet(w))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LANG_KEY, language);
    } catch {
      /* storage unavailable */
    }
  }, [language]);

  useEffect(() => {
    return () => items.forEach((i) => i.preview && URL.revokeObjectURL(i.preview));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== "working") return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 5000);
    return () => clearInterval(t);
  }, [status]);

  const addFiles = useCallback(
    async (list: FileList | File[]) => {
      setError("");
      const incoming = Array.from(list);
      if (!incoming.length) return;
      const hasPdf = incoming.some((f) => f.type === PDF_TYPE) || items.some((i) => i.file.type === PDF_TYPE);
      const bad = incoming.find((f) => f.type !== PDF_TYPE && !(IMAGE_TYPES as readonly string[]).includes(f.type) && !f.type.startsWith("image/"));
      if (bad) return setError("Only photos (JPG, PNG) or PDF files are supported.");
      if (hasPdf && items.length + incoming.length > 1) {
        return setError("Please upload either one PDF, or photos of the pages - not both.");
      }
      if (items.length + incoming.length > LIMITS.maxImages) {
        return setError(`You can add up to ${LIMITS.maxImages} photos (pages) at a time.`);
      }
      setPreparing(true);
      try {
        const prepared: Item[] = [];
        for (const f of incoming) {
          if (f.type === PDF_TYPE) {
            if (f.size > LIMITS.maxUploadBytes) {
              setError("This PDF is larger than 4 MB. Please upload photos of the important pages instead.");
              continue;
            }
            prepared.push({ id: crypto.randomUUID(), file: f, preview: null });
          } else {
            const small = await compressImage(f);
            if (!(IMAGE_TYPES as readonly string[]).includes(small.type)) {
              setError("This photo format is not supported. Please use JPG or PNG.");
              continue;
            }
            prepared.push({ id: crypto.randomUUID(), file: small, preview: URL.createObjectURL(small) });
          }
        }
        setItems((cur) => [...cur, ...prepared]);
      } finally {
        setPreparing(false);
      }
    },
    [items],
  );

  const removeItem = (id: string) =>
    setItems((cur) => {
      const it = cur.find((i) => i.id === id);
      if (it?.preview) URL.revokeObjectURL(it.preview);
      return cur.filter((i) => i.id !== id);
    });

  const totalBytes = items.reduce((n, i) => n + i.file.size, 0);

  async function submit() {
    setError("");
    setNotice("");
    if (!items.length) return setError("Please add a photo or PDF of your document first.");
    if (totalBytes > LIMITS.maxUploadBytes) return setError("These files are too large together. Please remove a page or two.");
    if (wallet && wallet.credits < 1) return setBuyOpen(true);

    const form = new FormData();
    form.append("language", language);
    if (question.trim()) form.append("question", question.trim());
    items.forEach((i) => form.append("files", i.file, i.file.name));

    setStatus("working");
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const res = await fetch("/api/explain", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (typeof data.credits === "number") setWallet((w) => (w ? { ...w, credits: data.credits } : w));
      if (res.status === 402) {
        setStatus("idle");
        setBuyOpen(true);
        return;
      }
      if (!res.ok || !data.result) {
        setStatus("idle");
        setError(
          data.error ||
            (res.status === 504 || res.status === 502
              ? "This took too long. Please try again, or upload fewer pages."
              : "Something went wrong. Please try again."),
        );
        if (!data.credits) refreshWallet();
        return;
      }
      setResult(data.result);
      setResultLang(language);
      setStatus("done");
    } catch {
      setStatus("idle");
      setError("No internet connection, or the request was interrupted. Please try again.");
      refreshWallet();
    }
  }

  function refreshWallet() {
    fetch("/api/wallet", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((w) => w && setWallet(w))
      .catch(() => undefined);
  }

  function reset() {
    items.forEach((i) => i.preview && URL.revokeObjectURL(i.preview));
    setItems([]);
    setQuestion("");
    setShowQuestion(false);
    setResult(null);
    setStatus("idle");
    setError("");
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const credits = wallet?.credits;
  const creditLabel =
    credits === undefined ? "…" : credits === 1 ? "1 document left" : `${credits} documents left`;

  return (
    <div ref={topRef} className="card tool" id="try">
      <div className="tool-head no-print">
        <h2>{status === "done" ? "Your explanation" : "Explain my document"}</h2>
        <span className="credits" aria-live="polite">
          <span>
            <strong>{creditLabel}</strong>
          </span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setBuyOpen(true)}>
            Buy
          </button>
        </span>
      </div>

      {wallet?.demo && status !== "working" && (
        <div className="alert alert-info no-print">
          Demo mode: no AI key is set, so you will see a sample explanation.
        </div>
      )}
      {notice && <div className="alert alert-ok">{notice}</div>}

      {status === "working" && (
        <div className="progress" role="status" aria-live="polite">
          <div className="spinner" />
          <strong>Please wait, this takes about 20–40 seconds…</strong>
          <ul className="steps-list">
            {STEPS.map((s, i) => (
              <li key={s} className={i < step ? "done" : i === step ? "active" : ""}>
                {i < step ? "✓ " : i === step ? "• " : "  "}
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {status === "done" && result && (
        <ResultView result={result} languageCode={resultLang} onReset={reset} />
      )}

      {status === "idle" && (
        <>
          <span className="field-label" id="lang-label">
            1. Explain in
          </span>
          <div className="chips" role="group" aria-labelledby="lang-label">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                className="chip"
                aria-pressed={language === l.code}
                onClick={() => setLanguage(l.code)}
                lang={l.code}
              >
                {l.native}
              </button>
            ))}
          </div>

          <span className="field-label">2. Add your document</span>
          <div
            className={"drop" + (dragging ? " dragging" : "")}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
            }}
          >
            <div className="muted small">
              Take a clear photo of each page, or upload a PDF. Up to {LIMITS.maxImages} pages.
            </div>
            <div className="drop-actions">
              <button type="button" className="btn btn-primary" onClick={() => cameraRef.current?.click()} disabled={preparing}>
                📷 Take photo
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={preparing}>
                📄 Upload photo / PDF
              </button>
            </div>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*,application/pdf"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {preparing && <div className="small muted" style={{ marginTop: 10 }}>Preparing photos…</div>}
            {items.length > 0 && (
              <div className="thumbs">
                {items.map((it, idx) => (
                  <div className="thumb" key={it.id}>
                    {it.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.preview} alt={`Page ${idx + 1}`} />
                    ) : (
                      <span>
                        📄
                        <br />
                        {it.file.name.slice(0, 18)}
                      </span>
                    )}
                    {it.preview && <span className="page-no">{idx + 1}</span>}
                    <button type="button" className="remove" aria-label={`Remove page ${idx + 1}`} onClick={() => removeItem(it.id)}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showQuestion ? (
            <>
              <label className="field-label" htmlFor="question">
                Your question (optional)
              </label>
              <textarea
                id="question"
                value={question}
                maxLength={LIMITS.maxQuestionChars}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Example: Is the deposit refundable? / Is this bill amount correct?"
              />
            </>
          ) : (
            <p className="small" style={{ marginTop: 12 }}>
              <button type="button" className="link-btn" onClick={() => setShowQuestion(true)}>
                + Ask a specific question about it
              </button>
            </p>
          )}

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <div className="submit-row">
            <button type="button" className="btn btn-accent btn-block" onClick={submit} disabled={preparing || !items.length}>
              {wallet && wallet.credits < 1 ? "Buy credits to explain" : "Explain my document"}
            </button>
          </div>
          <div className="privacy-note">
            <span aria-hidden="true">🔒</span>
            <span>Your document is not stored. It is read once to write your explanation, then discarded.</span>
          </div>
        </>
      )}

      {buyOpen && (
        <BuyModal
          payments={wallet?.payments ?? "unavailable"}
          onClose={() => setBuyOpen(false)}
          onPurchased={(creditsNow, added) => {
            setWallet((w) => (w ? { ...w, credits: creditsNow } : w));
            setBuyOpen(false);
            setNotice(`${added} document credit${added === 1 ? "" : "s"} added. Thank you!`);
          }}
        />
      )}
    </div>
  );
}
