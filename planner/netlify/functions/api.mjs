import { getStore } from "@netlify/blobs";
import { createApi } from "../../lib/api-core.mjs";

export default async (req) => {
  // Deploy previews and branch deploys get their own store so test accounts never mix with real ones.
  const production = Netlify.context?.deploy?.context === "production";
  const store = getStore({ name: production ? "daybook" : "daybook-preview", consistency: "strong" });
  const handle = createApi({ store, env: key => Netlify.env.get(key) });
  return handle(req);
};

export const config = { path: "/api/*" };
