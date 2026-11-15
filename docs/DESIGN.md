# NGNE Editor UI — Suite design

The design canon of the NGNE editor suite: what every editor looks like and how it behaves,
whatever it edits. The package implements it ([SPEC.md](SPEC.md)); the gallery shows it. Each
editor's own DESIGN.md names the package version it targets and adds only its own interface
(§11).

## 1. Principles

1. **The content is the only colour.** Chrome is neutral grey with no hue cast, so it never
   biases colour judgement. One accent, used only for selection, focus and the active tool.
2. **Dense, quiet, flat.** 1 px hairlines instead of shadows and cards. No gradients, no
   decorative icons, no panel titles that restate the obvious.
3. **Canvas first.** Panels are narrow and collapsible; the viewport takes every remaining pixel.
4. **The reference's map, the suite's manners.** Each editor keeps the regions, tools and
   modifiers its users know from the program it reproduces the behaviour of; the look, menus,
   command palette and keyboard rules are the suite's.
5. **State is visible.** The active document, layer, tool, zoom, cursor position and unsaved
   status are always on screen; nothing important hides in a mode.

## 2. Layout

```text
+------------------------------------------------------------------------+
| Menus of the app             tab strip (optional)                Ctrl K | 36  menu bar
+----+------------------------------------------------------+------------+
| T  | Options of the active tool                           | Dock       | 36  context bar
| o  +------------------------------------------------------+ sections   |
| o  |                                                      |            |
| l  |        viewport (NGNE canvas + Canvas2D overlay)     |            |
| s  |                                                      |            | 264 right dock
|[ ] |                                                      |            |
| 44 +------------------------------------------------------+------------+
|    | Bottom region (optional)                                          |
+----+-------------------------------------------------------------------+
| Status fields                                         contextual hint  | 24  status bar
+------------------------------------------------------------------------+
```

| Region | Size | Behaviour |
| --- | --- | --- |
| Menu bar | 36 px | Menus, tab strip in the centre, command palette trigger on the right |
| Tool rail | 44 px wide (72 px in two columns) | 28 px tool buttons grouped by separators; footer slot at the bottom |
| Context bar | 36 px | Options of the active tool only |
| Viewport | Flexible | Workspace colour around the document; no scroll bars |
| Right dock | 264 px, resizable 220–360 | Sections, each collapsible |
| Bottom region | Default min(200 px, 28% of window height), resizable 120 px–50% | Optional; Tab toggles it while the canvas has focus |
| Status bar | 24 px | Fields left to right; contextual hint on the right |

Overflow rules (the layout holds at the minimum window, 1280×720):

- **Tool rail:** switches to two columns when one does not fit; never scrolls, never clips.
- **Right dock:** scrolls vertically as one column; section headers stay clickable. An app may
  start sections collapsed under a window height it names.
- **Context bar:** options that do not fit move into a trailing overflow menu.
- **Tab strip:** a `tablist` centred between the menus and the palette trigger. Tabs are 28 px
  high, at most 200 px wide; the label sits between two 24 px columns, the right one the close
  control (shown on the selected tab and under the pointer, taking no press while hidden); the
  unsaved marker follows the label. The selected tab is `--bg-active` with `--text` and a
  2 px `--accent` line inside its bottom edge, in the same weight as the others, so selecting
  never changes a width. Press selects, drag moves, middle click or the close control closes.
  One tab stop: ← → Home End move the focus, Enter or Space selects, Delete closes,
  Ctrl+Shift+← → move the tab. While the tabs do not fit, the strip scrolls without a scroll
  bar (the wheel scrolls it sideways) and a chevron opens a menu of every tab, the selected one
  checked; the selected tab is always in view. The app names the labels and the menu.
- Below 1280×720 the app shows a "window too small" notice instead of a broken layout.

## 3. Tokens

Colour, spacing, radius and type values are CSS custom properties on `:root`; components use
tokens only, and `tokens.css` is the only file with raw colours. Dark is the default; light is
a full second set under `[data-theme="light"]`.

### 3.1 Colour

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--bg-workspace` | `#0f0f10` | `#d9d9db` | Area around the document |
| `--bg-panel` | `#18181a` | `#f4f4f5` | Panels, bars |
| `--bg-raised` | `#222225` | `#ffffff` | Inputs, hovered rows, popovers |
| `--bg-active` | `#2c2c30` | `#e6e6e9` | Pressed, selected row |
| `--border` | `#2a2a2e` | `#d0d0d4` | Hairlines between regions (decorative) |
| `--border-strong` | `#3a3a40` | `#b4b4ba` | Document outline, dividers inside controls |
| `--border-input` | `#70707a` | `#8a8a94` | Outline of inputs, selects, segmented controls |
| `--text` | `#e7e7ea` | `#18181a` | Primary text |
| `--text-muted` | `#9a9aa2` | `#5c5c66` | Labels, secondary content, hints, placeholders |
| `--text-faint` | `#6b6b74` | `#8a8a94` | Disabled controls only |
| `--accent` | `#83e8e1` | `#087f78` | Active tool, selection, focus ring, primary button |
| `--accent-contrast` | `#0f0f10` | `#ffffff` | Text on accent |
| `--danger` | `#ff6b6b` | `#c92a2a` | Destructive confirm, errors |
| `--warn` | `#f2c14e` | `#8a5a00` | Unsaved marker, warnings |

