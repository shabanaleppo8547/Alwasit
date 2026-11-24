import 'server-only';
import { headers } from 'next/headers';

export async function clientInfo() {
  const h = await headers();
  const ip =
    h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  return { ip, userAgent: (h.get('user-agent') ?? '').slice(0, 300) };
}

export function appUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}
