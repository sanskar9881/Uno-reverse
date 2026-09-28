/** A uniform random index in [0, n), using rejection sampling to avoid modulo bias. */
export function randomIndex(n: number): number {
  if (n <= 0) throw new Error('n must be positive');
  if (n === 1) return 0;
  const range = 0x100000000; // 2^32
  const limit = range - (range % n);
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % n;
}
