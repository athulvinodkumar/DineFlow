"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitToRestaurant = exports.setupSocketHandlers = void 0;
const setupSocketHandlers = (io) => {
    io.on('connection', (socket) => {
        // Client joins tenant room
        socket.on('join:restaurant', (data) => {
            if (data && data.restaurantId) {
                const roomName = `room:restaurant:${data.restaurantId}`;
                socket.join(roomName);
                // Also join role-specific sub-room if provided
                if (data.role) {
                    socket.join(`room:restaurant:${data.restaurantId}:${data.role.toLowerCase()}`);
                }
            }
        });
        socket.on('leave:restaurant', (data) => {
            if (data && data.restaurantId) {
                socket.leave(`room:restaurant:${data.restaurantId}`);
            }
        });
        socket.on('disconnect', () => {
            // Clean up connection
        });
    });
};
exports.setupSocketHandlers = setupSocketHandlers;
const emitToRestaurant = (io, restaurantId, event, payload) => {
    io.to(`room:restaurant:${restaurantId}`).emit(event, payload);
};
exports.emitToRestaurant = emitToRestaurant;
