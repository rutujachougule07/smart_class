import { resolveWebhookUrlForStudent, buildStudentWebhookPayload } from '../src/services/webhookService.js';

const url = "https://webhooks.1automations.com/webhook/6ab2206ac277c1989c5cbdfd?number=91XXXXXXXXXX&message=day,AttendanceDate,StudentName,ClassDivision,AttendanceStatus,AttendanceRemark,SchoolName";
const student = {
  id: "s1",
  name: "shweta patil",
  className: "Class 8",
  division: "B",
  status: "Present",
  parentPhone: "8010861316",
  date: "2026-09-25"
};
const schoolProfile = { schoolName: "St. Mary School" };

const res = resolveWebhookUrlForStudent(url, student, schoolProfile, 'daily');
console.log("Resolved URL:\n", res.resolvedUrl);
console.log("\nRaw message:\n", res.templateMessage);

const payload = buildStudentWebhookPayload({ student, schoolProfile, date: '2026-09-25', eventType: 'daily_attendance' });
console.log("\nPayload:\n", JSON.stringify(payload, null, 2));
