/**
 * ═══════════════════════════════════════════════
 *  F&B CAFFE CONTAINER — WebSocket Order Server
 *  Real-time Order Tracking & Notifications
 * ═══════════════════════════════════════════════
 */

const WebSocket = require('ws');
const http = require('http');

// Create HTTP server
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('F&B WebSocket Server Running');
});

// Create WebSocket server
const wss = new WebSocket.Server({
    server,
    port: 8080,
    path: '/ws'
});

// Connected clients storage
const clients = {
    admin: new Set(),      // Admin dashboard
    kitchen: new Set(),    // KDS kitchen display
    customer: new Set()    // Customer order tracking
};

// Order state storage (in-memory, replace with Redis in production)
const orderState = new Map();

// ─── Broadcast Functions ───

/**
 * Broadcast order update to all connected clients
 */
function broadcastOrderUpdate(order, eventType = 'order_updated') {
    const message = JSON.stringify({
        type: eventType,
        data: order,
        timestamp: new Date().toISOString()
    });

    // Send to admin dashboard
    clients.admin.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });

    // Send to kitchen display
    if (['new_order', 'order_cancelled'].includes(eventType)) {
        clients.kitchen.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    // Send to customer (only their own order)
    clients.customer.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client.orderId === order.id) {
            client.send(message);
        }
    });

    console.log(`[WS] Broadcasted ${eventType} for order #${order.id}`);
}

/**
 * Broadcast to specific client type
 */
function broadcastTo(type, message) {
    clients[type]?.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// ─── WebSocket Connection Handler ───

wss.on('connection', (ws, req) => {
    console.log('[WS] New connection established');

    let clientType = null;
    let clientId = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('[WS] Received:', data);

            switch (data.type) {
                case 'register':
                    // Client registers its type (admin/kitchen/customer)
                    clientType = data.clientType || 'customer';
                    clientId = data.clientId || generateClientId();
                    ws.clientId = clientId;
                    ws.clientType = clientType;

                    if (data.orderId) {
                        ws.orderId = data.orderId;
                    }

                    clients[clientType]?.add(ws);

                    ws.send(JSON.stringify({
                        type: 'registered',
                        clientId,
                        clientType,
                        connectedClients: {
                            admin: clients.admin.size,
                            kitchen: clients.kitchen.size,
                            customer: clients.customer.size
                        }
                    }));

                    console.log(`[WS] Client registered: ${clientType} (${clientId})`);
                    break;

                case 'new_order':
                    // New order created
                    const newOrder = data.data;
                    orderState.set(newOrder.id, {
                        ...newOrder,
                        status: 'pending',
                        createdAt: new Date().toISOString()
                    });

                    broadcastOrderUpdate(newOrder, 'new_order');
                    break;

                case 'update_order':
                    // Order status updated
                    const updateData = data.data;
                    const existingOrder = orderState.get(updateData.id);

                    if (existingOrder) {
                        const updatedOrder = {
                            ...existingOrder,
                            ...updateData,
                            updatedAt: new Date().toISOString()
                        };
                        orderState.set(updateData.id, updatedOrder);
                        broadcastOrderUpdate(updatedOrder, 'order_updated');
                    }
                    break;

                case 'cancel_order':
                    // Order cancelled
                    const cancelId = data.orderId;
                    orderState.delete(cancelId);
                    broadcastOrderUpdate({ id: cancelId }, 'order_cancelled');
                    break;

                case 'ping':
                    // Heartbeat
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;

                case 'get_order_status':
                    // Get current order status
                    const orderId = data.orderId;
                    const order = orderState.get(orderId);
                    if (order) {
                        ws.send(JSON.stringify({
                            type: 'order_status',
                            data: order
                        }));
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Order not found'
                        }));
                    }
                    break;

                case 'get_all_orders':
                    // Get all orders (admin only)
                    if (clientType === 'admin') {
                        ws.send(JSON.stringify({
                            type: 'all_orders',
                            data: Array.from(orderState.values())
                        }));
                    }
                    break;

                default:
                    console.log('[WS] Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('[WS] Error processing message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
            }));
        }
    });

    ws.on('close', () => {
        console.log('[WS] Client disconnected');

        // Remove from clients set
        if (clientType && clients[clientType]) {
            clients[clientType].delete(ws);
        }
    });

    ws.on('error', (error) => {
        console.error('[WS] Error:', error);
    });

    // Send initial connection confirmation
    ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to F&B WebSocket Server',
        serverTime: new Date().toISOString()
    }));
});

// ─── Utility Functions ───

function generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ─── Heartbeat/Ping-Pong ───

const heartbeatInterval = setInterval(() => {
    wss.clients.forEach(ws => {
        if (ws.isAlive === false) {
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('pong', () => {
    this.isAlive = true;
});

// ─── Graceful Shutdown ───

process.on('SIGTERM', () => {
    console.log('[WS] Shutting down...');
    clearInterval(heartbeatInterval);

    wss.clients.forEach(client => {
        client.close(1001, 'Server shutting down');
    });

    server.close(() => {
        console.log('[WS] Server closed');
        process.exit(0);
    });
});

// ─── Start Server ───

server.listen(8080, () => {
    console.log('═══════════════════════════════════════════════');
    console.log('  F&B WebSocket Server');
    console.log('  Running on ws://localhost:8080/ws');
    console.log('═══════════════════════════════════════════════');
});

module.exports = { wss, server, clients, orderState };
