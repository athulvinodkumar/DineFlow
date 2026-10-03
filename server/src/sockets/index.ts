import { Server as SocketIOServer, Socket } from 'socket.io';

export const setupSocketHandlers = (io: SocketIOServer) => {
  io.on('connection', (socket: Socket) => {
    // Client joins tenant room
    socket.on('join:restaurant', (data: { restaurantId: string; role?: string; userId?: string }) => {
      if (data && data.restaurantId) {
        const roomName = `room:restaurant:${data.restaurantId}`;
        socket.join(roomName);
        // Also join role-specific sub-room if provided
        if (data.role) {
          socket.join(`room:restaurant:${data.restaurantId}:${data.role.toLowerCase()}`);
        }
      }
    });

    socket.on('leave:restaurant', (data: { restaurantId: string }) => {
      if (data && data.restaurantId) {
        socket.leave(`room:restaurant:${data.restaurantId}`);
      }
    });

    socket.on('disconnect', () => {
      // Clean up connection
    });
  });
};

export const emitToRestaurant = (io: SocketIOServer, restaurantId: string, event: string, payload: any) => {
  io.to(`room:restaurant:${restaurantId}`).emit(event, payload);
};
