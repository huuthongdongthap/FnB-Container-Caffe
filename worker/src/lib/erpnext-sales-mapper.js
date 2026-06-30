/**
 * ERPNext Sales Order Mapper — Phase 2 (POS Integration)
 * Transforms our order format to ERPNext Sales Order + child table values
 *
 * Pure functions, no side effects, no DB/API calls.
 * Caller is responsible for looking up mappings and passing customer name.
 */

/**
 * Map a single order item to an ERPNext Sales Order Item row
 *
 * @param {Object|null|undefined} item - Order item from D1
 * @param {number} index - Zero-based line index for sequence
 * @returns {Object} Sales Order Item values for ERPNext
 */
export function mapOrderItemToSaleOrderLine(item, index) {
  // Defensive: null/undefined item
  if (!item || typeof item !== 'object') {
    return {
      item_code: null,
      qty: 1,
      rate: 0,
      item_name: `Product ${index + 1}`,
      idx: index,
    };
  }

  // Resolve item_code — accept product_id or item_code field
  const itemCode = item.item_code ?? String(item.product_id ?? item.id ?? '');

  // Resolve quantity — handle string numbers and negative/zero fallback
  const rawQty = item.quantity ?? item.qty ?? 1;
  let qty = typeof rawQty === 'number' ? rawQty : parseFloat(rawQty);
  if (isNaN(qty) || qty <= 0) {
    qty = 1;
  }

  // Resolve unit price
  const rawPrice = item.unit_price ?? item.price_unit ?? item.price ?? 0;
  let rate = typeof rawPrice === 'number' ? rawPrice : parseFloat(rawPrice);
  if (isNaN(rate)) {
    rate = 0;
  }

  // Resolve name — fallback to generic label
  const itemName = (item.name || item.product_name || `Product ${index + 1}`).trim().substring(0, 256) || `Product ${index + 1}`;

  return {
    item_code: itemCode || null,
    qty: qty,
    rate: rate,
    amount: qty * rate,
    item_name: itemName,
    idx: index,
  };
}

/**
 * Map customer to ERPNext Customer values for on-the-fly creation
 * Used when no existing mapping entry is found for the customer
 *
 * @param {Object|null|undefined} customer - Customer from D1
 * @returns {Object} Customer values for ERPNext create
 */
export function mapCustomerToErpnextCustomer(customer) {
  // Handle null/undefined customer — walk-in guest
  if (!customer || typeof customer !== 'object') {
    return {
      customer_name: 'Guest',
      phone: '',
      email: '',
      custom_aura_customer_id: null,
    };
  }

  // Handle empty object
  if (Object.keys(customer).length === 0) {
    return {
      customer_name: 'Guest',
      phone: '',
      email: '',
      custom_aura_customer_id: null,
    };
  }

  // Name priority: name > phone > 'Guest'
  const customerName = (customer.name || customer.phone || 'Guest').trim().substring(0, 128) || 'Guest';

  return {
    customer_name: customerName,
    phone: (customer.phone || '').trim(),
    email: (customer.email || '').trim().substring(0, 128),
    custom_aura_customer_id: customer.id || null,
  };
}

/**
 * Transform our order to ERPNext Sales Order values
 *
 * @param {Object} order - Order from D1
 * @param {Array} items - Order items array (each item has item_code, quantity, rate, name)
 * @param {string|null} [customerName] - ERPNext Customer name from mappings lookup.
 *   Pass null/undefined to indicate customer needs to be created on-the-fly.
 * @returns {Object} Sales Order values for ERPNext create
 */
export function mapOrderToSaleOrder(order, items, customerName) {
  // Defensive: null/undefined order
  if (!order || typeof order !== 'object') {
    throw new Error('Invalid order: order object is required');
  }

  // Build order lines from items
  const orderItems = Array.isArray(items) ? items.filter(Boolean) : [];
  const orderLines = orderItems.map((item, idx) => mapOrderItemToSaleOrderLine(item, idx));

  // Ensure at least one line
  if (orderLines.length === 0) {
    orderLines.push(mapOrderItemToSaleOrderLine(null, 0));
  }

  // Resolve transaction_date from order.created_at
  let transactionDate;
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
    po_no: order.id || null,
    transaction_date: transactionDate,
    delivery_date: transactionDate,
    docstatus: 1, // Submitted
    order_type: 'POS',
  };
}

export default {
  mapOrderToSaleOrder,
  mapOrderItemToSaleOrderLine,
  mapCustomerToErpnextCustomer,
};
