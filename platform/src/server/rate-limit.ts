import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from './db';

/**
 * يزيد عدّاد المفتاح ويعيد true إذا ما زال ضمن الحد.
 * يعمل على قاعدة البيانات فيبقى صحيحًا مع تعدد نسخ الخادم.
 */
export async function hit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const rows = await db.execute<{ count: number }>(sql`
    insert into rate_limits (key, count, reset_at)
    values (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    on conflict (key) do update set
      count = case when rate_limits.reset_at < now() then 1 else rate_limits.count + 1 end,
      reset_at = case when rate_limits.reset_at < now() then excluded.reset_at else rate_limits.reset_at end
    returning count`);
  return Number(rows[0]?.count ?? 0) <= limit;
}

export async function clear(key: string) {
  await db.execute(sql`delete from rate_limits where key = ${key}`);
}
