/** Deterministic PRNG so mock data is stable between reloads (mulberry32). */
export function rng(seed = 7) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  next.int = (min, max) => min + Math.floor(next() * (max - min + 1))
  next.pick = (arr) => arr[Math.floor(next() * arr.length)]
  next.chance = (p) => next() < p
  return next
}
export const uid = (prefix, n) => `${prefix}_${String(n).padStart(4, '0')}`
