async function testFetch() {
  const url = "https://webhooks.1automations.com/webhook/6ab2206ac277c1989c5cbdfd?number=918010861316&message=Friday,25-09-2026,shweta%20patil,Class%208-B,Present,Regular%20Attendance,SmartClass%20Academy";

  console.log("Testing GET with literal commas:");
  const resGet = await fetch(url, { method: 'GET' });
  console.log("GET:", resGet.status, await resGet.text());

  console.log("\nTesting POST with literal commas in query + JSON body:");
  const resPost = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      number: "918010861316",
      message: "Friday,25-09-2026,shweta patil,Class 8-B,Present,Regular Attendance,SmartClass Academy"
    })
  });
  console.log("POST:", resPost.status, await resPost.text());
}
testFetch();
