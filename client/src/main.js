// client/src/main.js - ПОЛНОСТЬЮ РАБОЧАЯ ВЕРСИЯ
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { io } from 'socket.io-client';

console.log('🎮 IsoArena запускается...');

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let scene, camera, renderer, controls;
let socket;
let localPlayer = null;
let remotePlayer = null;
let roomId = null;
let isGameActive = false;

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
function init() {
  console.log('📦 Создание сцены...');
  
  // 1. Сцена
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  
  // 2. Камера
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 10, 10);
  
  // 3. Рендерер
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);
  
  // 4. Свет
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  dirLight.castShadow = true;
  scene.add(dirLight);
  
  // 5. Земля
  const groundGeo = new THREE.PlaneGeometry(20, 20);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x44aa44 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  
  // 6. Сетка
  const grid = new THREE.GridHelper(20, 20, 0x000000, 0x000000);
  grid.material.opacity = 0.15;
  grid.material.transparent = true;
  scene.add(grid);
  
  // 7. Контролы камеры
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  
  // 8. Сокет
  socket = io('http://localhost:3001');
  setupSocket();
  
  // 9. UI и управление
  setupUI();
  setupControls();
  
  // 10. Цикл
  animate();
  console.log('✅ Готово! Подключайтесь к комнате.');
}

// ==================== СОКЕТ ====================
function setupSocket() {
  socket.on('connect', () => {
    console.log('✅ Сокет подключён');
  });
  
  socket.on('roomState', (data) => {
    console.log(' Получено состояние комнаты:', data);
    roomId = data.roomId;
    
    // Очищаем
    if (localPlayer) scene.remove(localPlayer.mesh);
    if (remotePlayer) scene.remove(remotePlayer.mesh);
    localPlayer = null;
    remotePlayer = null;
    
    // Создаём игроков
    data.players.forEach(p => {
      if (p.id === window.currentPlayerId) {
        spawnLocalPlayer(p.x, p.y);
      } else {
        spawnRemotePlayer(p.id, p.x, p.y);
      }
    });
    
    // Обновляем UI
    document.getElementById('players-count').textContent = data.players.length;
    isGameActive = true;
  });
  
  socket.on('playerMoved', (data) => {
    console.log('🚶 Игрок', data.id, '→', data.x, data.y);
    
    // Обновляем локального игрока (сервер подтвердил)
    if (localPlayer && data.id === localPlayer.id) {
      localPlayer.mesh.position.set(data.x, 0.5, data.y);
      localPlayer.x = data.x;
      localPlayer.z = data.y;
    }
    
    // Обновляем удалённого игрока
    if (remotePlayer && data.id === remotePlayer.id) {
      remotePlayer.mesh.position.set(data.x, 0.5, data.y);
    }
  });
  
  socket.on('playerJoined', (data) => {
    console.log('👋 Новый игрок:', data.id);
    if (data.id !== window.currentPlayerId) {
      spawnRemotePlayer(data.id, data.x, data.y);
      document.getElementById('players-count').textContent = '2';
    }
  });
  
  socket.on('playerLeft', (data) => {
    console.log(' Игрок ушёл:', data.id);
    if (remotePlayer && remotePlayer.id === data.id) {
      scene.remove(remotePlayer.mesh);
      remotePlayer = null;
      document.getElementById('players-count').textContent = '1';
    }
  });
}

// ==================== ИГРОКИ ====================
function spawnLocalPlayer(x, z) {
  console.log(`🎮 Создание локального игрока на (${x}, ${z})`);
  
  const geo = new THREE.BoxGeometry(0.8, 1, 0.8);
  const mat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, 0.5, z);
  mesh.castShadow = true;
  
  // Индикатор "Я"
  const ringGeo = new THREE.RingGeometry(0.6, 0.7, 16);
  const ringMat = new THREE.MeshBasicMaterial({ 
    color: 0x64ffda, 
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.49;
  mesh.add(ring);
  
  scene.add(mesh);
  
  localPlayer = { id: window.currentPlayerId, mesh, x, z };
  
  //  КАМЕРА СРАЗУ НА ИГРОКА!
  updateCameraToPlayer(localPlayer);
  
  console.log('✅ Локальный игрок создан, камера направлена на него');
}

function spawnRemotePlayer(id, x, z) {
  console.log(`👤 Создание удалённого игрока ${id} на (${x}, ${z})`);
  
  const geo = new THREE.BoxGeometry(0.8, 1, 0.8);
  const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, 0.5, z);
  mesh.castShadow = true;
  
  // Имя над головой
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, 128, 32);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Игрок ${id}`, 64, 22);
  
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.y = 1.5;
  sprite.scale.set(2, 0.5, 1);
  mesh.add(sprite);
  
  scene.add(mesh);
  remotePlayer = { id, mesh };
  
  console.log('✅ Удалённый игрок создан');
}

function updateCameraToPlayer(player) {
  // Камера сзади-сверху игрока
  camera.position.set(player.x, 8, player.z + 8);
  camera.lookAt(player.x, 0, player.z);
  controls.target.set(player.x, 0, player.z);
  controls.update();
}

// ==================== УПРАВЛЕНИЕ ====================
function setupControls() {
  window.addEventListener('keydown', (e) => {
    if (!isGameActive || !localPlayer) return;
    
    let dx = 0, dz = 0;
    
    switch(e.code) {
      case 'ArrowUp': case 'KeyW': dz = -1; break;
      case 'ArrowDown': case 'KeyS': dz = 1; break;
      case 'ArrowLeft': case 'KeyA': dx = -1; break;
      case 'ArrowRight': case 'KeyD': dx = 1; break;
      default: return;
    }
    
    e.preventDefault();
    movePlayer(dx, dz);
  });
}

function movePlayer(dx, dz) {
  const newX = localPlayer.x + dx;
  const newZ = localPlayer.z + dz;
  
  // Проверка границ
  if (newX < 0 || newX >= 20 || newZ < 0 || newZ >= 20) {
    console.log('⚠️ Выход за границы карты');
    return;
  }
  
  // Отправляем на сервер
  socket.emit('move', { roomId, dx, dz });
  
  // Локальное обновление позиции
  localPlayer.x = newX;
  localPlayer.z = newZ;
  
  // Обновляем камеру за игроком
  updateCameraToPlayer(localPlayer);
}

// ==================== UI ====================
function setupUI() {
  const form = document.getElementById('room-form');
  if (!form) return;
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const room = document.getElementById('room-input').value.trim();
    const player = parseInt(document.getElementById('player-input').value);
    
    if (!room || ![1, 2].includes(player)) {
      alert('Введите комнату и номер игрока (1 или 2)');
      return;
    }
    
    window.currentPlayerId = player;
    form.classList.add('hidden');
    
    document.getElementById('room-display').textContent = room;
    document.getElementById('player-display').textContent = player;
    
    console.log(`🔌 Подключение к комнате "${room}" как игрок ${player}`);
    socket.emit('joinRoom', { roomId: room, playerId: player });
  });
}

// ==================== ЦИКЛ ====================
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// ==================== РЕСАЙЗ ====================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ==================== ЗАПУСК ====================
init();
