// InputManager.js - обработка ввода (рейкастинг + клавиатура)
import * as THREE from 'three';
import { updateStatus, getKey } from './utils.js';

export class InputManager {

  raycaster = new THREE.Raycaster();
  camera = null;
  world = null;
  localPlayer = null;
  sendMoveToServer = null;
  
  // Состояние клавиш
  keys = {
    up: false,
    down: false,
    left: false,
    right: false
  };

  constructor() {
    // Рейкастер не учитывает слой камеры для OrbitControls
    this.raycaster.layers.disable(1);
  }


  initialize(camera, world, localPlayer, sendMoveToServer) {
    this.camera = camera;
    this.world = world;
    this.localPlayer = localPlayer;
    this.sendMoveToServer = sendMoveToServer;
    
    this.setupKeyboard();
    this.setupRaycasting();
  }

  setupKeyboard() {
    // Обработка нажатий
    document.addEventListener('keydown', (e) => {
      if (!this.localPlayer?.isLocal || this.localPlayer.isMoving) return;
      
      switch (e.code) {
        case 'ArrowUp': case 'KeyW': this.keys.up = true; break;
        case 'ArrowDown': case 'KeyS': this.keys.down = true; break;
        case 'ArrowLeft': case 'KeyA': this.keys.left = true; break;
        case 'ArrowRight': case 'KeyD': this.keys.right = true; break;
      }
      
      // Обработка движения (только если игрок не двигается)
      if (!this.localPlayer.isMoving) {
        this.handleKeyboardMove();
      }
    });

    document.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'ArrowUp': case 'KeyW': this.keys.up = false; break;
        case 'ArrowDown': case 'KeyS': this.keys.down = false; break;
        case 'ArrowLeft': case 'KeyA': this.keys.left = false; break;
        case 'ArrowRight': case 'KeyD': this.keys.right = false; break;
      }
    });
  }

  handleKeyboardMove() {
    let dx = 0, dz = 0;
    
    if (this.keys.up) dz = -1;
    else if (this.keys.down) dz = 1;
    else if (this.keys.left) dx = -1;
    else if (this.keys.right) dx = 1;
    
    if (dx !== 0 || dz !== 0) {
      this.localPlayer.requestMove(dx, dz, this.sendMoveToServer);
    }
  }

  setupRaycasting() {
    // Клик для пошагового движения (как в оригинале)
    this.camera.domElement?.addEventListener?.('click', async (event) => {
      if (!this.localPlayer?.isLocal || this.localPlayer.isMoving) return;
      
      const target = await this.getTargetSquare(event);
      if (!target) return;
      
      const dx = target.x - Math.floor(this.localPlayer.coords.x);
      const dz = target.z - Math.floor(this.localPlayer.coords.z);
      
      // Разрешаем только движение на соседнюю клетку
      if (Math.abs(dx) + Math.abs(dz) === 1) {
        this.localPlayer.requestMove(dx, dz, this.sendMoveToServer);
      }
    });
  }


  async getTargetSquare(event) {
    updateStatus('Выберите клетку для движения');
    
    return new Promise((resolve) => {
      const coords = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
      );
      
      this.raycaster.setFromCamera(coords, this.camera);
      const intersections = this.raycaster.intersectObject(this.world.terrain);
      
      if (intersections.length > 0) {
        const point = intersections[0].point;
        const selectedCoords = new THREE.Vector3(
          Math.floor(point.x),
          0,
          Math.floor(point.z)
        );
        resolve(selectedCoords);
      } else {
        resolve(null);
      }
    });
  }


  update(delta) {
    // Авто-повтор движения при удержании клавиши
    if (this.localPlayer?.isLocal && !this.localPlayer.isMoving) {
      this.handleKeyboardMove();
    }
  }
}
