const DEFAULT_COURSE_API_ORIGIN = "https://course.nexttoppers.com";
const DEFAULT_CONTENT_API_ORIGIN = "https://apiserver.deltastudy.site";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Authorization, app_id, platform, Version, user_id, prefers-color-scheme",
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
  try {
    const request = context.request;
    const env = context.env || {};

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    // Required secret
    const rawToken = env.COURSE_API_TOKEN;

    if (!rawToken) {
      return json({
        success: false,
        message: "COURSE_API_TOKEN is not configured."
      }, 500);
    }

    const token = String(rawToken)
      .trim()
      .replace(/^Bearer\s+/i, "");

    if (!token) {
      return json({
        success: false,
        message: "COURSE_API_TOKEN is empty."
      }, 500);
    }

    const url = new URL(request.url);
    const endpoint = url.searchParams.get("endpoint");

    if (!endpoint) {
      return json({
        success: false,
        message: "Missing endpoint."
      }, 400);
    }

    // Prevent arbitrary upstream paths
    if (!/^[a-zA-Z0-9_-]+$/.test(endpoint)) {
      return json({
        success: false,
        message: "Invalid endpoint."
      }, 400);
    }

    // The course API and content-details API use different authorized origins.
    // Keep both server-side so the browser never receives the bearer token.
    const courseOrigin = String(
      env.COURSE_API_ORIGIN || DEFAULT_COURSE_API_ORIGIN
    ).replace(/\/+$/, "");
    const contentOrigin = String(
      env.CONTENT_API_ORIGIN || DEFAULT_CONTENT_API_ORIGIN
    ).replace(/\/+$/, "");

    let upstreamUrl;
    if (endpoint === "content-details") {
      upstreamUrl = `${contentOrigin}/api/nexttoppers/content-details`;
    } else {
      upstreamUrl = `${courseOrigin}/course/${endpoint}`;
    }

    const appId = String(
      env.COURSE_APP_ID || "1770981347"
    ).trim();

    const platform = String(
      env.COURSE_PLATFORM || "3"
    ).trim();

    const version = String(
      env.COURSE_VERSION || "1"
    ).trim();

    const upstreamHeaders = new Headers();

    upstreamHeaders.set(
      "Accept",
      "application/json, text/plain, */*"
    );

    upstreamHeaders.set(
      "Authorization",
      `Bearer ${token}`
    );

    upstreamHeaders.set(
      "app_id",
      appId
    );

    upstreamHeaders.set(
      "platform",
      platform
    );

    upstreamHeaders.set(
      "Version",
      version
    );

    if (env.COURSE_USER_ID) {
      upstreamHeaders.set(
        "user_id",
        String(env.COURSE_USER_ID).trim()
      );
    }

    let response;

    if (request.method === "POST") {
      const body = await request.text();

      upstreamHeaders.set(
        "Content-Type",
        "application/json"
      );

      response = await fetch(upstreamUrl, {
        method: "POST",
        headers: upstreamHeaders,
        body
      });

    } else if (request.method === "GET") {

      const params = new URLSearchParams();

      for (const [key, value] of url.searchParams) {
        if (
          key !== "endpoint" &&
          key !== "target"
        ) {
          params.append(key, value);
        }
      }

      const query = params.toString();

      const finalUrl = query
        ? `${upstreamUrl}?${query}`
        : upstreamUrl;

      response = await fetch(finalUrl, {
        method: "GET",
        headers: upstreamHeaders
      });

    } else {
      return json({
        success: false,
        message: "Method not allowed."
      }, 405);
    }

    const responseText = await response.text();

    return new Response(responseText, {
      status: response.status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type":
          response.headers.get("Content-Type") ||
          "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });

  } catch (error) {

    console.error(
      "COURSE FUNCTION ERROR:",
      error
    );

    return json({
      success: false,
      message: "Course function exception.",
      error: error?.message || String(error)
    }, 500);
  }
        }
