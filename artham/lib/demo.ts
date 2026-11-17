// Sample explanation used only in demo mode (no API key, local development).
import type { Explanation } from "./schema.ts";

export const DEMO_EXPLANATION: Explanation = {
  readable: true,
  document_type: "Hospital bill (sample)",
  title: "Final bill for a 3-day hospital stay",
  summary:
    "This is a sample result shown because the app is running in demo mode without an AI key. " +
    "In this example, the hospital is asking you to pay ₹48,650 for a 3-day stay. " +
    "Your insurance has approved ₹35,000, so you need to pay ₹13,650 yourself. " +
    "Two charges look higher than usual and are worth asking about before you pay.",
  key_points: [
    "Patient was admitted on 12-11-2026 and discharged on 15-11-2026.",
    "The insurance company has approved ₹35,000 (cashless).",
    "You must pay the remaining ₹13,650 at the billing counter.",
  ],
  amounts: [
    { label: "Total bill", amount: "₹48,650", note: "Everything the hospital is charging" },
    { label: "Insurance approved", amount: "₹35,000", note: "Paid directly by insurance" },
    { label: "You pay", amount: "₹13,650", note: "Your share" },
    { label: "Consumables", amount: "₹6,200", note: "Gloves, syringes, etc." },
  ],
  dates: [
    { label: "Admission", date: "12-11-2026", why_it_matters: "Start of the stay" },
    { label: "Payment due", date: "15-11-2026", why_it_matters: "Pay before discharge" },
  ],
  red_flags: [
    {
      severity: "medium",
      title: "High consumables charge",
      explanation: "₹6,200 for consumables is high for a 3-day stay. Ask for an itemised list.",
    },
    {
      severity: "low",
      title: "Room charge for 4 days",
      explanation: "You stayed 3 nights but the room is charged for 4 days. Ask them to check.",
    },
  ],
  next_steps: [
    "Ask the billing desk for an itemised bill (every item with its price).",
    "Check the room days and consumables before paying.",
    "Keep the final bill and discharge summary safely for insurance claims.",
  ],
  questions_to_ask: [
    "Can I see the itemised list of consumables?",
    "Why is the room charged for 4 days?",
    "Will insurance cover any part of the ₹13,650?",
  ],
  expert: { recommended: false, expert_type: "", reason: "This bill can be checked at the billing desk." },
  unclear_parts: "",
  headings: {
    summary: "What this document says",
    key_points: "Important points",
    amounts: "Money",
    dates: "Dates and deadlines",
    red_flags: "Things to be careful about",
    next_steps: "What you should do",
    questions_to_ask: "Questions to ask",
    expert: "Do you need an expert?",
    unclear_parts: "Could not read clearly",
    no_red_flags: "Nothing risky found in this document.",
  },
};
