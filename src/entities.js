// ============================================
// entities.js — ゲームエンティティ定義
// ============================================

import { GRAVITY, FRICTION, GROUND_FRICTION, STOP_THRESHOLD, MAX_VELOCITY, calcSquashStretch } from './physics.js';

// ============================================
// オブジェクトタイプ定数
// ============================================
export const OBJ_TYPE = {
  JELLY: 'jelly',         // ゼリーブロック（よく弾む、1HP）
  WOOD: 'wood',           // 木箱（普通、2HP）
  IRON: 'iron',           // 鉄箱（壊れない）
  GLASS: 'glass',         // ガラス（1HPだがスコアボーナス）
  TNT: 'tnt',             // TNT（爆発）
  SPRING: 'spring',       // バネ台（大ジャンプ）
  ENEMY: 'enemy',         // 敵（ワルぴよ）
  ENEMY_BOMB: 'enemy_bomb', // ボムぴよ（爆発）
  ENEMY_WARP: 'enemy_warp', // ワープぴよ（テレポート）
  ITEM_GIANT: 'item_giant', // 巨大化シャボン
  ITEM_SPLIT: 'item_split', // 分裂シャボン
};

// 各タイプのデフォルトプロパティ
const OBJ_DEFAULTS = {
  [OBJ_TYPE.JELLY]:  { hp: 1, restitution: 0.95, scoreValue: 50,  color: '#00ff88', breakable: true },
  [OBJ_TYPE.WOOD]:   { hp: 2, restitution: 0.6,  scoreValue: 100, color: '#c8956c', breakable: true },
  [OBJ_TYPE.IRON]:   { hp: Infinity, restitution: 0.85, scoreValue: 0, color: '#8899aa', breakable: false },
  [OBJ_TYPE.GLASS]:  { hp: 1, restitution: 0.4,  scoreValue: 200, color: '#aaddff', breakable: true },
  [OBJ_TYPE.TNT]:    { hp: 1, restitution: 0.3,  scoreValue: 150, color: '#ff4444', breakable: true },
  [OBJ_TYPE.SPRING]: { hp: Infinity, restitution: 1.5, scoreValue: 0, color: '#ffdd00', breakable: false },
  [OBJ_TYPE.ENEMY]:  { hp: 1, restitution: 0.5,  scoreValue: 500, color: '#ff6b9d', breakable: true },
  [OBJ_TYPE.ENEMY_BOMB]: { hp: 1, restitution: 0.5, scoreValue: 800, color: '#aa0000', breakable: true },
  [OBJ_TYPE.ENEMY_WARP]: { hp: 1, restitution: 0.5, scoreValue: 800, color: '#aa00ff', breakable: true },
  [OBJ_TYPE.ITEM_GIANT]: { hp: 1, restitution: 1.0, scoreValue: 100, color: '#ffffff', breakable: true },
  [OBJ_TYPE.ITEM_SPLIT]: { hp: 1, restitution: 1.0, scoreValue: 100, color: '#ffffaa', breakable: true },
};

// ============================================
// ゲルぴよ（プレイヤー弾）
// ============================================
export class Piyo {
  constructor(x, y, radius, imageKey) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.imageKey = imageKey || 'gelpiyo';

    // 速度
    this.vx = 0;
    this.vy = 0;

    // アイテム効果・状態
    this.isGiant = false;
    this.isClone = false; // 分裂したサブぴよかどうか

    // 状態
    this.launched = false;
    this.stopped = false;
    this.active = true;

    // アニメーション用
    this.scaleX = 1;
    this.scaleY = 1;
    this.rotation = 0;
    this.squashTime = -1;   // スクワッシュ開始時刻（-1 = 非表示）
    this.squashImpact = 0;
    this.alpha = 1;
    this.trailPoints = [];  // 軌跡用

    // バウンスカウント
    this.bounceCount = 0;
    this.comboTimer = 0;

