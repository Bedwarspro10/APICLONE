/**
 * Cloudflare Pages Function: /course
 *
 * Required:
 *   COURSE_API_ORIGIN
 *   COURSE_API_TOKEN
 *
 * Optional:
 *   COURSE_APP_ID
 *   COURSE_PLATFORM
 *   COURSE_USER_ID
 *   COURSE_VERSION
 */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function cleanOrigin(value) {
  return String(value || "").replace(/\/+$/, "");
}

export async function onRequest(context) {
  const { request, env } = context;

  if (!env.COURSE_API_ORIGIN) {
    return json(
      {
        success: false,
        message: "COURSE_API_ORIGIN is not configured.",
      },
      500
    );
  }

  if (!env.COURSE_API_TOKEN) {
    return json(
      {
        success: false,
        message: "COURSE_API_TOKEN is not configured.",
      },
      500
    );
  }

  const incoming = new URL(request.url);

  const endpoint = incoming.searchParams.get("endpoint");

  if (!endpoint || !/^[a-zA-Z0-9_-]+$/.test(endpoint)) {
    return json(
      {
        success: false,
        message: "Invalid or missing endpoint.",
      },
      400
    );
  }

  const origin = cleanOrigin(env.COURSE_API_ORIGIN);
  const targetUrl = `${origin}/${endpoint}`;

  const headers = new Headers();

  headers.set(
    "Accept",
    "application/json, text/plain, */*"
  );

  headers.set(
    "Authorization",
    `Bearer ${env.COURSE_API_TOKEN}`
  );

  headers.set(
    "app_id",
    env.COURSE_APP_ID || "1770981347"
  );

  headers.set(
    "platform",
    env.COURSE_PLATFORM || "3"
  );

  headers.set(
    "Version",
    env.COURSE_VERSION || "1"
  );

  // Only send user_id when configured.
  if (env.COURSE_USER_ID) {
    headers.set(
      "user_id",
      String(env.COURSE_USER_ID)
    );
  }

  let upstreamRequest;

  try {
    if (request.method === "GET") {
      const params = new URLSearchParams(
        incoming.searchParams
      );

      params.delete("endpoint");
      params.delete("target");

      const url = params.toString()
        ? `${targetUrl}?${params.toString()}`
        : targetUrl;

      upstreamRequest = new Request(url, {
        method: "GET",
        headers,
      });

    } else if (request.method === "POST") {
      headers.set(
        "Content-Type",
        "application/json"
      );

      const body = await request.text();

      upstreamRequest = new Request(targetUrl, {
        method: "POST",
        headers,
        body,
      });

    } else {
      return json(
        {
          success: false,
          message: "Method not allowed.",
        },
        405
      );
    }

    const upstream = await fetch(upstreamRequest);

    const responseBody = await upstream.text();

    const responseHeaders = new Headers();

    responseHeaders.set(
      "Content-Type",
      upstream.headers.get("Content-Type") ||
        "application/json; charset=utf-8"
    );

    responseHeaders.set(
      "Cache-Control",
      "no-store"
    );

    return new Response(responseBody, {
      status: upstream.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error(
      "[/course] Upstream request failed:",
      error
    );

    return json(
      {
        success: false,
        message: "Upstream API request failed.",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      502
    );
  }
}
