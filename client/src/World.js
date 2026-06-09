// World.js - управление игровым миром (адаптировано из isometric-rpg)
import * as THREE from 'three';
import { GameObject } from './GameObject.js';
import { Player } from './Player.js';
import { getKey, isInBounds } from './utils.js';

const textureLoader = new THREE.TextureLoader();

export class World extends THREE.Group {
    #objectMap = new Map(); // "x,z" -> GameObject
    width;
    height;
    terrain;
    objects;
    players;
    props;


    constructor(width, height) {
        super();
        this.width = width;
        this.height = height;

        this.objects = new THREE.Group();
        this.add(this.objects);

        this.players = new THREE.Group();
        this.objects.add(this.players);

        this.props = new THREE.Group();
        this.objects.add(this.props);

        this.generate();
    }

    generate() {
        this.clear();
        this.createTerrain();
        // Декор можно добавить позже: this.createTrees(), etc.
    }

    clear() {
        if (this.terrain) {
            this.terrain.geometry?.dispose();
            this.terrain.material?.dispose();
            this.remove(this.terrain);
        }
        this.players?.clear();
        this.props?.clear();
        this.#objectMap.clear();
    }

    createTerrain() {
        // // Загрузка текстуры сетки (как в оригинале)
        // const gridTexture = textureLoader.load('textures/grid.png');
        // gridTexture.repeat = new THREE.Vector2(this.width, this.height);
        // gridTexture.wrapS = THREE.RepeatWrapping;
        // gridTexture.wrapT = THREE.RepeatWrapping;
        // gridTexture.colorSpace = THREE.SRGBColorSpace;

        // const terrainMaterial = new THREE.MeshStandardMaterial({
        //   map: gridTexture,
        //   metalness: 0.1,
        //   roughness: 0.8
        // });

        // const terrainGeometry = new THREE.BoxGeometry(this.width, 0.2, this.height);
        // this.terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
        // this.terrain.name = 'Terrain';
        // this.terrain.position.set(this.width / 2, -0.1, this.height / 2);
        // this.terrain.receiveShadow = true;
        // this.add(this.terrain);
        const terrainMaterial = new THREE.MeshStandardMaterial({
            color: 0x44aa44, // Зелёный цвет
            metalness: 0.1,
            roughness: 0.8
        });

        const terrainGeometry = new THREE.BoxGeometry(this.width, 0.2, this.height);
        this.terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
        this.terrain.name = 'Terrain';

        // Центрируем землю
        this.terrain.position.set(this.width / 2, -0.1, this.height / 2);
        this.terrain.receiveShadow = true;
        this.add(this.terrain);
    }


    addObject(object, group) {
        const key = getKey(object.coords);

        // Не размещать объекты друг на друге
        if (this.#objectMap.has(key)) {
            console.warn(`[World] Клетка ${key} уже занята`);
            return false;
        }

        // Добавляем в соответствующую группу
        switch (group) {
            case 'players':
                this.players.add(object);
                break;
            case 'props':
                this.props.add(object);
                break;
            default:
                this.objects.add(object);
        }

        // Подписываемся на события объекта
        object.world = this; // Ссылка на мир для проверок коллизий

        object.onMove = (obj, oldCoords, newCoords) => {
            this.#objectMap.delete(getKey(oldCoords));
            this.#objectMap.set(getKey(newCoords), obj);
        };

        object.onDestroy = (obj) => {
            this.#objectMap.delete(getKey(obj.coords));
            obj.removeFromParent();
        };

        this.#objectMap.set(key, object);
        return true;
    }


    canMoveTo(x, z, mover) {
        if (!isInBounds(x, z, this.width, this.height)) {
            return false;
        }

        const key = `${x},${z}`;
        const existing = this.#objectMap.get(key);

        // Можно двигаться на свою текущую позицию (но это бессмысленно)
        if (existing === mover) return true;

        // Нельзя двигаться на занятую блокирующую клетку
        if (existing && existing.isBlocking?.()) {
            return false;
        }

        return true;
    }


    getObject(coords) {
        return this.#objectMap.get(getKey(coords)) ?? null;
    }

    getPlayers() {
        const players = [];
        this.players.traverse(child => {
            if (child instanceof Player) {
                players.push(child);
            }
        });
        return players;
    }


    syncPlayerPosition(playerId, x, z) {
        const players = this.getPlayers();
        const player = players.find(p => p.playerId === playerId);

        if (player) {
            // Для удалённых игроков: телепорт для мгновенной синхронизации
            if (!player.isLocal) {
                player.teleport(x, z);
            }
            // Локальный игрок синхронизируется через подтверждение сервера
        }
    }
}
