import 'server-only';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

type Db = PostgresJsDatabase<typeof schema>;
const globalForDb = globalThis as unknown as { __alwasitDb?: Db };

function createDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL غير مضبوط. أضفه في إعدادات Vercel أو ملف .env (انظر .env.example).');
  }
  const client = postgres(url, {
    // على Vercel كل دالة خادم مستقلة؛ اتصال واحد يكفي ويمنع استنزاف المجمّع.
    max: process.env.VERCEL ? 1 : 10,
    prepare: false, // متوافق مع مجمّعات الاتصال (PgBouncer / Neon pooler)
    idle_timeout: 20,
  });
  return drizzle(client, { schema });
}

/** يُنشأ الاتصال عند أول استخدام، لا عند الاستيراد (حتى لا يفشل البناء). */
export const db: Db = new Proxy({} as Db, {
  get(_t, prop) {
    globalForDb.__alwasitDb ??= createDb();
    const value = Reflect.get(globalForDb.__alwasitDb, prop);
    return typeof value === 'function' ? value.bind(globalForDb.__alwasitDb) : value;
  },
});

export { schema };
