// @vitest-environment node
/**
 * SaaS v3.1 Storefront Payment Metadata, Tenant PayOS Isolation & Return URL Suite
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../index';
import { payosCheckoutResponse } from './helpers/payment-sqlite-db';
import { buildEnv, createMigratedD1, dummyCtx, signupTenant } from './helpers/saas-v3-1-sqlite-fixture';

afterEach(() => {
  vi.restoreAllMocks();
});

async function placeGuestPayosOrder(
  env: ReturnType<typeof buildEnv>,
  tenant: { tenantId?: string; slug?: string },
  product: { id: string; name: string; price: number },
  tableId: string
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (tenant.slug) headers['X-Tenant-Slug'] = tenant.slug;
  if (tenant.tenantId) headers['X-Tenant-ID'] = tenant.tenantId;
  const res = await app.fetch(
    new Request(`https://auraspace.cafe/api/orders${tenant.slug ? `?store=${tenant.slug}` : ''}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        total: product.price,
        customer_name: 'Khách Bàn 1',
        customer_phone: '0000000000',
        payment_method: 'payos',
        order_type: 'dine_in',
        table_id: tableId,
        items: [{ product_id: product.id, name: product.name, price: product.price, quantity: 1 }],
      }),
    }),
    env,
    dummyCtx
  );
  expect(res.status).toBe(201);
  const body = (await res.json()) as { order_token?: string; data?: { id?: string; order_token?: string } };
  const orderId = body.data?.id || '';
  const orderToken = body.order_token || body.data?.order_token || '';
  expect(orderId && orderToken).toBeTruthy();
  return { orderId, orderToken };
}

function postPayosLink(env: ReturnType<typeof buildEnv>, headers: Record<string, string>, body: Record<string, unknown>) {
  return app.fetch(
    new Request('https://auraspace.cafe/api/payment/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
    env,
    dummyCtx
  );
}

describe('SaaS v3.1 — Storefront Payment Metadata & Tenant PayOS Isolation', () => {
  it('resolves storefront metadata cleanly, scopes tenant PayOS links to /s/{slug}, and fails closed on invalid/missing slug', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db, { FE_BASE_URL: 'https://auraspace.cafe///' });
    const tenantA = await signupTenant(env, { slug: 'quan-hoa-sen', shopName: 'Quán Hoa Sen', ownerEmail: 'sen@example.com' });
    const tenantB = await signupTenant(env, { slug: 'quan-phuong-nam', shopName: 'Quán Phương Nam', ownerEmail: 'nam@example.com' });

    const payCfgRes = await app.fetch(
      new Request('https://auraspace.cafe/api/saas/payment-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tenantA.token}` },
        body: JSON.stringify({
          provider: 'payos',
          bankName: 'Vietcombank',
          bankBin: '970436',
          bankAccountNo: '0123456789',
          bankAccountName: 'QUAN HOA SEN',
          payosClientId: 'tenant-a-client-id',
          payosApiKey: 'tenant-a-api-key',
          payosChecksumKey: 'tenant-a-checksum-secret-key',
        }),
      }),
      env,
      dummyCtx
    );
    expect(payCfgRes.status).toBe(200);

    const sfRes = await app.fetch(new Request(`https://auraspace.cafe/api/saas/storefront/${tenantA.slug}`), env, dummyCtx);
    expect(sfRes.status).toBe(200);
    const sfText = await sfRes.text();
    expect(sfText).not.toContain('tenant-a-api-key');
    expect(sfText).not.toContain('tenant-a-checksum');
    const sfJson = JSON.parse(sfText) as {
      data: { payment: Record<string, unknown>; products: Array<{ id: string; name: string; price: number }>; tables: Array<{ id: string }> };
    };
    expect(sfJson.data.payment).toMatchObject({
      provider: 'payos',
      hasPayos: true,
      hasBankTransfer: true,
      bankBin: '970436',
      bankAccountNo: '0123456789',
      bankAccountName: 'QUAN HOA SEN',
      bankName: 'Vietcombank',
    });
    expect(sfJson.data.products.length).toBeGreaterThanOrEqual(5);
    expect(sfJson.data.tables.length).toBeGreaterThanOrEqual(1);

    const subProdRes = await app.fetch(
      new Request(`https://${tenantA.slug}.auraspace.cafe/api/products`, { headers: { Host: `${tenantA.slug}.auraspace.cafe` } }),
      env,
      dummyCtx
    );
    expect(subProdRes.status).toBe(200);
    expect(await subProdRes.text()).not.toContain('Cà Phê Sữa Đá AURA');

    const chosenProduct = sfJson.data.products[0]!;
    const tableId = sfJson.data.tables[0]!.id;
    const { orderId, orderToken } = await placeGuestPayosOrder(env, tenantA, chosenProduct, tableId);

    let capturedPayosPayload: Record<string, unknown> | null = null;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('api-merchant.payos.vn/v2/payment-requests')) {
        const headers = new Headers(init?.headers);
        expect(headers.get('x-client-id')).toBe('tenant-a-client-id');
        expect(headers.get('x-api-key')).toBe('tenant-a-api-key');
        capturedPayosPayload = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return payosCheckoutResponse(capturedPayosPayload as Record<string, any>, 'tenant-a-checksum-secret-key', 'tenant-a-mock-checkout');
      }
      throw new Error(`Unexpected external fetch: ${url}`);
    });

    const linkRes = await postPayosLink(
      env,
      { 'X-Tenant-ID': tenantA.tenantId, 'X-Order-Token': orderToken },
      { order_id: orderId, amount: chosenProduct.price, description: 'DH TEST', customer_name: 'Khách Bàn 1' }
    );
    expect(linkRes.status).toBe(200);
    expect(((await linkRes.json()) as { checkoutUrl?: string }).checkoutUrl).toBe('https://pay.payos.vn/web/tenant-a-mock-checkout');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(capturedPayosPayload).toMatchObject({
      returnUrl: `https://auraspace.cafe/s/${tenantA.slug}?order_id=${encodeURIComponent(orderId)}&payment=success`,
      cancelUrl: `https://auraspace.cafe/s/${tenantA.slug}?order_id=${encodeURIComponent(orderId)}&payment=cancelled`,
    });

    const crossRes = await postPayosLink(
      env,
      { 'X-Tenant-Slug': tenantB.slug, 'X-Tenant-ID': tenantB.tenantId, 'X-Order-Token': orderToken },
      { order_id: orderId, amount: chosenProduct.price, description: 'CROSS TENANT' }
    );
    expect([403, 404]).toContain(crossRes.status);

    const ord2 = await placeGuestPayosOrder(env, tenantA, chosenProduct, tableId);
    for (const sql of [
      "UPDATE saas_tenants SET slug = '../evil' WHERE id = ?",
      'DELETE FROM saas_tenants WHERE id = ?',
    ]) {
      sqlite.prepare(sql).run(tenantA.tenantId);
      const badRes = await postPayosLink(env, { 'X-Tenant-ID': tenantA.tenantId, 'X-Order-Token': ord2.orderToken }, { order_id: ord2.orderId, amount: chosenProduct.price });
      expect(badRes.status).toBe(404);
      expect((await badRes.json()) as Record<string, unknown>).toMatchObject({ code: 'tenant_slug_not_found' });
    }
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('blocks unconfigured tenant PayOS fallback and preserves default flagship return/cancel URLs', async () => {
    const { db } = createMigratedD1();
    const env = buildEnv(db);
    const tenant = await signupTenant(env, { slug: 'quan-vietqr-only', shopName: 'Quán VietQR Only', ownerEmail: 'vqr@example.com' });
    const sfRes = await app.fetch(new Request(`https://auraspace.cafe/api/saas/storefront/${tenant.slug}`), env, dummyCtx);
    const sfJson = (await sfRes.json()) as {
      data: { payment: Record<string, unknown>; products: Array<{ id: string; name: string; price: number }>; tables: Array<{ id: string }> };
    };
    expect(sfJson.data.payment).toMatchObject({ provider: 'vietqr', hasPayos: false, hasBankTransfer: false });
    const product = sfJson.data.products[0]!;
    const { orderId, orderToken } = await placeGuestPayosOrder(env, tenant, product, sfJson.data.tables[0]!.id);

    let defPayload: Record<string, unknown> | null = null;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_, init) => {
      defPayload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return payosCheckoutResponse(defPayload as Record<string, any>, env.PAYOS_CHECKSUM_KEY!, 'flagship-link');
    });
    const uncfgRes = await postPayosLink(env, { 'X-Tenant-Slug': tenant.slug, 'X-Tenant-ID': tenant.tenantId, 'X-Order-Token': orderToken }, { order_id: orderId, amount: product.price, description: 'NO FALLBACK' });
    expect(uncfgRes.status).toBe(400);
    expect((await uncfgRes.json()) as Record<string, unknown>).toMatchObject({ code: 'merchant_payos_not_configured' });
    expect(fetchSpy).not.toHaveBeenCalled();

    const defOrd = await placeGuestPayosOrder(env, {}, { id: 'prod_default_1', name: 'Cà Phê Sữa Đá AURA', price: 35000 }, 'tbl_default_1');
    const defRes = await postPayosLink(env, { 'X-Order-Token': defOrd.orderToken }, { order_id: defOrd.orderId, amount: 35000, description: 'DEFAULT' });
    expect(defRes.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(defPayload).toMatchObject({
      returnUrl: `https://auraspace.cafe/order-success?order_id=${encodeURIComponent(defOrd.orderId)}`,
      cancelUrl: `https://auraspace.cafe/checkout?cancelled=true&order_id=${encodeURIComponent(defOrd.orderId)}`,
    });
  });
});
