/* ===================================
   camera.js - カメラ（スクロール）制御
   =================================== */

const Camera = {
    y: 0,           // カメラのワールドY座標（上方向が負）
    targetY: 0,     // 追従先のY座標
    smoothing: 0.15, // 追従の滑らかさ（0〜1、小さいほど滑らか）
    highestY: 0,    // 到達した最高Y座標（下方向に戻らない制御用）

    /**
     * カメラを初期化
     */
    init(startY) {
        this.y = startY;
        this.targetY = startY;
        this.highestY = startY;
    },

    /**
     * プレイヤーのY座標に基づいてカメラを更新
     * プレイヤーが画面の上部1/3にいるようにスクロール
     */
    update(playerY, canvasH) {
        // プレイヤーを画面上部40%に配置するためのターゲット
        const targetOffset = canvasH * 0.4;
        const newTargetY = playerY - targetOffset;

        // カメラは上方向にのみ追従（下方向には戻らない）
        if (newTargetY < this.highestY) {
            this.highestY = newTargetY;
        }

        this.targetY = this.highestY;

        // スムーズ追従
        this.y += (this.targetY - this.y) * this.smoothing;

        // 安全策: プレイヤーが画面上端から大きく飛び出す場合、カメラを即時補正
        const playerScreenY = playerY - this.y;
        if (playerScreenY < 30) {
            this.y = playerY - 30;
        }
    },
    /**
     * ワールド座標 → スクリーン座標に変換
     */
    worldToScreen(worldY) {
        return worldY - this.y;
    },

    /**
     * スクリーン座標 → ワールド座標に変換
     */
    screenToWorld(screenY) {
        return screenY + this.y;
    },

    /**
     * カメラの可視範囲を取得
     */
    getVisibleRange(canvasH) {
        return {
            top: this.y,
            bottom: this.y + canvasH,
        };
    },
};
