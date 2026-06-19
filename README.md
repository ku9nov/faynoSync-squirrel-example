# faynoSync-squirrel-example

A desktop application built with Electron that demonstrates auto-update against the
faynoSync update system using the **native Squirrel protocol** — Electron's built-in
`autoUpdater` module (`require('electron').autoUpdater`), backed by Squirrel.Mac on
macOS and Squirrel.Windows on Windows.

## How this differs from the electron-updater example

This repo is the Squirrel counterpart of
[`faynoSync-electron-example`](https://github.com/ku9nov/faynoSync-electron-example).
The UI, config loading, telemetry reports, and macOS signing/notarize setup are the
same. Only the update mechanism is different:

| | electron-updater example | this example (native Squirrel) |
| --- | --- | --- |
| Update driver | `electron-updater` package | built-in `electron.autoUpdater` |
| macOS feed | generic provider over a `latest-mac.yml` directory | Squirrel.Mac JSON feed (`{ "url": "<zip>" }`) |
| Windows feed | NSIS `latest.yml` | Squirrel.Windows `RELEASES` + `.nupkg` |
| macOS build | `dmg` + `zip` | `dmg` + `zip` |
| Windows build | NSIS installer + `zip` | Squirrel `Setup.exe` + `RELEASES` + `.nupkg` |
| Download progress | yes (`download-progress`) | no — Squirrel downloads silently, then emits `update-downloaded` |
| Code signing | optional for updates | **required on macOS** (Squirrel.Mac refuses unsigned updates) |

The `@faynosync/sdk-js` client is still used to check whether an update exists and to
read changelog/critical metadata for the in-app modal; the native `autoUpdater` then
performs the actual download and install.

## faynoSync endpoints used

The feed URLs are built from the documented faynoSync routes:

- **macOS** (`updater=squirrel_darwin`): `GET {BASE_URL}/checkVersion?...&updater=squirrel_darwin`
  returns the Squirrel.Mac JSON feed `{ "url": "<zip>" }` (HTTP 200) or `204 No Content`
  when up to date.
- **Windows** (`updater=squirrel_windows`): the feed base is
  `{BASE_URL}/update/{owner}/{app}/{channel}/{platform}/{arch}/{version}`; Squirrel.Windows
  appends `/RELEASES`, matching faynoSync's
  `GET /update/:owner/:app/:channel/:platform/:arch/:version/RELEASES` route, which
  302-redirects to the `RELEASES` file.

## Prerequisites

- Node.js >= 18.13.0
- npm >= 8.19.3
- A running faynoSync server (default `http://localhost:9000`)

## Installation

```bash
git clone https://github.com/ku9nov/faynoSync-squirrel-example.git
cd faynoSync-squirrel-example
npm install
```

## Configuration

Copy the example environment file and adjust it:

```bash
cp .env.example .env
```

| Variable | Description |
| --- | --- |
| `APP_NAME` | App name registered in faynoSync |
| `VERSION` | Current version of this build |
| `CHANNEL` | Release channel (e.g. `nightly`, `stable`) |
| `OWNER` | faynoSync owner |
| `BASE_URL` | faynoSync API base URL |
| `EDGE_URL` | Optional CDN/edge URL |
| `REPORT_KEY` | Optional telemetry report key |
| `AUTO_DOWNLOAD` | `true` to download updates without prompting |
| `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` | macOS notarization |

These values are also baked into the build via `extraMetadata.faynosync` in
`electron-builder.config.js`. When both `.env` and `package.json` provide a value, the
baked `package.json` value takes precedence.

## Development

```bash
npm start
```

The window shows "Hello, world!" and checks for updates on load (or via the
**Check for Updates** button). The native `autoUpdater` only runs in a packaged,
signed build — in dev mode the app surfaces the update banner and falls back to opening
the download URL manually.

## Building

### macOS

```bash
npm run dist:mac
npm run verify:mac-sign
```

Produces a signed/notarized `.dmg` (distribution) and `.zip` (the Squirrel.Mac update
package). **Squirrel.Mac requires the app to be code-signed**, so set the `APPLE_*`
credentials before building; an unsigned build will fail to apply updates.

### Windows

```bash
npm run dist:win
```

Produces a Squirrel `Setup.exe`, a `RELEASES` file, and a `.nupkg`. Upload the
`RELEASES` file and the `.nupkg` to faynoSync with `updater=squirrel_windows`.

> **Windows end-to-end verification is performed on a Windows machine.** Squirrel.Windows
> resolves the `.nupkg` URL relative to the feed base URL; confirm on Windows that the
> `RELEASES` entries point at URLs faynoSync can serve for your deployment before relying
> on auto-update in production.

### Linux

```bash
npm run dist:linux
```

Produces `.AppImage` and `.deb`. The native Squirrel protocol does not cover Linux, so
the app falls back to a manual download there.

## Build outputs

- macOS: `.dmg`, `.zip`
- Windows: `Setup.exe`, `RELEASES`, `.nupkg`
- Linux: `.AppImage`, `.deb`
