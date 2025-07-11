const express = require('express');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const app = express();
app.use(bodyParser.json());

// ログ書き出しの設定
const logPath = path.join(__dirname, 'ai', 'gemini.log');
const logStream = fs.createWriteStream(logPath, { flags: 'a' });

// Gemini CLI のワーキングディレクトリ
const geminiCwd = path.join(__dirname, 'ai');

// ① 起動時に一度だけ Gemini CLI を立ち上げ
const cli = spawn('gemini', ['chat'], {
  cwd: geminiCwd,
  stdio: ['pipe', 'pipe', 'pipe']
});

cli.on('error', err => {
  console.error('Gemini CLI failed to start:', err);
  process.exit(1);
});

// ② stdout / stderr をログファイルへ書き込む
const outRl = readline.createInterface({ input: cli.stdout });
const errRl = readline.createInterface({ input: cli.stderr });

function writeLog(prefix, line) {
  const ts = new Date().toISOString();
  logStream.write(`[${ts}] ${prefix} ${line}\n`);
}

outRl.on('line', line => writeLog('OUT:', line));
errRl.on('line', line => writeLog('ERR:', line));

// ③ リクエストごとにやり取りを同期させるためのキュー
let pending = null;

cli.stdout.on('data', chunk => {
  if (!pending) return;
  pending.buffer += chunk.toString();
  // ここでは「空行2つ」を区切りと想定
  if (pending.buffer.endsWith('\n\n')) {
    pending.resolve(pending.buffer.trim());
    pending = null;
  }
});

app.post('/api/chat', async (req, res) => {
  const userText = req.body.text;
  // 前のリクエストがまだ終わっていれば429で拒否
  if (pending) {
    return res.status(429).json({ error: 'Previous request still processing' });
  }

  // ユーザー入力ログ
  writeLog('USER:', userText);

  // 新しいリクエスト用 Promise
  pending = { buffer: '', resolve: null, reject: null };
  const replyPromise = new Promise((resolve, reject) => {
    pending.resolve = resolve;
    pending.reject = reject;
  });

  // CLI にテキストを流し込む
  cli.stdin.write(userText + '\n');

  try {
    const reply = await replyPromise;
    // アシスタント出力ログ
    writeLog('ASSISTANT:', reply);
    res.json({ reply });
  } catch (err) {
    console.error('Error during reply:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// サーバー起動
app.listen(3000, () => {
  console.log('Server listening on http://localhost:3000/api/chat with persistent Gemini CLI');
  writeLog('INFO:', 'Server started and Gemini CLI launched');
});
