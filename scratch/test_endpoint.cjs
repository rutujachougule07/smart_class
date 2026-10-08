const https = require('https');

async function test1Automations() {
  const testUrl = "https://webhooks.1automations.com/webhook/6ab2206ac277c1989c5cbdfd?number=918010861316&message=Friday,25-09-2026,shweta%20patil,Class%208-B,Present,Regular%20Attendance,SmartClass%20Academy";

  console.log("--- Testing GET ---");
  try {
    const resGet = await fetch(testUrl, { method: 'GET' });
    console.log("GET status:", resGet.status);
    console.log("GET response:", await resGet.text());
  } catch (e) {
    console.log("GET error:", e.message);
  }

  console.log("\n--- Testing POST (JSON with custom headers) ---");
  try {
    const resPost = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SmartClass-Source': 'SmartClass-Admin-Panel',
        'X-SmartClass-Event': 'daily_attendance'
      },
      body: JSON.stringify({ test: "data" })
    });
    console.log("POST status:", resPost.status);
    console.log("POST response:", await resPost.text());
  } catch (e) {
    console.log("POST error:", e.message);
  }

  console.log("\n--- Testing POST (empty body) ---");
  try {
    const resPostEmpty = await fetch(testUrl, {
      method: 'POST'
    });
    console.log("POST empty status:", resPostEmpty.status);
    console.log("POST empty response:", await resPostEmpty.text());
  } catch (e) {
    console.log("POST empty error:", e.message);
  }

  console.log("\n--- Testing OPTIONS (preflight check) ---");
  try {
    const resOptions = await fetch(testUrl, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, X-SmartClass-Source, X-SmartClass-Event'
      }
    });
    console.log("OPTIONS status:", resOptions.status);
    console.log("OPTIONS response headers:", Object.fromEntries(resOptions.headers.entries()));
    console.log("OPTIONS response:", await resOptions.text());
  } catch (e) {
    console.log("OPTIONS error:", e.message);
  }
}

test1Automations();
