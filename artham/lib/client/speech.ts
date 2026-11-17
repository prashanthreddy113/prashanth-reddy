// Browser-only: read the explanation aloud with the phone's built-in voices (free).

function voicesReady(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices());
    synth.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
}

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export async function hasVoiceFor(lang: string): Promise<boolean> {
  if (!speechSupported()) return false;
  const prefix = lang.split("-")[0].toLowerCase();
  return (await voicesReady()).some((v) => v.lang.toLowerCase().replace("_", "-").startsWith(prefix));
}

/** Long texts are split into sentences: some browsers stop speaking after ~15 seconds otherwise. */
function chunks(text: string): string[] {
  const parts = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?।॥])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    if (p.length <= 220) out.push(p);
    else out.push(...(p.match(/.{1,220}(\s|$)/g) ?? [p]).map((s) => s.trim()));
  }
  return out;
}

export async function speak(text: string, lang: string, onEnd: () => void): Promise<void> {
  if (!speechSupported()) return onEnd();
  const synth = window.speechSynthesis;
  synth.cancel();
  const prefix = lang.split("-")[0].toLowerCase();
  const voice = (await voicesReady()).find((v) => v.lang.toLowerCase().replace("_", "-").startsWith(prefix));
  const list = chunks(text);
  list.forEach((part, i) => {
    const u = new SpeechSynthesisUtterance(part);
    u.lang = lang;
    if (voice) u.voice = voice;
    u.rate = 0.95;
    if (i === list.length - 1) {
      u.onend = onEnd;
      u.onerror = onEnd;
    }
    synth.speak(u);
  });
  if (!list.length) onEnd();
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
}
