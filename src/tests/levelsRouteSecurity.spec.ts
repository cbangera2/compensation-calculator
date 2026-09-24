import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/import/levels/route';

function postReq(url: unknown) {
  return new NextRequest('http://localhost/api/import/levels', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/import/levels SSRF hardening', () => {
  it('rejects non-levels.fyi hosts', async () => {
    const res = await POST(postReq('https://evil.example.com/offer/1'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid URL' });
  });

  it('rejects plain http levels.fyi urls', async () => {
    const res = await POST(postReq('http://www.levels.fyi/offer/1'));
    expect(res.status).toBe(400);
  });

  it('rejects non-string urls', async () => {
    const res = await POST(postReq(42));
    expect(res.status).toBe(400);
  });

  it('fetches allowed hosts and returns the parsed offer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('<html><body>Base Salary $150,000</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const res = await POST(postReq('https://www.levels.fyi/offer/abc'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('offer');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe('https://www.levels.fyi/offer/abc');
    expect((init as RequestInit).redirect).toBe('manual');
  });

  it('blocks redirects that leave levels.fyi', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'https://evil.example.com/steal' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const res = await POST(postReq('https://www.levels.fyi/offer/abc'));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Redirect not allowed' });
  });

  it('follows same-host redirects', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { location: '/offer/real' },
        })
      )
      .mockResolvedValueOnce(
        new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } })
      );
    vi.stubGlobal('fetch', fetchMock);
    const res = await POST(postReq('https://levels.fyi/offer/short'));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
