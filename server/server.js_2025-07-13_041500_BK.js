const express = require('express');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const app = express();
app.use(bodyParser.json());

// --- パスと設定 ---
const logPath = path.join(__dirname, 'ai', 'gemini.log');
const geminiCwd = path.join(__dirname, 'ai');
const readmePath = path.join(__dirname, '..', 'zphilo', 'README.md');
const zphiloYamlPath = path.join(__dirname, '..', 'zphilo', 'zphilo.yaml');
const INIT_KEYWORD = "はじめから"; // 初期化のための合言葉

// --- ログ関数 ---
function writeLog(prefix, line) {
  const ts = new Date().toISOString();
  const logLine = `[${ts}] ${prefix} ${line}\n`;
  fs.appendFile(logPath, logLine, (err) => {
    if (err) console.error('Failed to write to log:', err);
  });
  console.log(logLine.trim());
}

// --- Geminiプロセス管理 ---
let cli = null;
let outRl = null;
let pending = null;

function stopGeminiProcess() {
  if (cli) {
    writeLog('INFO', 'Stopping existing Gemini CLI process...');
    cli.kill();
    cli = null;
    outRl = null;
    if (pending) {
      pending.reject(new Error('CLI process was restarted.'));
      pending = null;
    }
  }
}

function startGeminiProcess() {
  return new Promise((resolveProcessReady, rejectProcessReady) => {
    stopGeminiProcess();

    writeLog('INFO', 'Starting new Gemini CLI process...');
    // デバッグ用に詳細なログを出力するコマンド
    cli = spawn('node', ['/usr/local/lib/node_modules/@google/gemini-cli/dist/index.js'], { cwd: geminiCwd, shell: true });
    cli.stdin.write('\n'); // ★★★ 追加: 起動直後に空の改行を送信 ★★★

    let startupTimeout = setTimeout(() => {
      rejectProcessReady(new Error('TIMEOUTじゃ'));
      stopGeminiProcess();
    }, 60000);

    cli.on('error', (err) => {
      clearTimeout(startupTimeout);
      writeLog('FATAL', `Gemini CLI failed to start: ${err.message}`);
      cli = null;
      rejectProcessReady(err);
    });

    cli.on('exit', (code, signal) => {
      clearTimeout(startupTimeout);
      writeLog('INFO', `Gemini CLI exited with code ${code}, signal ${signal}.`);
      cli = null;
      if (code !== 0 && pending) {
        pending.reject(new Error(`Gemini CLI exited with code ${code}`));
        pending = null;
      }
    });

    const errRl = readline.createInterface({ input: cli.stderr });
    errRl.on('line', (line) => writeLog('ERR:', line));

    outRl = readline.createInterface({ input: cli.stdout });

    const startupListener = (line) => {
      writeLog('OUT:', line);
      if (line.includes('Select Theme')) {
        writeLog('DEBUG', 'Theme selection detected. Sending Enter.');
        cli.stdin.write('\n');
      } else if (line.trim().endsWith('>')) {
        writeLog('DEBUG', 'Gemini CLI is ready.');
        clearTimeout(startupTimeout);
        outRl.removeListener('line', startupListener); // 起動リスナーを削除
        cli.stdin.write('\n'); // ★★★ 追加: 起動完了後に空の改行を送信 ★★★
        resolveProcessReady(); // 準備完了
      }
    };

    outRl.on('line', startupListener);
  });
}

