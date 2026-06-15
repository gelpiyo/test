/* ===================================
   obstacle.js - おじゃまゲル（障害物）の管理
   =================================== */

const ObstacleManager = {
    obstacles: [],
    lastGeneratedY: 0,
    canvasW: 390,

    // 生成設定
    MIN_SPAWN_GAP: 250,     // 障害物間の最小縦距離
    MAX_SPAWN_GAP: 500,     // 障害物間の最大縦距離
    START_ALTITUDE: 400,    // この高度以降から出現
    OBSTACLE_SIZE: 20,      // 障害物のサイズ（半径）

    // タイプ
    TYPES: {
        TOGE_GEL: 'toge',    // トゲゲル（静止/ゆらゆら）
        FLOAT_GEL: 'float',  // フワフワゲル（左右移動）
    },

    /**
     * 初期化
     */
    init(canvasW, canvasH) {
        this.canvasW = canvasW;
        this.obstacles = [];
        this.lastGeneratedY = canvasH - this.START_ALTITUDE;
    },

    /**
     * 指定Y座標まで障害物を生成
     */
    generateUpTo(targetY) {
        while (this.lastGeneratedY > targetY) {
            const gap = this.MIN_SPAWN_GAP + Math.random() * (this.MAX_SPAWN_GAP - this.MIN_SPAWN_GAP);
            const newY = this.lastGeneratedY - gap;

            // 横位置: 画面端を避けて配置
            const margin = 40;
            const x = margin + Math.random() * (this.canvasW - margin * 2);

            // タイプ選択（70%トゲゲル、30%フワフワゲル）
            const type = Math.random() < 0.7 ? this.TYPES.TOGE_GEL : this.TYPES.FLOAT_GEL;

            this.obstacles.push({
                x: x,
                y: newY,
                originX: x,
                type: type,
                size: this.OBSTACLE_SIZE,
                phase: Math.random() * Math.PI * 2,     // アニメーション位相
                moveSpeed: type === this.TYPES.FLOAT_GEL
                    ? (0.5 + Math.random() * 1.0) * (Math.random() < 0.5 ? 1 : -1)
                    : 0,
                moveRange: type === this.TYPES.FLOAT_GEL
                    ? 40 + Math.random() * 60
                    : 0,
            });

            this.lastGeneratedY = newY;
        }
    },

    /**
     * 更新（生成・移動・削除）
     */
    update(cameraY, canvasH, dt) {
        // 上方に障害物を生成
        const generateThreshold = cameraY - canvasH;
        if (this.lastGeneratedY > generateThreshold) {
            this.generateUpTo(generateThreshold);
        }

        // 各障害物のアニメーション更新
        const dtFactor = dt / 16.67;
        for (const obs of this.obstacles) {
            obs.phase += 0.03 * dtFactor;

            if (obs.type === this.TYPES.FLOAT_GEL) {
                // 左右に揺れる
                obs.x = obs.originX + Math.sin(obs.phase * obs.moveSpeed) * obs.moveRange;
                // 画面端クランプ
                obs.x = Math.max(obs.size, Math.min(this.canvasW - obs.size, obs.x));
            }
        }

        // 画面下方に消えた障害物を削除
        const removeThreshold = cameraY + canvasH * 2;
        this.obstacles = this.obstacles.filter(o => o.y < removeThreshold);
    },

    /**
     * プレイヤーとの衝突判定（円同士）
     */
    checkCollision(playerX, playerY, playerW, playerH) {
        const pcx = playerX + playerW / 2;
        const pcy = playerY + playerH / 2;
        const playerRadius = playerW / 2 - 4; // 少し甘め

        for (const obs of this.obstacles) {
            const dx = pcx - obs.x;
            const dy = pcy - obs.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = playerRadius + obs.size * 0.7; // 少し甘めの判定

            if (dist < minDist) {
                return obs;
            }
        }
        return null;
    },

    /**
     * 描画
     */
    render(ctx, cameraY, canvasH) {
        const visibleTop = cameraY - 50;
        const visibleBottom = cameraY + canvasH + 50;

        for (const obs of this.obstacles) {
            if (obs.y < visibleTop || obs.y > visibleBottom) continue;

            const screenY = obs.y - cameraY;

            if (obs.type === this.TYPES.TOGE_GEL) {
                this._drawTogeGel(ctx, obs.x, screenY, obs.size, obs.phase);
            } else {
                this._drawFloatGel(ctx, obs.x, screenY, obs.size, obs.phase);
            }
        }
    },

    /**
     * トゲゲル描画（紫のゲルにトゲが生えている）
     */
    _drawTogeGel(ctx, x, y, size, phase) {
        ctx.save();
        ctx.translate(x, y);

        // ゆっくり回転
        const rotation = Math.sin(phase * 0.5) * 0.15;
        ctx.rotate(rotation);

        // トゲ（4本、十字方向）
        const spikeLen = size * 0.7;
        ctx.fillStyle = 'rgba(180, 80, 200, 0.7)';
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI / 2) + phase * 0.3;
            ctx.save();
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(-4, -size * 0.6);
            ctx.lineTo(0, -size * 0.6 - spikeLen);
            ctx.lineTo(4, -size * 0.6);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // 本体（紫のゲル）
        const grad = ctx.createRadialGradient(-2, -3, 2, 0, 0, size);
        grad.addColorStop(0, 'rgba(220, 150, 255, 0.9)');
        grad.addColorStop(0.5, 'rgba(180, 100, 220, 0.85)');
        grad.addColorStop(1, 'rgba(140, 60, 180, 0.8)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.65, 0, Math.PI * 2);
        ctx.fill();

        // ゲルの光沢
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.ellipse(-3, -5, 5, 3.5, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // 怒り目
        ctx.fillStyle = '#2a0040';
        // 左目（つり上がり）
        ctx.beginPath();
        ctx.ellipse(-5, -1, 2.5, 3, -0.3, 0, Math.PI * 2);
        ctx.fill();
        // 右目（つり上がり）
        ctx.beginPath();
        ctx.ellipse(5, -1, 2.5, 3, 0.3, 0, Math.PI * 2);
        ctx.fill();
        // 眉毛風（怒り）
        ctx.strokeStyle = '#2a0040';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-8, -5);
        ctx.lineTo(-3, -4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8, -5);
        ctx.lineTo(3, -4);
        ctx.stroke();

        // 口（への字）
        ctx.beginPath();
        ctx.moveTo(-3, 4);
        ctx.quadraticCurveTo(0, 2, 3, 4);
        ctx.stroke();

        ctx.restore();
    },

    /**
     * フワフワゲル描画（青いゲル、左右移動）
     */
    _drawFloatGel(ctx, x, y, size, phase) {
        ctx.save();
        ctx.translate(x, y);

        // ぷるぷる揺れ
        const wobble = Math.sin(phase * 2) * 0.05;
        ctx.scale(1 + wobble, 1 - wobble);

        // トゲ（6本、放射状）
        const spikeLen = size * 0.5;
        ctx.fillStyle = 'rgba(80, 150, 220, 0.6)';
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI / 3) + phase * 0.5;
            ctx.save();
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(-3, -size * 0.55);
            ctx.lineTo(0, -size * 0.55 - spikeLen);
            ctx.lineTo(3, -size * 0.55);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // 本体（青いゲル）
        const grad = ctx.createRadialGradient(-2, -2, 2, 0, 0, size);
        grad.addColorStop(0, 'rgba(160, 220, 255, 0.9)');
        grad.addColorStop(0.5, 'rgba(100, 180, 240, 0.85)');
        grad.addColorStop(1, 'rgba(60, 130, 200, 0.8)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // 光沢
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.ellipse(-3, -4, 5, 3, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // 目（ジト目）
        ctx.fillStyle = '#0a2040';
        ctx.beginPath();
        ctx.ellipse(-4, 0, 3, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(4, 0, 3, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },
};
