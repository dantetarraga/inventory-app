import { z } from 'zod';
import { MODULE_CODES, ROLES, THEMES } from './modules';

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email('Email inválido'));
export const passwordSchema = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .max(128)
  .regex(/[A-Za-z]/, 'Debe contener letras')
  .regex(/\d/, 'Debe contener números');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Requerido').max(128),
});
export type LoginInput = z.input<typeof loginSchema>;

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120),
  email: emailSchema,
  password: passwordSchema,
  companyName: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120),
  currency: z.string().trim().toUpperCase().length(3).default('PEN'),
  country: z.string().trim().toUpperCase().length(2).default('PE'),
});
export type RegisterInput = z.input<typeof registerSchema>;

export const sessionUserSchema = z.object({
  id: z.number().int(),
  email: z.string(),
  fullName: z.string(),
  role: z.enum(ROLES),
  theme: z.enum(THEMES),
  permissions: z.array(z.enum(MODULE_CODES)),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const sessionCompanySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  currency: z.string(),
  country: z.string(),
});
export type SessionCompany = z.infer<typeof sessionCompanySchema>;

export const meSchema = z.object({ user: sessionUserSchema, company: sessionCompanySchema });
export type Me = z.infer<typeof meSchema>;

export const authResponseSchema = z.object({ accessToken: z.string(), me: meSchema });
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const updatePreferencesSchema = z.object({ theme: z.enum(THEMES) });
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
