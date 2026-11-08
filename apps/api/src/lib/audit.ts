import type { DbOrTx } from '../db/client';
import { auditLog } from '../db/schema';
import type { AuthContext } from '../plugins/auth';

export async function audit(
  db: DbOrTx,
  ctx: AuthContext,
  entry: { entity: string; entityId: string | number; action: string; data?: unknown },
) {
  await db.insert(auditLog).values({
    companyId: ctx.companyId,
    userId: ctx.userId,
    entity: entry.entity,
    entityId: String(entry.entityId),
    action: entry.action,
    data: entry.data ?? null,
  });
}