- The dark accent is NGNE's brand cyan. Accent appears on at most a few elements per screen.
- Contrast (WCAG 2.1 AA): `--text` and `--text-muted` on every background ≥ 4.5:1;
  `--accent-contrast` on `--accent` ≥ 4.5:1; `--warn` and `--danger` on `--bg-panel` ≥ 4.5:1;
  `--border-input` against `--bg-raised` ≥ 3:1. `--text-faint` is exempt: disabled controls only.
- User data (palette swatches, tag and layer colours) is the only other hue on screen. Text
  placed on a user colour is black or white, whichever has the higher contrast.
- Transparency checkerboard: `#3a3a3a` / `#4a4a4a` (dark), `#c8c8c8` / `#ffffff` (light).

### 3.2 Type

- `Inter, "Segoe UI", system-ui, sans-serif`; no web-font download.
- Numeric readouts: `font-variant-numeric: tabular-nums`.
- 12 px body and controls, 11 px labels and status bar, 13 px dialog titles; line height 16 px.
- Weights 400 and 500 only (500 for active, selected and titles). No bold, no uppercase labels.

### 3.3 Space, shape, motion, icons

| Token | Value |
| --- | --- |
| Spacing | 2, 4, 8, 12, 16, 24 px |
| Control height | 24 px (inputs, buttons), 28 px (tool buttons, rows) |
| Radius | 4 px controls, 6 px popovers and dialogs, 0 regions; 2 px small marks inside a control; 3 px for a fill inside a 4 px control with a 1 px border |
| Border | 1 px |
| Focus ring | 2 px `--accent`, 1 px offset, keyboard modality only |
| Elevation | Popovers and dialogs only: `0 8px 24px rgb(0 0 0 / 0.4)` |
| Motion | 100 ms ease-out for hover and press; popovers 120 ms fade. The only animation over the canvas is the marching ants |
| Icons | `lucide-react` through the `Icon` wrapper, 16 px, 1.5 px stroke, `currentColor`; no decorative icons |

`prefers-reduced-motion`: transitions off, marching ants static.

## 4. Components

| Component | Rules |
| --- | --- |
| Menu bar | Radix Menubar; shortcuts right-aligned in `--text-muted`; disabled items stay visible |
| Command palette | Ctrl+K; fuzzy search over the command registry; shows menu, shortcut and disabled state (disabled commands listed, inert); commands last run from it come first; Enter runs |
| Tool button | 28 px; active = accent icon on `--bg-active`; tooltip with name and key after 400 ms |
| Icon button | 24 px; hover `--bg-raised`; `aria-label` required |
| Number field | Scrub by dragging the label; arrow keys ±1, Shift ±10; unit suffix muted |
| Slider | 2 px track, 10 px thumb in a 24 px hit area; value in an adjacent number field |
| Toggle | The one idiom for on/off: an icon toggle (`aria-pressed`) in bars and rows, a text toggle (`--bg-active` while pressed) in forms. No switches. A segmented control chooses between named values, never On/Off |
| Select | Radix Select; same metrics as the number field |
| Dialog | Centred. Standard max 560 px; large max 960 px and 86% of window height, body scrolls. Title, body, right-aligned actions; primary action accent-filled |
| Popover | Closes on Escape and outside click; a popover that applies on close blurs its field first |
| Context menu | On rows and items of panels; never on the canvas |
| Toast | Bottom-centre, one line, 4 s; errors and toasts with an action stay until dismissed |
| Splitter | 8 px hit area, 1 px visible line; double-click resets; arrow keys resize when focused. A control beside a splitter takes the presses where the hit area meets it |

## 5. Messages

- **Toast:** the result of an explicit command, and asynchronous failures.
- **Status bar:** transient tool feedback and hints.
- **Dialog:** only when a decision is needed.
- **Error boundary:** around each region; a crashed region shows one line and Reload, the rest
  of the app stays usable.

## 6. Viewport chrome

- Workspace `--bg-workspace`; the document has a 1 px `--border-strong` outline outside its
  bounds and no shadow.
- Grids: 1 px lines, 12% (fine grid) and 25% (coarse grid) white in dark, black in light; a
  line is the first device pixel of its cell.
