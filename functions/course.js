export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request)
    });
  }

  try {
    const endpoint = url.searchParams.get("endpoint");

    if (!endpoint) {
      return json({ success: false, message: "Missing endpoint" }, 400, request);
    }

    const allowed = [
      "course-details",
      "all-content"
    ];

    if (!allowed.includes(endpoint)) {
      return json({ success: false, message: "Endpoint not allowed" }, 400, request);
    }

    const origin = context.env.COURSE_API_ORIGIN;

    if (!origin) {
      return json({
        success: false,
        message: "COURSE_API_ORIGIN is not configured."
      }, 500, request);
    }

    const upstreamUrl =
      `${origin}/course/${endpoint}`;

    const headers = new Headers();

    headers.set("Accept", "application/json");

    const auth = request.headers.get("Authorization");
    if (auth) headers.set("Authorization", auth);

    let body = undefined;

    if (request.method !== "GET" && request.method !== "HEAD") {
      body = await request.text();

      if (body) {
        headers.set(
          "Content-Type",
          request.headers.get("Content-Type") ||
          "application/json"
        );
      }
    }

    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body
    });

    const responseBody = await upstream.arrayBuffer();

    const responseHeaders = new Headers({
      "Content-Type":
        upstream.headers.get("Content-Type") ||
        "application/json"
    });

    addCors(responseHeaders, request);

    return new Response(responseBody, {
      status: upstream.status,
      headers: responseHeaders
    });

  } catch (error) {
    return json({
      success: false,
      message: error instanceof Error
        ? error.message
        : "Upstream request failed"
    }, 500, request);
  }
}

function corsHeaders(request) {
  const h = new Headers();
  addCors(h, request);
  return h;
}

function addCors(headers, request) {
  const origin = request.headers.get("Origin");

  headers.set(
    "Access-Control-Allow-Origin",
    origin || "*"
  );

  headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );

  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept"
  );

  headers.set("Access-Control-Max-Age", "86400");
}

function json(data, status, request) {
  const headers = corsHeaders(request);
  headers.set("Content-Type", "application/json");

  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}
