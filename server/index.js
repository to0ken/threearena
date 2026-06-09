/**
 * 🎮 IsoArena Server
 * WebSocket сервер для синхронизации 2 игроков в изометрической игре
 * 
 * Совместим с клиентом из client/src/main.js
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

// Загрузка переменных окружения
dotenv.config();

// ==================== КОНФИГУРАЦИЯ ====================
const CONFIG = {
  port: parseInt(process.env.PORT) || 3001,
  allowedOrigins: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  gridSize: 20,
  maxPlayersPerRoom: 2,
  playerColors: {
    1: 0x00aa44,  // Зелёный для игрока 1
    2: 0xaa3333   // Красный для игрока 2
  }
};

// ==================== EXPRESS + HTTP ====================
const app = express();
const httpServer = createServer(app);

// CORS настройка для поддержки разных устройств
const corsOptions = {
  origin: (origin, callback) => {
    // Разрешаем запросы без origin (мобильные, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (CONFIG.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.warn(`⚠️ CORS blocked: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST']
};

app.use(cors(corsOptions));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    rooms: rooms.size,
    totalPlayers: Array.from(rooms.values()).reduce(
      (sum, room) => sum + room.players.size, 0
    )
  });
});

// Список активных комнат (для отладки)
app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.entries()).map(([id, room]) => ({
    id,
    players: room.players.size,
    maxPlayers: CONFIG.maxPlayersPerRoom,
    createdAt: room.createdAt
  }));
  res.json(roomList);
});

// ==================== SOCKET.IO ====================
const io = new Server(httpServer, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

// ==================== ИГРОВАЯ ЛОГИКА ====================

/**
 * Класс игровой комнаты
 * Авторитетный сервер: вся валидация на сервере
 */
class GameRoom {
  constructor(id) {
    this.id = id;
    this.players = new Map(); // socketId -> PlayerData
    this.occupied = new Set(); // "x,y" -> занятые клетки
    this.gridSize = CONFIG.gridSize;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
  }

  /**
   * Генерирует уникальную свободную позицию
   */
  #findFreePosition() {
    let attempts = 0;
    const maxAttempts = 100;
    
    do {
      const x = Math.floor(Math.random() * this.gridSize);
      const y = Math.floor(Math.random() * this.gridSize);
      
      if (!this.occupied.has(`${x},${y}`)) {
        return { x, y };
      }
      attempts++;
    } while (attempts < maxAttempts);
    
    // Если не нашли свободную — возвращаем дефолтную
    return { x: 0, y: 0 };
  }

  /**
   * Добавляет игрока в комнату
   */
  addPlayer(socketId, playerId) {
    // Проверяем, не занят ли слот другим игроком
    const existing = Array.from(this.players.values())
      .find(p => p.id === playerId && p.socketId !== socketId);
    
    if (existing) {
      throw new Error(`Игрок ${playerId} уже в комнате`);
    }

    // Находим позицию
    const { x, y } = this.#findFreePosition();
    
    // Создаём данные игрока
    const player = {
      id: playerId,
      socketId,
      x,
      y,
      color: CONFIG.playerColors[playerId] || 0x888888,
      name: `Player ${playerId}`,
      joinedAt: Date.now()
    };

    // Добавляем в комнату
    this.players.set(socketId, player);
    this.occupied.add(`${x},${y}`);
    this.lastActivity = Date.now();

    console.log(`🎮 [${this.id}] Игрок ${playerId} присоединился на (${x},${y})`);
    return player;
  }

  /**
   * Удаляет игрока из комнаты
   */
  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (!player) return null;

    // Освобождаем клетку
    this.occupied.delete(`${player.x},${player.y}`);
    this.players.delete(socketId);
    this.lastActivity = Date.now();

    console.log(`👋 [${this.id}] Игрок ${player.id} покинул комнату`);
    return player;
  }

  /**
   * Обрабатывает движение игрока с валидацией
   */
  movePlayer(socketId, dx, dy) {
    const player = this.players.get(socketId);
    if (!player) return null;

    const newX = player.x + dx;
    const newY = player.y + dy;
    const newKey = `${newX},${newY}`;

    // Валидация: границы карты
    if (newX < 0 || newX >= this.gridSize || newY < 0 || newY >= this.gridSize) {
      console.log(`⚠️ [${this.id}] Выход за границы: (${newX},${newY})`);
      return null;
    }

    // Валидация: коллизия с другим игроком
    if (this.occupied.has(newKey)) {
      const blocker = Array.from(this.players.values())
        .find(p => `${p.x},${p.y}` === newKey);
      
      if (blocker && blocker.socketId !== socketId) {
        console.log(`⚠️ [${this.id}] Клетка занята игроком ${blocker.id}`);
        return null;
      }
    }

    // Обновляем позицию
    this.occupied.delete(`${player.x},${player.y}`);
    player.x = newX;
    player.y = newY;
    this.occupied.add(newKey);
    this.lastActivity = Date.now();

    console.log(`🚶 [${this.id}] Игрок ${player.id}: (${player.x},${player.y})`);
    
    return {
      id: player.id,
      x: player.x,
      y: player.y
    };
  }

  /**
   * Возвращает состояние комнаты для клиента
   */
  getState() {
    return {
      roomId: this.id,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        x: p.x,
        y: p.y,
        color: p.color,
        name: p.name
      }))
    };
  }

  /**
   * Проверяет, пуста ли комната
   */
  isEmpty() {
    return this.players.size === 0;
  }

  /**
   * Рассылает событие всем игрокам в комнате
   */
  broadcast(event, data, excludeSocketId = null) {
    for (const [socketId] of this.players) {
      if (socketId !== excludeSocketId) {
        io.to(socketId).emit(event, data);
      }
    }
  }
}

