import { z } from "zod";

// The exact shape Claude must return (enforced with structured outputs).
export const ExplanationSchema = z.object({
  readable: z
    .boolean()
    .describe("false when the upload is not a document or is too unclear to read"),
  document_type: z.string().describe("What kind of document this is, e.g. hospital bill, rental agreement"),
  title: z.string().describe("A short title for this document"),
  summary: z.string().describe("3 to 6 short, simple sentences explaining what the document is and what it means for the user"),
  key_points: z.array(z.string()).describe("The most important facts in the document"),
  amounts: z
    .array(
      z.object({
        label: z.string(),
        amount: z.string().describe("Exactly as written, e.g. ₹12,450"),
        note: z.string().describe("What this amount is for; empty string if obvious"),
      }),
    )
    .describe("Every amount of money that matters"),
  dates: z
    .array(
      z.object({
        label: z.string(),
        date: z.string().describe("Exactly as written in the document"),
        why_it_matters: z.string(),
      }),
    )
    .describe("Every date or deadline that matters"),
  red_flags: z
    .array(
      z.object({
        severity: z.enum(["high", "medium", "low"]),
        title: z.string(),
        explanation: z.string(),
      }),
    )
    .describe("Real risks only; empty when nothing looks wrong"),
  next_steps: z.array(z.string()).describe("Practical steps in order"),
  questions_to_ask: z.array(z.string()).describe("Questions the user should ask the other party"),
  expert: z.object({
    recommended: z.boolean(),
    expert_type: z.string().describe("e.g. lawyer, doctor, chartered accountant; empty if not recommended"),
    reason: z.string(),
  }),
  unclear_parts: z.string().describe("Anything unreadable, cut off or ambiguous; empty string if none"),
  headings: z
    .object({
      summary: z.string(),
      key_points: z.string(),
      amounts: z.string(),
      dates: z.string(),
      red_flags: z.string(),
      next_steps: z.string(),
      questions_to_ask: z.string(),
      expert: z.string(),
      unclear_parts: z.string(),
      no_red_flags: z.string().describe("Short reassuring line used when red_flags is empty, e.g. Nothing risky found"),
    })
    .describe("Short section titles, translated into the output language"),
});

export type Explanation = z.infer<typeof ExplanationSchema>;
