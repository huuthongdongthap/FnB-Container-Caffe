/**
 * Odoo Sales Order Mapper — Phase 2 (POS Integration)
 * Transforms our order format to Odoo 16 sale.order + sale.order.line values
 *
 * Pure functions, no side effects, no DB/API calls.
 * Caller is responsible for looking up odoo_mappings and passing partner_id.
 */

/**
 * Map a single order item to an Odoo sale.order.line value
 *
 * @param {Object|null|undefined} item - Order item from D1
 * @param {number} index - Zero-based line index for sequence
 * @returns {Object} sale.order.line values for Odoo create
 */
export function mapOrderItemToSaleOrderLine(item, index) {
  // Defensive: null/undefined item
  if (!item || typeof item !== 'object') {
    return {
      product_id: null,
      product_uom_qty: 1,
      price_unit: 0,
      name: `Product ${index + 1}`,
      sequence: index,
    };
  }

  // Resolve product_id — accept id or product_id field
  const productId = item.product_id ?? item.id ?? null;

  // Resolve quantity — handle string numbers and negative/zero fallback
  const rawQty = item.quantity ?? item.qty ?? 1;
  let qty = typeof rawQty === 'number' ? rawQty : parseFloat(rawQty);
  if (isNaN(qty) || qty <= 0) {
    qty = 1;
  }

  // Resolve unit price
  const rawPrice = item.unit_price ?? item.price_unit ?? item.price ?? 0;
  let priceUnit = typeof rawPrice === 'number' ? rawPrice : parseFloat(rawPrice);
  if (isNaN(priceUnit)) {
    priceUnit = 0;
  }

  // Resolve name — fallback to generic label
  const name = (item.name || item.product_name || `Product ${index + 1}`).trim().substring(0, 256) || `Product ${index + 1}`;

  return {
    product_id: productId,
    product_uom_qty: qty,
    price_unit: priceUnit,
    name,
    sequence: index,
  };
}

/**
 * Map customer to Odoo res.partner values for on-the-fly creation
 * Used when no existing odoo_mapping entry is found for the customer
 *
 * @param {Object|null|undefined} customer - Customer from D1
 * @returns {Object} res.partner values for Odoo create
 */
export function mapCustomerToOdooPartner(customer) {
  // Handle null/undefined customer — walk-in guest
  if (!customer || typeof customer !== 'object') {
    return {
      name: 'Guest',
      phone: '',
      email: '',
      x_our_customer_id: null,
    };
  }

  // Handle empty object
  if (Object.keys(customer).length === 0) {
    return {
      name: 'Guest',
      phone: '',
      email: '',
      x_our_customer_id: null,
    };
  }

  // Name priority: name > phone > 'Guest'
  const name = (customer.name || customer.phone || 'Guest').trim().substring(0, 128) || 'Guest';

  return {
    name,
    phone: (customer.phone || '').trim(),
    email: (customer.email || '').trim().substring(0, 128),
    x_our_customer_id: customer.id || null,
  };
}

/**
 * Transform our order to Odoo sale.order values
 *
 * @param {Object} order - Order from D1
 * @param {Array} items - Order items array (each item has product_id, quantity, unit_price, name)
 * @param {number|string|null} [partnerId] - Odoo partner ID from odoo_mappings lookup.
 *   Pass null/undefined to indicate customer needs to be created on-the-fly.
 * @returns {Object} sale.order values for Odoo create
 */
export function mapOrderToSaleOrder(order, items, partnerId) {
  // Defensive: null/undefined order
  if (!order || typeof order !== 'object') {
    throw new Error('Invalid order: order object is required');
  }

  // Build order lines from items
  const orderItems = Array.isArray(items) ? items.filter(Boolean) : [];
  const orderLine = orderItems.map((item, idx) => mapOrderItemToSaleOrderLine(item, idx));

  // Ensure at least one line
  if (orderLine.length === 0) {
    orderLine.push(mapOrderItemToSaleOrderLine(null, 0));
  }

  // Resolve date_order from order.created_at
  let dateOrder;
  if (order.created_at) {
    try {
      const date = new Date(order.created_at);
      if (!isNaN(date.getTime())) {
        dateOrder = date.toISOString().split('T')[0];
      } else {
        dateOrder = new Date().toISOString().split('T')[0];
      }
    } catch {
      dateOrder = new Date().toISOString().split('T')[0];
    }
  } else {
    dateOrder = new Date().toISOString().split('T')[0];
  }

  return {
    partner_id: partnerId ?? null,
    order_line: orderLine,
    client_order_ref: order.id || null,
    date_order: dateOrder,
    state: 'sale',
  };
}

export default {
  mapOrderToSaleOrder,
  mapOrderItemToSaleOrderLine,
  mapCustomerToOdooPartner,
};
