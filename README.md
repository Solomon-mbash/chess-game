# Chess — Modern Web Edition

A fully-polished, responsive chess web app built with vanilla JavaScript, [chess.js](https://github.com/jhlywa/chess.js) for rules, and Tailwind CSS for layout. Play against a built-in engine at three difficulty levels, or locally against a friend. Features three distinct visual themes, drag-and-drop or click input, live move history, captured-piece shelf, chess clocks, undo/reset, board rotation, and a clean game-over modal.

The app also ships with a **fully interactive 3D mode** powered by [Three.js](https://threejs.org/) and [GSAP](https://gsap.com/) — orbit the camera, see moves animate, and watch captured pieces slide to a graveyard. Toggle between 2D and 3D in the Display panel; both views share the same game state.

![3D View](https://github.com/Solomon-mbash/chess-game)

---

## Features

- **Two render modes** (toggle in the Display card)
  - **2D** — the classic wood/cyber/stark board, fast and crisp
  - **3D** — WebGL board with `OrbitControls`, procedural `LatheGeometry` pieces, and GSAP-driven move/capture/selection animations. Camera auto-flips to the active side after each move.
- **Game modes**
  - **vs AI** — three difficulty levels (Easy, Medium, Hard) with alpha-beta search and piece-square tables
  - **Local PvP** — two players on the same device
  - Play as **White** or **Black** (board rotates 180°)
- **Three visual themes** (2D only — 3D uses its own PBR materials; switchable at runtime)
  - **Classic Wood** — warm, traditional browns and creams
  - **Neo Cyber** — neon glow on a deep navy field
  - **Minimalist Stark** — high-contrast black/white with strong piece outlines
- **Input** — click-then-click, or drag-and-drop, with full visual feedback:
  - Selected square highlight
  - Move dots (empty) and capture rings (occupied)
  - Last-move highlight on the `from`/`to` squares
  - Red flash on the king when in check
- **Move history** — full algebraic notation (SAN), color-coded
- **Captured pieces** — shelf on each side plus inline chips on the player bar
- **Chess clocks** — 10-minute default, switches with the turn
- **Pawn promotion** — modal with Queen / Rook / Bishop / Knight choice
- **Game over** — modal for checkmate, stalemate, threefold repetition, insufficient material, and 50-move rule
- **Undo** — takes back the last move (and the AI's reply in AI mode)
- **Reset** — start a new game at any time
- **Board rotation** — flip the board 180° mid-game
- **Coordinate labels** — toggle file/rank labels on/off
- **Responsive** — works on mobile, tablet, and desktop; board scales to the viewport

---

## Quick Start

The app uses ES modules, so you need to serve it over HTTP (opening `index.html` directly with `file://` will not work in most browsers).

### 1. Clone

```bash
git clone https://github.com/Solomon-mbash/chess-game.git
cd chess-game
```

### 2. Serve

Pick any of these (no build step required):

```bash
# Python 3
python -m http.server 8765

# Node (with npx)
npx serve -l 8765

# PHP
php -S 127.0.0.1:8765
```

### 3. Open

Visit <http://127.0.0.1:8765/> in your browser.

> **Note:** An internet connection is required on first load to fetch the Tailwind Play CDN, Google Fonts, and the `chess.js` UMD bundle from jsDelivr. After that, browsers cache them.

---

## 3D View

Switch to 3D with the **View: 2D / 3D** toggle in the Display card. The same game state drives both renderers.

- **Camera** — `PerspectiveCamera` with `OrbitControls`. Left-drag to orbit, right-drag to pan, mouse-wheel to zoom. Damping is enabled for fluid motion.
- **Pieces** — built procedurally with Three.js primitives: `LatheGeometry` for the pawn, bishop, queen and king bodies; cylinders + boxes for rooks; stylized boxes for the knight. Two PBR materials (ivory `#f3e9d2` and ebony `#2a2520`).
- **Animations** (GSAP)
  - **Move** — 0.4 s `power2.inOut` slide from old square to new with a 0.6-unit y-arc.
  - **Capture** — 0.55 s `back.out` slide to a side "graveyard" shelf, then scale down and remove.
  - **Selection** — selected piece lifts 0.18 units; move dots pulse.
  - **Camera flip** — after every move the board group rotates 180° and the camera tweens to the opposite side (1.0 s `power2.inOut`), so you're always looking from the side that just moved.
  - **Check** — red flash on the king's square.
- **Lighting** — `HemisphereLight` + key `DirectionalLight` casting soft 2048² shadows, plus a subtle blue fill.
- **Performance** — the render loop pauses when the view is hidden, and one material is shared per color (so 32 pieces = 2 materials).

The 3D view has its own data bridge (`js/3d/adapter.js`) that parses a FEN/position into `{square, kind, color}` records. The `chessboard3.js` library is detected at runtime; if it can't load on modern Three.js (r80 assets, no `BufferGeometry`), the adapter falls back to a hand-rolled FEN parser — the rest of the code is identical either way.

## How to Play

| Action            | How                                                              |
| ----------------- | ---------------------------------------------------------------- |
| Select a piece    | Click it (2D + 3D) or start dragging it (2D only)                |
| See legal moves   | Selected piece shows dots on empty squares, rings on captures    |
| Make a move       | Click a target square (2D + 3D), or drop the dragged piece (2D)  |
| Deselect          | Click the same piece again, or press **Esc**                     |
| Promote a pawn    | Choose Queen / Rook / Bishop / Knight in the modal that appears  |
| Orbit 3D camera   | Left-drag = orbit, right-drag = pan, wheel = zoom (3D only)      |
| Undo a move       | Click **Undo** (also undoes the AI's reply)                      |
| Start over        | Click **Reset**                                                  |
| Change mode       | Toggle **vs AI** / **Local PvP** in the side panel               |
| Change difficulty | Use the **Difficulty** dropdown (AI mode only)                   |
| Change theme      | Use the **Theme** dropdown                                       |
| Flip the board    | Click **Rotate Board**                                           |
| Show coordinates  | Toggle **Show Coordinates**                                     |
| Play as Black     | Change **You play as** to **Black** (board rotates, AI moves first) |

The game-over modal appears automatically when a game ends. Click **Review** to close it and inspect the final position, or **New Game** to start fresh.

---

## Project Structure

```
chess-game/
├── index.html         # App shell, layout, theme config, modal markup, 3D canvas
├── styles.css         # Full theme engine + all component styles + 3D stage
└── js/
    ├── utils.js       # Shared helpers: squareName, squareIndex, glyphs, etc.
    ├── board.js       # BoardView: renders 8x8 grid, handles click + drag input
    ├── ai.js          # Negamax + alpha-beta + MVV-LVA + PSTs
    ├── history.js     # HistoryView: SAN list + captured-piece shelf
    ├── clock.js       # Chess clock (bound to player bars)
    ├── app.js         # Controller: wires every subsystem together
    └── 3d/            # 3D view (Three.js + GSAP)
        ├── adapter.js   # chessboard3.js shim + hand-rolled FEN parser
        ├── pieces.js    # Procedural LatheGeometry / Box / Cylinder pieces
        ├── board3d.js   # 8x8 mesh grid + frame + highlight overlays
        ├── scene.js     # Scene, camera, lights, renderer, OrbitControls
        └── view3d.js    # Public API mirroring BoardView (sync/setSelection/...)
```

### Module Responsibilities

- **`utils.js`** — pure helpers. `squareName(idx)` and `squareIndex(sq)` convert between chess.js numeric squares (0 = a8, 63 = h1) and algebraic strings (`"a8".."h1"`). Also exports Unicode piece glyphs, piece values (in centipawns), and a tiny `$()` selector.

- **`board.js`** — the `BoardView` class. Renders the 8×8 CSS grid, paints pieces, draws the move dots and capture rings, applies the selected/last-move/check highlights, and forwards user input (clicks + drag-and-drop) to callbacks. Exposes `toAlgebraic(idx)` / `algebraicToIndex(sq)` for the boundary with chess.js. On rotation it also reverses the file/rank label text.

- **`ai.js`** — the search engine. Implements **negamax** with **alpha-beta pruning** and **MVV-LVA** move ordering (most-valuable victim, least-valuable attacker first), plus classic **piece-square tables** for positional play. Returns a single move.
  - **Easy** — depth 1, adds random noise to the score, picks among the top 3 moves
  - **Medium** — depth 3
  - **Hard** — depth 4

- **`history.js`** — the `HistoryView` class. Renders the move list in standard two-column notation (`1. e4 e5 2. Nf3 Nc6 …`) and the captured-piece shelves for both sides. Supports `setOrientation(nearColor)` so the bars re-bind when the board rotates.

- **`clock.js`** — a simple chess clock. `Clock.bind({ w, b })` rebinds the elements to colors so it works correctly after board rotation. Tick is 1 Hz, controlled by `start()` / `pause()` / `reset()`.

- **`app.js`** — the application controller. Owns the central `state` object (chess.js instance, mode, difficulty, human color, rotation, AI thinking flag, pending promotion, last move). Wires up the DOM controls, dispatches clicks/drags to `BoardView`, calls `pickMove()` for the AI on a 350 ms cancellable timer, runs the promotion modal, and triggers the game-over modal.

---

## Architecture Notes

### State flow

```
            ┌──────────┐
   click →  │ BoardView│ → onSquareClick(idx) ─┐
            └──────────┘                        │
                                                ▼
                                       ┌────────────────┐
                                       │ app.js (state) │
                                       └────────────────┘
                                                │
                          ┌─────────── handleSquareMove(from,to) ──────┐
                          ▼                                              ▼
                  is promotion?                              applyMove(chess.js move)
                          │                                              │
                          ▼                                              ▼
                openPromotionModal()              render board, update history/clocks/captures,
                          │                       check game_over → onGameOver() → show modal
                          ▼
                user clicks piece
                          │
                          ▼
                  applyMove with promotion choice
```

### Numeric vs algebraic squares

Throughout the app, squares are stored as **numeric indices** (chess.js convention: `0 = a8`, `63 = h1`). The conversion to/from algebraic notation happens only at the API boundary with `chess.js` (`game.moves({ square: "e2" })`) using `BoardView.toAlgebraic()` and `utils.squareIndex()`.

### AI scheduling

The AI doesn't run on a Web Worker (kept simple for portability). Instead, `app.js` schedules `pickMove()` on a 350 ms `setTimeout` and stores the handle in `aiTimeoutHandle`. If the user starts a new game or undoes during that window, the handle is cleared so a stale move can't fire on a fresh game state.

### Themes

All theming is CSS-variable driven. `index.html` sets `data-theme="classic|cyber|stark"` on `<html>`, and `styles.css` redefines the variables (`--bg-app`, `--bg-panel`, `--bg-square-light`, `--bg-square-dark`, `--piece-light`, `--piece-dark`, `--accent`, `--border`, `--text-*`, …) under each selector. Component classes only reference variables, so the same HTML/JS serves all three themes.

The **Stark** theme uses `text-shadow` strokes on piece glyphs so the same white/black icons stay legible on both light and dark squares.

### Board rotation

`BoardView.setOrientation(color)` rotates the `.board-grid` 180° and reverses the text of the file/rank labels (so `a..h` and `8..1` flip to `h..a` and `1..8`). The same call is forwarded to `HistoryView.setOrientation` and `Clock.bind` so all the side panels stay correct.

---

## Tech Stack

- **HTML5** — semantic markup, ARIA roles on the board
- **Tailwind CSS** — layout, via the Play CDN (dev-friendly; for production swap to the Tailwind CLI or PostCSS)
- **Vanilla JavaScript (ES2020 modules)** — no framework, no build step
- **[chess.js 0.12.1](https://github.com/jhlywa/chess.js)** — UMD build from jsDelivr; all rule logic delegated to it (legal moves, check, checkmate, stalemate, threefold repetition, 50-move rule, insufficient material, FEN, SAN, promotion)
- **[Three.js r184](https://threejs.org/)** — ESM build via import map; used by the 3D view
- **[GSAP 3.12](https://gsap.com/)** — ESM build; drives the move, capture, selection, and camera animations
- **chessboard3.js (optional)** — detected at runtime; falls back to the hand-rolled FEN parser in `js/3d/adapter.js` if the lib fails to load on modern Three.js
- **Google Fonts** — Inter (body), Space Grotesk (headings), JetBrains Mono (clocks + history)
- **No build tools, no dependencies to install**

---

## Browser Support

Tested on current Chromium, Firefox, and Safari. Requires:

- ES module support (`<script type="module">`)
- CSS custom properties
- `text-shadow`, `backdrop-filter`, and CSS Grid

---

## License

MIT — do what you like. If you build something cool with it, a star is appreciated.
