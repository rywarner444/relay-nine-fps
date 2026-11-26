/** Pure mission progression. All intelligence and threats here are fictional, scripted gameplay. */

export interface MissionDefinition {
  number: string;
  name: string;
  codename: string;
  briefing: string;
  lesson: string;
}

export const MISSIONS: readonly MissionDefinition[] = [
  {
    number: '01', name: 'PERIMETER BREACH', codename: 'IDENTIFY / CONTAIN',
    briefing: 'Rogue processes have entered Relay Nine. Destroy four magenta threats. The amber maintenance drone is friendly—leave it alone.',
    lesson: 'Threat classification: precision matters more than firing blindly.',
  },
  {
    number: '02', name: 'SIGNAL TRACE', codename: 'INVESTIGATE / VERIFY',
    briefing: 'Follow three tall violet evidence beacons. Get close and press E to collect each signal fragment. Guards are optional to eliminate.',
    lesson: 'Investigation: retrieve evidence before taking action.',
  },
  {
    number: '03', name: 'GHOST PROTOCOL', codename: 'DISRUPT / RECOVER',
    briefing: 'Shoot three red security locks to break the rogue AI shield. Then defeat its large sentinel drone to recover the facility.',
    lesson: 'Incident response: disable defenses, isolate the threat, restore control.',
  },
];

export interface CampaignState {
  mission: number;
  completed: string[];
}

export type MissionEvent =
  | { type: 'elimination'; id: string }
  | { type: 'evidence'; id: string }
  | { type: 'lock'; id: string }
  | { type: 'sentinel'; id: string };

const missionTargets: readonly (readonly string[])[] = [
  ['I-01', 'I-02', 'I-03', 'I-04'],
  ['TRACE-A', 'TRACE-B', 'TRACE-C'],
  ['LOCK-A', 'LOCK-B', 'LOCK-C', 'SENTINEL'],
];

export function startMission(mission: number): CampaignState {
  if (!Number.isInteger(mission) || mission < 0 || mission >= MISSIONS.length) throw new RangeError('Unknown mission');
  return { mission, completed: [] };
}

export function recordMissionEvent(previous: CampaignState, event: MissionEvent): CampaignState {
  const matchingType = ['elimination', 'evidence', 'lock', 'sentinel'][previous.mission];
  const targetIds = missionTargets[previous.mission];
  const allowed = event.type === matchingType || (previous.mission === 2 && event.type === 'sentinel');
  if (!allowed || !targetIds.includes(event.id) || previous.completed.includes(event.id)) return previous;
  // Sentinel must be unlocked after all three security locks are disabled.
  if (event.type === 'sentinel' && !['LOCK-A', 'LOCK-B', 'LOCK-C'].every((id) => previous.completed.includes(id))) return previous;
  return { ...previous, completed: [...previous.completed, event.id] };
}

export function missionProgress(state: CampaignState): { current: number; total: number; complete: boolean; label: string; title: string; hint: string } {
  const total = missionTargets[state.mission].length;
  const current = state.completed.length;
  if (state.mission === 0) return {
    current, total, complete: current === total, label: 'HOSTILES CONTAINED',
    title: 'Identify and contain', hint: 'Shoot 4 magenta drones. Do not shoot the amber maintenance unit.',
  };
  if (state.mission === 1) return {
    current, total, complete: current === total, label: 'EVIDENCE RECOVERED',
    title: 'Trace the signal', hint: 'Find the tall violet beacons. Move close and press E to scan.',
  };
  const unlocked = ['LOCK-A', 'LOCK-B', 'LOCK-C'].every((id) => state.completed.includes(id));
  return {
    current, total, complete: current === total, label: 'CORE SECURITY DISABLED',
    title: unlocked ? 'Eliminate the AI sentinel' : 'Break the AI security locks',
    hint: unlocked ? 'Find the large crimson sentinel and shoot until destroyed.' : 'Shoot the 3 glowing red locks around the reactor.',
  };
}
