/** Deterministic control-point capture logic, independent of rendering. */
export const CAPTURE_RADIUS = 7.5;
export const CAPTURE_SECONDS = 9;

export interface CaptureState { charge: number; complete: boolean; }

export function advanceCapture(previous: CaptureState, distance: number, delta: number): CaptureState {
  if (previous.complete) return previous;
  if (!Number.isFinite(distance) || !Number.isFinite(delta) || delta <= 0) return previous;
  // Progress pauses (rather than resets) when leaving the ring: safe checkpoints within a fight.
  if (distance > CAPTURE_RADIUS) return previous;
  const charge = Math.min(1, previous.charge + Math.min(delta, 0.25) / CAPTURE_SECONDS);
  return { charge, complete: charge >= 1 };
}
