/**
 * Cloudflare Pages Function for /course
 *
 * Configure these as Cloudflare Pages/Workers environment variables:
 *   COURSE_API_ORIGIN       e.g. https://example.com
 *   NEXTTOPPERS_API_TOKEN   private upstream bearer token
 *
 * Never put the token in browser JS or commit it to Git.
 */

export async function onRequest(context) {
  const { request, env } = context;
  const incoming = new URL(request.url);
  const endpoint = incoming.searchParams.get('endpoint');
  const target = incoming.searchParams.get('target') || 'nexttoppers-course';

  if (!endpoint) {
    return json({ success: false, message: 'Missing endpoint' }, 400);
  }

  const origin = String(env.COURSE_API_ORIGIN || '').replace(/\/$/, '');
  const token = String(env.NEXTTOPPERS_API_TOKEN || '');

  if (!origin) {
    return json({ success: false, message: 'COURSE_API_ORIGIN is not configured.' }, 503);
  }
  if (!token) {
    return json({ success: false, message: 'NEXTTOPPERS_API_TOKEN is not configured.' }, 503);
  }

  const upstream = new URL(`${origin}/course`);
  upstream.searchParams.set('endpoint', endpoint);
  upstream.searchParams.set('target', target);

  // Preserve compatibility with old GET callers while sending the upstream
  // request using the POST contract used by the recovery frontend.
  let body = {};
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try { body = await request.json(); } catch { body = {}; }
    }
  } else {
    for (const [key, value] of incoming.searchParams.entries()) {
      if (key !== 'endpoint' && key !== 'target') body[key] = value;
    }
  }

  try {
    const upstreamResponse = await fetch(upstream.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const responseHeaders = new Headers();
    const contentType = upstreamResponse.headers.get('content-type');
    responseHeaders.set('Content-Type', contentType || 'application/json; charset=utf-8');
    responseHeaders.set('Cache-Control', 'no-store');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders
    });
  } catch (error) {
    console.error('[COURSE PROXY]', error);
    return json({ success: false, message: 'Course API upstream unavailable.' }, 502);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}
