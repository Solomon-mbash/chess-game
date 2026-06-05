/* =============================================================
   board.js — board rendering, square events, drag/click input
   ============================================================= */

import { PIECE_GLYPHS, FILES, squareName, squareIndex } from "./utils.js";

const FILES_R = [...FILES].reverse();

export class BoardView {
  constructor(rootEl, callbacks) {
    this.root = rootEl;
    this.cb = callbacks; // { onSelect(sqIndex), onMove(from, to, promotion?), isAIThinking }
    this.selected = null;
    this.legalTargets = new Set();
    this.lastMove = null; // {from,to}
    this.checkSquare = null;
    this.rotated = false;
    this.showCoords = true;
    this.flashSquare = null;
    this.flashTimer = null;
    this.squares = new Array(64).fill(null);

    this._build();
  }

  /* ---------------------------------------------------------- */
  /*  Build the static grid (8x8 squares). Coordinate labels     */
  /*  are added by the parent .board-frame in HTML/CSS.           */
  /* ---------------------------------------------------------- */
  _build() {
    this.root.innerHTML = "";
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = this._squareEl(r, f);
        this.root.appendChild(sq);
      }
    }
  }

  _squareEl(r, f) {
    const div = document.createElement("div");
    const isLight = (r + f) % 2 === 0;
    div.className = `square ${isLight ? "light" : "dark"}`;
    const idx = r * 8 + f;
    div.dataset.sq = idx;
    div.setAttribute("role", "gridcell");

    div.addEventListener("click", () => this._onClick(idx));
    div.addEventListener("dragover", (e) => {
      if (this.cb.isAIThinking && this.cb.isAIThinking()) return;
      e.preventDefault();
    });
    div.addEventListener("drop", (e) => {
      e.preventDefault();
      const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
      if (!Number.isNaN(from)) this._tryMove(from, idx);
    });

    this.squares[idx] = div;
    return div;
  }

  /* ---------------------------------------------------------- */
  /*  Public API                                                */
  /* ---------------------------------------------------------- */
  setRotated(rotated) {
    this.rotated = !!rotated;
    this.root.classList.toggle("rotated", this.rotated);
    // Coordinate labels live in the parent .board-frame. When the
    // board is rotated 180° the "a" file ends up on the right, so
    // the file labels must read h..a to keep them aligned with the
    // board's columns. Ranks are also flipped. We rebuild the label
    // rows from scratch each time so toggling is symmetric.
    const frame = this.root.closest(".board-frame");
    if (!frame) return;
    const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];
    const fileSeq = this.rotated ? [...FILES].reverse() : FILES;
    const rankSeq = this.rotated ? [...RANKS].reverse() : RANKS;
    const fill = (container, seq, cls) => {
      if (!container) return;
      container.innerHTML = "";
      seq.forEach((v) => {
        const el = document.createElement("span");
        el.className = `coord ${cls}`;
        el.textContent = v;
        container.appendChild(el);
      });
    };
    fill(frame.querySelector(".board-labels-top"), fileSeq, "file");
    fill(frame.querySelector(".board-labels-bottom"), fileSeq, "file");
    fill(frame.querySelector(".board-labels-left"), rankSeq, "rank");
    fill(frame.querySelector(".board-labels-right"), rankSeq, "rank");
  }

  setShowCoords(show) {
    this.showCoords = !!show;
    // Coords live in the parent .board-frame element, not the grid root.
    const frame = this.root.closest(".board-frame") || this.root.parentElement;
    if (frame) frame.classList.toggle("show-coords", this.showCoords);
  }

  /** Render the board from a chess.js board() 2D array. */
  render(board) {
    // board is 8x8, [0][0] = a8
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const piece = board[r][f];
        const idx = r * 8 + f;
        const sq = this.squares[idx];
        sq.innerHTML = "";
        if (piece) {
          const p = document.createElement("span");
          p.className = `piece ${piece.color === "w" ? "white" : "black"}`;
          // chess.js returns {type:'p', color:'w'|'b'}. Our glyphs are
          // uppercase for white and lowercase for black.
          p.textContent =
            PIECE_GLYPHS[
              piece.color === "w" ? piece.type.toUpperCase() : piece.type
            ];
          sq.appendChild(p);
        }
      }
    }
  }

  setLegalMoves(fromIdx, moves) {
    this.selected = fromIdx;
    this.legalTargets = new Set(
      moves.map((m) => this.algebraicToIndex(m.to))
    );
    this._refreshHighlights();
  }

  /** Convert a numeric square index (0..63) to algebraic name, e.g. 36 -> 'e4'. */
  toAlgebraic(idx) {
    return squareName(idx);
  }

  /** Convert an algebraic name (e.g. 'e4') to a numeric index (e.g. 36). */
  algebraicToIndex(name) {
    return squareIndex(name);
  }

  setCheckSquare(idx) {
    this.checkSquare = idx;
    this._refreshHighlights();
  }

  setLastMove(from, to) {
    // `from`/`to` are algebraic names ('e2') or numeric indices. Normalize
    // to numeric indices internally.
    this.lastMove = {
      from: typeof from === "string" ? this.algebraicToIndex(from) : from,
      to: typeof to === "string" ? this.algebraicToIndex(to) : to,
    };
    this._refreshHighlights();
  }

  clearSelection() {
    this.selected = null;
    this.legalTargets.clear();
    this._refreshHighlights();
  }

  flashMove(sqIdx) {
    const el = this.squares[sqIdx];
    if (!el) return;
    el.classList.add("flash-move");
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => el.classList.remove("flash-move"), 280);
  }

  /* ---------------------------------------------------------- */
  /*  Internals                                                 */
  /* ---------------------------------------------------------- */
  _refreshHighlights() {
    for (let i = 0; i < 64; i++) {
      const el = this.squares[i];
      el.classList.remove("selected", "last-move", "in-check");
      // remove any old indicators
      el.querySelectorAll(".move-dot, .capture-ring").forEach((n) => n.remove());
    }

    if (this.lastMove) {
      this.squares[this.lastMove.from]?.classList.add("last-move");
      this.squares[this.lastMove.to]?.classList.add("last-move");
    }

    if (this.checkSquare != null) {
      this.squares[this.checkSquare]?.classList.add("in-check");
    }

    if (this.selected != null) {
      this.squares[this.selected]?.classList.add("selected");
      this.legalTargets.forEach((to) => {
        const el = this.squares[to];
        if (!el) return;
        // Capture target if a piece is already on the square
        const hasPiece = el.querySelector(".piece");
        if (hasPiece) {
          const ring = document.createElement("div");
          ring.className = "capture-ring";
          el.appendChild(ring);
        } else {
          const dot = document.createElement("div");
          dot.className = "move-dot";
          el.appendChild(dot);
        }
      });
    }
  }

  _onClick(idx) {
    if (this.cb.isAIThinking && this.cb.isAIThinking()) return;
    if (this.selected == null) {
      this.cb.onSelect(idx);
      return;
    }

    if (idx === this.selected) {
      this.clearSelection();
      this.cb.onSelect(null);
      return;
    }

    // If the clicked square has a legal target, attempt the move.
    if (this.legalTargets.has(idx)) {
      this._tryMove(this.selected, idx);
      return;
    }

    // Otherwise treat it as a new selection.
    this.clearSelection();
    this.cb.onSelect(idx);
  }

  _tryMove(from, to) {
    const result = this.cb.onMove(from, to);
    if (result && result.requiresPromotion) {
      // App handles the promotion modal — board keeps selection so player
      // can re-click. We do nothing here.
      return;
    }
    this.clearSelection();
  }

  /* ---------------------------------------------------------- */
  /*  Drag and drop on a piece                                  */
  /* ---------------------------------------------------------- */
  enableDraggable(pieceFilter) {
    this.root.addEventListener("dragstart", (e) => {
      if (this.cb.isAIThinking && this.cb.isAIThinking()) {
        e.preventDefault();
        return;
      }
      const target = e.target.closest(".square");
      if (!target) return;
      const from = parseInt(target.dataset.sq, 10);
      const piece = target.querySelector(".piece");
      if (!piece) {
        e.preventDefault();
        return;
      }
      if (pieceFilter && !pieceFilter(piece)) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData("text/plain", String(from));
      e.dataTransfer.effectAllowed = "move";
    });
  }
}
