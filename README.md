# Shell

A pocket desk. Describe an app, pin it to the home screen, and edit the source whenever you want.

System apps (Notes, Tasks, Calc, Clock, Files, Settings) and anything Builder makes stay on this device. Builder uses Grok when a key is configured for the deployment, and a local Studio writer when it is not.

## Development

Node 22. The lockfile is committed, so `npm ci` gives CI and local installs the
same tree.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on `0.0.0.0:8080` (the preview contract — host and port are fixed in `vite.config.ts`) |
| `npm run preview` | Serve the built output on `127.0.0.1:8081` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `eslint .` |
| `npm test` | Platform scripts + the Shell unit tests (persistence, sanitiser, bridge, rate limit) |
| `npm run build` | Production build, then `db:migrate` |
| `node scripts/product-qa.mjs` | Drives the real flow against a running dev server: build an app, prove `shell.storage` works through the sandbox, pin it, reload, and reopen it |

CI runs lint, test, typecheck and build on every push and pull request; the
Release workflow re-runs the build before publishing artifacts. The render
smoke (`node scripts/browser-smoke.mjs`) and `scripts/product-qa.mjs` need a
running dev server, so they are run by hand — both drive Chrome through the
installed Playwright (falling back to system Chrome when its own download is
not available).

## Configuration

- **`XAI_API_KEY`** (server only, optional) — present, Builder asks Grok;
  absent, the on-device Studio writer builds the app with no network. Grok
  calls are capped per caller (`src/shell/agent/rate-limit.ts`, 15/min) so a
  deployed instance cannot be made to burn the key, and rejected or throttled
  replies fall back to Studio.
- **`.grok/app-env.json`** — build-flag file merged into dev, build and preview
  by `scripts/with-app-env.mjs`, so those three can never disagree. It ships as
  `VITE_AUTH_ENABLED: false`: Shell has no accounts (see `docs/PRODUCT.md`).
- **No `.env` file is read.** On deploy the platform injects `DATABASE_URL`
  and `scripts/migrate.mjs` applies `migrations/` during the build; without it,
  the build skips the database step entirely.

## Where the data lives

Everything is on the device, under the `shell-os-v1` key in `localStorage`:
writes are debounced and flushed when the tab closes, a refused write is
reported in-app instead of throwing into the store, and anything read back is
re-shape-checked before it can reach the home screen (`src/shell/sanitize.ts`).
Files → Export, or Settings → Save a copy, produces a `shell-copy.json` that
restores the same desk elsewhere.

Mini-apps run in a sandboxed iframe (`allow-scripts`, no same-origin) behind a
`default-src 'none'` CSP, so they cannot reach the page, the network, or each
other: they only see the `shell.storage` bridge, and a frame may only act for
the app id it actually renders (`src/shell/frame-registry.ts`). Two consequences of that sandbox are handled explicitly:

- A sandboxed frame refuses a real form submission *before* dispatching the
  submit event, which would drop every generated app's input. The injected
  bridge swallows the native attempt and hands the form a normal cancelable
  `submit` event instead (`src/shell/runtime.tsx`).
- `window.shell` calls are answered only by the frame that owns the app id,
  and writes are debounced, flushed on tab close and reported in-app when the
  browser refuses them (`src/shell/storage.ts`).

## Release

Tag `v*`, or run the **Release** workflow by hand. It publishes:

- `shell-web.tar.gz` — the production web build
- `Shell-unsigned.ipa` — an iOS app bundle with signing turned off

The IPA is built on a macOS runner (`scripts/build-unsigned-ipa.sh`). A stock iPhone will not install an unsigned IPA. Sideload it with a tool that re-signs, such as AltStore or Sideloadly.

Inside the IPA, apps run in the on-device WebView and Builder uses Studio. Grok runs in the hosted web app, where the key stays on the server.
