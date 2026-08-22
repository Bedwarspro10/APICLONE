export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders(request) });

  try {
    const endpoint = url.searchParams.get("endpoint") || "";
    const allowed = new Set(["course-details", "all-content", "content-details"]);

    if (!allowed.has(endpoint))
      return json({ success:false, message:"Endpoint not allowed" }, 400, request);

    const origin = String(context.env.COURSE_API_ORIGIN || "").replace(/\/+$/, "");
    if (!origin)
      return json({ success:false, message:"COURSE_API_ORIGIN is not configured." }, 500, request);

    const upstreamUrl = new URL(`/course/${endpoint}`, origin + "/");

    for (const [key, value] of url.searchParams) {
      if (key !== "endpoint" && key !== "target")
        upstreamUrl.searchParams.set(key, value);
    }

    const headers = new Headers({
      "Accept": "application/json, text/plain, */*"
    });

    const serverToken = context.env.COURSE_API_TOKEN;
    const clientAuth = request.headers.get("Authorization");

    if (serverToken)
      headers.set("Authorization", /^Bearer\s/i.test(serverToken) ? serverToken : `Bearer ${serverToken}`);
    else if (clientAuth)
      headers.set("Authorization", clientAuth);

    for (const name of ["app_id", "platform", "user_id", "Version"]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }

    let body;
    if (request.method !== "GET" && request.method !== "HEAD") {
      body = await request.arrayBuffer();
      const ct = request.headers.get("Content-Type");
      if (ct) headers.set("Content-Type", ct);
    }

    const upstream = await fetch(upstreamUrl.toString(), {
      method: request.method,
      headers,
      body
    });

    const responseHeaders = new Headers({
      "Content-Type": upstream.headers.get("Content-Type") || "application/json; charset=utf-8"
    });
    addCors(responseHeaders, request);

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders
    });
  } catch (error) {
    return json({
      success:false,
      message:error instanceof Error ? error.message : "Upstream request failed"
    }, 500, request);
  }
}

function addCors(headers, request) {
  headers.set("Access-Control-Allow-Origin", request.headers.get("Origin") || "*");
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept, app_id, platform, user_id, Version, prefers-color-scheme"
  );
  headers.set("Access-Control-Max-Age", "86400");
}

function corsHeaders(request) {
  const h = new Headers();
  addCors(h, request);
  return h;
}

function json(data, status, request) {
  const h = corsHeaders(request);
  h.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { status, headers:h });
}
