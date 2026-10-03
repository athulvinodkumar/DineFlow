"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const auth_1 = __importDefault(require("./routes/auth"));
const staff_1 = __importDefault(require("./routes/staff"));
const menu_1 = __importDefault(require("./routes/menu"));
const tables_1 = __importDefault(require("./routes/tables"));
const orders_1 = __importDefault(require("./routes/orders"));
const bills_1 = __importDefault(require("./routes/bills"));
const reports_1 = __importDefault(require("./routes/reports"));
const settings_1 = __importDefault(require("./routes/settings"));
const display_1 = __importDefault(require("./routes/display"));
const sockets_1 = require("./sockets");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const PORT = process.env.PORT || 5000;
// Configure Socket.IO
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
});
app.set('io', io);
(0, sockets_1.setupSocketHandlers)(io);
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// API Routes
app.use('/api/auth', auth_1.default);
app.use('/api/staff', staff_1.default);
app.use('/api/menu', menu_1.default);
app.use('/api/tables', tables_1.default);
app.use('/api/orders', orders_1.default);
app.use('/api/bills', bills_1.default);
app.use('/api/reports', reports_1.default);
app.use('/api/settings', settings_1.default);
app.use('/api/display', display_1.default);
// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'DineFlow Server',
        timestamp: new Date().toISOString(),
    });
});
// Serve frontend build if present (for unified single-command deployment)
const clientDistPath = path_1.default.join(__dirname, '../../client/dist');
app.use(express_1.default.static(clientDistPath));
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return next();
    }
    const indexHtml = path_1.default.join(clientDistPath, 'index.html');
    res.sendFile(indexHtml, (err) => {
        if (err) {
            res.status(200).send('DineFlow API is running. Start the Vite client for frontend UI.');
        }
    });
});
server.listen(PORT, () => {
    console.log(`🚀 DineFlow Server running on port ${PORT}`);
    console.log(`📡 Socket.IO initialized`);
});
