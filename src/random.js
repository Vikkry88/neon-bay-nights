// Neon Bay Nights — random.js
// One job: deterministic randomness and small math helpers.
(function () {
  'use strict';

  const NBN = window.NBN;

  // Mulberry32 — a tiny seeded PRNG so the city layout is stable per seed.
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rng = makeRng(20261118);

  function rand(a, b) {
    return a + rng() * (b - a);
  }
  function randInt(a, b) {
    return Math.floor(rand(a, b + 1));
  }
  function pick(arr) {
    return arr[Math.floor(rng() * arr.length)];
  }
  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }
  function angleTo(ax, ay, bx, by) {
    return Math.atan2(by - ay, bx - ax);
  }
  function angleDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
  function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  NBN.rng = rng;
  NBN.rand = rand;
  NBN.randInt = randInt;
  NBN.pick = pick;
  NBN.clamp = clamp;
  NBN.lerp = lerp;
  NBN.dist = dist;
  NBN.angleTo = angleTo;
  NBN.angleDiff = angleDiff;
  NBN.wrapAngle = wrapAngle;
})();
