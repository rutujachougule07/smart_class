import React, { useState, useMemo, useDeferredValue, useEffect } from 'react';
import ClassBadge from './ClassBadge';
import { getClassTheme } from '../services/classTheme';
import { isClassMatch } from '../services/classUtils';
import {
  dispatchSmartWebhook,
  getWebhookConfig,
  getActiveWebhookForCategory,
  formatWhatsAppPhone,
  OFFICIAL_EXAM_WEBHOOK_URL
} from '../services/webhookService';

export default function ReportsTab({ state, addNotice, triggerWebhookDispatch, openWebhookSettings }) {
  const [selectedClassId, setSelectedClassId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsPageSize, setReportsPageSize] = useState(50);
  const [selectedStudentForModal, setSelectedStudentForModal] = useState(null);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState('all'); // 'all' or classId
  const [broadcastType, setBroadcastType] = useState('full'); // 'full' | 'attendance' | 'marks'
  const [customRemark, setCustomRemark] = useState('');
  const [isSendingNotice, setIsSendingNotice] = useState(false);
  const [isSendingSingleNotice, setIsSendingSingleNotice] = useState(false);
  const [sentNoticeSuccess, setSentNoticeSuccess] = useState('');

  // State for sending individual student report notice to parent
  const [selectedStudentForSend, setSelectedStudentForSend] = useState(null);
  const [individualNoticeTitle, setIndividualNoticeTitle] = useState('');
  const [individualNoticeContent, setIndividualNoticeContent] = useState('');
  const [isSendingIndividual, setIsSendingIndividual] = useState(false);
  const [individualSendSuccess, setIndividualSendSuccess] = useState('');

  const school = state.schoolProfile || {};
  const todayDate = new Date().toISOString().split('T')[0];

  // Helper to format class name
  const formatClassName = (c) => (!c ? '' : c.section && c.section.trim() ? `${c.name} - ${c.section}` : c.name);

  // Natural sequence sorting for classes
  const sortedClasses = useMemo(() => {
    return [...(state.classes || [])].sort((a, b) => {
      const parseNum = (val) => {
        const match = String(val || '').match(/\d+/);
        return match ? parseInt(match[0], 10) : 999999;
      };
      const numA = parseNum(a.name);
      const numB = parseNum(b.name);
      if (numA !== numB) return numA - numB;

      const nameCmp = String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' });
      if (nameCmp !== 0) return nameCmp;

      return String(a.section || '').localeCompare(String(b.section || ''), undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [state.classes]);

  // Indexed Map for classes by id
  const classesById = useMemo(() => {
    const map = new Map();
    (state.classes || []).forEach((c) => {
      if (c && c.id) map.set(c.id, c);
    });
    return map;
  }, [state.classes]);

  // Aggregated student count per class for O(1) chips and dropdowns
  const studentCountByClassId = useMemo(() => {
    const map = {};
    const students = state.students || [];
    for (let i = 0; i < students.length; i++) {
      const cid = students[i]?.classId;
      if (cid) map[cid] = (map[cid] || 0) + 1;
    }
    return map;
  }, [state.students]);

  // Pre-indexed today's attendance map: key `${studentId}` or `${rollNo}` -> status
  const todayAttendanceMap = useMemo(() => {
    const map = new Map();
    if (!state.attendance || state.attendance.length === 0) return map;

    const latestMap = new Map();
    for (let i = 0; i < state.attendance.length; i++) {
      const a = state.attendance[i];
      if (!a) continue;
      const rawDate = a.date || a.attendanceDate || (typeof a.recordedAt === 'string' ? a.recordedAt.split('T')[0] : a.recordedAt) || '';
      const aDate = String(rawDate).trim().slice(0, 10);
      if (aDate !== todayDate) continue;

      const rawStatus = String(a.status || a.attendanceStatus || '').trim().toLowerCase();
      let status = null;
      if (rawStatus === 'absent') status = 'Absent';
      else if (rawStatus === 'present') status = 'Present';
      if (!status) continue;

      const t = String(a.recordedAt || a.createdAt || a.updatedAt || '');

      const sId = a.studentId || a.student_id;
      if (sId) {
        const existing = latestMap.get(sId);
        if (!existing || t.localeCompare(existing.t) > 0) {
          latestMap.set(sId, { status, t });
        }
      }

      const roll = a.rollNo || a.roll_no;
      if (roll !== undefined && roll !== null && roll !== '') {
        const rollKey = `roll_${roll}`;
        const existing = latestMap.get(rollKey);
        if (!existing || t.localeCompare(existing.t) > 0) {
          latestMap.set(rollKey, { status, t });
        }
      }
    }

    latestMap.forEach((val, key) => {
      map.set(key, val.status);
    });
    return map;
  }, [state.attendance, todayDate]);

  // Pre-indexed marks by student ID, roll number, and student name for O(1) retrieval
  const marksByStudentMap = useMemo(() => {
    const map = new Map();
    (state.marks || []).forEach((m) => {
      if (!m) return;
      const sId = m.studentId || m.student_id;
      if (sId) {
        if (!map.has(sId)) map.set(sId, []);
        map.get(sId).push(m);
      }
      const rNo = m.rollNo || m.roll_no;
      if (rNo !== undefined && rNo !== null && rNo !== '') {
        const rKey = `roll_${rNo}`;
        if (!map.has(rKey)) map.set(rKey, []);
        map.get(rKey).push(m);
      }
      if (m.studentName) {
        const nameKey = `name_${String(m.studentName).trim().toLowerCase()}`;
        if (!map.has(nameKey)) map.set(nameKey, []);
        map.get(nameKey).push(m);
      }
    });
    return map;
  }, [state.marks]);

  // Pre-indexed exams by classId
  const examsByClassMap = useMemo(() => {
    const map = new Map();
    (state.classes || []).forEach((c) => {
      if (!c || !c.id) return;
      const classExams = (state.exams || []).filter((e) => {
        const cid = e.classId || e.class_id;
        return isClassMatch(cid, c.id, state.classes);
      });
      map.set(c.id, classExams);
    });
    return map;
  }, [state.exams, state.classes]);

  // Fast O(1) student marks retriever
  const getMarksForStudent = (student) => {
    if (!student) return [];
    const direct = marksByStudentMap.get(student.id) || [];
    const byRoll = student.rollNo ? (marksByStudentMap.get(`roll_${student.rollNo}`) || []) : [];
    const byName = student.name ? (marksByStudentMap.get(`name_${String(student.name).trim().toLowerCase()}`) || []) : [];

    const seen = new Set();
    const result = [];
    [...direct, ...byRoll, ...byName].forEach((m) => {
      const mid = m.id || `${m.examId || m.exam_id}_${m.studentId || m.student_id}`;
      if (!seen.has(mid)) {
        seen.add(mid);
        result.push(m);
      }
    });
    return result;
  };

  // Helper to get student's attendance today (O(1) execution)
  const getStudentTodayAttendance = (student) => {
    if (!student) return 'Not Marked';

    const mapStatus = todayAttendanceMap.get(student.id) ||
                     (student.rollNo ? todayAttendanceMap.get(`roll_${student.rollNo}`) : null);
    if (mapStatus) return mapStatus;

    if (student.attendanceDate === todayDate && student.attendanceStatus) {
      const raw = String(student.attendanceStatus).trim().toLowerCase();
      if (raw === 'absent') return 'Absent';
      if (raw === 'present') return 'Present';
      return 'Not Marked';
    }
    return 'Not Marked';
  };

  // Helper to get all curriculum subjects for a student's class
  const getStudentClassSubjects = (student) => {
    const STANDARD_SUBJECTS = [
      'Mathematics',
      'English',
      'Science',
      'Marathi',
      'Hindi',
      'Social Science',
      'Computer'
    ];
    if (!student) return STANDARD_SUBJECTS;
    const cls = classesById.get(student.classId);
    const subs = [...STANDARD_SUBJECTS];

    const normKey = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const addUniqueSubj = (rawName) => {
      const clean = String(rawName || '').trim().replace(/_/g, ' ');
      if (!clean || clean.toLowerCase() === 'general') return;
      const targetNorm = normKey(clean);
      const aliases = {
        socialstudies: 'socialscience',
        socialscience: 'socialscience',
        maths: 'mathematics',
        math: 'mathematics',
        mathematics: 'mathematics'
      };
      const canonical = aliases[targetNorm] || targetNorm;
      const exists = subs.some((existing) => {
        const exNorm = normKey(existing);
        const exCanonical = aliases[exNorm] || exNorm;
        return exCanonical === canonical;
      });
      if (!exists) {
        subs.push(clean);
      }
    };

    // 1. From class curriculum subjects (excluding 'General')
    if (cls && Array.isArray(cls.subjects) && cls.subjects.length > 0) {
      cls.subjects.forEach(addUniqueSubj);
    }

    // 2. From exams belonging to this class (O(1) indexed lookup)
    const classExams = examsByClassMap.get(student.classId) || [];
    classExams.forEach((e) => {
      if (e.subject) addUniqueSubj(e.subject);
      if (Array.isArray(e.subjects)) e.subjects.forEach(addUniqueSubj);
    });

    // 3. From marks records if they contain subject keys (O(1) indexed lookup)
    const studentMarks = getMarksForStudent(student);
    studentMarks.forEach((m) => {
      if (m.marks && typeof m.marks === 'object') {
        Object.keys(m.marks).forEach(addUniqueSubj);
      }
    });

    return subs;
  };

  // Helper to get student's subject-wise marks breakdown
  const getStudentExamMarks = (student) => {
    if (!student) return [];
    const subjects = getStudentClassSubjects(student);
    const studentMarks = getMarksForStudent(student);

    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const aliases = {
      math: ['mathematics', 'maths', 'algebra', 'geometry'],
      maths: ['mathematics', 'math', 'algebra', 'geometry'],
      mathematics: ['maths', 'math', 'algebra', 'geometry'],
      science: ['generalscience', 'sci', 'evs', 'physics', 'chemistry', 'biology'],
      socialstudies: ['socialscience', 'social', 'sst', 'history', 'civics', 'geography'],
      socialscience: ['socialstudies', 'social', 'sst', 'history', 'civics', 'geography'],
      english: ['eng', 'englishgrammar'],
      marathi: ['mar', 'marathigrammar'],
      hindi: ['hin', 'hindigrammar'],
      computer: ['computerscience', 'it', 'ict']
    };

    const classExams = examsByClassMap.get(student.classId) || [];

    return subjects.map((subj, idx) => {
      const targetNorm = norm(subj);
      const targetAliases = aliases[targetNorm] || [];
      let foundScore = null;
      let maxMarks = 100;
      let examTitle = 'Semester Examination';
      let remarks = '';

      // 1. Check if any record has m.marks[subj]
      for (const m of studentMarks) {
        if (m.marks && typeof m.marks === 'object') {
          for (const [key, val] of Object.entries(m.marks)) {
            if (val !== undefined && val !== null && val !== '') {
              const keyNorm = norm(key);
              if (keyNorm === targetNorm || targetAliases.includes(keyNorm)) {
                foundScore = Number(val);
                if (m.examTitle) examTitle = m.examTitle;
                if (m.remarks) remarks = m.remarks;
                break;
              }
            }
          }
          if (foundScore !== null) break;
        }
      }

      // 2. Check if an exam with this subject has a record in studentMarks
      if (foundScore === null) {
        const matchedExam = classExams.find((e) => {
          const examSubjNorm = norm(e.subject);
          return examSubjNorm === targetNorm || targetAliases.includes(examSubjNorm);
        });
        if (matchedExam) {
          maxMarks = Number(matchedExam.maxMarks) || 100;
          examTitle = matchedExam.title || 'Exam';
          const m = studentMarks.find((sm) => sm.examId === matchedExam.id || (sm.id && sm.id.endsWith(`_${matchedExam.id}`)));
          if (m) {
            let score = m.total !== undefined ? m.total : (m.marks ? Object.values(m.marks)[0] : undefined);
            if (score !== undefined && score !== null && score !== '' && !isNaN(Number(score))) {
              foundScore = Number(score);
              if (m.remarks) remarks = m.remarks;
            }
          }
        }
      }

      // 3. Check if any studentMark record has m.subject matching targetNorm
      if (foundScore === null) {
        for (const m of studentMarks) {
          const exam = (state.exams || []).find((e) => e.id === m.examId);
          const mSubj = m.subject || exam?.subject;
          if (mSubj) {
            const mSubjNorm = norm(mSubj);
            if (mSubjNorm === targetNorm || targetAliases.includes(mSubjNorm)) {
              let score = m.total !== undefined ? m.total : (m.marks ? Object.values(m.marks)[0] : undefined);
              if (score !== undefined && score !== null && score !== '' && !isNaN(Number(score))) {
                foundScore = Number(score);
                maxMarks = Number(m.maxTotal || exam?.maxMarks || 100);
                examTitle = m.examTitle || exam?.title || 'Exam';
                if (m.remarks) remarks = m.remarks;
                break;
              }
            }
          }
        }
      }

      // If no score was explicitly recorded for this subject, it remains pending

      const isFilled = foundScore !== null && !isNaN(foundScore);
      const score = isFilled ? foundScore : null;
      const pct = isFilled && maxMarks > 0 ? Math.round((score / maxMarks) * 100) : null;
      let grade = '—';
      if (pct !== null) {
        grade = pct >= 90 ? 'A+' : pct >= 75 ? 'A' : pct >= 60 ? 'B' : pct >= 40 ? 'C' : 'F';
      }

      return {
        subject: subj,
        examTitle,
        maxMarks,
        score,
        percentage: pct,
        grade,
        isFilled,
        remarks
      };
    });
  };

  // Calculate overall performance for a student based on all required subjects
  const getStudentOverallPerformance = (student) => {
    const marksList = getStudentExamMarks(student);
    const filledMarks = marksList.filter((m) => m.isFilled);
    const allFilled = marksList.length > 0 && marksList.every((m) => m.isFilled);

    if (filledMarks.length === 0) {
      return {
        hasMarks: false,
        allFilled: false,
        totalScore: 0,
        totalMax: marksList.reduce((acc, curr) => acc + Number(curr.maxMarks || 100), 0),
        percentage: 0,
        grade: 'N/A',
        count: 0,
        totalSubjects: marksList.length,
        filledSubjectsCount: 0
      };
    }

    const totalScore = filledMarks.reduce((acc, curr) => acc + Number(curr.score || 0), 0);
    const totalMax = marksList.reduce((acc, curr) => acc + Number(curr.maxMarks || 100), 0);
    const percentage = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
    const grade = percentage >= 90 ? 'A+' : percentage >= 75 ? 'A' : percentage >= 60 ? 'B' : percentage >= 40 ? 'C' : 'F';

    return {
      hasMarks: true,
      allFilled,
      totalScore,
      totalMax,
      percentage,
      grade,
      count: filledMarks.length,
      totalSubjects: marksList.length,
      filledSubjectsCount: filledMarks.length
    };
  };

  // Open Send Individual Progress Report Notice Modal
  const handleOpenSendIndividualModal = (student) => {
    if (!student) return;
    const cls = state.classes.find((c) => c.id === student.classId);
    const clsName = formatClassName(cls) || 'Class';
    const attToday = getStudentTodayAttendance(student);
    const attDisplay = attToday === 'Present' ? 'Present Today' : attToday === 'Absent' ? 'Absent Today' : 'Not Marked';
    const overall = getStudentOverallPerformance(student);

    const defaultTitle = `Student Progress Report: ${student.name} (Roll: ${student.rollNo})`;
    let defaultContent = `Dear ${student.parentName || 'Parent / Guardian'},\n\n`;
    defaultContent += `Official Progress Report for ${student.name} (Roll: ${student.rollNo}, ${clsName}):\n`;
    defaultContent += `• Today's Attendance: ${attDisplay}\n`;
    if (overall.hasMarks) {
      defaultContent += `• Total Examination Score: ${overall.totalScore} / ${overall.totalMax} (${overall.percentage}%)\n`;
      defaultContent += `• Cumulative Grade: ${overall.grade}\n`;
      defaultContent += `• Academic Result: ${overall.percentage >= 40 ? 'PASSED' : 'REMEDIAL'}\n`;
    }
    defaultContent += `\nPlease review this progress report in your SmartClass Mobile App.\n\n`;
    defaultContent += `Regards,\n${school.adminName || 'Principal Administrator'}\n${school.schoolName || 'SmartClass Academy'}`;

    setSelectedStudentForSend(student);
    setIndividualNoticeTitle(defaultTitle);
    setIndividualNoticeContent(defaultContent);
    setIndividualSendSuccess('');
  };

  // Confirm and Send Individual Notice to Parent
  const handleConfirmSendIndividual = async () => {
    if (!selectedStudentForSend) return;
    if (!individualNoticeTitle.trim() || !individualNoticeContent.trim()) {
      alert('Please provide Notice Title and Content.');
      return;
    }

    const s = selectedStudentForSend;
    const cls = state.classes.find((c) => c.id === s.classId);
    const clsName = formatClassName(cls) || 'Class';
    const cleanPhone = (s.parentPhone || '').replace(/\s+/g, '');
    const attToday = getStudentTodayAttendance(s);
    const overall = getStudentOverallPerformance(s);

    setIsSendingIndividual(true);
    try {
      if (addNotice) {
        await addNotice({
          title: individualNoticeTitle.trim(),
          content: individualNoticeContent.trim(),
          targetRole: 'Selected Parent',
          parentId: cleanPhone || `${s.id}_parent`,
          parentName: s.parentName || 'Parent / Guardian',
          parentPhone: cleanPhone,
          studentId: s.id,
          studentName: s.name,
          rollNo: s.rollNo || '',
          classId: s.classId || null,
          className: clsName,
          attendance: attToday || 'Not Marked',
          totalScore: overall.hasMarks ? overall.totalScore : null,
          totalMax: overall.hasMarks ? overall.totalMax : null,
          percentage: overall.hasMarks ? overall.percentage : null,
          grade: overall.hasMarks ? overall.grade : null,
          academicResult: overall.hasMarks ? (overall.percentage >= 40 ? 'PASSED' : 'REMEDIAL') : 'PENDING',
          schoolAuthority: `${school.adminName || 'Principal Administrator'}, ${school.schoolName || 'SmartClass Academy'}`,
          type: 'report',
          isAlert: true
        });
      }
      // Dispatch to Exam Webhook (1automations)
      let webhookSent = false;
      try {
        const examWh = getActiveWebhookForCategory('exam');
        const cfg = await getWebhookConfig();
        const examUrl = examWh?.url || cfg?.examReportsUrl || OFFICIAL_EXAM_WEBHOOK_URL;
        if (examUrl && examUrl.trim() && cleanPhone) {
          await dispatchSmartWebhook({
            targetUrl: examUrl.trim(),
            secretToken: examWh?.secretToken || cfg?.secretToken || '',
            scope: 'single',
            student: {
              ...s,
              className: clsName,
              division: cls?.section || '-',
              totalMarks: overall.hasMarks ? overall.totalMax : 100,
              marksObtained: overall.hasMarks ? overall.totalScore : 0,
              percentage: overall.hasMarks ? overall.percentage : 0,
              grade: overall.hasMarks ? overall.grade : 'Passed',
              resultStatus: overall.hasMarks ? (overall.percentage >= 40 ? 'PASSED' : 'REMEDIAL') : 'PASSED',
              examTitle: individualNoticeTitle.trim() || 'Academic Progress Report',
              date: todayDate
            },
            schoolProfile: state.schoolProfile || {},
            date: todayDate,
            eventType: 'exam_reports'
          });
          webhookSent = true;
        }
      } catch (wErr) {
        console.warn('Exam webhook dispatch note:', wErr);
      }

      setIndividualSendSuccess(
        webhookSent
          ? `Progress Report sent to ${s.name}'s parent on WhatsApp and logged in App!`
          : `Progress Report Alert successfully sent to ${s.parentName || 'Parent'} in SmartClass App!`
      );
      setTimeout(() => {
        setSelectedStudentForSend(null);
        setIndividualSendSuccess('');
      }, 2500);
    } catch (e) {
      console.error(e);
      alert('Failed to send notice: ' + e.message);
    } finally {
      setIsSendingIndividual(false);
    }
  };

  // Handle opening send notice modal from Report Card modal
  const handleSendAppNotice = (student) => {
    if (!student) return;
    handleOpenSendIndividualModal(student);
  };

  // Exam Reports Webhook Handlers
  const handleOpenExamWebhookBulk = () => {
    if (!triggerWebhookDispatch) return;
    const targetStudents = (filteredStudents || []).map((s) => {
      const cls = state.classes.find((c) => c.id === s.classId);
      const overall = getStudentOverallPerformance(s);
      const marksList = getStudentExamMarks(s);
      return {
        ...s,
        className: formatClassName(cls) || 'Class',
        division: cls?.section || '-',
        attendanceToday: getStudentTodayAttendance(s),
        performance: overall,
        totalScore: overall.totalScore,
        totalMax: overall.totalMax,
        percentage: overall.percentage,
        grade: overall.grade,
        subjectMarks: marksList.map((m) => ({
          subject: m.subject,
          score: m.score,
          maxMarks: m.maxMarks,
          grade: m.grade,
          remarks: m.remarks
        }))
      };
    });

    const cls = selectedClassId !== 'all' ? state.classes.find((c) => c.id === selectedClassId) : null;

    triggerWebhookDispatch({
      type: 'exam',
      scope: 'bulk',
      students: targetStudents,
      classInfo: cls ? { id: cls.id, name: formatClassName(cls), section: cls.section } : { id: 'all', name: 'All Classes' },
      schoolProfile: state.schoolProfile || {},
      examInfo: { title: 'Semester Academic Progress Report' }
    });
  };

  const handleOpenExamWebhookSingle = (s) => {
    if (!triggerWebhookDispatch || !s) return;
    const cls = state.classes.find((c) => c.id === s.classId);
    const overall = getStudentOverallPerformance(s);
    const marksList = getStudentExamMarks(s);

    const enrichedStudent = {
      ...s,
      className: formatClassName(cls) || 'Class',
      division: cls?.section || '-',
      attendanceToday: getStudentTodayAttendance(s),
      performance: overall,
      totalScore: overall.totalScore,
      totalMax: overall.totalMax,
      percentage: overall.percentage,
      grade: overall.grade,
      subjectMarks: marksList.map((m) => ({
        subject: m.subject,
        score: m.score,
        maxMarks: m.maxMarks,
        grade: m.grade,
        remarks: m.remarks
      }))
    };

    triggerWebhookDispatch({
      type: 'exam',
      scope: 'single',
      student: enrichedStudent,
      classInfo: cls ? { id: cls.id, name: formatClassName(cls), section: cls.section } : { id: s.classId, name: 'Class' },
      schoolProfile: state.schoolProfile || {},
      examInfo: { title: `Academic Progress Report: ${s.name}` }
    });
  };

  // Send Bulk Broadcast to Parents (either all classes or selected class)
  const handleSendBulkNotice = async () => {
    const targetStudents = broadcastTarget === 'all'
      ? state.students
      : state.students.filter((s) => s.classId === broadcastTarget);

    if (targetStudents.length === 0) {
      alert('No students found in the selected target group!');
      return;
    }

    setIsSendingNotice(true);
    setSentNoticeSuccess('');

    try {
      let sentCount = 0;
      for (const student of targetStudents) {
        const cls = state.classes.find((c) => c.id === student.classId);
        const clsName = formatClassName(cls) || 'Class';
        const attToday = getStudentTodayAttendance(student);
        const overall = getStudentOverallPerformance(student);

        const title = `Official Student Report Card: ${student.name} (${clsName})`;
        let content = `Dear ${student.parentName || 'Parent'},\n`;
        content += `Progress Report for ${student.name} (Roll: ${student.rollNo}):\n`;
        content += `• Today's Attendance: ${attToday}\n`;
        if (overall.hasMarks) {
          content += `• Overall Examination Score: ${overall.totalScore}/${overall.totalMax} (${overall.percentage}%)\n`;
          content += `• Overall Grade: ${overall.grade}\n`;
        }
        if (customRemark.trim()) {
          content += `• Note: ${customRemark.trim()}\n`;
        }
        content += `\nSent by ${school.schoolName || 'SmartClass Academy'}.`;

        const cleanPhone = (student.parentPhone || '').replace(/\s+/g, '');
        if (addNotice) {
          await addNotice({
            title,
            content,
            targetRole: 'Selected Parent',
            parentId: cleanPhone || `${student.id}_parent`,
            studentId: student.id,
            studentName: student.name,
            rollNo: student.rollNo || '',
            parentPhone: cleanPhone,
            parentName: student.parentName || 'Parent / Guardian',
            classId: student.classId,
            className: clsName,
            attendance: attToday || 'Not Marked',
            totalScore: overall.hasMarks ? overall.totalScore : null,
            totalMax: overall.hasMarks ? overall.totalMax : null,
            percentage: overall.hasMarks ? overall.percentage : null,
            grade: overall.hasMarks ? overall.grade : null,
            academicResult: overall.hasMarks ? (overall.percentage >= 40 ? 'PASSED' : 'REMEDIAL') : 'PENDING',
            schoolAuthority: `${school.adminName || 'Principal Administrator'}, ${school.schoolName || 'SmartClass Academy'}`,
            type: 'report',
            isAlert: true
          });
        }
        sentCount++;
      }

      // Dispatch bulk to Exam Webhook (1automations)
      let webhookSentCount = 0;
      try {
        const examWh = getActiveWebhookForCategory('exam');
        const cfg = await getWebhookConfig();
        const examUrl = examWh?.url || cfg?.examReportsUrl || OFFICIAL_EXAM_WEBHOOK_URL;
        if (examUrl && examUrl.trim()) {
          const enrichedTargets = targetStudents.map((student) => {
            const cls = state.classes.find((c) => c.id === student.classId);
            const overall = getStudentOverallPerformance(student);
            return {
              ...student,
              className: formatClassName(cls) || 'Class',
              division: cls?.section || '-',
              totalMarks: overall.hasMarks ? overall.totalMax : 100,
              marksObtained: overall.hasMarks ? overall.totalScore : 0,
              percentage: overall.hasMarks ? overall.percentage : 0,
              grade: overall.hasMarks ? overall.grade : 'Passed',
              resultStatus: overall.hasMarks ? (overall.percentage >= 40 ? 'PASSED' : 'REMEDIAL') : 'PASSED',
              examTitle: customRemark.trim() || 'Academic Progress Report',
              date: todayDate
            };
          });
          const whRes = await dispatchSmartWebhook({
            targetUrl: examUrl.trim(),
            secretToken: examWh?.secretToken || cfg?.secretToken || '',
            scope: 'bulk',
            students: enrichedTargets,
            schoolProfile: state.schoolProfile || {},
            date: todayDate,
            eventType: 'exam_reports'
          });
          webhookSentCount = whRes.sentCount || 0;
        }
      } catch (wErr) {
        console.warn('Bulk exam webhook dispatch note:', wErr);
      }

      const whNotice = webhookSentCount > 0 ? ` (${webhookSentCount} delivered via WhatsApp)` : '';
      setSentNoticeSuccess(`Successfully delivered ${sentCount} personalized progress report alerts${whNotice}!`);
      setTimeout(() => {
        setIsBroadcastModalOpen(false);
        setSentNoticeSuccess('');
        setCustomRemark('');
      }, 2500);
    } catch (err) {
      console.error('Bulk notice error:', err);
      alert('Error delivering bulk notices: ' + err.message);
    } finally {
      setIsSendingNotice(false);
    }
  };

  // Filter students by selected class and search, sorted serial-wise by roll number
  const filteredStudents = useMemo(() => {
    let list = state.students || [];
    if (selectedClassId !== 'all') {
      list = list.filter((s) => isClassMatch(s.classId, selectedClassId, state.classes));
    }
    const q = (deferredSearchQuery || '').trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          (s.name || '').toLowerCase().includes(q) ||
          String(s.rollNo || '').toLowerCase().includes(q) ||
          (s.parentName && String(s.parentName).toLowerCase().includes(q)) ||
          (s.parentPhone && String(s.parentPhone).includes(q))
      );
    }
    const parseRollNo = (roll) => {
      if (roll === undefined || roll === null || roll === '') return 999999;
      const num = Number(roll);
      if (!isNaN(num)) return num;
      const match = String(roll).match(/\d+/);
      return match ? parseInt(match[0], 10) : 999999;
    };
    return [...list].sort((a, b) => {
      const rollA = parseRollNo(a.rollNo);
      const rollB = parseRollNo(b.rollNo);
      if (rollA !== rollB) return rollA - rollB;
      return (
        String(a.rollNo || '').localeCompare(String(b.rollNo || ''), undefined, { numeric: true, sensitivity: 'base' }) ||
        (a.name || '').localeCompare(b.name || '')
      );
    });
  }, [state.students, selectedClassId, deferredSearchQuery, state.classes]);

  // Reset page when class or search changes
  useEffect(() => {
    setReportsPage(1);
  }, [selectedClassId, deferredSearchQuery]);

  const totalReportsPages = reportsPageSize === 'all' ? 1 : Math.ceil(filteredStudents.length / (typeof reportsPageSize === 'number' ? reportsPageSize : 50));
  const pagedStudents = useMemo(() => {
    if (reportsPageSize === 'all') return filteredStudents;
    const size = typeof reportsPageSize === 'number' ? reportsPageSize : 50;
    const start = (reportsPage - 1) * size;
    return filteredStudents.slice(start, start + size);
  }, [filteredStudents, reportsPage, reportsPageSize]);

  // Overall class stats
  const classStats = useMemo(() => {
    const total = filteredStudents.length;
    let presentCount = 0;
    let absentCount = 0;
    let totalMarksPctSum = 0;
    let studentsWithMarksCount = 0;

    filteredStudents.forEach((s) => {
      const st = getStudentTodayAttendance(s);
      if (st === 'Present') presentCount++;
      else if (st === 'Absent') absentCount++;

      const perf = getStudentOverallPerformance(s);
      if (perf.hasMarks) {
        totalMarksPctSum += perf.percentage;
        studentsWithMarksCount++;
      }
    });

    const markedCount = presentCount + absentCount;
    const avgScore = studentsWithMarksCount > 0 ? Math.round(totalMarksPctSum / studentsWithMarksCount) : 0;
    const attRate = markedCount > 0 ? Math.round((presentCount / markedCount) * 100) : 0;

    return { total, presentCount, absentCount, markedCount, attRate, avgScore, studentsWithMarksCount };
  }, [filteredStudents, state.attendance, state.marks]);

  // Modal: Send Individual Progress Report Notice to Parent
  const renderSendIndividualNoticeModal = () => {
    if (!selectedStudentForSend) return null;
    return (
      <div className="modal-overlay" style={{ zIndex: 1250 }}>
        <div
          className="modal-box"
          style={{
            maxWidth: '560px',
            width: '95vw',
            padding: '26px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}
        >
          {/* Modal Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '14px',
              marginBottom: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: '#eff6ff',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px'
                }}
              >
                <i className="fa-solid fa-paper-plane"></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                  Send Progress Report to Parent
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#64748b' }}>
                  Direct notification for {selectedStudentForSend.name}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedStudentForSend(null)}
              disabled={isSendingIndividual}
              style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          {/* Recipient Student & Parent Summary Banner */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '16px',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px 14px',
              fontSize: '12px'
            }}
          >
            <div>
              <span style={{ color: '#64748b' }}>Student Name:</span>{' '}
              <strong style={{ color: '#0f172a' }}>
                {selectedStudentForSend.name} (Roll: {selectedStudentForSend.rollNo})
              </strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Class:</span>{' '}
              <strong style={{ color: '#0f172a' }}>
                {formatClassName(state.classes.find((c) => c.id === selectedStudentForSend.classId))}
              </strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Parent / Guardian:</span>{' '}
              <strong style={{ color: '#0f172a' }}>
                {selectedStudentForSend.parentName || 'Parent / Guardian'}
              </strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Mobile:</span>{' '}
              <strong style={{ color: '#0f172a' }}>
                {selectedStudentForSend.parentPhone || 'Not Registered'}
              </strong>
            </div>
          </div>

          {/* Notice Title Input */}
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px', display: 'block' }}>
              Notice Title *
            </label>
            <input
              type="text"
              className="form-control"
              value={individualNoticeTitle}
              onChange={(e) => setIndividualNoticeTitle(e.target.value)}
              placeholder="Enter report notice title"
              style={{ fontSize: '13px', padding: '8px 12px' }}
            />
          </div>

          {/* Notice Content Input */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px', display: 'block' }}>
              Report Notice Message (Pre-filled & Fully Editable) *
            </label>
            <textarea
              className="form-control"
              rows={6}
              value={individualNoticeContent}
              onChange={(e) => setIndividualNoticeContent(e.target.value)}
              placeholder="Enter progress report message"
              style={{ fontSize: '12px', lineHeight: '1.45', resize: 'vertical' }}
            />
          </div>

          {/* Success Toast */}
          {individualSendSuccess && (
            <div
              style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#15803d',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: '700',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <i className="fa-solid fa-circle-check"></i>
              {individualSendSuccess}
            </div>
          )}

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSelectedStudentForSend(null)}
              disabled={isSendingIndividual}
              style={{ padding: '8px 16px' }}
            >
              Cancel
            </button>
            {selectedStudentForSend.parentPhone && (
              <a
                href={`https://wa.me/${formatWhatsAppPhone(selectedStudentForSend.parentPhone)}?text=${encodeURIComponent(individualNoticeContent)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#25D366',
                  color: '#ffffff',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: '700',
                  textDecoration: 'none',
                  fontSize: '13px',
                  boxShadow: '0 2px 4px rgba(37, 211, 102, 0.25)'
                }}
                title="1-Click Open Directly in WhatsApp"
              >
                <i className="fa-brands fa-whatsapp" style={{ fontSize: '15px' }}></i> WhatsApp 1-Click
              </a>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmSendIndividual}
              disabled={isSendingIndividual}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 20px',
                fontWeight: '700',
                backgroundColor: 'var(--primary)',
                color: '#ffffff'
              }}
            >
              {isSendingIndividual ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  Sending Notice...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane"></i>
                  Send to Parent Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render Simple & Normal Student Details Page (Clean view requested by user)
  if (selectedStudentForModal) {
    const student = selectedStudentForModal;
    const modalCls = state.classes.find((c) => c.id === student.classId);
    const modalAttToday = getStudentTodayAttendance(student);
    const marksList = getStudentExamMarks(student);
    const perf = getStudentOverallPerformance(student);

    // Calculate student attendance statistics from state.attendance
    const studentAttendanceRecords = (state.attendance || []).filter(
      (a) => a.studentId === student.id || (student.rollNo && a.studentId === student.rollNo)
    );
    const totalDays = studentAttendanceRecords.length;
    const presentDays = studentAttendanceRecords.filter(
      (a) => String(a.status || '').trim().toLowerCase() === 'present'
    ).length;
    const absentDays = totalDays - presentDays;
    const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

    return (
      <div className="student-profile-page" style={{ paddingBottom: '30px' }}>
        <style>{`
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              background: #fff !important;
            }
            .sidebar, .topbar {
              display: none !important;
            }
            .student-profile-page {
              padding: 0 !important;
              margin: 0 !important;
            }
          }
        `}</style>

        {/* Top Navigation & Action Header */}
        <div className="no-print" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
          paddingBottom: '14px',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setSelectedStudentForModal(null)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
            >
              <i className="fa-solid fa-arrow-left"></i>
              Back to Students List
            </button>
            <div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {student.name}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                Roll No: <strong>{student.rollNo || '—'}</strong> • Class: <strong>{formatClassName(modalCls) || 'Class'}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>

            <button
              className="btn btn-primary"
              onClick={() => handleOpenSendIndividualModal(student)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <i className="fa-solid fa-paper-plane"></i>
              Send to Parent
            </button>
          </div>
        </div>

        {/* 1. Student Information Card */}
        <div className="data-card" style={{ marginBottom: '20px', padding: '20px' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-id-card" style={{ color: 'var(--primary)' }}></i>
            Student Information
          </h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            fontSize: '13px'
          }}>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '12px', marginBottom: '2px' }}>Student Name</span>
              <strong style={{ color: '#0f172a' }}>{student.name}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '12px', marginBottom: '2px' }}>Roll Number</span>
              <strong style={{ color: '#0f172a' }}>{student.rollNo || 'N/A'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '12px', marginBottom: '2px' }}>Class & Section</span>
              <strong style={{ color: '#0f172a' }}>{formatClassName(modalCls) || 'Class'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '12px', marginBottom: '2px' }}>Student ID</span>
              <code style={{ fontSize: '12px', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                {student.id}
              </code>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '12px', marginBottom: '2px' }}>Parent / Guardian</span>
              <strong style={{ color: '#0f172a' }}>{student.parentName || 'Parent'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '12px', marginBottom: '2px' }}>Parent Mobile</span>
              <strong style={{ color: '#0f172a' }}>{student.parentPhone || '—'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '12px', marginBottom: '2px' }}>Today's Attendance</span>
              <span style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '11.5px',
                fontWeight: 700,
                backgroundColor: modalAttToday === 'Present' ? '#dcfce7' : modalAttToday === 'Absent' ? '#fee2e2' : '#f1f5f9',
                color: modalAttToday === 'Present' ? '#166534' : modalAttToday === 'Absent' ? '#991b1b' : '#475569',
                border: `1px solid ${modalAttToday === 'Present' ? '#bbf7d0' : modalAttToday === 'Absent' ? '#fecaca' : '#cbd5e1'}`
              }}>
                {modalAttToday === 'Present' ? 'Present Today' : modalAttToday === 'Absent' ? 'Absent Today' : 'Not Marked'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Simple Performance Overview Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
          marginBottom: '20px'
        }}>
          <div className="stat-card" style={{ padding: '14px 18px' }}>
            <div className="stat-info">
              <h5 style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Score</h5>
              <h2 style={{ fontSize: '22px', margin: '4px 0', color: 'var(--text-primary)' }}>
                {perf.hasMarks ? `${perf.totalScore} / ${perf.totalMax}` : '0'}
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
                {perf.hasMarks ? `${perf.filledSubjectsCount} of ${perf.totalSubjects} subjects evaluated` : 'No marks entered'}
              </p>
            </div>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)', width: '38px', height: '38px', fontSize: '15px' }}>
              <i className="fa-solid fa-award"></i>
            </div>
          </div>

          <div className="stat-card" style={{ padding: '14px 18px' }}>
            <div className="stat-info">
              <h5 style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Percentage</h5>
              <h2 style={{ fontSize: '22px', margin: '4px 0', color: 'var(--text-primary)' }}>
                {perf.hasMarks ? `${perf.percentage}%` : '—'}
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--teal)', fontWeight: 600 }}>Academic Aggregate</p>
            </div>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(13, 148, 136, 0.1)', color: 'var(--teal)', width: '38px', height: '38px', fontSize: '15px' }}>
              <i className="fa-solid fa-percent"></i>
            </div>
          </div>

          <div className="stat-card" style={{ padding: '14px 18px' }}>
            <div className="stat-info">
              <h5 style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Grade</h5>
              <h2 style={{ fontSize: '22px', margin: '4px 0', color: 'var(--text-primary)' }}>
                {perf.hasMarks ? perf.grade : '—'}
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--purple)', fontWeight: 600 }}>Performance Grade</p>
            </div>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'var(--purple)', width: '38px', height: '38px', fontSize: '15px' }}>
              <i className="fa-solid fa-graduation-cap"></i>
            </div>
          </div>

          <div className="stat-card" style={{ padding: '14px 18px' }}>
            <div className="stat-info">
              <h5 style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Attendance Rate</h5>
              <h2 style={{ fontSize: '22px', margin: '4px 0', color: 'var(--text-primary)' }}>
                {attendanceRate}%
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--amber)', fontWeight: 600 }}>
                {presentDays} present / {totalDays} days
              </p>
            </div>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--amber)', width: '38px', height: '38px', fontSize: '15px' }}>
              <i className="fa-solid fa-calendar-check"></i>
            </div>
          </div>
        </div>

        {/* 3. Subjects & Marks Table */}
        <div className="data-table-container" style={{ marginBottom: '20px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
              <i className="fa-solid fa-book-open" style={{ color: 'var(--teal)', marginRight: '8px' }}></i>
              Academic Subject Evaluation
            </h4>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {marksList.filter(m => m.isFilled).length} of {marksList.length} subjects evaluated
            </span>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>#</th>
                <th>Subject</th>
                <th>Examination</th>
                <th style={{ textAlign: 'center' }}>Max Marks</th>
                <th style={{ textAlign: 'center' }}>Marks Obtained</th>
                <th style={{ textAlign: 'center' }}>%</th>
                <th style={{ textAlign: 'center' }}>Grade</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {marksList.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    No subjects found for this class curriculum.
                  </td>
                </tr>
              ) : (
                marksList.map((m, idx) => (
                  <tr key={m.subject}>
                    <td style={{ color: '#94a3b8', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{m.subject}</td>
                    <td style={{ color: '#64748b' }}>{m.examTitle || 'General Examination'}</td>
                    <td style={{ textAlign: 'center', color: '#64748b' }}>{m.maxMarks}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: m.isFilled ? '#0f172a' : '#94a3b8' }}>
                      {m.isFilled ? m.score : '—'}
                    </td>
                    <td style={{ textAlign: 'center', color: m.percentage !== null ? '#0f172a' : '#94a3b8' }}>
                      {m.percentage !== null ? `${m.percentage}%` : '—'}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: m.isFilled ? 'var(--primary)' : '#94a3b8' }}>
                      {m.grade}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: m.isFilled ? '#dcfce7' : '#f1f5f9',
                        color: m.isFilled ? '#166534' : '#94a3b8'
                      }}>
                        {m.isFilled ? 'Evaluated' : 'Not Entered'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Back Button */}
        <div className="no-print">
          <button
            className="btn btn-secondary"
            onClick={() => setSelectedStudentForModal(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
          >
            <i className="fa-solid fa-arrow-left"></i>
            Back to Students List
          </button>
        </div>

        {/* Modal: Send Individual Notice to Parent */}
        {renderSendIndividualNoticeModal()}
      </div>
    );
  }

  return (
    <div>
      {/* 1. Header & Summary Stats */}
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span style={{ fontSize: '18px', fontWeight: '800' }}>
            <i className="fa-solid fa-file-invoice" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>
            Student Progress & Performance Reports
          </span>
          <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            Send personalized student report cards & attendance updates to parents individually via WhatsApp or broadcast to all.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>


          <button
            className="btn btn-primary"
            onClick={() => {
              setBroadcastTarget(selectedClassId);
              setIsBroadcastModalOpen(true);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 18px', fontWeight: '700', borderRadius: '10px' }}
          >
            <i className="fa-solid fa-paper-plane"></i>
            Broadcast Report to All Parents
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div className="stat-card" style={{ padding: '16px 20px' }}>
          <div className="stat-info">
            <h5 style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Enrolled Students</h5>
            <h2 style={{ fontSize: '24px', margin: '4px 0' }}>{classStats.total}</h2>
            <p style={{ fontSize: '11px', color: 'var(--primary)' }}>
              {selectedClassId === 'all' ? 'All Classes' : formatClassName(state.classes.find(c => c.id === selectedClassId))}
            </p>
          </div>
          <div className="stat-icon-wrapper" style={{ background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)' }}>
            <i className="fa-solid fa-users"></i>
          </div>
        </div>

        <div className="stat-card" style={{ padding: '16px 20px' }}>
          <div className="stat-info">
            <h5 style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Today's Attendance</h5>
            <h2 style={{ fontSize: '24px', margin: '4px 0', color: classStats.markedCount > 0 ? '#15803d' : '#64748b' }}>
              {classStats.markedCount > 0 ? `${classStats.attRate}%` : 'Not Marked'}
            </h2>
            <p style={{ fontSize: '11px', color: classStats.markedCount > 0 ? '#166534' : '#64748b' }}>
              {classStats.markedCount > 0 ? `${classStats.presentCount} of ${classStats.markedCount} Present` : 'Not Taken Today'}
            </p>
          </div>
          <div className="stat-icon-wrapper" style={{ background: classStats.markedCount > 0 ? 'rgba(22, 163, 74, 0.1)' : 'rgba(100, 116, 139, 0.1)', color: classStats.markedCount > 0 ? '#16a34a' : '#64748b' }}>
            <i className={`fa-solid ${classStats.markedCount > 0 ? 'fa-clipboard-check' : 'fa-clock'}`}></i>
          </div>
        </div>

        <div className="stat-card" style={{ padding: '16px 20px' }}>
          <div className="stat-info">
            <h5 style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Class Average Score</h5>
            <h2 style={{ fontSize: '24px', margin: '4px 0', color: '#8b5cf6' }}>
              {classStats.studentsWithMarksCount > 0 ? `${classStats.avgScore}%` : 'N/A'}
            </h2>
            <p style={{ fontSize: '11px', color: '#6d28d9' }}>Based on recorded exams</p>
          </div>
          <div className="stat-icon-wrapper" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
            <i className="fa-solid fa-chart-pie"></i>
          </div>
        </div>

        <div className="stat-card" style={{ padding: '16px 20px' }}>
          <div className="stat-info">
            <h5 style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Reports Status</h5>
            <h2 style={{ fontSize: '24px', margin: '4px 0', color: '#0284c7' }}>100% Ready</h2>
            <p style={{ fontSize: '11px', color: '#0369a1' }}>Generated & Synchronized</p>
          </div>
          <div className="stat-icon-wrapper" style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7' }}>
            <i className="fa-solid fa-file-lines"></i>
          </div>
        </div>
      </div>

      {/* 3. Class Wise Selection Chips & Search Filter Bar */}
      <div className="filter-header" style={{ marginBottom: '18px' }}>
        <div className="chips-row" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', alignItems: 'center' }}>
          <button
            type="button"
            className={`chip ${selectedClassId === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedClassId('all')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 14px',
              borderRadius: '12px',
              fontSize: '12.5px',
              fontWeight: selectedClassId === 'all' ? 700 : 600,
              cursor: 'pointer',
              border: selectedClassId === 'all' ? '1.5px solid #2563eb' : '1.5px solid #e2e8f0',
              background: selectedClassId === 'all' ? '#eff6ff' : '#ffffff',
              color: selectedClassId === 'all' ? '#1e3a8a' : '#334155',
              boxShadow: selectedClassId === 'all' ? '0 4px 12px -2px rgba(37, 99, 235, 0.2)' : '0 1px 2px rgba(0, 0, 0, 0.03)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <span
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '7px',
                background: selectedClassId === 'all' ? '#dbeafe' : '#f1f5f9',
                color: selectedClassId === 'all' ? '#1d4ed8' : '#64748b',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px'
              }}
            >
              <i className="fa-solid fa-school"></i>
            </span>
            <span style={{ color: selectedClassId === 'all' ? '#1e3a8a' : '#334155', fontWeight: selectedClassId === 'all' ? 800 : 600 }}>All Classes</span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 700,
                background: selectedClassId === 'all' ? '#2563eb' : '#f1f5f9',
                color: selectedClassId === 'all' ? '#ffffff' : '#64748b'
              }}
            >
              {state.students.length}
            </span>
          </button>

          {sortedClasses.map((c) => {
            const count = studentCountByClassId[c.id] || 0;
            const isAct = selectedClassId === c.id;
            const theme = getClassTheme(c);
            return (
              <button
                key={c.id}
                type="button"
                className={`chip ${isAct ? 'active' : ''}`}
                onClick={() => setSelectedClassId(c.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 14px',
                  borderRadius: '12px',
                  fontSize: '12.5px',
                  fontWeight: isAct ? 700 : 600,
                  cursor: 'pointer',
                  border: isAct ? `1.5px solid ${theme.accent}` : '1.5px solid #e2e8f0',
                  background: isAct ? theme.softBg : '#ffffff',
                  color: isAct ? theme.color : '#475569',
                  boxShadow: isAct ? `0 4px 12px -2px ${theme.accent}30` : '0 1px 2px rgba(0, 0, 0, 0.03)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <span
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '7px',
                    background: isAct ? theme.gradient : theme.softBg,
                    color: isAct ? '#ffffff' : theme.color,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px'
                  }}
                >
                  <i className={`fa-solid ${theme.icon}`}></i>
                </span>
                <span style={{ color: isAct ? theme.color : '#334155', fontWeight: isAct ? 800 : 600 }}>{formatClassName(c)}</span>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: isAct ? theme.accent : '#f1f5f9',
                    color: isAct ? '#ffffff' : '#64748b'
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="search-input-box" style={{ width: '280px' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--text-muted)' }}></i>
            <input
              type="text"
              placeholder="Search student, roll, parent..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {selectedClassId !== 'all' && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setBroadcastTarget(selectedClassId);
                setIsBroadcastModalOpen(true);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
              title="Send report to all parents of this class"
            >
              <i className="fa-solid fa-paper-plane" style={{ color: 'var(--primary)' }}></i>
              Send All {formatClassName(state.classes.find(c => c.id === selectedClassId))} Reports
            </button>
          )}
        </div>
      </div>

      {/* 4. Student Reports Table */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '70px' }}>Roll No</th>
              <th>Student & Class Details</th>
              <th>Parent / Guardian Contact</th>
              <th style={{ textAlign: 'center', width: '130px' }}>Today's Attendance</th>
              <th style={{ width: '160px' }}>Academic Performance</th>
              <th style={{ textAlign: 'center', width: '220px' }}>Report Card & Dispatch</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-folder-open" style={{ fontSize: '32px', marginBottom: '10px', display: 'block', color: '#cbd5e1' }}></i>
                  No students found in this class view.
                </td>
              </tr>
            ) : (
              pagedStudents.map((s) => {
                const cls = classesById.get(s.classId);
                const attToday = getStudentTodayAttendance(s);
                const isPresent = attToday === 'Present';
                const isAbsent = attToday === 'Absent';
                const perf = getStudentOverallPerformance(s);
                const phone = s.parentPhone || '';

                return (
                  <tr key={s.id}>
                    <td>
                      <div className="roll-badge">{s.rollNo}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>{s.name}</div>
                      <div style={{ marginTop: '3px' }}>
                        <ClassBadge classItem={cls} label={formatClassName(cls) || 'Unassigned'} size="sm" />
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: '600', fontSize: '12.5px', color: '#334155' }}>
                        {s.parentName || 'Parent / Guardian'}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                        <i className="fa-solid fa-phone" style={{ fontSize: '10px' }}></i>
                        <span>{phone || 'No phone registered'}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '700',
                          backgroundColor: isPresent ? '#dcfce7' : isAbsent ? '#fee2e2' : '#f1f5f9',
                          color: isPresent ? '#15803d' : isAbsent ? '#b91c1c' : '#64748b',
                          border: `1px solid ${isPresent ? '#bbf7d0' : isAbsent ? '#fecaca' : '#cbd5e1'}`
                        }}
                      >
                        <i className={`fa-solid ${isPresent ? 'fa-circle-check' : isAbsent ? 'fa-circle-xmark' : 'fa-clock'}`}></i>
                        {isPresent ? 'Present Today' : isAbsent ? 'Absent Today' : 'Not Marked'}
                      </span>
                    </td>
                    <td>
                      {perf.hasMarks ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b' }}>{perf.percentage}%</span>
                            <span
                              style={{
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: '800',
                                backgroundColor: perf.percentage >= 75 ? '#e0e7ff' : perf.percentage >= 50 ? '#fef3c7' : '#fee2e2',
                                color: perf.percentage >= 75 ? '#3730a3' : perf.percentage >= 50 ? '#92400e' : '#991b1b'
                              }}
                            >
                              Grade {perf.grade}
                            </span>
                          </div>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                            Score: {perf.totalScore}/{perf.totalMax} ({perf.count} exams)
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '11.5px', color: '#94a3b8', fontStyle: 'italic' }}>
                          No exams recorded yet
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedStudentForModal(s)}
                          style={{
                            backgroundColor: '#f8fafc',
                            color: '#1e293b',
                            border: '1px solid #cbd5e1',
                            padding: '6px 11px',
                            borderRadius: '8px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            transition: 'all 0.15s ease'
                          }}
                          title="View Student Details"
                        >
                          <i className="fa-solid fa-file-invoice" style={{ color: 'var(--primary)' }}></i>
                          View
                        </button>



                        <button
                          type="button"
                          onClick={() => handleOpenSendIndividualModal(s)}
                          style={{
                            backgroundColor: '#eff6ff',
                            color: 'var(--primary)',
                            border: '1px solid #bfdbfe',
                            padding: '6px 11px',
                            borderRadius: '8px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            transition: 'all 0.15s ease'
                          }}
                          title={`Send Progress Report notice directly to ${s.parentName || 'Parent'}`}
                        >
                          <i className="fa-solid fa-paper-plane"></i>
                          Send to Parent
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {filteredStudents.length > 50 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 18px',
              backgroundColor: '#ffffff',
              borderTop: '1px solid #e2e8f0',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
              Showing <strong style={{ color: '#0f172a' }}>{reportsPageSize === 'all' ? 1 : ((reportsPage - 1) * reportsPageSize + 1)}</strong> to{' '}
              <strong style={{ color: '#0f172a' }}>
                {reportsPageSize === 'all' ? filteredStudents.length : Math.min(reportsPage * reportsPageSize, filteredStudents.length)}
              </strong>{' '}
              of <strong style={{ color: '#0f172a' }}>{filteredStudents.length}</strong> students
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 600 }}>Rows:</span>
                <select
                  value={reportsPageSize}
                  onChange={(e) => {
                    const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                    setReportsPageSize(val);
                    setReportsPage(1);
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: '#334155',
                    background: '#f8fafc',
                    cursor: 'pointer'
                  }}
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value="all">All ({filteredStudents.length})</option>
                </select>
              </div>
              {reportsPageSize !== 'all' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    disabled={reportsPage <= 1}
                    onClick={() => setReportsPage((p) => Math.max(1, p - 1))}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: reportsPage <= 1 ? '#f8fafc' : '#ffffff',
                      color: reportsPage <= 1 ? '#94a3b8' : '#334155',
                      cursor: reportsPage <= 1 ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      fontSize: '12px'
                    }}
                  >
                    Previous
                  </button>
                  <span style={{ fontSize: '12.5px', color: '#475569', fontWeight: 600, minWidth: '85px', textAlign: 'center' }}>
                    Page {reportsPage} of {totalReportsPages || 1}
                  </span>
                  <button
                    type="button"
                    disabled={reportsPage >= totalReportsPages}
                    onClick={() => setReportsPage((p) => Math.min(totalReportsPages, p + 1))}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: reportsPage >= totalReportsPages ? '#f8fafc' : '#ffffff',
                      color: reportsPage >= totalReportsPages ? '#94a3b8' : '#334155',
                      cursor: reportsPage >= totalReportsPages ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      fontSize: '12px'
                    }}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 2: BROADCAST PROGRESS REPORT TO ALL PARENTS */}
      {/* ========================================================================= */}
      {isBroadcastModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div
            className="modal-box"
            style={{
              maxWidth: '560px',
              width: '95vw',
              padding: '26px',
              backgroundColor: '#ffffff',
              borderRadius: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px'
                  }}
                >
                  <i className="fa-solid fa-paper-plane"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                    Broadcast Progress Report to Parents
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#64748b' }}>
                    Send automated personalized reports directly to parents in bulk
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBroadcastModalOpen(false)}
                disabled={isSendingNotice}
                style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Target Selection */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px', display: 'block' }}>
                Select Target Parents Group:
              </label>
              <select
                className="form-control"
                value={broadcastTarget}
                onChange={(e) => setBroadcastTarget(e.target.value)}
                style={{ fontSize: '13px', padding: '8px 12px' }}
              >
                <option value="all">🌐 All Parents (Entire School - {state.students.length} Students)</option>
                {state.classes.map((c) => {
                  const cnt = studentCountByClassId[c.id] || 0;
                  return (
                    <option key={c.id} value={c.id}>
                      {formatClassName(c)} ({cnt} Students)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Optional Principal Note */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px', display: 'block' }}>
                Optional Message / Remarks from School:
              </label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="e.g. Please review your child's monthly attendance and test scores. Parent-Teacher meeting is scheduled this Saturday."
                value={customRemark}
                onChange={(e) => setCustomRemark(e.target.value)}
                style={{ fontSize: '12px', resize: 'vertical' }}
              />
            </div>

            {/* Success Message */}
            {sentNoticeSuccess && (
              <div
                style={{
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#15803d',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-solid fa-circle-check"></i>
                {sentNoticeSuccess}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setIsBroadcastModalOpen(false)}
                disabled={isSendingNotice}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSendBulkNotice}
                disabled={isSendingNotice}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontWeight: '700' }}
              >
                {isSendingNotice ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    Dispatching Reports...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane"></i>
                    Send to All Parents Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Send Individual Notice to Parent */}
      {renderSendIndividualNoticeModal()}

    </div>
  );
}
