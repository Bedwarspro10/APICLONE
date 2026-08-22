const DEFAULT_ORIGIN = "https://course.nexttoppers.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Authorization, app_id, platform, Version, user_id, prefers-color-scheme",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extra
    }
  });
}

function getJwtUserId(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return "";

    let payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    payload += "=".repeat((4 - (payload.length % 4)) % 4);

    const decoded = atob(payload);
    const parsed = JSON.parse(decoded);

    return parsed?.user_id != null
      ? String(parsed.user_id)
      : "";
  } catch {
    return "";
  }
}

function appendQueryParams(source, target) {
  for (const [key, value] of source.searchParams) {
    if (key === "endpoint" || key === "target") continue;

    // Old frontend used courseid.
    const normalized =
      key === "courseid" ? "course_id" : key;

    if (value !== "") {
      target.searchParams.append(normalized, value);
    }
  }
}

async function proxyCloudFrontFile(request) {
  const requestUrl = new URL(request.url);
  const remoteUrl = requestUrl.searchParams.get("url");

  if (!remoteUrl) {
    return json(
      {
        success: false,
        message: "Missing file URL."
      },
      400
    );
  }

  let remote;

  try {
    remote = new URL(remoteUrl);
  } catch {
    return json(
      {
        success: false,
        message: "Invalid file URL."
      },
      400
    );
  }

  /*
   * Only proxy HTTPS CloudFront resources.
   * This prevents the endpoint from becoming an arbitrary
   * open proxy.
   */
  if (
    remote.protocol !== "https:" ||
    !remote.hostname.endsWith(".cloudfront.net")
  ) {
    return json(
      {
        success: false,
        message: "File host is not allowed."
      },
      403
    );
  }

  try {
    const response = await fetch(remote.toString(), {
      method: "GET",
      headers: {
        Accept: "*/*"
      }
    });

    if (!response.ok) {
      return json(
        {
          success: false,
          message: `File request failed (${response.status}).`
        },
        response.status
      );
    }

    const headers = new Headers();

    headers.set(
      "Content-Type",
      response.headers.get("Content-Type") ||
        "application/octet-stream"
    );

    headers.set(
      "Content-Disposition",
      "inline"
    );

    headers.set(
      "Cache-Control",
      "private, no-store"
    );

    headers.set(
      "Access-Control-Allow-Origin",
      "*"
    );

    return new Response(response.body, {
      status: 200,
      headers
    });
  } catch (error) {
    return json(
      {
        success: false,
        message: "Unable to retrieve file.",
        error: error?.message || String(error)
      },
      502
    );
  }
}

export async function onRequest(context) {
  const request = context.request;
  const env = context.env || {};

  /*
   * CORS preflight
   */
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS
    });
  }

  try {
    const requestUrl = new URL(request.url);

    /*
     * Local PDF/file proxy.
     */
    if (
      requestUrl.pathname.endsWith("/course-file")
    ) {
      return proxyCloudFrontFile(request);
    }

    if (
      request.method !== "GET" &&
      request.method !== "POST"
    ) {
      return json(
        {
          success: false,
          message: "Method not allowed."
        },
        405
      );
    }

    /*
     * Authentication remains server-side.
     */
    const configuredToken = env.COURSE_API_TOKEN;

    if (!configuredToken) {
      return json(
        {
          success: false,
          message: "COURSE_API_TOKEN is not configured."
        },
        500
      );
    }

    const token = String(configuredToken)
      .trim()
      .replace(/^Bearer\s+/i, "");

    if (!token) {
      return json(
        {
          success: false,
          message: "COURSE_API_TOKEN is empty."
        },
        500
      );
    }

    /*
     * endpoint examples:
     *
     * course-details
     * all-content
     * content-details
     */
    const endpoint =
      requestUrl.searchParams.get("endpoint");

    if (
      !endpoint ||
      !/^[A-Za-z0-9_-]+$/.test(endpoint)
    ) {
      return json(
        {
          success: false,
          message: "Missing or invalid endpoint."
        },
        400
      );
    }

    const origin = String(
      env.COURSE_API_ORIGIN || DEFAULT_ORIGIN
    ).replace(/\/+$/, "");

    const upstreamUrl =
      new URL(`${origin}/course/${endpoint}`);

    /*
     * GET parameters.
     */
    appendQueryParams(
      requestUrl,
      upstreamUrl
    );

    const headers = new Headers();

    headers.set(
      "Accept",
      "application/json, text/plain, */*"
    );

    headers.set(
      "Authorization",
      `Bearer ${token}`
    );

    headers.set(
      "app_id",
      String(
        env.COURSE_APP_ID || "1770981347"
      )
    );

    headers.set(
      "platform",
      String(
        env.COURSE_PLATFORM || "3"
      )
    );

    headers.set(
      "Version",
      String(
        env.COURSE_VERSION || "1"
      )
    );

    /*
     * user_id comes from an explicitly configured value
     * or from the authorized JWT.
     */
    const userId = String(
      env.COURSE_USER_ID ||
        getJwtUserId(token)
    ).trim();

    if (userId) {
      headers.set("user_id", userId);
    }

    let fetchOptions = {
      method: request.method,
      headers
    };

    /*
     * all-content is POST.
     */
    if (request.method === "POST") {
      const bodyText = await request.text();

      let body = {};

      try {
        body = JSON.parse(bodyText || "{}");
      } catch {
        body = {};
      }

      /*
       * content-details is a GET endpoint on the
       * current course API, even when the frontend
       * submits it through our POST helper.
       */
      if (endpoint === "content-details") {
        for (const [key, value] of Object.entries(body)) {
          if (
            value === undefined ||
            value === null ||
            value === ""
          ) {
            continue;
          }

          const normalizedKey =
            key === "courseid"
              ? "course_id"
              : key;

          upstreamUrl.searchParams.set(
            normalizedKey,
            String(value)
          );
        }

        fetchOptions = {
          method: "GET",
          headers
        };
      } else {
        headers.set(
          "Content-Type",
          request.headers.get("Content-Type") ||
            "application/json"
        );

        fetchOptions.body = bodyText;
      }
    }

    const upstreamResponse =
      await fetch(
        upstreamUrl.toString(),
        fetchOptions
      );

    const responseBody =
      await upstreamResponse.arrayBuffer();

    const outputHeaders =
      new Headers(CORS_HEADERS);

    outputHeaders.set(
      "Content-Type",
      upstreamResponse.headers.get(
        "Content-Type"
      ) ||
        "application/json; charset=utf-8"
    );

    outputHeaders.set(
      "Cache-Control",
      "no-store"
    );

    return new Response(
      responseBody,
      {
        status: upstreamResponse.status,
        headers: outputHeaders
      }
    );

  } catch (error) {
    console.error(
      "Course proxy error:",
      error
    );

    return json(
      {
        success: false,
        message: "Course API request failed.",
        error:
          error?.message ||
          String(error)
      },
      500
    );
  }
}
