/**
 * Integration tests for PayOS refund route — full branch coverage.
 * Each test uses its own isolated app + db + router (no cross-test state).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDB } from '../test-utils';
import { generateJWT } from '../../lib/jwt';

const JWT_SECRET = 'test-jwt-secret-at-least-16-chars';

async function ownerHeaders(): Promise<Record<string, string>> {
	const token = await generateJWT(
		{ id: 'USR_TEST', email: 'test@test.com', name: 'Test Owner', role: 'owner' },
		JWT_SECRET,
		'3600'
	);
	return { Authorization: `Bearer ${token}` };
}

const PAYOS_OK = () =>
	new Response(JSON.stringify({ code: '00', desc: 'OK', data: { refundAmount: 50000 } }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});

const PAYOS_FAIL = () =>
	new Response(JSON.stringify({ code: '10', desc: 'PayOS error' }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});

function makePaymentRow(opts: {
	refundStatus?: string | null;
	refundAmount?: number | null;
	status?: string;
} = {}): Record<string, unknown> {
	return {
		id: 'PAY_1',
		order_id: 'ORD_1',
		method: 'payos',
		amount: 50000,
		status: opts.status || 'paid',
		transaction_id: 'TX_123',
		refund_status: opts.refundStatus ?? null,
		refund_amount: opts.refundAmount ?? null,
		refund_reason: null,
	};
}

function buildMockDB(opts: {
	paymentRow?: Record<string, unknown> | false;
	orderRow?: Record<string, unknown> | null;
	customerRow?: Record<string, unknown> | null;
	walletRow?: Record<string, unknown> | null;
} = {}) {
	const paymentRow = opts.paymentRow === false ? null : (opts.paymentRow ?? makePaymentRow());
	const orderRow = opts.orderRow ?? {
		id: 'ORD_1',
		customer_id: 'CUS_1',
		cashback_earned: 0,
		points_earned: 0,
	};
	const customerRow = opts.customerRow ?? {
		id: 'CUS_1',
		loyalty_points: 500,
		lifetime_points: 500,
	};
	const walletRow = opts.walletRow ?? {
		id: 'WAL_1',
		customer_id: 'CUS_1',
		balance: 5000,
	};

	const db = createMockDB();
	let lastRowId = 1;
	db.prepare = ((_sql: string) => {
		const stmt: any = { _sql: _sql, _binds: [] };
		stmt.bind = (...args: any[]) => {
			stmt._binds = args;
			return stmt;
		};
		stmt.all = async () => ({ results: [], success: true });
		stmt.run = async () => ({ success: true, changes: 1, lastRowId: ++lastRowId });
		stmt.raw = async () => [];
		stmt.first = async () => {
			const q = (_sql || '').toLowerCase();
			if (q.includes('payments where id')) return paymentRow ? { ...paymentRow } : null;
			if (q.includes('from orders')) return orderRow ? { ...orderRow } : null;
			if (q.includes('from customers')) return customerRow ? { ...customerRow } : null;
			if (q.includes('from cashback_wallets')) return walletRow ? { ...walletRow } : null;
			if (q.includes('select') && q.includes('from _metrics')) return null;
			return null;
		};
		return stmt;
	}) as any;
	return db;
}

async function setupTest(
	paymentRow?: Record<string, unknown> | boolean,
	envOverrides: Record<string, unknown> = {}
) {
	const { Hono } = await import('hono');
	const { refundRouter } = await import('../../routes/refunds');

	// `false` sentinel = payment not found (null row), otherwise pass custom row
	const db = buildMockDB({ paymentRow });
	const api = new Hono().route('/payments', refundRouter);
	const app = new Hono().route('/api', api);
	const env = { ...createMockEnv(), AURA_DB: db, ...envOverrides };

	return { app, env };
}

/* ═══════════════════════════════════════════════════════════════
   POST /api/payments/refund
   ═══════════════════════════════════════════════════════════════ */

