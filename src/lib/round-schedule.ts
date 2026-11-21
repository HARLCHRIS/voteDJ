import type { RoundName, RoundScheduleInfo } from '@/types';

const ROUND_SCHEDULES: Partial<Record<RoundName, RoundScheduleInfo>> = {
  'Prime 2': {
    dateLabel: 'Samedi 28 novembre',
    shortDateLabel: 'SAM. 28 NOV.',
    venueLabel: 'Zone 5',
  },
};

/**
 * Retourne les informations officielles de date et de lieu d'une prime à venir
 * lorsqu'elles sont définies (ex. Prime 2 au Zone 5).
 */
export function getRoundSchedule(roundName: string): RoundScheduleInfo | null {
  if (roundName === 'Prime 1' || roundName === 'Prime 2') {
    return ROUND_SCHEDULES[roundName] ?? null;
  }
  return null;
}

