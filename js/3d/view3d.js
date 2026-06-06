/* =============================================================
   view3d.js — 3D BoardView that mirrors the 2D BoardView surface.

   Public API (called by app.js):
     view3d = new View3D(canvas)
     view3d.mount()                       — create scene, build initial position
     view3d.unmount()                     — dispose, stop RAF
     view3d.sync(state)                   — render the current game state
     view3d.setSelection(square | null)   — highlight selected piece
     view3d.setLegalTargets(targets)     — show move dots / capture rings
     view3d.setLastMove({from,to}|null)  — highlight last-move squares
     view3d.flashKingCheck(square|null)  — red flash on king
     view3d.setOrientation('w'|'b')      — flip camera 180°

   The view is a pure renderer; chess.js in app.js is the
   source of truth. All state comes in through sync().
   ============================================================= */

import * as THREE from "three";
import { gsap } from "gsap";
import { createScene } from "./scene.js";
import { buildBoard, squareToXZSq } from "./board3d.js";
import { buildPiece, makeMaterials } from "./pieces.js";
import { boardMatrixToPositions } from "./adapter.js";
import { squareIndex } from "../utils.js";

const SQUARE_SIZE = 1.0;
const PIECE_BASE_Y = 0; // bottom of piece sits at y=0
const PIECE_REST_Y = 0; // pieces rest at y=0
const PIECE_LIFT_Y = 0.18;
const GRAVEYARD_X = { w: -5.6, b: 5.6 };

