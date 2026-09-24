import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Default config: incremental cache disabled (fully dynamic API routes,
  // static pages prerendered at build time). No KV/R2/D1 bindings needed.
});
