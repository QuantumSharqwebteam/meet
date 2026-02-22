const mediasoup = require('mediasoup');
const config = require('./config/mediasoupConfig');
const logger = require('./utils/logger');

let worker = null;
const rooms = new Map();

class Peer {
    constructor(id, socket, displayName) {
        this.id = id;
        this.socket = socket;
        this.displayName = displayName;
        this.transports = new Map();
        this.producers = new Map();
        this.consumers = new Map();
        this.rtpCapabilities = null;
        this.joinedAt = new Date();
    }
    
    addTransport(id, transport) {
        this.transports.set(id, transport);
    }
    
    getTransport(id) {
        return this.transports.get(id);
    }
    
    addProducer(id, producer) {
        this.producers.set(id, producer);
        return producer;
    }
    
    getProducer(id) {
        return this.producers.get(id);
    }
    
    addConsumer(id, consumer) {
        this.consumers.set(id, consumer);
        return consumer;
    }
    
    getConsumer(id) {
        return this.consumers.get(id);
    }
    
    close() {
        // Close all transports
        this.transports.forEach(transport => {
            try {
                transport.close();
            } catch (error) {
                logger.error('Error closing transport:', error);
            }
        });
        
        // Close all producers
        this.producers.forEach(producer => {
            try {
                producer.close();
            } catch (error) {
                logger.error('Error closing producer:', error);
            }
        });
        
        // Close all consumers
        this.consumers.forEach(consumer => {
            try {
                consumer.close();
            } catch (error) {
                logger.error('Error closing consumer:', error);
            }
        });
        
        this.transports.clear();
        this.producers.clear();
        this.consumers.clear();
    }
}

class Room {
    constructor(roomId, roomName, maxParticipants = 10) {
        this.roomId = roomId;
        this.roomName = roomName;
        this.maxParticipants = maxParticipants;
        this.peers = new Map();
        this.router = null;
        this.createdAt = new Date();
        this.isActive = true;
    }
    
    async initialize() {
        this.router = await worker.createRouter(config.router);
    }
    
    // Update the addPeer method in Room class:
async addPeer(peerId, { socket, displayName, rtpCapabilities }) {
    if (this.peers.size >= this.maxParticipants) {
        throw new Error('Room is full');
    }
    
    const peer = new Peer(peerId, socket, displayName);
    peer.rtpCapabilities = rtpCapabilities;
    this.peers.set(peerId, peer);
    
    return peer;
}
    
    removePeer(peerId) {
        const peer = this.peers.get(peerId);
        if (peer) {
            peer.close();
            this.peers.delete(peerId);
        }
    }
    
    getPeer(peerId) {
        return this.peers.get(peerId);
    }
    
    getOtherPeers(peerId) {
        const otherPeers = [];
        this.peers.forEach((peer, id) => {
            if (id !== peerId) {
                otherPeers.push({
                    id: peer.id,
                    displayName: peer.displayName,
                    producers: Array.from(peer.producers.values())
                });
            }
        });
        return otherPeers;
    }
    
    getAllProducers() {
        const producers = [];
        this.peers.forEach(peer => {
            peer.producers.forEach(producer => {
                producers.push({
                    producerId: producer.id,
                    peerId: peer.id,
                    kind: producer.kind,
                    displayName: peer.displayName
                });
            });
        });
        return producers;
    }
    
    async createTransport(peerId, direction) {
        const peer = this.getPeer(peerId);
        if (!peer) throw new Error('Peer not found');
        
        const transport = await this.router.createWebRtcTransport({
            ...config.webRtcTransport,
            appData: { peerId, direction }
        });
        
        transport.on('dtlsstatechange', (dtlsState) => {
            if (dtlsState === 'closed') {
                transport.close();
            }
        });
        
        transport.on('close', () => {
            logger.info('Transport closed', { transportId: transport.id });
            peer.transports.delete(transport.id);
        });
        
        peer.addTransport(transport.id, transport);
        return transport;
    }
    
    async connectTransport(peerId, transportId, dtlsParameters) {
        const peer = this.getPeer(peerId);
        if (!peer) throw new Error('Peer not found');
        
        const transport = peer.getTransport(transportId);
        if (!transport) throw new Error('Transport not found');
        
        await transport.connect({ dtlsParameters });
    }
    
