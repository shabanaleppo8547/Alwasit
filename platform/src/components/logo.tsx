export function LogoMark({ className = 'h-10 w-10' }: { className?: string }) {
  // الحرف "و" داخل إطار: رمز "الوسيط" مع نقطة كهرمانية كنقطة تقاطع بين طرفين.
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="2" y="2" width="44" height="44" rx="13" fill="var(--color-brand)" />
      <path d="M6 34 L42 14" stroke="rgb(255 255 255 / 0.14)" strokeWidth="1.5" />
      <text
        x="24"
        y="31"
        textAnchor="middle"
        fontSize="26"
        fontWeight="700"
        fill="#fff"
        fontFamily="IBM Plex Sans Arabic, sans-serif"
      >
        و
      </text>
      <circle cx="35.5" cy="12.5" r="4" fill="var(--color-amber)" />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="leading-tight">
        <span className={`block text-lg font-bold ${light ? 'text-white' : 'text-ink'}`}>مركز الوسيط</span>
        <span className={`block text-[11px] font-medium ${light ? 'text-white/60' : 'text-ink-soft'}`}>
          منصة المحاضرات الجامعية
        </span>
      </span>
    </span>
  );
}
