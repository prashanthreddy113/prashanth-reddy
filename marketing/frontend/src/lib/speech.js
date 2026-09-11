/** Browser speech-to-text (Chrome on Android, Safari on iOS). Returns null when unsupported. */
export const SPEECH_LANGS = [
  ['en-IN', 'English'], ['hi-IN', 'हिन्दी'], ['te-IN', 'తెలుగు'], ['ta-IN', 'தமிழ்'], ['kn-IN', 'ಕನ್ನಡ'], ['mr-IN', 'मराठी'],
]

export function isSpeechSupported() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export function createRecognizer({ lang = 'en-IN', onResult, onEnd, onError }) {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Ctor) return null
  const rec = new Ctor()
  rec.lang = lang
  rec.continuous = true
  rec.interimResults = true
  let finalText = ''
  rec.onresult = (e) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript
      if (e.results[i].isFinal) finalText += (finalText ? ' ' : '') + t.trim()
      else interim += t
    }
    onResult?.(finalText, interim)
  }
  rec.onerror = (e) => onError?.(e.error === 'not-allowed' ? 'Microphone permission denied.' : e.error === 'no-speech' ? 'No speech heard.' : `Dictation error: ${e.error}`)
  rec.onend = () => onEnd?.(finalText)
  return { start: () => rec.start(), stop: () => rec.stop(), abort: () => rec.abort() }
}