    // スリングショット引っ張り用
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.originX = x;
    this.originY = y;
    this.isDragging = false;
  }

  update(dt, worldWidth, worldHeight) {
    if (!this.active || this.stopped) return;
    if (!this.launched) return;

    // 重力
    this.vy += GRAVITY * dt;

    // 空気抵抗
    this.vx *= FRICTION;
    this.vy *= FRICTION;

    // 速度制限
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > MAX_VELOCITY) {
      const ratio = MAX_VELOCITY / speed;
      this.vx *= ratio;
      this.vy *= ratio;
    }

    // 位置更新
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 回転（速度方向に合わせる）
    if (speed > 30) {
      this.rotation += (this.vx > 0 ? 1 : -1) * speed * dt * 0.003;
    }

    // 軌跡ポイント追加
    if (speed > 50) {
      this.trailPoints.push({ x: this.x, y: this.y, alpha: 1 });
      if (this.trailPoints.length > 30) {
        this.trailPoints.shift();
      }
    }

    // 軌跡フェードアウト
    for (let i = this.trailPoints.length - 1; i >= 0; i--) {
      this.trailPoints[i].alpha -= dt * 2;
      if (this.trailPoints[i].alpha <= 0) {
        this.trailPoints.splice(i, 1);
      }
    }

    // ワールド境界（床・壁）
    this._handleWorldBounds(worldWidth, worldHeight);

    // スクワッシュ＆ストレッチ更新
    if (this.squashTime >= 0) {
      this.squashTime += dt;
      const ss = calcSquashStretch(this.squashImpact, this.squashTime);
      this.scaleX = ss.scaleX;
      this.scaleY = ss.scaleY;
      if (this.squashTime > 0.5) {
        this.scaleX = 1;
        this.scaleY = 1;
        this.squashTime = -1;
      }
    }

    // コンボタイマー
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
    }

    // 停止判定（ブロックの上や地面で静止しているか）
    if (speed < STOP_THRESHOLD) {
      this.restTimer = (this.restTimer || 0) + dt;
      if (this.restTimer > 0.5) {
        this.vx = 0;
        this.vy = 0;
        this.stopped = true;
      }
    } else {
      this.restTimer = 0;
    }
  }

  _handleWorldBounds(worldWidth, worldHeight) {
    // 床
    if (this.y + this.radius > worldHeight) {
      this.y = worldHeight - this.radius;
      this.vy = -this.vy * (this.isClearing ? 0.2 : 0.85); // クリア時は跳ねない
      this.vx *= GROUND_FRICTION;
      this._triggerBounce(Math.abs(this.vy));
    }
    // 左壁
    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx = -this.vx * 0.9;
      this._triggerBounce(Math.abs(this.vx));
    }
    // 右壁
    if (this.x + this.radius > worldWidth) {
      this.x = worldWidth - this.radius;
      this.vx = -this.vx * 0.9;
      this._triggerBounce(Math.abs(this.vx));
    }
    // 天井
    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.vy = -this.vy * 0.85;
      this._triggerBounce(Math.abs(this.vy));
    }
  }

  _triggerBounce(impact) {
    if (impact > 30) {
      this.squashTime = 0;
      this.squashImpact = impact;
      this.bounceCount++;
      this.comboTimer = 2.0;
    }
  }

  /**
   * バウンスを外部から発動（衝突応答後に呼ぶ）
   */
  onBounce(impact) {
    this._triggerBounce(impact);
  }

  /**
   * 発射
   */
  launch(vx, vy) {
    this.vx = vx;
    this.vy = vy;
    this.launched = true;
    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
  }

  /**
   * リセット（再利用用）
   */
  reset(x, y) {
    this.x = x;
    this.y = y;
    this.originX = x;
    this.originY = y;
    this.vx = 0;
    this.vy = 0;
    this.launched = false;
    this.stopped = false;
    this.active = true;
    this.scaleX = 1;
    this.scaleY = 1;
    this.rotation = 0;
    this.squashTime = -1;
    this.alpha = 1;
    this.bounceCount = 0;
    this.comboTimer = 0;
    this.trailPoints.length = 0;
    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
  }
}

// ============================================
// ゲームオブジェクト（障害物・敵）
// ============================================
export class GameObject {
  constructor(x, y, width, height, type, options = {}) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.type = type;

    const defaults = OBJ_DEFAULTS[type] || OBJ_DEFAULTS[OBJ_TYPE.WOOD];
    this.hp = options.hp ?? defaults.hp;
    this.maxHp = this.hp;
    this.restitution = options.restitution ?? defaults.restitution;
    this.scoreValue = options.scoreValue ?? defaults.scoreValue;
    this.color = options.color ?? defaults.color;
    this.breakable = defaults.breakable;
    this.imageKey = options.imageKey || null;

    // 状態
    this.alive = true;
    this.shakeTime = -1;
    this.shakeIntensity = 0;
    this.alpha = 1;
    this.crackLevel = 0;  // ひび割れ段階

    // 円形判定用半径（AABBを包含する円）
    this.collisionRadius = Math.max(width, height) / 2;

