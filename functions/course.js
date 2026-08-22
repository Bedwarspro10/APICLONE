const COURSE_API_ORIGIN = "https://course.nexttoppers.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Authorization, app_id, platform, Version, user_id",
  "Access-Control-Max-Age": "86400"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const incoming = new URL(request.url);

  // Handle browser CORS preflight.
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS
    });
  }

  if (!env.COURSE_API_TOKEN) {
    return json({
      success: false,
      message: "COURSE_API_TOKEN is not configured."
    }, 500);
  }

  const endpoint = incoming.searchParams.get("endpoint");

  if (!endpoint || !/^[a-zA-Z0-9_-]+$/.test(endpoint)) {
    return json({
      success: false,
      message: "Invalid or missing endpoint."
    }, 400);
  }

  const targetUrl = `${COURSE_API_ORIGIN}/${endpoint}`;

  const headers = new Headers({
    "Accept": "application/json, text/plain, */*",
    "Authorization": `Bearer ${env.COURSE_API_TOKEN}`,
    "app_id": env.COURSE_APP_ID || "1770981347",
    "platform": env.COURSE_PLATFORM || "3",
    "Version": env.COURSE_VERSION || "1"
  });

  if (env.COURSE_USER_ID) {
    headers.set("user_id", String(env.COURSE_USER_ID));
  }

  try {
    let upstream;

    if (request.method === "GET") {
      const params = new URLSearchParams(incoming.searchParams);
      params.delete("endpoint");
      params.delete("target");

      const url = params.toString()
        ? `${targetUrl}?${params.toString()}`
        : targetUrl;

      upstream = await fetch(url, {
        method: "GET",
        headers
      });

    } else if (request.method === "POST") {
      headers.set("Content-Type", "application/json");

      const body = await request.text();

      upstream = await fetch(targetUrl, {
        method: "POST",
        headers,
        body
      });

    } else {
      return json({
        success: false,
        message: "Method not allowed."
      }, 405);
    }

    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type":
          upstream.headers.get("Content-Type") ||
          "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });

  } catch (error) {
    console.error("[course] upstream request failed:", error);

    return json({
      success: false,
      message: "Upstream API request failed.",
      error: error instanceof Error
        ? error.message
        : String(error)
    }, 502);
  }
}
