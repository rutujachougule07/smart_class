async function testEndpoints() {
  const base = "https://webhooks.1automations.com/webhook/6ab2206ac277c1989c5cbdfd";
  for (const path of ['', '/status', '/log', '/logs', '/history']) {
    try {
      const res = await fetch(base + path);
      console.log(path || '/', res.status, await res.text());
    } catch (e) {
      console.log(path, e.message);
    }
  }
}
testEndpoints();
