/* ===================================
   ui.js - UI描画（スコア、タイトル、ゲームオーバー等）
   =================================== */

const UI = {
    // アニメーション用
    titleBouncePhase: 0,
    gameOverAlpha: 0,
    scorePopScale: 1,

    /**
     * タイトル画面を描画
     */
    renderTitle(ctx, canvasW, canvasH, timestamp) {
        // タイトルテキスト
        this.titleBouncePhase += 0.03;
        const bounceY = Math.sin(this.titleBouncePhase) * 8;

        // タイトル: ゲルぴよバウンス
        ctx.save();

        // 影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.font = 'bold 36px "Segoe UI", "Hiragino Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ゲルぴよバウンス', canvasW / 2 + 2, canvasH * 0.3 + bounceY + 2);

        // メインテキスト
        const titleGrad = ctx.createLinearGradient(
            canvasW / 2 - 120, canvasH * 0.3,
            canvasW / 2 + 120, canvasH * 0.3 + 40
        );
        titleGrad.addColorStop(0, '#FFD93D');
        titleGrad.addColorStop(0.5, '#FFF176');
        titleGrad.addColorStop(1, '#FFB300');
        ctx.fillStyle = titleGrad;
        ctx.fillText('ゲルぴよバウンス', canvasW / 2, canvasH * 0.3 + bounceY);

        // サブテキスト
        const blinkAlpha = 0.4 + Math.sin(timestamp * 0.003) * 0.4;
        ctx.fillStyle = `rgba(255, 255, 255, ${blinkAlpha})`;
        ctx.font = '18px "Segoe UI", "Hiragino Sans", sans-serif';
        ctx.fillText('タップでスタート', canvasW / 2, canvasH * 0.55);

        // ハイスコア
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '14px "Segoe UI", "Hiragino Sans", sans-serif';
        const highScore = this._getHighScore();
        if (highScore > 0) {
            ctx.fillText(`🏆 ハイスコア: ${highScore}`, canvasW / 2, canvasH * 0.65);
        }

        // 操作説明
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '12px "Segoe UI", "Hiragino Sans", sans-serif';
        ctx.fillText('タップ: ジャンプ  |  長押し: 滞空', canvasW / 2, canvasH * 0.85);
        ctx.fillText('スマホを傾けて移動 (PCは矢印キー)', canvasW / 2, canvasH * 0.89);

        ctx.restore();
    },

    /**
     * プレイ中のスコア表示
     */
    renderScore(ctx, score, canvasW) {
        const displayScore = Math.floor(score / 10);

        ctx.save();

        // 影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.font = 'bold 28px "Segoe UI", "Hiragino Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${displayScore}`, 17, 47);

        // スコアテキスト
        ctx.fillStyle = '#fff';
        ctx.fillText(`${displayScore}`, 15, 45);

        ctx.restore();
    },

    /**
     * コンボ表示
     */
    renderCombo(ctx, comboCount, canvasW) {
        if (comboCount < 3) return;

        const multiplier = Math.min(5, 1 + (comboCount - 2) * 0.5);

        ctx.save();
        ctx.textAlign = 'right';

        // コンボテキスト
        ctx.fillStyle = `rgba(255, 200, 50, ${Math.min(1, 0.5 + comboCount * 0.1)})`;
        const fontSize = Math.min(24, 16 + comboCount);
        ctx.font = `bold ${fontSize}px "Segoe UI", sans-serif`;
        ctx.fillText(`${comboCount} COMBO ×${multiplier.toFixed(1)}`, canvasW - 15, 45);

        ctx.restore();
    },

    /**
     * ゲームオーバー画面を描画
     */
    renderGameOver(ctx, canvasW, canvasH, score, isNewRecord) {
        this.gameOverAlpha = Math.min(1, this.gameOverAlpha + 0.03);

        ctx.save();

        // 暗転オーバーレイ
        ctx.fillStyle = `rgba(0, 0, 0, ${this.gameOverAlpha * 0.6})`;
        ctx.fillRect(0, 0, canvasW, canvasH);

        if (this.gameOverAlpha < 0.5) {
            ctx.restore();
            return;
        }

        const alpha = Math.min(1, (this.gameOverAlpha - 0.5) * 4);
        const displayScore = Math.floor(score / 10);

        ctx.textAlign = 'center';

        // GAME OVER
        ctx.fillStyle = `rgba(255, 100, 100, ${alpha})`;
        ctx.font = 'bold 32px "Segoe UI", "Hiragino Sans", sans-serif';
        ctx.fillText('GAME OVER', canvasW / 2, canvasH * 0.3);

        // スコア
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.font = 'bold 48px "Segoe UI", "Hiragino Sans", sans-serif';
        ctx.fillText(`${displayScore}`, canvasW / 2, canvasH * 0.42);

        ctx.font = '16px "Segoe UI", "Hiragino Sans", sans-serif';
        ctx.fillText('SCORE', canvasW / 2, canvasH * 0.47);

        // ハイスコア更新
        if (isNewRecord) {
            const flashAlpha = 0.6 + Math.sin(performance.now() * 0.005) * 0.4;
            ctx.fillStyle = `rgba(255, 215, 0, ${flashAlpha * alpha})`;
            ctx.font = 'bold 22px "Segoe UI", "Hiragino Sans", sans-serif';
            ctx.fillText('🎉 NEW RECORD! 🎉', canvasW / 2, canvasH * 0.54);
        }

        // リスタート案内
        const blinkAlpha = 0.3 + Math.sin(performance.now() * 0.003) * 0.3;
        ctx.fillStyle = `rgba(255, 255, 255, ${blinkAlpha * alpha})`;
        ctx.font = '16px "Segoe UI", "Hiragino Sans", sans-serif';
        ctx.fillText('タップでもう1回', canvasW / 2, canvasH * 0.7);

        ctx.restore();
    },

    /**
     * ゲームオーバーアニメーションをリセット
     */
    resetGameOver() {
        this.gameOverAlpha = 0;
    },

    /**
     * ハイスコアを取得
     */
    _getHighScore() {
        try {
            const data = JSON.parse(localStorage.getItem('gelpiyo_bounce'));
            return data ? Math.floor((data.highScore || 0) / 10) : 0;
        } catch (e) {
            return 0;
        }
    },
};
