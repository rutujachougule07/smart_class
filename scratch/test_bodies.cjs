async function testBodies() {
  const url = "https://webhooks.1automations.com/webhook/6ab2206ac277c1989c5cbdfd";

  console.log("Test 1: POST with { number, message }");
  let res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      number: "918010861316",
      message: "Friday,25-09-2026,shweta patil,Class 8-B,Present,Regular Attendance,SmartClass Academy"
    })
  });
  console.log("Res 1:", await res.text());

  console.log("Test 2: POST with string body");
  res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: "hello"
  });
  console.log("Res 2:", await res.text());

  console.log("Test 3: POST urlencoded");
  res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: "number=918010861316&message=Friday,25-09-2026,shweta patil,Class 8-B,Present,Regular Attendance,SmartClass Academy"
  });
  console.log("Res 3:", await res.text());

  console.log("Test 4: URL with query params + POST");
  res = await fetch("https://webhooks.1automations.com/webhook/6ab2206ac277c1989c5cbdfd?number=918010861316&message=Friday,25-09-2026,shweta%20patil,Class%208-B,Present,Regular%20Attendance,SmartClass%20Academy", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      number: "918010861316",
      message: "Friday,25-09-2026,shweta patil,Class 8-B,Present,Regular Attendance,SmartClass Academy"
    })
  });
  console.log("Res 4:", await res.text());
}

testBodies();
