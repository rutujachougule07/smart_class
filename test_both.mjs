const monthlyUrl = 'https://webhooks.1automations.com/webhook/6ab20b38c277c1989c5ca144?number=917972495812&message=monthly,October%202026,Test%20Student,Class%2010-A,24,22,2,91.6,Excellent%20Performance,SmartClass%20Academy';
const examUrl = 'https://webhooks.1automations.com/webhook/6ab4c65fc277c1989c5ef36f?number=917972495812&message=exam,Test%20Student,Class%2010-A,Mid%20Term%20Exam,06-10-2026,100,85,85,A,PASSED,Excellent%20Performance,SmartClass%20Academy';

async function testBoth() {
  console.log('Testing Monthly...');
  try {
    const resM = await fetch(monthlyUrl);
    console.log('Monthly Status:', resM.status, await resM.text());
  } catch (e) {
    console.error('Monthly error:', e.cause || e);
  }

  console.log('Testing Exam...');
  try {
    const resE = await fetch(examUrl);
    console.log('Exam Status:', resE.status, await resE.text());
  } catch (e) {
    console.error('Exam error:', e.cause || e);
  }
}
testBoth();
