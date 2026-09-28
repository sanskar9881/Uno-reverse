import type { CardColor } from '@shared';

export const COLOR_NAMES: Record<CardColor, string> = { red: 'red', yellow: 'yellow', green: 'green', blue: 'blue' };

export const COLOR_HEX: Record<CardColor | 'wild', string> = {
  red: '#F2474D',
  yellow: '#FFC53D',
  green: '#22C58B',
  blue: '#3D8BFF',
  wild: '#17122B',
};

export function roomLink(code: string): string {
  return `${window.location.origin}/room/${code}`;
}

export function inviteMessage(code: string): string {
  return `Join my UNO Party game! Room code: ${code}\n${roomLink(code)}`;
}

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
