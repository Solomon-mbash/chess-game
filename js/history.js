/* =============================================================
   history.js — move history table + captured pieces shelf
   ============================================================= */

import { PIECE_GLYPHS } from "./utils.js";

const PIECE_ORDER = ["q", "r", "b", "n", "p"]; // display order on shelf

export class HistoryView {
  /**
   * @param {HTMLElement} historyEl - container for the move list
   * @param {Object}      barEls   - { near, far }: elements for the
   *                                  bottom (near) and top (far) player
   *                                  bar's capture shelf.
   */
  constructor(historyEl, barEls) {
    this.historyEl = historyEl;
    this.barEls = barEls; // { near, far }
    this.moves = [];
    this.lastIndex = -1;
  }

  /** Re-bind which element shows which color. The `near` bar always
   *  shows the captures of the side whose color is at the bottom of
   *  the board (white by default, black when rotated). */
  setOrientation(nearColor) {
    this.nearColor = nearColor; // 'w' or 'b'
    this.farColor = nearColor === "w" ? "b" : "w";
    this._renderCaptures();
  }

  reset() {
    this.moves = [];
    this.lastIndex = -1;
    this._renderHistory();
    this._renderCaptures();
  }

  add(move) {
    this.moves.push(move);
    this.lastIndex = this.moves.length - 1;
    this._renderHistory();
    this._renderCaptures();
  }

  removeLast() {
    const removed = this.moves.pop();
    this.lastIndex = this.moves.length - 1;
    this._renderHistory();
    this._renderCaptures();
    return removed;
  }

  /** Build captures inventory from scratch. */
  _renderCaptures() {
    if (!this.nearColor) return;
    // Pieces taken BY white vs BY black.
    const takenBy = { w: [], b: [] };
    for (const m of this.moves) {
      if (m.captured) takenBy[m.color].push(m.captured);
    }
    const mapping = [
      { color: "w", el: this.barEls.near, isStark: true }, // near = near color
      { color: "b", el: this.barEls.far },
    ];
    for (const { color, el } of [
      { color: this.nearColor, el: this.barEls.near },
      { color: this.farColor, el: this.barEls.far },
    ]) {
      if (!el) continue;
      el.innerHTML = "";
      takenBy[color]
        .sort((a, b) => PIECE_ORDER.indexOf(a) - PIECE_ORDER.indexOf(b))
        .forEach((type) => {
          const span = document.createElement("span");
          span.textContent = PIECE_GLYPHS[type];
          // Pieces taken BY color `color` are pieces of the OPPOSITE
          // color. We display them using the color they originally
          // belonged to (i.e., the victim's color).
          const victimIsWhite = color === "b";
          span.style.color = victimIsWhite
            ? "var(--piece-light)"
            : "var(--piece-dark)";
          if (document.documentElement.dataset.theme === "stark") {
            span.style.textShadow = victimIsWhite
              ? "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000"
              : "-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff";
          } else {
            span.style.textShadow = victimIsWhite
              ? "0 0 1px #000, 0 2px 3px rgba(0,0,0,0.3)"
              : "0 2px 3px var(--piece-shadow)";
          }
          span.style.fontSize = "1.05rem";
          el.appendChild(span);
        });
    }
  }

  _renderHistory() {
    if (this.moves.length === 0) {
      this.historyEl.innerHTML = `
        <div class="text-[var(--text-muted)] italic text-xs py-4 text-center">
          No moves yet — make your first move!
        </div>`;
      return;
    }
    const pairs = [];
    for (let i = 0; i < this.moves.length; i += 2) {
      pairs.push({
        num: i / 2 + 1,
        white: this.moves[i],
        black: this.moves[i + 1] || null,
      });
    }
    const rows = pairs
      .map((p) => {
        const w = p.white
          ? `<td class="move-white ${
              this.moves.indexOf(p.white) === this.lastIndex ? "last-move" : ""
            }">${p.white.san}</td>`
          : `<td></td>`;
        const b = p.black
          ? `<td class="move-black ${
              this.moves.indexOf(p.black) === this.lastIndex ? "last-move" : ""
            }">${p.black.san}</td>`
          : `<td></td>`;
        return `<tr><td class="move-num">${p.num}.</td>${w}${b}</tr>`;
      })
      .join("");
    this.historyEl.innerHTML = `<table>${rows}</table>`;
    this.historyEl.scrollTop = this.historyEl.scrollHeight;
  }
}
