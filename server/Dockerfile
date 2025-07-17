# server/Dockerfile
FROM node:22-alpine

# デバッグツールをインストール
RUN apk add --no-cache procps strace coreutils

# ① Gemini CLI を公式 npm パッケージからグローバルインストール
RUN npm install -g @google/gemini-cli

# Gemini CLI の設定ファイルを配置し、インタラクティブなテーマ選択をスキップ
RUN mkdir -p /home/node/.gemini && \
    printf '{"theme": "Default Dark"}' > /home/node/.gemini/settings.json && \
    chown -R node:node /home/node/.gemini

WORKDIR /usr/src/app

# ② 依存インストール
COPY package*.json ./
RUN npm ci --production

# ③ アプリ本体＋ai/以下を丸ごとコピー
COPY . .

EXPOSE 3000

# ④ サーバー起動
CMD ["node", "server.js"]