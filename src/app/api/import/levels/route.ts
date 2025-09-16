import { NextRequest } from 'next/server';
import { parseLevelsOfferFromHtml } from '@/lib/levelsImport';

// Minimal offer shape used here; rely on client to reconcile fields
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (typeof url !== 'string' || !url.startsWith('http')) {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), { status: 400 });
    }

  // Fetch HTML content of the Levels.fyi offer page
  const resp = await fetch(url, { headers: { 'user-agent': 'CompCalc Importer' } });
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `Fetch failed: ${resp.status}` }), { status: 502 });
    }
    const html = await resp.text();
  const offer = parseLevelsOfferFromHtml(html);

    return new Response(JSON.stringify({ offer }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: 'Import failed' }), { status: 500 });
  }
}
