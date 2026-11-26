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
    briefing: 'Breach the southern checkpoint. Fight through the corridors and destroy four magenta threats. The amber maintenance drone is friendly.',
    lesson: 'Threat classification: precision matters more than firing blindly.',
  },
  {
    number: '02', name: 'SIGNAL TRACE', codename: 'INVESTIGATE / VERIFY',
    briefing: 'Navigate the east and west wings and reach three violet signal terminals. Press E to extract evidence while hostile patrols guard the halls.',
    lesson: 'Investigation: retrieve evidence before taking action.',
  },
  {
    number: '03', name: 'GHOST PROTOCOL', codename: 'DISRUPT / RECOVER',
    briefing: 'Disable three red security locks, breach the north vault, defeat the massive sentinel mech, then press E at the mainframe to shut it down.',
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
  | { type: 'sentinel'; id: string }
  | { type: 'shutdown'; id: string };

const missionTargets: readonly (readonly string[])[] = [
  ['I-01', 'I-02', 'I-03', 'I-04'],
  ['TRACE-A', 'TRACE-B', 'TRACE-C'],
  ['LOCK-A', 'LOCK-B', 'LOCK-C', 'SENTINEL', 'SHUTDOWN'],
];

export function startMission(mission: number): CampaignState {
  if (!Number.isInteger(mission) || mission < 0 || mission >= MISSIONS.length) throw new RangeError('Unknown mission');
  return { mission, completed: [] };
}

export function recordMissionEvent(previous: CampaignState, event: MissionEvent): CampaignState {
  const matchingType = ['elimination', 'evidence', 'lock', 'sentinel'][previous.mission];
  const targetIds = missionTargets[previous.mission];
  const allowed = event.type === matchingType || (previous.mission === 2 && ['sentinel', 'shutdown'].includes(event.type));
  if (!allowed || !targetIds.includes(event.id) || previous.completed.includes(event.id)) return previous;
  // Sentinel must be unlocked after all three security locks are disabled.
  if (event.type === 'sentinel' && !['LOCK-A', 'LOCK-B', 'LOCK-C'].every((id) => previous.completed.includes(id))) return previous;
  if (event.type === 'shutdown' && !previous.completed.includes('SENTINEL')) return previous;
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
  const bossDefeated = state.completed.includes('SENTINEL');
  return {
    current, total, complete: current === total, label: 'NETWORK RECOVERY',
    title: bossDefeated ? 'Shut down the rogue mainframe' : unlocked ? 'Eliminate the AI sentinel' : 'Break the AI security locks',
    hint: bossDefeated ? 'Reach the glowing green shutdown console in the north vault and press E.' : unlocked ? 'Enter the vault. Use cover and fire at the massive crimson mech.' : 'Fight through the halls and shoot all 3 red security locks.',
  };
}
