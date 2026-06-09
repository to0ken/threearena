// NetworkManager.js - чистая обёртка над Socket.io
import { io } from 'socket.io-client';

export class NetworkManager {
  constructor(serverUrl, callbacks = {}) {
    this.socket = io(serverUrl, {
      transports: ['websocket'],
      reconnection: true
    });
    
    this.callbacks = callbacks;
    this.roomId = null;
    
    this.setupListeners();
  }

  setupListeners() {
    this.socket.on('connect', () => {
      console.log('[Network] Connected to server');
    });

    this.socket.on('roomState', (data) => {
      this.callbacks.onRoomState?.(data);
    });

    this.socket.on('playerMoved', (data) => {
      this.callbacks.onPlayerMoved?.(data);
    });

    this.socket.on('playerJoined', (data) => {
      this.callbacks.onPlayerJoined?.(data);
    });

    this.socket.on('playerLeft', (data) => {
      this.callbacks.onPlayerLeft?.(data);
    });

    this.socket.on('error', ({ message }) => {
      console.error('[Network] Error:', message);
    });
  }

  joinRoom(roomId, playerId) {
    this.roomId = roomId;
    this.socket.emit('joinRoom', { roomId, playerId });
  }

  sendMove(dx, dz) {
    if (!this.roomId) return;
    this.socket.emit('move', { roomId: this.roomId, dx, dz });
  }

  disconnect() {
    this.socket.disconnect();
  }
}
