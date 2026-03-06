# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Modular personal tool suite (个人助手) hosted on GitHub Pages. Chinese UI. Modules: travel footprint tracker, body management.

## Commands

```bash
npm run dev      # Local dev server (Vite)
npm run build    # tsc -b (type check) + vite build (production)
npm run preview  # Preview built artifacts
```

No test framework is configured. Type checking via `tsc -b` is the primary validation step.

## Architecture

### Module Pattern

Each module lives in `src/modules/<name>/` with:
- `index.tsx` — Page component (default export, lazy-loaded via `React.lazy()`)
- `components/` — Module-private components
- `utils.ts` — Module helpers
- Optional: `store.ts` (Zustand), `geocode.ts`, `mapConfig.ts`

Routes defined in `src/router.tsx`. Sidebar menu auto-generates from route config (`label` + `icon` fields).

### Data Flow

**Source of truth**: Dexie.js (IndexedDB), not React state. Use `useLiveQuery()` for reactive reads.

**Database**: Per-user DB named `PA_{username}`. Schema in `src/shared/db/index.ts`. Tables: `kv` (settings), `weightRecords`, `bodyMeasurements`, `trips`, `tripSpots`.

**After any DB mutation**, call the callback from `useDataChanged()` hook to trigger cloud sync.

### Cloud Sync (GitHub Gist)

`src/shared/sync/` — All data encrypted client-side (AES-GCM + PBKDF2) before pushing to GitHub Gist.

- `gist.ts` — Gist API wrapper with ETag conditional requests (304 optimization)
- `sync.ts` — `pullData()` / `pushData()` with v2 sync protocol
- Two gist files per user: `pa-data-{username}.json` (table data) + `pa-blob-{username}.json` (photos/covers)
- Auto-sync: 3-second debounce after data changes
- `VITE_SERVICE_TOKEN` env var provides the GitHub API token (set in GitHub Actions secrets)

### Auth

`src/shared/auth/` — Username/password auth with client-side PBKDF2 key derivation. Password never leaves the browser. Registry stored in a shared Gist. Admin user: `reed-pipe`.

### Maps (Travel Module)

- React-Leaflet with OSM or Amap (高德) tile providers
- Coordinate system: WGS84 stored in DB, converted to GCJ-02 for Amap display
- `mapConfig.ts` — Provider detection/preference, WGS84↔GCJ-02 conversion
- `geocode.ts` — Address search + reverse geocoding, routes to Amap API (with key) or Nominatim based on provider
- Photos stored as base64 data URLs (compressed to 800px width, 0.7 JPEG quality)

### PWA

`vite-plugin-pwa` with `registerType: 'autoUpdate'`, standalone display. Service worker caches static assets + map tiles. MIUI PWA file input requires native `<input type="file">` overlays (no programmatic `.click()`).

## Key Conventions

- Path alias: `@/` → `src/`
- Styling: Ant Design v6 theme tokens + inline styles (no CSS modules)
- Chinese locale: Ant Design `zh_CN`
- All coordinates in DB are WGS84; display conversion happens at render time
- GitHub Pages SPA routing: `404.html` redirect hack in `public/`
- Deployment: push to `main` → GitHub Actions builds and deploys
