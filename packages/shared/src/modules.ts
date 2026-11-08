export const MODULES = [
  { code: 'products', name: 'Productos' },
  { code: 'kardex', name: 'Kardex' },
  { code: 'reports', name: 'Reportes' },
  { code: 'categories', name: 'Categorías' },
  { code: 'brands', name: 'Marcas' },
  { code: 'warehouses', name: 'Almacenes' },
  { code: 'users', name: 'Personal' },
  { code: 'company', name: 'Tu empresa' },
] as const;

export type ModuleCode = (typeof MODULES)[number]['code'];
export const MODULE_CODES = MODULES.map((m) => m.code) as [ModuleCode, ...ModuleCode[]];
export const MODULE_NAMES = Object.fromEntries(MODULES.map((m) => [m.code, m.name])) as Record<
  ModuleCode,
  string
>;

export const ROLES = ['admin', 'employee'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = { admin: 'Administrador', employee: 'Empleado' };

export const DOC_TYPES = ['dni', 'ce', 'passport', 'other'] as const;
export type DocType = (typeof DOC_TYPES)[number];
export const DOC_TYPE_LABELS: Record<DocType, string> = {
  dni: 'DNI',
  ce: 'Carné de extranjería',
  passport: 'Pasaporte',
  other: 'Otro',
};

export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

export const MOVEMENT_TYPES = ['in', 'out', 'adjust'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];
export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  in: 'Entrada',
  out: 'Salida',
  adjust: 'Ajuste',
};
