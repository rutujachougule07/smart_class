async function testN8n() {
  const urlReal = "https://webhooks.1automations.com/webhook/6ab2206ac277c1989c5cbdfd";
  const urlFake = "https://webhooks.1automations.com/webhook/nonexistent123456789";

  console.log("Fake GET:");
  let res = await fetch(urlFake, { method: 'GET' });
  console.log(res.status, await res.text());

  console.log("\nFake POST:");
  res = await fetch(urlFake, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a: 1 }) });
  console.log(res.status, await res.text());
}

testN8n();
