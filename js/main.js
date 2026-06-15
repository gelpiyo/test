/* ===================================
   main.js - エントリーポイント、ゲームループ、Canvas初期化
   =================================== */

(function () {
    'use strict';

    // ─── 定数 ───
    const LOGICAL_WIDTH = 390;
    const LOGICAL_HEIGHT = 844;

    // ─── DOM要素 ───
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('game-container');

    // ─── Canvas解像度設定 ───
    canvas.width = LOGICAL_WIDTH;
    canvas.height = LOGICAL_HEIGHT;

    // ─── リサイズ処理 ───
    function resizeCanvas() {
        const windowW = window.innerWidth;
        const windowH = window.innerHeight;

        const scaleX = windowW / LOGICAL_WIDTH;
        const scaleY = windowH / LOGICAL_HEIGHT;
        const scale = Math.min(scaleX, scaleY);

        const displayW = LOGICAL_WIDTH * scale;
        const displayH = LOGICAL_HEIGHT * scale;

        canvas.style.width = displayW + 'px';
        canvas.style.height = displayH + 'px';
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // ─── 初期化 ───
    Input.init(canvas);
    Game.init(canvas, ctx, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // ─── ゲームループ ───
    let lastTimestamp = 0;

    function gameLoop(timestamp) {
        // デルタタイム計算（ミリ秒）
        if (lastTimestamp === 0) lastTimestamp = timestamp;
        let dt = timestamp - lastTimestamp;
        lastTimestamp = timestamp;

        // デルタタイムの上限（タブ非アクティブ時の暴走防止）
        if (dt > 100) dt = 16.67;

        // 更新
        Game.update(dt, timestamp);

        // 描画
        ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        Game.render(timestamp);

        // 入力フラグリセット
        Input.resetFrameFlags();

        // 次フレーム
        requestAnimationFrame(gameLoop);
    }

    // ─── 開始 ───
    requestAnimationFrame(gameLoop);

    console.log('🐣 ゲルぴよバウンス - 起動完了');
})();
