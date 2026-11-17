import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { findLanguage, IMAGE_TYPES, LIMITS, PDF_TYPE } from "@/lib/config.ts";
import { aiConfigured, demoMode, explainDocument, ExplainError, type DocumentPart } from "@/lib/ai.ts";
import { bumpStats, refundCredit, reserveCredit } from "@/lib/accounts.ts";
import { currentWallet } from "@/lib/session.ts";
import { DEMO_EXPLANATION } from "@/lib/demo.ts";

export const runtime = "nodejs";
export const maxDuration = 60;

function fail(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function POST(req: Request) {
  if (!aiConfigured() && !demoMode()) {
    return fail(503, "The service is being set up. Please try again soon.");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "Upload failed. Please try again with smaller photos.");
  }

  const language = findLanguage(String(form.get("language") || "en"));
  if (!language) return fail(400, "Please choose a language.");
  const question = String(form.get("question") || "").slice(0, LIMITS.maxQuestionChars);

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return fail(400, "Please add a photo or PDF of your document.");

  const totalBytes = files.reduce((n, f) => n + f.size, 0);
  if (totalBytes > LIMITS.maxUploadBytes) {
    return fail(413, "The files are too large. Please upload fewer pages or a smaller PDF (max 4 MB).");
  }

  const pdfs = files.filter((f) => f.type === PDF_TYPE);
  const images = files.filter((f) => (IMAGE_TYPES as readonly string[]).includes(f.type));
  if (pdfs.length + images.length !== files.length) {
    return fail(415, "Only photos (JPG, PNG, WEBP) or PDF files are supported.");
  }
  if (pdfs.length > 1 || (pdfs.length === 1 && images.length > 0)) {
    return fail(400, "Please upload either one PDF or photos of the pages, not both.");
  }
  if (images.length > LIMITS.maxImages) {
    return fail(400, `Please upload at most ${LIMITS.maxImages} photos at a time.`);
  }

  const parts: DocumentPart[] = [];
  let pages = images.length;
  if (pdfs.length === 1) {
    const bytes = new Uint8Array(await pdfs[0].arrayBuffer());
    try {
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
      pages = doc.getPageCount();
    } catch {
      return fail(422, "This PDF could not be opened. Please upload photos of the pages instead.");
    }
    if (pages > LIMITS.maxPdfPages) {
      return fail(413, `This PDF has ${pages} pages. Please upload a document with at most ${LIMITS.maxPdfPages} pages.`);
    }
    parts.push({ kind: "pdf", base64: Buffer.from(bytes).toString("base64") });
  } else {
    for (const img of images) {
      parts.push({
        kind: "image",
        mediaType: img.type as (typeof IMAGE_TYPES)[number],
        base64: Buffer.from(await img.arrayBuffer()).toString("base64"),
      });
    }
  }

  const wallet = await currentWallet(true);
  const reserved = await reserveCredit(wallet.id);
  if (!reserved) {
    return fail(402, "You have used all your credits. Please buy a pack to continue.", { code: "no_credits", credits: 0 });
  }

  const started = Date.now();
  try {
    if (!aiConfigured()) {
      await new Promise((r) => setTimeout(r, 1200));
      await bumpStats({ documents: 1, model: "demo" });
      return NextResponse.json({ result: DEMO_EXPLANATION, credits: reserved.credits, demo: true });
    }

    const out = await explainDocument(parts, language, question);
    await bumpStats({
      documents: 1,
      inputTokens: out.inputTokens,
      outputTokens: out.outputTokens,
      costUsd: out.costUsd,
      model: out.model,
    });
    console.log(
      JSON.stringify({
        event: "explained",
        model: out.model,
        language: language.code,
        pages,
        inputTokens: out.inputTokens,
        outputTokens: out.outputTokens,
        ms: Date.now() - started,
      }),
    );
    if (!out.explanation.readable) {
      // Nothing useful could be read: don't charge the customer for it.
      const refunded = await refundCredit(wallet.id);
      return NextResponse.json({ result: out.explanation, credits: refunded?.credits ?? reserved.credits + 1 });
    }
    return NextResponse.json({ result: out.explanation, credits: reserved.credits });
  } catch (err) {
    const refunded = await refundCredit(wallet.id);
    await bumpStats({ failedDocuments: 1 });
    const e = err instanceof ExplainError ? err : new ExplainError(String(err), "Something went wrong. Please try again.", 500);
    console.error(JSON.stringify({ event: "explain_failed", reason: e.message, ms: Date.now() - started }));
    return fail(e.status, e.userMessage, { credits: refunded?.credits ?? reserved.credits + 1 });
  }
}