- Selection: 1 px marching ants, black and white dashes of 2 device pixels by x + y, 4 px
  period, 8 steps per second, on the device pixels just outside the selection.
- Handles: 7 px white squares with a 1 px black border.
- Overlay draw orders (the `*.overlay.ts` registry): document outline 100, grids 200–300,
  selection ants 500, pending selection 600, boxes and handles 650–700, cursor 900.
- Zoom readout and Fit live in the status bar only; nothing floats over the canvas.
- Empty state (no document): the app's first actions as plain text buttons, centred, then
  "Recent files" in `--text-muted` and one button per file, newest first, at most 320 px wide;
  no illustration.

## 7. Shared surfaces

| Surface | Kind | Rules |
| --- | --- | --- |
| Preferences | Dialog | Theme first, then the app's settings; a change applies at once; Restore defaults and Close |
| Shortcut sheet | Dialog | Help → Keyboard Shortcuts…, the first item of the Help menu, and `?`; generated from the command registry, grouped by menu, commands outside the menus under "Other" |
| Open Source Licences | Large dialog | View → Open Source Licences…, last item of the View menu; `licences.txt` in a monospaced block that keeps line breaks and scrolls; Close. If the file cannot be read, a line saying so with a link to it |
| About | Dialog | Help → About <Product name>…, the last item of the Help menu, in a group of its own. The app's name and version, then Engine and Licence as name and value (`@ngne/core <version>`, the licence), links to the repository and the changelog (underlined, each in a new tab), and a status line. Actions Copy version info, which copies one line for a bug report (`<package> <version> · @ngne/core <version> · <user agent>`) and says "Version info copied." or, in `--danger`, that the clipboard is not available; and Close (primary). The facts come from the app's build |
| Recovery | Dialog on launch | Recoverable documents with name, time, thumbnail; Recover / Discard |
| Overwrite confirm | Dialog | Names the folder and the files it holds; Cancel / Replace (danger) |
| Discard changes | Dialog | Names the document; Discard (danger) / Cancel |
| WebGPU required | Full window | What is missing, supported browsers, how to enable acceleration |
| Window too small | Full window | The minimum size, 1280×720 |

Only actions that undo cannot reverse confirm: closing or replacing an unsaved document,
discarding a recovery snapshot, overwriting files. Everything else relies on undo.

## 8. Interaction rules

- One command registry drives menus, command palette, shortcuts and the shortcut sheet.
- Every editor's menu bar ends with Help: Keyboard Shortcuts… first, About <Product name>…
  last in a group of its own; the app may add items between them. Open Source Licences… is the
  last item of View.
- F6 / Shift+F6 cycle regions. Tooltips after 400 ms with name and key.
- No context menus on the canvas.
- Shortcuts: a command two editors share has the same key in both; the editor that had it first
  sets it. A key from an editor's reference program is used only for a command the suite does
  not already bind; a reference key the suite binds to something else gets another key.

## 9. Accessibility

- Every command is reachable by keyboard through a menu or the palette; visible focus on every
  control.
- Radix primitives supply roles, focus trapping and typeahead for menus and dialogs.
- Icon-only controls carry `aria-label` and a tooltip. Cells of a choice that show a place or
  a colour carry their `aria-label` in a labelled group and no tooltip.
- Text contrast per §3.1 in both themes.
- Pointer targets at least 24×24 px. Each editor lists its exceptions in its own DESIGN.md,
  each also operable from the keyboard.
- The close control of a tab is for the pointer only and hidden from assistive technology; the
  keyboard closes a focused tab with Delete.
- Layout is verified at 1280×720 and at 125% browser zoom on a 1920×1080 display.
- The canvas is a pointer surface and is not screen-reader operable; each editor's README says
  so rather than faking it.

## 10. Identity

| Item | Rule |
| --- | --- |
| Product name | "NGNE <Thing> Editor"; manifest `short_name` "NGNE <Things>" |
| Package and storage id | `ngne-<thing>-editor`: storage keys, cache and worker names derive from it (SPEC §5) |
| App icon | A 7×7 pixel grid in `--accent` in the suite's container and proportions; the glyph is the app's own |
| `theme_color` / `background_color` | `--bg-panel` / `--bg-workspace` of the dark set, read from the tokens at build |
| Ports | Each editor has its own dev and preview ports, so two editors' service workers stay apart locally |

## 11. App DESIGN documents

An editor's DESIGN.md:

- names the `@ngne/editor-ui` version it targets;
- describes only its own interface: its menus, tool rail contents, context bar options, dock
  sections, bottom region, status fields, dialogs, empty-state actions and shortcut table;
- lists its exceptions to this canon (pointer targets below 24 px, for example), each with its
  reason and keyboard path;
- never restates or changes a rule of this file. A rule an editor needs changed is changed
  here, in a release of the package.
