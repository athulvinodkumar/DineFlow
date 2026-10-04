export type RealtimeEventName =
  | 'order:created'
  | 'order:kot_added'
  | 'order:item_status_updated'
  | 'table:status_changed'
  | 'bill:requested'
  | 'bill:paid'
  | 'payment:initiated'
  | 'payment:updated'
  | 'payment:confirmed'
  | 'payment:cancelled';

export interface RealtimeEventPayload {
  event: RealtimeEventName | string;
  data: any;
  restaurantId: string;
  timestamp: number;
  id: string;
}

export interface IRealtimeServer {
  emitToRestaurant(restaurantId: string, event: string, payload: any): Promise<void>;
  authorizeChannel(socketId: string, channelName: string, userData?: any): any;
}

export interface IRealtimeClientListener {
  (data: any): void;
}
