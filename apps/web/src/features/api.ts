/**
 * Query options and mutations for every API resource.
 * Components consume these; no server data lives in Zustand stores.
 */
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  AuthResponse,
  Brand,
  Category,
  Company,
  CompanyStats,
  CreateMovementInput,
  CreateProductInput,
  CreateUserInput,
  DashboardSummary,
  KardexReportRow,
  LoginInput,
  Me,
  Movement,
  ProductStockReport,
  Product,
  RegisterInput,
  StockReportRow,
  Theme,
  UpdateCompanyInput,
  UpdateProductInput,
  UpdateUserInput,
  UpsertBrandInput,
  UpsertCategoryInput,
  UpsertWarehouseInput,
  User,
  ValuationReport,
  Warehouse,
} from '@stockpro/shared';
import { api } from '@/lib/http';
import { createResource, queryClient } from '@/lib/query';
import { useSession } from '@/stores/session';

const productKeys = ['products'] as const;
const dashboardKeys = ['dashboard'] as const;
const reportKeys = ['reports'] as const;

// ---------- Auth ----------
export const authApi = {
  login: (body: LoginInput) => api<AuthResponse>('/auth/login', { method: 'POST', body }),
  register: (body: RegisterInput) => api<AuthResponse>('/auth/register', { method: 'POST', body }),
  async logout() {
    try {
      await api<void>('/auth/logout', { method: 'POST' });
    } finally {
      useSession.getState().clear();
      queryClient.clear();
    }
  },
  updatePreferences: (theme: Theme) =>
    api<Me>('/auth/me/preferences', { method: 'PATCH', body: { theme } }),
};

// ---------- Catalog ----------
export const categoriesApi = createResource<Category, UpsertCategoryInput>(
  'categories',
  '/categories',
  { created: 'Categoría creada', updated: 'Categoría actualizada', deleted: 'Categoría eliminada' },
  [productKeys, dashboardKeys],
);

export const brandsApi = createResource<Brand, UpsertBrandInput>(
  'brands',
  '/brands',
  { created: 'Marca creada', updated: 'Marca actualizada', deleted: 'Marca eliminada' },
  [productKeys],
);

const warehousesResource = createResource<Warehouse, UpsertWarehouseInput>(
  'warehouses',
  '/warehouses',
  { created: 'Almacén creado', updated: 'Almacén actualizado', deleted: 'Almacén eliminado' },
);
export const warehousesApi = {
  ...warehousesResource,
  useSetDefault() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (id: number) => api<Warehouse>(`/warehouses/${id}/default`, { method: 'POST' }),
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: warehousesResource.keys.all });
        toast.success('Almacén predeterminado actualizado');
      },
    });
  },
};

// ---------- Products ----------
export const productsApi = createResource<Product, CreateProductInput, UpdateProductInput>(
  'products',
  '/products',
  { created: 'Producto creado', updated: 'Producto actualizado', deleted: 'Producto eliminado' },
  [dashboardKeys, reportKeys, ['kardex']],
);

// ---------- Kardex ----------
const kardexResource = createResource<Movement, CreateMovementInput>(
  'kardex',
  '/kardex',
  { created: 'Movimiento registrado', updated: '', deleted: '' },
  [productKeys, dashboardKeys, reportKeys],
);
export const kardexApi = {
  keys: kardexResource.keys,
  listOptions: kardexResource.listOptions,
  useCreate: kardexResource.useCreate,
};

// ---------- Users ----------
export const usersApi = createResource<User, CreateUserInput, UpdateUserInput>('users', '/users', {
  created: 'Usuario creado',
  updated: 'Usuario actualizado',
  deleted: 'Usuario eliminado',
});

// ---------- Company ----------
export const companyApi = {
  options: () =>
    queryOptions({
      queryKey: ['company'],
      queryFn: ({ signal }) => api<Company>('/company', { signal }),
    }),
  statsOptions: () =>
    queryOptions({
      queryKey: ['company', 'stats'],
      queryFn: ({ signal }) => api<CompanyStats>('/company/stats', { signal }),
    }),
  useUpdate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (body: UpdateCompanyInput) => api<Company>('/company', { method: 'PATCH', body }),
      onSuccess: async (company) => {
        await qc.invalidateQueries({ queryKey: ['company'] });
        const me = useSession.getState().me;
        if (me) {
          useSession.getState().setMe({
            ...me,
            company: {
              id: company.id,
              name: company.name,
              currency: company.currency,
              country: company.country,
            },
          });
        }
        toast.success('Datos de la empresa actualizados');
      },
    });
  },
};

// ---------- Dashboard & reports ----------
export const dashboardApi = {
  summaryOptions: () =>
    queryOptions({
      queryKey: [...dashboardKeys, 'summary'],
      queryFn: ({ signal }) => api<DashboardSummary>('/dashboard/summary', { signal }),
    }),
};

export interface KardexReportParams {
  from?: string;
  to?: string;
  productId?: number;
}

export const reportsApi = {
  stock: () =>
    queryOptions({
      queryKey: [...reportKeys, 'stock'],
      queryFn: ({ signal }) => api<StockReportRow[]>('/reports/stock', { signal }),
    }),
  lowStock: () =>
    queryOptions({
      queryKey: [...reportKeys, 'low-stock'],
      queryFn: ({ signal }) => api<StockReportRow[]>('/reports/low-stock', { signal }),
    }),
  productStock: (id: number) =>
    queryOptions({
      queryKey: [...reportKeys, 'stock', id],
      queryFn: ({ signal }) => api<ProductStockReport>(`/reports/stock/${id}`, { signal }),
    }),
  valuation: () =>
    queryOptions({
      queryKey: [...reportKeys, 'valuation'],
      queryFn: ({ signal }) => api<ValuationReport>('/reports/valuation', { signal }),
    }),
  kardex: (params: KardexReportParams) =>
    queryOptions({
      queryKey: [...reportKeys, 'kardex', params],
      queryFn: ({ signal }) =>
        api<KardexReportRow[]>('/reports/kardex', { query: { ...params }, signal }),
    }),
};
