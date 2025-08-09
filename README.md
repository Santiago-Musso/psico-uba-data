## psico-uba-data

Static JSON data for UBA Psicología schedules and related resources. This repo is designed to be the single source of truth for the public JSON that your other app consumes. On every push to `main`, the data in the term folders (e.g., `2025-2/`) is automatically published to GitHub Pages so it can be fetched from any site. This keeps static assets owned by this repository, not the consuming app.

### Repository layout

- `2025-2/`
  - `materias.json`, `sections.json`, `meets.json`, `sedes.json`, `catedras.json`
  - `indexes/` with precomputed index files
- `src/` TypeScript CLI to fetch/generate data

### Prerequisites

- Node.js 20+
- npm 9+

### Install and data generation

```bash
npm ci
# Example: fetch/generate data for term 2025-2
npm run fetch:2025-2
```

The CLI writes JSON into a term directory (e.g., `2025-2/`). Commit and push those changes to publish them.

### Automatic deployment to GitHub Pages

This repo includes a workflow at `.github/workflows/deploy.yml` that:

1) Collects only the data directories in the repository root that look like term folders (e.g., `2025-1`, `2025-2`) into a `_site/` directory.
2) Publishes `_site/` to GitHub Pages using the official Pages action.

#### Enable Pages once

1) In GitHub, go to Settings → Pages
2) Under "Build and deployment", set Source to "GitHub Actions"

After the first successful run, the workflow output will show the public URL (also visible in Settings → Pages). It will look like:

```
https://<OWNER>.github.io/<REPO>/
```

#### What gets published

- Every top-level directory in the repo that starts with a year pattern (e.g., `2025-2/`) is published.
- Any top-level `*.json` files (if present) are also published.

The TypeScript source and other non-data files are not included in the published site.

#### Example consumer URLs

- `https://<OWNER>.github.io/<REPO>/2025-2/sections.json`
- `https://<OWNER>.github.io/<REPO>/2025-2/indexes/byMateria.json`

Replace `<OWNER>` and `<REPO>` with your GitHub org/user and repository name.

### Consuming from another app

- Fetch the JSON from the Pages URL(s) above. The files are static and cacheable by browsers and CDNs. If you need to force a refresh after updates, append a cache-busting query string like `?ts=1700000000`.

### Notes

- The deployment runs on every push to `main` and can also be triggered manually from the Actions tab. You can add a scheduled run if needed.
- If you add a new term (e.g., `2026-1/`), commit it to the repo and push to `main` — it will be published automatically.


