const express = require('express');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');

const app = express();
app.use(bodyParser.json());

app.post('/api/chat', (req, res) => {
  const userText = req.body.text;
  const cli = spawn('gemini', ['--prompt', userText, '--all_files'], { cwd: __dirname });
  
    // ←ここを追加
  cli.on('error', err => {
    console.error('Failed to launch gemini:', err);
    return res.status(500).json({ error: 'Failed to launch gemini', details: err.message });
  });
  // ↑追加ここまで
  
  let output = '';
  cli.stdout.on('data', d => output += d.toString());
  cli.stderr.on('data', e => console.error(e.toString()));
  cli.on('close', code => {
    if (code !== 0) return res.status(500).json({ error: code });
    res.json({ reply: output.trim() });
  });
});

app.listen(3000, () => console.log('Listening http://localhost:3000/api/chat'));
