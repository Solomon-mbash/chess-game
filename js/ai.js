/* =============================================================
   ai.js — minimax search with alpha-beta pruning

   The engine evaluates positions in centipawns from White's
   perspective. Three difficulty levels map to different search
   depths:
     easy   -> depth 1
     medium -> depth 3
     hard   -> depth 4
   To make Easy feel more "human" it adds a small random noise to
   the score and picks among the top few moves.
   ============================================================= */

import { PIECE_VALUE, squareIndex } from "./utils.js";

// Piece-square tables (White's perspective; mirrored for Black).
// Indexing: a8 = 0, h8 = 7, a1 = 56, h1 = 63.
const PST = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10,-20,-20, 10, 10,  5,
     5, -5,-10,  0,  0,-10, -5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5,  5, 10, 25, 25, 10,  5,  5,
    10, 10, 20, 30, 30, 20, 10, 10,
    50, 50, 50, 50, 50, 50, 50, 50,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  5, 10, 10,  5,  0,  0,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     5, 10, 10, 10, 10, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  q: [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -10,  5,  5,  5,  5,  5,  0,-10,
     0,  0,  5,  5,  5,  5,  0, -5,
    -5,  0,  5,  5,  5,  5,  0, -5,
   -10,  0,  5,  5,  5,  5,  0,-10,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
    20, 30, 10,  0,  0, 10, 30, 20,
    20, 20,  0,  0,  0,  0, 20, 20,
   -10,-20,-20,-20,-20,-20,-20,-10,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
  ],
};

/* Convert FEN square index (chess.js: 0=a8, 63=h1) to a PST index
   for BLACK pieces (we mirror rows 0<->7). For WHITE we use as-is. */
function pstValue(piece, sq) {
  const table = PST[piece.type];
  if (!table) return 0;
  const v = table[sq];
  return piece.color === "w" ? v : table[63 - sq];
}

/* Score a position in centipawns from White's perspective. */
export function evaluate(game) {
  if (game.in_checkmate()) {
    // Mate is good for the side delivering it.
    return game.turn() === "w" ? -100000 : 100000;
  }
  if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition()) {
    return 0;
  }

  const board = game.board();
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (!p) continue;
      const sq = r * 8 + f;
      const material = PIECE_VALUE[p.type] || 0;
      const positional = pstValue(p, sq);
      const total = material + positional;
      score += p.color === "w" ? total : -total;
    }
  }
  return score;
}

/* Order moves for better alpha-beta cutoffs: captures first
   (using MVV-LVA — most valuable victim, least valuable attacker),
   then non-captures in current order. */
function orderMoves(game, moves) {
  const board = game.board();
  return moves
    .map((m) => {
      if (!m.captured) return { m, score: 0 };
      const victim = PIECE_VALUE[m.captured] || 0;
      // chess.js 0.12.1 returns `from` as an algebraic string like 'e7'.
      // Convert to a numeric index for squarePiece().
      const attackerSq =
        typeof m.from === "string" ? squareIndex(m.from) : m.from;
      const attackerPiece = squarePiece(board, attackerSq);
      const attacker = attackerPiece ? PIECE_VALUE[attackerPiece.type] || 0 : 0;
      return { m, score: 1000 + victim * 10 - attacker };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.m);
}

function squarePiece(board, sq) {
  const r = Math.floor(sq / 8);
  const f = sq % 8;
  return board[r][f] || null;
}

/* Alpha-beta minimax. Returns a score from the perspective of the
   side to move at the root. We negate on the way up so callers
   can simply maximize. */
function search(game, depth, alpha, beta, ply = 0) {
  if (depth === 0 || game.game_over()) {
    return evaluate(game);
  }
  const moves = orderMoves(game, game.moves({ verbose: true }));
  if (moves.length === 0) return evaluate(game);

  let best = -Infinity;
  for (const move of moves) {
    game.move(move);
    const score = -search(game, depth - 1, -beta, -alpha, ply + 1);
    game.undo();
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/* Top-level: pick the best move for the side to move. */
export function pickMove(game, difficulty = "medium") {
  const depths = { easy: 1, medium: 3, hard: 4 };
  const depth = depths[difficulty] || 3;

  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  const ordered = orderMoves(game, moves);

  // Easy: evaluate at depth 1 but pick randomly from top 3 with noise.
  if (difficulty === "easy") {
    const scored = ordered.map((m) => {
      game.move(m);
      const s = evaluate(game) + (Math.random() * 60 - 30);
      game.undo();
      return { m, s };
    });
    scored.sort((a, b) => b.s - a.s);
    const top = scored.slice(0, Math.min(3, scored.length));
    return top[Math.floor(Math.random() * top.length)].m;
  }

  let bestMove = ordered[0];
  let bestScore = -Infinity;

  for (const move of ordered) {
    game.move(move);
    const score = -search(game, depth - 1, -Infinity, Infinity, 1);
    game.undo();
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}