    // 敵用：揺れアニメーション
    this.wobblePhase = Math.random() * Math.PI * 2;
  }

  /**
   * ダメージを受ける
   * @returns {boolean} 破壊されたか
   */
  takeDamage(amount = 1) {
    if (!this.breakable || !this.alive) return false;

    this.hp -= amount;
    this.crackLevel = 1 - (this.hp / this.maxHp);

    // ヒットシェイク
    this.shakeTime = 0;
    this.shakeIntensity = 6;

    if (this.hp <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }

  update(dt) {
    // シェイクアニメーション
    if (this.shakeTime >= 0) {
      this.shakeTime += dt;
      if (this.shakeTime > 0.3) {
        this.shakeTime = -1;
        this.shakeIntensity = 0;
      }
    }

    // 敵の揺れ
    if (this.type === OBJ_TYPE.ENEMY && this.alive) {
      this.wobblePhase += dt * 3;
    }

    // 破壊後フェードアウト
    if (!this.alive) {
      this.alpha -= dt * 3;
      if (this.alpha < 0) this.alpha = 0;
    }
  }

  /**
   * シェイクオフセットを取得
   */
  getShakeOffset() {
    if (this.shakeTime < 0) return { x: 0, y: 0 };
    const decay = 1 - (this.shakeTime / 0.3);
    const intensity = this.shakeIntensity * decay;
    return {
      x: (Math.random() - 0.5) * intensity * 2,
      y: (Math.random() - 0.5) * intensity * 2
    };
  }

  /**
   * 敵の揺れオフセット
   */
  getWobbleOffset() {
    if (this.type !== OBJ_TYPE.ENEMY) return 0;
    return Math.sin(this.wobblePhase) * 2;
  }

  /**
   * AABB取得
   */
  getAABB() {
    return {
      x: this.x,
      y: this.y,
      w: this.width,
      h: this.height
    };
  }

  /**
   * 中心座標
   */
  getCenterX() { return this.x + this.width / 2; }
  getCenterY() { return this.y + this.height / 2; }
}

// ============================================
// パーティクル（オブジェクトプール）
// ============================================
const PARTICLE_POOL_SIZE = 200;

export class ParticlePool {
  constructor() {
    this.particles = new Array(PARTICLE_POOL_SIZE);
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles[i] = {
        active: false,
        x: 0, y: 0,
        vx: 0, vy: 0,
        life: 0, maxLife: 0,
        size: 0,
        color: '#fff',
        type: 'circle',  // 'circle', 'star', 'square'
        rotation: 0,
        rotationSpeed: 0,
        gravity: true,
        alpha: 1
      };
    }
  }

  /**
   * パーティクルを発生
   */
  emit(x, y, count, options = {}) {
    let emitted = 0;
    for (let i = 0; i < PARTICLE_POOL_SIZE && emitted < count; i++) {
      const p = this.particles[i];
      if (p.active) continue;

      p.active = true;
      p.x = x + (Math.random() - 0.5) * (options.spread || 10);
      p.y = y + (Math.random() - 0.5) * (options.spread || 10);

      const angle = (options.angle ?? Math.random() * Math.PI * 2);
      const angleVariance = options.angleVariance ?? Math.PI * 2;
      const dir = angle + (Math.random() - 0.5) * angleVariance;
      const speed = (options.speed ?? 200) * (0.5 + Math.random() * 0.5);

      p.vx = Math.cos(dir) * speed;
      p.vy = Math.sin(dir) * speed;
      p.life = 0;
      p.maxLife = (options.life ?? 0.8) * (0.5 + Math.random() * 0.5);
      p.size = (options.size ?? 4) * (0.5 + Math.random() * 0.5);
      p.color = options.colors
        ? options.colors[Math.floor(Math.random() * options.colors.length)]
        : (options.color || '#ffffff');
      p.type = options.type || 'circle';
      p.rotation = Math.random() * Math.PI * 2;
      p.rotationSpeed = (Math.random() - 0.5) * 10;
      p.gravity = options.gravity !== false;
      p.alpha = 1;

      emitted++;
    }
  }

  /**
   * バウンスエフェクト
   */
  emitBounce(x, y, impact) {
    const count = Math.min(Math.floor(impact / 30), 15);
    this.emit(x, y, count, {
      speed: impact * 0.5,
      life: 0.6,
      size: 3,
      colors: ['#ffd700', '#ff6b9d', '#00d4ff', '#00ff88', '#b44dff'],
      type: 'star',
      gravity: true
    });
  }

  /**
   * 破壊エフェクト
   */
  emitDestroy(x, y, color) {
    this.emit(x, y, 20, {
      speed: 300,
      life: 0.8,
      size: 5,
      colors: [color, '#ffffff', lightenColor(color)],
      type: 'square',
      spread: 20,
      gravity: true
    });
  }

  /**
   * 爆発エフェクト（TNT）
   */
  emitExplosion(x, y) {
    this.emit(x, y, 40, {
      speed: 500,
      life: 1.0,
      size: 8,
      colors: ['#ff4444', '#ff8800', '#ffdd00', '#ffffff'],
      type: 'circle',
      spread: 30,
      gravity: false
    });
  }

  update(dt) {
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.gravity) {
        p.vy += GRAVITY * 0.5 * dt;
      }

      p.vx *= 0.98;
      p.vy *= 0.98;

      p.rotation += p.rotationSpeed * dt;
      p.alpha = 1 - (p.life / p.maxLife);
    }
  }
}

// ============================================
// ユーティリティ
// ============================================
function lightenColor(hex) {
  // 簡易明度アップ
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.min(255, r + 80);
  const lg = Math.min(255, g + 80);
  const lb = Math.min(255, b + 80);
  return `rgb(${lr},${lg},${lb})`;
}
