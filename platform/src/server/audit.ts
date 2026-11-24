import 'server-only';
import { db, schema } from './db';

export async function audit(
  actorId: string | null,
  action: string,
  targetUserId: string | null,
  details?: Record<string, unknown>,
) {
  await db.insert(schema.auditLogs).values({ actorId, action, targetUserId, details });
}
