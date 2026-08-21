# Next Toppers — Cloudflare Pages Recovery Bundle

This bundle is arranged for Cloudflare Pages.

## Structure

- `index.html` — Cloudflare Pages entry point; redirects to `course.html`.
- `course.html`, `player.html`, JS and CSS — recovered frontend files at the deployment root.
- `functions/course.js` — Cloudflare Pages Function that provides the `/course` route.

## Required Cloudflare configuration

Add these as environment variables/secrets in the Pages project:

- `COURSE_API_ORIGIN` — the current upstream API origin, without a trailing slash.
- `NEXTTOPPERS_API_TOKEN` — the private bearer token for that upstream API.

Do NOT put the bearer token into frontend JavaScript or commit it to GitHub.

## Deployment

Upload/deploy the contents of this folder as the Cloudflare Pages project root. The `functions/` directory must be included so `/course` is deployed as a Pages Function.

After deployment, test:

- `/` — opens the course page.
- `/course?endpoint=course-details&target=nexttoppers-course` — should reach the Pages Function.
- `/player.html?...` — opens the recovered player.

A `503` from `/course` means the Cloudflare environment variables are missing. A `502` means the upstream API could not be reached. A `4xx/5xx` returned from the upstream is passed through so it can be diagnosed.

## Important limitation

The uploaded recovery archive did not contain the original upstream `/course` backend. This bundle therefore provides a Cloudflare-compatible proxy route, but it cannot recreate an upstream API that no longer exists or whose current origin/credentials are unknown.
