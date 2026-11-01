// Gamdom Crash: the verifier Gamdom publishes, ported to Node with no dependencies.
//
// Source: verifier/sandbox-4nl2fc/math.js, the CodeSandbox that gamdom.com/help/fair
// links as "the sample code to generate games hashes and calculate Crash results".
// The port changes two things only:
//   - crypto-js HmacSHA256 / SHA256 become node:crypto calls with the same inputs
//   - `var` becomes `const` / `let`
// The salt, the instant-bust test divisible(hash, 100), the 52-bit slice, the /50 term
// and the floor to two decimals are the published code, unchanged.
//
// crypto-js is called as HmacSHA256(message, key). math.js calls HmacSHA256(salt, serverSeed),
// so the salt is the MESSAGE and the game hash is the KEY. The port keeps that order.
import crypto from "node:crypto";

export const SALT =
  "000000000000000007a9a31ff7f07463d91af6b5454241d5faf282e5e0fe1b3a";
export const MOD = 100;

export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// math.js divisible(): the whole 256-bit HMAC output reduced mod 100, 16 bits at a time.
export function divisible(hash, mod) {
  let val = 0;
  const o = hash.length % 4;
  for (let i = o > 0 ? o - 4 : 0; i < hash.length; i += 4) {
    val = ((val << 16) + parseInt(hash.substring(i, i + 4), 16)) % mod;
  }
  return val === 0;
}

// math.js crashPointFromHash(): returns the two-decimal string the verifier displays.
export function crashPointFromHash(serverSeed) {
  const hash = crypto.createHmac("sha256", serverSeed).update(SALT).digest("hex");
  if (divisible(hash, MOD)) return (1.0).toFixed(2);
  const h = parseInt(hash.slice(0, 52 / 4), 16);
  const e = Math.pow(2, 52);
  return (Math.floor(((e - h / 50) / (e - h)) * 100) / 100).toFixed(2);
}

// The same result as an integer number of hundredths (643 = 6.43x). Comparisons with a
// cash-out target are made on this integer, never on the float.
export function crashHundredthsFromHash(serverSeed) {
  const hash = crypto.createHmac("sha256", serverSeed).update(SALT).digest("hex");
  if (divisible(hash, MOD)) return 100;
  const h = parseInt(hash.slice(0, 52 / 4), 16);
  const e = Math.pow(2, 52);
  return Math.floor(((e - h / 50) / (e - h)) * 100);
}

// math.js getPreviousHash(): the hash of the previous game is SHA-256 of this game's hash
// (of its 64-character hex string, as crypto-js hashes a string).
export const previousHash = (gameHash) => sha256(gameHash);

// math.js getPreviousResults(): the list the verifier shows for a pasted hash.
export function getPreviousResults(gameHash, count) {
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push({ hash: gameHash, result: crashPointFromHash(gameHash) });
    gameHash = previousHash(gameHash);
  }
  return results;
}

// "1.50" or 1.5 -> 150, without float rounding surprises.
export function toHundredths(x) {
  const s = String(x).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error(`not a 2-decimal multiplier: ${x}`);
  const [i, f = ""] = s.split(".");
  return Number(i) * 100 + Number((f + "00").slice(0, 2));
}

export const fmtHundredths = (h) => (h / 100).toFixed(2);
