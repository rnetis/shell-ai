# Shell

A pocket desk. Describe an app, pin it to the home screen, and edit the source whenever you want.

System apps (Notes, Tasks, Calc, Clock, Files, Settings) and anything Builder makes stay on this device. Builder uses Grok when a key is configured for the deployment, and a local Studio writer when it is not.

## Release

Tag `v*`, or run the **Release** workflow by hand. It publishes:

- `shell-web.tar.gz` — the production web build
- `Shell-unsigned.ipa` — an iOS app bundle with signing turned off

The IPA is built on a macOS runner (`scripts/build-unsigned-ipa.sh`). A stock iPhone will not install an unsigned IPA. Sideload it with a tool that re-signs, such as AltStore or Sideloadly.

Inside the IPA, apps run in the on-device WebView and Builder uses Studio. Grok runs in the hosted web app, where the key stays on the server.
