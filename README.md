<div align="center">

# Sivano

**Document versioning & submission for non‑technical analysts.**
A cross‑platform (macOS / Windows / Linux) Electron desktop app that turns
messy "documents flying around on Slack/email" into a clean, auditable Git
history — without asking analysts to learn Git.

</div>

---

## Table of Contents

1. [What is Sivano?](#1-what-is-sivano)
2. [Key Features](#2-key-features)
3. [Concepts](#3-concepts)
4. [Installation (End Users)](#4-installation-end-users)
5. [First‑Run & Connecting Accounts](#5-first-run--connecting-accounts)
6. [User Guide](#6-user-guide)
   - [Home (Landing)](#61-home-landing)
   - [Files](#62-files)
   - [Submit](#63-submit)
   - [History](#64-history)
   - [Profile / Connections](#65-profile--connections)
   - [Settings](#66-settings)
7. [How Versioning Works](#7-how-versioning-works)
8. [Jira Integration](#8-jira-integration)
9. [Where Your Data Lives](#9-where-your-data-lives)
10. [Developer Guide](#10-developer-guide)
    - [Tech Stack](#101-tech-stack)
    - [Project Structure](#102-project-structure)
    - [Prerequisites & Dev Setup](#103-prerequisites--dev-setup)
    - [NPM Scripts](#104-npm-scripts)
    - [Architecture (Main ↔ Preload ↔ Renderer)](#105-architecture-main--preload--renderer)
    - [The Converter Registry](#106-the-converter-registry)
    - [Bundled Binaries (Portable Builds)](#107-bundled-binaries-portable-builds)
    - [Packaging / Distribution](#108-packaging--distribution)
    - [Security Notes](#109-security-notes)
    - [Extending Sivano](#1010-extending-sivano)
11. [Troubleshooting](#11-troubleshooting)
12. [License](#12-license)

---

## 1. What is Sivano?

In many organizations, critical documents — analyses, contracts, statements of
work — change constantly, and **nobody knows what changed or when**. People
paste new versions into chat and hope for the best.

Sivano gives those documents a **real version history in Git**, but wraps it in
an interface an analyst can use without knowing what a commit is. Analysts edit
their documents in Word/LibreOffice as usual; Sivano detects the changes, shows
a **word‑level side‑by‑side diff** (even for `.docx`, `.pdf`, `.xlsx`), lets them
approve, and pushes a properly tagged, per‑document version to GitLab/GitHub —
optionally opening a matching **Jira "Analiz" issue** with the diff embedded.

---

## 2. Key Features

- 🗂️ **Built‑in file manager** — browse the project, open files in Word, create/
  rename/delete (to trash), cut/copy/paste, drag‑and‑drop from the OS, and
  **"Open with…"** any installed application (with a per‑type default).
- 🔍 **Readable diffs for binary documents** — `.docx/.odt/.pptx` via **pandoc**,
  `.pdf` via **pdftotext**, `.xlsx/.xls/.ods` via **SheetJS** (multi‑sheet aware),
  plain text directly. Word‑level highlighting, side‑by‑side.
- 🚀 **Approve & Send** — a step‑by‑step wizard: one **separate commit per file**,
  an auto‑generated detailed message plus an optional analyst note, an automatic
  **release tag**, then push.
- 🔢 **Independent per‑document versioning** — each document has its own version
  line (`v1 → v2 → v3`), derived from its own commit history.
- 🌳 **History, two ways** — a flat GitLab‑style table, and a draggable,
  zoomable **graph** with one swim‑lane per document (deleted docs shown dimmed).
- 🔔 **Native OS notifications** — a periodic check warns when the remote has new
  changes ("remember to pull"), and confirms each push.
- 🔗 **In‑app clone** — pick a GitLab repository and clone it into a managed
  workspace; no terminal required.
- 🧩 **Jira integration** — every submission can open an "Analiz" issue, assigned
  to you, moved to the active sprint, transitioned to Done, with a 2‑column
  word‑level diff rendered in Jira wiki markup.
- 🎨 **3 themes, 2 languages, fully responsive** — Night / Day / Paper, TR / EN.
- 📦 **Portable** — pandoc/git/pdftotext are bundled; end users install nothing.

---

## 3. Concepts

| Term | Meaning |
|------|---------|
| **Project** | The Git repository you "open as project" in Files. Submit & Files operate on it. |
| **Derivative (`.derived/`)** | Auto‑generated text version of a binary document, committed alongside the original so **GitLab also shows a readable diff**. Hidden in the app; never hand‑edited. |
| **Per‑file commit** | Each changed document is committed separately, giving each its own clean history. |
| **Release tag** | `vYYYY.MM.DD-N` created per submission — a snapshot marker of the whole batch. |
| **Analiz issue** | The Jira issue type Sivano creates on push (configurable). |

---

## 4. Installation (End Users)

Download the build for your OS from the Releases page and run it — **no
dependencies to install**:

| OS | Artifact |
|----|----------|
| Windows | `Sivano-<version>-x64.exe` (installer) or the `portable` build |
| macOS | `Sivano-<version>-<arch>.dmg` |
| Linux | `Sivano-<version>.AppImage` (make it executable, then run) |

> Linux: `chmod +x Sivano-*.AppImage && ./Sivano-*.AppImage`

---

## 5. First‑Run & Connecting Accounts

1. Launch Sivano → the splash screen leads to the **Home** menu.
2. Go to **Profile** and connect the services you use (see
   [Profile / Connections](#65-profile--connections)). Credentials are stored
   **encrypted in your OS keychain**, never in plain text.
3. Go to **Files → Clone from GitLab** (or open an existing local repo), then
   **Open as project**.
4. You're ready: edit documents, review, and **Submit**.

---

## 6. User Guide

### 6.1 Home (Landing)

The entry screen. The big cards open **Files, Submit, History, Settings,
Profile**. On the right of "What would you like to do?" you'll see the **active
project** name, or a yellow **Choose project** button if none is pinned.

### 6.2 Files

A full file manager scoped to your project.

- **Navigate** with the breadcrumb / up button.
- **Toolbar:** New file, New folder, Paste, **Open as project** (pins the current
  repo as the active project), **Clone from GitLab**, **Open folder**.
- **Right‑click** (or the `⋮` on a row):
  - On a file: **Open**, **Open with…** (choose from installed apps, optionally
    set as default for that file type), Rename, Copy, Cut, Delete.
  - On empty space: New file, New folder, Paste.
- **Drag & drop** files from your OS file manager to copy them in.
- **Delete** moves items to the **trash** (recoverable), never a hard delete.
- Hidden/lock/temp files (dotfiles, `~$…`, `…#`) and the `.derived/` folder are
  hidden automatically.

### 6.3 Submit

Where changes become versions.

- The left panel lists **changed files** with status badges (modified / new /
  deleted), refreshed live. The repo name is shown at the top.
- Click a file to see the **diff** on the right — word‑level, side‑by‑side.
  Binary documents are converted to text first (see
  [Converter Registry](#106-the-converter-registry)).
- **Update** pulls remote changes (fast‑forward). **Refresh** re‑reads status.
- **Approve & Send** opens a wizard — **one step per file** — where you can add
  an optional note; then Sivano commits each file separately, creates a release
  tag, pushes, and (if configured) creates Jira issues.

### 6.4 History

- **Table:** chronological commits with author, date, tags, and touched files.
- **Graph:** a draggable / zoomable canvas (mouse drag to pan, wheel to zoom).
  Each document is a **swim‑lane** with its `v1 → v2 → …` chain; release tags are
  marked; **deleted** documents appear dimmed with a strikethrough label (their
  history is preserved).

### 6.5 Profile / Connections

Connect **GitLab**, **GitHub**, and **Jira**. Each provider shows **Details** and
**Edit** once connected (edit without disconnecting; leave the token blank to
keep the current one). Every field has an inline hint telling you where to find
its value.

- **GitLab / GitHub:** a Personal Access Token (self‑hosted GitLab also takes a
  server URL). The token is validated against the provider's API.
- **Jira:** server URL, PAT, **Project key**, **Issue type** (default `Analiz`),
  and the **Done step** name. See [Jira Integration](#8-jira-integration).

### 6.6 Settings

- **Appearance:** theme (Night / Day / Paper) and language (Türkçe / English),
  applied instantly and remembered.
- **About:** version, author, license, repository link, and runtime versions
  (Electron / Node / Chromium), all read live from the app.

---

## 7. How Versioning Works

Git tags are repository‑wide snapshots, so Sivano does **not** rely on them for
per‑document versions. Instead, **each document's version is the number of
commits that touched it** (`git rev-list --count HEAD -- <path>`), which makes
versions **independent**: changing document A never bumps document B.

On **Submit**, Sivano:

1. Computes the old (HEAD) vs new diff for each changed file.
2. Regenerates the file's `.derived/<path>.md` text version.
3. Commits **the original + its derivative together, per file**, with a detailed
   message (`file — modified (v13)` + metadata + your note).
4. Creates a batch **release tag** `vYYYY.MM.DD-N`.
5. Pushes `HEAD` and the tag (token injected for HTTPS remotes, SSH key for SSH
   remotes; the token is never persisted to `.git/config`).

Deleting a document removes its derivative in the same commit; its past versions
remain in history (recoverable).

---

## 8. Jira Integration

Targets **Jira Server / Data Center** (REST API v2 + wiki markup). Configure it
under **Profile → Jira**. After every successful push, for **each committed
file** Sivano:

1. Creates an issue of your configured type (**Analiz**) — the connecting user is
   the **reporter**;
2. **Assigns it to you**;
3. Adds it to the project's **active sprint** (if a Scrum board with an active
   sprint exists; otherwise it stays in the backlog);
4. Transitions it to your configured **Done** step.

The description contains the file, version, type, your note, a **permalink to the
file at that commit**, and a **4‑column word‑level diff table** (`# | Old | # |
New`) rendered in Jira wiki markup. Jira issue creation is **best‑effort** — if
Jira is unreachable, the document submission still succeeds.

---

## 9. Where Your Data Lives

Per‑user application data (Electron `userData`):

| OS | Path |
|----|------|
| Linux | `~/.config/Sivano/` |
| macOS | `~/Library/Application Support/Sivano/` |
| Windows | `%APPDATA%/Sivano/` |

- `connections.json` — non‑secret connection metadata (provider, base URL,
  account, Jira project/type/done). **Tokens are stored encrypted via the OS
  keychain (`safeStorage`), not here.**
- `openwith.json` — your per‑extension "open with" default apps.
- `workspaces/` — repositories cloned in‑app.

UI preferences (theme, language, active project) are kept in the renderer's
`localStorage`.

---

## 10. Developer Guide

### 10.1 Tech Stack

- **Electron** + **electron‑vite** (build/HMR) + **electron‑builder** (packaging)
- **TypeScript** everywhere
- **React 18** renderer
- **SheetJS (`xlsx`)** for spreadsheet conversion
- External binaries: **pandoc**, **git**, **pdftotext** (bundled; see below)

### 10.2 Project Structure

```
src/
  main/                 # Electron main process (Node)
    index.ts            # window, app-info & shell IPC, registers all modules
    bin.ts              # resolves bundled binaries (pandoc/git/pdftotext) → system fallback
    connections.ts      # GitLab/GitHub/Jira connect, validate, safeStorage, getJiraSettings
    git.ts              # status / diff / fileVersion / log / trackedFiles
    repo.ts             # clone, send (per-file commit+tag+push), pull, remoteStatus
    convert.ts          # converter registry, fileDiffData, .derived generation
    jira.ts             # create "Analiz" issue, assign, sprint, transition, wiki diff
    fsmanager.ts        # file ops, "open with", installed-app listing
  preload/index.ts      # contextBridge `window.api` (typed)
  renderer/src/
    app/                # Splash, Landing, SectionView, RemoteWatcher
    screens/            # Files, Submit, History, Profile, Settings, Placeholder
    components/         # DiffView, ContextMenu, NamePrompt, AppPicker, RepoPicker, icons
    theme/  i18n/  assets/
resources/bin/{linux,mac,win}/   # bundled binaries (git-ignored; see its README)
electron-builder.yml             # packaging config
electron.vite.config.ts
```

### 10.3 Prerequisites & Dev Setup

- Node.js 18+ and npm.
- For development you can rely on **system** `pandoc`, `git`, `pdftotext` (the
  binary resolver falls back to `PATH`). Install them via your package manager.

```bash
npm install
npm run dev        # launches the app with HMR
```

> If your npm blocks postinstall scripts, Electron's binary may not download.
> Fetch it once with `node node_modules/electron/install.js`, or allow the
> `electron` install script.

### 10.4 NPM Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Run the app in development (HMR). |
| `npm run build` | Type-agnostic bundle to `out/` (main + preload + renderer). |
| `npm run typecheck` | `tsc --noEmit` for node + web configs. |
| `npm run pack:dir` | Unpacked build to `release/linux-unpacked` (fast validation). |
| `npm run dist:linux` / `dist:win` / `dist:mac` | Full installers/AppImage/dmg. |

### 10.5 Architecture (Main ↔ Preload ↔ Renderer)

The renderer never touches Node/OS directly. Everything goes through typed IPC
exposed on `window.api` by `preload/index.ts`:

- `api.fs.*` — file manager operations, open/open‑with, pick folder/app.
- `api.git.*` — `isRepo`, `status`, `diff`, `fileVersion`, `log`, `trackedFiles`.
- `api.repo.*` — `listProjects`, `clone`, `send`, `pull`, `remoteStatus`.
- `api.convert.fileDiff` — old/new text (converted if needed) for the diff view.
- `api.conn.*` — connection list/connect/disconnect.
- `api.notify.show` — native OS notification.
- `api.getAppInfo`, `api.openExternal`.

Each `src/main/*.ts` module registers its own `ipcMain.handle(...)` in an
exported `register…Ipc()` called from `main/index.ts`.

### 10.6 The Converter Registry

`convert.ts` maps a file extension to a converter that produces plain text for
diffing and for the `.derived` file:

| Extensions | Converter |
|------------|-----------|
| `docx, odt, pptx, rtf, epub` | **pandoc** (`-t gfm --wrap=none`) |
| `pdf` | **pdftotext** (`-layout`) |
| `xlsx, xls, xlsm, ods` | **SheetJS** (each sheet → a section, pure‑JS) |
| text (`md, txt, csv, code…`) | used as‑is |
| images / archives | unsupported (diff hidden) |

The old version is extracted from Git (`git show HEAD:<path>`) into a temp file
and converted, so both sides of the diff use the same pipeline.

### 10.7 Bundled Binaries (Portable Builds)

`bin.ts` resolves each binary **from `resources/bin/<platform>/` first, then the
system `PATH`**. For a portable distribution, place the binaries there before
packaging. See [`resources/bin/README.md`](resources/bin/README.md) for exact
download sources (pandoc static builds, Git‑for‑Windows **MinGit**, poppler
`pdftotext`). Spreadsheets need no binary (SheetJS is pure JS).

### 10.8 Packaging / Distribution

Configured in `electron-builder.yml`. Each platform bundles only its own
`resources/bin/<platform>` folder via `extraResources`, so installers don't carry
the other OSes' binaries.

```bash
npm run pack:dir     # quick unpacked validation (Linux)
npm run dist:linux   # → release/Sivano-<version>.AppImage
npm run dist:win     # → NSIS installer + portable .exe
npm run dist:mac     # → .dmg
```

### 10.9 Security Notes

- **Secrets** (tokens/passwords) are encrypted with Electron `safeStorage`
  (OS keychain: Keychain / DPAPI / libsecret). Only non‑secret metadata is stored
  in `connections.json`.
- Tokens are injected into remote URLs **only for the duration** of a push/clone
  and are **not** written to `.git/config`.
- The renderer runs with `contextIsolation` and a restrictive CSP; all privileged
  work happens in the main process.

### 10.10 Extending Sivano

- **New converter:** add an extension → `{ bin, run }` entry in
  `converterFor()` (`convert.ts`).
- **New Git provider:** extend `Provider`, `validateToken`, and the provider list
  in `Profile.tsx`.
- **New language:** add a dictionary in `i18n/messages.ts`.
- **New theme:** add a `[data-theme="…"]` token block in `assets/base.css` and an
  entry in `theme/themes.ts`.

---

## 11. Troubleshooting

- **"pandoc/pdftotext not found" in a diff** — the binary isn't bundled and isn't
  on `PATH`. Install it, or place it under `resources/bin/<platform>/`.
- **Push fails on an HTTPS remote** — connect the matching provider in Profile so
  a token is available; SSH remotes use your SSH key.
- **Jira issue not created** — check the Project key, Issue type (case‑sensitive)
  and Done step under Profile → Jira → Details. Creation is best‑effort and never
  blocks a submission.
- **A change doesn't appear in Submit** — it refreshes every few seconds; hit
  **Refresh**, or check the file isn't a hidden/lock file.

---

## 12. License

UNLICENSED — © Relteco. All rights reserved.
