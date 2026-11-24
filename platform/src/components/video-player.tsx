'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * مشغّل الفيديو: المصدر مسار بث محمي على الخادم (لا رابط مباشر).
 * العلامة المائية المتحركة تحمل بيانات الطالب لردع تسجيل الشاشة ونشره.
 * الحماية الحقيقية من النسخ تأتي لاحقًا بتشفير DRM (انظر docs/ROADMAP.md).
 */
export function VideoPlayer({ src, watermark }: { src: string; watermark: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [pos, setPos] = useState({ top: 12, left: 10 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setPos({ top: 8 + Math.random() * 74, left: 4 + Math.random() * 60 });
    }, 7000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black shadow-xl ring-1 ring-ink/10" onContextMenu={(e) => e.preventDefault()}>
      <video
        ref={ref}
        className="aspect-video w-full bg-black"
        src={src}
        controls
        playsInline
        preload="metadata"
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        onError={() =>
          setError('تعذّر تشغيل الفيديو. تحقّق من اتصالك، أو أعد تحميل الصفحة. إذا انتهى اشتراكك فلن يعمل الفيديو.')
        }
      />
      <span
        aria-hidden
        className="pointer-events-none absolute select-none whitespace-nowrap rounded bg-black/20 px-2 py-0.5 text-[11px] font-medium text-white/45 transition-all duration-[2000ms]"
        style={{ top: `${pos.top}%`, left: `${pos.left}%` }}
        dir="ltr"
      >
        {watermark}
      </span>
      {error && (
        <div role="alert" className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-sm text-white">
          {error}
        </div>
      )}
    </div>
  );
}
