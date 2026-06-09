// Player.js - класс игрока
import * as THREE from 'three';
import { GameObject } from './GameObject.js';

export class Player extends GameObject {
  playerId;
  isLocal;
  isMoving = false;
  moveTarget = null;
  moveSpeed = 0.1;

  constructor(coords, playerId, isLocal = false) {
    super(coords);
    this.playerId = playerId;
    this.isLocal = isLocal;
    this.name = `Player ${playerId}`;
    
    this.createMesh();
  }

  createMesh() {
    try {
      // Тело игрока
      const bodyGeo = new THREE.BoxGeometry(0.8, 1, 0.8);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: this.isLocal ? 0x00aa44 : 0xaa3333,
        metalness: 0.2,
        roughness: 0.6
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.5;
      body.castShadow = true;
      
      // ПРОВОЧКА: проверяем что body существует
      if (body) {
        this.add(body);
      } else {
        console.error('❌ Не удалось создать body mesh');
      }

      // Индикатор для локального игрока
      if (this.isLocal) {
        const indicatorGeo = new THREE.RingGeometry(0.5, 0.6, 16);
        const indicatorMat = new THREE.MeshBasicMaterial({
          color: 0x64ffda,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide
        });
        const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
        indicator.rotation.x = -Math.PI / 2;
        indicator.position.y = 0.01;
        
        if (indicator) {
          this.add(indicator);
        }
      }

      // Имя над головой для удалённых игроков
      if (!this.isLocal) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, 128, 32);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Игрок ${this.playerId}`, 64, 20);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.y = 1.6;
        sprite.scale.set(2, 0.5, 1);
        
        if (sprite) {
          this.add(sprite);
        }
      }
      
      console.log(`✅ Player ${this.playerId} mesh создан успешно`);
      
    } catch (error) {
      console.error('❌ Ошибка при создании mesh игрока:', error);
    }
  }

  async requestMove(dx, dz, sendToServer) {
    if (this.isMoving) return false;
    
    const targetX = Math.floor(this.coords.x + dx);
    const targetZ = Math.floor(this.coords.z + dz);
    
    if (!this.world || !this.world.canMoveTo(targetX, targetZ, this)) {
      return false;
    }
    
    if (this.isLocal && sendToServer) {
      sendToServer({ dx, dz });
      return true;
    }
    
    return this.startMoveAnimation(targetX, targetZ);
  }

  startMoveAnimation(targetX, targetZ) {
    this.moveTarget = new THREE.Vector3(targetX, 0, targetZ);
    this.isMoving = true;
    return true;
  }

  update(delta) {
    if (this.isMoving && this.moveTarget) {
      this.position.lerp(this.moveTarget, this.moveSpeed);
      
      if (this.position.distanceTo(this.moveTarget) < 0.01) {
        this.position.copy(this.moveTarget);
        this.coords.copy(this.moveTarget);
        this.isMoving = false;
        this.moveTarget = null;
        
        if (this.onMove) {
          this.onMove(this, this.coords.clone(), this.coords.clone());
        }
      }
    }
  }

  teleport(x, z) {
    this.coords.set(x, 0, z);
    this.position.set(x, 0, z);
    this.isMoving = false;
    this.moveTarget = null;
  }

  isBlocking() {
    return true;
  }
}
