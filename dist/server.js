"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const download_1 = __importDefault(require("./routes/download"));
const logger_1 = require("./utils/logger");
dotenv_1.default.config();
// In CommonJS mode, __dirname is available globally
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
exports.io = io;
const PORT = process.env.PORT || 5000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// Make io available to routes
app.set('io', io);
// Routes
app.use('/api/download', download_1.default);
// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/index.html'));
});
// Socket.io connection handling
io.on('connection', (socket) => {
    logger_1.logger.info(`Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
        logger_1.logger.info(`Client disconnected: ${socket.id}`);
    });
});
// Error handling middleware
app.use((err, req, res, next) => {
    logger_1.logger.error(`Server error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
});
server.listen(Number(PORT), '0.0.0.0', () => {
    logger_1.logger.success(`Server running on http://0.0.0.0:${PORT}`);
});