export class View3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.mounted = false;
    this.sceneObj = null;
    this.board = null;
    this.materials = null;
    this.orientation = "w";
    this.pieceGroup = null;          // THREE.Group holding all live pieces
    this.pieces = new Map();         // square -> THREE.Group
    this.captured = [];              // captured piece groups (for graveyard)
    this.moveDots = new Set();       // squares with dots
    this.captureRings = new Set();   // squares with rings
    this.selected = null;
    this.lastMoveSquares = [];
    this.checkSquare = null;
    this._raf = null;
    this._gsapTimeline = null;
    this._onClick = null;            // (squareOrNull) => void
    this._flipTween = null;
  }

  /* ---- mount / unmount ---- */
  mount() {
    if (this.mounted) return;
    this.mounted = true;
    this.sceneObj = createScene(this.canvas);
    this.materials = makeMaterials();
    this.board = buildBoard({});

    // Group to hold all live pieces (so we can flip them with the board)
    this.pieceGroup = new THREE.Group();
    this.pieceGroup.name = "pieces";

    const root = new THREE.Group();
    root.add(this.board.root);
    root.add(this.pieceGroup);
    root.name = "boardRoot";
    this.boardRoot = root;
    this.sceneObj.scene.add(root);

    // Click handler
    this.canvas.addEventListener("click", this._handleClick);

    // Start render loop
    const loop = () => {
      if (!this.mounted) return;
      this.sceneObj.resize();
      this.sceneObj.controls.update();
      this.sceneObj.renderer.render(
        this.sceneObj.scene,
        this.sceneObj.camera
      );
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  unmount() {
    if (!this.mounted) return;
    this.mounted = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this.canvas.removeEventListener("click", this._handleClick);
    this._gsapTimeline?.kill();
    if (this.sceneObj) {
      this.sceneObj.scene.clear();
      this.sceneObj.renderer.dispose();
    }
    this.sceneObj = null;
    this.pieces.clear();
    this.captured = [];
  }

  onSquareClick(cb) {
    this._onClick = cb;
  }

  /* ---- render: place all pieces per chess.js board matrix ----
     Detects moves vs captures by matching kind+color pieces. If a
     piece that was on the board is now on a different square of the
     same kind+color, we animate it. If no match, we capture it. ---- */
  sync(state) {
    if (!this.mounted) return;
    const positions = boardMatrixToPositions(state.game.board());
    const want = new Map();
    for (const p of positions) want.set(p.square, p);

    // For each existing piece, decide: keep / move / capture
    const consumed = new Set(); // new squares already matched
    for (const [sq, mesh] of [...this.pieces.entries()]) {
      const w = want.get(sq);
      if (w && w.kind === mesh.userData.kind && w.color === mesh.userData.color) {
        // Still in place, unchanged
        continue;
      }
      // Find a new square with a matching piece (a move)
      let moveTarget = null;
      for (const [newSq, w2] of want) {
        if (consumed.has(newSq)) continue;
        if (w2.kind === mesh.userData.kind && w2.color === mesh.userData.color) {
          moveTarget = newSq;
          break;
        }
      }
      if (moveTarget != null) {
        consumed.add(moveTarget);
        this.pieces.delete(sq);
        this.pieces.set(moveTarget, mesh);
        mesh.userData.square = moveTarget;
        this._animateMove(mesh, sq, moveTarget);
      } else {
        // No match -> captured / removed
        this.pieces.delete(sq);
        this._animateCapture(mesh);
      }
    }

    // Genuinely new pieces (e.g. pawn promotion)
    for (const [sq, info] of want) {
      if (consumed.has(sq)) continue;
      if (this.pieces.has(sq)) continue;
      this._addPiece(sq, info.kind, info.color, /*animate=*/true);
    }
  }

  _animateMove(mesh, from, to) {
    const fromPos = squareToXZSq(from);
    const toPos = squareToXZSq(to);
    const obj = { t: 0 };
    gsap.to(obj, {
      t: 1,
      duration: 0.4,
      ease: "power2.inOut",
      onUpdate: () => {
        mesh.position.x = fromPos.x + (toPos.x - fromPos.x) * obj.t;
        mesh.position.z = fromPos.z + (toPos.z - fromPos.z) * obj.t;
        mesh.position.y =
          PIECE_REST_Y + Math.sin(obj.t * Math.PI) * 0.6;
      },
    });
  }

  _addPiece(square, kind, color, animate) {
    const mesh = buildPiece(kind, color, square, this.materials);
    const { x, z } = squareToXZSq(square);
    mesh.position.set(x, animate ? PIECE_LIFT_Y + 1.2 : PIECE_REST_Y, z);
    this.pieceGroup.add(mesh);
    this.pieces.set(square, mesh);

    if (animate) {
      gsap.to(mesh.position, {
        y: PIECE_REST_Y,
        duration: 0.5,
        ease: "power2.out",
      });
    }
  }

  _animateCapture(mesh) {
    if (!mesh) return;
    // Move to graveyard (off to the side), then remove from scene.
    // We don't fade because all pieces of the same color share a
    // single material instance (a perf optimization), so animating
    // opacity on one would affect them all.
    const color = mesh.userData.color;
    const slot = this.captured.length;
    this.captured.push(mesh);
    const targetX = GRAVEYARD_X[color] + (slot % 6) * 0.4;
    const targetZ = 4.5 - (slot % 6) * 0.4;
    gsap.to(mesh.position, {
      x: targetX,
      z: targetZ,
      y: 0.5,
      duration: 0.55,
      ease: "back.out(1.4)",
    });
    gsap.to(mesh.rotation, {
      y: Math.PI * (0.5 + Math.random() * 0.5),
      duration: 0.55,
      ease: "power2.out",
    });
    gsap.to(mesh.scale, {
      x: 0.6, y: 0.6, z: 0.6,
      duration: 0.55,
      ease: "power2.in",
      onComplete: () => {
        if (this.pieceGroup.children.includes(mesh)) {
          this.pieceGroup.remove(mesh);
        }
      },
    });
  }

  /* ---- animate a move: from -> to, killing any captured ---- */
  animateMove(from, to, capturedSquare) {
    const mesh = this.pieces.get(from);
    if (!mesh) return;
    this.pieces.delete(from);
    this.pieces.set(to, mesh);
    mesh.userData.square = to;

    const fromPos = squareToXZSq(from);
    const toPos = squareToXZSq(to);
    // Slight y arc
    const arc = 0.6;
    const obj = { t: 0, x: fromPos.x, z: fromPos.z };
    gsap.to(obj, {
      t: 1,
      x: toPos.x,
      z: toPos.z,
      duration: 0.4,
      ease: "power2.inOut",
      onUpdate: () => {
        mesh.position.x = obj.x;
        mesh.position.z = obj.z;
        mesh.position.y =
          PIECE_REST_Y + Math.sin(obj.t * Math.PI) * arc;
      },
    });
  }

  /* ---- selection / legal targets ---- */
  setSelection(square) {
    // Deselect previous
    if (this.selected != null) {
      const prev = this.pieces.get(this.selected);
      if (prev) {
        gsap.to(prev.position, {
          y: PIECE_REST_Y,
          duration: 0.2,
          ease: "power2.out",
        });
      }
    }
    this.selected = square;
    if (square != null) {
      const mesh = this.pieces.get(square);
      if (mesh) {
        gsap.to(mesh.position, {
          y: PIECE_LIFT_Y,
          duration: 0.2,
          ease: "power2.out",
        });
      }
    }
  }

  setLegalTargets(targets) {
    // Clear previous
    for (const sq of this.moveDots) {
      this.board.dotMap[sq].visible = false;
    }
    for (const sq of this.captureRings) {
      this.board.ringMap[sq].visible = false;
    }
    this.moveDots.clear();
    this.captureRings.clear();
    for (const t of targets) {
      if (t.capture) {
        this.board.ringMap[t.to].visible = true;
        this.captureRings.add(t.to);
      } else {
        this.board.dotMap[t.to].visible = true;
        this.moveDots.add(t.to);
        // Pulse the dot
        const m = this.board.dotMap[t.to];
        gsap.fromTo(
          m.material,
          { opacity: 0.4 },
          { opacity: 0.95, duration: 0.8, yoyo: true, repeat: -1, ease: "sine.inOut" }
        );
      }
    }
  }

  /* ---- last-move highlight ---- */
  setLastMove(lastMove) {
    // Clear previous
    for (const sq of this.lastMoveSquares) {
      const o = this.board.overlayMap[sq];
      o.material.color.set(0xffffff);
      o.material.opacity = 0;
      o.visible = false;
    }
    this.lastMoveSquares = [];
    if (!lastMove) return;
    // lastMove may use algebraic ('e2') or numeric; accept both.
    const toIdx = (v) =>
      typeof v === "number" ? v : squareIndex(v);
    const from = toIdx(lastMove.from);
    const to = toIdx(lastMove.to);
    const color = new THREE.Color(this.board.colors.lastMoveColor);
    for (const sq of [from, to]) {
      const o = this.board.overlayMap[sq];
      o.material.color.copy(color);
      o.material.opacity = 0.55;
      o.visible = true;
      this.lastMoveSquares.push(sq);
    }
  }

  /* ---- red flash on king in check ---- */
  flashKingCheck(square) {
    if (this.checkSquare != null) {
      const o = this.board.overlayMap[this.checkSquare];
      o.material.color.set(0xffffff);
      o.material.opacity = 0;
      o.visible = false;
    }
    this.checkSquare = square;
    if (square == null) return;
    const o = this.board.overlayMap[square];
    o.material.color.set(0xff3030);
    o.material.opacity = 0.6;
    o.visible = true;
    // Pulse
    gsap.fromTo(
      o.material,
      { opacity: 0.3 },
      { opacity: 0.85, duration: 0.5, yoyo: true, repeat: 3, ease: "sine.inOut" }
    );
  }

  /* ---- camera flip when orientation changes ---- */
  setOrientation(color) {
    if (color === this.orientation) return;
    this.orientation = color;
    const { camera, controls } = this.sceneObj;
    const targetYRot = color === "w" ? 0 : Math.PI;
    const targetCamZ = color === "w" ? -9.5 : 9.5;
    // Rotate the board group + the camera
    this._flipTween?.kill();
    this._flipTween = gsap.timeline();
    this._flipTween.to(
      this.boardRoot.rotation,
      { y: targetYRot, duration: 1.0, ease: "power2.inOut" },
      0
    );
    this._flipTween.to(
      camera.position,
      { z: targetCamZ, duration: 1.0, ease: "power2.inOut" },
      0
    );
  }

  /* ---- click handler ---- */
  _handleClick = (event) => {
    if (!this.mounted) return;
    const { camera, scene } = this.sceneObj;
    const ray = this.sceneObj.pick(event);
    // Hit pieces first, then squares
    const pieceMeshes = [];
    for (const mesh of this.pieces.values()) {
      mesh.traverse((o) => {
        if (o.isMesh) pieceMeshes.push(o);
      });
    }
    const pieceHits = ray.intersectObjects(pieceMeshes, false);
    if (pieceHits.length) {
      const group = pieceHits[0].object.userData.pieceGroup;
      if (group) {
        this._onClick?.({ kind: "piece", square: group.userData.square, color: group.userData.color });
        return;
      }
    }
    const squareHits = ray.intersectObjects(this.board.squares, false);
    if (squareHits.length) {
      const sq = squareHits[0].object.userData.square;
      this._onClick?.({ kind: "square", square: sq });
      return;
    }
    this._onClick?.(null);
  };
}
