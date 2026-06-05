/* =============================================================
   app.js — application controller

   Wires together: chess.js engine, board view, history, clock,
   AI, and UI controls.
   ============================================================= */

import { BoardView } from "./board.js";
import { HistoryView } from "./history.js";
import { Clock } from "./clock.js";
import { pickMove } from "./ai.js";
import { $ } from "./utils.js";

/* =====================================================
   State
   ===================================================== */
const state = {
  game: new Chess(),
  mode: "ai", // "ai" or "pvp"
  difficulty: "medium",
  humanColor: "w",
  rotate: false,
  showCoords: true,
  aiThinking: false,
  pendingPromotion: null, // { from, to } when waiting on promotion choice
  lastMove: null, // {from,to}
};

const els = {
  board: $("#board"),
  theme: $("#theme"),
  difficulty: $("#difficulty"),
  playerColor: $("#player-color"),
  rotateToggle: $("#rotate-toggle"),
  coordsToggle: $("#coords-toggle"),
  btnModeAi: $("#btn-mode-ai"),
  btnModePvp: $("#btn-mode-pvp"),
  btnReset: $("#btn-reset"),
  btnUndo: $("#btn-undo"),
  history: $("#history"),
  clockTop: $("#clock-top"),
  clockBottom: $("#clock-bottom"),
  playerBarBottom: $("#player-bar-bottom"),
  playerBarTop: null, // resolved at init (the previous sibling of bottom)
  playerName: $("#player-name"),
  opponentName: $("#opponent-name"),
  playerAvatar: $("#player-avatar"),
  opponentAvatar: $("#opponent-avatar"),
  playerCaptures: $("#player-captures-inline"),
  opponentCaptures: $("#opponent-captures-inline"),
  modal: $("#modal"),
  modalTitle: $("#modal-title"),
  modalMessage: $("#modal-message"),
  modalIcon: $("#modal-icon"),
  modalClose: $("#modal-close"),
  modalNewGame: $("#modal-newgame"),
  promotionModal: $("#promotion-modal"),
  promotionChoices: $("#promotion-choices"),
};
els.playerBarTop = els.playerBarBottom.previousElementSibling;

const AVATAR = { w: "♔", b: "♚" };

/* =====================================================
   Subsystems
   ===================================================== */
const boardView = new BoardView(els.board, {
  isAIThinking: () => state.aiThinking,
  onSelect: handleSquareSelect,
  onMove: handleSquareMove,
});

const historyView = new HistoryView(els.history, {
  near: els.playerCaptures,    // bottom bar
  far: els.opponentCaptures,   // top bar
});
historyView.setOrientation(bottomColor());

const clock = new Clock(
  { w: els.clockTop, b: els.clockBottom },
  600,
  (winnerName) => showGameOver(`${winnerName} wins on time!`, "⏱")
);

/* =====================================================
   Helpers
   ===================================================== */
function opposite(c) {
  return c === "w" ? "b" : "w";
}
function colorLabel(c) {
  return c === "w" ? "White" : "Black";
}
/* In default orientation: white (move first) is on the BOTTOM.
   In rotated orientation: black is on the bottom. The bars
   track the visual position, not the color. */
function bottomColor() {
  return state.rotate ? "b" : "w";
}
function topColor() {
  return state.rotate ? "w" : "b";
}

/* =====================================================
   Apply a chess.js move and refresh the UI
   ===================================================== */
function applyMove(move) {
  const result = state.game.move(move);
  if (!result) return;
  state.lastMove = { from: result.from, to: result.to };
  historyView.add(result);
  boardView.flashMove(boardView.algebraicToIndex(result.to));
  // In PvP mode with the rotate toggle on, flip the board so the
  // side to move is always at the bottom.
  if (state.mode === "pvp" && state.rotate) {
    applyRotationIfNeeded();
  }
  render();
  if (state.game.game_over()) onGameOver();
}

