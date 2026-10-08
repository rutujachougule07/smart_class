import { spawn } from 'child_process';
import http from 'http';
import os from 'os';
import path from 'path';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9222;
const TARGET_URL = "http://localhost:4173/";

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
          reject(new Error(`Failed to parse JSON (${res.statusCode}): ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTest() {
  const tmpProfile = path.join(os.tmpdir(), 'edge_sgm_test_' + Date.now());
  console.log(`Starting Edge in headless remote-debugging mode (profile: ${tmpProfile})...`);

  const edgeProc = spawn(EDGE_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    `--user-data-dir=${tmpProfile}`,
    'about:blank'
  ]);

  edgeProc.stderr.on('data', () => {});

  let version = null;
  for (let i = 0; i < 20; i++) {
    try {
      version = await requestJson(`http://localhost:${PORT}/json/version`);
      if (version && version.webSocketDebuggerUrl) break;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 500));
  }

  if (!version) {
    console.error('Failed to connect to Edge DevTools port 9222');
    edgeProc.kill();
    process.exit(1);
  }

  console.log('Edge DevTools ready:', version.Browser);

  // Open target page via PUT
  const newTarget = await requestJson(`http://localhost:${PORT}/json/new?${encodeURIComponent(TARGET_URL)}`, 'PUT');
  console.log('Opened target:', newTarget.id, newTarget.url);

  const ws = new WebSocket(newTarget.webSocketDebuggerUrl);

  ws.addEventListener('open', () => {
    console.log('WebSocket open!');
  });

  let msgId = 1;
  const pending = new Map();
  const errors = [];
  const warnings = [];

  ws.addEventListener('message', (event) => {
    const raw = event.data;
    const msg = JSON.parse(raw);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const type = msg.params.type;
      const text = msg.params.args.map(a => a.value || JSON.stringify(a)).join(' ');
      if (type === 'error') {
        console.error(`[Browser Console ERROR]:`, text);
        errors.push(text);
      } else if (type === 'warn') {
        warnings.push(text);
      }
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
      console.error(`[Browser EXCEPTION]:`, desc);
      errors.push(desc);
    }
  });

  await new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) return resolve();
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  console.log('Connected to target via WebSocket!');

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Runtime.enable');
  await send('Page.enable');
  await send('DOM.enable');

  console.log(`Waiting for page to load & Firebase data to settle...`);
  await new Promise(r => setTimeout(r, 4500));

  const docTitleRes = await send('Runtime.evaluate', { expression: 'document.title' });
  console.log('Page Title:', docTitleRes.result?.result?.value);

  const rootCheck = await send('Runtime.evaluate', { expression: 'Boolean(document.querySelector("#sidebar") && document.querySelector("#main-content"))' });
  console.log('Sidebar & Main Content Rendered:', rootCheck.result?.result?.value);

  // Visible nav tabs
  const tabsRes = await send('Runtime.evaluate', {
    expression: 'Array.from(document.querySelectorAll(".nav-link")).map(e => e.innerText.replace(/\\s+/g, " ").trim())'
  });
  console.log('Visible Navigation Tabs:', tabsRes.result?.result?.value);

  // Test clicking every tab in sequence
  console.log('\n--- TESTING TAB CLICKS AND SUB-VIEWS ---');
  const tabCount = tabsRes.result?.result?.value?.length || 9;
  for (let i = 0; i < tabCount; i++) {
    const clickTab = await send('Runtime.evaluate', {
      expression: `(() => {
        const links = document.querySelectorAll(".nav-link");
        if (links[${i}]) {
          links[${i}].click();
          return links[${i}].innerText.replace(/\\s+/g, ' ').trim();
        }
        return 'Not found';
      })()`
    });
    console.log(`Tab ${i} Clicked: "${clickTab.result?.result?.value}"`);
    await new Promise(r => setTimeout(r, 1500));
  }

  // Test Student attendance toggle between Daily and Monthly
  console.log('\n--- TESTING ATTENDANCE MODES IN STUDENTS TAB ---');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const links = document.querySelectorAll(".nav-link");
      if (links[3]) links[3].click(); // Tab 3 is Students
    })()`
  });
  await new Promise(r => setTimeout(r, 1000));

  const attendanceSelect = await send('Runtime.evaluate', {
    expression: `(() => {
      const select = document.querySelector('select');
      if (select) {
        select.value = 'monthly';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return 'Switched to monthly';
      }
      return 'No select found';
    })()`
  });
  console.log('Attendance Mode Switcher:', attendanceSelect.result?.result?.value);
  await new Promise(r => setTimeout(r, 1500));

  // Test opening modals
  console.log('\n--- TESTING MODALS ---');
  const testModal = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Add Student') || b.innerText.includes('Publish Notice') || b.innerText.includes('Create Exam'));
      return btn ? btn.innerText.trim() : 'No modal trigger found';
    })()`
  });
  console.log('Found modal trigger button:', testModal.result?.result?.value);

  console.log('\n====================================');
  console.log(`TEST COMPLETED.`);
  console.log(`Total Errors Detected: ${errors.length}`);
  console.log(`Total Warnings: ${warnings.length}`);
  console.log('====================================');

  ws.close();
  edgeProc.kill();
  process.exit(errors.length > 0 ? 1 : 0);
}

runTest().catch(err => {
  console.error("Test runner error:", err);
  process.exit(1);
});
