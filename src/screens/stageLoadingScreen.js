import { publish } from '../core/eventBus.js';
import { gameState } from '../core/gameState.js';
import { getEnemiesByStageId } from '../loaders/dataLoader.js';
import { loadBgImage, loadMonsterImage } from '../loaders/assetsLoader.js';

const stageLoadingState = {
  canvas: null,
  ctx: null,
  progress: 0,
  stageId: null,

  async enter(canvas) {
    try {
      console.log("🔄 stageLoadingState.enter() 実行", { canvas, stageId: gameState.currentStageId });
      
      // キャンバス要素を取得 (引数またはDOM)
      this.canvas = canvas || document.getElementById('gameCanvas');
      if (!this.canvas) {
        console.error('キャンバス要素が見つかりません。DOMから取得を試みます。');
        this.canvas = document.getElementById('gameCanvas');
      }
      
      if (!this.canvas) {
        throw new Error('キャンバス要素が見つかりません');
      }
      
      this.ctx = this.canvas.getContext('2d');
      this.progress = 0;
      this.stageId = gameState.currentStageId;

      if (!this.stageId) {
        console.error('ステージIDが未設定のため、ローディングを中止します。');
        publish('changeScreen', 'stageSelect');
        return;
      }

      // 1. このステージで必要なアセットのリストを作成
      const enemies = getEnemiesByStageId(this.stageId);
      console.log(`ステージ[${this.stageId}]の敵: ${enemies.length}体`, enemies);
      
      const loadPromises = [loadBgImage(this.stageId)];
      
      // 各敵の画像読み込みを試みる（個別にエラーハンドリング）
      for (const enemy of enemies) {
        const enemyPromise = loadMonsterImage(enemy)
          .catch(err => {
            console.warn(`敵[${enemy.id}]の画像読み込みに失敗しましたが、続行します:`, err);
            return null; // エラーが発生しても続行
          });
        loadPromises.push(enemyPromise);
      }

      // 2. プログレスバーを更新しながら、すべてのアセットを並行して読み込む
      const totalAssets = loadPromises.length;
      let loadedCount = 0;

      const progressCallback = () => {
        loadedCount++;
        this.progress = loadedCount / totalAssets;
        // 進捗状況を表示するために強制的に再描画
        this.update(0);
      };

      const wrappedPromises = loadPromises.map(p => p.then(result => {
        progressCallback();
        return result;
      }));

      // Promise.allSettledを使用して、一部の画像が読み込めなくても続行
      const results = await Promise.allSettled(wrappedPromises);
      
      // 結果のログ出力
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      console.log(`アセット読み込み結果: 成功=${succeeded}, 失敗=${failed}`);

      // 3. ロード完了後、バトル画面へ遷移
      console.log(`ステージ[${this.stageId}]のアセット読み込み完了。バトル画面へ遷移します。`);
      
      // 直接ステージIDに遷移せず、常にbattleスクリーンに遷移する
      gameState.currentStageId = this.stageId;
      // キャンバスとステージIDを渡す
      publish('changeScreen', 'battle', this.canvas);

    } catch (err) {
      console.error(`[${this.stageId}]のアセット読み込み中にエラー:`, err);
      alert('ステージの準備に失敗しました。ステージ選択に戻ります。');
      publish('changeScreen', 'stageSelect');
    }
  },

  update(dt) {
    const { ctx, canvas } = this;
    if (!ctx) return;

    // ローディング画面の描画
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = 600;
    const barHeight = 30;
    const x = (canvas.width - barWidth) / 2;
    const y = (canvas.height - barHeight) / 2;

    ctx.fillStyle = '#555';
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(x, y, barWidth * this.progress, barHeight);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(x, y, barWidth, barHeight);

    ctx.fillStyle = '#fff';
    ctx.font = '16px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${Math.floor(this.progress * 100)}%`, canvas.width / 2, y + barHeight + 8);
    ctx.fillText(`ステージ準備中...`, canvas.width / 2, y - 20);
  },

  exit() {
    console.log("🚪 stageLoadingState.exit() 実行");
    this.ctx = null;
    this.canvas = null;
  }
};

export default stageLoadingState;