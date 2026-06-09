// GameObject.js - базовый класс для всех объектов
import * as THREE from 'three';
import { getKey } from './utils.js';

export class GameObject extends THREE.Group {
  coords;
  name = 'GameObject';
  onMove = null;
  onDestroy = null;

  constructor(coords) {
    super();
    this.coords = coords.clone();
    this.position.copy(coords);
    this.userData.isGameObject = true;
  }

  moveTo(newCoords) {
    const oldKey = getKey(this.coords.x, this.coords.z);
    const newKey = getKey(newCoords.x, newCoords.z);
    
    if (oldKey === newKey) return false;
    
    const oldCoords = this.coords.clone();
    this.coords = newCoords.clone();
    this.position.copy(newCoords);
    
    if (this.onMove) {
      this.onMove(this, oldCoords, newCoords);
    }
    
    return true;
  }

  destroy() {
    if (this.onDestroy) {
      this.onDestroy(this);
    }
    this.removeFromParent();
  }

  isBlocking() {
    return true;
  }
}
