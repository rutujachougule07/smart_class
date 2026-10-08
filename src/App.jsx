import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Overview from './components/Overview';
import ClassesTab from './components/ClassesTab';
import TeachersTab from './components/TeachersTab';
import StudentsTab from './components/StudentsTab';
import ExamsTab from './components/ExamsTab';
import MarksTab from './components/MarksTab';
import NoticesTab from './components/NoticesTab';
import SettingsTab from './components/SettingsTab';
import ReportsTab from './components/ReportsTab';
import Modals from './components/Modals';
import ImportExcelModal from './components/ImportExcelModal';
import WebhookSettingsModal from './components/WebhookSettingsModal';
import WebhookDispatchModal from './components/WebhookDispatchModal';
import AdminLogin from './components/AdminLogin';
import LandingPage from './components/LandingPage';
import ErrorBoundary from './components/ErrorBoundary';
import {
  getWebhookConfig,
  dispatchSmartWebhook,
  subscribeWebhooksList,
  getActiveWebhookForCategory,
  OFFICIAL_MONTHLY_WEBHOOK_URL,
  OFFICIAL_EXAM_WEBHOOK_URL
} from './services/webhookService';
import { getCurrentAdminSession, adminLogout } from './services/adminAuthService';
import { firebaseService, firebaseConfig } from './firebase';
import { isClassMatch, resolveCanonicalClassId, resolveCanonicalClassName, normalizeClassKey } from './services/classUtils';
import * as XLSX from 'xlsx';


// Helper function to unify marks collection (web / multi-subject) and exam_results collection (Android app format)
const unifyMarksAndResults = (rawMarks = [], rawExamResults = [], exams = [], students = [], classes = []) => {
  const unifiedMap = new Map();

  // Helper to normalize subject names
  const cleanSubjectName = (subj) => {
    if (!subj) return '';
    let s = String(subj).trim();
    if (s.includes('_')) s = s.replace(/_/g, ' ');
    return s;
  };

  // 1. First index records from `marks` collection (Web / multi-subject format)
  (rawMarks || []).forEach((m) => {
    if (!m) return;
    const sId = m.studentId || m.student_id;
    const eId = m.examId || m.exam_id;
    if (!sId || !eId) return;

    const student = (students || []).find((s) =>
      s.id === sId ||
      (s.rollNo && (String(s.rollNo) === String(sId) || (m.rollNo && String(s.rollNo) === String(m.rollNo)))) ||
      (m.studentName && s.name && s.name.trim().toLowerCase() === m.studentName.trim().toLowerCase())
    );

    const exam = (exams || []).find((e) =>
      e.id === eId ||
      e.title === eId ||
      (e.title && m.examTitle && e.title.trim().toLowerCase() === m.examTitle.trim().toLowerCase()) ||
      (e.title && m.exam_title && e.title.trim().toLowerCase() === m.exam_title.trim().toLowerCase())
    );

    const key = `${sId}_${eId}`;

    let initialMarks = {};
    if (m.marks && typeof m.marks === 'object') {
      Object.entries(m.marks).forEach(([k, v]) => {
        const cleanK = cleanSubjectName(k);
        if (cleanK && cleanK.toLowerCase() !== 'general' && v !== '' && v !== null && !isNaN(Number(v))) {
          initialMarks[cleanK] = Number(v);
        }
      });
    }

    const rawClass = m.classId || m.class_id || exam?.classId || student?.classId || '';
    const resolvedClassId = resolveCanonicalClassId(rawClass, classes);
    const resolvedClassName = resolveCanonicalClassName(resolvedClassId || rawClass, classes);

    unifiedMap.set(key, {
      ...m,
      studentId: sId,
      studentName: m.studentName || m.student_name || student?.name || 'Student',
      rollNo: m.rollNo || m.roll_no || student?.rollNo || '',
      classId: resolvedClassId,
      className: resolvedClassName,
      examId: eId,
      examTitle: m.examTitle || m.exam_title || exam?.title || (eId !== 'general' ? eId : 'General Evaluation'),
      marks: initialMarks,
      total: Number(m.total) || 0,
      maxTotal: Number(m.maxTotal) || 0,
      percentage: Number(m.percentage) || 0
    });
  });

  // 2. Process records from `exam_results` collection (Android mobile app format)
  (rawExamResults || []).forEach((r) => {
    if (!r) return;
    let sId = r.studentId || r.student_id;
    let eId = r.examId || r.exam_id;

    // Fallback extraction from document ID if missing: res_<examId>_<subject>_<studentId> or res_<examId>_<studentId>
    if ((!sId || !eId) && r.id && r.id.startsWith('res_')) {
      const foundExam = (exams || []).find((e) => r.id.includes(e.id));
      const foundStudent = (students || []).find((s) => r.id.includes(s.id) || (s.rollNo && r.id.endsWith(`_${s.rollNo}`)));
      if (foundExam) eId = foundExam.id;
      if (foundStudent) sId = foundStudent.id;
    }

    if (!sId || !eId) return;

    const student = (students || []).find((s) =>
      s.id === sId ||
      (s.rollNo && (String(s.rollNo) === String(sId) || (r.rollNo && String(s.rollNo) === String(r.rollNo)))) ||
      (r.studentName && s.name && s.name.trim().toLowerCase() === r.studentName.trim().toLowerCase())
    );

    const exam = (exams || []).find((e) =>
      e.id === eId ||
      e.title === eId ||
      (e.title && r.examTitle && e.title.trim().toLowerCase() === r.examTitle.trim().toLowerCase()) ||
      (e.title && r.exam_title && e.title.trim().toLowerCase() === r.exam_title.trim().toLowerCase())
    );

    const key = `${sId}_${eId}`;

    const rawClass = r.classId || r.class_id || exam?.classId || student?.classId || '';
    const resolvedClassId = resolveCanonicalClassId(rawClass, classes);
    const resolvedClassName = resolveCanonicalClassName(resolvedClassId || rawClass, classes);

    const existing = unifiedMap.get(key) || {
      id: `m_${sId}_${eId}`,
      studentId: sId,
      studentName: r.studentName || r.student_name || student?.name || 'Student',
      rollNo: r.rollNo || r.roll_no || student?.rollNo || '',
      classId: resolvedClassId,
      className: resolvedClassName,
      examId: eId,
      examTitle: r.examTitle || r.exam_title || exam?.title || (eId !== 'general' ? eId : 'General Evaluation'),
      marks: {},
      total: 0,
      maxTotal: 0,
      percentage: 0
    };

    let effectiveMarks = { ...(existing.marks || {}) };

    // A. If r.marks is an object map: { English: 25, Science: 40, ... }
    if (r.marks && typeof r.marks === 'object') {
      Object.entries(r.marks).forEach(([k, v]) => {
        const cleanK = cleanSubjectName(k);
        if (cleanK && cleanK.toLowerCase() !== 'general' && v !== '' && v !== null && !isNaN(Number(v))) {
          effectiveMarks[cleanK] = Number(v);
        }
      });
    }

    // B. If r represents a single subject score (e.g. from Android subject entry)
    const rScore = r.marksObtained !== undefined ? Number(r.marksObtained) :
                   (r.marks_obtained !== undefined ? Number(r.marks_obtained) :
                   (r.marks !== undefined && typeof r.marks !== 'object' ? Number(r.marks) : undefined));

    let detectedSubject = cleanSubjectName(r.subject || r.subject_name);
    if (!detectedSubject && r.id && r.id.startsWith('res_')) {
      const idParts = r.id.split('_');
      for (const part of idParts) {
        if (['English', 'Mathematics', 'Science', 'Marathi', 'Hindi', 'History', 'Geography', 'Drawing', 'Computer'].includes(part)) {
          detectedSubject = part;
          break;
        }
      }
      if (!detectedSubject && r.id.includes('Social_Studies')) {
        detectedSubject = 'Social Studies';
      }
    }

    if (!detectedSubject && exam?.subject && exam.subject !== 'General') {
      detectedSubject = cleanSubjectName(exam.subject);
    }

    if (rScore !== undefined && !isNaN(rScore)) {
      if (detectedSubject && detectedSubject.toLowerCase() !== 'general') {
        effectiveMarks[detectedSubject] = rScore;
      } else if (Object.keys(effectiveMarks).length === 0) {
        const defaultSubj = cleanSubjectName(exam?.subject) || 'Mathematics';
        if (defaultSubj.toLowerCase() !== 'general') {
          effectiveMarks[defaultSubj] = rScore;
        }
      }
    }

    // Calculate totals across all subjects
    const markEntries = Object.entries(effectiveMarks).filter(([k, v]) => k.toLowerCase() !== 'general' && !isNaN(Number(v)));
    const markValues = markEntries.map(([_, v]) => Number(v));

    const maxPerSubject = Number(exam?.maxMarks || exam?.max_marks || r.maxMarks || r.max_marks) || 100;
    const totalScore = markValues.length > 0 ? markValues.reduce((sum, v) => sum + v, 0) : (existing.total || 0);
    const totalSubjects = Math.max(1, markValues.length);
    const maxTotal = existing.maxTotal && existing.maxTotal >= (totalSubjects * maxPerSubject)
      ? existing.maxTotal
      : (totalSubjects * maxPerSubject);
    const pct = maxTotal > 0 ? Number(((totalScore / maxTotal) * 100).toFixed(1)) : 0;

    let grade = '-';
    let gradeLabel = 'Not Graded';
    if (pct >= 90) { grade = 'A+'; gradeLabel = 'Outstanding'; }
    else if (pct >= 80) { grade = 'A'; gradeLabel = 'Excellent'; }
    else if (pct >= 70) { grade = 'B+'; gradeLabel = 'Very Good'; }
    else if (pct >= 60) { grade = 'B'; gradeLabel = 'Good'; }
    else if (pct >= 50) { grade = 'C'; gradeLabel = 'Average'; }
    else if (pct >= 40) { grade = 'D'; gradeLabel = 'Pass'; }
    else { grade = 'F'; gradeLabel = 'Needs Improvement'; }

    unifiedMap.set(key, {
      ...existing,
      id: existing.id || `m_${sId}_${eId}`,
      studentId: sId,
      studentName: existing.studentName || r.studentName || r.student_name || student?.name || 'Student',
      rollNo: existing.rollNo || r.rollNo || r.roll_no || student?.rollNo || '',
      classId: resolvedClassId || existing.classId,
      className: resolvedClassName || existing.className,
      examId: eId,
      examTitle: existing.examTitle || r.examTitle || r.exam_title || exam?.title || 'Exam',
      marks: effectiveMarks,
      total: totalScore,
      maxTotal,
      percentage: pct,
      grade,
      gradeLabel,
      remarks: r.remarks || existing.remarks || '',
      updatedAt: r.updatedAt || existing.updatedAt || new Date().toISOString(),
      createdAt: existing.createdAt || r.createdAt || new Date().toISOString()
    });
  });

  return Array.from(unifiedMap.values());
};

const initialData = {
  schoolProfile: {
    schoolId: 'SCH-2026-904',
    schoolName: 'SmartClass Academy',
    adminName: 'Principal Administrator'
  },
  classes: [],
  teachers: [],
  students: [],
  attendance: [],
  exams: [],
  marks: [],
  examResults: [],
  notices: [],
  notifications: [],
  monthlyAttendanceHistory: []
};

