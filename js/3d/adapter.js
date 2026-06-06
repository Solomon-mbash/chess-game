/* =============================================================
   adapter.js — FEN -> position bridge

   Mirrors the contract that chessboard3.js exposes:
     board3.position('start')
     board3.position('rnbqkbnr/pppppppp/8/...')
     board3.position({ e4: 'wP', d5: 'bK' })

   We hand-roll the FEN parser because:
     1) chessboard3.js was written for three.js r80 (uses old
        JSONGeometryLoader) and is unlikely to work on r184.
     2) The parse logic is ~30 lines.

   Returns an array of { square: 0..63, kind: 'p'|'n'|..., color: 'w'|'b' }
   ============================================================= */

export const PIECE_KIND = {
  p: "p", n: "n", b: "b", r: "r", q: "q", k: "k",
  P: "p", N: "n", B: "b", R: "r", Q: "q", K: "k",
};
export const PIECE_COLOR = {
  p: "b", n: "b", b: "b", r: "b", q: "b", k: "b",
  P: "w", N: "w", B: "w", R: "w", Q: "w", K: "w",
};

const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/* ---- FEN string -> positions[] ----
   Accepts the full FEN (with side/castling/ep/half/full) or just
   the board portion (first space-separated token). */
export function fenToPositions(fenOrStart) {
  const fen = !fenOrStart || fenOrStart === "start"
    ? START_FEN
    : fenOrStart;
  const boardPart = fen.split(" ")[0];
  const ranks = boardPart.split("/");
  if (ranks.length !== 8) {
    throw new Error("Invalid FEN: expected 8 ranks");
  }
  const out = [];
  for (let r = 0; r < 8; r++) {
    const rankStr = ranks[r];
    let file = 0;
    for (const ch of rankStr) {
      if (ch >= "1" && ch <= "8") {
        file += parseInt(ch, 10);
      } else {
        const sq = r * 8 + file;
        out.push({
          square: sq,
          kind: PIECE_KIND[ch],
          color: PIECE_COLOR[ch],
        });
        file++;
      }
    }
    if (file !== 8) {
      throw new Error(`Invalid FEN rank ${r}: ${rankStr}`);
    }
  }
  return out;
}

/* ---- chess.js board() matrix -> positions[] ----
   chess.js board() returns an 8x8 array (rank 8 first) of
   { type, color } or null. */
export function boardMatrixToPositions(boardMatrix) {
  const out = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const cell = boardMatrix[r][f];
      if (cell) {
        out.push({
          square: r * 8 + f,
          kind: cell.type,
          color: cell.color,
        });
      }
    }
  }
  return out;
}

/* ---- Try to load chessboard3.js (best-effort) ----
   If it works, we use its position() API. If it fails, the
   caller falls back to boardMatrixToPositions. */
export async function tryLoadChessboard3() {
  try {
    const mod = await import(
      /* @vite-ignore */
      "https://cdn.jsdelivr.net/gh/jtiscione/chessboard3js@master/releases/chessboard3.min.js"
    );
    return mod;
  } catch (e) {
    return null;
  }
}
