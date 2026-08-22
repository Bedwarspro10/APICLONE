const DEFAULT_COURSE_API_ORIGIN = "https://course.nexttoppers.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Authorization, app_id, platform, Version, user_id, prefers-color-scheme",
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
    const p = token.split(".")[1];
    if (!p) return "";

    const b = p.replace(/-/g, "+").replace(/_/g, "/");
    const d = b + "=".repeat((4 - (b.length % 4)) % 4);
    const o = JSON.parse(atob(d));

    return o?.user_id != null ? String(o.user_id) : "";
  } catch {
    return "";
  }
}

function copyQueryParams(source, target) {
  for (const [k, v] of source.searchParams) {
    if (k === "endpoint" || k === "target") continue;
    target.searchParams.append(k, v);
  }
}

async function proxyFile(request) {
  const u = new URL(request.url).searchParams.get("url");

  if (!u) {
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
    remote = new URL(u);
  } catch {
    return json(
      {
        success: false,
        message: "Invalid file URL."
      },
      400
    );
  }

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

  const r = await fetch(remote.toString(), {
    headers: {
      Accept: "application/pdf,application/octet-stream,*/*"
    }
  });

  if (!r.ok) {
    return json(
      {
        success: false,
        message: `File request failed (${r.status}).`
      },
      r.status
    );
  }

  const h = new Headers();

  h.set(
    "Content-Type",
    r.headers.get("Content-Type") || "application/pdf"
  );

  h.set("Content-Disposition", "inline");
  h.set("Cache-Control", "private, no-store");

  return new Response(r.body, {
    status: 200,
    headers: h
  });
}

export async function onRequest(context) {
  const req = context.request;
  const env = context.env || {};

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS
    });
  }

  try {
    const url = new URL(req.url);

    if (url.pathname.endsWith("/course-file")) {
      return proxyFile(req);
    }

    if (req.method !== "GET" && req.method !== "POST") {
      return json(
        {
          success: false,
          message: "Method not allowed."
        },
        405
      );
    }

    const raw = env.COURSE_API_TOKEN;

    if (!raw) {
      return json(
        {
          success: false,
          message: "COURSE_API_TOKEN is not configured."
        },
        500
      );
    }

    const token = String(raw)
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

    const endpoint = url.searchParams.get("endpoint");

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
      env.COURSE_API_ORIGIN || DEFAULT_COURSE_API_ORIGIN
    ).replace(/\/+$/, "");

    const upstreamUrl = new URL(
      `${origin}/course/${endpoint}`
    );

    copyQueryParams(url, upstreamUrl);

    const headers = new Headers({
      Accept: "application/json, text/plain, */*",
      Authorization: `Bearer ${token}`,
      app_id: String(env.COURSE_APP_ID || "1770981347"),
      platform: String(env.COURSE_PLATFORM || "3"),
      Version: String(env.COURSE_VERSION || "1"),
      Origin: "https://course.nexttoppers.com",
      Referer: "https://course.nexttoppers.com/"
    });

    const uid = String(
      env.COURSE_USER_ID || getJwtUserId(token)
    ).trim();

    if (uid) {
      headers.set("user_id", uid);
    }

    let init = {
      method: req.method,
      headers
    };

    if (req.method === "POST") {
      const bodyText = await req.text();

      if (endpoint === "content-details") {
        let body = {};

        try {
          body = JSON.parse(bodyText || "{}");
        } catch {}

        for (const [k, v] of Object.entries(body)) {
          if (
            v !== undefined &&
            v !== null &&
            v !== ""
          ) {
            upstreamUrl.searchParams.set(
              k === "courseid" ? "course_id" : k,
              String(v)
            );
          }
        }

        init.method = "GET";
      } else {
        headers.set(
          "Content-Type",
          req.headers.get("Content-Type") ||
            "application/json"
        );

        init.body = bodyText;
      }
    }

    const r = await fetch(
      upstreamUrl.toString(),
      init
    );

    const body = await r.arrayBuffer();

    const out = new Headers(CORS_HEADERS);

    out.set(
      "Content-Type",
      r.headers.get("Content-Type") ||
        "application/json; charset=utf-8"
    );

    out.set("Cache-Control", "no-store");

    return new Response(body, {
      status: r.status,
      headers: out
    });

  } catch (e) {
    console.error(e);

    return json(
      {
        success: false,
        message: "Course API request failed.",
        error: e?.message || String(e)
      },
      500
    );
  }
}