// Хранилище комнат: { roomId: GameRoom }
const rooms = new Map();

// ==================== ОБРАБОТЧИКИ SOCKET.IO ====================

io.on('connection', (socket) => {
  const clientIp = socket.handshake.address;
  console.log(`🔌 Подключение: ${socket.id} с ${clientIp}`);

  // ------------------- joinRoom -------------------
  socket.on('joinRoom', ({ roomId, playerId }) => {
    console.log(`📥 Запрос: joinRoom(${roomId}, ${playerId}) от ${socket.id}`);

    try {
      // Валидация входных данных
      if (!roomId || typeof roomId !== 'string' || roomId.length < 2 || roomId.length > 20) {
        throw new Error('Название комнаты должно быть от 2 до 20 символов');
      }

      if (![1, 2].includes(playerId)) {
        throw new Error('Игрок должен быть 1 или 2');
      }

      // Создаём комнату если нужно
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new GameRoom(roomId));
        console.log(`🆕 Создана комната: ${roomId}`);
      }

      const room = rooms.get(roomId);

      // Проверяем лимит игроков
      if (room.players.size >= CONFIG.maxPlayersPerRoom) {
        throw new Error('Комната заполнена (макс. 2 игрока)');
      }

      // Добавляем игрока
      const player = room.addPlayer(socket.id, playerId);
      
      // Присоединяем сокет к комнате Socket.io
      socket.join(roomId);

      // Отправляем состояние комнаты этому игроку
      socket.emit('roomState', room.getState());
      console.log(`📤 Отправлено roomState игроку ${playerId}`);

      // Уведомляем ДРУГИХ игроков о новом участнике
      socket.to(roomId).emit('playerJoined', {
        id: player.id,
        x: player.x,
        y: player.y,
        color: player.color,
        name: player.name
      });
      console.log(`📤 Уведомлены другие игроки о присоединении ${playerId}`);

    } catch (error) {
      console.error(`❌ Ошибка joinRoom: ${error.message}`);
      socket.emit('error', { message: error.message });
    }
  });

  // ------------------- move -------------------
  socket.on('move', ({ roomId, dx, dy }) => {
    // Валидация направления
    const validMoves = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 },  // вверх/вниз
      { dx: -1, dy: 0 }, { dx: 1, dy: 0 }   // влево/вправо
    ];
    
    const isValid = validMoves.some(m => m.dx === dx && m.dy === dy);
    if (!isValid) {
      console.warn(`⚠️ Неверное направление движения: (${dx},${dy})`);
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      console.warn(`⚠️ Комната не найдена: ${roomId}`);
      return;
    }

    const result = room.movePlayer(socket.id, dx, dy);
    
    if (result) {
      // Рассылаем обновление ВСЕМ игрокам в комнате (включая отправителя)
      // Это нужно для синхронизации и подтверждения движения
      io.to(roomId).emit('playerMoved', result);
      console.log(`📤 Расслано playerMoved: игрок ${result.id} -> (${result.x},${result.y})`);
    }
    // Если движение отклонено — ничего не отправляем (игрок останется на месте)
  });

  // ------------------- requestState (опционально) -------------------
  socket.on('requestState', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room) {
      socket.emit('roomState', room.getState());
      console.log(`📤 Отправлено roomState по запросу`);
    }
  });

  // ------------------- Отключение игрока -------------------
  socket.on('disconnecting', () => {
    console.log(`🔌 Отключение: ${socket.id}`);
    
    // Проходим по всем комнатам, к которым присоединён сокет
    for (const roomId of socket.rooms) {
      // Пропускаем личный room сокета
      if (roomId === socket.id) continue;
      
      const room = rooms.get(roomId);
      if (!room) continue;

      const player = room.removePlayer(socket.id);
      
      if (player) {
        // Уведомляем остальных игроков
        socket.to(roomId).emit('playerLeft', { id: player.id });
        console.log(`📤 Уведомлены игроки об уходе ${player.id}`);
      }

      // Удаляем пустую комнату
      if (room.isEmpty()) {
        rooms.delete(roomId);
        console.log(`🗑️ Удалена пустая комната: ${roomId}`);
      }
    }
  });

  // ------------------- Обработка ошибок сокета -------------------
  socket.on('error', (error) => {
    console.error(`❌ Socket error ${socket.id}:`, error);
  });
});

