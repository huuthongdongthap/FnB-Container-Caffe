/**
 * ═══════════════════════════════════════════════
 *  F&B CAFFE CONTAINER — WebSocket Client
 *  Real-time Order Tracking & Notifications
 * ═══════════════════════════════════════════════
 */

class WebSocketClient {
  constructor(url = 'ws://localhost:8080/ws') {
    this.url = url;
    this.ws = null;
    this.clientId = null;
    this.clientType = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.messageHandlers = new Map();
    this.orderId = null;
  }

  /**
     * Connect to WebSocket server
     */
  connect(clientType = 'customer', orderId = null) {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        this.clientType = clientType;
        this.orderId = orderId;

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;

          // Register client
          this.register(clientType, orderId);
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            // Handle registration response
            if (message.type === 'registered') {
              this.clientId = message.clientId;
              resolve({
                clientId: message.clientId,
                clientType: message.clientType,
                connectedClients: message.connectedClients
              });
            }

            // Call registered handlers
            if (this.messageHandlers.has(message.type)) {
              this.messageHandlers.get(message.type).forEach(handler => {
                handler(message.data);
              });
            }

            // Global handlers
            if (this.onMessage) {
              this.onMessage(message);
            }
          } catch (error) {
            // Silent fail for production
          }
        };

        this.ws.onclose = () => {
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          reject(error);
        };

        // Connection timeout
        setTimeout(() => {
          if (!this.clientId) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
     * Register client with server
     */
  register(clientType, orderId = null) {
    this.send({
      type: 'register',
      clientType,
      clientId: this.clientId,
      orderId
    });
  }

  /**
     * Send message to server
     */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      // Silent fail for production
    }
  }

  /**
     * Register message handler
     */
  on(messageType, handler) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType).push(handler);
    return () => this.off(messageType, handler);
  }

  /**
     * Remove message handler
     */
  off(messageType, handler) {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
     * Attempt to reconnect
     */
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;

      setTimeout(() => {
        this.connect(this.clientType, this.orderId).catch(() => {});
      }, delay);
    } else {
      if (this.onMaxReconnectReached) {
        this.onMaxReconnectReached();
      }
    }
  }

  /**
     * Send new order event
     */
  sendNewOrder(order) {
    this.send({
      type: 'new_order',
      data: order
    });
  }

  /**
     * Update order status
     */
  updateOrder(orderData) {
    this.send({
      type: 'update_order',
      data: orderData
    });
  }

  /**
     * Cancel order
     */
  cancelOrder(orderId) {
    this.send({
      type: 'cancel_order',
      orderId
    });
  }

  /**
     * Get order status
     */
  getOrderStatus(orderId) {
    this.send({
      type: 'get_order_status',
      orderId
    });
  }

  /**
     * Get all orders (admin only)
     */
  getAllOrders() {
    this.send({
      type: 'get_all_orders'
    });
  }

  /**
     * Send heartbeat ping
     */
  ping() {
    this.send({ type: 'ping' });
  }

  /**
     * Start heartbeat interval
     */
  startHeartbeat(interval = 30000) {
    this.heartbeatInterval = setInterval(() => {
      this.ping();
    }, interval);
  }

  /**
     * Stop heartbeat interval
     */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  /**
     * Disconnect from server
     */
  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Export for use in other modules
window.WebSocketClient = WebSocketClient;

// Create singleton instance
window.OrderTracker = new WebSocketClient();
