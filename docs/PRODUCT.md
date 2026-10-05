# Shell — product cut

The original brief was a cross-platform OS, an IDE, a Lua runtime, a self-hosted runner, and a paid hosted runner. Most of that cannot be true in one interface. This build keeps the part people would actually touch.

## What it is

A home screen of apps. You talk one into existence, it runs in a sandbox, and it stays on the desk next to Notes and Clock. Phone layout and desktop windows are the same Shell.

## Kept

- Home screen, dock, wallpaper, light and dark, search, app switcher, arrange.
- Builder with Ask, Edit, and Auto. Edit waits for accept or reject. Auto writes and runs. Every overwrite of a saved app takes a snapshot you can undo.
- A real code view. Manual edits update the preview.
- Sandboxed mini-apps. They cannot read the parent page. They store data through a tiny `shell.storage` bridge, one bag per app.
- A local Studio writer that turns a sentence into a working app with no network. Grok is used when the server has a key, and rejected drafts fall back to Studio.
- Import of a public GitHub file, and export of a Shell copy.
- Notes, tasks, calculator, clock, files, settings. All of them work.

## Cut, on purpose

- Lua and a native `shell.*` device bridge. A web sandbox can keep the promise; a fake Lua console cannot.
- SSH runners, Docker, and hosted plans. Pairing screens that do not pair are worse than their absence.
- Multiple model vendors in the settings form. One connected writer plus an offline writer is the honest version.
- Accounts. The desk is on this device. A copy is a JSON file.

## Release shape

The web app is the product. GitHub Actions also builds an unsigned IPA so the same client can be sideloaded later. Signing is intentionally off in that job.
