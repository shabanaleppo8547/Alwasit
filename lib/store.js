// التخزين: Upstash Redis عبر واجهة REST (بدون مكتبات خارجية).
// المتغيرات تُضاف تلقائيًا من Vercel عند ربط قاعدة Redis بالمشروع.

import { HttpError } from './http.js';

const DB_KEY = 'alwasit:db';
const VER_KEY = 'alwasit:ver';
const HISTORY_KEY = 'alwasit:history';

// كتابة ذرّية: لا تُكتب البيانات إلا إذا لم يعدّلها أحد في نفس اللحظة،
// مع حفظ النسخة السابقة في سجل (آخر 50 نسخة) للاسترجاع عند الخطأ.
const CAS_SCRIPT = `
local v = redis.call('GET', KEYS[2])
if (v or '0') ~= ARGV[1] then return 0 end
local old = redis.call('GET', KEYS[1])
if old then
  redis.call('LPUSH', KEYS[3], old)
  redis.call('LTRIM', KEYS[3], 0, 49)
end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], ARGV[3])
return 1
`;

function config() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return { url: url.replace(/\/+$/, ''), token };
  return null;
}

async function redis(command) {
  const cfg = config();
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(`Redis error: ${data.error || res.status}`);
  }
  return data.result;
}

// ذاكرة مؤقتة للاختبار المحلي فقط (لا تُستخدم على Vercel).
const memory = { values: new Map(), lists: new Map() };

const memoryBackend = {
  async read() {
    return {
      raw: memory.values.get(DB_KEY) ?? null,
      version: memory.values.get(VER_KEY) ?? '0',
    };
  },
  async compareAndSet(expected, raw, next) {
    if ((memory.values.get(VER_KEY) ?? '0') !== expected) return false;
    const old = memory.values.get(DB_KEY);
    if (old) memory.lists.set(HISTORY_KEY, [old, ...(memory.lists.get(HISTORY_KEY) ?? [])].slice(0, 50));
    memory.values.set(DB_KEY, raw);
    memory.values.set(VER_KEY, next);
    return true;
  },
  async incrWithTtl(key, ttl) {
    const v = (memory.values.get(key) ?? 0) + 1;
    memory.values.set(key, v);
    return v;
  },
  async del(key) {
    memory.values.delete(key);
  },
  _reset() {
    memory.values.clear();
    memory.lists.clear();
  },
};

const redisBackend = {
  async read() {
    const [raw, version] = await redis(['MGET', DB_KEY, VER_KEY]);
    return { raw: raw ?? null, version: version ?? '0' };
  },
  async compareAndSet(expected, raw, next) {
    const r = await redis(['EVAL', CAS_SCRIPT, '3', DB_KEY, VER_KEY, HISTORY_KEY, expected, raw, next]);
    return Number(r) === 1;
  },
  async incrWithTtl(key, ttl) {
    const v = await redis(['INCR', key]);
    if (Number(v) === 1) await redis(['EXPIRE', key, String(ttl)]);
    return Number(v);
  },
  async del(key) {
    await redis(['DEL', key]);
  },
};

export function backend() {
  if (config()) return redisBackend;
  if (process.env.ALWASIT_MEMORY_STORE === '1') return memoryBackend;
  throw new HttpError(
    503,
    'قاعدة البيانات غير مربوطة بالخادم بعد. اربط Upstash Redis بالمشروع من Vercel ← Storage.',
  );
}

export const _memoryBackend = memoryBackend;
