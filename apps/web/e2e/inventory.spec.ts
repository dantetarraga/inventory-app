import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'Secret123';
const unique = () => Math.random().toString(36).slice(2, 8);

async function registerCompany(page: Page) {
  const email = `e2e-${unique()}@test.dev`;
  await page.goto('/register');
  await page.getByLabel('Nombre de la empresa').fill(`Bodega ${unique()}`);
  await page.getByLabel('Tu nombre').fill('Ana Pérez');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Registrar empresa' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, Ana' })).toBeVisible();
  return email;
}

async function registerMovement(
  page: Page,
  kind: 'Entrada' | 'Salida',
  product: string,
  qty: string,
) {
  await page.getByRole('button', { name: kind, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox').fill(product.slice(0, 6));
  await dialog.getByRole('option', { name: new RegExp(product) }).click();
  await dialog.getByLabel(/Cantidad que/).fill(qty);
  await dialog.getByRole('button', { name: 'Registrar' }).click();
  await expect(page.getByText('Movimiento registrado')).toBeVisible();
  await expect(dialog).toBeHidden();
}

test('register → create product → in/out → stock and reports', async ({ page }) => {
  await registerCompany(page);

  await page.goto('/settings/categories');
  await page.getByRole('button', { name: 'Nueva categoría' }).click();
  await page.getByRole('dialog').getByLabel('Nombre').fill('Bebidas');
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('cell', { name: 'Bebidas' })).toBeVisible();

  const product = `Agua ${unique()}`;
  await page.goto('/settings/products');
  await page.getByRole('button', { name: 'Nuevo producto' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre').fill(product);
  await dialog.getByLabel('Categoría').selectOption({ label: 'Bebidas' });
  await dialog.getByLabel('Precio de compra').fill('1.20');
  await dialog.getByLabel('Precio de venta').fill('2.00');
  await dialog.getByLabel('Stock mínimo').fill('5');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Producto creado')).toBeVisible();

  await page.goto('/kardex');
  await registerMovement(page, 'Entrada', product, '10');
  await registerMovement(page, 'Salida', product, '3');

  await page.getByRole('button', { name: 'Salida', exact: true }).click();
  const d = page.getByRole('dialog');
  await d.getByRole('combobox').fill(product.slice(0, 6));
  await d.getByRole('option', { name: new RegExp(product) }).click();
  await d.getByLabel(/Cantidad que/).fill('50');
  await d.getByRole('button', { name: 'Registrar' }).click();
  await expect(page.getByText(/Stock insuficiente/)).toBeVisible();
  await d.getByRole('button', { name: 'Cancelar' }).click();

  await page.goto('/settings/products');
  const row = page.getByRole('row', { name: new RegExp(product) });
  await expect(row).toContainText('7');

  await page.goto('/reports?tab=valuation');
  await expect(page.getByText(/8[.,]40/).first()).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Excel' }).click();
  expect((await download).suggestedFilename()).toMatch(/inventario-valorado.*\.xlsx$/);
});

test('session survives a reload and logout clears it', async ({ page }) => {
  await registerCompany(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hola, Ana' })).toBeVisible();

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/kardex');
  await expect(page).toHaveURL(/\/login\?redirect=/);
});

test('employee only sees permitted modules', async ({ page, browser }) => {
  await registerCompany(page);
  const empEmail = `emp-${unique()}@test.dev`;
  await page.goto('/settings/users');
  await page.getByRole('button', { name: 'Nuevo usuario' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre completo').fill('Luis Ramos');
  await dialog.getByLabel('Email', { exact: true }).fill(empEmail);
  await dialog.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Usuario creado')).toBeVisible();

  const ctx = await browser.newContext();
  const emp = await ctx.newPage();
  await emp.goto('/login');
  await emp.getByLabel('Email', { exact: true }).fill(empEmail);
  await emp.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await emp.getByRole('button', { name: 'Ingresar' }).click();
  const nav = emp.getByRole('navigation', { name: 'Principal' });
  await expect(nav.getByRole('link', { name: 'Kardex' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Reportes' })).toHaveCount(0);
  await emp.goto('/settings/products');
  await expect(emp).toHaveURL(/\/$/);
  await ctx.close();
});

test('mobile navigation works @mobile', async ({ page }) => {
  await registerCompany(page);
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Kardex' }).click();
  await expect(page.getByRole('heading', { name: 'Kardex' })).toBeVisible();
});

test('wrong credentials show an inline error and the forms link to each other', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(`nobody-${unique()}@test.dev`);
  await page.getByLabel('Contraseña', { exact: true }).fill('Wrong1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('alert')).toContainText('Email o contraseña incorrectos');

  await page.getByRole('link', { name: 'Registrar empresa' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('heading', { name: 'Registra tu empresa' })).toBeVisible();
  await page.getByRole('link', { name: 'Inicia sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible();
});

test('when the API is down the login shows a clear message, not "Internal Server Error"', async ({
  page,
}) => {
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({ status: 500, body: '', contentType: 'text/plain' }),
  );
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('alguien@test.dev');
  await page.getByLabel('Contraseña', { exact: true }).fill('Secret123');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('StockPRO no está disponible en este momento');
  await expect(page.getByText(/internal server error/i)).toHaveCount(0);
});
