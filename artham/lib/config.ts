// Shared, client-safe configuration. Never put secrets in this file.

export const SITE = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || "Artham",
  tagline: "Understand any document in your own language",
  businessName: process.env.NEXT_PUBLIC_BUSINESS_NAME || "",
  businessAddress: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || "",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "",
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || "",
};

export type Plan = {
  id: string;
  credits: number;
  pricePaise: number;
  label: string;
  badge?: string;
};

export const PLANS: Plan[] = [
  { id: "single", credits: 1, pricePaise: 2900, label: "1 document" },
  { id: "pack5", credits: 5, pricePaise: 9900, label: "5 documents", badge: "Most popular" },
  { id: "pack15", credits: 15, pricePaise: 24900, label: "15 documents", badge: "Best value" },
];

export function findPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function rupees(paise: number): string {
  const r = paise / 100;
  return "₹" + (Number.isInteger(r) ? r.toString() : r.toFixed(2));
}

export type Language = {
  code: string;
  name: string;
  native: string;
  speech: string;
};

export const LANGUAGES: Language[] = [
  { code: "te", name: "Telugu", native: "తెలుగు", speech: "te-IN" },
  { code: "hi", name: "Hindi", native: "हिन्दी", speech: "hi-IN" },
  { code: "en", name: "English", native: "English", speech: "en-IN" },
  { code: "ta", name: "Tamil", native: "தமிழ்", speech: "ta-IN" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", speech: "kn-IN" },
  { code: "ml", name: "Malayalam", native: "മലയാളം", speech: "ml-IN" },
  { code: "mr", name: "Marathi", native: "मराठी", speech: "mr-IN" },
  { code: "bn", name: "Bengali", native: "বাংলা", speech: "bn-IN" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી", speech: "gu-IN" },
];

export function findLanguage(code: string): Language | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

export const LIMITS = {
  maxImages: 6,
  // Netlify functions accept about 6 MB per request (≈4.5 MB of binary data after encoding).
  maxUploadBytes: 4 * 1024 * 1024,
  maxPdfPages: 20,
  maxQuestionChars: 500,
  // Images are resized in the browser to this longest side before upload.
  imageMaxSide: 1600,
};

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const PDF_TYPE = "application/pdf";
