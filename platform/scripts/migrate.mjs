// يطبّق ترحيلات قاعدة البيانات، ثم يملأ البيانات الأولية إن كانت القاعدة فارغة.
// يعمل تلقائيًا قبل كل بناء على Vercel (npm run build).
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { seedIfEmpty } from './seed.mjs';

// ملف .env للتطوير المحلي فقط (على Vercel تأتي المتغيرات من الإعدادات).
try {
  process.loadEnvFile?.('.env');
} catch {}

// Neon/Supabase على Vercel قد يضبطان POSTGRES_URL بدل DATABASE_URL.
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
if (!url) {
  console.error(
    '\n✗ DATABASE_URL (أو POSTGRES_URL) غير مضبوط.\n  على Vercel: Storage ← Neon ← Connect للمشروع، ثم أعد النشر.\n  محليًا: انسخ .env.example إلى .env.\n',
  );
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
try {
  await migrate(drizzle(sql), { migrationsFolder: 'drizzle' });
  console.log('✓ تم تطبيق ترحيلات قاعدة البيانات.');
  if (process.env.SEED_ON_EMPTY !== 'false') await seedIfEmpty(sql);
} finally {
  await sql.end();
}