/* =====================================================
   Render the board + indicators
   ===================================================== */
function render() {
  boardView.render(state.game.board());
  boardView.setLastMove(
    state.lastMove?.from ?? null,
    state.lastMove?.to ?? null
  );

  // Check detection — find the king of the side to move.
  if (state.game.in_check() && !state.game.in_checkmate()) {
    const turn = state.game.turn();
    const board = state.game.board();
    let kingIdx = null;
    outer: for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = board[r][f];
        if (p && p.type === "k" && p.color === turn) {
          kingIdx = r * 8 + f;
          break outer;
        }
      }
    }
    boardView.setCheckSquare(kingIdx);
  } else {
    boardView.setCheckSquare(null);
  }

  // Highlight active player bar
  const turn = state.game.turn();
  const isHumanTurn = state.mode === "pvp" || turn === state.humanColor;
  els.playerBarBottom.classList.toggle("active", turn === bottomColor());
  els.playerBarTop.classList.toggle("active", turn === topColor());

  // Clock tracks the side to move
  clock.switchTo(turn);

  // AI move handling
  if (state.mode === "ai" && !isHumanTurn && !state.game.game_over()) {
    scheduleAIMove();
  }
}

/* =====================================================
   Square interactions
   ===================================================== */
function handleSquareSelect(sqIndex) {
  if (state.game.game_over() || state.pendingPromotion) return;
  if (state.mode === "ai" && state.game.turn() !== state.humanColor) return;

  if (sqIndex == null) {
    boardView.clearSelection();
    return;
  }

  const board = state.game.board();
  const r = Math.floor(sqIndex / 8);
  const f = sqIndex % 8;
  const piece = board[r][f];
  const turn = state.game.turn();

  if (piece && piece.color === turn) {
    if (state.mode === "ai" && piece.color !== state.humanColor) {
      boardView.clearSelection();
      return;
    }
    // chess.js wants algebraic names for the square option.
    const moves = state.game.moves({ square: boardView.toAlgebraic(sqIndex), verbose: true });
    if (moves.length === 0) {
      boardView.clearSelection();
      return;
    }
    boardView.setLegalMoves(sqIndex, moves);
  } else {
    boardView.clearSelection();
  }
}

function handleSquareMove(from, to) {
  if (state.game.game_over() || state.pendingPromotion) {
    return { requiresPromotion: false };
  }
  if (state.mode === "ai" && state.game.turn() !== state.humanColor) {
    return { requiresPromotion: false };
  }

  const moves = state.game.moves({
    square: boardView.toAlgebraic(from),
    verbose: true,
  });
  const toAlg = boardView.toAlgebraic(to);
  const move = moves.find((m) => m.to === toAlg);
  if (!move) return { requiresPromotion: false };

  if (move.promotion) {
    state.pendingPromotion = { from, to };
    openPromotionModal(move.color);
    return { requiresPromotion: true };
  }
  applyMove(move);
  return { requiresPromotion: false };
}

/* =====================================================
   Promotion modal
   ===================================================== */
function openPromotionModal(color) {
  const choices = ["q", "r", "b", "n"];
  const glyphs = { q: "♕", r: "♖", b: "♗", n: "♘" };
  const labels = { q: "Queen", r: "Rook", b: "Bishop", n: "Knight" };
  els.promotionChoices.innerHTML = "";
  choices.forEach((p) => {
    const btn = document.createElement("button");
    btn.title = labels[p];
    btn.textContent = glyphs[p];
    btn.style.color = color === "w" ? "var(--piece-light)" : "var(--piece-dark)";
    btn.addEventListener("click", () => {
      const { from, to } = state.pendingPromotion;
      state.pendingPromotion = null;
      closePromotionModal();
      const toAlg = boardView.toAlgebraic(to);
      const move = state.game
        .moves({ square: boardView.toAlgebraic(from), verbose: true })
        .find((m) => m.to === toAlg && m.promotion === p);
      if (move) applyMove(move);
    });
    els.promotionChoices.appendChild(btn);
  });
  els.promotionModal.classList.remove("hidden");
}

