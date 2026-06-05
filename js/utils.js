/* =============================================================
   utils.js — small shared helpers
   ============================================================= */

/** Chess piece Unicode symbols keyed by FEN letter. */
export const PIECE_GLYPHS = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
  P: "♙",
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};

/** Standard material values used by the AI evaluator. */
export const PIECE_VALUE = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

/** Algebraic file/rank conversions. */
export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

export function squareName(sq) {
  // sq: 0..63 where 0 = a8, 63 = h1 (chess.js convention)
  const file = FILES[sq % 8];
  const rank = 8 - Math.floor(sq / 8);
  return `${file}${rank}`;
}

export function squareIndex(name) {
  // Convert an algebraic name like 'e4' to a numeric index 0..63
  // (chess.js convention: 0 = a8, 63 = h1).
  const file = name.charCodeAt(0) - 97; // a=0
  const rank = parseInt(name[1], 10);
  const r = 8 - rank;
  return r * 8 + file;
}

export function squareCoords(sq) {
  return { file: sq % 8, rank: 7 - Math.floor(sq / 8) };
}

export function debounce(fn, ms = 50) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Random integer in [0, n). */
export function randInt(n) {
  return Math.floor(Math.random() * n);
}

/** Format seconds as mm:ss. */
export function formatTime(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Returns the DOM element matching a CSS selector or throws. */
export function $(sel, root = document) {
  const el = root.querySelector(sel);
  if (!el) throw new Error(`Element not found: ${sel}`);
  return el;
}

/** Returns all matching elements as an array. */
export function $$(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}
