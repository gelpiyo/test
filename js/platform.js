/* ===================================
   platform.js - 足場の生成・衝突判定・描画
   =================================== */

const PlatformManager = {
    platforms: [],
    PLATFORM_WIDTH: 75,
    PLATFORM_HEIGHT: 14,
    MIN_GAP: 90,       // 足場間の最小縦距離
    MAX_GAP: 160,      // 足場間の最大縦距離
    lastGeneratedY: 0,  // 最後に生成した足場のY座標
    canvasW: 390,

    // 足場落下設定
    FALL_DELAY: 0.5,        // 乗ってから落下開始までの秒数
    FALL_GRAVITY: 0.6,      // 落下中の重力加速度

    // 足場タイプ定義
    TYPES: {
        NORMAL: 'normal',
        // Phase 2で追加: SUPER, FLUFFY, BREAKABLE, MOVING
    },

    /**
     * 足場システムを初期化
     */
    init(canvasW, canvasH) {
        this.canvasW = canvasW;
        this.platforms = [];
        this.lastGeneratedY = canvasH - 50; // 画面下部から開始

        // 初期足場を生成（スタート地点に確実に配置）
        // 最初の足場（プレイヤーの真下）
        this.platforms.push({
            x: canvasW / 2 - this.PLATFORM_WIDTH / 2,
            y: canvasH - 80,
            width: this.PLATFORM_WIDTH,
            height: this.PLATFORM_HEIGHT,
            type: this.TYPES.NORMAL,
        });

        // 上方向に足場を生成
        this.lastGeneratedY = canvasH - 80;
        this.generateUpTo(-(canvasH * 2));
    },

    /**
     * 指定のY座標まで足場を生成
     */
    generateUpTo(targetY) {
        while (this.lastGeneratedY > targetY) {
            const gap = this.MIN_GAP + Math.random() * (this.MAX_GAP - this.MIN_GAP);
            const newY = this.lastGeneratedY - gap;

            // 横位置: 3分割ゾーンでバランスを取る
            const zone = Math.floor(Math.random() * 3);
            const zoneWidth = (this.canvasW - this.PLATFORM_WIDTH) / 3;
            const x = zoneWidth * zone + Math.random() * zoneWidth;

            this.platforms.push({
                x: x,
                y: newY,
                width: this.PLATFORM_WIDTH,
                height: this.PLATFORM_HEIGHT,
                type: this.TYPES.NORMAL,
                steppedTime: 0,   // プレイヤーが乗った時刻（0=未踏）
                falling: false,   // 落下中フラグ
                fallVelocity: 0,  // 落下速度
            });

            this.lastGeneratedY = newY;
        }
    },

    /**
     * カメラに応じて足場の生成・削除を管理
     */
    update(cameraY, canvasH, dt) {
        // カメラの上方にさらに足場を生成
        const generateThreshold = cameraY - canvasH;
        if (this.lastGeneratedY > generateThreshold) {
            this.generateUpTo(generateThreshold);
        }

        const now = performance.now();
        const dtSec = (dt || 16.67) / 1000;

        for (const p of this.platforms) {
            // 踏まれた足場の落下カウントダウン
            if (p.steppedTime > 0 && !p.falling) {
                const elapsed = (now - p.steppedTime) / 1000;
                if (elapsed >= this.FALL_DELAY) {
                    p.falling = true;
                    p.fallVelocity = 0;
                }
            }

            // 落下中の足場を下に移動
            if (p.falling) {
                p.fallVelocity += this.FALL_GRAVITY;
                p.y += p.fallVelocity;
            }
        }

        // 画面下方に消えた足場を削除（メモリ節約）
        const removeThreshold = cameraY + canvasH * 2;
        this.platforms = this.platforms.filter(p => p.y < removeThreshold);
    },

    /**
     * プレイヤーとの衝突判定
     * 条件: プレイヤーが「落下中」に「足場の上面」に着地
     */
    checkCollision(playerX, playerY, playerW, playerH, playerVY) {
        // 落下中のみ判定（上昇中は通過可能）
        if (playerVY < 0) return null;

        const playerBottom = playerY + playerH;
        const playerCenterX = playerX + playerW / 2;

        for (const platform of this.platforms) {
            // 落下中の足場は判定しない
            if (platform.falling) continue;

            // 水平方向の重なり判定
            if (playerCenterX > platform.x && playerCenterX < platform.x + platform.width) {
                // 垂直方向: プレイヤーの足が足場の上面に接触
                if (playerBottom >= platform.y && playerBottom <= platform.y + platform.height + playerVY) {
                    // 初着地マーク
                    if (platform.steppedTime === 0) {
                        platform.steppedTime = performance.now();
                    }
                    return platform;
                }
            }
        }
        return null;
    },

    /**
     * 足場を描画
     */
    render(ctx, cameraY, canvasH) {
        const visibleTop = cameraY - 50;
        const visibleBottom = cameraY + canvasH + 50;
        const now = performance.now();

        for (const platform of this.platforms) {
            // 画面外はスキップ
            if (platform.y < visibleTop || platform.y > visibleBottom) continue;

            let screenY = platform.y - cameraY;
            let shakeX = 0;

            // 踏まれた足場は揺れる（落下前の警告）
            if (platform.steppedTime > 0 && !platform.falling) {
                const elapsed = (now - platform.steppedTime) / 1000;
                const urgency = elapsed / this.FALL_DELAY; // 0→1
                const intensity = 1 + urgency * 3;         // 揺れの強さ
                shakeX = Math.sin(now * 0.05 * intensity) * intensity;
            }

            // 落下中はアルファを下げる
            let alpha = 1;
            if (platform.falling) {
                alpha = Math.max(0, 1 - platform.fallVelocity * 0.05);
            }

            this._drawPlatform(ctx, platform.x + shakeX, screenY, platform.width, platform.height, platform.type, alpha);
        }
    },

    /**
     * 個別の足場描画
     */
    _drawPlatform(ctx, x, y, w, h, type, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha !== undefined ? alpha : 1;

        // ゲルっぽい見た目（半透明＋グラデーション＋丸み）
        const radius = h / 2;

        // メインボディ
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, 'rgba(100, 230, 150, 0.85)');
        grad.addColorStop(0.5, 'rgba(60, 200, 120, 0.9)');
        grad.addColorStop(1, 'rgba(40, 170, 100, 0.8)');
        ctx.fillStyle = grad;

        // 角丸矩形
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();

        // ハイライト（上面の光沢）
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + 3, w * 0.35, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },
};