function closePromotionModal() {
  els.promotionModal.classList.add("hidden");
  state.pendingPromotion = null;
  boardView.clearSelection();
}

/* =====================================================
   AI move scheduling
   ===================================================== */
function scheduleAIMove() {
  if (state.aiThinking) return;
  state.aiThinking = true;
  aiTimeoutHandle = setTimeout(() => {
    aiTimeoutHandle = null;
    try {
      if (state.game.game_over()) return;
      const move = pickMove(state.game, state.difficulty);
      if (move) applyMove(move);
    } finally {
      state.aiThinking = false;
    }
  }, 350);
}

/* =====================================================
   Game over
   ===================================================== */
function onGameOver() {
  clock.pause();
  let title, message, icon;
  if (state.game.in_checkmate()) {
    const winner = opposite(state.game.turn());
    title = "Checkmate";
    message = `${colorLabel(winner)} wins by checkmate.`;
    icon = winner === "w" ? "♔" : "♚";
  } else if (state.game.in_stalemate()) {
    title = "Stalemate";
    message = "No legal moves — it's a draw.";
    icon = "⚖";
  } else if (state.game.in_threefold_repetition()) {
    title = "Draw";
    message = "Threefold repetition.";
    icon = "♻";
  } else if (state.game.insufficient_material()) {
    title = "Draw";
    message = "Insufficient material.";
    icon = "🤝";
  } else if (state.game.in_draw()) {
    title = "Draw";
    message = "50-move rule or other draw condition.";
    icon = "🤝";
  } else {
    return;
  }
  showGameOver(message, icon, title);
}

function showGameOver(message, icon = "♚", title = "Game over") {
  els.modalTitle.textContent = title;
  els.modalMessage.textContent = message;
  els.modalIcon.textContent = icon;
  els.modal.classList.remove("hidden");
}

function hideGameOver() {
  els.modal.classList.add("hidden");
}

/* =====================================================
   Reset / Undo
   ===================================================== */
let aiTimeoutHandle = null;

function newGame() {
  // Cancel any pending AI move so it doesn't fire on the new game.
  if (aiTimeoutHandle) {
    clearTimeout(aiTimeoutHandle);
    aiTimeoutHandle = null;
  }
  state.game = new Chess();
  state.lastMove = null;
  state.aiThinking = false;
  state.pendingPromotion = null;
  historyView.reset();
  clock.reset();
  applyRotationIfNeeded();
  // Clock starts on the side to move
  clock.start(state.game.turn());
  render();
  hideGameOver();
}

function undoLast() {
  if (state.aiThinking) return;
  const plies = state.mode === "ai" ? 2 : 1;
  let undone = 0;
  for (let i = 0; i < plies; i++) {
    const move = state.game.undo();
    if (!move) break;
    historyView.removeLast();
    undone += 1;
  }
  if (undone) {
    const hist = state.game.history({ verbose: true });
    state.lastMove = hist.length
      ? { from: hist[hist.length - 1].from, to: hist[hist.length - 1].to }
      : null;
    state.aiThinking = false;
    closePromotionModal();
    hideGameOver();
    clock.reset();
    if (!state.game.game_over()) clock.start(state.game.turn());
    render();
  }
}

/* =====================================================
   Player bars / orientation
   ===================================================== */
function setupPlayerLabels() {
  const near = bottomColor();
  const far = topColor();
  if (state.mode === "ai") {
    const you = state.humanColor;
    els.playerName.textContent = `You (${colorLabel(you)})`;
    els.opponentName.textContent = `Computer (${colorLabel(opposite(you))})`;
    els.playerAvatar.textContent = AVATAR[you];
    els.opponentAvatar.textContent = AVATAR[opposite(you)];
  } else {
    els.playerName.textContent = `${colorLabel(near)} (near)`;
    els.opponentName.textContent = `${colorLabel(far)} (far)`;
    els.playerAvatar.textContent = AVATAR[near];
    els.opponentAvatar.textContent = AVATAR[far];
  }
  // Clock labels
  els.clockTop.querySelector("div:last-child").textContent = colorLabel(far);
  els.clockBottom.querySelector("div:last-child").textContent =
    colorLabel(near);
}

