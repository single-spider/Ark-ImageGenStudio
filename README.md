# Ark ImageGenStudio

Ark Image Studio v2: a React image-generation and asset-management frontend with a local FastAPI / SQLite backend and Windows desktop launcher.

## Browser preview

[Open Ark Studio preview](https://single-spider.github.io/Ark-ImageGenStudio/)

The GitHub Pages site is a static mock preview. It does not run FastAPI, call a generation provider, access a local archive or require secrets. The existing frontend selects its desktop backend only on loopback HTTP. The Vite relative base supports both the Pages project subdirectory and the desktop server.

### GitHub Actions

- **Validate Ark Studio:** on pushes to main, pull requests, and manual dispatch. Runs the frontend lockfile-based install, TypeScript/Vite production build, and Python syntax checks. The successful frontend build is available as the `ark-frontend-dist` Actions artifact.
- **Deploy Ark Studio preview:** on pushes to main and manual dispatch. Publishes only `frontend/dist` to GitHub Pages, using the `github-pages` environment.

One-time setup: under [Settings → Pages](https://github.com/single-spider/Ark-ImageGenStudio/settings/pages), choose **GitHub Actions** as the source. Then run **Deploy Ark Studio preview** in the Actions tab if necessary.

## Local frontend development

```sh
cd frontend
npm ci
npm run dev
```

The actual Vite project and lockfile are in `frontend/`. Build with `npm run build` from that directory. The separate root `src/` tree is not included in the Vite build.

## Desktop backend

`desktop_v2.py` and `backend/` contain the local desktop implementation. The launcher currently expects the legacy parent project's `image_library.py` and `v2.backend` package layout. A standalone Windows runtime, Python dependency manifest, and real backend tests need to be established before building a desktop installer or executing the server in CI.

The Python CI job compiles source without starting the server, importing runtime dependencies, accessing user files, or running the generation queue. Do not publish API keys, session tokens, local databases or personal images.

## Local live-edit tools

The static HTML entry no longer embeds a localhost live-edit script or its token. If needed, use a local-only development integration; do not include that script in public builds.
