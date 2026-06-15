/* ===================================
   input.js - 入力管理（タッチ、チルト、キーボード）
   =================================== */

const Input = {
    // タッチ状態
    isTouching: false,
    touchStartTime: 0,
    touchJustPressed: false,  // このフレームでタッチが開始されたか

    // チルト（加速度センサー）
    tiltX: 0,           // -1.0 〜 1.0 の正規化された傾き
    tiltSupported: false,
    tiltPermissionGranted: false,

    // キーボード状態（PC開発用）
    keys: {},

    // Canvasへの参照
    canvas: null,

    /**
     * 入力システムを初期化
     */
    init(canvas) {
        this.canvas = canvas;
        this._setupTouchEvents();
        this._setupKeyboardEvents();
        this._setupTiltEvents();
    },

    /**
     * フレーム終了時にリセットするフラグ
     */
    resetFrameFlags() {
        this.touchJustPressed = false;
    },

    // ─── タッチイベント ───

    _setupTouchEvents() {
        // タッチ開始
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.isTouching = true;
            this.touchJustPressed = true;
            this.touchStartTime = performance.now();
        }, { passive: false });

        // タッチ終了
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.isTouching = false;
        }, { passive: false });

        this.canvas.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            this.isTouching = false;
        }, { passive: false });

        // マウス（PC開発用）
        this.canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.isTouching = true;
            this.touchJustPressed = true;
            this.touchStartTime = performance.now();
        });

        this.canvas.addEventListener('mouseup', (e) => {
            e.preventDefault();
            this.isTouching = false;
        });
    },

    // ─── キーボードイベント ───

    _setupKeyboardEvents() {
        window.addEventListener('keydown', (e) => {
            if (!this.keys[e.code]) {
                this.keys[e.code] = true;
                // スペースキーでタッチ相当
                if (e.code === 'Space') {
                    this.isTouching = true;
                    this.touchJustPressed = true;
                    this.touchStartTime = performance.now();
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            if (e.code === 'Space') {
                this.isTouching = false;
            }
        });
    },

    // ─── チルト（加速度センサー）───

    _setupTiltEvents() {
        // DeviceOrientationイベントの権限チェック（iOS 13+）
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            // iOS: ユーザーアクションで権限リクエストが必要
            // → 初回タップ時にリクエスト（game.jsで呼び出す）
            this.tiltSupported = true;
        } else if ('DeviceOrientationEvent' in window) {
            // Android: 権限不要
            this.tiltSupported = true;
            this._startListeningTilt();
        }
    },

    /**
     * iOSで傾きセンサーの権限をリクエスト
     */
    async requestTiltPermission() {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === 'granted') {
                    this.tiltPermissionGranted = true;
                    this._startListeningTilt();
                    return true;
                }
            } catch (err) {
                console.warn('チルト権限リクエスト失敗:', err);
            }
        }
        return false;
    },

    _startListeningTilt() {
        window.addEventListener('deviceorientation', (e) => {
            // gamma: 左右の傾き（-90〜90）
            if (e.gamma !== null) {
                // -30〜30度の範囲を -1〜1 に正規化
                this.tiltX = Math.max(-1, Math.min(1, e.gamma / 30));
                this.tiltPermissionGranted = true;
            }
        });
    },

    // ─── ヘルパー ───

    /**
     * 横方向の移動量を取得（-1.0 〜 1.0）
     */
    getHorizontalInput() {
        // キーボード優先
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) return -1;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) return 1;

        // チルト
        if (this.tiltPermissionGranted) {
            return this.tiltX;
        }

        return 0;
    },

    /**
     * バウンス入力があったか（このフレームでタッチが開始された）
     */
    isBouncePressed() {
        return this.touchJustPressed;
    },

    /**
     * 滞空入力中か（タッチ保持中）
     */
    isHovering() {
        return this.isTouching;
    },
};
