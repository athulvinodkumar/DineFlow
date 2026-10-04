import Pusher from 'pusher';
import { IRealtimeServer, RealtimeEventPayload } from './types';

// In-memory bounded circular event buffer for local development & HTTP polling fallback
const eventBuffer: RealtimeEventPayload[] = [];
const MAX_BUFFER_SIZE = 300;

let pusherInstance: Pusher | null = null;

function getPusher(): Pusher | null {
  if (pusherInstance) return pusherInstance;

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER || 'ap2';

  if (appId && key && secret) {
    try {
      pusherInstance = new Pusher({
        appId,
        key,
        secret,
        cluster,
        useTLS: true,
      });
      console.log('📡 Pusher Channels initialized on cluster:', cluster);
    } catch (err) {
      console.warn('⚠️ Failed to initialize Pusher Channels:', err);
    }
  }

  return pusherInstance;
}

export class RealtimeServer implements IRealtimeServer {
  /**
   * Broadcast an event to all stations of a restaurant
   */
  async emitToRestaurant(restaurantId: string, event: string, payload: any): Promise<void> {
    const timestamp = Date.now();
    const eventRecord: RealtimeEventPayload = {
      id: `${timestamp}-${Math.random().toString(36).substring(2, 8)}`,
      event,
      data: payload,
      restaurantId,
      timestamp,
    };

    // 1. Always append to memory buffer (for polling fallback and local dev)
    eventBuffer.push(eventRecord);
    if (eventBuffer.length > MAX_BUFFER_SIZE) {
      eventBuffer.shift();
    }

    // 2. Broadcast via Pusher if configured
    const pusher = getPusher();
    if (pusher) {
      const channelName = `private-restaurant-${restaurantId}`;
      try {
        await pusher.trigger(channelName, event, payload);

        // If payload has a specific cashierUserId, also trigger on paired cashier channel
        if (payload && payload.cashierUserId) {
          const cashierChannel = `private-restaurant-${restaurantId}-cashier-${payload.cashierUserId}`;
          await pusher.trigger(cashierChannel, event, payload);
        }
      } catch (err) {
        console.error(`❌ Failed to trigger Pusher event [${event}] on ${channelName}:`, err);
      }
    }
  }

  /**
   * Authorize a private channel subscription for a connected client
   */
  authorizeChannel(socketId: string, channelName: string, userData?: any): any {
    const pusher = getPusher();
    if (pusher) {
      return pusher.authorizeChannel(socketId, channelName, userData);
    }
    // Fallback for local mock/polling
    return {
      auth: `local-token:${socketId}:${channelName}`,
      channel_data: userData ? JSON.stringify(userData) : undefined,
    };
  }

  /**
   * Fetch recent events for a restaurant (used by polling fallback)
   */
  getEventsSince(restaurantId: string, sinceTimestamp: number): RealtimeEventPayload[] {
    return eventBuffer.filter(
      (e) => e.restaurantId === restaurantId && e.timestamp > sinceTimestamp
    );
  }
}

export const realtimeServer = new RealtimeServer();
export const emitToRestaurant = (restaurantId: string, event: string, payload: any) =>
  realtimeServer.emitToRestaurant(restaurantId, event, payload);
