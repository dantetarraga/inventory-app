import { z } from 'zod';

export const companySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  taxId: z.string().nullable(),
  currency: z.string(),
  country: z.string(),
  address: z.string().nullable(),
  createdAt: z.string(),
});
export type Company = z.infer<typeof companySchema>;

export const updateCompanySchema = z.object({
  name: z.string().trim().min(2).max(120),
  taxId: z.string().trim().max(20).nullable().optional(),
  currency: z.string().trim().toUpperCase().length(3),
  country: z.string().trim().toUpperCase().length(2),
  address: z.string().trim().max(200).nullable().optional(),
});
export type UpdateCompanyInput = z.input<typeof updateCompanySchema>;

export const companyStatsSchema = z.object({
  users: z.number().int(),
  products: z.number().int(),
  categories: z.number().int(),
  brands: z.number().int(),
  warehouses: z.number().int(),
});
export type CompanyStats = z.infer<typeof companyStatsSchema>;
