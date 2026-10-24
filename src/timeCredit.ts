/** Product time-credit rules. The API must supply its own trusted clock and
 * apply these rules atomically after deduplicating the contribution batch. */
export type TimeCredit = Readonly<{
  expiresAtMs: number;
  secondsCreditedTotal: number;
}>;

function nonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} must be a non-negative safe integer`);
}

export function remainingTimeMs(credit: TimeCredit | null, nowMs: number): number {
  nonNegativeInteger(nowMs, 'nowMs');
  if (credit === null) return 0;
  nonNegativeInteger(credit.expiresAtMs, 'expiresAtMs');
  return Math.max(0, credit.expiresAtMs - nowMs);
}

export function addTimeCredit(credit: TimeCredit | null, tapCount: number, nowMs: number): TimeCredit {
  nonNegativeInteger(nowMs, 'nowMs');
  nonNegativeInteger(tapCount, 'tapCount');
  if (tapCount === 0) throw new RangeError('tapCount must be positive');
  const previousTotal = credit?.secondsCreditedTotal ?? 0;
  nonNegativeInteger(previousTotal, 'secondsCreditedTotal');
  const expiresAtMs = nowMs + remainingTimeMs(credit, nowMs) + tapCount * 1000;
  const secondsCreditedTotal = previousTotal + tapCount;
  nonNegativeInteger(expiresAtMs, 'expiresAtMs');
  nonNegativeInteger(secondsCreditedTotal, 'secondsCreditedTotal');
  return { expiresAtMs, secondsCreditedTotal };
}

export function creditSelectedTag(
  balances: Readonly<Record<string, TimeCredit>>,
  selectedTag: string | null,
  tapCount: number,
  nowMs: number
): Readonly<Record<string, TimeCredit>> {
  if (selectedTag === null) return balances;
  const previous = Object.hasOwn(balances, selectedTag) ? balances[selectedTag] : null;
  return { ...balances, [selectedTag]: addTimeCredit(previous, tapCount, nowMs) };
}
