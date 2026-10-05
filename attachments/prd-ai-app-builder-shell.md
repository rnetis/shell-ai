# PRD: "Shell" — An AI-Native App Builder Disguised as a Pocket OS

**Status:** Draft v0.1

## 1. Vision

A cross-platform app (iOS, Android, Windows, macOS, Linux) that presents a familiar OS-like home screen. Inside it, you describe an app to an AI agent, it builds the app, and the app lives on your home screen next to the others. It is not an OS; it is a launcher + IDE + runtime + agent in one.

**One-liner:** *Talk to build apps. Tap to run them. Edit anything.*

## 2. Problem

- Building apps requires a dev environment, tooling and knowledge.
- Existing AI builders are cloud-locked, single-model and not runnable on-device.
- Phones can't easily host a personal ecosystem of small custom tools.

## 3. Target users

1. **Makers/developers** who want to prototype on the go.
2. **Power users** who want personal micro-tools (trackers, dashboards, bots).
3. **Teams/IT staff** who want internal mini-apps without a full dev cycle.

## 4. Core concepts

- **Shell:** the OS-like UI (home screen, app grid, dock, switcher, settings, notifications).
- **Mini-app:** a self-contained project (HTML/JS/CSS + optional Node backend) with a manifest.
- **Agent:** a chat-driven AI that reads/writes project files, runs them and fixes errors.
- **Provider:** any configured AI backend.

## 5. Goals / Non-goals

**Goals:** natural-language app creation, full manual editing, GitHub import, LAN/tunnel web editor, bring-your-own-model. **Non-goals (v1):** real OS/kernel features, App Store distribution of generated apps, native-code (Swift/Kotlin) generation, multi-user cloud hosting.

## 6. Key features

### 6.1 OS-style Shell (P0)

Home screen with icons, folders, wallpapers, app switcher, status bar, light/dark themes. Responsive layout: phone, tablet, desktop window.

### 6.2 Builder app + Agent (P0)

- Split view: chat | code editor | live preview.
- Agent can create/edit/delete files, install npm packages, run the app, read logs and self-correct.
- Diff view with accept/reject; automatic snapshot before every agent change; one-tap undo.
- Modes: *Ask* (suggest only), *Edit* (apply with approval), *Auto* (apply and run).

### 6.3 Code editor (P0)

Monaco/CodeMirror, syntax highlighting, file tree, search, multi-tab, console, mobile-friendly keyboard toolbar.

### 6.4 Mini-app runtime (P0)

- Three mini-app types: **Web** (WebView), **Lua** (native scripting), **Node** (Local/Remote runtime).
- Front-end apps run in a sandboxed WebView/iframe.
- **Remote runtime (decided: supported on all platforms).** Node.js backends can run on a paired remote host: your own PC, home server/VPS, or a Docker container. The Shell connects over LAN, VPN (e.g. Tailscale) or a tunnel, and mini-apps and the agent's run/install/log tools execute there while the UI stays on the device.
  - Pairing via QR + PIN, TLS, short-lived tokens, per-app resource limits.
  - Each project picks a runtime target: *Local* (front-end-only apps in WebView; bundled Node on desktop where available) or *Remote* (any Node backend).
  - A lightweight "Shell Runner" daemon (Node/Docker image) provides the same file, process and log APIs the local core uses, so the agent works identically against either target.
  - This removes the iOS Node.js blocker and gives one consistent behavior on every platform.
- Per-app permissions (network, storage, camera, location, clipboard) shown at install.

### 6.4b Runner types (P0)

Two ways to get a remote runtime, both speaking the same Runner API:

**A. Self-hosted Runner (free, for everyone)**

- Connect to any machine you own over **SSH** (host, port, key or password, optional jump host).
- Two modes: *Direct* (run Node processes on the host in a project folder) or *Docker-over-SSH* (the Shell starts an isolated container per project on the host; recommended default).
- One-command setup: install script or `docker run` image that provisions the Runner daemon, Node versions, and a reverse proxy for app URLs.
- Health check, resource limits, logs streaming, auto-restart, port forwarding to preview apps in the Shell.
- Host-key pinning, key storage in the OS keychain, no passwords stored in project files.

