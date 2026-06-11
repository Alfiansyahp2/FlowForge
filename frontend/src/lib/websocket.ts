/**
 * WebSocket connection manager for real-time updates
 * Handles connection lifecycle, reconnection, and event dispatching
 */

type WebSocketEvent = 'open' | 'message' | 'error' | 'close';
type WebSocketEventListener = (data?: any) => void;

interface WebSocketConfig {
  url: string;
  protocols?: string | string[];
  reconnectInterval: number;
  maxReconnectAttempts: number;
}

interface ChannelSubscription {
  channel: string;
  eventListeners: Map<string, Set<WebSocketEventListener>>;
}

class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isManualClose = false;
  private subscriptions: Map<string, ChannelSubscription> = new Map();
  private globalListeners: Map<WebSocketEvent, Set<WebSocketEventListener>> = new Map();

  constructor(config: WebSocketConfig) {
    this.config = config;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      console.log('WebSocket already connected or connecting');
      return;
    }

    try {
      console.log('Connecting to WebSocket:', this.config.url);
      this.ws = new WebSocket(this.config.url, this.config.protocols);
      this.setupEventHandlers();
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isManualClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Subscribe to a channel
   */
  subscribe(channel: string, event: string, listener: WebSocketEventListener): () => void {
    // Create subscription if it doesn't exist
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, {
        channel,
        eventListeners: new Map(),
      });

      // Send subscription message to server
      this.sendSubscriptionMessage(channel, 'subscribe');
    }

    // Add event listener
    const subscription = this.subscriptions.get(channel)!;
    if (!subscription.eventListeners.has(event)) {
      subscription.eventListeners.set(event, new Set());
    }
    subscription.eventListeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      const sub = this.subscriptions.get(channel);
      if (sub) {
        const listeners = sub.eventListeners.get(event);
        if (listeners) {
          listeners.delete(listener);
          if (listeners.size === 0) {
            sub.eventListeners.delete(event);
          }
        }
        if (sub.eventListeners.size === 0) {
          this.subscriptions.delete(channel);
          this.sendSubscriptionMessage(channel, 'unsubscribe');
        }
      }
    };
  }

  /**
   * Get connection status
   */
  getStatus(): 'disconnected' | 'connecting' | 'connected' {
    if (!this.ws) return 'disconnected';
    if (this.ws.readyState === WebSocket.CONNECTING) return 'connecting';
    if (this.ws.readyState === WebSocket.OPEN) return 'connected';
    return 'disconnected';
  }

  /**
   * Add global event listener
   */
  on(event: WebSocketEvent, listener: WebSocketEventListener): () => void {
    if (!this.globalListeners.has(event)) {
      this.globalListeners.set(event, new Set());
    }
    this.globalListeners.get(event)!.add(listener);

    // Return cleanup function
    return () => {
      const listeners = this.globalListeners.get(event);
      if (listeners) {
        listeners.delete(listener);
      }
    };
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.emitGlobal('open');
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
        this.emitGlobal('message', message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emitGlobal('error', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.emitGlobal('close');
      this.ws = null;

      if (!this.isManualClose) {
        this.scheduleReconnect();
      }
    };
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: any): void {
    const { channel, event, data } = message;

    if (channel && event) {
      const subscription = this.subscriptions.get(channel);
      if (subscription) {
        const listeners = subscription.eventListeners.get(event);
        if (listeners) {
          listeners.forEach((listener) => {
            try {
              listener(data);
            } catch (error) {
              console.error('Error in event listener:', error);
            }
          });
        }
      }
    }
  }

  /**
   * Emit global event
   */
  private emitGlobal(event: WebSocketEvent, data?: any): void {
    const listeners = this.globalListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error('Error in global listener:', error);
        }
      });
    }
  }

  /**
   * Send subscription message to server
   */
  private sendSubscriptionMessage(channel: string, action: 'subscribe' | 'unsubscribe'): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          event: action,
          channels: [channel],
        })
      );
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1);

    console.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

/**
 * Create a WebSocket manager for FlowForge real-time updates
 */
export function createFlowForgeWebSocket(tenantId: string): WebSocketManager {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = import.meta.env.VITE_REVERB_HOST || window.location.host;
  const wsUrl = `${wsProtocol}//${wsHost}/socket/tenant/${tenantId}`;

  return new WebSocketManager({
    url: wsUrl,
    reconnectInterval: 3000,
    maxReconnectAttempts: 10,
  });
}

/**
 * React hook for WebSocket connection
 */
import { useEffect, useState, useCallback } from 'react';

export function useWebSocket(tenantId: string | null) {
  const [ws, setWs] = useState<WebSocketManager | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  useEffect(() => {
    if (!tenantId) return;

    const manager = createFlowForgeWebSocket(tenantId);
    setWs(manager);

    // Update status on connection changes
    const unsubscribeOpen = manager.on('open', () => setStatus('connected'));
    const unsubscribeClose = manager.on('close', () => setStatus('disconnected'));

    manager.connect();

    return () => {
      unsubscribeOpen();
      unsubscribeClose();
      manager.disconnect();
    };
  }, [tenantId]);

  const subscribe = useCallback(
    (channel: string, event: string, listener: (data?: any) => void) => {
      if (!ws) return () => {};
      return ws.subscribe(channel, event, listener);
    },
    [ws]
  );

  return { ws, status, subscribe };
}
