import { SITE } from "@/lib/config.ts";

/** Shows a business detail, or a highlighted placeholder until it is configured. */
export function Biz({ field, fallback }: { field: "businessName" | "businessAddress" | "supportEmail" | "supportPhone"; fallback: string }) {
  const value = SITE[field];
  if (value) {
    if (field === "supportEmail") return <a href={`mailto:${value}`}>{value}</a>;
    if (field === "supportPhone") return <a href={`tel:${value.replace(/\s/g, "")}`}>{value}</a>;
    return <>{value}</>;
  }
  return <span className="placeholder">[{fallback}]</span>;
}

export const LAST_UPDATED = "17 November 2026";
