/**
 * Cloudflare Pages Function: /course
 *
 * Server-side API adapter for an AUTHORIZED integration.
 * Configure COURSE_API_TOKEN as a Cloudflare Pages/Workers secret.
 * Never place a bearer token in browser JavaScript or commit it to Git.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    'Vary': 'Origin'
  };

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const endpoint = url.searchParams.get('endpoint');
  const token = env.COURSE_API_TOKEN;
  if (!endpoint) return json({ success: false, message: 'Missing endpoint' }, 400, cors);
  if (!token) return json({ success: false, message: 'COURSE_API_TOKEN is not configured.' }, 500, cors);

  const courseOrigin = env.COURSE_API_ORIGIN || 'https://course.nexttoppers.com';
  const contentOrigin = env.CONTENT_API_ORIGIN || 'https://apiserver.deltastudy.site';

  const courseEndpoints = new Set(['course-details', 'all-content']);
  const contentEndpoints = new Set(['content-details', 'video-details']);

  try {
    let upstream;
    let init = {
      method: request.method,
      headers: {
        Accept: 'application/json, text/plain, */*',
        Authorization: `Bearer ${token}`,
        app_id: env.COURSE_APP_ID || '1770981347',
        platform: env.COURSE_PLATFORM || '3',
        user_id: env.COURSE_USER_ID || '',
        Version: env.COURSE_VERSION || '1'
      }
    };

    if (courseEndpoints.has(endpoint)) {
      upstream = new URL(`/course/${endpoint}`, courseOrigin);
      if (request.method === 'GET') {
        for (const [k, v] of url.searchParams) if (k !== 'endpoint' && k !== 'target') upstream.searchParams.set(k, v);
      } else {
        init.headers['Content-Type'] = 'application/json';
        init.body = await request.text();
      }
    } else if (contentEndpoints.has(endpoint)) {
      upstream = new URL(`/api/nexttoppers/${endpoint}`, contentOrigin);
      for (const [k, v] of url.searchParams) if (k !== 'endpoint' && k !== 'target') upstream.searchParams.set(k, v);
    } else {
      return json({ success: false, message: `Unsupported endpoint: ${endpoint}` }, 400, cors);
    }

    const response = await fetch(upstream.toString(), init);
    const body = await response.text();
    const headers = new Headers(cors);
    headers.set('Content-Type', response.headers.get('content-type') || 'application/json; charset=utf-8');
    return new Response(body, { status: response.status, headers });
  } catch (error) {
    return json({ success: false, message: error?.message || 'Upstream request failed' }, 502, cors);
  }
}

function json(value, status, cors) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' }
  });
}