    async createProducer(peerId, transportId, kind, rtpParameters, appData = {}) {
        const peer = this.getPeer(peerId);
        if (!peer) throw new Error('Peer not found');
        
        const transport = peer.getTransport(transportId);
        if (!transport) throw new Error('Transport not found');
        
        const producer = await transport.produce({
            kind,
            rtpParameters,
            appData: { ...appData, peerId }
        });
        
        producer.on('transportclose', () => {
            producer.close();
            peer.producers.delete(producer.id);
        });
        
        peer.addProducer(producer.id, producer);
        return producer;
    }
    
    async createConsumer(peerId, producerId, rtpCapabilities, transportId) {
        const peer = this.getPeer(peerId);
        if (!peer) throw new Error('Peer not found');
        
        const producer = this.getProducerById(producerId);
        if (!producer) throw new Error('Producer not found');
        
        if (!this.router.canConsume({ producerId, rtpCapabilities })) {
            throw new Error('Cannot consume');
        }
        
        const transport = peer.getTransport(transportId);
        if (!transport) throw new Error('Transport not found');
        
        const consumer = await transport.consume({
            producerId,
            rtpCapabilities,
            paused: false
        });
        
        consumer.on('transportclose', () => {
            consumer.close();
            peer.consumers.delete(consumer.id);
        });
        
        peer.addConsumer(consumer.id, consumer);
        
        return {
            consumer,
            params: {
                producerId,
                id: consumer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                type: consumer.type
            }
        };
    }
    
    async resumeConsumer(peerId, consumerId) {
        const peer = this.getPeer(peerId);
        if (!peer) throw new Error('Peer not found');
        
        const consumer = peer.getConsumer(consumerId);
        if (!consumer) throw new Error('Consumer not found');
        
        await consumer.resume();
    }
    
    async toggleProducer(peerId, producerId, paused) {
        const peer = this.getPeer(peerId);
        if (!peer) throw new Error('Peer not found');
        
        const producer = peer.getProducer(producerId);
        if (!producer) throw new Error('Producer not found');
        
        if (paused) {
            await producer.pause();
        } else {
            await producer.resume();
        }
    }
    
    getProducerById(producerId) {
        for (const peer of this.peers.values()) {
            const producer = peer.getProducer(producerId);
            if (producer) return producer;
        }
        return null;
    }
    
    getParticipantCount() {
        return this.peers.size;
    }
    
    close() {
        this.peers.forEach(peer => peer.close());
        this.peers.clear();
        
        if (this.router) {
            this.router.close();
        }
        
        this.isActive = false;
    }
}

class RoomManager {
    static async createRoom({ roomId, roomName, maxParticipants }) {
        if (rooms.has(roomId)) {
            throw new Error('Room already exists');
        }
        
        const room = new Room(roomId, roomName, maxParticipants);
        await room.initialize();
        rooms.set(roomId, room);
        
        logger.info('Room created', { roomId, roomName });
        return room;
    }
    
    static getOrCreateRoom(roomId) {
        if (rooms.has(roomId)) {
            return rooms.get(roomId);
        }
        
        return this.createRoom({
            roomId,
            roomName: `Room ${roomId}`,
            maxParticipants: 10
        });
    }
    
    static getRoom(roomId) {
        return rooms.get(roomId);
    }
    
    static removeRoom(roomId) {
        const room = rooms.get(roomId);
        if (room) {
            room.close();
            rooms.delete(roomId);
            logger.info('Room removed', { roomId });
        }
    }
    
    static getAllRooms() {
        return Array.from(rooms.values());
    }
    
    static getRoomCount() {
        return rooms.size;
    }
}

async function createWorker() {
    worker = await mediasoup.createWorker(config.worker);
    
    worker.on('died', () => {
        logger.error('Mediasoup worker died, exiting...');
        process.exit(1);
    });
    
    logger.info('Mediasoup worker created', {
        pid: worker.pid,
        routerNum: config.router.mediaCodecs.length
    });
    
    return worker;
}

module.exports = {
    createWorker,
    RoomManager,
    rooms: rooms
};