// ==================== ЗАПУСК СЕРВЕРА ====================

function startServer() {
  httpServer.listen(CONFIG.port, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(50));
    console.log('🎮 IsoArena Server запущен!');
    console.log('='.repeat(50));
    console.log(`📡 Порт: ${CONFIG.port}`);
    console.log(`🌐 HTTP: http://localhost:${CONFIG.port}`);
    console.log(`🔌 WebSocket: ws://localhost:${CONFIG.port}`);
    console.log(`🔍 Health: http://localhost:${CONFIG.port}/health`);
    console.log(`📋 Rooms: http://localhost:${CONFIG.port}/api/rooms`);
    console.log(`🎯 CORS: ${CONFIG.allowedOrigins.join(', ')}`);
    
    // Показываем локальные IP для подключения с других устройств
    import('os').then(({ networkInterfaces }) => {
      const interfaces = networkInterfaces();
      const ips = Object.values(interfaces)
        .flat()
        .filter(i => i && !i.internal && i.family === 'IPv4')
        .map(i => i.address);
      
      if (ips.length > 0) {
        console.log(`\n📱 Для подключения с телефона/другого ПК:`);
        ips.forEach(ip => {
          console.log(`   🌐 http://${ip}:${CONFIG.port}`);
        });
      }
    });
    
    console.log('='.repeat(50) + '\n');
  });

  // Обработка ошибок сервера
  httpServer.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Порт ${CONFIG.port} уже занят!`);
      console.log('💡 Решение:');
      console.log('   1. Закройте другой процесс: lsof -ti:3001 | xargs kill -9');
      console.log('   2. Или измените PORT в server/.env');
    } else {
      console.error('❌ Ошибка сервера:', error);
    }
    process.exit(1);
  });
}

// ==================== GRACEFUL SHUTDOWN ====================

function gracefulShutdown(signal) {
  console.log(`\n🛑 Получен сигнал ${signal}. Завершение работы...`);
  
  // Закрываем HTTP сервер
  httpServer.close(() => {
    console.log('✅ HTTP сервер остановлен');
    
    // Отключаем все сокеты
    io.close(() => {
      console.log('✅ Все WebSocket соединения закрыты');
      console.log('👋 Сервер завершил работу');
      process.exit(0);
    });
  });

  // Принудительное завершение через 10 секунд
  setTimeout(() => {
    console.error('⚠️ Принудительное завершение через 10с...');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ==================== START ====================
startServer();
