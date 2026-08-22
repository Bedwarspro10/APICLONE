const DEFAULT_COURSE_API_ORIGIN = "https://course.nexttoppers.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, app_id, platform, Version, user_id, prefers-color-scheme",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
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

function getJwtUserId(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return "";
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - payload.length % 4) % 4);
    const decoded = atob(padded);
    const obj = JSON.parse(decoded);
    return obj?.user_id != null ? String(obj.user_id) : "";
  } catch (_) {
    return "";
  }
}

function copyQueryParams(source, target) {
  for (const [key, value] of source.searchParams) {
    if (key === "endpoint" || key === "target") continue;
    target.searchParams.append(key, value);
  }
}

export async function onRequest(context) {
  const request = context.request;
  const env = context.env || {};

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return json({ success: false, message: "Method not allowed." }, 405);
  }

  try {
    const rawToken = env.COURSE_API_TOKEN;
    if (!rawToken) {
      return json({ success: false, message: "COURSE_API_TOKEN is not configured." }, 500);
    }

    const token = String(rawToken).trim().replace(/^Bearer\s+/i, "");
    if (!token) {
      return json({ success: false, message: "COURSE_API_TOKEN is empty." }, 500);
    }

    const incomingUrl = new URL(request.url);
    const endpoint = incomingUrl.searchParams.get("endpoint");
    if (!endpoint || !/^[A-Za-z0-9_-]+$/.test(endpoint)) {
      return json({ success: false, message: "Missing or invalid endpoint." }, 400);
    }

    const origin = String(env.COURSE_API_ORIGIN || DEFAULT_COURSE_API_ORIGIN).replace(/\/+$/, "");
    const upstreamUrl = new URL(`${origin}/course/${endpoint}`);

    // The browser-only 'target' parameter belongs to this proxy and must not
    // be forwarded to Next Toppers. All real API query parameters are copied.
    copyQueryParams(incomingUrl, upstreamUrl);

    const headers = new Headers();
    headers.set("Accept", "application/json, text/plain, */*");
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("app_id", String(env.COURSE_APP_ID || "1770981347").trim());
    headers.set("platform", String(env.COURSE_PLATFORM || "3").trim());
    headers.set("Version", String(env.COURSE_VERSION || "1").trim());
    headers.set("Origin", "https://course.nexttoppers.com");
    headers.set("Referer", "https://course.nexttoppers.com/");

    const userId = String(env.COURSE_USER_ID || getJwtUserId(token)).trim();
    if (userId) headers.set("user_id", userId);

    const init = { method: request.method, headers };

    if (request.method === "POST") {
      const bodyText = await request.text();
      headers.set("Content-Type", request.headers.get("Content-Type") || "application/json");
      init.body = bodyText;
    }

    // Next Toppers exposes content-details as GET. If the old frontend sends
    // it as POST, translate the JSON body into query parameters here so both
    // old and new frontend code work without changing the upstream API.
    if (endpoint === "content-details" && request.method === "POST") {
      const bodyText = await request.text();
      let body = {};
      try { body = JSON.parse(bodyText || "{}"); } catch (_) {}

      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined && value !== null && value !== "") {
          const normalizedKey = key === "courseid" ? "course_id" : key;
          upstreamUrl.searchParams.set(normalizedKey, String(value));
        }
      }

      delete init.body;
      init.method = "GET";
      headers.delete("Content-Type");
    }

    const upstreamResponse = await fetch(upstreamUrl.toString(), init);
    const responseBody = await upstreamResponse.arrayBuffer();

    const responseHeaders = new Headers(CORS_HEADERS);
    responseHeaders.set(
      "Content-Type",
      upstreamResponse.headers.get("Content-Type") || "application/json; charset=utf-8"
    );
    responseHeaders.set("Cache-Control", "no-store");

    return new Response(responseBody, {
      status: upstreamResponse.status,
      headers: responseHeaders
    });
  } catch (error) {
    console.error("COURSE FUNCTION ERROR", error);
    return json({
      success: false,
      message: "Course API request failed.",
      error: error?.message || String(error)
    }, 500);
  }
}
