/** Small deterministic 2D route planner for the final base-floor computer only. */
import { pointBlocked, segmentBlocked } from './combat';
import type { Blocker } from './simulation';

export interface MapPoint { x: number; z: number; }

const STEP = 1.5;
const MIN_X = -42;
const MIN_Z = -53;
const COLS = 57;
const ROWS = 72;
const CLEARANCE = 0.48;

function coordinates(index: number): MapPoint {
  return { x: MIN_X + index % COLS * STEP, z: MIN_Z + Math.floor(index / COLS) * STEP };
}

/** Returns the shortest walkable grid route, then simplifies only visible segments. */
export function routeToComputer(start: MapPoint, goal: MapPoint, blockers: readonly Blocker[]): MapPoint[] {
  const indexOf = (point: MapPoint): number => {
    const col = Math.round((point.x - MIN_X) / STEP);
    const row = Math.round((point.z - MIN_Z) / STEP);
    return Math.max(0, Math.min(ROWS - 1, row)) * COLS + Math.max(0, Math.min(COLS - 1, col));
  };
  const accessible = (index: number): boolean => {
    const point = coordinates(index);
    return !pointBlocked(point.x, point.z, blockers, CLEARANCE);
  };
  const findOpen = (point: MapPoint): number => {
    const original = indexOf(point);
    if (accessible(original)) return original;
    for (let radius = 1; radius <= 5; radius += 1) {
      const origin = coordinates(original);
      const centerX = Math.round((origin.x - MIN_X) / STEP);
      const centerZ = Math.round((origin.z - MIN_Z) / STEP);
      for (let dz = -radius; dz <= radius; dz += 1) for (let dx = -radius; dx <= radius; dx += 1) {
        const x = centerX + dx;
        const z = centerZ + dz;
        if (x < 0 || x >= COLS || z < 0 || z >= ROWS) continue;
        const cell = z * COLS + x;
        if (accessible(cell)) return cell;
      }
    }
    return -1;
  };

  const origin = findOpen(start);
  const destination = findOpen(goal);
  if (origin === -1 || destination === -1) return [];
  const previous = new Int32Array(COLS * ROWS).fill(-1);
  const queue = new Int32Array(COLS * ROWS);
  let head = 0;
  let tail = 0;
  queue[tail++] = origin;
  previous[origin] = origin;
  while (head < tail && previous[destination] === -1) {
    const current = queue[head++];
    const col = current % COLS;
    const row = Math.floor(current / COLS);
    const around = [
      col > 0 ? current - 1 : -1,
      col < COLS - 1 ? current + 1 : -1,
      row > 0 ? current - COLS : -1,
      row < ROWS - 1 ? current + COLS : -1,
    ];
    for (const candidate of around) {
      if (candidate < 0 || previous[candidate] !== -1 || !accessible(candidate)) continue;
      const from = coordinates(current);
      const to = coordinates(candidate);
      if (segmentBlocked(from.x, from.z, to.x, to.z, blockers, CLEARANCE)) continue;
      previous[candidate] = current;
      queue[tail++] = candidate;
    }
  }
  if (previous[destination] === -1) return [];
  const cells: MapPoint[] = [];
  for (let cursor = destination; cursor !== origin; cursor = previous[cursor]) cells.push(coordinates(cursor));
  cells.push(coordinates(origin));
  cells.reverse();
  const points = [start, ...cells, goal];
  const visible: MapPoint[] = [points[0]];
  for (let cursor = 0; cursor < points.length - 1;) {
    let furthest = cursor + 1;
    for (let candidate = cursor + 2; candidate < points.length; candidate += 1) {
      if (segmentBlocked(points[cursor].x, points[cursor].z, points[candidate].x, points[candidate].z, blockers, CLEARANCE)) break;
      furthest = candidate;
    }
    visible.push(points[furthest]);
    cursor = furthest;
  }
  return visible;
}
