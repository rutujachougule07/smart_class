const dailyUrl = 'https://webhooks.1automations.com/webhook/6ab2206ac277c1989c5cbdfd?number=917972495812&message=day,06-10-2026,Test%20Student,Class%2010-A,Present,Excellent%20Performance,SmartClass%20Academy';

async function testFetch() {
  try {
    const res = await fetch(dailyUrl);
    console.log('Status:', res.status, await res.text());
  } catch (e) {
    console.error('Error cause:', e.cause || e);
  }
}
testFetch();
