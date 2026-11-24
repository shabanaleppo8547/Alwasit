'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'نظرة عامة', icon: '◧' },
  { href: '/admin/students', label: 'الطلاب', icon: '◉' },
  { href: '/admin/subjects', label: 'المواد والمحاضرات', icon: '▤' },
  { href: '/admin/structure', label: 'السنوات والأقسام', icon: '▦' },
  { href: '/admin/teachers', label: 'الأساتذة', icon: '✎' },
  { href: '/admin/codes', label: 'رموز التفعيل', icon: '⌗' },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="أقسام الإدارة" className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
      {LINKS.map((l) => {
        const active = l.href === '/admin' ? path === '/admin' : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
              active ? 'bg-white/12 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span aria-hidden className="text-amber">
              {l.icon}
            </span>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
