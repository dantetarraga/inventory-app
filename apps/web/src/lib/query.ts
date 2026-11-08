import {
  keepPreviousData,
  QueryClient,
  queryOptions,
  useMutation,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import type { Paginated } from '@stockpro/shared';
import { api, ApiError } from './http';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (err) => toast.error(errorMessage(err)),
    },
  },
});

export function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado';
}

/** Copies field errors returned by the API (problem+json) into react-hook-form. */
export function applyServerErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
) {
  if (!(err instanceof ApiError) || !err.fieldErrors?.length) return false;
  for (const e of err.fieldErrors) {
    setError(e.path as Path<T>, { type: 'server', message: e.message });
  }
  return true;
}

export type ListParams = { page?: number; pageSize?: number; q?: string } & Record<
  string,
  string | number | boolean | undefined
>;

/**
 * Standard REST resource: list (paginated), create, update, delete.
 * Mutations invalidate the resource and any `alsoInvalidate` keys (e.g. products ← categories).
 */
export function createResource<T, TCreate, TUpdate = TCreate>(
  key: string,
  path: string,
  messages: { created: string; updated: string; deleted: string },
  alsoInvalidate: QueryKey[] = [],
) {
  const keys = {
    all: [key] as const,
    list: (params: ListParams) => [key, 'list', params] as const,
    detail: (id: number) => [key, 'detail', id] as const,
  };

  const useInvalidate = () => {
    const qc = useQueryClient();
    return () =>
      Promise.all([keys.all, ...alsoInvalidate].map((k) => qc.invalidateQueries({ queryKey: k })));
  };

  return {
    keys,
    listOptions: (params: ListParams = {}) =>
      queryOptions({
        queryKey: keys.list(params),
        queryFn: ({ signal }) => api<Paginated<T>>(path, { query: params, signal }),
        placeholderData: keepPreviousData,
      }),
    detailOptions: (id: number) =>
      queryOptions({
        queryKey: keys.detail(id),
        queryFn: ({ signal }) => api<T>(`${path}/${id}`, { signal }),
      }),
    useCreate() {
      const invalidate = useInvalidate();
      return useMutation({
        mutationFn: (body: TCreate) => api<T>(path, { method: 'POST', body }),
        onSuccess: async () => {
          await invalidate();
          toast.success(messages.created);
        },
      });
    },
    useUpdate() {
      const invalidate = useInvalidate();
      return useMutation({
        mutationFn: ({ id, body }: { id: number; body: TUpdate }) =>
          api<T>(`${path}/${id}`, { method: 'PUT', body }),
        onSuccess: async () => {
          await invalidate();
          toast.success(messages.updated);
        },
      });
    },
    useRemove() {
      const invalidate = useInvalidate();
      return useMutation({
        mutationFn: (id: number) => api<void>(`${path}/${id}`, { method: 'DELETE' }),
        onSuccess: async () => {
          await invalidate();
          toast.success(messages.deleted);
        },
      });
    },
  };
}
