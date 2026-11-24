'use client';

import { useEffect } from 'react';
import { renewDeviceProof } from '@/lib/device-renew';

const EVERY_MS = 5 * 60_000; // الإثبات صالح 15 دقيقة، نجدده كل 5 دقائق

/** يجدّد إثبات الجهاز تلقائيًا أثناء استخدام المنصة (مثلًا أثناء مشاهدة محاضرة طويلة). */
export function DeviceKeepAlive() {
  useEffect(() => {
    let last = Date.now();
    const run = () => {
      last = Date.now();
      renewDeviceProof().catch(() => {});
    };
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') run();
    }, EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - last > EVERY_MS) run();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return null;
}
