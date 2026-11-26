/** Pure checkpoint-safe mission progression; all threats and evidence are fictional. */

export interface MissionDefinition {
  number: string;
  name: string;
  codename: string;
  briefing: string;
  lesson: string;
  instructions: readonly string[];
}

export const MISSIONS: readonly MissionDefinition[] = [
  {
    number: '01', name: 'BASE FLOOR', codename: 'RETRIEVE / RESTORE',
    briefing: 'Defeat the lime-marked carrier drones, collect all three green network fragments, then follow the dotted route on your radar to the upload computer.',
    lesson: 'Threat response: collect verified artifacts before restoring a service.',
    instructions: [
      'Fight through the base floor. The three drones with lime halos carry network fragments.',
      'When a carrier falls, approach its green drop and press E when the pickup prompt appears.',
      'After collecting all three, follow the dotted lime route on your minimap to the computer. Press E to insert them.',
    ],
  },
  {
    number: '02', name: 'SIGNAL FOUNDRY', codename: 'HOLD / CAPTURE',
    briefing: 'Secure three uplink towers across the foundry. Stand inside each violet capture ring until it reaches 100%. Fight off incoming drone patrols while you hold the zone.',
    lesson: 'Resilience engineering: maintain control of infrastructure under pressure.',
    instructions: [
      'Navigate the foundry and locate an active purple uplink tower.',
      'Step into its floor ring. Stay inside for nine seconds while defending yourself.',
      'The tower and ring vanish at 100%. Repeat at the remaining two towers.',
    ],
  },
  {
    number: '03', name: 'SENTINEL ARENA', codename: 'SURVIVE / DEFEAT',
    briefing: 'One final objective: defeat the giant mobile sentinel. It has heavy armor, powerful missiles, and summons reinforcement drones. Keep moving and use the arena cover.',
    lesson: 'Adversarial systems: manage a high-priority threat while handling reinforcements.',
    instructions: [
      'Your only objective is to destroy the giant Sentinel mech.',
      'Watch its red armor bar. Move, sprint, slide, and reload behind cover.',
      'Drones reinforce the boss. Destroying the mech unlocks your victory achievement.',
    ],
  },
];

export interface CampaignState { mission: number; completed: string[]; }

export type MissionEvent =
  | { type: 'fragment'; id: string }
  | { type: 'upload'; id: 'UPLOAD' }
  | { type: 'charged'; id: string }
  | { type: 'boss'; id: 'SENTINEL' };

const REQUIRED: readonly (readonly string[])[] = [
  ['FRAG-A', 'FRAG-B', 'FRAG-C', 'UPLOAD'],
  ['TRACE-A', 'TRACE-B', 'TRACE-C'],
  ['SENTINEL'],
];

export function startMission(mission: number): CampaignState {
  if (!Number.isInteger(mission) || mission < 0 || mission >= MISSIONS.length) throw new RangeError('Unknown mission');
  return { mission, completed: [] };
}

export function recordMissionEvent(previous: CampaignState, event: MissionEvent): CampaignState {
  const allowedTypes = previous.mission === 0 ? ['fragment', 'upload'] : previous.mission === 1 ? ['charged'] : ['boss'];
  if (!allowedTypes.includes(event.type) || !REQUIRED[previous.mission].includes(event.id) || previous.completed.includes(event.id)) return previous;
  if (event.type === 'upload' && !['FRAG-A', 'FRAG-B', 'FRAG-C'].every((id) => previous.completed.includes(id))) return previous;
  return { ...previous, completed: [...previous.completed, event.id] };
}

export function missionProgress(state: CampaignState): { current: number; total: number; complete: boolean; label: string; title: string; hint: string } {
  const total = REQUIRED[state.mission].length;
  const current = state.completed.length;
  if (state.mission === 0) {
    const collected = ['FRAG-A', 'FRAG-B', 'FRAG-C'].every((id) => state.completed.includes(id));
    return {
      current, total, complete: current === total,
      label: collected ? '3 FRAGMENTS SECURED · UPLOAD PENDING' : 'FRAGMENT RECOVERY · 3 REQUIRED',
      title: collected ? 'Reach the upload computer' : 'Recover three network fragments',
      hint: collected ? 'All 3 fragments secured. Follow the dotted LIME route on your minimap to the computer, then press E when prompted.'
        : 'Find the three drones with LIME halos. Shoot them, approach their green drops, and press E when the PICK UP prompt appears.',
    };
  }
  if (state.mission === 1) return {
    current, total, complete: current === total, label: 'UPLINKS SECURED',
    title: 'Hold the signal towers',
    hint: 'Stand inside a purple capture radius until the charge reaches 100%. Defend yourself!',
  };
  return {
    current, total, complete: current === total, label: 'FINAL ENCOUNTER',
    title: 'Defeat the Sentinel',
    hint: 'Damage the moving mech while dodging missiles and reinforcement drones.',
  };
}

export const CHECKPOINT_KEY = 'relay-nine-unlocked-level';

export function safeCheckpoint(value: unknown): number {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number < MISSIONS.length ? number : 0;
}