export default function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [adminUser, setAdminUser] = useState(() => getCurrentAdminSession());
  
  // Default to 'landing' on fresh load or after closing the tab/browser
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash === '#dashboard' && getCurrentAdminSession()) {
        return 'dashboard';
      }
      if (window.location.hash === '#login') {
        return 'login';
      }
    }
    return 'landing'; // ALWAYS show Landing Page first on fresh site entry!
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#dashboard' && adminUser) {
        setViewMode('dashboard');
      } else if (hash === '#login') {
        setViewMode('login');
      } else if (!hash || hash === '#landing') {
        setViewMode('landing');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [adminUser]);

  const handleEnterFromLanding = () => {
    if (adminUser) {
      window.location.hash = 'dashboard';
      setViewMode('dashboard');
    } else {
      window.location.hash = 'login';
      setViewMode('login');
    }
  };

  const handleBackToLanding = () => {
    try {
      window.history.pushState('', document.title, window.location.pathname);
    } catch (e) {
      window.location.hash = '';
    }
    setViewMode('landing');
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out of the Admin Panel?')) {
      adminLogout();
      setAdminUser(null);
      handleBackToLanding();
    }
  };
  const [targetExamForMarks, setTargetExamForMarks] = useState(null);

  const navigateToExamMarks = (examId, classId) => {
    setTargetExamForMarks({ examId, classId, timestamp: Date.now() });
    setActiveTab(5); // Switch immediately to Marks tab
  };

  const [modalType, setModalType] = useState(null);
  const [isWebhookSettingsOpen, setIsWebhookSettingsOpen] = useState(false);
  const [webhookDispatchData, setWebhookDispatchData] = useState(null);

  const triggerWebhookDispatch = (data) => {
    setWebhookDispatchData(data);
  };

  const openWebhookSettings = () => {
    setIsWebhookSettingsOpen(true);
  };

  const [state, setState] = useState(() => {
    const saved = localStorage.getItem('smartclass_react_admin');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...initialData,
          schoolProfile: parsed.schoolProfile || initialData.schoolProfile
        };
      } catch (e) {
        console.error(e);
      }
    }
    return initialData;
  });

  useEffect(() => {
    localStorage.setItem('smartclass_react_admin', JSON.stringify({ schoolProfile: state.schoolProfile }));
  }, [state.schoolProfile]);

  // Firestore Real-Time Subscriptions (Single Source of Truth - Synchronized Everywhere)
  useEffect(() => {
    const unsubClasses = firebaseService.subscribeCollection('classes', (fbClasses) => {
      const uniqueClasses = Array.from(new Map(fbClasses.map(item => [item.id, item])).values());
      const parseClassNum = (val) => {
        const match = String(val || '').match(/\d+/);
        return match ? parseInt(match[0], 10) : 999999;
      };

      uniqueClasses.sort((a, b) => {
        const numA = parseClassNum(a.name);
        const numB = parseClassNum(b.name);
        if (numA !== numB) return numA - numB;
        const nameCmp = String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' });
        if (nameCmp !== 0) return nameCmp;
        return String(a.section || '').localeCompare(String(b.section || ''), undefined, { numeric: true, sensitivity: 'base' });
      });
      setState((prev) => ({ ...prev, classes: uniqueClasses }));
    });

    const unsubTeachers = firebaseService.subscribeCollection('teachers', (fbTeachers) => {
      const uniqueTeachers = Array.from(new Map(fbTeachers.map(item => [item.id, item])).values());
      setState((prev) => ({ ...prev, teachers: uniqueTeachers }));
    });

    const unsubStudents = firebaseService.subscribeCollection('students', (fbStudents) => {
      const uniqueStudents = Array.from(new Map(fbStudents.map(item => [item.id, item])).values());
      const parseRoll = (roll) => {
        if (roll === undefined || roll === null || roll === '') return 999999;
        const num = Number(roll);
        if (!isNaN(num)) return num;
        const match = String(roll).match(/\d+/);
        return match ? parseInt(match[0], 10) : 999999;
      };
      uniqueStudents.sort((a, b) => {
        const rollA = parseRoll(a.rollNo);
        const rollB = parseRoll(b.rollNo);
        if (rollA !== rollB) return rollA - rollB;
        return (
          String(a.rollNo || '').localeCompare(String(b.rollNo || ''), undefined, { numeric: true, sensitivity: 'base' }) ||
          (a.name || '').localeCompare(b.name || '')
        );
      });
      setState((prev) => ({ ...prev, students: uniqueStudents }));
    });

    const unsubAttendance = firebaseService.subscribeCollection('attendance', (fbAttendance) => {
      const uniqueAttendance = Array.from(new Map(fbAttendance.map(item => [item.id, item])).values());
      setState((prev) => ({ ...prev, attendance: uniqueAttendance }));
    });

    const unsubNotices = firebaseService.subscribeCollection('notices', (fbNotices) => {
      const uniqueNotices = Array.from(new Map(fbNotices.map(item => [item.id, item])).values());
      setState((prev) => ({ ...prev, notices: uniqueNotices }));
    });

    const unsubExams = firebaseService.subscribeCollection('exams', (fbExams) => {
      const normalized = (fbExams || []).map((e) => {
        const title = (e.title || e.examTitle || e.exam_title || 'Exam').toString().trim();
        const subject = (e.subject || e.subject_name || 'General').toString().trim();
        const classId = (e.classId || e.class_id || '').toString();
        const maxMarks = Number(e.maxMarks || e.max_marks || 100);
        const passMarks = Number(e.passMarks || e.pass_marks || 35);
        return {
          ...e,
          id: e.id || e._id,
          title,
          examTitle: title,
          exam_title: title,
          subject,
          subject_name: subject,
          classId,
          class_id: classId,
          maxMarks,
          max_marks: maxMarks,
          passMarks,
          pass_marks: passMarks,
          date: e.date || (e.createdAt ? e.createdAt.split('T')[0] : '')
        };
      });
      const uniqueExams = Array.from(new Map(normalized.map(item => [item.id, item])).values());
      setState((prev) => ({ ...prev, exams: uniqueExams }));
    });

    const unsubMarks = firebaseService.subscribeCollection('marks', (fbMarks) => {
      const uniqueMarks = Array.from(new Map(fbMarks.map(item => [item.id, item])).values());
      setState((prev) => ({ ...prev, marks: uniqueMarks }));
    });

    const unsubExamResults = firebaseService.subscribeCollection('exam_results', (fbResults) => {
      const uniqueResults = Array.from(new Map(fbResults.map(item => [item.id, item])).values());
      setState((prev) => ({ ...prev, examResults: uniqueResults }));
    });

    const unsubMonthlyHistory = firebaseService.subscribeCollection('monthly_attendance_history', (fbHistory) => {
      const uniqueHistory = Array.from(new Map((fbHistory || []).map(item => [item.id, item])).values());
      setState((prev) => ({ ...prev, monthlyAttendanceHistory: uniqueHistory }));
    });

    const unsubNotifications = firebaseService.subscribeCollection('notifications', (fbNotifs) => {
      // Keep only admin activity / panel change notifications, strictly exclude Notice Board announcements & parent alerts
      const validNotifs = (fbNotifs || []).filter((n) => {
        if (!n) return false;
        // Exclude notice board circulars & reports
        if (n.type === 'notice' || n.type === 'report' || n.isNoticeBoardPost || n.isAlert) return false;
        if (n.target === 'Parents' || n.targetRole === 'Selected Parent' || n.academicResult) return false;
        // Include admin actions
        const adminSections = ['students', 'teachers', 'classes', 'exams', 'marks', 'attendance', 'profile', 'import', 'system'];
        return n.target === 'admin' || (n.section && adminSections.includes(n.section.toLowerCase()));
      });
      // Sort newest first
      validNotifs.sort((a, b) => {
        const tA = a.createdAt || a.timestamp || a.date || '';
        const tB = b.createdAt || b.timestamp || b.date || '';
        return tB.localeCompare(tA);
      });
      setState((prev) => ({ ...prev, notifications: validNotifs }));
    });

    const unsubSchoolProfile = firebaseService.subscribeCollection('schoolProfile', (fbProfiles) => {
      if (fbProfiles && fbProfiles.length > 0) {
        const found = fbProfiles.find((p) => p.id === 'main_profile') || fbProfiles[0];
        if (found) {
          setState((prev) => ({
            ...prev,
            schoolProfile: {
              ...prev.schoolProfile,
              ...found
            }
          }));
        }
      }
    });

    const unsubWebhooks = subscribeWebhooksList(() => {});

    return () => {
      unsubClasses();
      unsubTeachers();
      unsubStudents();
      unsubAttendance();
      unsubNotices();
      unsubExams();
      unsubMarks();
      unsubExamResults();
      unsubMonthlyHistory();
      unsubNotifications();
      unsubSchoolProfile();
      unsubWebhooks();
    };
  }, []);

  const updateSchoolProfile = async (newProfile) => {
    const updated = {
      ...state.schoolProfile,
      ...newProfile,
      updatedAt: new Date().toISOString()
    };
    setState((prev) => ({
      ...prev,
      schoolProfile: updated
    }));

    try {
      await firebaseService.setDocument('schoolProfile', 'main_profile', updated, true);
      await firebaseService.setDocument('config', 'school_profile', updated, true);
    } catch (err) {
      console.warn('Failed to persist schoolProfile to Firestore:', err);
    }

    await notifySystemChange({
      title: 'School Profile Updated',
      content: `School information updated: ${updated.schoolName || 'School'} (Administrator: ${updated.adminName || 'Admin'}).`,
      type: 'profile',
      section: 'profile',
      targetRole: 'All'
    });
  };

  // Permanently Delete All Documents from Firebase Firestore & Local Storage
  const clearAllData = async () => {
    try {
      await firebaseService.clearCollectionDocuments('classes');
      await firebaseService.clearCollectionDocuments('teachers');
      await firebaseService.clearCollectionDocuments('students');
      await firebaseService.clearCollectionDocuments('exams');
      await firebaseService.clearCollectionDocuments('marks');
      await firebaseService.clearCollectionDocuments('exam_results');
      await firebaseService.clearCollectionDocuments('notices');
      await firebaseService.clearCollectionDocuments('attendance');
      await firebaseService.clearCollectionDocuments('notifications');
      await firebaseService.clearCollectionDocuments('monthly_attendance_history');
      await firebaseService.clearCollectionDocuments('weekly_attendance_history');
    } catch (e) {
      console.error("Error clearing Firebase collections:", e);
    }

    localStorage.removeItem('smartclass_react_admin');
    setState({
      schoolProfile: state.schoolProfile,
      classes: [],
      teachers: [],
      students: [],
      attendance: [],
      exams: [],
      marks: [],
      examResults: [],
      notices: [],
      notifications: [],
      monthlyAttendanceHistory: []
    });
  };

  const openModal = (type) => setModalType(type);
  const closeModal = () => setModalType(null);

  // Central notification dispatcher for administrative activity changes across any section
  const notifySystemChange = async ({
    title,
    content,
    type = 'update',
    section = 'general',
    priority = 'Normal',
    targetRole = 'Admin',
    studentId = null,
    studentName = null,
    parentPhone = null,
    parentId = null,
    classId = null,
    className = null,
    tabIndex = null
  }) => {
    const timestamp = new Date().toISOString();
    const dateStr = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const cleanPhone = (parentPhone || '').replace(/\s+/g, '');
    const cleanParentId = parentId || (cleanPhone ? cleanPhone : (studentId ? `${studentId}_parent` : null));

    // Determine target tabIndex if not explicitly provided
    let targetTabIndex = tabIndex;
    if (targetTabIndex === null || targetTabIndex === undefined) {
      if (type === 'student' || section === 'students') targetTabIndex = 3;
      else if (type === 'teacher' || section === 'teachers') targetTabIndex = 2;
      else if (type === 'class' || section === 'classes') targetTabIndex = 1;
      else if (type === 'exam' || section === 'exams') targetTabIndex = 4;
      else if (type === 'marks' || section === 'marks') targetTabIndex = 5;
      else if (type === 'attendance' || section === 'attendance') targetTabIndex = 3;
      else if (type === 'report' || section === 'reports') targetTabIndex = 7;
      else targetTabIndex = 0;
    }

    const notifDocId = `notif_${type}_${studentId || 'sys'}_${Date.now()}`;
    const notifRecord = {
      id: notifDocId,
      title: title.trim(),
      message: content.trim(),
      content: content.trim(),
      priority,
      type,
      section,
      tabIndex: targetTabIndex,
      author: state.schoolProfile.adminName || 'Admin',
      sentBy: 'System',
      date: dateStr,
      time: timeStr,
      createdAt: timestamp,
      timestamp,
      isRead: false,
      status: 'unread',
      target: 'admin',
      studentId: studentId || null,
      studentName: studentName || null,
      parentId: cleanParentId,
      parentPhone: cleanPhone || null,
      classId: classId || null,
      className: className || null
    };

    try {
      // 1. Write to 'notifications' collection with explicit document ID
      await firebaseService.setDocument('notifications', notifDocId, notifRecord, true);

      // 2. If parent phone exists or targeted to parents, also send to 'notices' and 'alerts' collections for Android parent app
      if (cleanPhone || targetRole === 'Selected Parent' || targetRole === 'Parents') {
        const noticeDocId = `notice_${type}_${studentId || 'sys'}_${Date.now()}`;
        await firebaseService.setDocument('notices', noticeDocId, {
          id: noticeDocId,
          title: notifRecord.title,
          message: notifRecord.message,
          content: notifRecord.message,
          type,
          section,
          priority,
          targetRole: targetRole || 'Selected Parent',
          parentId: cleanParentId || cleanPhone || '',
          parentPhone: cleanPhone,
          studentId: studentId || '',
          studentName: studentName || '',
          classId: classId || '',
          className: className || '',
          author: state.schoolProfile.adminName || 'Admin',
          sentBy: 'Admin',
          date: dateStr,
          isRead: false,
          status: 'unread',
          readBy: [],
          isAlert: true,
          timestamp,
          createdAt: timestamp
        }, true);

        const alertDocId = `alert_${type}_${studentId || 'sys'}_${Date.now()}`;
        await firebaseService.setDocument('alerts', alertDocId, {
          id: alertDocId,
          title: notifRecord.title,
          message: notifRecord.message,
          content: notifRecord.message,
          type,
          section,
          priority,
          targetRole,
          parentId: cleanParentId || '',
          parentPhone: cleanPhone,
          studentId: studentId || '',
          studentName: studentName || '',
          classId: classId || '',
          className: className || '',
          isRead: false,
          timestamp,
          createdAt: timestamp
        }, true);
      }
    } catch (err) {
      console.warn('Failed to dispatch system notification:', err);
    }
  };

  // Mark single notification as read (synced with localStorage and Firestore)
  const markNotificationAsRead = async (notifId) => {
    if (!notifId) return;
    try {
      const readKey = 'smartclass_admin_read_notifs';
      let readList = [];
      try {
        readList = JSON.parse(localStorage.getItem(readKey) || '[]');
      } catch (e) {}
      if (!readList.includes(notifId)) {
        readList.push(notifId);
        localStorage.setItem(readKey, JSON.stringify(readList));
      }

      setState((prev) => ({
        ...prev,
        notifications: (prev.notifications || []).map((n) =>
          n.id === notifId ? { ...n, isRead: true } : n
        )
      }));

      await firebaseService.updateDocument('notifications', notifId, {
        isRead: true,
        readAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Error marking notification as read:', err);
    }
  };

  // Mark all unread notifications as read
  const markAllNotificationsAsRead = async () => {
    try {
      const readKey = 'smartclass_admin_read_notifs';
      let readList = [];
      try {
        readList = JSON.parse(localStorage.getItem(readKey) || '[]');
      } catch (e) {}

      const unreadNotifs = (state.notifications || []).filter((n) => !n.isRead);
      unreadNotifs.forEach((n) => {
        if (!readList.includes(n.id)) readList.push(n.id);
      });
      localStorage.setItem(readKey, JSON.stringify(readList));

      setState((prev) => ({
        ...prev,
        notifications: (prev.notifications || []).map((n) => ({ ...n, isRead: true }))
      }));

      const updatePromises = unreadNotifs.map((n) =>
        firebaseService.updateDocument('notifications', n.id, {
          isRead: true,
          readAt: new Date().toISOString()
        })
      );
      await Promise.all(updatePromises);
    } catch (err) {
      console.warn('Error marking all notifications as read:', err);
    }
  };

  // Clear single notification by ID
  const clearNotification = async (notifId) => {
    try {
      setState((prev) => ({
        ...prev,
        notifications: (prev.notifications || []).filter((n) => n.id !== notifId)
      }));

      const readKey = 'smartclass_admin_read_notifs';
      try {
        const readList = JSON.parse(localStorage.getItem(readKey) || '[]');
        const updated = readList.filter((id) => id !== notifId);
        localStorage.setItem(readKey, JSON.stringify(updated));
      } catch (e) {}

      await firebaseService.deleteDocument('notifications', notifId);
    } catch (err) {
      console.warn('Error deleting notification:', err);
    }
  };

  // Clear all notifications
  const clearAllNotifications = async () => {
    try {
      const notifIds = (state.notifications || []).map((n) => n.id).filter(Boolean);
      setState((prev) => ({
        ...prev,
        notifications: []
      }));

      const readKey = 'smartclass_admin_read_notifs';
      try {
        localStorage.removeItem(readKey);
      } catch (e) {}

      const deletePromises = notifIds.map((id) => firebaseService.deleteDocument('notifications', id));
      await Promise.all(deletePromises);
      await firebaseService.clearCollectionDocuments('notifications');
    } catch (err) {
      console.warn('Error clearing all notifications:', err);
    }
  };

  // Import Excel Modal state & handlers
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importCategory, setImportCategory] = useState('students');
  const [importTargetClassId, setImportTargetClassId] = useState('');
  const openImportModal = (category = 'students', classId = '') => {
    setImportCategory(category);
    setImportTargetClassId(classId || '');
    setIsImportModalOpen(true);
  };
  const closeImportModal = () => setIsImportModalOpen(false);

  const handleImportStudents = async (data) => {
    const todayDate = new Date().toISOString().split('T')[0];
    const cleanRoll = String(data.rollNo || '').trim() || '101';
    
    // Check if roll number is already taken in this class
    const isRollTaken = state.students.some(
      (s) => s.classId === data.classId && String(s.rollNo).trim().toLowerCase() === cleanRoll.toLowerCase()
    );
    if (isRollTaken) {
      console.warn(`Skipping duplicate student: Roll ${cleanRoll} already exists in class ${data.classId}`);
      throw new Error(`Roll number ${cleanRoll} is already registered in this class!`);
    }

    const newStudent = {
      rollNo: cleanRoll,
      name: String(data.name).trim(),
      classId: data.classId,
      parentName: data.parentName ? String(data.parentName).trim() : 'Parent',
      parentPhone: data.parentPhone ? String(data.parentPhone).trim() : '',
      attendanceStatus: 'Not Marked',
      attendanceDate: ''
    };
    const docId = await firebaseService.addDocument('students', newStudent);
    return docId;
  };

  const handleImportTeachers = async (data) => {
    const newTeacher = {
      name: String(data.name).trim(),
      phone: String(data.phone).trim(),
      password: data.password ? String(data.password).trim() : '111111',
      role: data.role || 'Class Teacher',
      subject: data.subject ? String(data.subject).trim() : 'English',
      qualification: data.qualification || 'B.Ed',
      assignedClassIds: data.assignedClassIds || [],
      assignedClassId: data.assignedClassIds && data.assignedClassIds.length > 0 ? data.assignedClassIds[0] : null
    };
    const docId = await firebaseService.addDocument('teachers', newTeacher);
    if (data.assignedClassIds && data.assignedClassIds.length > 0) {
      for (const classId of data.assignedClassIds) {
        await firebaseService.updateDocument('classes', classId, { teacherId: docId, classTeacherId: docId });
      }
    }
    return docId;
  };

  const handleImportClasses = async (data) => {
    const cleanName = String(data.name || '').trim();
    const cleanSec = String(data.section || '').trim().toUpperCase();
    if (!cleanName) return null;

    const normalizeCls = (n, s) => {
      const normName = String(n || '').toLowerCase().replace(/^class\s+/i, '').replace(/th$/i, '').trim();
      const normSec = String(s || '').toLowerCase().replace(/^section\s+/i, '').trim();
      return `${normName}_${normSec}`;
    };

    const isDuplicate = state.classes.some((c) => {
      const cName = String(c.name || '').trim().toLowerCase();
      const cSec = String(c.section || '').trim().toUpperCase();
      if (cName === cleanName.toLowerCase() && cSec === cleanSec) return true;
      return normalizeCls(c.name, c.section) === normalizeCls(cleanName, cleanSec);
    });

    if (isDuplicate) {
      console.warn(`Skipping duplicate class: ${cleanName} - ${cleanSec}`);
      throw new Error(`Class ${cleanName} - ${cleanSec} already exists!`);
    }

    const newClass = {
      name: cleanName,
      section: cleanSec,
      roomNumber: data.roomNumber ? String(data.roomNumber).trim() : 'Room 101',
      teacherId: null,
      classTeacherId: null
    };
    return await firebaseService.addDocument('classes', newClass);
  };

  const addClass = async (data) => {
    if (!data.name || !data.section) return;
    const cleanName = data.name.trim();
    const cleanSec = data.section.trim().toUpperCase();

    const normalizeCls = (n, s) => {
      const normName = String(n || '').toLowerCase().replace(/^class\s+/i, '').replace(/th$/i, '').trim();
      const normSec = String(s || '').toLowerCase().replace(/^section\s+/i, '').trim();
      return `${normName}_${normSec}`;
    };

    const isDuplicate = state.classes.some((c) => {
      const cName = String(c.name || '').trim().toLowerCase();
      const cSec = String(c.section || '').trim().toUpperCase();
      if (cName === cleanName.toLowerCase() && cSec === cleanSec) return true;
      return normalizeCls(c.name, c.section) === normalizeCls(cleanName, cleanSec);
    });

    if (isDuplicate) {
      alert(`Class "${cleanName} - ${cleanSec}" already exists!`);
      return;
    }

    const chosenSubjects = Array.isArray(data.subjects) && data.subjects.length > 0
      ? data.subjects
      : (data.subject ? [data.subject] : []);
    const newClass = {
      name: cleanName,
      section: cleanSec,
      roomNumber: data.roomNumber ? data.roomNumber.trim() : 'Room 101',
      subjects: chosenSubjects,
      subject: data.subject || (chosenSubjects.length > 0 ? chosenSubjects[0] : null),
      teacherId: null,
      classTeacherId: null
    };

    try {
      await firebaseService.addDocument('classes', newClass);
      await notifySystemChange({
        title: `New Class Created: Class ${newClass.name}-${newClass.section}`,
        content: `A new class section Class ${newClass.name}-${newClass.section} has been created with room allocation ${newClass.roomNumber}.`,
        type: 'class',
        section: 'classes',
        className: `Class ${newClass.name}-${newClass.section}`
      });
      closeModal();
    } catch (e) {
      console.error("Error adding class:", e);
      if (e?.code === 'permission-denied' || String(e).toLowerCase().includes('permission')) {
        alert("Firebase Permission Error (permission-denied):\n\nFirestore Security Rules in your Firebase project 'smartclass-3e828' are blocking writes.\n\nPlease open Firebase Console -> Firestore Database -> Rules, and set:\nallow read, write: if true;\nThen click Publish.");
      } else {
        alert(`Failed to save class to Firebase: ${e?.message || e}`);
      }
    }
  };

  const deleteClass = async (id) => {
    if (!id) return;
    const targetClass = state.classes.find((c) => c.id === id);
    const clsName = targetClass ? `Class ${targetClass.name}-${targetClass.section}` : 'Class section';
    if (!window.confirm(`Are you sure you want to permanently delete ${clsName} from Firebase?`)) return;
    
    try {
      await firebaseService.deleteDocument('classes', id);
      const assignedTeachers = state.teachers.filter(t => t.assignedClassId === id || (t.assignedClassIds && t.assignedClassIds.includes(id)));
      for (const t of assignedTeachers) {
        const updatedIds = (t.assignedClassIds || []).filter(cid => cid !== id);
        await firebaseService.updateDocument('teachers', t.id, {
          assignedClassIds: updatedIds,
          assignedClassId: updatedIds.length > 0 ? updatedIds[0] : null
        });
      }

      // Unassign enrolled students cleanly so they are not left with a broken ghost class ID
      const enrolledStudents = (state.students || []).filter((s) => s.classId === id);
      for (const s of enrolledStudents) {
        await firebaseService.updateDocument('students', s.id, { classId: '' }).catch(() => {});
      }
      await notifySystemChange({
        title: `Class Removed: ${clsName}`,
        content: `${clsName} was permanently deleted from the school registry.`,
        type: 'class',
        section: 'classes',
        priority: 'High'
      });
    } catch (e) {
      console.error("Error deleting class from Firebase:", e);
    }
  };

  const updateClass = async (id, data) => {
    if (!id || !data.name || !data.section) return;
    const cleanName = data.name.trim();
    const cleanSec = data.section.trim().toUpperCase();

    const normalizeCls = (n, s) => {
      const normName = String(n || '').toLowerCase().replace(/^class\s+/i, '').replace(/th$/i, '').trim();
      const normSec = String(s || '').toLowerCase().replace(/^section\s+/i, '').trim();
      return `${normName}_${normSec}`;
    };

    const isDuplicate = state.classes.some((c) => {
      if (c.id === id) return false;
      const cName = String(c.name || '').trim().toLowerCase();
      const cSec = String(c.section || '').trim().toUpperCase();
      if (cName === cleanName.toLowerCase() && cSec === cleanSec) return true;
      return normalizeCls(c.name, c.section) === normalizeCls(cleanName, cleanSec);
    });

    if (isDuplicate) {
      alert(`Class "${cleanName} - ${cleanSec}" already exists!`);
      return;
    }

    const chosenSubjects = Array.isArray(data.subjects) && data.subjects.length > 0
      ? data.subjects
      : (data.subject ? [data.subject] : []);

    const updatedClass = {
      name: cleanName,
      section: cleanSec,
      roomNumber: data.roomNumber ? data.roomNumber.trim() : 'Room 101',
      subjects: chosenSubjects,
      subject: data.subject || (chosenSubjects.length > 0 ? chosenSubjects[0] : null),
      updatedAt: new Date().toISOString()
    };

    try {
      await firebaseService.updateDocument('classes', id, updatedClass);
      await notifySystemChange({
        title: `Class Updated: Class ${cleanName}-${cleanSec}`,
        content: `Class details for Class ${cleanName}-${cleanSec} (Room: ${updatedClass.roomNumber}) have been updated.`,
        type: 'class',
        section: 'classes',
        className: `Class ${cleanName}-${cleanSec}`
      });
    } catch (e) {
      console.error("Error updating class in Firebase:", e);
      alert('Error updating class: ' + e.message);
    }
  };

  const addTeacher = async (data) => {
    if (!data.name || !data.phone) return;
    const cleanPhone = data.phone.trim();
    if (state.teachers.some((t) => t.phone === cleanPhone)) {
      alert('Mobile number already taken!');
      return;
    }

    const assignedIds = Array.isArray(data.assignedClassIds)
      ? (data.role === 'Class Teacher' ? data.assignedClassIds.slice(0, 1) : data.assignedClassIds)
      : [];

    const newTeacher = {
      name: data.name.trim(),
      phone: cleanPhone,
      password: data.password ? data.password.trim() : '111111',
      role: data.role || 'Class Teacher',
      subject: data.subject ? data.subject.trim() : 'English',
      qualification: data.qualification ? data.qualification.trim() : 'B.Ed',
      assignedClassIds: assignedIds,
      assignedClassId: assignedIds.length > 0 ? assignedIds[0] : null
    };

    try {
      const docId = await firebaseService.addDocument('teachers', newTeacher);
      if (assignedIds.length > 0) {
        for (const classId of assignedIds) {
          const targetCls = state.classes.find((c) => c.id === classId);
          const allTeacherIds = new Set(targetCls?.assignedTeacherIds || []);
          allTeacherIds.add(docId);
          const classUpdates = {
            assignedTeacherIds: Array.from(allTeacherIds),
            teacherIds: Array.from(allTeacherIds)
          };
          if (newTeacher.role === 'Class Teacher') {
            classUpdates.teacherId = docId;
            classUpdates.classTeacherId = docId;
          }
          await firebaseService.updateDocument('classes', classId, classUpdates);
        }
      }
      await notifySystemChange({
        title: `New Teacher Added: ${newTeacher.name}`,
        content: `${newTeacher.name} has joined the faculty as ${newTeacher.role} (${newTeacher.subject}, Qualification: ${newTeacher.qualification}).`,
        type: 'teacher',
        section: 'teachers'
      });
    } catch (e) {
      console.error("Error adding teacher:", e);
    }
    closeModal();
  };

  const deleteTeacher = async (id) => {
    if (!id) return;
    const teacher = state.teachers.find((t) => t.id === id);
    const teacherName = teacher?.name || 'Teacher';
    if (!window.confirm(`Are you sure you want to permanently delete teacher "${teacherName}" from Firebase?`)) return;

    try {
      await firebaseService.deleteDocument('teachers', id);

      // Clean up class teacher and subject assignments in classes
      for (const c of state.classes) {
        let needsUpdate = false;
        const updates = {};

        if (c.teacherId === id || c.classTeacherId === id) {
          updates.teacherId = null;
          updates.classTeacherId = null;
          needsUpdate = true;
        }

        if (c.subjectTeachers && typeof c.subjectTeachers === 'object') {
          const newST = { ...c.subjectTeachers };
          let stChanged = false;
          Object.entries(newST).forEach(([s, tid]) => {
            if (tid === id) {
              delete newST[s];
              stChanged = true;
            }
          });
          if (stChanged) {
            updates.subjectTeachers = newST;
            updates.subjectTeacherAssignments = Object.entries(newST).map(([subj, tid]) => {
              const tc = state.teachers.find((t) => t.id === tid && t.id !== id);
              return {
                subject: subj,
                teacherId: tid,
                teacherName: tc ? tc.name : 'Teacher',
                phone: tc ? tc.phone : '',
                role: tc ? tc.role : 'Subject Teacher'
              };
            });
            needsUpdate = true;
          }
        }

        // Recompute assignedTeacherIds
        const allTids = new Set();
        const effectiveCtId = updates.teacherId !== undefined ? updates.teacherId : c.teacherId;
        if (effectiveCtId && effectiveCtId !== id) allTids.add(effectiveCtId);
        const effectiveST = updates.subjectTeachers !== undefined ? updates.subjectTeachers : (c.subjectTeachers || {});
        Object.values(effectiveST).forEach((tid) => {
          if (tid && tid !== id) allTids.add(tid);
        });
        const newAssignedTids = Array.from(allTids);

        if (needsUpdate || (c.assignedTeacherIds && c.assignedTeacherIds.includes(id))) {
          updates.assignedTeacherIds = newAssignedTids;
          updates.teacherIds = newAssignedTids;
          await firebaseService.updateDocument('classes', c.id, updates);
        }
      }

      await notifySystemChange({
        title: `Teacher Removed: ${teacherName}`,
        content: `Teacher ${teacherName} was removed from the faculty directory.`,
        type: 'teacher',
        section: 'teachers',
        priority: 'High'
      });
    } catch (e) {
      console.error("Error deleting teacher from Firebase:", e);
    }
  };

  const updateTeacher = async (id, data) => {
    if (!id || !data.name || !data.phone) return;
    const cleanPhone = data.phone.trim();
    const isPhoneTaken = state.teachers.some((t) => t.id !== id && t.phone === cleanPhone);
    if (isPhoneTaken) {
      alert('Mobile number already taken by another teacher!');
      return;
    }

    const assignedIds = Array.isArray(data.assignedClassIds)
      ? (data.role === 'Class Teacher' ? data.assignedClassIds.slice(0, 1) : data.assignedClassIds)
      : [];

    // Classes where teacher currently teaches subjects must NOT be lost
    const oldTeacher = state.teachers.find((t) => t.id === id);
    const classesWithSubjects = state.classes
      .filter((c) => c.subjectTeachers && Object.values(c.subjectTeachers).includes(id))
      .map((c) => c.id);
    const finalClassIds = Array.from(new Set([...assignedIds, ...classesWithSubjects]));

    const updatedTeacher = {
      name: data.name.trim(),
      phone: cleanPhone,
      password: data.password ? data.password.trim() : (oldTeacher?.password || '111111'),
      role: data.role || 'Class Teacher',
      subject: data.subject ? data.subject.trim() : (oldTeacher?.subject || 'English'),
      qualification: data.qualification ? data.qualification.trim() : (oldTeacher?.qualification || 'B.Ed'),
      assignedClassIds: finalClassIds,
      assignedClassId: finalClassIds.length > 0 ? finalClassIds[0] : null,
      assignedSubjects: oldTeacher?.assignedSubjects || {},
      subjectAssignments: oldTeacher?.subjectAssignments || []
    };

    try {
      await firebaseService.updateDocument('teachers', id, updatedTeacher);

      const oldAssignedIds = oldTeacher?.assignedClassIds || (oldTeacher?.assignedClassId ? [oldTeacher.assignedClassId] : []);
      const newAssignedIds = updatedTeacher.assignedClassIds;

      // Handle classes that were unassigned
      for (const classId of oldAssignedIds) {
        if (!newAssignedIds.includes(classId)) {
          const cls = state.classes.find((c) => c.id === classId);
          if (cls) {
            const updates = {};
            if (cls.teacherId === id || cls.classTeacherId === id) {
              updates.teacherId = null;
              updates.classTeacherId = null;
            }
            const allTids = (cls.assignedTeacherIds || []).filter((tid) => tid !== id);
            updates.assignedTeacherIds = allTids;
            updates.teacherIds = allTids;
            await firebaseService.updateDocument('classes', classId, updates);
          }
        }
      }

      // Handle classes that were assigned
      for (const classId of newAssignedIds) {
        const cls = state.classes.find((c) => c.id === classId);
        if (cls) {
          const allTids = new Set(cls.assignedTeacherIds || []);
          allTids.add(id);
          const updates = {
            assignedTeacherIds: Array.from(allTids),
            teacherIds: Array.from(allTids)
          };
          if (updatedTeacher.role === 'Class Teacher') {
            updates.teacherId = id;
            updates.classTeacherId = id;
          }
          await firebaseService.updateDocument('classes', classId, updates);
        }
      }

      await notifySystemChange({
        title: `Teacher Updated: ${updatedTeacher.name}`,
        content: `Profile details, subject (${updatedTeacher.subject}), or role for teacher ${updatedTeacher.name} were updated.`,
        type: 'teacher',
        section: 'teachers'
      });
    } catch (e) {
      console.error("Error updating teacher in Firebase:", e);
      alert('Failed to update teacher: ' + e.message);
    }
  };

  const assignTeacherClass = async (teacherId, classId) => {
    if (!classId) return;

    const currentCls = state.classes.find((c) => c.id === classId);
    const teacher = state.teachers.find((t) => t.id === teacherId);
    const clsName = currentCls ? `${currentCls.name}-${currentCls.section}` : 'Class';
    const teacherName = teacher ? teacher.name : 'Teacher';

    // When changing class teacher, only unassign teachers who were previously class teacher AND have no subject assignments in this class
    const prevTeachers = state.teachers.filter(
      (t) =>
        t.id !== teacherId &&
        (t.id === currentCls?.teacherId || t.id === currentCls?.classTeacherId)
    );

    for (const prevTeacher of prevTeachers) {
      try {
        const hasSubjectsInClass = currentCls?.subjectTeachers && Object.values(currentCls.subjectTeachers).includes(prevTeacher.id);
        if (!hasSubjectsInClass) {
          const updatedIds = (prevTeacher.assignedClassIds || []).filter((cid) => cid !== classId);
          await firebaseService.updateDocument('teachers', prevTeacher.id, {
            assignedClassIds: updatedIds,
            assignedClassId: updatedIds.length > 0 ? updatedIds[0] : null
          });
        }
      } catch (e) {
        console.error("Error unassigning previous class teacher:", e);
      }
    }

    if (teacherId) {
      try {
        const currentTeacher = state.teachers.find((t) => t.id === teacherId);
        const existingIds = currentTeacher?.assignedClassIds || (currentTeacher?.assignedClassId ? [currentTeacher.assignedClassId] : []);
        const newIds = Array.from(new Set([...existingIds, classId]));

        await firebaseService.updateDocument('teachers', teacherId, {
          assignedClassIds: newIds,
          assignedClassId: newIds[0] || classId
        });
      } catch (e) {
        console.error("Error updating assigned teacher:", e);
      }
    }

    try {
      const allTeacherIds = new Set();
      if (teacherId) allTeacherIds.add(teacherId);
      if (currentCls?.subjectTeachers) {
        Object.values(currentCls.subjectTeachers).forEach((tid) => {
          if (tid) allTeacherIds.add(tid);
        });
      }

      await firebaseService.updateDocument('classes', classId, {
        teacherId: teacherId || null,
        classTeacherId: teacherId || null,
        assignedTeacherIds: Array.from(allTeacherIds),
        teacherIds: Array.from(allTeacherIds)
      });

      await notifySystemChange({
        title: `Class Teacher Assigned: ${teacherName}`,
        content: `${teacherName} has been assigned as Class Teacher for Class ${clsName}.`,
        type: 'teacher',
        section: 'teachers',
        classId,
        className: `Class ${clsName}`
      });
    } catch (e) {
      console.error("Error updating class teacher in Firebase:", e);
    }
  };

  const assignSubjectTeacher = async (classId, subjectName, teacherId) => {
    if (!classId || !subjectName) return;
    const cleanSubj = String(subjectName).trim();
    if (!cleanSubj) return;

    if (!teacherId || teacherId === 'unassigned' || teacherId === 'none') {
      return await removeSubjectTeacher(classId, cleanSubj);
    }

    const currentCls = state.classes.find((c) => c.id === classId);
    if (!currentCls) return;

    const teacher = state.teachers.find((t) => t.id === teacherId);
    const teacherName = teacher ? teacher.name : 'Teacher';
    const clsName = `${currentCls.name}${currentCls.section ? ' - ' + currentCls.section : ''}`;

    const currentSubjectTeachers = { ...(currentCls.subjectTeachers || {}) };
    const prevTeacherId = currentSubjectTeachers[cleanSubj];

    // Assign new teacher to this subject
    currentSubjectTeachers[cleanSubj] = teacherId;

    // Ensure subject is in class subjects list
    const existingSubjects = Array.isArray(currentCls.subjects) ? [...currentCls.subjects] : [];
    if (!existingSubjects.some((s) => s.toLowerCase() === cleanSubj.toLowerCase())) {
      existingSubjects.push(cleanSubj);
    }

    // Build unique assigned teacher IDs (class teacher + all subject teachers)
    const allTeacherIds = new Set();
    if (currentCls.teacherId) allTeacherIds.add(currentCls.teacherId);
    if (currentCls.classTeacherId) allTeacherIds.add(currentCls.classTeacherId);
    Object.values(currentSubjectTeachers).forEach((tid) => {
      if (tid) allTeacherIds.add(tid);
    });
    const assignedTeacherIds = Array.from(allTeacherIds);

    // Build subjectTeacherAssignments array for Android app compatibility
    const subjectTeacherAssignments = Object.entries(currentSubjectTeachers).map(([subj, tid]) => {
      const tc = state.teachers.find((t) => t.id === tid);
      return {
        subject: subj,
        teacherId: tid,
        teacherName: tc ? tc.name : 'Teacher',
        phone: tc ? tc.phone : '',
        role: tc ? tc.role : 'Subject Teacher'
      };
    });

    try {
      // Optimistically update local state immediately for instant UI responsiveness
      setState((prev) => ({
        ...prev,
        classes: (prev.classes || []).map((cls) => {
          if (cls.id !== classId) return cls;
          return {
            ...cls,
            subjectTeachers: currentSubjectTeachers,
            subjectTeacherAssignments,
            assignedTeacherIds,
            teacherIds: assignedTeacherIds,
            subjects: existingSubjects
          };
        })
      }));

      // 1. Update Class in Firestore
      await firebaseService.updateDocument('classes', classId, {
        subjectTeachers: currentSubjectTeachers,
        subjectTeacherAssignments,
        assignedTeacherIds,
        teacherIds: assignedTeacherIds,
        subjects: existingSubjects
      });

      // 2. Update Newly Assigned Teacher in Firestore
      if (teacher) {
        const curClassIds = Array.isArray(teacher.assignedClassIds)
          ? [...teacher.assignedClassIds]
          : (teacher.assignedClassId ? [teacher.assignedClassId] : []);
        if (!curClassIds.includes(classId)) {
          curClassIds.push(classId);
        }

        const curAssignedSubjects = { ...(teacher.assignedSubjects || {}) };
        const subList = Array.from(new Set([...(curAssignedSubjects[classId] || []), cleanSubj]));
        curAssignedSubjects[classId] = subList;

        const teacherAssignments = [];
        Object.entries(curAssignedSubjects).forEach(([cid, sArr]) => {
          const cObj = state.classes.find((c) => c.id === cid) || (cid === classId ? currentCls : null);
          const cName = cObj ? `${cObj.name}${cObj.section ? ' - ' + cObj.section : ''}` : cid;
          (sArr || []).forEach((s) => {
            teacherAssignments.push({ classId: cid, className: cName, subject: s });
          });
        });

        await firebaseService.updateDocument('teachers', teacherId, {
          assignedClassIds: curClassIds,
          assignedClassId: curClassIds[0] || classId,
          assignedSubjects: curAssignedSubjects,
          subjectAssignments: teacherAssignments
        });
      }

      // 3. Clean up previous teacher if replaced
      if (prevTeacherId && prevTeacherId !== teacherId) {
        const prevTeacher = state.teachers.find((t) => t.id === prevTeacherId);
        if (prevTeacher) {
          const prevAssignedSubjects = { ...(prevTeacher.assignedSubjects || {}) };
          const prevList = (prevAssignedSubjects[classId] || []).filter((s) => s.toLowerCase() !== cleanSubj.toLowerCase());
          if (prevList.length > 0) {
            prevAssignedSubjects[classId] = prevList;
          } else {
            delete prevAssignedSubjects[classId];
          }

          // Check if previous teacher still teaches another subject in this class OR is class teacher
          const stillInClass =
            prevTeacher.id === currentCls.teacherId ||
            prevTeacher.id === currentCls.classTeacherId ||
            Object.entries(currentSubjectTeachers).some(([s, tid]) => s !== cleanSubj && tid === prevTeacherId);

          let prevClassIds = Array.isArray(prevTeacher.assignedClassIds) ? [...prevTeacher.assignedClassIds] : [];
          if (!stillInClass) {
            prevClassIds = prevClassIds.filter((cid) => cid !== classId);
          }

          const prevTeacherAssignments = [];
          Object.entries(prevAssignedSubjects).forEach(([cid, sArr]) => {
            const cObj = state.classes.find((c) => c.id === cid);
            const cName = cObj ? `${cObj.name}${cObj.section ? ' - ' + cObj.section : ''}` : cid;
            (sArr || []).forEach((s) => {
              prevTeacherAssignments.push({ classId: cid, className: cName, subject: s });
            });
          });

          await firebaseService.updateDocument('teachers', prevTeacherId, {
            assignedClassIds: prevClassIds,
            assignedClassId: prevClassIds[0] || null,
            assignedSubjects: prevAssignedSubjects,
            subjectAssignments: prevTeacherAssignments
          });
        }
      }

      await notifySystemChange({
        title: `Subject Teacher Assigned: ${teacherName}`,
        content: `${teacherName} was assigned as teacher for ${cleanSubj} in Class ${clsName}.`,
        type: 'teacher',
        section: 'teachers',
        classId,
        className: `Class ${clsName}`
      });
    } catch (e) {
      console.error("Error assigning subject teacher in Firebase:", e);
      alert('Error assigning subject teacher: ' + e.message);
    }
  };

  const removeSubjectTeacher = async (classId, subjectName) => {
    if (!classId || !subjectName) return;
    const cleanSubj = String(subjectName).trim();
    const currentCls = state.classes.find((c) => c.id === classId);
    if (!currentCls) return;

    const currentSubjectTeachers = { ...(currentCls.subjectTeachers || {}) };
    const removedTeacherId = currentSubjectTeachers[cleanSubj];
    delete currentSubjectTeachers[cleanSubj];

    const allTeacherIds = new Set();
    if (currentCls.teacherId) allTeacherIds.add(currentCls.teacherId);
    if (currentCls.classTeacherId) allTeacherIds.add(currentCls.classTeacherId);
    Object.values(currentSubjectTeachers).forEach((tid) => {
      if (tid) allTeacherIds.add(tid);
    });
    const assignedTeacherIds = Array.from(allTeacherIds);

    const subjectTeacherAssignments = Object.entries(currentSubjectTeachers).map(([subj, tid]) => {
      const tc = state.teachers.find((t) => t.id === tid);
      return {
        subject: subj,
        teacherId: tid,
        teacherName: tc ? tc.name : 'Teacher',
        phone: tc ? tc.phone : '',
        role: tc ? tc.role : 'Subject Teacher'
      };
    });

    try {
      // Optimistically update local state immediately for instant UI responsiveness
      setState((prev) => ({
        ...prev,
        classes: (prev.classes || []).map((cls) => {
          if (cls.id !== classId) return cls;
          return {
            ...cls,
            subjectTeachers: currentSubjectTeachers,
            subjectTeacherAssignments,
            assignedTeacherIds,
            teacherIds: assignedTeacherIds
          };
        })
      }));

      await firebaseService.updateDocument('classes', classId, {
        subjectTeachers: currentSubjectTeachers,
        subjectTeacherAssignments,
        assignedTeacherIds,
        teacherIds: assignedTeacherIds
      });

      if (removedTeacherId) {
        const teacher = state.teachers.find((t) => t.id === removedTeacherId);
        if (teacher) {
          const curAssignedSubjects = { ...(teacher.assignedSubjects || {}) };
          const remainingSubs = (curAssignedSubjects[classId] || []).filter((s) => s.toLowerCase() !== cleanSubj.toLowerCase());
          if (remainingSubs.length > 0) {
            curAssignedSubjects[classId] = remainingSubs;
          } else {
            delete curAssignedSubjects[classId];
          }

          const stillInClass =
            teacher.id === currentCls.teacherId ||
            teacher.id === currentCls.classTeacherId ||
            Object.values(currentSubjectTeachers).includes(removedTeacherId);

          let classIds = Array.isArray(teacher.assignedClassIds) ? [...teacher.assignedClassIds] : [];
          if (!stillInClass) {
            classIds = classIds.filter((cid) => cid !== classId);
          }

          const teacherAssignments = [];
          Object.entries(curAssignedSubjects).forEach(([cid, sArr]) => {
            const cObj = state.classes.find((c) => c.id === cid);
            const cName = cObj ? `${cObj.name}${cObj.section ? ' - ' + cObj.section : ''}` : cid;
            (sArr || []).forEach((s) => {
              teacherAssignments.push({ classId: cid, className: cName, subject: s });
            });
          });

          await firebaseService.updateDocument('teachers', removedTeacherId, {
            assignedClassIds: classIds,
            assignedClassId: classIds[0] || null,
            assignedSubjects: curAssignedSubjects,
            subjectAssignments: teacherAssignments
          });
        }
      }

      const clsName = `${currentCls.name}${currentCls.section ? ' - ' + currentCls.section : ''}`;
      await notifySystemChange({
        title: `Subject Teacher Removed`,
        content: `Teacher assignment removed for "${cleanSubj}" in Class ${clsName}.`,
        type: 'teacher',
        section: 'teachers',
        classId,
        className: `Class ${clsName}`
      });
    } catch (e) {
      console.error("Error removing subject teacher in Firebase:", e);
    }
  };

  const addClassSubject = async (classId, subjectName) => {
    if (!classId || !subjectName || !subjectName.trim()) return;
    const cleanSubj = subjectName.trim();
    const targetClass = state.classes.find((c) => c.id === classId);
    const existing = Array.isArray(targetClass?.subjects) ? targetClass.subjects : [];
    if (existing.some((s) => s.toLowerCase() === cleanSubj.toLowerCase())) return;

    const updated = [...existing, cleanSubj];
    try {
      await firebaseService.updateDocument('classes', classId, {
        subjects: updated,
        subject: targetClass?.subject || updated[0] || null
      });
      await notifySystemChange({
        title: `Subject Added: ${cleanSubj}`,
        content: `Subject "${cleanSubj}" was added to Class ${targetClass ? targetClass.name : ''} curriculum.`,
        type: 'class',
        section: 'classes'
      });
    } catch (e) {
      console.error("Error adding class subject to Firebase:", e);
    }
  };

  const removeClassSubject = async (classId, subjectName) => {
    if (!classId || !subjectName) return;
    const targetClass = state.classes.find((c) => c.id === classId);
    const existing = Array.isArray(targetClass?.subjects) ? targetClass.subjects : [];
    const updated = existing.filter((s) => s.toLowerCase() !== subjectName.toLowerCase());

    // Also remove subject teacher assignment if any
    if (targetClass?.subjectTeachers && targetClass.subjectTeachers[subjectName]) {
      await removeSubjectTeacher(classId, subjectName);
    }

    try {
      await firebaseService.updateDocument('classes', classId, {
        subjects: updated,
        subject: updated.length > 0 ? (targetClass?.subject && updated.includes(targetClass.subject) ? targetClass.subject : updated[0]) : null
      });
    } catch (e) {
      console.error("Error removing class subject from Firebase:", e);
    }
  };

  const addStudent = async (data) => {
    if (!data.name || !data.classId) return;
    const cleanPhone = data.parentPhone ? data.parentPhone.trim().replace(/\s+/g, '') : '';
    const cleanRoll = data.rollNo ? String(data.rollNo).trim() : '101';

    if (cleanRoll && state.students.some((s) => s.classId === data.classId && String(s.rollNo).trim().toLowerCase() === cleanRoll.toLowerCase())) {
      alert(`Roll number "${cleanRoll}" is already taken in this class!`);
      return;
    }

    const isExactStudentDuplicate = state.students.some(
      (s) => s.classId === data.classId &&
             s.name.trim().toLowerCase() === data.name.trim().toLowerCase() &&
             String(s.rollNo).trim() === cleanRoll
    );
    if (isExactStudentDuplicate) {
      alert(`Student "${data.name.trim()}" (Roll: ${cleanRoll}) is already registered in this class!`);
      return;
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const newStudent = {
      rollNo: cleanRoll || '101',
      name: data.name.trim(),
      classId: data.classId,
      parentName: data.parentName ? data.parentName.trim() : 'Parent',
      parentPhone: cleanPhone,
      attendanceStatus: 'Not Marked',
      attendanceDate: ''
    };

    try {
      const docId = await firebaseService.addDocument('students', newStudent);

      const cls = state.classes.find((c) => c.id === data.classId);
      const clsName = cls ? `Class ${cls.name}-${cls.section}` : 'Class';

      await notifySystemChange({
        title: `New Student Enrolled: ${newStudent.name} (Roll: ${newStudent.rollNo})`,
        content: `${newStudent.name} (Roll No: ${newStudent.rollNo}) has been registered in ${clsName}. Parent: ${newStudent.parentName} (${cleanPhone || 'No Phone'}).`,
        type: 'student',
        section: 'students',
        studentId: docId,
        studentName: newStudent.name,
        parentPhone: cleanPhone,
        classId: data.classId,
        className: clsName,
        targetRole: cleanPhone ? 'Selected Parent' : 'All'
      });
    } catch (e) {
      console.error("Error adding student:", e);
    }
    closeModal();
  };

  const updateStudent = async (id, data) => {
    if (!id || !data.name) return false;
    const cleanPhone = data.parentPhone ? data.parentPhone.trim().replace(/\s+/g, '') : '';
    const cleanRoll = data.rollNo ? String(data.rollNo).trim() : '101';

    const isDuplicateRoll = state.students.some(
      (s) => s.id !== id && s.classId === data.classId && String(s.rollNo).trim().toLowerCase() === cleanRoll.toLowerCase()
    );
    if (isDuplicateRoll) {
      alert(`Roll number "${cleanRoll}" is already taken in this class!`);
      return false;
    }

    const updatedStudent = {
      rollNo: cleanRoll,
      name: data.name.trim(),
      classId: data.classId,
      parentName: data.parentName ? data.parentName.trim() : 'Parent',
      parentPhone: cleanPhone,
      updatedAt: new Date().toISOString()
    };

    try {
      await firebaseService.updateDocument('students', id, updatedStudent);
      const cls = state.classes.find((c) => c.id === data.classId);
      const clsName = cls ? `Class ${cls.name}-${cls.section}` : 'Class';

      await notifySystemChange({
        title: `Student Updated: ${updatedStudent.name}`,
        content: `Student details for ${updatedStudent.name} (Roll: ${cleanRoll}, ${clsName}) were updated.`,
        type: 'student',
        section: 'students',
        studentId: id,
        studentName: updatedStudent.name,
        parentPhone: cleanPhone,
        classId: data.classId,
        className: clsName,
        targetRole: 'Admin'
      });
      return true;
    } catch (e) {
      console.error("Error updating student in Firebase:", e);
      alert('Error updating student: ' + (e.message || String(e)));
      return false;
    }
  };

  const updateStudentAttendance = async (studentId, status, targetDate, subject = 'General') => {
    if (!studentId) return;
    const now = new Date();
    const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const effectiveDate = targetDate ? String(targetDate).trim().split('T')[0] : todayDate;
    const normStatus = String(status || '').trim().toLowerCase();
    const capStatus = normStatus === 'absent' ? 'Absent' : normStatus === 'present' ? 'Present' : 'Not Marked';
    const effectiveSubject = (subject && String(subject).trim() && String(subject).trim() !== 'all') ? String(subject).trim() : 'General';
    const cleanSubjectKey = effectiveSubject.replace(/[^a-zA-Z0-9]/g, '_');

    try {
      // 1. Update students collection document if marking for today
      if (effectiveDate === todayDate && effectiveSubject === 'General') {
        await firebaseService.updateDocument('students', studentId, {
          attendanceStatus: capStatus,
          attendanceDate: capStatus === 'Not Marked' ? '' : todayDate
        });
      }

      const student = state.students.find(s => s.id === studentId);
      const attDocId = `att_${effectiveDate}_${cleanSubjectKey}_${studentId}`;

      if (capStatus === 'Not Marked') {
        try {
          await firebaseService.deleteDocument('attendance', attDocId);
          const studentRecs = (state.attendance || []).filter(
            a => (a.studentId === studentId || (student?.rollNo && a.studentId === student.rollNo)) &&
                 String(a.date || a.attendanceDate || '').trim().split('T')[0] === effectiveDate &&
                 (String(a.subject || 'General').toLowerCase() === effectiveSubject.toLowerCase())
          );
          for (const rec of studentRecs) {
            if (rec.id && rec.id !== attDocId) {
              await firebaseService.deleteDocument('attendance', rec.id);
            }
          }
        } catch (err) {
          // Document may not exist, safe to ignore
        }
      } else {
        // 2. Set/merge to attendance collection in Android mobile format (att_YYYY-MM-DD_Subject_studentId)
        await firebaseService.setDocument('attendance', attDocId, {
          id: attDocId,
          studentId: studentId,
          studentName: student ? student.name : '',
          rollNo: student ? student.rollNo : '',
          classId: student ? student.classId : '',
          status: normStatus, // 'present' or 'absent'
          date: effectiveDate,
          subject: effectiveSubject,
          remarks: '',
          recordedAt: new Date().toISOString()
        }, true);

        // 3. Dispatch real-time attendance notification only for marked Present or Absent
        const isAbsent = normStatus === 'absent';
        const subjectLabel = effectiveSubject !== 'General' ? `${effectiveSubject} Lecture` : 'Daily';
        await notifySystemChange({
          title: `Attendance Alert: ${student ? student.name : 'Student'} (${capStatus} - ${subjectLabel})`,
          content: `Attendance for ${student ? student.name : 'student'} (Roll: ${student ? student.rollNo : 'N/A'}) was marked as ${capStatus.toUpperCase()} in ${subjectLabel} on ${effectiveDate}.`,
          type: 'attendance',
          section: 'attendance',
          priority: isAbsent ? 'High' : 'Normal',
          studentId,
          studentName: student ? student.name : '',
          parentPhone: student ? student.parentPhone : '',
          classId: student ? student.classId : '',
          targetRole: student?.parentPhone ? 'Selected Parent' : 'All'
        });
      }
    } catch (e) {
      console.error("Error updating student attendance:", e);
    }
  };

  const updateStudentClass = async (studentId, newClassId) => {
    if (!studentId || !newClassId) return;
    try {
      await firebaseService.updateDocument('students', studentId, { classId: newClassId });
      const student = state.students.find(s => s.id === studentId);
      const newCls = state.classes.find(c => c.id === newClassId);
      const clsName = newCls ? `Class ${newCls.name}-${newCls.section}` : 'New Class';

      await notifySystemChange({
        title: `Student Class Changed: ${student ? student.name : 'Student'}`,
        content: `${student ? student.name : 'Student'} (Roll No: ${student ? student.rollNo : 'N/A'}) has been reassigned to ${clsName}.`,
        type: 'student',
        section: 'students',
        studentId,
        studentName: student ? student.name : '',
        parentPhone: student ? student.parentPhone : '',
        classId: newClassId,
        className: clsName,
        targetRole: student?.parentPhone ? 'Selected Parent' : 'All'
      });
    } catch (e) {
      console.error("Error updating student class in Firebase:", e);
    }
  };

  const sendDailyAttendanceToParent = async ({ student, status, date }) => {
    if (!student) return { success: false, status: 'Failed', reason: 'Student not found' };
    const cleanPhone = (student.parentPhone || student.phone || '').replace(/\s+/g, '');
    if (!cleanPhone) {
      return { success: false, status: 'Parent Contact Not Available' };
    }

    const cls = state.classes.find((c) => c.id === student.classId);
    let clsName = 'Class';
    let divName = '-';
    if (cls) {
      clsName = cls.name || 'Class';
      divName = cls.section || (cls.name?.match(/[0-9]+\s*([A-Za-z]+)/)?.[1]) || '-';
    }

    const now = new Date();
    const formattedDate = date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const statusUpper = String(status || 'Present').trim().toUpperCase();

    const message = `Dear Parent,\nYour child ${student.name} was marked ${statusUpper} on ${formattedDate}.\nClass: ${clsName}\nDivision: ${divName}\nThank you.`;

    let webhookDispatched = false;
    let webhookError = null;

    try {
      const webhookConfig = await getWebhookConfig();
      if (webhookConfig?.dailyAttendanceUrl && webhookConfig.dailyAttendanceUrl.trim()) {
        try {
          const studentPayload = {
            ...student,
            className: clsName,
            division: divName,
            status: statusUpper === 'ABSENT' ? 'Absent' : 'Present',
            date: formattedDate
          };
          await dispatchSmartWebhook({
            targetUrl: webhookConfig.dailyAttendanceUrl.trim(),
            secretToken: webhookConfig.secretToken || '',
            scope: 'single',
            student: studentPayload,
            schoolProfile: state.schoolProfile || {},
            date: formattedDate,
            eventType: 'daily_attendance'
          });
          webhookDispatched = true;
        } catch (wErr) {
          console.error("WhatsApp webhook dispatch failed:", wErr);
          webhookError = wErr.message || String(wErr);
        }
      }
    } catch (cfgErr) {
      console.warn("Could not read webhook config:", cfgErr);
    }

    try {
      await notifySystemChange({
        title: `Attendance Alert: ${student.name} (${statusUpper})`,
        content: message,
        type: 'attendance',
        section: 'attendance',
        priority: statusUpper === 'ABSENT' ? 'High' : 'Normal',
        studentId: student.id,
        studentName: student.name,
        parentPhone: cleanPhone,
        classId: student.classId,
        className: clsName,
        targetRole: 'Selected Parent'
      });
    } catch (notifErr) {
      console.warn("Internal system notification note:", notifErr);
    }

    if (webhookError) {
      return { success: false, status: 'Failed', error: `WhatsApp delivery failed: ${webhookError}` };
    }

    return { 
      success: true, 
      status: 'Sent Successfully',
      webhookDispatched
    };
  };

  const sendBulkDailyAttendanceToParents = async (targets = []) => {
    let sentCount = 0;
    let missingCount = 0;
    let failedCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const item = targets[i];
      try {
        const res = await sendDailyAttendanceToParent(item);
        if (res.status === 'Sent Successfully') {
          sentCount++;
        } else if (res.status === 'Parent Contact Not Available') {
          missingCount++;
        } else {
          failedCount++;
        }
      } catch (err) {
        console.error("Error sending bulk daily attendance:", err);
        failedCount++;
      }
      // Small throttle between requests to prevent WhatsApp gateway rate limiting
      if (i < targets.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    return { total: targets.length, sentCount, missingCount, failedCount };
  };

  const sendMonthlyAttendanceToParent = async ({
    student,
    month,
    year,
    academicYear,
    stats,
    message
  }) => {
    if (!student) return { success: false, reason: 'Student not found' };

    const now = new Date();
    const timestamp = now.toISOString();
    const docId = `mah_${student.id}_${month}_${year}_${now.getTime()}`;
    const cleanPhone = (student.parentPhone || '').replace(/\s+/g, '');
    const hasPhone = Boolean(cleanPhone);

    const historyRecord = {
      id: docId,
      studentId: student.id,
      studentName: student.name || 'Student',
      rollNo: student.rollNo || '',
      classId: student.classId || '',
      className: stats.classDisplay || '',
      parentName: student.parentName || 'Parent',
      parentPhone: cleanPhone,
      month,
      year: Number(year) || now.getFullYear(),
      academicYear: academicYear || '2026-2027',
      totalWorkingDays: stats.totalWorkingDays,
      presentDays: stats.presentDays,
      absentDays: stats.absentDays,
      attendancePercentage: stats.percentage,
      message,
      status: hasPhone ? 'Sent Successfully' : 'Contact Number Missing',
      sentAt: timestamp,
      dateStr: now.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    };

    let webhookDispatched = false;
    let webhookError = null;

    try {
      // 1. Log into monthly_attendance_history collection in Firestore
      await firebaseService.setDocument('monthly_attendance_history', docId, historyRecord, true);

      // 2. Dispatch external webhook if configured
      if (hasPhone) {
        try {
          const webhookConfig = await getWebhookConfig();
          const activeMonthly = getActiveWebhookForCategory('monthly');
          const targetMonthlyUrl = activeMonthly?.url || webhookConfig?.monthlyAttendanceUrl || OFFICIAL_MONTHLY_WEBHOOK_URL;

          if (targetMonthlyUrl && targetMonthlyUrl.trim()) {
            await dispatchSmartWebhook({
              targetUrl: targetMonthlyUrl.trim(),
              secretToken: activeMonthly?.secretToken || webhookConfig?.secretToken || '',
              scope: 'single',
              student: {
                ...student,
                className: stats.classDisplay || '',
                division: student.division || '-',
                totalWorkingDays: stats.totalWorkingDays,
                presentDays: stats.presentDays,
                absentDays: stats.absentDays,
                attendancePercentage: stats.percentage,
                month,
                year,
                status: 'Present'
              },
              schoolProfile: state.schoolProfile || {},
              eventType: 'monthly_attendance'
            });
            webhookDispatched = true;
          }
        } catch (wErr) {
          console.error("Monthly webhook dispatch failed:", wErr);
          webhookError = wErr.message || String(wErr);
        }

        // 3. Dispatch system notification for parents
        try {
          await notifySystemChange({
            title: `Monthly Attendance Summary: ${student.name} (${month} ${year})`,
            content: message,
            type: 'attendance',
            section: 'attendance',
            priority: stats.percentage < 60 ? 'High' : 'Normal',
            studentId: student.id,
            studentName: student.name,
            parentPhone: cleanPhone,
            classId: student.classId,
            className: stats.classDisplay,
            targetRole: 'Selected Parent'
          });
        } catch (notifErr) {
          console.warn("Internal monthly notification note:", notifErr);
        }
      }

      return {
        success: hasPhone,
        status: historyRecord.status,
        docId,
        webhookDispatched,
        webhookError
      };
    } catch (e) {
      console.error("Error sending monthly attendance to parent:", e);
      try {
        await firebaseService.setDocument('monthly_attendance_history', docId, {
          ...historyRecord,
          status: 'Failed',
          error: e.message || String(e)
        }, true);
      } catch (_) {}
      throw e;
    }
  };

  const sendBulkMonthlyAttendanceToParents = async (targets = []) => {
    let sentCount = 0;
    let missingCount = 0;
    let failedCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const item = targets[i];
      try {
        const res = await sendMonthlyAttendanceToParent(item);
        if (res.status === 'Sent Successfully') {
          sentCount++;
        } else if (res.status === 'Contact Number Missing') {
          missingCount++;
        }
      } catch (err) {
        console.error("Error sending bulk item:", err);
        failedCount++;
      }
      if (i < targets.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    return { total: targets.length, sentCount, missingCount, failedCount };
  };

  const sendWeeklyAttendanceToParent = async ({
    student,
    startDate,
    endDate,
    stats,
    message
  }) => {
    if (!student) return { success: false, reason: 'Student not found' };

    const now = new Date();
    const timestamp = now.toISOString();
    const docId = `wah_${student.id}_${now.getTime()}`;
    const cleanPhone = (student.parentPhone || '').replace(/\s+/g, '');
    const hasPhone = Boolean(cleanPhone);

    const historyRecord = {
      id: docId,
      studentId: student.id,
      studentName: student.name || 'Student',
      rollNo: student.rollNo || '',
      classId: student.classId || '',
      className: stats.classDisplay || '',
      parentName: student.parentName || 'Parent',
      parentPhone: cleanPhone,
      startDate,
      endDate,
      totalWorkingDays: stats.workingDaysSoFar || stats.totalWorkingDays || 6,
      presentDays: stats.presentDays,
      absentDays: stats.absentDays,
      attendancePercentage: stats.percentage,
      message,
      status: hasPhone ? 'Sent Successfully' : 'Contact Number Missing',
      sentAt: timestamp,
      dateStr: now.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    };

    try {
      await firebaseService.setDocument('weekly_attendance_history', docId, historyRecord, true);

      if (hasPhone) {
        await notifySystemChange({
          title: `Weekly Attendance Summary: ${student.name}`,
          content: message,
          type: 'attendance',
          section: 'attendance',
          priority: stats.percentage < 60 ? 'High' : 'Normal',
          studentId: student.id,
          studentName: student.name,
          parentPhone: cleanPhone,
          classId: student.classId,
          className: stats.classDisplay,
          targetRole: 'Selected Parent'
        });
      }

      return {
        success: hasPhone,
        status: historyRecord.status,
        docId
      };
    } catch (e) {
      console.error("Error sending weekly attendance to parent:", e);
      try {
        await firebaseService.setDocument('weekly_attendance_history', docId, {
          ...historyRecord,
          status: 'Failed',
          error: e.message || String(e)
        }, true);
      } catch (_) {}
      throw e;
    }
  };

  const sendBulkWeeklyAttendanceToParents = async (targets = []) => {
    let sentCount = 0;
    let missingCount = 0;
    let failedCount = 0;

    for (const item of targets) {
      try {
        const res = await sendWeeklyAttendanceToParent(item);
        if (res.status === 'Sent Successfully') {
          sentCount++;
        } else if (res.status === 'Contact Number Missing') {
          missingCount++;
        }
      } catch (err) {
        console.error("Error sending bulk weekly item:", err);
        failedCount++;
      }
    }

    return { total: targets.length, sentCount, missingCount, failedCount };
  };

  const deleteStudent = async (id) => {
    if (!id) return;
    const student = state.students.find((s) => s.id === id);
    const sName = student ? student.name : 'Student';
    if (!window.confirm(`Are you sure you want to permanently delete student "${sName}" from Firebase?`)) return;

    try {
      await firebaseService.deleteDocument('students', id);

      // Clean up linked attendance records
      const linkedAtt = (state.attendance || []).filter((a) => a.studentId === id || (student?.rollNo && a.studentId === student.rollNo));
      for (const att of linkedAtt) {
        if (att.id) await firebaseService.deleteDocument('attendance', att.id).catch(() => {});
      }

      // Clean up linked marks
      const linkedMarks = (state.marks || []).filter((m) => m.studentId === id);
      for (const m of linkedMarks) {
        if (m.id) await firebaseService.deleteDocument('marks', m.id).catch(() => {});
      }

      // Clean up linked exam results
      const linkedResults = (state.examResults || []).filter((r) => r.studentId === id || (r.id && r.id.endsWith(`_${id}`)));
      for (const r of linkedResults) {
        if (r.id) await firebaseService.deleteDocument('exam_results', r.id).catch(() => {});
      }

      await notifySystemChange({
        title: `Student Record Deleted: ${sName}`,
        content: `Student ${sName} (Roll No: ${student ? student.rollNo : 'N/A'}) was removed from the school registry.`,
        type: 'student',
        section: 'students',
        priority: 'High'
      });
    } catch (e) {
      console.error("Error deleting student from Firebase:", e);
    }
  };

  const addExam = async (data) => {
    if (!data.title || !data.classId) return;
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const examDate = data.date || today;
    const examDocId = `e_${Date.now()}`;
    const cleanTitle = data.title.trim();
    const cleanSubj = data.subject ? data.subject.trim() : 'General';
    const max = Number(data.maxMarks) || 100;
    const pass = Number(data.passMarks) || 35;

    const cls = state.classes.find((c) => c.id === data.classId);
    const clsName = cls ? `Class ${cls.name}-${cls.section}` : (data.classId === 'all' ? 'All Classes' : 'Class');

    // 1. Resolve assigned teacher
    let teacher = null;
    if (data.teacherId) {
      teacher = state.teachers.find(t => t.id === data.teacherId);
    }
    if (!teacher && cls) {
      // Find teacher assigned to this subject in class.subjectTeachers
      const tid = cls.subjectTeachers?.[cleanSubj];
      if (tid) {
        teacher = state.teachers.find(t => t.id === tid);
      }
    }
    if (!teacher) {
      // Find teacher assigned to this class whose subject matches cleanSubj
      teacher = state.teachers.find(t =>
        (t.assignedClassIds?.includes(data.classId) || t.assignedClassId === data.classId || cls?.assignedTeacherIds?.includes(t.id)) &&
        t.subject?.toLowerCase() === cleanSubj.toLowerCase()
      );
    }
    if (!teacher && cleanSubj && cleanSubj.toLowerCase() !== 'general') {
      // Find any teacher whose profile subject matches
      teacher = state.teachers.find(t => t.subject?.toLowerCase() === cleanSubj.toLowerCase());
    }

    const teacherId = teacher ? teacher.id : (data.teacherId || '');
    const teacherName = teacher ? teacher.name : '';

    const newExam = {
      id: examDocId,
      title: cleanTitle,
      examTitle: cleanTitle,
      exam_title: cleanTitle,
      classId: data.classId,
      class_id: data.classId,
      className: clsName,
      subject: cleanSubj,
      subject_name: cleanSubj,
      teacherId: teacherId,
      teacher_id: teacherId,
      teacherName: teacherName,
      teacher_name: teacherName,
      assignedTeacherId: teacherId,
      assignedTeacherIds: teacherId ? [teacherId] : [],
      maxMarks: max,
      max_marks: max,
      passMarks: pass,
      pass_marks: pass,
      date: examDate,
      isPublished: true,
      createdAt: now.toISOString()
    };

    try {
      await firebaseService.setDocument('exams', examDocId, newExam);

      // Auto-update class subjects and assignments in Firestore & local state
      if (cls && cleanSubj && cleanSubj.toLowerCase() !== 'general') {
        const existingSubs = Array.isArray(cls.subjects) ? [...cls.subjects] : [];
        const hasSub = existingSubs.some(s => s.toLowerCase() === cleanSubj.toLowerCase());
        const updatedSubs = hasSub ? existingSubs : [...existingSubs, cleanSubj];

        const updatedSubjectTeachers = { ...(cls.subjectTeachers || {}) };
        if (teacherId && !updatedSubjectTeachers[cleanSubj]) {
          updatedSubjectTeachers[cleanSubj] = teacherId;
        }

        const allTeacherIds = new Set(cls.assignedTeacherIds || []);
        if (teacherId) allTeacherIds.add(teacherId);

        const classUpdatePayload = {
          subjects: updatedSubs,
          subjectTeachers: updatedSubjectTeachers,
          assignedTeacherIds: Array.from(allTeacherIds),
          teacherIds: Array.from(allTeacherIds)
        };

        await firebaseService.updateDocument('classes', data.classId, classUpdatePayload);

        // Optimistically update local classes state
        setState(prev => ({
          ...prev,
          classes: (prev.classes || []).map(c => c.id === data.classId ? { ...c, ...classUpdatePayload } : c)
        }));
      }

      // Auto-update teacher assigned subjects and classes in Firestore & local state
      if (teacher && data.classId) {
        const curClassIds = Array.isArray(teacher.assignedClassIds) ? [...teacher.assignedClassIds] : (teacher.assignedClassId ? [teacher.assignedClassId] : []);
        if (!curClassIds.includes(data.classId)) curClassIds.push(data.classId);

        const curAssignedSubjects = { ...(teacher.assignedSubjects || {}) };
        const subList = Array.from(new Set([...(curAssignedSubjects[data.classId] || []), cleanSubj]));
        curAssignedSubjects[data.classId] = subList;

        const teacherUpdatePayload = {
          assignedClassIds: curClassIds,
          assignedClassId: curClassIds[0] || data.classId,
          assignedSubjects: curAssignedSubjects
        };

        await firebaseService.updateDocument('teachers', teacher.id, teacherUpdatePayload);

        // Optimistically update local teachers state
        setState(prev => ({
          ...prev,
          teachers: (prev.teachers || []).map(t => t.id === teacher.id ? { ...t, ...teacherUpdatePayload } : t)
        }));
      }

      await notifySystemChange({
        title: `New Exam Scheduled: ${newExam.title}`,
        content: `An exam titled '${newExam.title}' (${newExam.subject}, Max Marks: ${newExam.maxMarks}) has been scheduled for ${clsName} (Date: ${examDate}).`,
        type: 'exam',
        section: 'exams',
        classId: data.classId,
        className: clsName,
        targetRole: 'All'
      });
    } catch (e) {
      console.error("Error adding exam:", e);
    }
    closeModal();
    // Auto-navigate to Marks tab for this new exam so user can enter marks immediately
    navigateToExamMarks(examDocId, data.classId);
  };

  // Compute unified marks combining 'marks' (web) and 'exam_results' (Android) in real time
  const unifiedMarks = React.useMemo(() => {
    return unifyMarksAndResults(state.marks, state.examResults, state.exams, state.students, state.classes);
  }, [state.marks, state.examResults, state.exams, state.students, state.classes]);

  const stateWithMarks = React.useMemo(() => ({
    ...state,
    marks: unifiedMarks
  }), [state, unifiedMarks]);

  // Real-time two-way sync: Ensure any marks updated from Android (exam_results / multi-subject) are persisted to Firestore 'marks' collection
  useEffect(() => {
    if (!unifiedMarks || unifiedMarks.length === 0) return;

    unifiedMarks.forEach(async (um) => {
      const existingInFb = state.marks.find(
        (m) => m.id === um.id || ((m.studentId === um.studentId || m.student_id === um.studentId) && (m.examId === um.examId || m.exam_id === um.examId))
      );
      const existingMarks = existingInFb?.marks || {};
      const unifiedMarksMap = um.marks || {};

      const existingKeys = Object.keys(existingMarks).sort().join(',');
      const unifiedKeys = Object.keys(unifiedMarksMap).sort().join(',');
      const isMissingSubjects = existingKeys !== unifiedKeys;
      const isTotalDifferent = Number(existingInFb?.total) !== Number(um.total);

      if (!existingInFb || isMissingSubjects || isTotalDifferent) {
        try {
          const docId = um.id || `m_${um.studentId}_${um.examId}`;
          await firebaseService.setDocument('marks', docId, {
            ...um,
            id: docId,
            updatedAt: new Date().toISOString()
          }, true);
        } catch (err) {
          console.warn('Auto-sync unified marks to Firestore failed:', err);
        }
      }
    });
  }, [unifiedMarks, state.marks]);

  const deleteExam = async (id) => {
    if (!id) return;
    const exam = state.exams.find((e) => e.id === id);
    const examName = exam?.title || 'Exam';

    // Count how many marks are linked to this exam (using unified real-time marks)
    const linkedMarks = (unifiedMarks || []).filter(
      (m) =>
        m.examId === id ||
        (exam && (m.examTitle === exam.title || m.examId === exam.title)) ||
        (m.id && m.id.endsWith(`_${id}`))
    );

    const confirmMsg = linkedMarks.length > 0
      ? `Are you sure you want to permanently delete exam "${examName}" AND all ${linkedMarks.length} student marks recorded for it? (हा पेपर आणि त्याचे सर्व विद्यार्थ्यांचे मार्क्स कायमस्वरूपी डिलीट करायचे आहेत का?)`
      : `Are you sure you want to permanently delete exam "${examName}" from Firebase?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const result = await firebaseService.deleteExamAndMarks(id, exam?.title);
      await notifySystemChange({
        title: `Exam Cancelled: ${examName}`,
        content: `Examination schedule '${examName}' and ${result.marksDeletedCount} associated student mark records were permanently removed.`,
        type: 'exam',
        section: 'exams',
        priority: 'High',
        targetRole: 'All'
      });
      alert(`Exam "${examName}" and ${result.marksDeletedCount} associated student marks deleted successfully!`);
    } catch (e) {
      console.error("Error deleting exam and marks from Firebase:", e);
      alert("Failed to delete exam: " + (e.message || e.toString()));
    }
  };

  const addNotice = async (data) => {
    const isReportType = data.type === 'report' || (data.title && data.title.toLowerCase().includes('report'));
    const cleanPhone = (data.parentPhone || '').replace(/\s+/g, '');
    const newNotice = {
      title: data.title.trim(),
      content: data.content.trim(),
      message: data.content.trim(),
      priority: data.priority || 'Normal',
      targetRole: data.targetRole || 'All',
      author: data.author || state.schoolProfile.adminName || 'Admin',
      date: data.date || new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
      sentBy: data.sentBy || 'Admin',
      isRead: data.isRead !== undefined ? data.isRead : false,
      status: data.status || 'unread',
      readBy: data.readBy || [],
      parentId: data.parentId || cleanPhone || null,
      parentName: data.parentName || null,
      parentPhone: cleanPhone || null,
      studentId: data.studentId || null,
      studentName: data.studentName || null,
      rollNo: data.rollNo || '',
      classId: data.classId || null,
      className: data.className || null,
      attendance: data.attendance || '',
      totalScore: data.totalScore !== undefined ? data.totalScore : null,
      totalMax: data.totalMax !== undefined ? data.totalMax : null,
      percentage: data.percentage !== undefined ? data.percentage : null,
      grade: data.grade || '',
      academicResult: data.academicResult || '',
      schoolAuthority: data.schoolAuthority || '',
      type: isReportType ? 'report' : (data.type || 'notice'),
      isAlert: true,
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Save to 'notices' collection
      await firebaseService.addDocument('notices', newNotice);

      // 2. Also save to 'alerts' collection for Android Alerts stream
      const alertDocId = `alert_${newNotice.studentId || 'all'}_${Date.now()}`;
      await firebaseService.setDocument('alerts', alertDocId, {
        id: alertDocId,
        title: newNotice.title,
        message: newNotice.content,
        content: newNotice.content,
        parentPhone: cleanPhone,
        parentId: newNotice.parentId || cleanPhone,
        parentName: newNotice.parentName || '',
        studentId: newNotice.studentId || '',
        studentName: newNotice.studentName || '',
        rollNo: newNotice.rollNo || '',
        classId: newNotice.classId || '',
        className: newNotice.className || '',
        attendance: newNotice.attendance || '',
        totalScore: newNotice.totalScore,
        totalMax: newNotice.totalMax,
        percentage: newNotice.percentage,
        grade: newNotice.grade || '',
        academicResult: newNotice.academicResult || '',
        schoolAuthority: newNotice.schoolAuthority || '',
        type: newNotice.type,
        priority: newNotice.priority,
        isRead: false,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }, true);

      // 3. Also save to 'notifications' collection for legacy Android Notifications stream
      const notifDocId = `notif_${newNotice.type}_${newNotice.studentId || 'all'}_${Date.now()}`;
      await firebaseService.setDocument('notifications', notifDocId, {
        id: notifDocId,
        title: newNotice.title,
        message: newNotice.content,
        parentPhone: cleanPhone,
        parentId: newNotice.parentId || cleanPhone,
        parentName: newNotice.parentName || '',
        studentId: newNotice.studentId || '',
        studentName: newNotice.studentName || '',
        rollNo: newNotice.rollNo || '',
        classId: newNotice.classId || '',
        className: newNotice.className || '',
        attendance: newNotice.attendance || '',
        totalScore: newNotice.totalScore,
        totalMax: newNotice.totalMax,
        percentage: newNotice.percentage,
        grade: newNotice.grade || '',
        academicResult: newNotice.academicResult || '',
        schoolAuthority: newNotice.schoolAuthority || '',
        type: newNotice.type,
        isRead: false,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }, true);

      // 4. Save to 'reports' collection for Parent Report Cards
      if (isReportType) {
        const reportDocId = `report_${newNotice.studentId || 'all'}_${Date.now()}`;
        await firebaseService.setDocument('reports', reportDocId, {
          id: reportDocId,
          title: newNotice.title,
          content: newNotice.content,
          message: newNotice.content,
          parentPhone: cleanPhone,
          parentId: newNotice.parentId || cleanPhone,
          parentName: newNotice.parentName || '',
          studentId: newNotice.studentId || '',
          studentName: newNotice.studentName || '',
          rollNo: newNotice.rollNo || '',
          classId: newNotice.classId || '',
          className: newNotice.className || '',
          attendance: newNotice.attendance || '',
          totalScore: newNotice.totalScore,
          totalMax: newNotice.totalMax,
          percentage: newNotice.percentage,
          grade: newNotice.grade || '',
          academicResult: newNotice.academicResult || '',
          schoolAuthority: newNotice.schoolAuthority || '',
          type: 'report',
          priority: newNotice.priority || 'High',
          status: 'Delivered',
          isRead: false,
          createdAt: new Date().toISOString(),
          timestamp: new Date().toISOString()
        }, true);
      }
    } catch (e) {
      console.error("Error adding notice and alerts:", e);
      throw e;
    }
    closeModal();
  };

  const deleteNotice = async (id) => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to permanently delete this notice announcement from Firebase?')) return;

    try {
      await firebaseService.deleteDocument('notices', id);
    } catch (e) {
      console.error("Error deleting notice from Firebase:", e);
    }
  };

  const deleteSelectedNotices = async (ids = []) => {
    if (!ids || ids.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${ids.length} selected notice(s) from Firebase?`)) return;

    try {
      const promises = ids.map((id) => firebaseService.deleteDocument('notices', id));
      await Promise.all(promises);
    } catch (e) {
      console.error("Error deleting selected notices from Firebase:", e);
    }
  };

  const clearAllNotices = async (filterType = 'all') => {
    const list = state.notices || [];
    let targetNotices = list;
    if (filterType === 'individual') {
      targetNotices = list.filter((n) => n.targetRole === 'Selected Parent' || n.studentId || n.parentPhone);
    } else if (filterType === 'general') {
      targetNotices = list.filter((n) => n.targetRole !== 'Selected Parent' && !n.studentId && !n.parentPhone);
    }

    if (targetNotices.length === 0) return;

    const confirmMsg = filterType === 'all'
      ? `Are you sure you want to permanently clear all ${targetNotices.length} notices from Notice Board?`
      : `Are you sure you want to permanently clear all ${targetNotices.length} ${filterType} notices from Notice Board?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      if (filterType === 'all') {
        await firebaseService.clearCollectionDocuments('notices');
      } else {
        const promises = targetNotices.map((n) => firebaseService.deleteDocument('notices', n.id));
        await Promise.all(promises);
      }
    } catch (e) {
      console.error("Error clearing notices from Firebase:", e);
    }
  };

  const downloadBlankExcelTemplate = (category = 'students') => {
    if (category === 'teachers') {
      const templateData = [
        {
          '#': 1,
          'Teacher Full Name': 'Amit Verma',
          'Mobile Number (10 Digits) *': '9876543211',
          'Teaching Subject': 'Mathematics',
          'Role (Class Teacher / Subject Teacher)': 'Class Teacher',
          'Login Password': 'password123',
          'Assigned Classes': state.classes[0] ? `${state.classes[0].name}${state.classes[0].section ? ' - ' + state.classes[0].section : ''}` : 'Class 10 - A'
        },
        {
          '#': 2,
          'Teacher Full Name': 'Pooja Sharma',
          'Mobile Number (10 Digits) *': '9876543212',
          'Teaching Subject': 'Science',
          'Role (Class Teacher / Subject Teacher)': 'Subject Teacher',
          'Login Password': 'password123',
          'Assigned Classes': state.classes[0] ? `${state.classes[0].name}${state.classes[0].section ? ' - ' + state.classes[0].section : ''}` : 'Class 10 - A'
        }
      ];
      const ws = XLSX.utils.json_to_sheet(templateData);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 25 },
        { wch: 30 },
        { wch: 20 },
        { wch: 35 },
        { wch: 18 },
        { wch: 25 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Add Teachers Template');
      XLSX.writeFile(wb, `Teachers_Add_Template.xlsx`);
    } else {
      const defaultClsName = state.classes[0]
        ? `${state.classes[0].name}${state.classes[0].section ? ' - ' + state.classes[0].section : ''}`
        : 'Class 10 - A';
      const templateData = [
        {
          '#': 1,
          'Roll Number': '101',
          'Student Full Name': 'Rahul Sharma',
          'Class': defaultClsName,
          'Parent / Guardian Name': 'Rajesh Sharma',
          'Parent Mobile Number (10 Digits) *': '9876543210'
        },
        {
          '#': 2,
          'Roll Number': '102',
          'Student Full Name': 'Priya Patel',
          'Class': defaultClsName,
          'Parent / Guardian Name': 'Suresh Patel',
          'Parent Mobile Number (10 Digits) *': '9876543211'
        },
        {
          '#': 3,
          'Roll Number': '103',
          'Student Full Name': 'Aman Gupta',
          'Class': defaultClsName,
          'Parent / Guardian Name': 'Manoj Gupta',
          'Parent Mobile Number (10 Digits) *': '9876543212'
        }
      ];
      const ws = XLSX.utils.json_to_sheet(templateData);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 15 },
        { wch: 25 },
        { wch: 20 },
        { wch: 25 },
        { wch: 35 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Add Students Template');
      XLSX.writeFile(wb, `Students_Add_Template.xlsx`);
    }
  };

  const exportExcel = (attendanceMap = {}) => {
    const todayDate = new Date().toISOString().split('T')[0];
    const exportRows = [];

    (state.students || []).forEach((s) => {
      const cls = state.classes.find((c) => c.id === s.classId);
      let status = 'Not Marked';

      if (attendanceMap[s.id]) {
        status = attendanceMap[s.id];
      } else if (state.attendance && state.attendance.length > 0) {
        const records = state.attendance.filter(
          (a) => (a.studentId === s.id || a.studentId === s.rollNo) && (a.date === todayDate)
        );
        if (records.length > 0) {
          records.sort((a, b) => {
            const tA = a.recordedAt || a.createdAt || a.updatedAt || '';
            const tB = b.recordedAt || b.createdAt || b.updatedAt || '';
            return tB.localeCompare(tA);
          });
          const latest = records[0];
          if (latest && latest.status) {
            const raw = String(latest.status).trim().toLowerCase();
            status = raw === 'absent' ? 'Absent' : raw === 'present' ? 'Present' : 'Not Marked';
          }
        } else if (s.attendanceDate === todayDate && s.attendanceStatus) {
          const raw = String(s.attendanceStatus).trim().toLowerCase();
          status = raw === 'absent' ? 'Absent' : raw === 'present' ? 'Present' : 'Not Marked';
        }
      } else if (s.attendanceDate === todayDate && s.attendanceStatus) {
        const raw = String(s.attendanceStatus).trim().toLowerCase();
        status = raw === 'absent' ? 'Absent' : raw === 'present' ? 'Present' : 'Not Marked';
      }

      exportRows.push({
        'Roll No': s.rollNo || '',
        'Student Name': s.name || '',
        'Enrolled Class': cls ? (cls.section && cls.section.trim() ? `${cls.name} - ${cls.section}` : cls.name) : 'Unassigned',
        'Attendance Status': status,
        'Parent Name': s.parentName || '',
        'Parent Mobile Number': s.parentPhone || ''
      });
    });

    // If no students enrolled yet, provide blank template with headers and sample row for adding
    if (exportRows.length === 0) {
      exportRows.push({
        'Roll No': '101',
        'Student Name': 'Rahul Sharma (Sample - Replace with real student)',
        'Enrolled Class': state.classes[0] ? `${state.classes[0].name}${state.classes[0].section ? ' - ' + state.classes[0].section : ''}` : 'Class 10 - A',
        'Attendance Status': 'Present',
        'Parent Name': 'Rajesh Sharma',
        'Parent Mobile Number': '9876543210'
      });
    }

    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws['!cols'] = [
      { wch: 12 },
      { wch: 25 },
      { wch: 20 },
      { wch: 18 },
      { wch: 25 },
      { wch: 25 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Attendance');
    const safeSchoolName = (state.schoolProfile?.schoolName || 'School').replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(wb, `Student_Attendance_Report_${safeSchoolName}_${todayDate}.xlsx`);
  };

  const saveStudentMarks = async (marksRecord) => {
    try {
      const docId = marksRecord.id || `m_${marksRecord.studentId}_${marksRecord.examId}`;
      const { id, ...dataToSave } = marksRecord;
      // 1. Save to 'marks' collection (Web Admin / multi-subject format)
      await firebaseService.setDocument('marks', docId, { id: docId, ...dataToSave }, true);

      // 2. Also save/sync to 'exam_results' collection (Android mobile app format)
      if (marksRecord.examId && marksRecord.studentId) {
        const exam = state.exams.find((e) => e.id === marksRecord.examId);
        const marksEntries = Object.entries(marksRecord.marks || {});
        const resDocId = `res_${marksRecord.examId}_${marksRecord.studentId}`;
        const subj = (exam?.subject && exam.subject !== 'General') ? exam.subject : null;
        let score = marksRecord.total;
        if (subj && marksRecord.marks && marksRecord.marks[subj] !== undefined) {
          score = marksRecord.marks[subj];
        } else if (marksRecord.marks && Object.values(marksRecord.marks).length > 0) {
          score = Object.values(marksRecord.marks)[0];
        }

        // Aggregate doc
        await firebaseService.setDocument('exam_results', resDocId, {
          id: resDocId,
          examId: marksRecord.examId,
          exam_id: marksRecord.examId,
          examTitle: marksRecord.examTitle || exam?.title || 'Exam',
          exam_title: marksRecord.examTitle || exam?.title || 'Exam',
          studentId: marksRecord.studentId,
          student_id: marksRecord.studentId,
          studentName: marksRecord.studentName || '',
          student_name: marksRecord.studentName || '',
          rollNo: marksRecord.rollNo || '',
          roll_no: marksRecord.rollNo || '',
          classId: marksRecord.classId || exam?.classId || '',
          class_id: marksRecord.classId || exam?.classId || '',
          className: marksRecord.className || '',
          marksObtained: Number(score) || 0,
          marks_obtained: Number(score) || 0,
          marks: marksRecord.marks || {},
          total: Number(marksRecord.total) || 0,
          maxTotal: marksRecord.maxTotal || (marksEntries.length * (exam?.maxMarks || 100)),
          percentage: marksRecord.percentage,
          grade: marksRecord.grade,
          gradeLabel: marksRecord.gradeLabel,
          remarks: marksRecord.remarks || '',
          updatedAt: new Date().toISOString()
        }, true);

        // Individual subject documents for Android mobile app subject-level retrieval
        for (const [subjKey, subjScore] of marksEntries) {
          if (subjKey && subjKey.toLowerCase() !== 'general') {
            const cleanSubj = subjKey.trim().replace(/[^a-zA-Z0-9]/g, '_');
            const subjResId = `res_${marksRecord.examId}_${cleanSubj}_${marksRecord.studentId}`;
            await firebaseService.setDocument('exam_results', subjResId, {
              id: subjResId,
              examId: marksRecord.examId,
              exam_id: marksRecord.examId,
              examTitle: marksRecord.examTitle || exam?.title || 'Exam',
              exam_title: marksRecord.examTitle || exam?.title || 'Exam',
              studentId: marksRecord.studentId,
              student_id: marksRecord.studentId,
              studentName: marksRecord.studentName || '',
              student_name: marksRecord.studentName || '',
              rollNo: marksRecord.rollNo || '',
              roll_no: marksRecord.rollNo || '',
              classId: marksRecord.classId || exam?.classId || '',
              class_id: marksRecord.classId || exam?.classId || '',
              className: marksRecord.className || '',
              subject: subjKey.trim(),
              subject_name: subjKey.trim(),
              marksObtained: Number(subjScore) || 0,
              marks_obtained: Number(subjScore) || 0,
              marks: Number(subjScore) || 0,
              maxMarks: exam?.maxMarks || 100,
              remarks: marksRecord.remarks || '',
              updatedAt: new Date().toISOString()
            }, true);
          }
        }
      }

      // 3. Dispatch real-time marks notification
      const student = state.students.find((s) => s.id === marksRecord.studentId);
      const exam = state.exams.find((e) => e.id === marksRecord.examId);
      const examTitle = exam?.title || marksRecord.examTitle || 'Exam';
      const scoreStr = marksRecord.total !== undefined ? `${marksRecord.total} marks` : 'Updated';

      await notifySystemChange({
        title: `Marks Updated: ${student ? student.name : 'Student'} (${examTitle})`,
        content: `Examination marks for ${student ? student.name : 'Student'} (Roll: ${student ? student.rollNo : 'N/A'}) in '${examTitle}' were recorded/updated. Score: ${scoreStr}.`,
        type: 'marks',
        section: 'marks',
        studentId: marksRecord.studentId,
        studentName: student ? student.name : '',
        parentPhone: student ? student.parentPhone : '',
        classId: student ? student.classId : '',
        targetRole: student?.parentPhone ? 'Selected Parent' : 'All'
      });
    } catch (e) {
      console.error("Error saving student marks to Firebase:", e);
      throw e;
    }
  };

  const counts = {
    classes: state.classes.length,
    teachers: state.teachers.length,
    students: state.students.length,
    exams: state.exams.length,
    marks: unifiedMarks.length,
    notices: state.notices.length
  };

  if (viewMode === 'landing') {
    return (
      <LandingPage
        onOpenLogin={handleEnterFromLanding}
        schoolProfile={state.schoolProfile}
        isLoggedIn={Boolean(adminUser)}
        counts={counts}
      />
    );
  }

  if (viewMode === 'login' || !adminUser) {
    return (
      <AdminLogin
        onLoginSuccess={(user) => {
          setAdminUser(user);
          window.location.hash = 'dashboard';
          setViewMode('dashboard');
        }}
        schoolProfile={state.schoolProfile}
        onBackToLanding={handleBackToLanding}
      />
    );
  }

  return (
    <div className="admin-view-wrapper">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        counts={counts}
        schoolProfile={state.schoolProfile}
        openModal={openModal}
        onLogout={handleLogout}
      />

      <div id="main-content">
        <Header
          activeTab={activeTab}
          schoolProfile={state.schoolProfile}
          notifications={state.notifications}
          setActiveTab={setActiveTab}
          markNotificationAsRead={markNotificationAsRead}
          markAllNotificationsAsRead={markAllNotificationsAsRead}
          clearNotification={clearNotification}
          clearAllNotifications={clearAllNotifications}
          onLogout={handleLogout}
          onGoToLanding={handleBackToLanding}
        />

        <div className="content-viewport">
          <ErrorBoundary>
            {activeTab === 0 && <Overview state={stateWithMarks} setActiveTab={setActiveTab} openModal={openModal} openImportModal={openImportModal} />}
            {activeTab === 1 && (
              <ClassesTab
                state={state}
                deleteClass={deleteClass}
                updateClass={updateClass}
                assignTeacherClass={assignTeacherClass}
                assignSubjectTeacher={assignSubjectTeacher}
                removeSubjectTeacher={removeSubjectTeacher}
                addClassSubject={addClassSubject}
                removeClassSubject={removeClassSubject}
                openModal={openModal}
                openImportModal={openImportModal}
                setActiveTab={setActiveTab}
              />
            )}
            {activeTab === 2 && (
              <TeachersTab
                state={state}
                deleteTeacher={deleteTeacher}
                updateTeacher={updateTeacher}
                assignTeacherClass={assignTeacherClass}
                assignSubjectTeacher={assignSubjectTeacher}
                removeSubjectTeacher={removeSubjectTeacher}
                addClassSubject={addClassSubject}
                removeClassSubject={removeClassSubject}
                openModal={openModal}
                openImportModal={openImportModal}
                downloadBlankExcelTemplate={downloadBlankExcelTemplate}
                setActiveTab={setActiveTab}
              />
            )}
            {activeTab === 3 && (
              <StudentsTab
                state={state}
                deleteStudent={deleteStudent}
                updateStudent={updateStudent}
                openModal={openModal}
                exportExcel={exportExcel}
                downloadBlankExcelTemplate={downloadBlankExcelTemplate}
                updateStudentAttendance={updateStudentAttendance}
                updateStudentClass={updateStudentClass}
                openImportModal={openImportModal}
                sendDailyAttendanceToParent={sendDailyAttendanceToParent}
                sendBulkDailyAttendanceToParents={sendBulkDailyAttendanceToParents}
                sendMonthlyAttendanceToParent={sendMonthlyAttendanceToParent}
                sendBulkMonthlyAttendanceToParents={sendBulkMonthlyAttendanceToParents}
                sendWeeklyAttendanceToParent={sendWeeklyAttendanceToParent}
                sendBulkWeeklyAttendanceToParents={sendBulkWeeklyAttendanceToParents}
                triggerWebhookDispatch={triggerWebhookDispatch}
                openWebhookSettings={openWebhookSettings}
              />
            )}
            {activeTab === 4 && (
              <ExamsTab
                state={stateWithMarks}
                deleteExam={deleteExam}
                openModal={openModal}
                setActiveTab={setActiveTab}
                navigateToExamMarks={navigateToExamMarks}
              />
            )}
            {activeTab === 5 && (
              <MarksTab
                state={stateWithMarks}
                saveStudentMarks={saveStudentMarks}
                deleteExam={deleteExam}
                addClassSubject={addClassSubject}
                openModal={openModal}
                setActiveTab={setActiveTab}
                targetExamForMarks={targetExamForMarks}
                triggerWebhookDispatch={triggerWebhookDispatch}
                openWebhookSettings={openWebhookSettings}
              />
            )}
            {activeTab === 6 && (
              <NoticesTab
                state={state}
                deleteNotice={deleteNotice}
                deleteSelectedNotices={deleteSelectedNotices}
                clearAllNotices={clearAllNotices}
                openModal={openModal}
              />
            )}
            {activeTab === 7 && (
              <ReportsTab
                state={stateWithMarks}
                addNotice={addNotice}
                triggerWebhookDispatch={triggerWebhookDispatch}
                openWebhookSettings={openWebhookSettings}
              />
            )}
            {activeTab === 8 && (
              <SettingsTab
                schoolProfile={state.schoolProfile}
                updateSchoolProfile={updateSchoolProfile}
                clearAllData={clearAllData}
                openWebhookSettings={openWebhookSettings}
              />
            )}
          </ErrorBoundary>
        </div>
      </div>

      <Modals
        modalType={modalType}
        closeModal={closeModal}
        addClass={addClass}
        addTeacher={addTeacher}
        addStudent={addStudent}
        addExam={addExam}
        addNotice={addNotice}
        schoolProfile={state.schoolProfile}
        updateSchoolProfile={updateSchoolProfile}
        classes={state.classes}
        teachers={state.teachers}
        students={state.students}
        openWebhookSettings={openWebhookSettings}
      />

      <ImportExcelModal
        isOpen={isImportModalOpen}
        initialCategory={importCategory}
        defaultClassId={importTargetClassId}
        onClose={closeImportModal}
        state={state}
        onImportStudents={handleImportStudents}
        onImportTeachers={handleImportTeachers}
        onImportClasses={handleImportClasses}
        notifySystemChange={notifySystemChange}
      />

      <WebhookSettingsModal
        isOpen={isWebhookSettingsOpen}
        onClose={() => setIsWebhookSettingsOpen(false)}
      />

      <WebhookDispatchModal
        isOpen={Boolean(webhookDispatchData)}
        onClose={() => setWebhookDispatchData(null)}
        dispatchData={webhookDispatchData}
        onOpenSettings={() => {
          setWebhookDispatchData(null);
          setIsWebhookSettingsOpen(true);
        }}
      />
    </div>
  );
}

