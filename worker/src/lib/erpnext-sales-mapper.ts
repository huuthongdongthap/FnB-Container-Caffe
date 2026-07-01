/**
 * ERPNext Sales Order Mapper — Phase 2 (POS Integration)
 * Transforms our order format to ERPNext Sales Order + child table values
 *
 * Pure functions, no side effects, no DB/API calls.
 * Caller is responsible for looking up mappings and passing customer name.
 */

export interface OrderItemInput {
  item_code?: string | number;
  product_id?: string | number;
  id?: string | number;
  quantity?: number | string;
  qty?: number;
  unit_price?: number | string;
  price_unit?: number | string;
  price?: number | string;
  name?: string;
  product_name?: string;
}

export interface SalesOrderLine {
  item_code: string | null;
  qty: number;
  rate: number;
  amount: number;
  item_name: string;
  idx: number;
}

export interface CustomerErpnextValues {
  customer_name: string;
  phone: string;
  email: string;
  custom_aura_customer_id: string | number | null;
}

export interface SalesOrderValues {
  doctype: string;
  customer: string | null;
  items: SalesOrderLine[];
  po_no: string | null;
  transaction_date: string;
  delivery_date: string;
  docstatus: number;
  order_type: string;
}

export function mapOrderItemToSaleOrderLine(item: OrderItemInput | null | undefined, index: number): SalesOrderLine {
  if (!item || typeof item !== 'object') {
    return {
      item_code: null,
      qty: 1,
      rate: 0,
      amount: 0,
      item_name: `Product ${index + 1}`,
      idx: index,
    };
  }

  const itemCode = item.item_code ?? String(item.product_id ?? item.id ?? '');

  const rawQty = item.quantity ?? item.qty ?? 1;
  let qty = typeof rawQty === 'number' ? rawQty : parseFloat(String(rawQty));
  if (isNaN(qty) || qty <= 0) qty = 1;

  const rawPrice = item.unit_price ?? item.price_unit ?? item.price ?? 0;
  let rate = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice));
  if (isNaN(rate)) rate = 0;

  const itemName = (item.name || item.product_name || `Product ${index + 1}`).trim().substring(0, 256) || `Product ${index + 1}`;

  return {
    item_code: typeof itemCode === 'string' ? itemCode : null,
    qty,
    rate,
    amount: qty * rate,
    item_name: itemName,
    idx: index,
  };
}

export function mapCustomerToErpnextCustomer(customer: CustomerInput | null | undefined): CustomerErpnextValues {
  if (!customer || typeof customer !== 'object') {
    return { customer_name: 'Guest', phone: '', email: '', custom_aura_customer_id: null };
  }

  if (Object.keys(customer).length === 0) {
    return { customer_name: 'Guest', phone: '', email: '', custom_aura_customer_id: null };
  }

  const customerName = (customer.name || customer.phone || 'Guest').trim().substring(0, 128) || 'Guest';

  return {
    customer_name: customerName,
    phone: (customer.phone || '').trim(),
    email: (customer.email || '').trim().substring(0, 128),
    custom_aura_customer_id: customer.id || null,
  };
}

// CustomerInput forward-declare for the function above
interface CustomerInput {
  id?: string | number;
  name?: string;
  phone?: string;
  email?: string;
}

export function mapOrderToSaleOrder(
  order: { id?: string | number; created_at?: string } | null | undefined,
  items: Array<OrderItemInput | null | undefined>,
  customerName: string | null | undefined
): SalesOrderValues {
  if (!order || typeof order !== 'object') {
    throw new Error('Invalid order: order object is required');
  }

  const orderItems = Array.isArray(items) ? items.filter(Boolean) as OrderItemInput[] : [];
  const orderLines = orderItems.map((item, idx) => mapOrderItemToSaleOrderLine(item, idx));

  if (orderLines.length === 0) {
    orderLines.push(mapOrderItemToSaleOrderLine(null, 0));
  }

  let transactionDate: string;
  if (order.created_at) {
    try {
      const date = new Date(order.created_at);
      if (!isNaN(date.getTime())) {
        transactionDate = date.toISOString().split('T')[0];
      } else {
        transactionDate = new Date().toISOString().split('T')[0];
      }
    } catch {
      transactionDate = new Date().toISOString().split('T')[0];
    }
  } else {
    transactionDate = new Date().toISOString().split('T')[0];
  }

  return {
    doctype: 'Sales Order',
    customer: customerName ?? null,
    items: orderLines,
    po_no: order.id ? String(order.id) : null,
    transaction_date: transactionDate,
    delivery_date: transactionDate,
    docstatus: 1,
    order_type: 'POS',
  };
}

export default {
  mapOrderToSaleOrder,
  mapOrderItemToSaleOrderLine,
  mapCustomerToErpnextCustomer,
};
