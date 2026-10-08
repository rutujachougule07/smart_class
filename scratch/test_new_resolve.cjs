function resolveWebhookUrlForStudentTest(rawUrl, studentData, schoolProfile = {}) {
  let url = String(rawUrl || '').trim();
  if (!url) return { resolvedUrl: '' };

  const sanitize = (val) => String(val || '').replace(/,/g, ' ').trim();
  const digits = String(studentData.parentPhone || studentData.phone || '').replace(/\D/g, '');
  let phone = digits.length === 10 ? `91${digits}` : digits;

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const now = new Date();
  const day = days[now.getDay()];
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const attendanceDate = `${dd}-${mm}-${yyyy}`;

  const studentName = sanitize(studentData.name || studentData.studentName || 'Student');
  let classDivision = sanitize(studentData.className || 'Class');
  if (studentData.division && studentData.division !== '-') {
    const cleanDiv = sanitize(studentData.division);
    if (!classDivision.includes(cleanDiv)) {
      classDivision = `${classDivision}-${cleanDiv}`;
    }
  }

  const rawStatus = String(studentData.status || '').trim().toLowerCase();
  const attendanceStatus = rawStatus === 'absent' ? 'Absent' : 'Present';
  const attendanceRemark = sanitize(studentData.remarks || (attendanceStatus === 'Present' ? 'Regular Attendance' : 'Absent Today'));
  const schoolName = sanitize(schoolProfile.schoolName || 'SmartClass Academy');

  const rawMessage = [day, attendanceDate, studentName, classDivision, attendanceStatus, attendanceRemark, schoolName].join(',');
  const encodedCommaDelimited = [
    encodeURIComponent(day),
    encodeURIComponent(attendanceDate),
    encodeURIComponent(studentName),
    encodeURIComponent(classDivision),
    encodeURIComponent(attendanceStatus),
    encodeURIComponent(attendanceRemark),
    encodeURIComponent(schoolName)
  ].join(',');

  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has('number')) {
      parsed.searchParams.set('number', phone || '91XXXXXXXXXX');
    }
    let msg = parsed.searchParams.get('message') || '';
    if (
      msg.includes('StudentName') ||
      msg.includes('AttendanceDate') ||
      msg.includes('day,') ||
      msg === 'day,AttendanceDate,StudentName,ClassDivision,AttendanceStatus,AttendanceRemark,SchoolName'
    ) {
      // Use literal commas in the final URL so 1automations / WhatsApp split(',') extracts all 7 parameters!
      parsed.searchParams.delete('message');
      let base = parsed.toString();
      const delim = base.includes('?') ? '&' : '?';
      url = `${base}${delim}message=${encodedCommaDelimited}`;
    } else {
      url = parsed.toString();
    }
  } catch (_) {
    url = url.replace(/([?&]number=)[^&]*/, `$1${phone}`);
    url = url.replace(/([?&]message=)[^&]*/, `$1${encodedCommaDelimited}`);
  }

  // Fallback replacements
  if (phone) {
    url = url.replace(/91X{8,12}/gi, phone);
    url = url.replace(/X{10,12}/gi, phone);
  }

  return {
    resolvedUrl: url,
    rawMessage,
    encodedCommaDelimited
  };
}

const testUrl = "https://webhooks.1automations.com/webhook/6ab2206ac277c1989c5cbdfd?number=91XXXXXXXXXX&message=day,AttendanceDate,StudentName,ClassDivision,AttendanceStatus,AttendanceRemark,SchoolName";
const student = {
  name: "shweta patil",
  className: "Class 8",
  division: "B",
  status: "Present",
  parentPhone: "8010861316"
};
const res = resolveWebhookUrlForStudentTest(testUrl, student, { schoolName: "SmartClass Academy" });
console.log("Resolved URL:\n", res.resolvedUrl);
console.log("\nRaw message:\n", res.rawMessage);
console.log("\nEncoded message with literal commas:\n", res.encodedCommaDelimited);
console.log("\nSplit count:", res.encodedCommaDelimited.split(',').length);
