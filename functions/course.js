const COURSE_API_ORIGIN = "https://course.nexttoppers.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Authorization, app_id, platform, Version, user_id, prefers-color-scheme",
  "Access-Control-Max-Age": "86400"
};

function makeJson(data, status) {
  return new Response(JSON.stringify(data), {
    status: status,
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

    // Authentication secret
    const token = env.COURSE_API_TOKEN;

    if (!token) {
      return makeJson({
        success: false,
        message: "COURSE_API_TOKEN is not configured."
      }, 500);
    }

    const incoming = new URL(request.url);
    const endpoint = incoming.searchParams.get("endpoint");

    if (!endpoint) {
      return makeJson({
        success: false,
        message: "Missing endpoint."
      }, 400);
    }

    // Only permit simple endpoint names.
    if (!/^[a-zA-Z0-9_-]+$/.test(endpoint)) {
      return makeJson({
        success: false,
        message: "Invalid endpoint."
      }, 400);
    }

    const upstreamUrl =
      COURSE_API_ORIGIN + "/" + endpoint;

    const upstreamHeaders = {
      "Accept": "application/json, text/plain, */*",
      "Authorization": "Bearer " + String(token),
      "app_id": String(env.COURSE_APP_ID || "1770981347"),
      "platform": String(env.COURSE_PLATFORM || "3"),
      "Version": String(env.COURSE_VERSION || "1")
    };

    if (env.COURSE_USER_ID) {
      upstreamHeaders.user_id =
        String(env.COURSE_USER_ID);
    }

    let upstreamResponse;

    if (request.method === "GET") {
      const params = new URLSearchParams(
        incoming.search
      );

      params.delete("endpoint");
      params.delete("target");

      const query = params.toString();

      const finalUrl = query
        ? upstreamUrl + "?" + query
        : upstreamUrl;

      upstreamResponse = await fetch(finalUrl, {
        method: "GET",
        headers: upstreamHeaders
      });

    } else if (request.method === "POST") {
      const requestBody = await request.text();

      upstreamHeaders["Content-Type"] =
        "application/json";

      upstreamResponse = await fetch(upstreamUrl, {
        method: "POST",
        headers: upstreamHeaders,
        body: requestBody
      });

    } else {
      return makeJson({
        success: false,
        message: "Method not allowed."
      }, 405);
    }

    const responseText =
      await upstreamResponse.text();

    return new Response(responseText, {
      status: upstreamResponse.status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type":
          upstreamResponse.headers.get(
            "Content-Type"
          ) || "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });

  } catch (error) {
    console.error(
      "COURSE FUNCTION ERROR:",
      error
    );

    return makeJson({
      success: false,
      message: "Course function exception.",
      error: error && error.message
        ? error.message
        : String(error)
    }, 500);
  }
}
