import { sameNickname } from '@shared';

/** True when `candidate` matches one of `names`, once normalized and compared without regard to case. */
export function isDuplicateName(names: string[], candidate: string): boolean {
  return names.some((n) => sameNickname(n, candidate));
}
