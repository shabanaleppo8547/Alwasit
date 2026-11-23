// صلاحيات الإدارة: كلمة مرور واحدة محفوظة في Vercel (ADMIN_PASSWORD)،
// وعند الدخول يحصل الهاتف على رمز موقّع صالح 30 يومًا.
// تغيير كلمة المرور في Vercel يُلغي كل الرموز القديمة فورًا.

import crypto from 'node:crypto';
import { HttpError, clientIp } from './http.js';
import { backend } from './store.js';

const TOKEN_DAYS = 30;
const MAX_FAILS = 10;
const FAIL_WINDOW_SECONDS = 15 * 60;

function adminPassword() {
  const p = process.env.ADMIN_PASSWORD;
  if (!p || p.length < 6) {
    throw new HttpError(503, 'لم تُضبط كلمة مرور الإدارة على الخادم (ADMIN_PASSWORD).');
  }
  return p;
}

function signingKey() {
  return crypto.createHash('sha256').update(`alwasit-session:${adminPassword()}`).digest();
}

function sign(payload) {
  return crypto.createHmac('sha256', signingKey()).update(payload).digest('hex');
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) {
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

export async function login(req, password) {
  const real = adminPassword();
  const store = backend();
  const failKey = `alwasit:fail:${clientIp(req)}`;
  const fails = await store.incrWithTtl(failKey, FAIL_WINDOW_SECONDS);
  if (fails > MAX_FAILS) {
    throw new HttpError(429, 'محاولات كثيرة. انتظر ربع ساعة ثم حاول مجددًا.');
  }
  if (typeof password !== 'string' || !safeEqual(password, real)) {
    throw new HttpError(401, 'كلمة المرور غير صحيحة.');
  }
  await store.del(failKey);
  const exp = Date.now() + TOKEN_DAYS * 24 * 60 * 60 * 1000;
  return { token: `${exp}.${sign(String(exp))}`, expiresAt: new Date(exp).toISOString() };
}

export function requireAdmin(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const token = String(header).replace(/^Bearer\s+/i, '').trim();
  const [expText, mac] = token.split('.');
  const exp = Number(expText);
  if (!expText || !mac || !Number.isFinite(exp) || !safeEqual(mac, sign(expText))) {
    throw new HttpError(401, 'انتهت جلسة الدخول. سجّل الدخول مجددًا.');
  }
  if (Date.now() > exp) {
    throw new HttpError(401, 'انتهت جلسة الدخول. سجّل الدخول مجددًا.');
  }
}
