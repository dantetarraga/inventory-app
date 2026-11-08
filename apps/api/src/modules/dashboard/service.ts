import type { DashboardSummary } from '@stockpro/shared';
import type { Database } from '../../db/client';
import type { AuthContext } from '../../plugins/auth';
import { createDashboardRepository } from './repository';

export function createDashboardService(db: Database) {
  const repo = createDashboardRepository(db);
  return {
    async summary(ctx: AuthContext): Promise<DashboardSummary> {
      const cid = ctx.companyId;
      const [totals, monthly, byCategory, topProducts] = await Promise.all([
        repo.totals(cid),
        repo.monthly(cid),
        repo.stockByCategory(cid),
        repo.topOutputs(cid),
      ]);
      return { totals, monthly, byCategory, topProducts };
    },
  };
}