// --- 応答完了ハンドリング ---
function setupResponseHandling() {
  if (!outRl || !cli) return;

  let buffer = '';
  let responseTimeout = null;

  const onLine = (line) => {
    writeLog('OUT:', line);
    
    // プロンプト `>` が単独で現れたら応答完了とみなす
    if (line.trim() === '>') {
      if (pending) {
        const finalReply = buffer.replace(/>\s*$/, '').trim();
        pending.resolve(finalReply);
        pending = null;
        buffer = '';
      }
      clearTimeout(responseTimeout);
      return;
    }
    
    buffer += line + '\n';
    resetResponseTimeout();
  };

  const resetResponseTimeout = () => {
    clearTimeout(responseTimeout);
    responseTimeout = setTimeout(() => {
      if (pending) {
        if (buffer.length > 0) {
          writeLog('WARN', 'Response timed out, but returning buffered content.');
          pending.resolve(buffer.trim());
        } else {
          writeLog('ERROR', 'Response timed out with no data.');
          pending.reject(new Error('Response timed out'));
        }
        pending = null;
        buffer = '';
      }
    }, 10000); // 10秒のタイムアウト
  };

  outRl.removeAllListeners('line');
  outRl.on('line', onLine);
}


// --- APIエンドポイント ---
app.post('/api/chat', async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  if (pending) {
    return res.status(429).json({ error: 'Previous request still processing' });
  }

  // --- 初期化リクエストの処理 ---
  if (text.trim() === INIT_KEYWORD) {
    writeLog('INFO', 'Initialization keyword received. Restarting Gemini CLI with context...');
    try {
      await startGeminiProcess();
      setupResponseHandling(); // ★★★ 応答ハンドリングを開始 ★★★
    } catch (err) {
      writeLog('ERROR', `Failed to start Gemini CLI: ${err.message}`);
      return res.status(500).json({ error: `Failed to start Gemini CLI: ${err.message}` });
    }

    if (!cli) {
      return res.status(500).json({ error: 'Failed to start Gemini process after initialization.' });
    }

    let readmeContent = '';
    let zphiloContent = '';
    try {
      readmeContent = fs.readFileSync(readmePath, 'utf-8');
    } catch (e) {
      writeLog('WARN', `Could not read ${readmePath}`);
    }
    try {
      zphiloContent = fs.readFileSync(zphiloYamlPath, 'utf-8');
    } catch (e) {
      writeLog('WARN', `Could not read ${zphiloYamlPath}`);
    }

    const initialPrompt = `わが友よ、対話を始めよう。まずは、君のプロジェクトの概要と、現在の哲学の状態をわしに共有しておくれ。これを元に、我々の議論を深めていこうじゃないか.\n\n--- README.md ---\n${readmeContent}\n\n--- zphilo.yaml ---\n${zphiloContent}`;
    
    cli.stdin.write(initialPrompt + '\n\n'); // コンテキストを送信

    try {
      let resolve, reject;
      const contextPromise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      pending = { buffer: '', resolve, reject };
      
      // コンテキスト投入後の最初の応答を待つ
      await contextPromise;

      const initReply = "承知した。記憶を新たにして、対話を始めようぞ。さあ、最初の言葉をかけておくれ。";
      writeLog('ASSISTANT:', initReply);
      res.json({ reply: initReply });
    } catch (err) {
      writeLog('ERROR', `Error during initialization: ${err.message}`);
      res.status(500).json({ error: 'Failed to initialize context.' });
    }
    return;
  }

  // --- 通常リクエストの処理 ---
  if (!cli) {
    return res.status(503).json({ error: `わしはまだ目覚めておらん。「${INIT_KEYWORD}」と呼びかけて、対話を開始してくれ。` });
  }

  writeLog('USER:', text);
  cli.stdin.write(text.trim() + '\n');

  try {
    let resolve, reject;
    const replyPromise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    pending = { buffer: '', resolve, reject };

    const reply = await replyPromise;
    writeLog('ASSISTANT:', reply);
    res.json({ reply });
  } catch (err) {
    writeLog('ERROR', `Error during reply: ${err.message}`);
    if (pending) pending = null;
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- サーバー起動 ---
const port = 3000;
app.listen(port, () => {
  writeLog('INFO', `Server listening on http://localhost:${port}/api/chat`);
  writeLog('INFO', `Send "${INIT_KEYWORD}" to start a session.`);
});