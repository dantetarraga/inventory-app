import { z } from 'zod';
import { emailSchema, passwordSchema } from './auth';
import { DOC_TYPES, MODULE_CODES, ROLES } from './modules';
import { paginationQuerySchema } from './common';

export const USER_STATUSES = ['active', 'inactive'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const userSchema = z.object({
  id: z.number().int(),
  email: z.string(),
  fullName: z.string(),
  docType: z.enum(DOC_TYPES).nullable(),
  docNumber: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  role: z.enum(ROLES),
  status: z.enum(USER_STATUSES),
  permissions: z.array(z.enum(MODULE_CODES)),
  createdAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

const userBase = {
  fullName: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120),
  docType: z.enum(DOC_TYPES).nullable().optional(),
  docNumber: optionalText(20),
  phone: optionalText(20),
  address: optionalText(200),
  role: z.enum(ROLES),
  permissions: z.array(z.enum(MODULE_CODES)).default([]),
};

export const createUserSchema = z.object({
  ...userBase,
  email: emailSchema,
  password: passwordSchema,
});
export type CreateUserInput = z.input<typeof createUserSchema>;

export const updateUserSchema = z.object({
  ...userBase,
  status: z.enum(USER_STATUSES),
  password: passwordSchema.optional(),
});
export type UpdateUserInput = z.input<typeof updateUserSchema>;

export const listUsersQuerySchema = paginationQuerySchema;