**B. Hosted Runner (paid, sold by you)**

- Users buy a runner plan inside the app: Starter / Pro / Team (CPU, RAM, storage, uptime, number of apps, custom domain).
- Provisioned automatically on your infrastructure (container or microVM per user, isolated network, per-app subdomain with HTTPS).
- Account system, billing, usage metering, plan upgrade/cancel, suspend on non-payment, data export before deletion.
- Optional add-ons: always-on apps, extra storage, backups, bundled AI credits (resold via your gateway).
- Abuse controls: rate/egress limits, outbound-spam protection, content and ToS enforcement, quotas.

**Shared behavior:** the user can switch a project between Local, Self-hosted and Hosted targets; the agent works identically on all three.

### 6.4c Native scripting layer: Lua (P0)

A third app type next to web apps and Node apps: **Lua mini-apps** that run on-device with native-feeling UI and device access, identical on iOS, Android, Windows, macOS and Linux.

- **Engine:** embedded Lua inside the Shell. Recommended: **Luau** (sandboxed by design, fast interpreter, optional types) or standard Lua 5.4. LuaJIT is avoided because JIT is blocked on iOS.
- **Why Lua:** tiny, embeddable, interpreter-only (store-friendly), easy for the AI to write correctly, and no Node or remote runtime needed, so it works offline.
- **Native bridge (the "little native things"):** a stable `shell.*` API exposed to scripts:
  - `ui`: native-style views, lists, buttons, inputs, navigation, dialogs, themes
  - `storage` / `db`: key-value and SQLite per app
  - `http` / `ws`: network requests with permission prompts
  - `fs`: sandboxed files, import/export, share sheet
  - `device`: clipboard, haptics, notifications, camera, microphone, location, sensors, battery, Bluetooth (later)
  - `timer` / `background`: timers, scheduled tasks (platform-limited)
  - `ai`: call the user's configured AI provider from inside an app
  - `app`: open other mini-apps, intents/deep links
- **Permissions:** every `shell.*` module is permission-gated per app, shown at install and revocable in settings.
- **Agent support:** the agent knows the `shell.*` API (bundled docs and typed stubs), writes Lua, runs it instantly in the live preview with hot reload, and reads Lua errors to self-correct.
- **Editor support:** Lua syntax highlighting, autocomplete for `shell.*`, inline docs, on-device console.
- **Interop:** Lua apps can call a Node backend (local or Runner) over HTTP/WebSocket, and web mini-apps can message Lua apps.
- **Limits:** CPU/time/memory quotas, instruction-count watchdog, no raw FFI or native code loading, no dynamic code download beyond user-authored scripts.
- **Store-policy note:** Apple permits interpreted code that doesn't change the app's primary purpose; keep scripts user-created, sandboxed, and within the declared API to stay compliant.

### 6.5 Provider-agnostic AI (P0)

- Add providers: OpenAI-compatible (custom base URL + key), Anthropic, Gemini, local (Ollama/LM Studio), via HTTP/SOCKS proxy.
- Per-project model selection, model fallback, streaming, token/cost counter.
- Keys stored in the OS keychain/secure enclave, never in project files.

### 6.6 GitHub import/export (P1)

Import by URL, detect stack, run or let the agent adapt it; commit/push from within the app; each repo becomes a mini-app.

### 6.7 Remote web editor (P1)

- Built-in server exposes the editor on LAN (QR code + PIN pairing).
- Optional tunnel (Cloudflare Tunnel / ngrok / Tailscale) for outside access.
- HTTPS where possible, short-lived tokens, read-only mode, one-tap kill switch.
- Real-time sync between device and browser sessions.

### 6.8 Storage & backup (P1)

Local project storage, export/import as zip, optional sync to GitHub/WebDAV/cloud drive.

### 6.9 App store-lite (P2)

Share mini-apps via link/QR/Git; community template gallery.

## 6b. Business model

