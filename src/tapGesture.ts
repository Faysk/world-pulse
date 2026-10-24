/**
 * Pure recognizer for deliberate clicks/taps on the World Pulse globe.
 *
 * MapLibre already filters many drags, but its "click" event by itself is
 * insufficient for multi-touch, a touchpad gesture, or recent camera motion.
 * We require a short, stationary pointer sequence and consume it ONCE.
 *
 * Distances are CSS pixels (not device pixels). No location or device
 * fingerprint is collected or persisted.
 */
export type PointerInput = {
  id: number;
  x: number;
  y: number;
  at: number;
  pointerType: string;
};

type Gesture = {
  id: number;
  x: number;
  y: number;
  at: number;
  pointerType: string;
  invalid: boolean;
};

type EligibleTap = { x: number; y: number; at: number; pointerType: string };

export const MAX_TAP_MS = 750;
export const MAX_CLICK_AFTER_RELEASE_MS = 650;
const MOUSE_MOVEMENT_PX = 9;
const TOUCH_MOVEMENT_PX = 16;
const CLICK_POSITION_PX = 22;

export class TapGestureGuard {
  private pointers = new Set<number>();
  private gesture: Gesture | null = null;
  private eligible: EligibleTap | null = null;

  pointerDown(input: PointerInput): void {
    this.eligible = null;
    const multiPointer = this.pointers.size > 0;
    this.pointers.add(input.id);
    if (multiPointer) {
      if (this.gesture) this.gesture.invalid = true;
      return;
    }
    this.gesture = {
      id: input.id, x: input.x, y: input.y, at: input.at,
      pointerType: input.pointerType, invalid: false
    };
  }

  pointerMove(input: PointerInput): void {
    const g = this.gesture;
    if (!g || g.id !== input.id || g.invalid) return;
    const limit = g.pointerType === 'touch' ? TOUCH_MOVEMENT_PX : MOUSE_MOVEMENT_PX;
    if (Math.hypot(input.x - g.x, input.y - g.y) > limit) g.invalid = true;
  }

  pointerUp(input: PointerInput): void {
    if (!this.pointers.has(input.id)) return;
    // Check final coordinate too: move events can be coalesced/missed by the
    // browser when a finger or high-polling-rate mouse moves very quickly.
    this.pointerMove(input);
    const g = this.gesture;
    const lastPointer = this.pointers.size === 1;
    const duration = g ? input.at - g.at : -1;
    this.eligible = (
      lastPointer && g && g.id === input.id && !g.invalid &&
      duration >= 0 && duration <= MAX_TAP_MS
    ) ? { x: input.x, y: input.y, at: input.at, pointerType: g.pointerType } : null;
    this.pointers.delete(input.id);
    if (!this.pointers.size) this.gesture = null;
  }

  /** Invalidates the whole pending gesture (pinch, wheel, camera drag). */
  invalidate(): void {
    if (this.gesture) this.gesture.invalid = true;
    this.eligible = null;
  }

  pointerCancel(id?: number): void {
    this.invalidate();
    if (id === undefined) this.pointers.clear();
    else this.pointers.delete(id);
    if (!this.pointers.size) this.gesture = null;
  }

  /**
   * Only a native MapLibre click immediately following pointerUp can credit.
   * Any duplicate click returns false; we consume the candidate atomically.
   */
  consumeClick(x: number, y: number, at: number): boolean {
    const tap = this.eligible;
    this.eligible = null;
    if (!tap || this.pointers.size) return false;
    const age = at - tap.at;
    return age >= 0 && age <= MAX_CLICK_AFTER_RELEASE_MS &&
      Math.hypot(x - tap.x, y - tap.y) <= CLICK_POSITION_PX;
  }
}