describe('POST /api/payments/refund', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(PAYOS_OK());
	});

	it('happy path — full refund succeeds (200)', async () => {
		// Payment is paid, no prior refund
		const row = makePaymentRow({ status: 'paid' });
		const { app, env } = await setupTest(row);
		const headers = await ownerHeaders();
		const res = await app.fetch(
			new Request('https://test.api/api/payments/refund', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...headers },
				body: JSON.stringify({ paymentId: 'PAY_1', amount: 50000, reason: 'test' }),
			}),
			env
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
		expect(body.data.refundStatus).toBe('refunded');
	});

	it('rejects amount > payment — 400', async () => {
		const row = makePaymentRow({ status: 'paid' });
		const { app, env } = await setupTest(row);
		const headers = await ownerHeaders();
		const res = await app.fetch(
			new Request('https://test.api/api/payments/refund', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...headers },
				body: JSON.stringify({ paymentId: 'PAY_1', amount: 99999, reason: 'exceed' }),
			}),
			env
		);
		expect(res.status).toBe(400);
	});

	it('payment not found — 404', async () => {
		const { app, env } = await setupTest(false);
		const headers = await ownerHeaders();
		const res = await app.fetch(
			new Request('https://test.api/api/payments/refund', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...headers },
				body: JSON.stringify({ paymentId: 'X', amount: 1000, reason: 'x' }),
			}),
			env
		);
		expect(res.status).toBe(404);
	});

	it('payment not paid — 400', async () => {
		const row = makePaymentRow({ status: 'pending' });
		const { app, env } = await setupTest(row);
		const headers = await ownerHeaders();
		const res = await app.fetch(
			new Request('https://test.api/api/payments/refund', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...headers },
				body: JSON.stringify({ paymentId: 'PAY_1', amount: 1000, reason: 'x' }),
			}),
			env
		);
		expect(res.status).toBe(400);
	});

	it('already refunded — 409', async () => {
		const row = makePaymentRow({ refundStatus: 'refunded' });
		const { app, env } = await setupTest(row);
		const headers = await ownerHeaders();
		const res = await app.fetch(
			new Request('https://test.api/api/payments/refund', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...headers },
				body: JSON.stringify({ paymentId: 'PAY_1', amount: 1000, reason: 'dup' }),
			}),
			env
		);
		expect(res.status).toBe(409);
	});

	it('partial refund allowed — 200', async () => {
		const row = makePaymentRow({ status: 'paid' });
		const { app, env } = await setupTest(row);
		const headers = await ownerHeaders();
		const res = await app.fetch(
			new Request('https://test.api/api/payments/refund', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...headers },
				body: JSON.stringify({ paymentId: 'PAY_1', amount: 20000, reason: 'partial' }),
			}),
			env
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data.refundStatus).toBe('partial');
	});

	it('PayOS not configured — 500', async () => {
		const row = makePaymentRow({ status: 'paid' });
		const { app, env } = await setupTest(row, { PAYOS_CLIENT_ID: undefined, PAYOS_API_KEY: undefined });
		const headers = await ownerHeaders();
		const res = await app.fetch(
			new Request('https://test.api/api/payments/refund', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...headers },
				body: JSON.stringify({ paymentId: 'PAY_1', amount: 1000, reason: 'x' }),
			}),
			env
		);
		expect(res.status).toBe(500);
	});

	it('PayOS returns failure code — 502', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(PAYOS_FAIL());
		const row = makePaymentRow({ status: 'paid' });
		const { app, env } = await setupTest(row);
		const headers = await ownerHeaders();
		const res = await app.fetch(
			new Request('https://test.api/api/payments/refund', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...headers },
				body: JSON.stringify({ paymentId: 'PAY_1', amount: 100, reason: 'x' }),
			}),
			env
		);
		expect(res.status).toBe(502);
	});

	it('unauthorized — no token — 401', async () => {
		const row = makePaymentRow({ status: 'paid' });
		const { app, env } = await setupTest(row);
		const res = await app.fetch(
			new Request('https://test.api/api/payments/refund', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ paymentId: 'PAY_1', amount: 1000, reason: 'x' }),
			}),
			env
		);
		expect(res.status).toBe(401);
	});

	it('Zod: missing reason — 400', async () => {
		const row = makePaymentRow({ status: 'paid' });
		const { app, env } = await setupTest(row);
		const headers = await ownerHeaders();
		const res = await app.fetch(
			new Request('https://test.api/api/payments/refund', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...headers },
				body: JSON.stringify({ paymentId: 'PAY_1', amount: 1000 }),
			}),
			env
		);
		expect(res.status).toBe(400);
	});

	it('Zod: non-positive amount — 400', async () => {
		const row = makePaymentRow({ status: 'paid' });
		const { app, env } = await setupTest(row);
		const headers = await ownerHeaders();
		const res = await app.fetch(
			new Request('https://test.api/api/payments/refund', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...headers },
				body: JSON.stringify({ paymentId: 'PAY_1', amount: 0, reason: 'x' }),
			}),
			env
		);
		expect(res.status).toBe(400);
	});
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/payments/refunds/:paymentId
   ═══════════════════════════════════════════════════════════════ */

describe('GET /api/payments/refunds/:paymentId', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('returns existing refund details (200)', async () => {
		const row = makePaymentRow({ refundStatus: 'partial', refundAmount: 20000 });
		const { app, env } = await setupTest(row);
		const headers = await ownerHeaders();
		const res = await app.fetch(
			new Request('https://test.api/api/payments/refunds/PAY_1', { headers }),
			env
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
		expect(body.data.refundStatus).toBe('partial');
	});

	it('payment not found — 404', async () => {
		const { app, env } = await setupTest(false);
		const headers = await ownerHeaders();
		const res = await app.fetch(
			new Request('https://test.api/api/payments/refunds/PAY_NOPE', { headers }),
			env
		);
		expect(res.status).toBe(404);
	});

	it('unauthorized — no token — 401', async () => {
		const row = makePaymentRow({ status: 'paid' });
		const { app, env } = await setupTest(row);
		const res = await app.fetch(new Request('https://test.api/api/payments/refunds/PAY_1', {}), env);
		expect(res.status).toBe(401);
	});
});
