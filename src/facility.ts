/** Authored level layout shared by collisions, visuals, navigation, and tactical minimap. */
import type { Blocker } from './simulation';

export interface FacilityWall extends Blocker { id: string; }

export const FACILITY_HALF_WIDTH = 43;
export const FACILITY_HALF_DEPTH = 54;
export const FACILITY_START = { x: 0, z: 42 } as const;

// Gaps in the partition walls are real openings: two side-wing doors, a middle
// cross-connection, and the northern vault. Keep this single geometry source.
export const FACILITY_WALLS: readonly FacilityWall[] = [
  ...[-14, 14].flatMap((x) => [
    { id: `partition-${x}-south`, x, z: 32.5, halfWidth: 0.42, halfDepth: 12.5 },
    { id: `partition-${x}-mid`, x, z: -0.5, halfWidth: 0.42, halfDepth: 8.5 },
    { id: `partition-${x}-north`, x, z: -33, halfWidth: 0.42, halfDepth: 12 },
  ]),
  { id: 'left-cross-west', x: -35.5, z: 0, halfWidth: 3.5, halfDepth: 0.46 },
  { id: 'left-cross-east', x: -17, z: 0, halfWidth: 3, halfDepth: 0.46 },
  { id: 'right-cross-west', x: 17, z: 0, halfWidth: 3, halfDepth: 0.46 },
  { id: 'right-cross-east', x: 35.5, z: 0, halfWidth: 3.5, halfDepth: 0.46 },
  { id: 'vault-left', x: -28.5, z: -34, halfWidth: 14.5, halfDepth: 0.5 },
  { id: 'vault-right', x: 28.5, z: -34, halfWidth: 14.5, halfDepth: 0.5 },
];

export const VAULT_DOOR: FacilityWall = { id: 'vault-shutter', x: 0, z: -34, halfWidth: 13.5, halfDepth: 0.5 };

export const FACILITY_DOORWAYS = [
  { x: -14, z: 14, axis: 'x' }, { x: 14, z: 14, axis: 'x' },
  { x: -14, z: -15, axis: 'x' }, { x: 14, z: -15, axis: 'x' },
  { x: -26, z: 0, axis: 'z' }, { x: 26, z: 0, axis: 'z' },
  { x: 0, z: -34, axis: 'z' },
] as const;
