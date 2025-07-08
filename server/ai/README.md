# Z-PHILO(哲学バディシステム)【フェーズ0：MVP】

**Z-PHILO** は、ユーザー自身の哲学・ビジョン・行動指針を構造化し、
渋沢栄一の思想を継承したAI人格とともに、
日々の意思決定と自己成長を支援する「哲学バディ」システムです。

---

## 🎯 プロジェクト目的

* 自分のフィロソフィを `zphilo.yaml` で定義
* 渋沢栄一を模したAI人格は `GEMINI.md` で不死化
* Gemini CLIやLINE等を通じて、哲学的フィードバックを日常に導入

---

## 🧰 構成ファイル一覧

| ファイル               | 役割                   |
| ------------------ | -------------------- |
| `zphilo.yaml`      | ユーザーの哲学・ビジョン・バリューを定義 |
| `GEMINI.md`        | 渋沢栄一を模した人格プロンプト      |
| `logs/`            | 日々の対話・思考ログを記録        |
| `inbox/` `outbox/` | AIに渡す素材と返ってきた出力の保管場所 |
| `.env`             | APIキーなど、Git管理外ファイル   |

---

## 💻 実行環境（例）

* VS Code + GitHub連携
* Miniconda環境名：`zphilo`
* Gemini CLI（v2.5-pro）
* n8n（LINE連携用に利用予定）

---

## 🚀 実行例（CLI）

```bash
gemini chat --input GEMINI.md --input zphilo.yaml \
  --message "この人の5年後ビジョンについて、渋沢栄一としてコメントして"
```

---

## 🔑 初期シチュエーションテンプレ（行動指針 `values:` の記入欄）

以下は、Z-PHILOが提供する“人生の選択軸”を考える10の問い。**ユーザー自身が渋沢栄一との壁打ちを通して書き込む余白**として、最初は空欄のまま用意します：

```yaml
values:
  - situation: "逆境に直面したとき"
    action: ""

  - situation: "利益と倫理が衝突したとき"
    action: ""

  - situation: "人と意見が食い違ったとき"
    action: ""

  - situation: "怒りを感じたとき"
    action: ""

  - situation: "判断に迷ったとき（優先順位）"
    action: ""

  - situation: "新しい挑戦をするか迷ったとき"
    action: ""

  - situation: "誘惑や甘えに流されそうなとき"
    action: ""

  - situation: "仲間が困っているとき"
    action: ""

  - situation: "自分の実力が足りないと痛感したとき"
    action: ""

  - situation: "誰かに裏切られたり、失望したとき"
    action: ""
```

---

## 📜 ライセンス

MIT License（予定）

---

## 📌 注意

* `.env` にはAPIキーなどを格納し、Gitには含めません
* 本プロジェクトは個人の思想・理念の構築支援を目的とし、一般的なAIチャットボットとは異なります

---

## 🤝 作者・運営

* BonjinOyaZ（GitHub ID）
* 未来の哲学を育てる開発者チームと共に構築中
