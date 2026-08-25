# @7dgroup/dsh-skill-7d-viewer

A **right sidebar viewer** for DSH: it lists the files each turn produced, and
lets you preview or edit them in place — instead of opening files in the OS app.

[中文](./README.zh.md)

## Features

- **Per-turn file list** — the sidebar lists every file produced across the
  conversation, grouped by turn.
- **Intercept file-open clicks** — chat file mentions open in the sidebar, not
  the OS app.
- **Markdown source/preview** — `.md` files toggle between editable source and a
  rendered preview.
- **Code edit + save** — text/code files open in an editable area with a Save
  button (atomic write on the host).
- **Image preview** — PNG / JPG / GIF / WebP / SVG / BMP / ICO / AVIF inline.
- **Binary detection** — non-image binary files show a "cannot preview" note.
- **i18n** — copy follows the DSH language (zh / en).

## Install

```sh
dsh plugin --profile web add @7dgroup/dsh-skill-7d-viewer@latest
```

Then hard-refresh the browser (Cmd/Ctrl+Shift+R).

## Usage

- A **toggle strip** sits on the right edge; click it to expand/collapse the
  sidebar.
- The sidebar shows **produced files grouped by turn**; click one to open it.
- **Markdown**: use the Source / Preview buttons to switch.
- **Code/text**: edit directly, then **Save**.
- Clicking a file name inside a conversation reply also opens it in the sidebar.

## Architecture

- **Host half** (`src/index.ts`) — fenced routes: `/viewer/read` (text JSON +
  binary detection), `/viewer/media` (image bytes), `/viewer/write` (save
  edits). Every route passes the /api trust fence and confines paths to the
  session cwd.
- **Client half** (`src/client/index.ts`) — wraps `ctx.workspaces.openPath`,
  subscribes to the session's conversation snapshot to derive produced files,
  and mounts a right sidebar.

| channel | manifest | client bundle id |
|---|---|---|
| official (`dsh plugin add`) | `cordis.patch.yml` | `@7dgroup/dsh-skill-7d-viewer` |
| plugin registry | `dsh.plugin.json` | `7dgroup/dsh-skill-7d-viewer` |

## Develop

```sh
pnpm install
pnpm typecheck
pnpm test          # vitest unit tests
pnpm test:smoke    # mount smoke against a running DSH (http://127.0.0.1:3080)
pnpm test:e2e      # isolated scratch dsh web + Playwright
pnpm build
```

## Security & limitations

- Reads/writes are confined to the session cwd and size-capped (`readLimit`
  512 KB, `mediaLimit` 20 MB, `writeLimit` 5 MB by default).
- Writes are atomic (temp file + rename).
- PDFs are served as binary, not rendered inline.

## License

MIT
