/* ===================================
   player.js - ゲルぴよの物理・描画
   =================================== */

const Player = {
    // 位置・サイズ
    x: 0,
    y: 0,
    width: 44,
    height: 44,

    // 速度
    vx: 0,
    vy: 0,

    // 物理定数
    GRAVITY: 0.4,
    JUMP_VELOCITY: -7,
    HOVER_GRAVITY: 0.08,
    MOVE_SPEED: 4,
    MAX_FALL_SPEED: 8,

    // 滞空システム
    hoverTimeMax: 1.0,        // 最大滞空時間（秒）
    hoverTimeRemaining: 1.0,  // 残り滞空時間（秒）
    isHovering: false,

    // 状態
    isOnPlatform: false,
    isAlive: true,
    score: 0,               // 到達した最高高度
    startY: 0,              // 開始Y座標

    // squash/stretch アニメーション
    scaleX: 1,
    scaleY: 1,
    targetScaleX: 1,
    targetScaleY: 1,
    scaleRecoverySpeed: 0.15,

    // ぷるぷる（滞空時の揺れ）
    wobblePhase: 0,

    // コンボ
    comboCount: 0,
    lastLandedPlatform: null,

    /**
     * プレイヤーを初期化
     */
    init(canvasW, canvasH) {
        this.x = canvasW / 2 - this.width / 2;
        this.y = canvasH - 80 - this.height; // 最初の足場の上
        this.startY = this.y;
        this.vx = 0;
        this.vy = 0;
        this.isOnPlatform = true;
        this.isAlive = true;
        this.isHovering = false;
        this.hoverTimeRemaining = this.hoverTimeMax;
        this.score = 0;
        this.scaleX = 1;
        this.scaleY = 1;
        this.targetScaleX = 1;
        this.targetScaleY = 1;
        this.wobblePhase = 0;
        this.comboCount = 0;
        this.lastLandedPlatform = null;
    },

    /**
     * 更新（物理演算）
     * @param {number} dt - デルタタイム（ミリ秒）
     * @param {number} canvasW - Canvas幅
     */
    update(dt, canvasW) {
        if (!this.isAlive) return;

        const dtFactor = dt / 16.67; // 60FPS基準の補正係数

        // ─── 横移動 ───
        const horizInput = Input.getHorizontalInput();
        this.vx = horizInput * this.MOVE_SPEED;
        this.x += this.vx * dtFactor;

        // 画面端ワープ
        if (this.x + this.width < 0) {
            this.x = canvasW;
        } else if (this.x > canvasW) {
            this.x = -this.width;
        }

        // ─── バウンス（タッチダウン） ───
        if (Input.isBouncePressed() && this.isOnPlatform) {
            this.bounce();
        }

        // ─── 滞空（タッチ保持中 & 空中） ───
        if (Input.isHovering() && !this.isOnPlatform && this.hoverTimeRemaining > 0) {
            this.isHovering = true;
            this.hoverTimeRemaining -= dt / 1000;
            if (this.hoverTimeRemaining < 0) this.hoverTimeRemaining = 0;
        } else {
            this.isHovering = false;
        }

        // ─── 重力 ───
        const gravity = this.isHovering ? this.HOVER_GRAVITY : this.GRAVITY;
        this.vy += gravity * dtFactor;

        // 最大落下速度
        if (this.vy > this.MAX_FALL_SPEED) {
            this.vy = this.MAX_FALL_SPEED;
        }

        this.y += this.vy * dtFactor;

        // ─── 足場との衝突判定 ───
        this.isOnPlatform = false;
        const hitPlatform = PlatformManager.checkCollision(
            this.x, this.y, this.width, this.height, this.vy
        );

        if (hitPlatform) {
            this.y = hitPlatform.y - this.height;
            this.vy = 0;
            this.isOnPlatform = true;
            this.isHovering = false;
            this.hoverTimeRemaining = this.hoverTimeMax; // 着地で滞空チャージ回復

            // コンボ: 異なる足場に着地した場合のみカウント
            if (hitPlatform !== this.lastLandedPlatform) {
                this.comboCount++;
                this.lastLandedPlatform = hitPlatform;
            }

            // 着地 squash
            this.targetScaleX = 1.3;
            this.targetScaleY = 0.7;
        }

        // ─── スコア（最高到達高度） ───
        const currentHeight = this.startY - this.y;
        if (currentHeight > this.score) {
            this.score = currentHeight;
        }

        // ─── squash/stretch 回復 ───
        this.scaleX += (this.targetScaleX - this.scaleX) * this.scaleRecoverySpeed * dtFactor;
        this.scaleY += (this.targetScaleY - this.scaleY) * this.scaleRecoverySpeed * dtFactor;

        // 元に戻す
        if (Math.abs(this.scaleX - 1) < 0.01 && Math.abs(this.scaleY - 1) < 0.01) {
            this.targetScaleX = 1;
            this.targetScaleY = 1;
        } else if (this.isOnPlatform) {
            // squash後にバネで戻す
            this.targetScaleX = 1;
            this.targetScaleY = 1;
        }

        // ─── ぷるぷる（滞空時） ───
        if (this.isHovering) {
            this.wobblePhase += dt * 0.02;
        }
    },

    /**
     * バウンス！
     */
    bounce() {
        this.vy = this.JUMP_VELOCITY;
        this.isOnPlatform = false;

        // ジャンプ stretch
        this.targetScaleX = 0.75;
        this.targetScaleY = 1.3;
    },

    /**
     * ゲルぴよを描画
     */
    render(ctx, cameraY, timestamp) {
        if (!this.isAlive) return;

        const screenY = this.y - cameraY;

        ctx.save();

        // 中心を基準にスケーリング
        const cx = this.x + this.width / 2;
        const cy = screenY + this.height / 2;

        ctx.translate(cx, cy);

        // ぷるぷる揺れ（滞空中）
        let wobbleX = 0;
        if (this.isHovering) {
            wobbleX = Math.sin(this.wobblePhase) * 2;
            ctx.translate(wobbleX, 0);
        }

        ctx.scale(this.scaleX, this.scaleY);

        // ゲルぴよ本体を描画
        this._drawGelPiyo(ctx);

        ctx.restore();

        // 滞空ゲージ（滞空中に表示）
        if (!this.isOnPlatform && this.hoverTimeRemaining < this.hoverTimeMax) {
            this._drawHoverGauge(ctx, cx, screenY - 10);
        }
    },

    /**
     * ゲルぴよの見た目（原点中央）— かわいいヒヨコ×ゲル
     */
    _drawGelPiyo(ctx) {
        const r = this.width / 2;

        // ── 小さな足（後ろに表示）──
        ctx.fillStyle = '#ff9a3c';
        // 左足
        ctx.beginPath();
        ctx.ellipse(-6, r - 2, 5, 3, 0.2, 0, Math.PI * 2);
        ctx.fill();
        // 右足
        ctx.beginPath();
        ctx.ellipse(6, r - 2, 5, 3, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // ── 本体（ゲルっぽいぷるぷるボディ）──
        // ぼわっとした影でゲル感
        ctx.fillStyle = 'rgba(255, 200, 30, 0.15)';
        ctx.beginPath();
        ctx.ellipse(0, 2, r + 4, r + 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // メインボディ
        const bodyGrad = ctx.createRadialGradient(-4, -5, 3, 0, 0, r);
        bodyGrad.addColorStop(0, 'rgba(255, 248, 170, 0.98)');
        bodyGrad.addColorStop(0.35, 'rgba(255, 235, 100, 0.95)');
        bodyGrad.addColorStop(0.7, 'rgba(255, 215, 50, 0.92)');
        bodyGrad.addColorStop(1, 'rgba(240, 185, 20, 0.88)');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r + 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // ゲル縁取り（薄い半透明の輪郭でゲルっぽさ）
        ctx.strokeStyle = 'rgba(240, 180, 20, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r + 2, 0, 0, Math.PI * 2);
        ctx.stroke();

        // ── ゲルの大きなハイライト（ぷるぷる光沢）──
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.beginPath();
        ctx.ellipse(-4, -9, 10, 6, -0.25, 0, Math.PI * 2);
        ctx.fill();

        // 小ハイライト
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(8, -11, 3, 0, Math.PI * 2);
        ctx.fill();

        // ── 頭のトサカ（3つのぽこぽこ）──
        ctx.fillStyle = 'rgba(255, 170, 30, 0.9)';
        ctx.beginPath();
        ctx.ellipse(0, -r - 3, 3.5, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 185, 40, 0.85)';
        ctx.beginPath();
        ctx.ellipse(-5, -r - 1, 2.5, 4, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(5, -r - 1, 2.5, 4, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // ── 目（大きなキラキラ目）──
        // 白目
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(-7, -3, 6, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(7, -3, 6, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // 瞳（黒）
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.ellipse(-6, -2, 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(6, -2, 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // キラキラ（瞳のハイライト大）
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-7.5, -4.5, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(4.5, -4.5, 2.2, 0, Math.PI * 2);
        ctx.fill();

        // キラキラ（瞳のハイライト小）
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(-4.5, -1, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(7.5, -1, 1, 0, Math.PI * 2);
        ctx.fill();

        // ── ほっぺ（ピンクの丸）──
        ctx.fillStyle = 'rgba(255, 140, 140, 0.4)';
        ctx.beginPath();
        ctx.ellipse(-13, 4, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(13, 4, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // ── くちばし（小さなω型）──
        ctx.fillStyle = '#ff8c42';
        ctx.beginPath();
        ctx.moveTo(-4, 6);
        ctx.quadraticCurveTo(-2, 11, 0, 8);
        ctx.quadraticCurveTo(2, 11, 4, 6);
        ctx.closePath();
        ctx.fill();

        // ── 羽（小さい翼）— 滞空中は広げる ──
        const wingFlap = this.isHovering
            ? Math.sin(this.wobblePhase * 3) * 0.3
            : 0;
        const wingAngle = this.isHovering ? 0.9 + wingFlap : 0.3;
        const wingSize = this.isHovering ? 14 : 9;

        ctx.fillStyle = 'rgba(255, 220, 70, 0.85)';
        // 左翼
        ctx.beginPath();
        ctx.ellipse(-r + 1, 1, wingSize, 5.5, -wingAngle, 0, Math.PI * 2);
        ctx.fill();
        // 右翼
        ctx.beginPath();
        ctx.ellipse(r - 1, 1, wingSize, 5.5, wingAngle, 0, Math.PI * 2);
        ctx.fill();

        // 翼ハイライト
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.ellipse(-r + 3, -1, wingSize * 0.5, 3, -wingAngle, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(r - 3, -1, wingSize * 0.5, 3, wingAngle, 0, Math.PI * 2);
        ctx.fill();
    },

    /**
     * 滞空ゲージを描画
     */
    _drawHoverGauge(ctx, x, y) {
        const gaugeW = 30;
        const gaugeH = 4;
        const ratio = this.hoverTimeRemaining / this.hoverTimeMax;

        // 背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(x - gaugeW / 2, y, gaugeW, gaugeH);

        // ゲージ
        const color = ratio > 0.3 ? 'rgba(100, 230, 255, 0.8)' : 'rgba(255, 100, 100, 0.8)';
        ctx.fillStyle = color;
        ctx.fillRect(x - gaugeW / 2, y, gaugeW * ratio, gaugeH);
    },
};