function applyRotationIfNeeded() {
  let rotate;
  if (state.mode === "ai") {
    // In AI mode the human is always on the bottom.
    rotate = state.humanColor === "b";
  } else {
    rotate = state.rotate;
  }
  boardView.setRotated(rotate);
  setupPlayerLabels();
  historyView.setOrientation(bottomColor());
  // Rebind the clock elements so the right element tracks the right
  // color. Top bar = far color, bottom bar = near color.
  const far = topColor();
  const near = bottomColor();
  clock.bind({
    w: far === "w" ? els.clockTop : els.clockBottom,
    b: near === "b" ? els.clockBottom : els.clockTop,
  });
}

/* =====================================================
   UI event wiring
   ===================================================== */
function setMode(mode) {
  state.mode = mode;
  document.body.dataset.mode = mode;
  els.btnModeAi.classList.toggle("is-active", mode === "ai");
  els.btnModePvp.classList.toggle("is-active", mode === "pvp");
  // Show the rotate toggle in PvP, hide in AI (auto-handled)
  els.rotateToggle.checked = false;
  state.rotate = false;
  newGame();
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

function setDifficulty(d) {
  state.difficulty = d;
}

function setHumanColor(spec) {
  if (spec === "random") {
    state.humanColor = Math.random() < 0.5 ? "w" : "b";
  } else {
    state.humanColor = spec;
  }
}

els.btnModeAi.addEventListener("click", () => setMode("ai"));
els.btnModePvp.addEventListener("click", () => setMode("pvp"));
els.btnReset.addEventListener("click", newGame);
els.btnUndo.addEventListener("click", undoLast);

els.theme.addEventListener("change", (e) => setTheme(e.target.value));
els.difficulty.addEventListener("change", (e) =>
  setDifficulty(e.target.value)
);
els.playerColor.addEventListener("change", (e) => {
  setHumanColor(e.target.value);
  newGame();
});
els.rotateToggle.addEventListener("change", (e) => {
  state.rotate = e.target.checked;
  if (state.mode === "pvp") applyRotationIfNeeded();
});
els.coordsToggle.addEventListener("change", (e) => {
  state.showCoords = e.target.checked;
  boardView.setShowCoords(state.showCoords);
});

els.modalClose.addEventListener("click", hideGameOver);
els.modalNewGame.addEventListener("click", () => {
  hideGameOver();
  newGame();
});

// Promotion modal: clicking the backdrop cancels.
els.promotionModal.addEventListener("click", (e) => {
  if (e.target === els.promotionModal) closePromotionModal();
});

// Drag-and-drop on pieces
boardView.enableDraggable((pieceEl) => {
  const sq = pieceEl.closest(".square");
  const idx = parseInt(sq.dataset.sq, 10);
  const r = Math.floor(idx / 8);
  const f = idx % 8;
  const piece = state.game.board()[r][f];
  if (!piece) return false;
  if (state.mode === "ai" && piece.color !== state.humanColor) return false;
  return piece.color === state.game.turn();
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
  if (e.key === "u" || e.key === "U") undoLast();
  else if (e.key === "r" || e.key === "R") newGame();
  else if (e.key === "Escape") {
    closePromotionModal();
    boardView.clearSelection();
  }
});

/* =====================================================
   Bootstrap
   ===================================================== */
setTheme(els.theme.value);
els.btnModeAi.classList.add("is-active");
boardView.setShowCoords(state.showCoords);
newGame();

/* expose for debugging */
window.__chess = { state, boardView, historyView, clock, applyMove };
