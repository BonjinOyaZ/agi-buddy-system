# Gemini CLI 連携プロジェクト 引き継ぎファイル

## 1. プロジェクトの目的

LINEからのチャット入力を受け取り、Dockerコンテナ内で動作するNode.jsサーバー（`server.js`）を介して、Google Gemini CLIと対話するシステムを構築する。特に、渋沢栄一の哲学（Z-PHILO）をGemini CLIに初期知識として与え、対話に活用することを目指す。

## 2. 現在の課題

**Gemini CLIがDockerコンテナ内で正常に起動せず、`Gemini CLI startup timed out.` エラーが発生し続ける。**

## 3. これまでの経緯と試行錯誤

### 3.1. `server.js` の初期問題と改善

*   **問題点:**
    *   `readline` と `cli.stdout.on('data')` の競合による `stdout` データの取りこぼし。
    *   応答の区切り (`

`) がGemini CLIの出力と一致しない。
*   **改善:**
    *   `stdout` 処理を `readline` に一本化。
    *   応答の完了を `>` プロンプトの検出で判断するロジックに変更。
    *   リクエストごとに `gemini` プロセスを起動する方式を試行（オーバーヘッド大のため断念）。
    *   常駐プロセス方式に戻し、`init` フラグ（後に「はじめから」合言葉）で初期化・コンテキスト読み込みを行う方式へ移行。
    *   n8nが送信するテキスト末尾の改行コード (`
`) を `text.trim()` で除去する修正。

### 3.2. Dockerコンテナ環境での問題と改善

*   **問題点:**
    *   `server.js` から `zphilo/README.md` および `zphilo/zphilo.yaml` が読み込めない (`WARN: Could not read ...`)。
    *   `docker-compose.yml` の `volumes` 設定の書式エラー。
*   **改善:**
    *   `docker-compose.yml` に `zphilo` フォルダをコンテナ内にマウントする設定 (`- ./zphilo:/usr/src/zphilo`) を追加。
    *   `docker-compose.yml` の書式を修正。

### 3.3. Gemini CLIの起動問題と改善（現在進行形）

*   **問題点:**
    *   `gemini` コマンドをコンテナ内で直接実行すると、ロゴの後に**テーマ選択メニュー**が表示され、そこで処理が停止する。
    *   `Dockerfile` で `settings.json` を配置し、`server.js` でテーマ選択を自動でスキップするロジックを追加したが、依然としてテーマ選択メニューが表示される。
    *   `server.js` の起動タイムアウトを10秒から30秒に延長したが、`Gemini CLI startup timed out.` エラーが継続。
*   **現在の状況:**
    *   コンテナ内で `gemini --version` や `gemini help` は正常に動作する。
    *   `settings.json` は `/home/node/.gemini/settings.json` に正しく配置され、内容も `{"theme": "Default Dark"}` となっていることを確認済み。
    *   `gemini` 単体実行でテーマ選択メニューが表示されるのは変わらず。これは、`settings.json` が何らかの理由で無視されているか、テーマ選択後に別のインタラクティブなプロンプト（例: APIキー設定）が隠れている可能性を示唆。

## 4. 本日の作業 (2025年7月13日)

### 4.1. `server.js` の最適化とバックアップ戦略の確立
*   4つの`server.js`ファイルを評価し、`server.js_2025-07-13_023630_BK.js`をベースに採用。
*   `server.js`に、応答完了を`>`プロンプトで判断する`setupResponseHandling`関数を適切に呼び出すよう修正。
*   作業の節目ごとに`server.js`のバックアップを自動で作成する運用を開始。

### 4.2. `gemini` CLI起動問題の深掘り
*   **`stdbuf` コマンドの問題:**
    *   当初、デバッグ目的で`server.js`に`stdbuf`コマンドを導入したが、コンテナ環境に`stdbuf`が含まれていないことが判明し、`Dockerfile`に`coreutils`を追加して解決。
    *   その後、`stdbuf`の引数指定が誤っていたことによる`missing operand`エラーが発生し、`server.js`を修正。
    *   最終的に`stdbuf`の使用を中止し、`server.js`から関連記述を削除。
*   **Node.jsバージョンの問題:**
    *   `gemini-cli`がNode.js v20以上を要求していることが`npm warn`ログから判明。`Dockerfile`のNode.jsバージョンを`18-alpine`から`22-alpine`に更新。
*   **`server.js`構文エラーの問題:**
    *   `cli.stdin.write('\n');`の文字列リテラル内の改行コードの記述ミスにより`SyntaxError`が発生し、Node.jsサーバーが起動しない問題が発生。`server.js`を修正し、`'\n'`と正しくエスケープして解決。
*   **`gemini`コマンドの実行パスと実体の問題:**
    *   `gemini`コマンドが`PATH`上にない、または直接実行できない問題が発生。調査の結果、`gemini`が`/usr/local/lib/node_modules/@google/gemini-cli/dist/index.js`へのシンボリックリンクであり、Node.jsスクリプトであることが判明。
    *   `server.js`の`spawn`コマンドを`gemini`直接実行から`node /usr/local/lib/node_modules/@google/gemini-cli/dist/index.js`へと変更し、Node.jsスクリプトとして明示的に実行するように修正。
*   **起動時の隠れたインタラクティブプロンプトの問題:**
    *   上記全ての修正後も`Gemini CLI startup timed out.`エラーが継続。コンテナ内で`gemini`を直接実行すると`No input provided via stdin.`と表示されることから、APIキー設定以外の隠れたインタラクティブプロンプトが存在する可能性が高いと判断。
    *   `server.js`の`startGeminiProcess`内で、`gemini`プロセス起動直後と、`>`プロンプト検出後に無条件で空の改行を送信するよう修正。

## 5. 今後のスケジュール

1.  **`gemini` CLIの起動問題の最終確認:**
    *   現在の`server.js`の修正が、`gemini` CLIの起動タイムアウト問題を解決したか、再度`send_request.js`を実行して確認する。
    *   もしタイムアウトが続く場合、`docker-compose logs --tail 50 chat-server`で最新のログを詳細に分析し、新たなエラーや警告がないか確認する。
2.  **インタラクティブプロンプトの特定と対処:**
    *   それでも起動しない場合、`docker-compose exec chat-server sh`でコンテナに接続し、`node /usr/local/lib/node_modules/@google/gemini-cli/dist/index.js`を直接実行し、表示されるプロンプトやメッセージを正確に特定する。
    *   特定したプロンプトに対して、`server.js`で適切な入力を自動送信するロジックを追加するか、`expect`などのツール導入を検討する。
3.  **APIキー設定の再確認:**
    *   万が一、APIキーが正しくコンテナに渡されていない可能性も考慮し、コンテナ内で`echo $GEMINI_API_KEY`を実行し、値が正しく表示されるか確認する。
4.  **安定稼働後の機能開発:**
    *   Gemini CLIの安定起動が確認でき次第、LINEからのチャット入力とGemini CLIの対話連携機能の本格的な開発に着手する。
    *   渋沢栄一の哲学（Z-PHILO）をGemini CLIに初期知識として与える部分の実装を進める。