# @7dgroup/dsh-skill-7d-viewer

Bookmark key assistant messages and jump back to them — a focused, pure-browser
DSH plugin. Per-session, i18n (zh/en), zero native dependencies.

[中文](./README.zh.md)

## Features

- **Bookmark a reply** — a ribbon toggle inside every finalized assistant
  message pins it to the session's bookmark list.
- **Jump back** — clicking a bookmark scrolls the conversation to that message.
- **Notes** — attach a short note to any bookmark.
- **Per-session isolation** — bookmarks are stored per conversation and survive
  a page refresh (`localStorage`, best-effort).
- **i18n** — interface copy follows the DSH language (zh / en) live.
- **Zero native deps** — no node-pty, no file/terminal/git surface; the host
  half is a no-op, so install is frictionless.

## Install

```sh
dsh plugin --profile web add @7dgroup/dsh-skill-7d-viewer@latest
```

Then hard-refresh the browser (Cmd/Ctrl+Shift+R).

## Usage

1. Hover an assistant reply and click the bookmark ribbon to pin it.
2. Click the bookmark list button in the session header (the list icon with a
   count) to open the panel.
3. In the panel, jump to a message, copy its excerpt, edit its note, or delete it.

## Architecture

A standard two-half DSH plugin:

- **Host half** (`src/index.ts`) — an intentional no-op; it exists only so the
  plugin mounts in the profile cordis tree and its client half is discovered.
- **Client half** (`src/client/index.ts`) — registers the zh/en dictionaries
  and contributes two slots:
  - `conversation.chat.assistant-actions` — the per-message toggle,
  - `conversation.session.header.actions` — the header list/panel.
- **Store** (`src/client/store.ts`) — a per-session observable controller
  (`getSnapshot`/`subscribe`) persisted to `localStorage`; the slot framework
  binds it into a `useBookmarks` selector hook.

Two install channels ship from one build:

| channel | manifest | client bundle id |
|---|---|---|
| official (`dsh plugin add`) | `cordis.patch.yml` | `@7dgroup/dsh-skill-7d-viewer` |
| plugin registry | `dsh.plugin.json` | `7dgroup/dsh-skill-7d-viewer` |

## Develop

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

`build` emits `lib/index.js` (host), `lib/client.js` and `lib/client-registry.js`
(client bundles), and `lib/types/` (declarations).

## Security & limitations

- **No host surface** — the plugin never touches the filesystem, network, or a
  shell; every capability stays in the browser UI layer.
- **`localStorage` persistence** — bookmarks live in the browser and do not
  sync across devices. Storage is best-effort and degrades to in-memory state
  when blocked (e.g. private mode).
- **Jump-back scope** — a bookmark can only scroll to a message still inside the
  current conversation window; messages paged out of the window have no anchor.

## License

MIT
