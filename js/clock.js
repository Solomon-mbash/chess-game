/* =============================================================
   clock.js — simple chess clocks
   ============================================================= */

import { formatTime } from "./utils.js";

export class Clock {
  /**
   * @param {Object} els  { white, black } DOM elements (must contain .font-mono time)
   * @param {number} initialSeconds
   * @param {function} onFlag  called when a player runs out of time
   */
  constructor(els, initialSeconds = 600, onFlag = () => {}) {
    this.els = els;
    this.initial = initialSeconds;
    this.remaining = { w: initialSeconds, b: initialSeconds };
    this.active = null; // 'w' or 'b'
    this.tickHandle = null;
    this.onFlag = onFlag;
    this._render();
  }

  reset() {
    this.pause();
    this.remaining = { w: this.initial, b: this.initial };
    this.active = null;
    this._render();
  }

  setInitial(seconds) {
    this.initial = seconds;
    this.reset();
  }

  /** Re-bind which DOM element shows which color. Call this when the
   *  board orientation changes so the right element tracks the right
   *  color. */
  bind({ w, b }) {
    this.els = { w, b };
    this._render();
  }

  start(color) {
    this.pause();
    this.active = color;
    this._render();
    this.tickHandle = setInterval(() => this._tick(), 1000);
  }

  pause() {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  switchTo(color) {
    this.active = color;
    this._render();
  }

  _tick() {
    if (!this.active) return;
    this.remaining[this.active] -= 1;
    if (this.remaining[this.active] <= 0) {
      this.remaining[this.active] = 0;
      this.pause();
      this._render();
      this.onFlag(this.active === "w" ? "black" : "white");
      return;
    }
    this._render();
  }

  _render() {
    for (const c of ["w", "b"]) {
      const el = this.els[c];
      const time = el.querySelector(".font-mono");
      if (time) time.textContent = formatTime(this.remaining[c]);
      el.classList.toggle("active", this.active === c);
      el.classList.toggle("low", this.remaining[c] <= 30 && this.active === c);
    }
  }
}
