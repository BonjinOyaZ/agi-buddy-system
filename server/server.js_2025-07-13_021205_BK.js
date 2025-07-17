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
function writeLog(prefix, line) {  const ts = new Date().toISOString();  const logLine = `[${ts}] ${prefix} ${line}
`;  fs.appendFile(logPath, logLine, (err) => {    if (err) console.error('Failed to write to log:', err);  });  console.log(logLine.trim());}

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
    cli = spawn('sh', ['-c', 'echo -e "\n" | gemini'], { cwd: geminiCwd, shell: true }); // Corrected spawn command // Corrected spawn command // Corrected spawn command // Corrected spawn command // Corrected spawn command
    // cli.stdin.write('\n'); // This was causing issues, removed for now as it's handled by echo -e

    let startupTimeout = setTimeout(() => {
      rejectProcessReady(new Error('TIMEOUTじゃ'));
      stopGeminiProcess(); // Clean up if timeout occurs
    }, 60000); // 60 seconds timeout for startup

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
      if (code !== 0) rejectProcessReady(new Error(`Gemini CLI exited with code ${code}`));
    });

    const errRl = readline.createInterface({ input: cli.stderr });
    errRl.on('line', (line) => writeLog('ERR:', line));

    let promptDetectedDuringStartup = false; // Flag to ensure we only resolve once

    outRl = readline.createInterface({ input: cli.stdout });
    outRl.on('line', (line) => {
      writeLog('OUT:', line);

      // Detect theme selection prompt and send Enter
      if (line.includes('Select Theme') && !promptDetectedDuringStartup) {
        writeLog('DEBUG', 'Theme selection detected. Sending Enter.\n');
        cli.stdin.write('\n'); // Send Enter to select default
        return;
      }

      // Detect the prompt '>' after the initial interactive part
      if (line.trim().endsWith('>') && !promptDetectedDuringStartup) {
        writeLog('DEBUG', 'Gemini CLI is ready (prompt detected during startup).\n');
        promptDetectedDuringStartup = true; // Ensure we don't resolve multiple times
        clearTimeout(startupTimeout); // Clear the timeout as we are ready
        resolveProcessReady(); // Resolve the promise indicating process is ready
        return;
      }

      // If the process is ready and there's a pending chat request, buffer the output
      if (promptDetectedDuringStartup && pending) {
        pending.buffer += line + '\n';
      }
    });
  });
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
      await startGeminiProcess(); // Gemini CLIが完全に準備できるまで待機
    } catch (err) {
      return res.status(500).json({ error: `Failed to start Gemini CLI: ${err.message}` });
    }

    if (!cli) {
        return res.status(500).json({ error: 'Failed to start Gemini process after initialization.' });
    }

    let readmeContent = '';
    let zphiloContent = '';
    try { readmeContent = fs.readFileSync(readmePath, 'utf-8'); } catch (e) { writeLog('WARN', `Could not read ${readmePath}`); }
    try { zphiloContent = fs.readFileSync(zphiloYamlPath, 'utf-8'); } catch (e) { writeLog('WARN', `Could not read ${zphiloYamlPath}`); }

    const initialPrompt = `わが友よ、対話を始めよう。まずは、君のプロジェクトの概要と、現在の哲学の状態をわしに共有しておくれ。これを元に、我々の議論を深めていこうじゃないか.\n\n--- README.md ---\n${readmeContent}\n\n--- zphilo.yaml ---\n${zphiloContent}`;

    // --- 修正点: initialPrompt を行ごとに送信し、最後に空行を送信 --- 
    const initialPromptLines = initialPrompt.split('\n');
    for (const line of initialPromptLines) {
        cli.stdin.write(line + '\n');
    }
    cli.stdin.write('\n'); // Send an extra newline to signal end of multi-line input
    
    try {
        let resolve, reject;
        const contextPromise = new Promise((res, rej) => { resolve = res; reject = rej; });
        pending = { buffer: '', resolve, reject };
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
  cli.stdin.write(text + '\n');

  try {
    let resolve, reject;
    const replyPromise = new Promise((res, rej) => { resolve = res; reject = rej; });
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