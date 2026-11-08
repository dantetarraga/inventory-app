import { eq, sql } from 'drizzle-orm';
import { createDb } from './client';
import { brands, categories, companies, products, users, warehouses } from './schema';
import { hashPassword } from '../modules/auth/service';
import { registerMovement } from '../modules/kardex/service';
import type { AuthContext } from '../plugins/auth';
import { MODULE_CODES } from '@stockpro/shared';

const DEMO_EMAIL = 'admin@stockpro.dev';
const DEMO_PASSWORD = 'Demo12345';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to seed demo data in production');
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

const { db, pool } = createDb(url);

try {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, DEMO_EMAIL));
  if (existing) {
    console.log(`Seed skipped: ${DEMO_EMAIL} already exists`);
  } else {
    await db.transaction(async (tx) => {
      const [company] = await tx
        .insert(companies)
        .values({
          name: 'Bodega Demo S.A.C.',
          currency: 'PEN',
          country: 'PE',
          taxId: '20123456789',
        })
        .returning();
      const [wh] = await tx
        .insert(warehouses)
        .values({ companyId: company!.id, name: 'Almacén principal', isDefault: true })
        .returning();
      await tx.insert(warehouses).values({ companyId: company!.id, name: 'Tienda Miraflores' });
      const [admin] = await tx
        .insert(users)
        .values({
          companyId: company!.id,
          email: DEMO_EMAIL,
          passwordHash: await hashPassword(DEMO_PASSWORD),
          fullName: 'Administrador Demo',
          role: 'admin',
          theme: 'dark',
        })
        .returning();

      const cats = await tx
        .insert(categories)
        .values([
          { companyId: company!.id, name: 'Bebidas', color: '#0ea5e9' },
          { companyId: company!.id, name: 'Abarrotes', color: '#f59e0b' },
          { companyId: company!.id, name: 'Limpieza', color: '#10b981' },
        ])
        .returning();
      const brs = await tx
        .insert(brands)
        .values([
          { companyId: company!.id, name: 'Inca Kola' },
          { companyId: company!.id, name: 'Costeño' },
          { companyId: company!.id, name: 'Sapolio' },
        ])
        .returning();

      const sample = [
        {
          name: 'Gaseosa 500ml',
          cat: 0,
          brand: 0,
          sale: '2.50',
          buy: '1.60',
          min: '24',
          qty: '120',
          out: '30',
        },
        {
          name: 'Gaseosa 1.5L',
          cat: 0,
          brand: 0,
          sale: '6.00',
          buy: '4.10',
          min: '12',
          qty: '40',
          out: '35',
        },
        {
          name: 'Arroz extra 5kg',
          cat: 1,
          brand: 1,
          sale: '22.90',
          buy: '17.50',
          min: '10',
          qty: '35',
          out: '8',
        },
        {
          name: 'Azúcar rubia 1kg',
          cat: 1,
          brand: 1,
          sale: '4.20',
          buy: '3.10',
          min: '20',
          qty: '15',
          out: '0',
        },
        {
          name: 'Lejía 1L',
          cat: 2,
          brand: 2,
          sale: '3.80',
          buy: '2.40',
          min: '15',
          qty: '60',
          out: '12',
        },
        {
          name: 'Detergente 900g',
          cat: 2,
          brand: 2,
          sale: '9.50',
          buy: '6.90',
          min: '10',
          qty: '25',
          out: '20',
        },
      ];

      const ctx: AuthContext = {
        userId: admin!.id,
        companyId: company!.id,
        role: 'admin',
        permissions: new Set(MODULE_CODES),
      };
      for (const [i, s] of sample.entries()) {
        const [p] = await tx
          .insert(products)
          .values({
            companyId: company!.id,
            name: s.name,
            barcode: `775000000${String(i + 1).padStart(4, '0')}`,
            internalCode: `P-${String(i + 1).padStart(3, '0')}`,
            categoryId: cats[s.cat]!.id,
            brandId: brs[s.brand]!.id,
            salePrice: s.sale,
            purchasePrice: s.buy,
            minStock: s.min,
          })
          .returning();
        await registerMovement(tx, ctx, {
          type: 'in',
          productId: p!.id,
          warehouseId: wh!.id,
          quantity: s.qty,
          unitCost: s.buy,
          note: 'Stock inicial',
        });
        if (Number(s.out) > 0) {
          await registerMovement(tx, ctx, {
            type: 'out',
            productId: p!.id,
            warehouseId: wh!.id,
            quantity: s.out,
            note: 'Venta',
          });
        }
      }
    });
    console.log(`Seeded demo company. Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  }
} finally {
  await pool.end();
}
