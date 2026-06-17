// ============================================
// physics.js — 2D 物理エンジン（軽量自作）
// ============================================

/** 定数 */
export const GRAVITY = 980;            // 重力加速度 (px/s²)
export const MAX_VELOCITY = 7000;       // 最大速度
export const STOP_THRESHOLD = 15;       // 停止判定速度
export const FRICTION = 0.998;          // 空気抵抗
export const GROUND_FRICTION = 0.92;    // 地面摩擦

/**
 * 2Dベクトルユーティリティ（オブジェクト使い回し用）
 */
export const Vec2 = {
  /** 長さ */
  length(vx, vy) {
    return Math.sqrt(vx * vx + vy * vy);
  },
  /** 正規化（結果をout に書き込む） */
  normalize(vx, vy, out) {
    const len = Math.sqrt(vx * vx + vy * vy);
    if (len < 0.0001) {
      out.x = 0;
      out.y = 0;
    } else {
      out.x = vx / len;
      out.y = vy / len;
    }
    return out;
  },
  /** 内積 */
  dot(ax, ay, bx, by) {
    return ax * bx + ay * by;
  },
  /** 反射ベクトル（入射d、法線n） → out */
  reflect(dx, dy, nx, ny, out) {
    const dot2 = 2 * (dx * nx + dy * ny);
    out.x = dx - dot2 * nx;
    out.y = dy - dot2 * ny;
    return out;
  }
};

// 再利用用の一時ベクトル（GC防止）
const _tmpVec = { x: 0, y: 0 };
const _tmpNormal = { x: 0, y: 0 };
const _tmpReflect = { x: 0, y: 0 };

/**
 * 円 vs 矩形 (AABB) の衝突判定
 * @returns {object|null} { hit, penetration, normalX, normalY, contactX, contactY }
 */
export function circleVsRect(cx, cy, cr, rx, ry, rw, rh) {
  // 矩形の最近点を求める
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));

  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq >= cr * cr) return null;

  const dist = Math.sqrt(distSq);
  const penetration = cr - dist;

  // 法線を計算
  let nx, ny;
  if (dist < 0.0001) {
    // 円の中心が矩形の中にある場合
    const toLeft = cx - rx;
    const toRight = (rx + rw) - cx;
    const toTop = cy - ry;
    const toBottom = (ry + rh) - cy;
    const minDist = Math.min(toLeft, toRight, toTop, toBottom);
    if (minDist === toLeft) { nx = -1; ny = 0; }
    else if (minDist === toRight) { nx = 1; ny = 0; }
    else if (minDist === toTop) { nx = 0; ny = -1; }
    else { nx = 0; ny = 1; }
  } else {
    nx = dx / dist;
    ny = dy / dist;
  }

  return {
    hit: true,
    penetration,
    normalX: nx,
    normalY: ny,
    contactX: closestX,
    contactY: closestY
  };
}

/**
 * 円 vs 円の衝突判定
 */
export function circleVsCircle(ax, ay, ar, bx, by, br) {
  const dx = bx - ax;
  const dy = by - ay;
  const distSq = dx * dx + dy * dy;
  const radiusSum = ar + br;

  if (distSq >= radiusSum * radiusSum) return null;

  const dist = Math.sqrt(distSq);
  const penetration = radiusSum - dist;

  let nx, ny;
  if (dist < 0.0001) {
    nx = 0;
    ny = -1;
  } else {
    nx = dx / dist;
    ny = dy / dist;
  }

  return {
    hit: true,
    penetration,
    normalX: nx,
    normalY: ny,
    contactX: ax + nx * ar,
    contactY: ay + ny * ar
  };
}

/**
 * 衝突応答：反発＋位置補正
 * @param {object} body - { x, y, vx, vy, radius }
 * @param {object} collision - circleVsRect/Circle の結果
 * @param {number} restitution - 反発係数 (0〜1)
 * @returns {number} 衝突の衝撃力（速度変化量）
 */
export function resolveCollision(body, collision, restitution) {
  // 位置補正（めり込み解消）
  body.x += collision.normalX * collision.penetration;
  body.y += collision.normalY * collision.penetration;

  // 反射ベクトル計算
  const dotVN = body.vx * collision.normalX + body.vy * collision.normalY;

  // 法線方向の速度成分が離れる方向ならスキップ
  if (dotVN > 0) return 0;

  // 衝撃力
  const impact = Math.abs(dotVN);

  // 反発適用
  body.vx -= (1 + restitution) * dotVN * collision.normalX;
  body.vy -= (1 + restitution) * dotVN * collision.normalY;

  return impact;
}

/**
 * スクワッシュ＆ストレッチ計算
 * 衝突の衝撃力に基づいて変形量を返す
 * @param {number} impact - 衝突衝撃力
 * @param {number} time - アニメーション経過時間 (s)
 * @returns {{ scaleX: number, scaleY: number }}
 */
export function calcSquashStretch(impact, time) {
  // 衝撃力に応じた変形量
  const maxDeform = Math.min(impact / 800, 0.4);
  // 減衰振動
  const decay = Math.exp(-time * 12);
  const oscillation = Math.cos(time * 30) * decay;
  const deform = maxDeform * oscillation;

  return {
    scaleX: 1 + deform,
    scaleY: 1 - deform
  };
}

/**
 * 引っ張り発射速度を計算
 * @param {number} dx - ドラッグX距離（引っ張り元→先）
 * @param {number} dy - ドラッグY距離
 * @param {number} power - パワー倍率
 * @returns {{ vx: number, vy: number, speed: number }}
 */
export function calcLaunchVelocity(dx, dy, power = 16.0) {
  // 引っ張りの逆方向に発射
  const vx = -dx * power;
  const vy = -dy * power;
  const speed = Vec2.length(vx, vy);

  // 最大速度制限
  if (speed > MAX_VELOCITY) {
    const ratio = MAX_VELOCITY / speed;
    return { vx: vx * ratio, vy: vy * ratio, speed: MAX_VELOCITY };
  }

  return { vx, vy, speed };
}
