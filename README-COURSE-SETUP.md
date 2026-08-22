# Course API setup

This is a Cloudflare Pages site with a `/functions/course.js` server-side proxy for an authorized Next Toppers course API account.

## Required Cloudflare settings

Keep these values server-side:

- `COURSE_API_TOKEN` — **Secret**, your own authorized Bearer credential
- `COURSE_API_ORIGIN` — `https://course.nexttoppers.com`
- `COURSE_APP_ID` — `1770981347`
- `COURSE_PLATFORM` — `3`
- `COURSE_VERSION` — `1`
- `COURSE_USER_ID` — optional; if omitted, the Worker reads `user_id` from the JWT payload when available

Do not put the Bearer token in HTML, browser JavaScript, `wrangler.toml`, or GitHub.

## Supported proxy endpoints

- `course-details` — POST
- `all-content` — POST
- `content-details` — GET; the Worker also accepts legacy POST requests and translates their JSON body to the required GET query parameters

The browser-only `target` parameter is stripped before requests reach the upstream API.

## CORS

The Worker handles `OPTIONS` preflight and allows `prefers-color-scheme` along with the API headers used by the frontend.

## Content handling

Normal API responses containing a direct `file_url` can be opened/played by the frontend. Protected/encrypted payloads are passed through rather than decrypted or bypassed by this project.
