

https://github.com/user-attachments/assets/c565f283-7eaa-451d-a783-31ddd8e45b03

# TeX and PDF Navigation

[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://marketplace.visualstudio.com/items?itemName=simonnchong.tex-sync-buttons)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Navigate seamlessly between your LaTeX source and compiled PDF — just like Overleaf, right inside VS Code.

---

## Features

### → Forward Sync Button (TeX editor title bar)
A `→` arrow button appears in the title bar of every `.tex` file. Click it to jump the PDF viewer to the exact page and position matching your current cursor location.

### Double-click PDF → Jump to source
Double-click anywhere in the LaTeX Workshop PDF viewer to jump directly to the matching line in your `.tex` file. A visual indicator highlights the synced position.

### TeX Sync Outline panel (Explorer sidebar)
A collapsible outline panel lists all your document sections (`\part`, `\chapter`, `\section`, `\subsection`, `\subsubsection`). Click any entry to:
- Navigate the `.tex` editor to that section's line
- Simultaneously sync the PDF viewer to that location

The outline refreshes automatically when you save the file, and has a manual **↻ Refresh** button in the panel header.

### 🔗 Scroll Sync toggle
A **link** button in the TeX Sync Outline panel header toggles scroll sync on and off.

- **ON** (`🔗` icon active): scrolling the `.tex` editor automatically scrolls the PDF to the corresponding position. Uses the center of the visible editor area as the sync point, debounced at 350 ms so it does not fire on every tick.
- **OFF**: no automatic scroll following.

---

## Requirements

- **[LaTeX Workshop](https://marketplace.visualstudio.com/items?itemName=James-Yu.latex-workshop)** — this extension delegates all SyncTeX operations to LaTeX Workshop. Install it from the Extensions sidebar if you have not already.
- Your `.tex` project must be **compiled at least once** to generate the `.synctex.gz` file that SyncTeX uses for position mapping.
- The PDF must be opened in the **LaTeX Workshop PDF viewer** (not an external PDF app). This is the default when you compile with LaTeX Workshop.

---

## Usage

| Action | Result |
|--------|--------|
| Click `→` in the `.tex` editor title bar | PDF jumps to your cursor position |
| Double-click in the PDF viewer | `.tex` editor jumps to the clicked position |
| Click a section in TeX Sync Outline | Both `.tex` and PDF jump to that section |
| Click `🔗` in TeX Sync Outline header | Toggle automatic scroll sync |
| Click `↻` in TeX Sync Outline header | Refresh the section list manually |

---

## Extension Settings

This extension contributes one setting:

| Setting | Default | Description |
|---------|---------|-------------|
| `latex-workshop.view.pdf.internal.synctex.keybinding` | `double-click` | Set automatically to `double-click` on activation. Change to `ctrl-click` in your VS Code settings if you prefer the original LaTeX Workshop behavior. |

---

## Known Limitations

- **Scroll sync cursor flicker**: When scroll sync is active, the cursor briefly moves to the center of the visible area and returns. This is necessary because LaTeX Workshop's sync command reads the current cursor position. Editing is not affected.
- **Outline parsing**: Sections inside comments (`%`) are filtered out. Sections inside `\input` or `\include` files are not shown — only the currently open file is parsed.
- **Double-click in PDF**: Requires the LaTeX Workshop PDF viewer (the built-in WebView). External PDF viewers are not supported.

---

## How It Works

Forward sync and backward sync are delegated to **LaTeX Workshop's** built-in SyncTeX engine (`latex-workshop.synctex`). This extension adds:
1. A title-bar shortcut button so you do not need to remember the keyboard shortcut.
2. A structured outline panel with one-click navigation + sync.
3. A scroll-following mode by listening to `onDidChangeTextEditorVisibleRanges`.
4. The double-click PDF behavior is enabled via the `latex-workshop.view.pdf.internal.synctex.keybinding` setting (already built into LaTeX Workshop but disabled by default).

---

## Author

**simonnchong** — [GitHub](https://github.com/simonnchong)

---

## License

[MIT](https://opensource.org/licenses/MIT)
