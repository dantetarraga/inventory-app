import type { PaginationQuery } from '@stockpro/shared';

export function pageOffset({ page, pageSize }: Pick<PaginationQuery, 'page' | 'pageSize'>) {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}

export function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
