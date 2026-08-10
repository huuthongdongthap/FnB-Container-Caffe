import type { PushEnv, PushPayload } from './notifier';
import { sendPushToCustomer, sendPushToStaff } from './notifier';

export async function notifyCustomerOnStatusChange(
  env: PushEnv,
  order: { id: string; customer_email: string | null; status: string }
): Promise<void> {
  try {
    if (!order.customer_email) return;

    const { results } = await env.AURA_DB.prepare(
      'SELECT id FROM customers WHERE email = ?'
    ).bind(order.customer_email).all();

    const customer = results?.[0];
    if (!customer) return;

    const payload: PushPayload = {
      title: `Đơn hàng ${order.id} — Cập nhật`,
      body: `Trạng thái: ${order.status}`,
      data: { orderId: order.id, status: order.status },
    };

    await sendPushToCustomer(env, customer.id as unknown as string, payload);
  } catch {
    // best-effort — swallow all errors
  }
}

export async function notifyStaffOnNewOrder(
  env: PushEnv,
  order: { id: string; table_id: string | null; items: Array<unknown>; total: number }
): Promise<void> {
  try {
    const itemCount = order.items.length;

    const payload: PushPayload = {
      title: 'Đơn hàng mới 🍳',
      body: `Bàn ${order.table_id || 'Khách bộ đi'} — ${itemCount} món`,
      data: { url: '/kds', orderId: order.id },
    };

    await sendPushToStaff(env, payload, 'staff-kitchen');
  } catch {
    // best-effort — swallow all errors
  }
}
