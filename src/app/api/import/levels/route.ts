import { NextRequest } from 'next/server';
import { parseLevelsOfferFromHtml } from '@/lib/levelsImport';

// Only allow importing from Levels.fyi pages. The Worker is public, so an
// unrestricted server-side fetch would be an SSRF vector.
const ALLOWED_HOSTS = new Set(['levels.fyi', 'www.levels.fyi']);
const FETCH_TIMEOUT_MS = 15_000;
const MAX_HTML_BYTES = 5 * 1024 * 1024;

function urlError() {
  return new Response(JSON.stringify({ error: 'Invalid URL' }), { status: 400 });
}

// Minimal offer shape used here; rely on client to reconcile fields
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return urlError();
    }
    if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
      return urlError();
    }

    // Fetch HTML content of the Levels.fyi offer page.
    // manual redirects so we can reject any hop that leaves the allowlist.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      let target = parsed.toString();
      let resp: Response | null = null;
      for (let hops = 0; hops < 5; hops++) {
        resp = await fetch(target, {
          headers: { 'user-agent': 'CompCalc Importer' },
          redirect: 'manual',
          signal: controller.signal,
        });
        const status = resp.status;
        if (status >= 300 && status < 400) {
          const location = resp.headers.get('location');
          if (!location) {
            return new Response(JSON.stringify({ error: 'Fetch failed: bad redirect' }), {
              status: 502,
            });
          }
          const next = new URL(location, target);
          if (next.protocol !== 'https:' || !ALLOWED_HOSTS.has(next.hostname.toLowerCase())) {
            return new Response(JSON.stringify({ error: 'Redirect not allowed' }), {
              status: 502,
            });
          }
          target = next.toString();
          continue;
        }
        break;
      }
      if (!resp || (resp.status >= 300 && resp.status < 400)) {
        return new Response(JSON.stringify({ error: 'Fetch failed: too many redirects' }), {
          status: 502,
        });
      }
      if (!resp.ok) {
        return new Response(JSON.stringify({ error: `Fetch failed: ${resp.status}` }), {
          status: 502,
        });
      }
      const length = resp.headers.get('content-length');
      if (length && Number(length) > MAX_HTML_BYTES) {
        return new Response(JSON.stringify({ error: 'Page too large' }), { status: 502 });
      }
      let html = await resp.text();
      if (html.length > MAX_HTML_BYTES) {
        html = html.slice(0, MAX_HTML_BYTES);
      }
      const offer = parseLevelsOfferFromHtml(html);
      return new Response(JSON.stringify({ offer }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    const status = err instanceof Error && err.name === 'AbortError' ? 504 : 500;
    return new Response(
      JSON.stringify({ error: status === 504 ? 'Import timed out' : 'Import failed' }),
      { status }
    );
  }
}
