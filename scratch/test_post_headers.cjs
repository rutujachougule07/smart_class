async function testPostHeaders() {
  const url = "https://webhooks.1automations.com/webhook/6ab2206ac277c1989c5cbdfd";
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SmartClass-Source': 'SmartClass-Admin-Panel',
      'X-SmartClass-Event': 'daily_attendance'
    },
    body: JSON.stringify({ test: "data" })
  });
  console.log("POST headers:", Object.fromEntries(res.headers.entries()));
}
testPostHeaders();
