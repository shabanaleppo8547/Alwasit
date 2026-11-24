'use client';

import { DEVICE_PROOF_PREFIX, type ProofPurpose } from './device-proof';

// مفتاح الجهاز في المتصفح: ECDSA P-256 غير قابل للتصدير، محفوظ في IndexedDB.
// لا يستطيع أي سكربت قراءة المفتاح الخاص، فقط استخدامه للتوقيع من نفس الموقع.

const DB = 'alwasit-device';
const STORE = 'keys';
const KEY = 'device-key-v1';

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function b64url(buf: ArrayBuffer): string {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

type Stored = { keyPair: CryptoKeyPair; publicKey: string };

export class DeviceKeyError extends Error {}

/** يعيد مفتاح هذا الجهاز، أو ينشئه إن لم يوجد (create = true). */
async function getKey(create: boolean): Promise<Stored | null> {
  if (typeof indexedDB === 'undefined' || !crypto?.subtle) {
    throw new DeviceKeyError('متصفحك لا يدعم حماية الحساب. استخدم Chrome أو Safari حديثًا، وليس وضع التصفح الخفي.');
  }
  const existing = await idbGet<Stored>(KEY);
  if (existing?.keyPair?.privateKey) return existing;
  if (!create) return null;
  const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const stored = { keyPair, publicKey: b64url(spki) };
  await idbPut(KEY, stored);
  // نطلب من المتصفح عدم حذف التخزين تلقائيًا.
  navigator.storage?.persist?.().catch(() => {});
  return stored;
}

export async function hasDeviceKey(): Promise<boolean> {
  try {
    return Boolean(await getKey(false));
  } catch {
    return false;
  }
}

/** يوقّع تحديًا من الخادم ويعيد حقول الإثبات. */
export async function signChallenge(challenge: string, purpose: ProofPurpose, create = true) {
  const key = await getKey(create);
  if (!key) throw new DeviceKeyError('لا يوجد مفتاح جهاز في هذا المتصفح.');
  const data = new TextEncoder().encode(`${DEVICE_PROOF_PREFIX}|${purpose}|${challenge}`);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key.keyPair.privateKey, data);
  return { devicePublicKey: key.publicKey, deviceChallenge: challenge, deviceSignature: b64url(sig) };
}
