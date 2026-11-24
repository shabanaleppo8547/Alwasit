import 'server-only';
import { createPublicKey, verify } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import { db, schema } from './db';
import { newToken, sha256 } from './auth/tokens';
import { DEVICE_PROOF_PREFIX } from '@/lib/device-proof';

/**
 * إثبات امتلاك مفتاح الجهاز.
 *
 * كل جهاز يولّد زوج مفاتيح ECDSA P-256. المفتاح الخاص غير قابل للتصدير ولا يغادر الجهاز:
 *  - في الويب: WebCrypto (non-extractable) محفوظ في IndexedDB. حماية مؤقتة فقط: يمكن نسخه
 *    مع ملف تعريف المتصفح كاملًا، ويضيع عند مسح بيانات الموقع.
 *  - في التطبيق الأصلي لاحقًا: Android Keystore/StrongBox وiOS Secure Enclave مع
 *    Play Integrity / App Attest (انظر docs/DEVICE-BINDING.md). البروتوكول نفسه على الخادم.
 *
 * الخادم يصدر تحديًا عشوائيًا لمرة واحدة، والجهاز يوقّع عليه، والخادم يتحقق بالمفتاح العام المسجّل.
 */

export const PROOF_TTL_MS = 15 * 60_000; // عمر إثبات الجلسة القصير
const CHALLENGE_TTL_MS = 2 * 60_000;

export async function issueChallenge(): Promise<string> {
  const id = newToken(24);
  await db.insert(schema.deviceChallenges).values({ id, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) });
  // تنظيف التحديات المنتهية (رخيص، فهرسه المفتاح الأساسي).
  if (Math.random() < 0.05) {
    await db.delete(schema.deviceChallenges).where(lt(schema.deviceChallenges.expiresAt, new Date()));
  }
  return id;
}

/** يستهلك التحدي (مرة واحدة فقط). */
async function consumeChallenge(id: string): Promise<boolean> {
  const rows = await db
    .delete(schema.deviceChallenges)
    .where(and(eq(schema.deviceChallenges.id, id), gt(schema.deviceChallenges.expiresAt, new Date())))
    .returning({ id: schema.deviceChallenges.id });
  return rows.length === 1;
}

export type DeviceProof = { publicKey: string; challenge: string; signature: string };

export function parseProof(fd: FormData): DeviceProof | null {
  const publicKey = String(fd.get('devicePublicKey') ?? '');
  const challenge = String(fd.get('deviceChallenge') ?? '');
  const signature = String(fd.get('deviceSignature') ?? '');
  const b64url = /^[A-Za-z0-9_-]+$/;
  if (!b64url.test(publicKey) || publicKey.length > 400) return null;
  if (!b64url.test(challenge) || challenge.length > 100) return null;
  if (!b64url.test(signature) || signature.length > 200) return null;
  return { publicKey, challenge, signature };
}

export function keyIdOf(publicKey: string): string {
  return sha256(publicKey);
}

/** يتحقق من التوقيع ومن صلاحية التحدي. purpose يمنع إعادة استخدام توقيع في غرض آخر. */
export async function verifyProof(proof: DeviceProof, purpose: string): Promise<boolean> {
  let key;
  try {
    key = createPublicKey({ key: Buffer.from(proof.publicKey, 'base64url'), format: 'der', type: 'spki' });
  } catch {
    return false;
  }
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') return false;
  const message = Buffer.from(`${DEVICE_PROOF_PREFIX}|${purpose}|${proof.challenge}`);
  let ok = false;
  try {
    ok = verify('sha256', message, { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(proof.signature, 'base64url'));
  } catch {
    return false;
  }
  // نستهلك التحدي بعد التحقق من التوقيع، وفي كل الحالات الصحيحة فقط.
  return ok && (await consumeChallenge(proof.challenge));
}

/** وصف مقروء للجهاز من User-Agent (للعرض في لوحة الإدارة فقط، لا للتحقق). */
export function deviceLabel(ua: string): string {
  const os = /Android/i.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/i.test(ua)
      ? 'iPhone/iPad'
      : /Windows/i.test(ua)
        ? 'Windows'
        : /Mac OS X/i.test(ua)
          ? 'Mac'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'جهاز غير معروف';
  const browser = /alwasit-app/i.test(ua)
    ? 'تطبيق الوسيط'
    : /SamsungBrowser/i.test(ua)
      ? 'Samsung Internet'
      : /Edg\//.test(ua)
        ? 'Edge'
        : /OPR\/|Opera/.test(ua)
          ? 'Opera'
          : /Firefox\//.test(ua)
            ? 'Firefox'
            : /Chrome\//.test(ua)
              ? 'Chrome'
              : /Safari\//.test(ua)
                ? 'Safari'
                : 'متصفح';
  return `${browser} على ${os}`;
}

export function devicePlatformOf(ua: string): 'web' | 'android' | 'ios' {
  // التطبيق الأصلي سيعرّف نفسه بإثبات أصالة لاحقًا؛ حتى ذلك الحين كل شيء "web".
  void ua;
  return 'web';
}
