// Claude setup shared by the AI functions. The key lives only in the Netlify
// environment variable ANTHROPIC_API_KEY (scope: Functions) — never in the website.
import Anthropic from '@anthropic-ai/sdk';
import { env } from './env.mts';

export const MODEL = 'claude-opus-5-5';
/** If Claude declines a request for safety reasons, the API re-runs it on a suitable fallback model. */
export const FALLBACK = { betas: ['server-side-fallback-2026-07-01'] as Anthropic.Beta.AnthropicBeta[], fallbacks: 'default' as const };

export const aiConfigured = () => !!env('ANTHROPIC_API_KEY');
let client: Anthropic | null = null;
export function claude(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env('ANTHROPIC_API_KEY'), ...(env('ANTHROPIC_TEST_BASE_URL') ? { baseURL: env('ANTHROPIC_TEST_BASE_URL') } : {}), maxRetries: 2, timeout: 45_000 });
  return client;
}

/** Customer-safe message for API failures; details go to the function log only. */
export function aiErrorMessage(e: unknown): { status: number; message: string } {
  if (e instanceof Anthropic.RateLimitError) return { status: 429, message: 'Our stylist is busy right now — please try again in a minute.' };
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) { console.error('Anthropic key problem', e.status); return { status: 503, message: 'The AI assistant is not available right now.' }; }
  if (e instanceof Anthropic.BadRequestError) { console.error('Anthropic bad request', e.message); return { status: 400, message: 'Sorry, I couldn’t handle that request.' }; }
  if (e instanceof Anthropic.APIError) { console.error('Anthropic API error', e.status, e.message); return { status: 502, message: 'The AI assistant had a hiccup — please try again.' }; }
  console.error('AI function error', e);
  return { status: 500, message: 'Something went wrong — please try again.' };
}
