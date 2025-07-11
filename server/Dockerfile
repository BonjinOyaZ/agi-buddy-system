# server/Dockerfile
FROM node:18-alpine

# ① Gemini CLI を公式 npm パッケージからグローバルインストール
RUN npm install -g @google/gemini-cli

WORKDIR /usr/src/app

# ② 依存インストール
COPY package*.json ./
RUN npm ci --production

# ③ アプリ本体＋ai/以下を丸ごとコピー
COPY . .

EXPOSE 3000

# ④ サーバー起動
CMD ["node", "server.js"]
