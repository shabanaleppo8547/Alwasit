import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// scrypt مدمج في Node (لا مكتبات أصلية)، بمعاملات توصي بها OWASP.
const N = 2 ** 15;
const r = 8;
const p = 1;
const KEYLEN = 64;

function scrypt(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password.normalize('NFKC'), salt, KEYLEN, { ...opts, maxmem: 128 * N * r * 2 }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, { N, r, p });
  return ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, rr, pp, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), {
    N: Number(n),
    r: Number(rr),
    p: Number(pp),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** بصمة تُستخدم لمقارنة وقت ثابت عند عدم وجود المستخدم (تمنع كشف البريدات المسجلة بالتوقيت). */
export const DUMMY_HASH =
  'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(KEYLEN).toString('base64');
