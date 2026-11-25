# Visual review

The Ark visual review workflow builds and renders the static mock frontend in a fresh Chromium browser. It never starts the local backend, reads a user's library, or calls a generation provider.

On each frontend pull-request change, open Actions > Ark visual review, select the run and download the `ark-visual-review` artifact. It contains PNG captures for three desktop sizes, gallery open/closed, comparison, mask, iterations, generation settings and reference picker, plus a JSON layout/error report. If the public demo CDN is unavailable, the runner supplies synthetic landscape fixtures and records this in the report.

For local use, from `frontend/`:

```sh
npm ci
npm run build
npm install --no-save --package-lock=false playwright@1.56.1
npx playwright install chromium
node scripts/visual-review.mjs
```

The generated `visual-review/` directory is disposable. Do not publish screenshots of local private libraries. Review the images and geometry before making another targeted refinement commit; a successful capture is not proof of good design.
