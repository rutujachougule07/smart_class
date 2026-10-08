import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9226;
const TARGET_URL = "http://localhost:5173/";
const OUTPUT_IMAGE = "C:\\ITPL\\PROJECTS\\SGM\\admin_panel\\scratch\\marks_tab_updated.png";

function requestJson(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: method
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const tmpProfile = path.join(os.tmpdir(), 'edge_snap_' + Date.now());
  const edgeProc = spawn(EDGE_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    `--user-data-dir=${tmpProfile}`,
    '--window-size=1280,850',
    'about:blank'
  ]);

  let version = null;
  for (let i = 0; i < 20; i++) {
    try {
      version = await requestJson(`http://localhost:${PORT}/json/version`);
      if (version && version.webSocketDebuggerUrl) break;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 400));
  }

  if (!version) {
    console.error('Edge failed to start');
    edgeProc.kill();
    process.exit(1);
  }

  const newTarget = await requestJson(`http://localhost:${PORT}/json/new?${encodeURIComponent(TARGET_URL)}`, 'PUT');
  const ws = new WebSocket(newTarget.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });

  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');
  
  // Wait for initial render
  await new Promise(r => setTimeout(r, 3000));

  // Click on Marks tab (tab 5)
  await send('Runtime.evaluate', {
    expression: `(() => {
      const navLinks = Array.from(document.querySelectorAll('.nav-link'));
      const marksLink = navLinks.find(l => l.innerText.includes('Marks'));
      if (marksLink) marksLink.click();
    })()`
  });

  // Wait for Marks table to render
  await new Promise(r => setTimeout(r, 2000));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot.result && shot.result.data) {
    fs.writeFileSync(OUTPUT_IMAGE, Buffer.from(shot.result.data, 'base64'));
    console.log('SUCCESS_MARKS_SCREENSHOT_SAVED:', OUTPUT_IMAGE);
  } else {
    console.error('Failed to capture screenshot');
  }

  ws.close();
  edgeProc.kill();
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
