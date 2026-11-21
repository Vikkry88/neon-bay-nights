// Small seeded RNG so screenshots and tests are reproducible.
export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  function next() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  }
  return {
    next,
    range(a, b) { return a + next() * (b - a); },
    int(a, b) { return Math.floor(a + next() * (b - a + 1)); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    chance(p) { return next() < p; },
  };
}
export function seedFromUrl() {
  const q = new URLSearchParams(location.search);
  const v = parseInt(q.get('seed') || '1', 10);
  return Number.isFinite(v) ? v : 1;
}
