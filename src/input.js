// ============================================
// input.js — タッチ＆マウス入力の統一管理
// ============================================

/**
 * 入力状態を管理する統一インターフェース
 * タッチとマウスの両方に対応し、シングルタッチガード付き
 */
export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.isDown = false;
    this.startPos = { x: 0, y: 0 };
    this.currentPos = { x: 0, y: 0 };
    this.endPos = { x: 0, y: 0 };
    this.activeTouchId = null;

    // コールバック
    this.onDragStart = null;
    this.onDragMove = null;
    this.onDragEnd = null;
    this.onTap = null;

    // ドラッグ判定用
    this._dragThreshold = 10;
    this._isDragging = false;
    this._tapStartTime = 0;

    this._bindEvents();
  }

  /**
   * Canvas座標に変換
   */
  _getCanvasPos(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  _bindEvents() {
    // UI要素（ボタン等）のタップはゲーム入力として扱わない
    const _isUIElement = (target) => {
      if (!target) return false;
      const tag = target.tagName;
      if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT') return true;
      // screen要素（タイトル、ステージ選択等）の中は除外
      if (target.closest && target.closest('.screen.active:not(#game-hud)')) return true;
      return false;
    };

    // --- タッチイベント（document レベル） ---
    document.addEventListener('touchstart', (e) => {
      if (_isUIElement(e.target)) return;
      e.preventDefault();
      // シングルタッチガード：最初のタッチのみ
      if (this.activeTouchId !== null) return;
      const touch = e.changedTouches[0];
      this.activeTouchId = touch.identifier;
      const pos = this._getCanvasPos(touch.clientX, touch.clientY);
      this._handleStart(pos);
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (this.activeTouchId === null) return;
      e.preventDefault();
      const touch = this._findActiveTouch(e.changedTouches);
      if (!touch) return;
      const pos = this._getCanvasPos(touch.clientX, touch.clientY);
      this._handleMove(pos);
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
      const touch = this._findActiveTouch(e.changedTouches);
      if (!touch) return;
      this.activeTouchId = null;
      const pos = this._getCanvasPos(touch.clientX, touch.clientY);
      this._handleEnd(pos);
    }, { passive: false });

    document.addEventListener('touchcancel', () => {
      this.activeTouchId = null;
      this.isDown = false;
      this._isDragging = false;
    }, { passive: false });

    // --- マウスイベント（document レベル） ---
    document.addEventListener('mousedown', (e) => {
      if (_isUIElement(e.target)) return;
      const pos = this._getCanvasPos(e.clientX, e.clientY);
      this._handleStart(pos);
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isDown) return;
      const pos = this._getCanvasPos(e.clientX, e.clientY);
      this._handleMove(pos);
    });

    document.addEventListener('mouseup', (e) => {
      if (!this.isDown) return;
      const pos = this._getCanvasPos(e.clientX, e.clientY);
      this._handleEnd(pos);
    });
  }

  _findActiveTouch(touchList) {
    for (let i = 0; i < touchList.length; i++) {
      if (touchList[i].identifier === this.activeTouchId) {
        return touchList[i];
      }
    }
    return null;
  }

  _handleStart(pos) {
    this.isDown = true;
    this._isDragging = false;
    this._tapStartTime = performance.now();
    this.startPos.x = pos.x;
    this.startPos.y = pos.y;
    this.currentPos.x = pos.x;
    this.currentPos.y = pos.y;
  }

  _handleMove(pos) {
    this.currentPos.x = pos.x;
    this.currentPos.y = pos.y;

    const dx = pos.x - this.startPos.x;
    const dy = pos.y - this.startPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (!this._isDragging && dist >= this._dragThreshold) {
      this._isDragging = true;
      if (this.onDragStart) {
        this.onDragStart(this.startPos.x, this.startPos.y);
      }
    }

    if (this._isDragging && this.onDragMove) {
      this.onDragMove(pos.x, pos.y, this.startPos.x, this.startPos.y);
    }
  }

  _handleEnd(pos) {
    this.endPos.x = pos.x;
    this.endPos.y = pos.y;
    this.isDown = false;

    if (this._isDragging) {
      if (this.onDragEnd) {
        this.onDragEnd(pos.x, pos.y, this.startPos.x, this.startPos.y);
      }
    } else {
      // タップ判定（短いタッチ＋移動なし）
      const elapsed = performance.now() - this._tapStartTime;
      if (elapsed < 300 && this.onTap) {
        this.onTap(pos.x, pos.y);
      }
    }

    this._isDragging = false;
  }

  /**
   * ドラッグベクトル（startからcurrentまで）を取得
   */
  getDragVector() {
    return {
      dx: this.currentPos.x - this.startPos.x,
      dy: this.currentPos.y - this.startPos.y
    };
  }

  /**
   * ドラッグの長さを取得
   */
  getDragLength() {
    const v = this.getDragVector();
    return Math.sqrt(v.dx * v.dx + v.dy * v.dy);
  }

  destroy() {
    // 再生成時用（イベントはCanvas破棄時にGCされる想定）
    this.onDragStart = null;
    this.onDragMove = null;
    this.onDragEnd = null;
    this.onTap = null;
  }
}
