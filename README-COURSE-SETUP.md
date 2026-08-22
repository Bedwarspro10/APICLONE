# Course API setup

This bundle contains the complete static site plus the `/course` Cloudflare Pages Function.

## Cloudflare Pages

1. Deploy the repository with `index.html` at the project root.
2. Keep `functions/course.js` in the `functions/` directory.
3. In Cloudflare Pages → Settings → Environment variables, configure these **server-side** values:

- `COURSE_API_TOKEN` — your own authorized API credential
- `COURSE_APP_ID` — application ID required by your authorized API
- `COURSE_USER_ID` — user ID required by your authorized API, if applicable
- `COURSE_PLATFORM` — normally the platform value supplied by your API contract
- `COURSE_VERSION` — API version supplied by your API contract
- `COURSE_API_ORIGIN` — course API origin, if different from the default
- `CONTENT_API_ORIGIN` — content/video API origin, if different from the default

Do **not** put bearer tokens in `js/api-helper.js`, `index.html`, or `course_dynamic.html`.

## Supported course operations

The adapter currently supports:

- `course-details`
- `all-content`
- `content-details`
- `video-details`

IDs such as `course_id`, `folder_id`, `content_id`, and `videoid` are passed dynamically.

This bundle is intended for APIs/accounts you are authorized to access.
