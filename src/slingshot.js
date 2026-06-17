// ============================================
// slingshot.js — スリングショット操作
// ============================================

import { calcLaunchVelocity, Vec2 } from './physics.js';

/** スリングショット定数 */
const MAX_DRAG_DISTANCE = 150;   // 最大ドラッグ距離(px)
const BAND_COLOR = 'rgba(255, 200, 100, 0.8)';
const BAND_WIDTH = 4;
const TRAJECTORY_DOTS = 8;
const TRAJECTORY_DOT_RADIUS = 3;

export class Slingshot {
  constructor(anchorX, anchorY) {
    this.anchorX = anchorX;
    this.anchorY = anchorY;

    // 状態
    this.isDragging = false;
    this.dragX = anchorX;
    this.dragY = anchorY;
    this.power = 0;        // 0〜1
    this.angle = 0;
    this.touchStartX = 0;
    this.touchStartY = 0;

    // 軌道予測点（事前確保）
    this.trajectoryPoints = new Array(TRAJECTORY_DOTS);
    for (let i = 0; i < TRAJECTORY_DOTS; i++) {
      this.trajectoryPoints[i] = { x: 0, y: 0 };
    }
  }

  /**
   * ドラッグ開始（画面のどこからでも操作可能）
   * タッチ開始位置を記録し、そこからの相対移動で引っ張り量を計算
   */
  startDrag(touchX, touchY, piyo) {
    this.isDragging = true;
    this.touchStartX = touchX;
    this.touchStartY = touchY;
    piyo.isDragging = true;
    return true;
  }

  /**
   * ドラッグ中更新
   * タッチ開始点からの相対移動量で引っ張りベクトルを計算
   */
  updateDrag(touchX, touchY, piyo) {
    if (!this.isDragging) return;

    // タッチ開始点からの相対移動量 = 引っ張りベクトル
    let dx = touchX - this.touchStartX;
    let dy = touchY - this.touchStartY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > MAX_DRAG_DISTANCE) {
      dx = (dx / dist) * MAX_DRAG_DISTANCE;
      dy = (dy / dist) * MAX_DRAG_DISTANCE;
    }

    this.dragX = this.anchorX + dx;
    this.dragY = this.anchorY + dy;
    this.power = Math.min(dist / MAX_DRAG_DISTANCE, 1);
    this.angle = Math.atan2(dy, dx);

    // ぴよの位置をドラッグ位置に追従（ビジュアル用）
    piyo.x = this.dragX;
    piyo.y = this.dragY;
    piyo.dragOffsetX = dx;
    piyo.dragOffsetY = dy;

    // スクワッシュ（引っ張り方向に伸びる）
    const stretchFactor = 1 + this.power * 0.3;
    piyo.scaleX = 1 / stretchFactor;
    piyo.scaleY = stretchFactor;
    piyo.rotation = this.angle + Math.PI / 2;

    // 軌道予測を更新
    this._updateTrajectory(dx, dy);
  }

  /**
   * リリース（発射）
   * ぴよをアンカー位置に戻してから速度を適用する
   * → 下に引っ張っても地面にめり込まない
   */
  release(piyo) {
    if (!this.isDragging) return null;

    this.isDragging = false;
    piyo.isDragging = false;
    piyo.scaleX = 1;
    piyo.scaleY = 1;
    piyo.rotation = 0;

    const dx = this.dragX - this.anchorX;
    const dy = this.dragY - this.anchorY;

    // パワーが小さすぎたらキャンセル
    if (this.power < 0.1) {
      piyo.x = this.anchorX;
      piyo.y = this.anchorY;
      return null;
    }

    // ★ ぴよをアンカー位置に戻してから発射（地面衝突回避）
    piyo.x = this.anchorX;
    piyo.y = this.anchorY;

    const velocity = calcLaunchVelocity(dx, dy);
    piyo.launch(velocity.vx, velocity.vy);

    return velocity;
  }

  /**
   * 軌道予測を計算
   */
  _updateTrajectory(dx, dy) {
    const vel = calcLaunchVelocity(dx, dy);
    let px = this.anchorX;
    let py = this.anchorY;
    let vx = vel.vx;
    let vy = vel.vy;
    const timeStep = 0.08;

    for (let i = 0; i < TRAJECTORY_DOTS; i++) {
      px += vx * timeStep;
      py += vy * timeStep;
      vy += 980 * timeStep;

      this.trajectoryPoints[i].x = px;
      this.trajectoryPoints[i].y = py;
    }
  }

  /**
   * スリングショットを描画
   */
  render(ctx, piyo, camera) {
    if (!this.isDragging) return;

    const ox = camera ? camera.x : 0;
    const oy = camera ? camera.y : 0;

    // ゴムバンド描画
    ctx.save();
    ctx.strokeStyle = BAND_COLOR;
    ctx.lineWidth = BAND_WIDTH;
    ctx.lineCap = 'round';
    ctx.setLineDash([]);

    // アンカー → ぴよ のバンド
    ctx.beginPath();
    ctx.moveTo(this.anchorX - ox, this.anchorY - oy);
    ctx.lineTo(piyo.x - ox, piyo.y - oy);
    ctx.stroke();

    // パワーインジケーター（引っ張り強度で色変化）
    const hue = 60 - this.power * 60;  // 黄→赤
    const indicatorColor = `hsla(${hue}, 100%, 60%, 0.6)`;
    ctx.strokeStyle = indicatorColor;
    ctx.lineWidth = BAND_WIDTH + this.power * 4;
    ctx.beginPath();
    ctx.moveTo(this.anchorX - ox, this.anchorY - oy);
    ctx.lineTo(piyo.x - ox, piyo.y - oy);
    ctx.stroke();

    // 軌道予測ドット
    for (let i = 0; i < TRAJECTORY_DOTS; i++) {
      const p = this.trajectoryPoints[i];
      const alpha = 1 - (i / TRAJECTORY_DOTS) * 0.8;
      const radius = TRAJECTORY_DOT_RADIUS * (1 - i / TRAJECTORY_DOTS * 0.5);

      ctx.fillStyle = `rgba(255, 230, 50, ${alpha * 0.85})`;
      ctx.beginPath();
      ctx.arc(p.x - ox, p.y - oy, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // アンカーポイント
    ctx.fillStyle = 'rgba(255, 200, 100, 0.9)';
    ctx.beginPath();
    ctx.arc(this.anchorX - ox, this.anchorY - oy, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * アンカー位置を更新
   */
  setAnchor(x, y) {
    this.anchorX = x;
    this.anchorY = y;
  }
}
