import 'server-only';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

/**
 * طبقة مزوّد الفيديو. الواجهة لا ترى إلا /api/stream/<id>،
 * والخادم يقرّر المصدر بعد التحقق من الصلاحية.
 *
 * المزوّدات الحالية:
 *  - local:<file>  ملف داخل private-media (المحتوى التجريبي)
 *  - https://...   رابط خاص يُمرَّر عبر الخادم مع دعم Range (المصدر لا يصل للطالب)
 * لاحقًا (انظر docs/ROADMAP.md): Bunny Stream / Mux / Cloudflare Stream بروابط موقّعة
 * قصيرة العمر وتشفير Widevine/FairPlay، وعندها يعيد هذا الملف رابط تشغيل موقّعًا بدل التمرير.
 */

const MEDIA_DIR = path.join(process.cwd(), 'private-media');

export function describeVideoRef(ref: string | null): 'local' | 'remote' | 'none' | 'invalid' {
  if (!ref) return 'none';
  if (ref.startsWith('local:')) return 'local';
  if (/^https:\/\//i.test(ref)) return 'remote';
  return 'invalid';
}

export function validateVideoRef(ref: string): string | null {
  const v = ref.trim();
  if (!v) return null;
  if (v.startsWith('local:')) {
    if (!/^local:[\w.-]+\.(mp4|webm)$/.test(v)) return 'اسم الملف المحلي غير صالح.';
    return null;
  }
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:') return 'يجب أن يبدأ رابط الفيديو بـ https://';
  } catch {
    return 'رابط الفيديو غير صالح.';
  }
  return null;
}

const baseHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
  'Content-Disposition': 'inline',
  'Accept-Ranges': 'bytes',
};

function parseRange(header: string | null, size: number): { start: number; end: number } | null | 'invalid' {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return 'invalid';
  let start: number;
  let end: number;
  if (m[1] === '') {
    const suffix = Number(m[2]);
    if (!suffix) return 'invalid';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return 'invalid';
  return { start, end };
}

async function streamLocal(file: string, rangeHeader: string | null): Promise<Response> {
  const safe = path.basename(file);
  const full = path.join(MEDIA_DIR, safe);
  let size: number;
  try {
    size = (await stat(full)).size;
  } catch {
    return new Response('الملف غير موجود', { status: 404 });
  }
  const type = safe.endsWith('.webm') ? 'video/webm' : 'video/mp4';
  const range = parseRange(rangeHeader, size);
  if (range === 'invalid') {
    return new Response(null, { status: 416, headers: { ...baseHeaders, 'Content-Range': `bytes */${size}` } });
  }
  const { start, end } = range ?? { start: 0, end: size - 1 };
  const body = Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream;
  return new Response(body, {
    status: range ? 206 : 200,
    headers: {
      ...baseHeaders,
      'Content-Type': type,
      'Content-Length': String(end - start + 1),
      ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
    },
  });
}

async function streamRemote(url: string, rangeHeader: string | null): Promise<Response> {
  const upstream = await fetch(url, { headers: rangeHeader ? { Range: rangeHeader } : {}, cache: 'no-store' });
  if (!upstream.ok && upstream.status !== 206) {
    return new Response('تعذر الوصول إلى مصدر الفيديو', { status: 502 });
  }
  const headers: Record<string, string> = { ...baseHeaders };
  for (const h of ['content-type', 'content-length', 'content-range']) {
    const v = upstream.headers.get(h);
    if (v) headers[h] = v;
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

export async function streamVideo(ref: string, rangeHeader: string | null): Promise<Response> {
  switch (describeVideoRef(ref)) {
    case 'local':
      return streamLocal(ref.slice('local:'.length), rangeHeader);
    case 'remote':
      return streamRemote(ref, rangeHeader);
    default:
      return new Response('لا يوجد فيديو لهذه المحاضرة بعد', { status: 404 });
  }
}
