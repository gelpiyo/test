/* ===================================
   background.js - 背景描画（高度連動グラデーション）
   =================================== */

const Background = {
    // 高度帯ごとの背景テーマ
    zones: [
        { minAlt: 0,    maxAlt: 1000,  topColor: [135, 206, 235], bottomColor: [152, 251, 152], name: '草原' },
        { minAlt: 1000, maxAlt: 3000,  topColor: [74, 144, 217],  bottomColor: [135, 206, 235], name: '青空' },
        { minAlt: 3000, maxAlt: 5000,  topColor: [255, 107, 107], bottomColor: [255, 217, 61],  name: '夕焼け' },
        { minAlt: 5000, maxAlt: 8000,  topColor: [26, 26, 46],    bottomColor: [22, 33, 62],    name: '夜空' },
        { minAlt: 8000, maxAlt: 99999, topColor: [13, 13, 13],    bottomColor: [20, 20, 40],    name: '宇宙' },
    ],

    // 星（夜空・宇宙ゾーン用）
    stars: [],
    starsGenerated: false,

    generateStars(count) {
        this.stars = [];
        for (let i = 0; i < count; i++) {
            this.stars.push({
                x: Math.random(),
                y: Math.random(),
                size: Math.random() * 2 + 0.5,
                brightness: Math.random(),
                twinkleSpeed: Math.random() * 0.02 + 0.005,
                twinkleOffset: Math.random() * Math.PI * 2,
            });
        }
        this.starsGenerated = true;
    },

    /**
     * 2つのカラー配列を lerp する
     */
    lerpColor(c1, c2, t) {
        return [
            Math.round(c1[0] + (c2[0] - c1[0]) * t),
            Math.round(c1[1] + (c2[1] - c1[1]) * t),
            Math.round(c1[2] + (c2[2] - c1[2]) * t),
        ];
    },

    /**
     * 現在の高度に応じた背景色を取得
     */
    getColors(altitude) {
        const alt = Math.max(0, altitude);

        for (let i = 0; i < this.zones.length; i++) {
            const zone = this.zones[i];
            if (alt >= zone.minAlt && alt < zone.maxAlt) {
                const t = (alt - zone.minAlt) / (zone.maxAlt - zone.minAlt);
                // 現在のゾーン内で補間
                const topColor = zone.topColor;
                const bottomColor = zone.bottomColor;

                // 次のゾーンへの遷移もブレンド
                if (i < this.zones.length - 1) {
                    const nextZone = this.zones[i + 1];
                    const blendStart = 0.7; // ゾーン後半30%でブレンド開始
                    if (t > blendStart) {
                        const blendT = (t - blendStart) / (1 - blendStart);
                        return {
                            top: this.lerpColor(topColor, nextZone.topColor, blendT),
                            bottom: this.lerpColor(bottomColor, nextZone.bottomColor, blendT),
                        };
                    }
                }
                return { top: topColor, bottom: bottomColor };
            }
        }
        // フォールバック（最後のゾーン）
        const last = this.zones[this.zones.length - 1];
        return { top: last.topColor, bottom: last.bottomColor };
    },

    /**
     * 背景を描画
     */
    render(ctx, canvasW, canvasH, cameraY, timestamp) {
        const altitude = -cameraY; // cameraYは上方向が負なので反転
        const colors = this.getColors(altitude);

        // グラデーション描画
        const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
        grad.addColorStop(0, `rgb(${colors.top[0]}, ${colors.top[1]}, ${colors.top[2]})`);
        grad.addColorStop(1, `rgb(${colors.bottom[0]}, ${colors.bottom[1]}, ${colors.bottom[2]})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvasW, canvasH);

        // 星の描画（高度5000以上で徐々に表示）
        if (altitude > 4000) {
            if (!this.starsGenerated) {
                this.generateStars(120);
            }
            const starAlpha = Math.min(1, (altitude - 4000) / 2000);
            this.renderStars(ctx, canvasW, canvasH, timestamp, starAlpha);
        }
    },

    renderStars(ctx, canvasW, canvasH, timestamp, globalAlpha) {
        for (const star of this.stars) {
            const twinkle = Math.sin(timestamp * star.twinkleSpeed + star.twinkleOffset);
            const alpha = (0.5 + twinkle * 0.5) * star.brightness * globalAlpha;
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(star.x * canvasW, star.y * canvasH, star.size, 0, Math.PI * 2);
            ctx.fill();
        }
    },
};
