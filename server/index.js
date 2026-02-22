require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const compression = require('compression');

const { createWorker, RoomManager } = require('./mediasoupServer');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Temporarily disable for development
}));

// CORS configuration
const corsOptions = {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST']
};
app.use(cors(corsOptions));

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests from this IP'
});
app.use('/api/', apiLimiter);

// Compression
app.use(compression());

// Body parsing
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`, { ip: req.ip });
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Socket.IO setup
const io = socketIo(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    allowEIO3: true
});

// Track connected clients
const connectedClients = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
    logger.info('New client connected', { socketId: socket.id });
    connectedClients.set(socket.id, { connectedAt: new Date() });

    // Send connection confirmation
    socket.emit('connected', { socketId: socket.id });

    socket.on('join-room', async (data, callback = () => {}) => {
        try {
            const { roomId, displayName } = data;
            
            // Validate input
            if (!roomId || !displayName) {
                throw new Error('Missing required parameters: roomId and displayName');
            }
            
            const room = await RoomManager.getOrCreateRoom(roomId);
            
            // Store peer info without rtpCapabilities initially
            const peer = await room.addPeer(socket.id, {
                socket,
                displayName: displayName.trim(),
                rtpCapabilities: null // Will be set later
            });
            
            socket.join(roomId);
            socket.roomId = roomId;
            socket.peerId = socket.id;
            socket.displayName = displayName.trim();
            
            // Store in connected clients
            connectedClients.set(socket.id, {
                ...connectedClients.get(socket.id),
                roomId,
                displayName: displayName.trim(),
                joinedAt: new Date()
            });
            
            // Send router capabilities to client
            socket.emit('router-rtp-capabilities', {
                routerRtpCapabilities: room.router.rtpCapabilities,
                roomId,
                peerId: socket.id
            });
            
            // Get existing peers
            const existingPeers = room.getOtherPeers(socket.id);
            const existingProducers = [];
            
            existingPeers.forEach(peer => {
                peer.producers.forEach(producer => {
                    existingProducers.push({
                        producerId: producer.id,
                        peerId: peer.id,
                        kind: producer.kind,
                        displayName: peer.displayName
                    });
                });
            });
            
            // Send immediate response
            callback({
                success: true,
                peerId: socket.id,
                existingProducers,
                roomInfo: {
                    roomId: room.roomId,
                    roomName: room.roomName,
                    participantCount: room.getParticipantCount()
                }
            });
            
            // Notify others after a short delay
            setTimeout(() => {
                socket.to(roomId).emit('peer-joined', {
                    peerId: socket.id,
                    displayName: displayName.trim()
                });
            }, 100);
            
            logger.info('Peer joined room', {
                roomId,
                peerId: socket.id,
                displayName: displayName.trim(),
                participantCount: room.getParticipantCount()
            });
            
        } catch (error) {
            logger.error('Join room failed:', error);
            callback({ 
                success: false, 
                error: error.message,
                code: 'JOIN_FAILED'
            });
        }
    });
    
    // Update RTP capabilities after device loads
    socket.on('update-rtp-capabilities', async (data, callback = () => {}) => {
        try {
            const { rtpCapabilities } = data;
            const roomId = socket.roomId;
            
            if (!roomId) {
                throw new Error('Not in a room');
            }
            
            const room = RoomManager.getRoom(roomId);
            if (!room) {
                throw new Error('Room not found');
            }
            
            const peer = room.getPeer(socket.id);
            if (peer) {
                peer.rtpCapabilities = rtpCapabilities;
                callback({ success: true });
                logger.info('Updated RTP capabilities', { socketId: socket.id });
            } else {
                throw new Error('Peer not found in room');
            }
            
        } catch (error) {
            logger.error('Update RTP capabilities failed:', error);
            callback({ success: false, error: error.message });
        }
    });
    
    socket.on('create-transport', async (data, callback = () => {}) => {
        try {
            const { direction } = data; // 'send' or 'recv'
            const roomId = socket.roomId;
            
            if (!roomId) {
                throw new Error('Not in a room');
            }
            
            const room = RoomManager.getRoom(roomId);
            if (!room) {
                throw new Error('Room not found');
            }
            
            const transport = await room.createTransport(socket.id, direction);
            
            callback({
                success: true,
                params: {
                    id: transport.id,
                    iceParameters: transport.iceParameters,
                    iceCandidates: transport.iceCandidates,
                    dtlsParameters: transport.dtlsParameters
                }
            });
            
        } catch (error) {
            logger.error('Create transport failed:', error);
            callback({ success: false, error: error.message });
        }
    });
    
    socket.on('connect-transport', async (data, callback = () => {}) => {
        try {
            const { transportId, dtlsParameters } = data;
            const roomId = socket.roomId;
            
            const room = RoomManager.getRoom(roomId);
            await room.connectTransport(socket.id, transportId, dtlsParameters);
            
            callback({ success: true });
            
        } catch (error) {
            logger.error('Connect transport failed:', error);
            callback({ success: false, error: error.message });
        }
    });
    
    socket.on('produce', async (data, callback = () => {}) => {
        try {
            const { kind, rtpParameters, transportId, appData } = data;
            const roomId = socket.roomId;
            
            const room = RoomManager.getRoom(roomId);
            const producer = await room.createProducer(
                socket.id,
                transportId,
                kind,
                rtpParameters,
                appData
            );
            
            callback({ success: true, id: producer.id });
            
            // Notify others
            socket.to(roomId).emit('new-producer', {
                producerId: producer.id,
                peerId: socket.id,
                kind,
                appData
            });
            
        } catch (error) {
            logger.error('Produce failed:', error);
            callback({ success: false, error: error.message });
        }
    });
    
    socket.on('consume', async (data, callback = () => {}) => {
        try {
            const { producerId, rtpCapabilities, transportId } = data;
            const roomId = socket.roomId;
            
            const room = RoomManager.getRoom(roomId);
            const { consumer, params } = await room.createConsumer(
                socket.id,
                producerId,
                rtpCapabilities,
                transportId
            );
            
            callback({
                success: true,
                id: consumer.id,
                producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                ...params
            });
            
        } catch (error) {
            logger.error('Consume failed:', error);
            callback({ success: false, error: error.message });
        }
    });
    
    socket.on('resume-consumer', async (data, callback = () => {}) => {
        try {
            const { consumerId } = data;
            const roomId = socket.roomId;
            
            const room = RoomManager.getRoom(roomId);
            await room.resumeConsumer(socket.id, consumerId);
            
            callback({ success: true });
            
        } catch (error) {
            logger.error('Resume consumer failed:', error);
            callback({ success: false, error: error.message });
        }
    });
    
    socket.on('get-producers', async (data, callback = () => {}) => {
        try {
            const roomId = socket.roomId;
            const room = RoomManager.getRoom(roomId);
            const producers = room.getAllProducers();
            
            callback({ success: true, producers });
            
        } catch (error) {
            logger.error('Get producers failed:', error);
            callback({ success: false, error: error.message });
        }
    });
    
    // Add ping/pong for connection monitoring
    socket.on('ping', (data, callback = () => {}) => {
        callback({ success: true, timestamp: Date.now() });
    });
    
    // Leave room handler
    socket.on('leave-room', async (data = {}, callback = () => {}) => {
        try {
            const roomId = socket.roomId;
            
            if (!roomId) {
                callback({ success: true, message: 'Not in a room' });
                return;
            }
            
            const room = RoomManager.getRoom(roomId);
            if (room) {
                room.removePeer(socket.id);
                
                // Notify others
                socket.to(roomId).emit('peer-left', { 
                    peerId: socket.id,
                    displayName: socket.displayName 
                });
                
                logger.info('Peer left room', { 
                    socketId: socket.id, 
                    roomId,
                    displayName: socket.displayName
                });
                
                // Clean up empty room after delay
                if (room.getParticipantCount() === 0) {
                    setTimeout(() => {
                        if (room.getParticipantCount() === 0) {
                            RoomManager.removeRoom(roomId);
                            logger.info('Room removed after empty', { roomId });
                        }
                    }, 30000);
                }
            }
            
            // Leave socket room
            socket.leave(roomId);
            delete socket.roomId;
            delete socket.peerId;
            delete socket.displayName;
            
            // Update connected clients
            if (connectedClients.has(socket.id)) {
                connectedClients.set(socket.id, {
                    ...connectedClients.get(socket.id),
                    leftAt: new Date(),
                    roomId: null
                });
            }
            
            callback({ success: true, message: 'Left room successfully' });
            
        } catch (error) {
            logger.error('Leave room failed:', error);
            callback({ success: false, error: error.message });
        }
    });
    
    socket.on('disconnect', () => {
        const roomId = socket.roomId;
        
        if (roomId) {
            const room = RoomManager.getRoom(roomId);
            if (room) {
                room.removePeer(socket.id);
                
                // Notify others
                socket.to(roomId).emit('peer-left', { 
                    peerId: socket.id,
                    displayName: socket.displayName 
                });
                
                // Clean up empty room after delay
                if (room.getParticipantCount() === 0) {
                    setTimeout(() => {
                        if (room.getParticipantCount() === 0) {
                            RoomManager.removeRoom(roomId);
                        }
                    }, 30000);
                }
            }
            
            logger.info('Client disconnected from room', { 
                socketId: socket.id, 
                roomId,
                displayName: socket.displayName
            });
        }
        
        // Remove from connected clients
        connectedClients.delete(socket.id);
        
        logger.info('Client disconnected', { socketId: socket.id });
    });
    
    // Error handling
    socket.on('error', (error) => {
        logger.error('Socket error:', error);
    });
});

// Initialize mediasoup worker
createWorker().then(() => {
    server.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`CORS Origin: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
    });
}).catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
    logger.info('Shutting down gracefully...');
    
    io.close(() => {
        logger.info('Socket.IO closed');
        server.close(() => {
            logger.info('HTTP server closed');
            process.exit(0);
        });
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
}

module.exports = { server, io };