- **Free:** the Shell, Builder, local runtime, self-hosted Runner, bring-your-own AI keys.
- **Paid:** hosted Runner plans (monthly), optional bundled AI credits, backups, custom domains, team seats.
- **Payments:** Stripe/regional gateway on web; on iOS and Android, digital purchases made inside the app generally must use Apple/Google in-app purchase (with their commission), or be sold via web checkout where store rules allow. Decide per market before launch.
- **Unit economics to validate:** infra cost per hosted runner vs. plan price; target gross margin of 60%+.

## 7. User flows

1. **Create:** open Builder → "What do you want to build?" → agent plans → generates → preview → "Save to home screen".
2. **Iterate:** open app → Edit → chat "make the header blue and add dark mode" → diff → accept.
3. **Import:** paste GitHub URL → agent analyzes → installs as app.
4. **Edit from laptop:** Settings → Remote Editor → scan QR → browser opens the same project.

## 8. Technical architecture (proposed)

- **Client:** React Native/Expo or Flutter for the Shell on mobile; Electron or Tauri for desktop. Alternative: one web-tech codebase (Capacitor + Electron) for maximum reuse.
- **Core service (Node.js):** project manager, agent orchestrator, file system API, process runner, provider gateway, remote-editor server.
- **Agent loop:** tool-calling (read_file, write_file, run, search, install, get_logs) with step limits and cost caps.
- **Sandboxing:** isolated WebView per app, permission broker, no access to other apps' data by default.

## 9. Platform risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Apple App Store rule on apps that download/execute new code | High | Keep logic as interpreted JS inside WebView/JSC, user-created content, no native code download; consider TestFlight/PWA/sideload as fallbacks |
| Running Node.js on mobile | Medium | Remote runtime is the standard path on all platforms; local WebView for front-end-only apps |
| Lua bridge API too large or unstable | Medium | Version the `shell.*` API, start with a small core set, add modules by demand |
| Hosted Runner abuse (spam, mining, attacks from your IPs) | High | Isolation, egress limits, quotas, ToS enforcement, KYC-lite for higher plans |
| In-app purchase store rules for hosted plans | Medium | Use IAP or web checkout per platform policy; keep self-hosted free path |
| Remote runtime security and availability | High | Pairing + TLS + tokens, resource limits, sandboxed containers, offline mode for front-end apps |
| Security of agent-run code | High | Sandbox, permissions, approval mode, command allowlist |
| Remote editor exposure | High | PIN pairing, TLS, tokens, auto-expire, off by default |
| API key leakage / prompt injection from imported repos | Medium | Keychain, treat repo content as untrusted, confirm risky actions |
| Model cost surprises | Medium | Budgets, usage meter, local model option |

## 10. Success metrics

- Time to first working app \< 3 minutes.
- ≥ 60% of created apps run without manual fixes.
- Week-4 retention ≥ 30%.
- Average mini-apps per active user ≥ 3.

## 11. Roadmap

- **MVP (8–10 weeks):** Shell, Builder (chat + editor + preview), front-end runtime, Lua scripting with core `shell.*` modules (ui, storage, http, ai), self-hosted Runner (SSH + Docker-over-SSH), multi-provider AI, local storage, desktop + Android.
- **v1:** Hosted Runner (billing, provisioning, metering), tunnels, GitHub import, remote LAN editor, iOS, snapshots/undo.
- **v1.5:** Tunnels, permissions UI, templates, backup/sync.
- **v2:** App sharing, plugin system for agent tools, team workspaces.

## 12. Open questions

1. Is iOS a day-one target, or Android/desktop first given the policy and runtime constraints?
2. Hosted Runner isolation tech: Docker with gVisor, Firecracker microVMs, or Kubernetes namespaces? Which regions and payment methods at launch?
3. Open-source core with paid sync/templates, or fully free BYO-key?
4. Should mini-apps be PWAs exportable outside the shell?
5. Luau or Lua 5.4 as the engine, and should the native UI be custom-rendered or map to real platform widgets?

## 13. Suggested improvements over the original idea

- Snapshots and diff approval so the agent can never wreck a project.
- Permission system and sandboxing — essential once you run third-party GitHub code.
- Remote runtime on every platform, with one Runner daemon and one agent toolset.
- Templates and a shared agent-tool plugin API to grow an ecosystem.