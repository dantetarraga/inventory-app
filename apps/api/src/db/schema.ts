import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  DOC_TYPES,
  MODULE_CODES,
  MOVEMENT_TYPES,
  ROLES,
  THEMES,
  USER_STATUSES,
} from '@stockpro/shared';
import { dates } from '@stockpro/shared';

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => dates.now()),
};

const id = () => integer().primaryKey().generatedAlwaysAsIdentity();
const companyId = () =>
  integer()
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' });

export const roleEnum = pgEnum('user_role', ROLES);
export const userStatusEnum = pgEnum('user_status', USER_STATUSES);
export const themeEnum = pgEnum('theme', THEMES);
export const docTypeEnum = pgEnum('doc_type', DOC_TYPES);
export const movementTypeEnum = pgEnum('movement_type', MOVEMENT_TYPES);
export const moduleCodeEnum = pgEnum('module_code', MODULE_CODES);

export const companies = pgTable('companies', {
  id: id(),
  name: text().notNull(),
  taxId: text(),
  currency: text().notNull().default('PEN'),
  country: text().notNull().default('PE'),
  address: text(),
  ...timestamps,
});

export const users = pgTable(
  'users',
  {
    id: id(),
    companyId: companyId(),
    email: text().notNull(),
    passwordHash: text().notNull(),
    fullName: text().notNull(),
    docType: docTypeEnum(),
    docNumber: text(),
    phone: text(),
    address: text(),
    role: roleEnum().notNull().default('employee'),
    status: userStatusEnum().notNull().default('active'),
    theme: themeEnum().notNull().default('dark'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('users_email_unique').on(sql`lower(${t.email})`),
    index('users_company_idx').on(t.companyId),
  ],
);

export const userPermissions = pgTable(
  'user_permissions',
  {
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    module: moduleCodeEnum().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.module] })],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: id(),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text().notNull().unique(),
    familyId: uuid().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('refresh_tokens_user_idx').on(t.userId),
    index('refresh_tokens_family_idx').on(t.familyId),
  ],
);

export const categories = pgTable(
  'categories',
  {
    id: id(),
    companyId: companyId(),
    name: text().notNull(),
    color: text().notNull().default('#64748b'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('categories_company_name_unique').on(t.companyId, sql`lower(${t.name})`),
    index('categories_name_trgm_idx').using('gin', sql`${t.name} gin_trgm_ops`),
  ],
);

export const brands = pgTable(
  'brands',
  {
    id: id(),
    companyId: companyId(),
    name: text().notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('brands_company_name_unique').on(t.companyId, sql`lower(${t.name})`),
    index('brands_name_trgm_idx').using('gin', sql`${t.name} gin_trgm_ops`),
  ],
);

export const warehouses = pgTable(
  'warehouses',
  {
    id: id(),
    companyId: companyId(),
    name: text().notNull(),
    address: text(),
    isDefault: boolean().notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('warehouses_company_name_unique').on(t.companyId, sql`lower(${t.name})`),
    uniqueIndex('warehouses_one_default')
      .on(t.companyId)
      .where(sql`${t.isDefault}`),
  ],
);

export const products = pgTable(
  'products',
  {
    id: id(),
    companyId: companyId(),
    name: text().notNull(),
    barcode: text(),
    internalCode: text(),
    brandId: integer().references(() => brands.id, { onDelete: 'set null' }),
    categoryId: integer().references(() => categories.id, { onDelete: 'set null' }),
    salePrice: numeric({ precision: 14, scale: 2 }).notNull().default('0'),
    purchasePrice: numeric({ precision: 14, scale: 2 }).notNull().default('0'),
    minStock: numeric({ precision: 14, scale: 3 }).notNull().default('0'),
    deletedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('products_company_idx').on(t.companyId),
    index('products_category_idx').on(t.categoryId),
    index('products_brand_idx').on(t.brandId),
    index('products_name_trgm_idx').using('gin', sql`${t.name} gin_trgm_ops`),
    uniqueIndex('products_company_barcode_unique')
      .on(t.companyId, t.barcode)
      .where(sql`${t.barcode} IS NOT NULL AND ${t.deletedAt} IS NULL`),
    check(
      'products_prices_non_negative',
      sql`${t.salePrice} >= 0 AND ${t.purchasePrice} >= 0 AND ${t.minStock} >= 0`,
    ),
  ],
);

export const stock = pgTable(
  'stock',
  {
    productId: integer()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    warehouseId: integer()
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    quantity: numeric({ precision: 14, scale: 3 }).notNull().default('0'),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.warehouseId] }),
    index('stock_warehouse_idx').on(t.warehouseId),
    check('stock_quantity_non_negative', sql`${t.quantity} >= 0`),
  ],
);

export const kardexMovements = pgTable(
  'kardex_movements',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    companyId: companyId(),
    productId: integer()
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    warehouseId: integer()
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    type: movementTypeEnum().notNull(),
    delta: numeric({ precision: 14, scale: 3 }).notNull(),
    balanceAfter: numeric({ precision: 14, scale: 3 }).notNull(),
    unitCost: numeric({ precision: 14, scale: 2 }),
    note: text(),
    occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('kardex_company_occurred_idx').on(t.companyId, t.occurredAt.desc()),
    index('kardex_product_idx').on(t.productId, t.occurredAt.desc()),
    check('kardex_delta_non_zero', sql`${t.delta} <> 0`),
  ],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    companyId: companyId(),
    userId: integer().references(() => users.id, { onDelete: 'set null' }),
    entity: text().notNull(),
    entityId: text().notNull(),
    action: text().notNull(),
    data: jsonb(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_company_at_idx').on(t.companyId, t.at.desc())],
);
