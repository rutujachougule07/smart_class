import { resolveWebhookUrlForStudent } from './src/services/webhookService.js';

const dailyUrl = 'https://webhooks.1automations.com/webhook/6ab2206ac277c1989c5cbdfd?number=91XXXXXXXXXX&message=day,AttendanceDate,StudentName,ClassDivision,AttendanceStatus,AttendanceRemark,SchoolName';
const monthlyUrl = 'https://webhooks.1automations.com/webhook/6ab20b38c277c1989c5ca144?number=91XXXXXXXXXX&message=monthly,MonthYear,StudentName,ClassDivision,TotalWorkingDays,DaysPresent,DaysAbsent,AttendancePercentage,Remark,SchoolName';
const examUrl = 'https://webhooks.1automations.com/webhook/6ab4c65fc277c1989c5ef36f?number=91XXXXXXXXXX&message=exam,studentname,class,examname,examdate,totalmarks,marksobtained,percentage,grade,resultstatus,resultremark,schoolname';

const mockStudent = {
  id: 's_test_1',
  name: 'Test Student',
  parentPhone: '917972495812',
  className: 'Class 10',
  division: 'A',
  status: 'Present',
  date: '2026-10-06',
  month: 'October',
  year: '2026',
  totalWorkingDays: 24,
  presentDays: 22,
  absentDays: 2,
  attendancePercentage: '91.6',
  examTitle: 'Mid Term Exam',
  totalMarks: 100,
  marksObtained: 85,
  percentage: '85',
  grade: 'A',
  resultStatus: 'PASSED',
  remarks: 'Excellent Performance'
};

const schoolProfile = {
  schoolName: 'SmartClass Academy'
};

async function testAll() {
  console.log('--- TESTING DAILY ---');
  const dailyRes = resolveWebhookUrlForStudent(dailyUrl, mockStudent, schoolProfile, 'daily');
  console.log('Resolved Daily URL:', dailyRes.resolvedUrl);
  console.log('Template Message:', dailyRes.templateMessage);
  try {
    const res = await fetch(dailyRes.resolvedUrl, { method: 'GET' });
    console.log('Daily GET status:', res.status, await res.text());
  } catch (e) {
    console.error('Daily error:', e.message);
  }

  console.log('\n--- TESTING MONTHLY ---');
  const monthlyRes = resolveWebhookUrlForStudent(monthlyUrl, mockStudent, schoolProfile, 'monthly');
  console.log('Resolved Monthly URL:', monthlyRes.resolvedUrl);
  console.log('Template Message:', monthlyRes.templateMessage);
  try {
    const res = await fetch(monthlyRes.resolvedUrl, { method: 'GET' });
    console.log('Monthly GET status:', res.status, await res.text());
  } catch (e) {
    console.error('Monthly error:', e.message);
  }

  console.log('\n--- TESTING EXAM ---');
  const examRes = resolveWebhookUrlForStudent(examUrl, mockStudent, schoolProfile, 'exam');
  console.log('Resolved Exam URL:', examRes.resolvedUrl);
  console.log('Template Message:', examRes.templateMessage);
  try {
    const res = await fetch(examRes.resolvedUrl, { method: 'GET' });
    console.log('Exam GET status:', res.status, await res.text());
  } catch (e) {
    console.error('Exam error:', e.message);
  }

  process.exit(0);
}

testAll();
