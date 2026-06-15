/* ===================================
   game.js - ゲーム状態管理・シーン制御
   =================================== */

const Game = {
    // ゲーム状態
    STATE: {
        TITLE: 'title',
        PLAYING: 'playing',
        GAMEOVER: 'gameover',
    },

    currentState: 'title',
    canvas: null,
    ctx: null,
    canvasW: 390,
    canvasH: 844,

    // ハイスコア
    highScore: 0,
    isNewRecord: false,

    // ゲームオーバー後のリスタート受付遅延
    gameOverTime: 0,
    RESTART_DELAY: 800, // ミリ秒

    // ゲーム開始後の入力受付遅延
    gameStartTime: 0,
    INPUT_DELAY: 300, // ミリ秒

    /**
     * ゲーム初期化
     */
    init(canvas, ctx, canvasW, canvasH) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.canvasW = canvasW;
        this.canvasH = canvasH;

        // ハイスコア読み込み
        this._loadData();

        // タイトル状態で開始
        this.currentState = this.STATE.TITLE;

        // タイトル画面用の初期配置
        this._setupTitleScene();
    },

    /**
     * タイトル画面のセットアップ
     */
    _setupTitleScene() {
        Camera.init(0);
        PlatformManager.init(this.canvasW, this.canvasH);
        ObstacleManager.init(this.canvasW, this.canvasH);
        Player.init(this.canvasW, this.canvasH);
    },

    /**
     * ゲーム開始
     */
    startGame() {
        this.currentState = this.STATE.PLAYING;
        this.isNewRecord = false;
        this.gameStartTime = performance.now();

        // システム初期化
        Camera.init(0);
        PlatformManager.init(this.canvasW, this.canvasH);
        ObstacleManager.init(this.canvasW, this.canvasH);
        Player.init(this.canvasW, this.canvasH);
        UI.resetGameOver();

        // iOS チルト権限リクエスト（初回のみ）
        if (Input.tiltSupported && !Input.tiltPermissionGranted) {
            Input.requestTiltPermission();
        }
    },

    /**
     * ゲームオーバー
     */
    gameOver() {
        this.currentState = this.STATE.GAMEOVER;
        this.gameOverTime = performance.now();
        Player.isAlive = false;

        // ハイスコア更新チェック
        const currentScore = Player.score;
        if (currentScore > this.highScore) {
            this.highScore = currentScore;
            this.isNewRecord = true;
            this._saveData();
        }
    },

    /**
     * 更新
     */
    update(dt, timestamp) {
        switch (this.currentState) {
            case this.STATE.TITLE:
                this._updateTitle(dt, timestamp);
                break;
            case this.STATE.PLAYING:
                this._updatePlaying(dt, timestamp);
                break;
            case this.STATE.GAMEOVER:
                this._updateGameOver(dt, timestamp);
                break;
        }
    },

    _updateTitle(dt, timestamp) {
        // タップでゲーム開始
        if (Input.isBouncePressed()) {
            this.startGame();
        }
    },

    _updatePlaying(dt, timestamp) {
        // 開始直後は入力を無視（タイトル画面のタップがバウンスに誤登録されるのを防ぐ）
        const elapsed = performance.now() - this.gameStartTime;
        if (elapsed < this.INPUT_DELAY) {
            Input.resetFrameFlags();
        }

        // プレイヤー更新
        Player.update(dt, this.canvasW);

        // カメラ更新
        Camera.update(Player.y, this.canvasH);

        // 足場更新（生成・削除）
        PlatformManager.update(Camera.y, this.canvasH, dt);

        // おじゃま更新（生成・移動・削除）
        ObstacleManager.update(Camera.y, this.canvasH, dt);

        // おじゃまとの衝突判定
        const hitObstacle = ObstacleManager.checkCollision(
            Player.x, Player.y, Player.width, Player.height
        );
        if (hitObstacle) {
            this.gameOver();
            return;
        }

        // ゲームオーバー判定（画面下に落下）
        const screenY = Player.y - Camera.y;
        if (screenY > this.canvasH + 50) {
            this.gameOver();
        }
    },

    _updateGameOver(dt, timestamp) {
        // リスタート受付（遅延後）
        const elapsed = performance.now() - this.gameOverTime;
        if (elapsed > this.RESTART_DELAY && Input.isBouncePressed()) {
            this.startGame();
        }
    },

    /**
     * 描画
     */
    render(timestamp) {
        const ctx = this.ctx;
        const w = this.canvasW;
        const h = this.canvasH;

        // 背景
        Background.render(ctx, w, h, Camera.y, timestamp);

        switch (this.currentState) {
            case this.STATE.TITLE:
                this._renderTitle(ctx, w, h, timestamp);
                break;
            case this.STATE.PLAYING:
                this._renderPlaying(ctx, w, h, timestamp);
                break;
            case this.STATE.GAMEOVER:
                this._renderGameOver(ctx, w, h, timestamp);
                break;
        }
    },

    _renderTitle(ctx, w, h, timestamp) {
        // 足場を見せる（雰囲気用）
        PlatformManager.render(ctx, Camera.y, h);
        Player.render(ctx, Camera.y, timestamp);

        // タイトルUI
        UI.renderTitle(ctx, w, h, timestamp);
    },

    _renderPlaying(ctx, w, h, timestamp) {
        // 足場
        PlatformManager.render(ctx, Camera.y, h);

        // おじゃま
        ObstacleManager.render(ctx, Camera.y, h);

        // プレイヤー
        Player.render(ctx, Camera.y, timestamp);

        // スコア
        UI.renderScore(ctx, Player.score, w);

        // コンボ
        UI.renderCombo(ctx, Player.comboCount, w);
    },

    _renderGameOver(ctx, w, h, timestamp) {
        // ゲーム画面を背景に残す
        PlatformManager.render(ctx, Camera.y, h);
        ObstacleManager.render(ctx, Camera.y, h);

        // ゲームオーバーUI
        UI.renderGameOver(ctx, w, h, Player.score, this.isNewRecord);
    },

    // ─── データ永続化 ───

    _loadData() {
        try {
            const data = JSON.parse(localStorage.getItem('gelpiyo_bounce'));
            if (data) {
                this.highScore = data.highScore || 0;
            }
        } catch (e) {
            this.highScore = 0;
        }
    },

    _saveData() {
        try {
            const existing = JSON.parse(localStorage.getItem('gelpiyo_bounce')) || {};
            existing.highScore = this.highScore;
            existing.totalPlays = (existing.totalPlays || 0) + 1;
            localStorage.setItem('gelpiyo_bounce', JSON.stringify(existing));
        } catch (e) {
            console.warn('データ保存失敗:', e);
        }
    },
};
