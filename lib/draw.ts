// ---- Draw & prize logic (pure functions, easy to test) ----

// ASSUMPTION: 50% of every subscription fee (monthly equivalent) feeds the prize pool
export const POOL_PERCENT = 50;

// Pool split from the PRD
export const TIER_SHARE = { 5: 0.4, 4: 0.35, 3: 0.25 } as const;

export const round2 = (n: number) => Math.round(n * 100) / 100;
const floor2 = (n: number) => Math.floor(n * 100) / 100;

// Standard lottery-style draw: 5 distinct numbers between 1 and 45
export function randomNumbers(): number[] {
  const set = new Set<number>();
  while (set.size < 5) set.add(1 + Math.floor(Math.random() * 45));
  return [...set].sort((a, b) => a - b);
}

// Algorithmic draw: numbers that players score more often are more likely to be drawn
export function weightedNumbers(allScores: number[]): number[] {
  const weights: number[] = Array(46).fill(1);
  for (const s of allScores) if (s >= 1 && s <= 45) weights[s] += 3;

  const picked: number[] = [];
  while (picked.length < 5) {
    const pool: number[] = [];
    let total = 0;
    for (let n = 1; n <= 45; n++) {
      if (!picked.includes(n)) {
        pool.push(n);
        total += weights[n];
      }
    }
    let r = Math.random() * total;
    let chosen = pool[pool.length - 1]; // fallback
    for (const n of pool) {
      r -= weights[n];
      if (r <= 0) {
        chosen = n;
        break;
      }
    }
    picked.push(chosen);
  }
  return picked.sort((a, b) => a - b);
}

// How many of the player's numbers appear in the winning numbers
// (duplicate scores count once)
export function countMatches(userNumbers: number[], winning: number[]): number {
  const win = new Set(winning);
  return new Set(userNumbers).size === 0
    ? 0
    : [...new Set(userNumbers)].filter((n) => win.has(n)).length;
}

// Split the pool into tiers. The 5-match jackpot includes last month's rollover.
export function computePrizes(
  pool: number,
  carryIn: number,
  counts: Record<3 | 4 | 5, number>
) {
  const tier = {
    5: round2(pool * TIER_SHARE[5] + carryIn),
    4: round2(pool * TIER_SHARE[4]),
    3: round2(pool * TIER_SHARE[3]),
  };
  const perWinner = {
    5: counts[5] ? floor2(tier[5] / counts[5]) : 0,
    4: counts[4] ? floor2(tier[4] / counts[4]) : 0,
    3: counts[3] ? floor2(tier[3] / counts[3]) : 0,
  };
  return { tier, perWinner, jackpotRollsOver: counts[5] === 0 };
}