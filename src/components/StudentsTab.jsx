import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { formatWhatsAppPhone } from '../services/webhookService';
import ClassBadge from './ClassBadge';
import { getClassTheme } from '../services/classTheme';

export default function StudentsTab({
  state,
  deleteStudent,
  updateStudent,
  openModal,
  exportExcel,
  downloadBlankExcelTemplate,
  updateStudentAttendance,
  updateStudentClass,
  openImportModal,
  sendDailyAttendanceToParent,
  sendBulkDailyAttendanceToParents,
  sendMonthlyAttendanceToParent,
  sendBulkMonthlyAttendanceToParents,
  sendWeeklyAttendanceToParent,
  sendBulkWeeklyAttendanceToParents,
  triggerWebhookDispatch,
  openWebhookSettings
}) {
  // Attendance Period Mode: 'daily' | 'weekly' | 'monthly' | 'datewise'
  const [attendanceMode, setAttendanceMode] = useState('daily');

  // Attendance Details Sub-Tab fallback
  const [detailsSubTab, setDetailsSubTab] = useState('datewise');

  // ==================== DAILY ATTENDANCE STATE ====================
  const [classFilter, setClassFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [dailyPage, setDailyPage] = useState(1);
  const [dailyPageSize, setDailyPageSize] = useState(50);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [dailySentMap, setDailySentMap] = useState({}); // studentId -> { status, time }

  // Modals for Daily Attendance
  const [confirmDailyModal, setConfirmDailyModal] = useState(null); // { student, status, date, cls, message }
  const [showBulkDailyModal, setShowBulkDailyModal] = useState(false);
  const [bulkDailyResult, setBulkDailyResult] = useState(null); // { total, sentCount, missingCount, failedCount }
  const [isDailySending, setIsDailySending] = useState(false);

  // Edit Student Modal State
  const [editingStudent, setEditingStudent] = useState(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentRoll, setEditStudentRoll] = useState('');
  const [editStudentClassId, setEditStudentClassId] = useState('');
  const [editStudentParentName, setEditStudentParentName] = useState('');
  const [editStudentParentPhone, setEditStudentParentPhone] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const handleOpenEditStudent = (student) => {
    setEditingStudent(student);
    setEditStudentName(student.name || '');
    setEditStudentRoll(student.rollNo || '');
    setEditStudentClassId(student.classId || (state.classes[0]?.id || ''));
    setEditStudentParentName(student.parentName || '');
    setEditStudentParentPhone(student.parentPhone || '');
  };

  const handleSaveStudentEdit = async (e) => {
    if (e) e.preventDefault();
    if (!editingStudent || !updateStudent) return;
    if (!editStudentName.trim()) {
      showToast('Student name is required', 'error');
      return;
    }
    setIsSubmittingEdit(true);
    try {
      const ok = await updateStudent(editingStudent.id, {
        name: editStudentName,
        rollNo: editStudentRoll,
        classId: editStudentClassId,
        parentName: editStudentParentName,
        parentPhone: editStudentParentPhone
      });
      if (ok) {
        showToast(`Student ${editStudentName} updated successfully!`, 'success');
        setEditingStudent(null);
      }
    } catch (err) {
      showToast('Failed to update student: ' + (err.message || String(err)), 'error');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Notification Toast
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const getTodayDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const normalizeDateStr = (rawDate) => {
    if (!rawDate) return '';
    if (typeof rawDate === 'object') {
      if (rawDate.toDate && typeof rawDate.toDate === 'function') {
        const d = rawDate.toDate();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      if (rawDate.seconds !== undefined) {
        const d = new Date(rawDate.seconds * 1000);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      if (rawDate instanceof Date) {
        return `${rawDate.getFullYear()}-${String(rawDate.getMonth() + 1).padStart(2, '0')}-${String(rawDate.getDate()).padStart(2, '0')}`;
      }
    }
    const str = String(rawDate).trim();
    if (str.includes('T')) return str.split('T')[0];
    const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (ymdMatch) {
      return `${ymdMatch[1]}-${String(ymdMatch[2]).padStart(2, '0')}-${String(ymdMatch[3]).padStart(2, '0')}`;
    }
    const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmyMatch) {
      return `${dmyMatch[3]}-${String(dmyMatch[2]).padStart(2, '0')}-${String(dmyMatch[1]).padStart(2, '0')}`;
    }
    return str;
  };

  const todayDate = getTodayDateStr();
  const [selectedDate, setSelectedDate] = useState(todayDate);

  // Extract clean Base Class (e.g. "Class 10", "Class 9", "Class 12") and Division (e.g. "A", "B", "C")
  const extractClassAndDivision = (cls) => {
    if (!cls) return { baseClass: 'Class', division: '-' };
    let rawName = String(cls.name || '').trim();
    let rawSection = String(cls.section || '').trim().toUpperCase();

    // If section is written inside rawName like "12 - C" or "10 - A"
    if (!rawSection) {
      const dashMatch = rawName.match(/^(.*?)\s*[-–]\s*([A-Za-z])$/);
      if (dashMatch) {
        rawName = dashMatch[1].trim();
        rawSection = dashMatch[2].toUpperCase();
      }
    }

    if (rawSection) {
      let cleanName = rawName.replace(new RegExp('[-–\\s]*' + rawSection + '$', 'i'), '').trim();
      if (!cleanName.toLowerCase().startsWith('class') && /^\d+$/.test(cleanName)) {
        cleanName = `Class ${cleanName}`;
      }
      return {
        baseClass: cleanName || rawName,
        division: rawSection
      };
    }

    // Trailing letter like "Class 10A" or "10A"
    const match = rawName.match(/^(.*?)(?:\s*[-–]?\s*)([A-Za-z])$/);
    if (match) {
      let cleanName = match[1].trim();
      if (!cleanName.toLowerCase().startsWith('class') && /^\d+$/.test(cleanName)) {
        cleanName = `Class ${cleanName}`;
      }
      return {
        baseClass: cleanName || rawName,
        division: match[2].toUpperCase()
      };
    }

    let cleanName = rawName;
    if (!cleanName.toLowerCase().startsWith('class') && /^\d+$/.test(cleanName)) {
      cleanName = `Class ${cleanName}`;
    }
    return {
      baseClass: cleanName || 'Class',
      division: '-'
    };
  };

  // Indexed Classes Map for O(1) lookups
  const classesById = useMemo(() => {
    const map = new Map();
    (state.classes || []).forEach((c) => {
      if (c && c.id) map.set(c.id, c);
    });
    return map;
  }, [state.classes]);

  const validClassIdSet = useMemo(() => {
    const set = new Set();
    (state.classes || []).forEach((c) => {
      if (c && c.id) set.add(c.id);
    });
    return set;
  }, [state.classes]);

  const studentCountByClassId = useMemo(() => {
    const map = {};
    const students = state.students || [];
    for (let i = 0; i < students.length; i++) {
      const cid = students[i]?.classId;
      if (cid) map[cid] = (map[cid] || 0) + 1;
    }
    return map;
  }, [state.students]);

  // Helper to format class name cleanly
  const formatClassName = (c) => {
    if (!c) return '';
    const { baseClass, division } = extractClassAndDivision(c);
    return division && division !== '-' ? `${baseClass} - ${division}` : baseClass;
  };

  const getCleanClassAndDivision = (student) => {
    const cls = classesById.get(student?.classId);
    if (!cls) {
      return { clsName: 'Class', divName: '-', cls: null, baseClass: 'Class', division: '-' };
    }
    const { baseClass, division } = extractClassAndDivision(cls);
    return {
      clsName: baseClass,
      divName: division,
      cls,
      baseClass,
      division
    };
  };

  // High-performance O(1) Daily Attendance lookup Map
  // Key: `${date}_${studentId}` or `${date}_${rollNo}` -> latest status ('Present' | 'Absent')
  const dailyAttendanceMap = useMemo(() => {
    const map = new Map();
    if (!state.attendance || state.attendance.length === 0) return map;

    const latestMap = new Map();
    for (let i = 0; i < state.attendance.length; i++) {
      const a = state.attendance[i];
      if (!a) continue;
      const rawDate = a.date || a.attendanceDate || (typeof a.recordedAt === 'string' ? a.recordedAt.split('T')[0] : a.recordedAt) || '';
      const aDate = normalizeDateStr(rawDate);
      if (!aDate) continue;

      const rawStatus = String(a.status || a.attendanceStatus || '').trim().toLowerCase();
      let status = null;
      if (rawStatus === 'absent') status = 'Absent';
      else if (rawStatus === 'present') status = 'Present';
      if (!status) continue;

      const t = String(a.recordedAt || a.createdAt || a.updatedAt || '');

      const sId = a.studentId || a.student_id;
      if (sId) {
        const key = `${aDate}_${sId}`;
        const existing = latestMap.get(key);
        if (!existing || t.localeCompare(existing.t) > 0) {
          latestMap.set(key, { status, t });
        }
      }

      const roll = a.rollNo || a.roll_no;
      if (roll !== undefined && roll !== null && roll !== '') {
        const rollKey = `${aDate}_${roll}`;
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
  }, [state.attendance]);

  // Get student's status for the selected date: 'Present' | 'Absent' | 'Not Marked' (O(1) execution)
  const getStudentStatus = (student, targetDate = selectedDate) => {
    if (!student) return 'Not Marked';

    // 1. Check local session override for this student and this targetDate
    const sessionKey = `${targetDate}_${student.id}`;
    if (attendanceMap[sessionKey]) {
      return attendanceMap[sessionKey];
    }
    if (targetDate === todayDate && attendanceMap[student.id]) {
      return attendanceMap[student.id];
    }

    // 2. Query indexed dailyAttendanceMap for this exact targetDate in O(1)
    const mapStatus = dailyAttendanceMap.get(`${targetDate}_${student.id}`) ||
                     (student.rollNo ? dailyAttendanceMap.get(`${targetDate}_${student.rollNo}`) : null);
    if (mapStatus) {
      return mapStatus;
    }

    // 3. Check student document ONLY IF targetDate is today AND student.attendanceDate explicitly matches todayDate
    if (targetDate === todayDate && student.attendanceDate) {
      const cleanStudentDate = normalizeDateStr(student.attendanceDate);
      if (cleanStudentDate === todayDate && student.attendanceStatus) {
        const raw = String(student.attendanceStatus).trim().toLowerCase();
        if (raw === 'absent') return 'Absent';
        if (raw === 'present') return 'Present';
      }
    }

    // 4. Default: strictly Not Marked (never show yesterday's or older attendance in today's view)
    return 'Not Marked';
  };

  const toggleAttendance = async (student) => {
    const current = getStudentStatus(student, selectedDate);
    // 3 possible states: Not Marked -> Present -> Absent -> Not Marked
    let newStatus = 'Present';
    if (current === 'Not Marked') {
      newStatus = 'Present';
    } else if (current === 'Present') {
      newStatus = 'Absent';
    } else if (current === 'Absent') {
      newStatus = 'Not Marked';
    }

    const sessionKey = `${selectedDate}_${student.id}`;
    setAttendanceMap((prev) => ({
      ...prev,
      [sessionKey]: newStatus,
      [student.id]: selectedDate === todayDate ? newStatus : prev[student.id]
    }));

    if (updateStudentAttendance) {
      await updateStudentAttendance(student.id, newStatus, selectedDate);
    }
  };

  const parseRollNo = (roll) => {
    if (roll === undefined || roll === null || roll === '') return 999999;
    const num = Number(roll);
    if (!isNaN(num)) return num;
    const match = String(roll).match(/\d+/);
    return match ? parseInt(match[0], 10) : 999999;
  };

  const unassignedCount = useMemo(() => {
    const list = state.students || [];
    let count = 0;
    for (let i = 0; i < list.length; i++) {
      if (!validClassIdSet.has(list[i]?.classId)) count++;
    }
    return count;
  }, [state.students, validClassIdSet]);

  const { filteredDailyStudents, dailyPresentCount, dailyAbsentCount, dailyNotMarkedCount } = useMemo(() => {
    let list = state.students || [];
    if (classFilter === 'unassigned') {
      list = list.filter((s) => !validClassIdSet.has(s.classId));
    } else if (classFilter !== 'all') {
      list = list.filter((s) => s.classId === classFilter);
    }

    const q = (deferredSearchQuery || '').trim().toLowerCase();
    if (q) {
      list = list.filter((s) =>
        (s.name || '').toLowerCase().includes(q) || String(s.rollNo || '').toLowerCase().includes(q)
      );
    }

    list = [...list].sort((a, b) => {
      const rollA = parseRollNo(a.rollNo);
      const rollB = parseRollNo(b.rollNo);
      if (rollA !== rollB) return rollA - rollB;
      return (
        String(a.rollNo || '').localeCompare(String(b.rollNo || ''), undefined, { numeric: true, sensitivity: 'base' }) ||
        (a.name || '').localeCompare(b.name || '')
      );
    });

    let present = 0;
    let absent = 0;
    let notMarked = 0;
    for (let i = 0; i < list.length; i++) {
      const st = getStudentStatus(list[i], selectedDate);
      if (st === 'Present') present++;
      else if (st === 'Absent') absent++;
      else notMarked++;
    }

    return {
      filteredDailyStudents: list,
      dailyPresentCount: present,
      dailyAbsentCount: absent,
      dailyNotMarkedCount: notMarked
    };
  }, [state.students, classFilter, validClassIdSet, deferredSearchQuery, selectedDate, attendanceMap, dailyAttendanceMap]);

  // Reset daily page when filter or search changes
  useEffect(() => {
    setDailyPage(1);
  }, [classFilter, deferredSearchQuery]);

  const totalDailyPages = dailyPageSize === 'all' ? 1 : Math.ceil(filteredDailyStudents.length / (typeof dailyPageSize === 'number' ? dailyPageSize : 50));
  const pagedDailyStudents = useMemo(() => {
    if (dailyPageSize === 'all') return filteredDailyStudents;
    const size = typeof dailyPageSize === 'number' ? dailyPageSize : 50;
    const start = (dailyPage - 1) * size;
    return filteredDailyStudents.slice(start, start + size);
  }, [filteredDailyStudents, dailyPage, dailyPageSize]);

  const handleMarkAll = async (newStatus) => {
    if (!filteredDailyStudents || filteredDailyStudents.length === 0) return;

    // Optimistic local state update
    setAttendanceMap((prev) => {
      const next = { ...prev };
      filteredDailyStudents.forEach((student) => {
        const sessionKey = `${selectedDate}_${student.id}`;
        next[sessionKey] = newStatus;
        if (selectedDate === todayDate) {
          next[student.id] = newStatus;
        }
      });
      return next;
    });

    if (updateStudentAttendance) {
      try {
        await Promise.all(
          filteredDailyStudents.map((student) =>
            updateStudentAttendance(student.id, newStatus, selectedDate)
          )
        );
        showToast(`Marked all ${filteredDailyStudents.length} students as ${newStatus} for ${selectedDate}`);
      } catch (err) {
        showToast('Error marking all attendance: ' + (err.message || String(err)), 'error');
      }
    }
  };

  // Single Daily Send Handler
  const handleInitiateDailySend = (student) => {
    const status = getStudentStatus(student, selectedDate);
    if (status === 'Not Marked') {
      showToast(`Please mark attendance (Present or Absent) for ${student.name} before sending alert to parent.`, 'warning');
      return;
    }
    const { clsName, divName, cls } = getCleanClassAndDivision(student);
    const dateLabel = selectedDate === todayDate ? 'today' : `on ${selectedDate}`;
    const message = `Dear Parent,\nYour child ${student.name} was marked ${status.toUpperCase()} ${dateLabel}.\nClass: ${clsName}\nDivision: ${divName}\nThank you.`;

    setConfirmDailyModal({
      student,
      status,
      date: selectedDate,
      cls,
      clsName,
      divName,
      message
    });
  };

  const handleConfirmDailySend = async () => {
    if (!confirmDailyModal) return;
    const { student, status, date } = confirmDailyModal;
    setIsDailySending(true);

    try {
      if (sendDailyAttendanceToParent) {
        const res = await sendDailyAttendanceToParent({ student, status, date });
        setDailySentMap((prev) => ({
          ...prev,
          [student.id]: {
            status: res.status,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        }));

        if (res.status === 'Sent Successfully') {
          if (res.webhookDispatched) {
            showToast(`Attendance sent to ${student.name}'s parent on WhatsApp!`, 'success');
          } else {
            showToast(`Today's attendance recorded for ${student.name}'s parent.`, 'success');
          }
        } else if (res.status === 'Parent Contact Not Available') {
          showToast(`Parent mobile number not registered for ${student.name}.`, 'warning');
        } else {
          showToast(res.error || `Failed to send attendance alert for ${student.name}.`, 'error');
        }
      }
    } catch (err) {
      console.error('Error sending daily attendance:', err);
      showToast('Error sending attendance alert.', 'error');
    } finally {
      setIsDailySending(false);
      setConfirmDailyModal(null);
    }
  };

  // Bulk Daily Send Handler
  const handleConfirmBulkDailySend = async () => {
    setShowBulkDailyModal(false);

    // Only send for students whose attendance has actually been marked
    const markedStudents = filteredDailyStudents.filter((s) => getStudentStatus(s, selectedDate) !== 'Not Marked');
    if (markedStudents.length === 0) {
      showToast(`No students have attendance marked for ${selectedDate} yet. Please mark attendance before sending.`, 'warning');
      return;
    }

    setIsDailySending(true);

    const targets = markedStudents.map((s) => ({
      student: s,
      status: getStudentStatus(s, selectedDate),
      date: selectedDate
    }));

    try {
      if (sendBulkDailyAttendanceToParents) {
        const result = await sendBulkDailyAttendanceToParents(targets);
        setBulkDailyResult(result);

        // Update local status map
        const updatedMap = { ...dailySentMap };
        const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        targets.forEach((t) => {
          const hasPhone = Boolean((t.student.parentPhone || '').replace(/\s+/g, ''));
          updatedMap[t.student.id] = {
            status: hasPhone ? 'Sent Successfully' : 'Parent Contact Not Available',
            time: nowTime
          };
        });
        setDailySentMap(updatedMap);
      }
    } catch (err) {
      console.error('Error sending bulk daily attendance:', err);
      showToast('Error sending bulk attendance alerts.', 'error');
    } finally {
      setIsDailySending(false);
    }
  };

  // Daily Attendance Webhook Handlers
  const handleOpenDailyWebhookBulk = () => {
    if (!triggerWebhookDispatch) return;
    const targetStudents = (filteredDailyStudents || []).map((s) => {
      const { clsName, divName } = getCleanClassAndDivision(s);
      return {
        ...s,
        className: clsName,
        division: divName,
        status: getStudentStatus(s, selectedDate),
        date: selectedDate
      };
    });

    const activeCls = (classFilter !== 'all' && classFilter !== 'unassigned')
      ? state.classes.find((c) => c.id === classFilter)
      : null;

    triggerWebhookDispatch({
      type: 'daily',
      scope: 'bulk',
      students: targetStudents,
      classInfo: activeCls ? { id: activeCls.id, name: formatClassName(activeCls), section: activeCls.section } : { id: 'all', name: classFilter === 'unassigned' ? 'Unassigned Students' : 'All Classes' },
      date: selectedDate,
      schoolProfile: state.schoolProfile || {}
    });
  };

  const handleOpenDailyWebhookSingle = (s) => {
    if (!triggerWebhookDispatch || !s) return;
    const { clsName, divName } = getCleanClassAndDivision(s);
    const rawStatus = getStudentStatus(s, selectedDate);
    const resolvedStatus = (rawStatus && rawStatus !== 'Not Marked') ? rawStatus : 'Present';
    const enrichedStudent = {
      ...s,
      className: clsName,
      division: divName,
      status: resolvedStatus,
      date: selectedDate
    };

    triggerWebhookDispatch({
      type: 'daily',
      scope: 'single',
      student: enrichedStudent,
      classInfo: { id: s.classId || 'class', name: clsName, section: divName },
      date: selectedDate,
      schoolProfile: state.schoolProfile || {}
    });
  };

  // ==================== ATTENDANCE DETAILS: DATE-WISE STATE ====================
  const [dwClassId, setDwClassId] = useState('all');
  const [dwDivision, setDwDivision] = useState('all');
  const [dwStudentId, setDwStudentId] = useState('all');
  const [dwDateMode, setDwDateMode] = useState('single'); // 'single' | 'range'
  const [dwDate, setDwDate] = useState(todayDate);
  const [dwStartDate, setDwStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [dwEndDate, setDwEndDate] = useState(todayDate);

  // Natural sequence sorting for class chips / cards (e.g. 1, 2, 3... 10 - A, 10 - B)
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

  // Distinct divisions from classes (e.g. "A", "B", "C")
  const allDivisions = useMemo(() => {
    const set = new Set();
    (state.classes || []).forEach((c) => {
      const { division } = extractClassAndDivision(c);
      if (division && division !== '-') {
        set.add(division);
      }
    });
    return Array.from(set).sort();
  }, [state.classes]);

  // Distinct base classes (e.g. "Class 9", "Class 10", "Class 12")
  const distinctClassNames = useMemo(() => {
    const set = new Set();
    (state.classes || []).forEach((c) => {
      const { baseClass } = extractClassAndDivision(c);
      if (baseClass) set.add(baseClass);
    });
    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a.replace(/\D+/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D+/g, ''), 10) || 0;
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }, [state.classes]);

  // Available distinct attendance dates recorded in Firebase
  const availableAttendanceDates = useMemo(() => {
    const set = new Set();
    set.add(todayDate);
    (state.attendance || []).forEach((a) => {
      if (!a) return;
      const raw = a.date || a.attendanceDate || (typeof a.recordedAt === 'string' ? a.recordedAt.split('T')[0] : a.recordedAt) || '';
      const d = normalizeDateStr(raw);
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
        set.add(d);
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [state.attendance, todayDate]);

  // Students eligible for date-wise filter dropdown
  const dwFilteredStudentOptions = useMemo(() => {
    return state.students.filter((s) => {
      const { clsName, divName } = getCleanClassAndDivision(s);
      if (dwClassId !== 'all') {
        const matchesName = clsName.toLowerCase() === dwClassId.toLowerCase();
        const matchesId = s.classId === dwClassId;
        if (!matchesName && !matchesId) return false;
      }
      if (dwDivision !== 'all') {
        if (divName.toUpperCase() !== dwDivision.toUpperCase()) return false;
      }
      return true;
    });
  }, [state.students, state.classes, dwClassId, dwDivision]);

  // Combined date-wise attendance records
  const dateWiseRecords = useMemo(() => {
    const records = [];
    const seenKeys = new Set();

    // 1. Records from state.attendance collection
    (state.attendance || []).forEach((a) => {
      if (!a.date) return;

      // Date check
      if (dwDateMode === 'single') {
        if (a.date !== dwDate) return;
      } else {
        if (a.date < dwStartDate || a.date > dwEndDate) return;
      }

      // Student match
      const student = state.students.find(
        (s) => s.id === a.studentId || (s.rollNo && s.rollNo === a.studentId)
      );

      const studentId = student ? student.id : (a.studentId || '');
      const classId = student ? student.classId : (a.classId || '');

      // Class filter
      if (dwClassId !== 'all' && classId !== dwClassId) return;

      // Division filter
      const cls = state.classes.find((c) => c.id === classId);
      if (dwDivision !== 'all') {
        const sec = cls?.section?.trim().toUpperCase();
        if (sec !== dwDivision) return false;
      }

      // Specific student filter
      if (dwStudentId !== 'all' && studentId !== dwStudentId) return;

      const key = `${a.date}_${studentId}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const raw = String(a.status || '').trim().toLowerCase();
        const normStatus = raw === 'absent' ? 'Absent' : raw === 'present' ? 'Present' : 'Not Marked';
        records.push({
          id: a.id || key,
          date: a.date,
          studentId,
          studentName: student ? student.name : (a.studentName || 'Student'),
          rollNo: student ? student.rollNo : (a.rollNo || '-'),
          classDisplay: cls ? formatClassName(cls) : 'Unassigned',
          cls,
          student,
          status: normStatus,
          parentName: student?.parentName || 'Parent',
          parentPhone: student?.parentPhone || ''
        });
      }
    });

    // 2. If filtering today or a date range including today, include students from state.students not yet captured in attendance collection
    const isTodayInRange = dwDateMode === 'single' ? dwDate === todayDate : (todayDate >= dwStartDate && todayDate <= dwEndDate);
    if (isTodayInRange) {
      state.students.forEach((s) => {
        const key = `${todayDate}_${s.id}`;
        if (!seenKeys.has(key)) {
          if (dwClassId !== 'all' && s.classId !== dwClassId) return;
          const cls = state.classes.find((c) => c.id === s.classId);
          if (dwDivision !== 'all') {
            const sec = cls?.section?.trim().toUpperCase();
            if (sec !== dwDivision) return;
          }
          if (dwStudentId !== 'all' && s.id !== dwStudentId) return;

          seenKeys.add(key);
          const status = getStudentStatus(s);
          records.push({
            id: key,
            date: todayDate,
            studentId: s.id,
            studentName: s.name,
            rollNo: s.rollNo || '-',
            classDisplay: cls ? formatClassName(cls) : 'Unassigned',
            cls,
            student: s,
            status,
            parentName: s.parentName || 'Parent',
            parentPhone: s.parentPhone || ''
          });
        }
      });
    }

    // Sort by date desc, then by roll number or student name
    records.sort((a, b) => {
      const cmpDate = b.date.localeCompare(a.date);
      if (cmpDate !== 0) return cmpDate;
      const rA = Number(a.rollNo) || 0;
      const rB = Number(b.rollNo) || 0;
      if (rA && rB) return rA - rB;
      return a.studentName.localeCompare(b.studentName);
    });

    return records;
  }, [state.attendance, state.students, state.classes, dwDateMode, dwDate, dwStartDate, dwEndDate, dwClassId, dwDivision, dwStudentId, attendanceMap]);

  const dwPresentCount = dateWiseRecords.filter((r) => r.status === 'Present').length;
  const dwAbsentCount = dateWiseRecords.filter((r) => r.status === 'Absent').length;
  const dwMarkedCount = dwPresentCount + dwAbsentCount;
  const dwAttendanceRate = dwMarkedCount > 0 ? ((dwPresentCount / dwMarkedCount) * 100).toFixed(1) : '0.0';

  // Send single date-wise record to parent
  const handleSendDateWiseRecord = async (record) => {
    if (!record.student) return;
    const { clsName, divName } = getCleanClassAndDivision(record.student);
    const message = `Dear Parent,\nYour child ${record.studentName} was marked ${record.status.toUpperCase()} on ${record.date}.\nClass: ${clsName}\nDivision: ${divName}\nThank you.`;

    setConfirmDailyModal({
      student: record.student,
      status: record.status,
      date: record.date,
      cls: record.cls,
      clsName,
      divName,
      message
    });
  };

  // ==================== WEEKLY ATTENDANCE STATE ====================
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = previous, +1 = next
  const [weeklyClassId, setWeeklyClassId] = useState('all');
  const [weeklyDivision, setWeeklyDivision] = useState('all');
  const [weeklySearchQuery, setWeeklySearchQuery] = useState('');

  // Modals for Weekly
  const [confirmWeeklyModal, setConfirmWeeklyModal] = useState(null); // { student, stats, message }
  const [showBulkWeeklyModal, setShowBulkWeeklyModal] = useState(false);
  const [bulkWeeklyResult, setBulkWeeklyResult] = useState(null); // { total, sentCount, missingCount, failedCount }
  const [isWeeklySending, setIsWeeklySending] = useState(false);
  const [weeklySentMap, setWeeklySentMap] = useState({}); // studentId -> { status, time }

  // Days in selected week (Monday to Saturday, 6 working days)
  const weekDays = useMemo(() => {
    const today = new Date();
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + weekOffset * 7);
    const day = d.getDay(); // 0 is Sun, 1 is Mon...
    const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.getFullYear(), d.getMonth(), diffToMonday);

    const days = [];
    for (let i = 0; i < 6; i++) {
      const cur = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const year = cur.getFullYear();
      const month = String(cur.getMonth() + 1).padStart(2, '0');
      const dateNum = String(cur.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${dateNum}`;
      const dayName = cur.toLocaleDateString('en-US', { weekday: 'short' });
      const formatted = cur.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      const isToday = dateStr === todayDate;
      const isFuture = dateStr > todayDate;
      days.push({
        date: dateStr,
        dayName,
        formatted,
        fullDate: cur,
        isToday,
        isFuture
      });
    }
    return days;
  }, [weekOffset, todayDate]);

  const weekStartDateStr = weekDays[0]?.formatted;
  const weekEndDateStr = weekDays[weekDays.length - 1]?.formatted;
  const weekYear = weekDays[0]?.fullDate.getFullYear();
  const weekLabel = `${weekStartDateStr} – ${weekEndDateStr} ${weekYear}`;

  // Helper to get student's attendance status for a specific day in the week (O(1) execution)
  const getStudentDayStatus = (student, dayObj) => {
    if (!student) return '-';
    if (dayObj.isFuture) return 'Upcoming';

    // If day is today, check today's status
    if (dayObj.isToday) {
      return getStudentStatus(student);
    }

    const st = dailyAttendanceMap.get(`${dayObj.date}_${student.id}`) ||
              (student.rollNo ? dailyAttendanceMap.get(`${dayObj.date}_${student.rollNo}`) : null);
    if (st) return st;

    return 'Not Marked';
  };

  // Get student's weekly stats
  const getStudentWeeklyStats = (student) => {
    if (!student) {
      return { totalWorkingDays: 6, workingDaysSoFar: 6, presentDays: 0, absentDays: 0, percentage: 0, dayMap: {}, status: 'Not Sent' };
    }

    const dayMap = {};
    let presentCount = 0;
    let absentCount = 0;
    let evaluatedDays = 0;

    weekDays.forEach((day) => {
      const st = getStudentDayStatus(student, day);
      dayMap[day.date] = st;
      if (st === 'Present') {
        presentCount++;
        evaluatedDays++;
      } else if (st === 'Absent') {
        absentCount++;
        evaluatedDays++;
      }
    });

    const totalWorkingDays = 6;
    const workingDaysSoFar = evaluatedDays > 0 ? evaluatedDays : 6;
    const percentage = workingDaysSoFar > 0 ? parseFloat(((presentCount / workingDaysSoFar) * 100).toFixed(1)) : 100;
    const { clsName, divName } = getCleanClassAndDivision(student);
    const classDisplay = `${clsName} - ${divName}`;

    // Delivery status check
    const sentRecord = weeklySentMap[student.id];
    let status = sentRecord ? sentRecord.status : 'Not Sent';
    if (!sentRecord && !(student.parentPhone || '').replace(/\s+/g, '')) {
      status = 'Contact Number Missing';
    }

    return {
      totalWorkingDays,
      workingDaysSoFar,
      presentDays: presentCount,
      absentDays: absentCount,
      percentage,
      dayMap,
      clsName,
      divName,
      classDisplay,
      status
    };
  };

  // Generate weekly message matching specifications
  const generateWeeklyMessage = (student, stats) => {
    const { clsName, divName } = getCleanClassAndDivision(student);
    return `Dear Parent,\nAttendance Summary for Week (${weekStartDateStr} to ${weekEndDateStr} ${weekYear})\n\nStudent: ${student.name || 'Student'}\nClass: ${clsName}\nDivision: ${divName}\nWorking Days: ${stats.workingDaysSoFar}\nPresent: ${stats.presentDays}\nAbsent: ${stats.absentDays}\nAttendance: ${stats.percentage}%\n\nThank you.`;
  };

  // Available divisions for selected weekly class
  const weeklyAvailableDivisions = useMemo(() => {
    const set = new Set();
    state.classes.forEach((c) => {
      const { baseClass, division } = extractClassAndDivision(c);
      if (division && division !== '-') {
        if (weeklyClassId === 'all' || baseClass.toLowerCase() === weeklyClassId.toLowerCase() || c.id === weeklyClassId) {
          set.add(division);
        }
      }
    });
    if (set.size === 0) {
      allDivisions.forEach((d) => set.add(d));
    }
    return Array.from(set).sort();
  }, [state.classes, weeklyClassId, allDivisions]);

  // Filter students for weekly view, sorted serial-wise by roll number
  const weeklyFilteredStudents = useMemo(() => {
    const list = state.students.filter((s) => {
      const { clsName, divName } = getCleanClassAndDivision(s);

      // Class filter (matches base class e.g. "Class 10" or classId)
      if (weeklyClassId !== 'all') {
        const matchesName = clsName.toLowerCase() === weeklyClassId.toLowerCase();
        const matchesId = s.classId === weeklyClassId;
        if (!matchesName && !matchesId) return false;
      }

      // Division filter (matches division e.g. "A")
      if (weeklyDivision !== 'all') {
        if (divName.toUpperCase() !== weeklyDivision.toUpperCase()) return false;
      }

      if (weeklySearchQuery.trim()) {
        const q = weeklySearchQuery.toLowerCase();
        if (!(s.name || '').toLowerCase().includes(q) && !String(s.rollNo || '').toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
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
  }, [state.students, state.classes, weeklyClassId, weeklyDivision, weeklySearchQuery]);

  // Initiate single weekly send
  const handleInitiateWeeklySend = (student) => {
    const stats = getStudentWeeklyStats(student);
    const message = generateWeeklyMessage(student, stats);
    setConfirmWeeklyModal({ student, stats, message });
  };

  const handleConfirmWeeklySend = async () => {
    if (!confirmWeeklyModal) return;
    const { student, stats, message } = confirmWeeklyModal;
    setIsWeeklySending(true);

    try {
      if (sendWeeklyAttendanceToParent) {
        const res = await sendWeeklyAttendanceToParent({
          student,
          startDate: weekDays[0]?.date,
          endDate: weekDays[weekDays.length - 1]?.date,
          stats,
          message
        });

        const newStatus = res.status || 'Sent Successfully';
        setWeeklySentMap((prev) => ({
          ...prev,
          [student.id]: {
            status: newStatus,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        }));

        if (res.status === 'Sent Successfully') {
          showToast(`Weekly report sent to ${student.name}'s parent!`, 'success');
        } else if (res.status === 'Contact Number Missing') {
          showToast(`Parent mobile number not registered for ${student.name}.`, 'warning');
        } else {
          showToast(`Failed to send weekly report for ${student.name}.`, 'error');
        }
      }
    } catch (err) {
      console.error('Error sending weekly attendance:', err);
      showToast('Error sending weekly report.', 'error');
    } finally {
      setIsWeeklySending(false);
      setConfirmWeeklyModal(null);
    }
  };

  // Bulk weekly send
  const handleConfirmBulkWeeklySend = async () => {
    setShowBulkWeeklyModal(false);
    setIsWeeklySending(true);

    const targets = weeklyFilteredStudents.map((s) => {
      const stats = getStudentWeeklyStats(s);
      return {
        student: s,
        startDate: weekDays[0]?.date,
        endDate: weekDays[weekDays.length - 1]?.date,
        stats,
        message: generateWeeklyMessage(s, stats)
      };
    });

    try {
      if (sendBulkWeeklyAttendanceToParents) {
        const result = await sendBulkWeeklyAttendanceToParents(targets);
        setBulkWeeklyResult(result);

        const updated = { ...weeklySentMap };
        const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        targets.forEach((t) => {
          const hasPhone = Boolean((t.student.parentPhone || '').replace(/\s+/g, ''));
          updated[t.student.id] = {
            status: hasPhone ? 'Sent Successfully' : 'Contact Number Missing',
            time: nowTime
          };
        });
        setWeeklySentMap(updated);
      }
    } catch (err) {
      console.error('Error sending bulk weekly attendance:', err);
      showToast('Error sending bulk weekly reports.', 'error');
    } finally {
      setIsWeeklySending(false);
    }
  };

  // ==================== ATTENDANCE DETAILS: MONTHLY ATTENDANCE STATE ====================
  const currentDate = new Date();
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const [selectedMonth, setSelectedMonth] = useState(months[currentDate.getMonth()]);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [monthlyClassId, setMonthlyClassId] = useState('all');
  const [monthlyDivision, setMonthlyDivision] = useState('all');
  const [monthlySearchQuery, setMonthlySearchQuery] = useState('');
  const deferredMonthlySearchQuery = useDeferredValue(monthlySearchQuery);
  const [monthlyPage, setMonthlyPage] = useState(1);
  const [monthlyPageSize, setMonthlyPageSize] = useState(50);
  const [monthlyStatusFilter, setMonthlyStatusFilter] = useState('all');
  const [activeMonthlyRowMenu, setActiveMonthlyRowMenu] = useState(null);
  const [showMonthlyBulkMenu, setShowMonthlyBulkMenu] = useState(false);

  // Close menus on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.monthly-row-action-menu')) {
        setActiveMonthlyRowMenu(null);
      }
      if (!e.target.closest('.monthly-bulk-action-menu')) {
        setShowMonthlyBulkMenu(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Modals for Monthly
  const [confirmMonthlyModal, setConfirmMonthlyModal] = useState(null); // { student, stats, message }
  const [showBulkMonthlyModal, setShowBulkMonthlyModal] = useState(false);
  const [bulkMonthlyResult, setBulkMonthlyResult] = useState(null); // { total, sentCount, missingCount, failedCount }
  const [isMonthlySending, setIsMonthlySending] = useState(false);
  const [monthlySentMap, setMonthlySentMap] = useState({}); // studentId -> { status, time }

  const monthIndex = months.indexOf(selectedMonth);
  const monthNumStr = String(monthIndex + 1).padStart(2, '0');
  const yearMonthKey = `${selectedYear}-${monthNumStr}`; // e.g. '2026-09'

  // Days in month
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, monthIndex + 1, 0).getDate();
  }, [selectedYear, monthIndex]);

  // Total working days (customizable, defaults to 25 working days per school calendar)
  const [customWorkingDays, setCustomWorkingDays] = useState(25);
  const calculatedWorkingDays = customWorkingDays > 0 ? Number(customWorkingDays) : 25;

  // Map attendance for selected month
  const monthAttendanceMap = useMemo(() => {
    const map = new Map(); // studentId/rollNo -> Map(dateStr -> status)
    (state.attendance || []).forEach((a) => {
      if (!a) return;
      const rawDate = String(a.date || a.attendanceDate || a.createdAt || '').trim();
      let isCurrentMonth = rawDate.startsWith(yearMonthKey);
      if (!isCurrentMonth) {
        const match = rawDate.match(/^(\d{4})-(\d{1,2})/);
        if (match) {
          const ym = `${match[1]}-${match[2].padStart(2, '0')}`;
          if (ym === yearMonthKey) isCurrentMonth = true;
        }
      }
      if (!isCurrentMonth) return;

      const rawStatus = String(a.status || a.attendanceStatus || '').trim().toLowerCase();
      let status = null;
      if (rawStatus === 'present' || rawStatus === 'p') status = 'Present';
      else if (rawStatus === 'absent' || rawStatus === 'a') status = 'Absent';
      if (!status) return; // Only count days where attendance was actually recorded

      const dateStr = rawDate.slice(0, 10);
      const sId = a.studentId || a.student_id;
      const roll = a.rollNo || a.roll_no;

      if (sId) {
        if (!map.has(sId)) map.set(sId, new Map());
        map.get(sId).set(dateStr, status);
      }
      if (roll !== undefined && roll !== null && roll !== '') {
        const rollKey = String(roll);
        if (!map.has(rollKey)) map.set(rollKey, new Map());
        map.get(rollKey).set(dateStr, status);
      }
    });
    return map;
  }, [state.attendance, yearMonthKey]);

  // Available divisions for selected monthly class
  const monthlyAvailableDivisions = useMemo(() => {
    const set = new Set();
    state.classes.forEach((c) => {
      const { baseClass, division } = extractClassAndDivision(c);
      if (division && division !== '-') {
        if (monthlyClassId === 'all' || baseClass.toLowerCase() === monthlyClassId.toLowerCase() || c.id === monthlyClassId) {
          set.add(division);
        }
      }
    });
    if (set.size === 0) {
      allDivisions.forEach((d) => set.add(d));
    }
    return Array.from(set).sort();
  }, [state.classes, monthlyClassId, allDivisions]);

  // Calculate monthly stats for a student
  const getStudentMonthlyStats = (student) => {
    const sMap = monthAttendanceMap.get(student.id) || (student.rollNo ? monthAttendanceMap.get(String(student.rollNo)) : null);
    let presentCount = 0;
    let absentCount = 0;

    if (sMap && sMap.size > 0) {
      for (const status of sMap.values()) {
        if (status === 'Present') presentCount++;
        else if (status === 'Absent') absentCount++;
      }
    }

    // 1. Total working days (defaults to 25, or custom set by admin)
    const totalWorking = calculatedWorkingDays;
    const finalPresent = presentCount;
    const finalAbsent = absentCount;
    // 2. Attendance actually taken
    const attendanceTakenDays = finalPresent + finalAbsent;
    // 3. Remaining days as Attendance Not Marked (do NOT count as Absent)
    const notMarkedDays = Math.max(0, totalWorking - attendanceTakenDays);
    // 4. Calculate % using ONLY days on which attendance was actually taken
    const percentage = attendanceTakenDays > 0 ? Number(((finalPresent / attendanceTakenDays) * 100).toFixed(1)) : 0;

    const cls = classesById.get(student.classId);
    const classDisplay = cls ? formatClassName(cls) : 'Unassigned';

    // Status check
    const localSent = monthlySentMap[student.id];
    let status = 'Not Sent';
    if (localSent) {
      status = localSent.status;
    } else {
      const historyItem = monthlyHistoryMap.get(`${student.id}_${selectedMonth}_${Number(selectedYear)}`);
      if (historyItem) {
        status = historyItem.status || 'Sent Successfully';
      } else if (!student.parentPhone || !student.parentPhone.trim()) {
        status = 'Contact Number Missing';
      }
    }

    return {
      totalWorkingDays: totalWorking,
      attendanceTakenDays,
      notMarkedDays,
      presentDays: finalPresent,
      absentDays: finalAbsent,
      percentage,
      status,
      classDisplay,
      cls
    };
  };

  // Indexed Map for O(1) Monthly Attendance History lookups: key `${studentId}_${month}_${year}`
  const monthlyHistoryMap = useMemo(() => {
    const map = new Map();
    (state.monthlyAttendanceHistory || []).forEach((h) => {
      if (!h || !h.studentId) return;
      const key = `${h.studentId}_${h.month}_${Number(h.year)}`;
      map.set(key, h);
    });
    return map;
  }, [state.monthlyAttendanceHistory]);

  // Filter students for monthly view, sorted serial-wise by roll number
  const monthlyFilteredStudents = useMemo(() => {
    const list = (state.students || []).filter((s) => {
      const { clsName, divName } = getCleanClassAndDivision(s);

      // Class filter (matches base class e.g. "Class 10" or classId)
      if (monthlyClassId !== 'all') {
        const matchesName = clsName.toLowerCase() === monthlyClassId.toLowerCase();
        const matchesId = s.classId === monthlyClassId;
        if (!matchesName && !matchesId) return false;
      }

      // Division filter (matches division e.g. "A")
      if (monthlyDivision !== 'all') {
        if (divName.toUpperCase() !== monthlyDivision.toUpperCase()) return false;
      }

      // Attendance status filter
      if (monthlyStatusFilter !== 'all') {
        const stats = getStudentMonthlyStats(s);
        if (monthlyStatusFilter === 'above75' && stats.percentage < 75) return false;
        if (monthlyStatusFilter === 'below75' && stats.percentage >= 75) return false;
        if (monthlyStatusFilter === 'below60' && stats.percentage >= 60) return false;
        if (monthlyStatusFilter === 'sent' && stats.status !== 'Sent Successfully') return false;
        if (monthlyStatusFilter === 'not_sent' && stats.status === 'Sent Successfully') return false;
      }

      const q = (deferredMonthlySearchQuery || '').trim().toLowerCase();
      if (q) {
        if (!(s.name || '').toLowerCase().includes(q) && !String(s.rollNo || '').toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
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
  }, [state.students, state.classes, monthlyClassId, monthlyDivision, deferredMonthlySearchQuery, monthlyStatusFilter, monthAttendanceMap, selectedMonth, selectedYear, monthlySentMap, monthlyHistoryMap, calculatedWorkingDays]);

  // Reset monthly page when filters or search change
  useEffect(() => {
    setMonthlyPage(1);
  }, [monthlyClassId, monthlyDivision, monthlyStatusFilter, deferredMonthlySearchQuery]);

  const totalMonthlyPages = monthlyPageSize === 'all' ? 1 : Math.ceil(monthlyFilteredStudents.length / (typeof monthlyPageSize === 'number' ? monthlyPageSize : 50));
  const pagedMonthlyStudents = useMemo(() => {
    if (monthlyPageSize === 'all') return monthlyFilteredStudents;
    const size = typeof monthlyPageSize === 'number' ? monthlyPageSize : 50;
    const start = (monthlyPage - 1) * size;
    return monthlyFilteredStudents.slice(start, start + size);
  }, [monthlyFilteredStudents, monthlyPage, monthlyPageSize]);

  // Class / Filtered Students Monthly Overview Summary
  const monthlySummary = useMemo(() => {
    const totalWorkingDays = calculatedWorkingDays;
    const students = monthlyFilteredStudents;
    const totalStudents = students.length;

    if (totalStudents === 0) {
      return {
        totalWorkingDays,
        attendanceTakenDays: 0,
        notMarkedDays: totalWorkingDays,
        avgPresent: 0,
        avgAbsent: 0,
        overallPercentage: 0,
        totalStudents: 0
      };
    }

    const markedDates = new Set();
    let totalPresentSum = 0;
    let totalAbsentSum = 0;
    let totalTakenSum = 0;

    students.forEach((s) => {
      const stats = getStudentMonthlyStats(s);
      totalPresentSum += stats.presentDays;
      totalAbsentSum += stats.absentDays;
      totalTakenSum += stats.attendanceTakenDays;

      const sMap = monthAttendanceMap.get(s.id) || (s.rollNo ? monthAttendanceMap.get(String(s.rollNo)) : null);
      if (sMap) {
        for (const [date, st] of sMap.entries()) {
          if (st === 'Present' || st === 'Absent') {
            markedDates.add(date);
          }
        }
      }
    });

    const classAttendanceTakenDays = markedDates.size > 0
      ? markedDates.size
      : (totalStudents > 0 ? Math.round(totalTakenSum / totalStudents) : 0);
    const classNotMarkedDays = Math.max(0, totalWorkingDays - classAttendanceTakenDays);
    const avgPresent = totalStudents > 0 ? Number((totalPresentSum / totalStudents).toFixed(1)) : 0;
    const avgAbsent = totalStudents > 0 ? Number((totalAbsentSum / totalStudents).toFixed(1)) : 0;
    const overallPercentage = totalTakenSum > 0
      ? Number(((totalPresentSum / totalTakenSum) * 100).toFixed(1))
      : 0;

    return {
      totalWorkingDays,
      attendanceTakenDays: classAttendanceTakenDays,
      notMarkedDays: classNotMarkedDays,
      avgPresent,
      avgAbsent,
      overallPercentage,
      totalStudents
    };
  }, [monthlyFilteredStudents, monthAttendanceMap, calculatedWorkingDays]);

  // Generate monthly message matching the user's exact specification
  const generateMonthlyMessage = (student, stats) => {
    const { clsName, divName } = getCleanClassAndDivision(student);
    return `Dear Parent,\nAttendance Summary for ${selectedMonth} ${selectedYear}\n\nStudent: ${student.name || 'Student'}\nClass: ${clsName}\nDivision: ${divName}\nTotal Working Days: ${stats.totalWorkingDays}\nAttendance Taken: ${stats.attendanceTakenDays} Days\nAttendance Not Marked: ${stats.notMarkedDays} Days\nPresent: ${stats.presentDays} Days\nAbsent: ${stats.absentDays} Days\nAttendance: ${stats.percentage}%\n\nThank you.`;
  };

  // Initiate single monthly send
  const handleInitiateMonthlySend = (student) => {
    const stats = getStudentMonthlyStats(student);
    const message = generateMonthlyMessage(student, stats);
    setConfirmMonthlyModal({ student, stats, message });
  };

  const handleConfirmMonthlySend = async () => {
    if (!confirmMonthlyModal) return;
    const { student, stats, message } = confirmMonthlyModal;
    setIsMonthlySending(true);

    try {
      if (sendMonthlyAttendanceToParent) {
        const res = await sendMonthlyAttendanceToParent({
          student,
          month: selectedMonth,
          year: selectedYear,
          academicYear: '2026-2027',
          stats,
          message
        });

        const newStatus = res.status || 'Sent Successfully';
        setMonthlySentMap((prev) => ({
          ...prev,
          [student.id]: {
            status: newStatus,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        }));

        if (res.status === 'Sent Successfully') {
          showToast(`Monthly report sent to ${student.name}'s parent!`, 'success');
        } else if (res.status === 'Contact Number Missing') {
          showToast(`Parent mobile number not registered for ${student.name}.`, 'warning');
        } else {
          showToast(`Failed to send monthly report for ${student.name}.`, 'error');
        }
      }
    } catch (err) {
      console.error('Error sending monthly attendance:', err);
      showToast('Error sending monthly report.', 'error');
    } finally {
      setIsMonthlySending(false);
      setConfirmMonthlyModal(null);
    }
  };

  // Bulk monthly send
  const handleConfirmBulkMonthlySend = async () => {
    setShowBulkMonthlyModal(false);
    setIsMonthlySending(true);

    const targets = monthlyFilteredStudents.map((s) => {
      const stats = getStudentMonthlyStats(s);
      return {
        student: s,
        month: selectedMonth,
        year: selectedYear,
        academicYear: '2026-2027',
        stats,
        message: generateMonthlyMessage(s, stats)
      };
    });

    try {
      if (sendBulkMonthlyAttendanceToParents) {
        const result = await sendBulkMonthlyAttendanceToParents(targets);
        setBulkMonthlyResult(result);

        const updated = { ...monthlySentMap };
        const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        targets.forEach((t) => {
          const hasPhone = Boolean((t.student.parentPhone || '').replace(/\s+/g, ''));
          updated[t.student.id] = {
            status: hasPhone ? 'Sent Successfully' : 'Contact Number Missing',
            time: nowTime
          };
        });
        setMonthlySentMap(updated);
      }
    } catch (err) {
      console.error('Error sending bulk monthly attendance:', err);
      showToast('Error sending bulk monthly reports.', 'error');
    } finally {
      setIsMonthlySending(false);
    }
  };

  // Monthly Attendance Webhook Handlers
  const handleOpenMonthlyWebhookBulk = () => {
    if (!triggerWebhookDispatch) return;
    const targetStudents = (monthlyFilteredStudents || []).map((s) => {
      const stats = getStudentMonthlyStats(s);
      const { clsName, divName } = getCleanClassAndDivision(s);
      return {
        ...s,
        className: clsName,
        division: divName,
        totalWorkingDays: stats.totalWorkingDays,
        presentDays: stats.presentDays,
        absentDays: stats.absentDays,
        attendancePercentage: stats.percentage,
        message: generateMonthlyMessage(s, stats)
      };
    });

    const activeCls = (monthlyClassId !== 'all')
      ? state.classes.find((c) => c.id === monthlyClassId)
      : null;

    triggerWebhookDispatch({
      type: 'monthly',
      scope: 'bulk',
      students: targetStudents,
      classInfo: activeCls ? { id: activeCls.id, name: formatClassName(activeCls), section: activeCls.section } : { id: 'all', name: 'All Classes' },
      month: selectedMonth,
      year: selectedYear,
      academicYear: '2026-2027',
      workingDays: calculatedWorkingDays || 24,
      schoolProfile: state.schoolProfile || {}
    });
  };

  const handleOpenMonthlyWebhookSingle = (s) => {
    if (!triggerWebhookDispatch || !s) return;
    const stats = getStudentMonthlyStats(s);
    const { clsName, divName } = getCleanClassAndDivision(s);
    const enrichedStudent = {
      ...s,
      className: clsName,
      division: divName,
      totalWorkingDays: stats.totalWorkingDays,
      presentDays: stats.presentDays,
      absentDays: stats.absentDays,
      attendancePercentage: stats.percentage,
      message: generateMonthlyMessage(s, stats)
    };

    triggerWebhookDispatch({
      type: 'monthly',
      scope: 'single',
      student: enrichedStudent,
      classInfo: { id: s.classId || 'class', name: clsName, section: divName },
      month: selectedMonth,
      year: selectedYear,
      academicYear: '2026-2027',
      workingDays: calculatedWorkingDays || 24,
      schoolProfile: state.schoolProfile || {}
    });
  };

  // Status Badge Component
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Sent Successfully':
      case 'Sent':
        return (
          <span
            style={{
              background: '#dcfce7',
              color: '#15803d',
              border: '1px solid #bbf7d0',
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '11.5px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap'
            }}
          >
            <i className="fa-solid fa-circle-check"></i> Sent
          </span>
        );
      case 'Parent Contact Not Available':
      case 'Contact Number Missing':
      case 'No Contact':
        return (
          <span
            style={{
              background: '#fef3c7',
              color: '#b45309',
              border: '1px solid #fde68a',
              padding: '4px 8px',
              borderRadius: '8px',
              fontSize: '11.5px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap'
            }}
            title="Parent contact number not registered"
          >
            <i className="fa-solid fa-phone-slash"></i> No Phone
          </span>
        );
      case 'Failed':
        return (
          <span
            style={{
              background: '#fef2f2',
              color: '#b91c1c',
              border: '1px solid #fecaca',
              padding: '4px 8px',
              borderRadius: '8px',
              fontSize: '11.5px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap'
            }}
          >
            <i className="fa-solid fa-circle-xmark"></i> Failed
          </span>
        );
      default:
        return (
          <span
            style={{
              background: '#f1f5f9',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              padding: '4px 8px',
              borderRadius: '8px',
              fontSize: '11.5px',
              fontWeight: 600,
              whiteSpace: 'nowrap'
            }}
          >
            Not Sent
          </span>
        );
    }
  };

  return (
    <div>
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: toastMessage.type === 'error' ? '#ef4444' : toastMessage.type === 'warning' ? '#f59e0b' : '#10b981',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13.5px',
            fontWeight: 600,
            animation: 'fadeIn 0.2s ease-in'
          }}
        >
          <i
            className={`fa-solid ${
              toastMessage.type === 'error'
                ? 'fa-circle-exclamation'
                : toastMessage.type === 'warning'
                ? 'fa-triangle-exclamation'
                : 'fa-circle-check'
            }`}
          ></i>
          <span>{toastMessage.msg}</span>
        </div>
      )}

      {/* ==================== ATTENDANCE PERIOD SELECTOR (DROPDOWN + SWITCHER) ==================== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '2px solid var(--border-color)',
          marginBottom: '20px',
          paddingBottom: '12px',
          flexWrap: 'wrap',
          gap: '14px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* Dropdown Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: attendanceMode === 'daily'
                  ? 'rgba(37, 99, 235, 0.12)'
                  : 'rgba(124, 58, 237, 0.12)',
                color: attendanceMode === 'daily'
                  ? 'var(--primary)'
                  : '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                border: '1px solid currentColor'
              }}
            >
              <i
                className={`fa-solid ${
                  attendanceMode === 'daily'
                    ? 'fa-calendar-day'
                    : 'fa-calendar-days'
                }`}
              ></i>
            </div>

            <div style={{ position: 'relative' }}>
              <label
                style={{
                  fontSize: '10.5px',
                  fontWeight: 800,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  display: 'block',
                  marginBottom: '2px'
                }}
              >
                Attendance Mode:
              </label>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <select
                  className="form-control"
                  value={attendanceMode}
                  onChange={(e) => setAttendanceMode(e.target.value)}
                  style={{
                    minWidth: '220px',
                    padding: '8px 36px 8px 12px',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    color: '#0f172a',
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    appearance: 'none',
                    outline: 'none',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                  }}
                >
                  <option value="daily">Daily Attendance</option>
                  <option value="monthly">Monthly Attendance</option>
                </select>
                <i
                  className="fa-solid fa-chevron-down"
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    fontSize: '11px',
                    color: '#64748b'
                  }}
                ></i>
              </div>
            </div>
          </div>
        </div>

        {/* Right Info: Date Picker & Context Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {attendanceMode === 'daily' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Recorded Dates Dropdown from Firebase */}
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <select
                  className="form-control"
                  value={availableAttendanceDates.includes(selectedDate) ? selectedDate : 'custom'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== 'custom') {
                      setSelectedDate(val);
                    }
                  }}
                  style={{
                    padding: '6px 30px 6px 12px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: '#0f172a',
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    appearance: 'none',
                    outline: 'none',
                    minWidth: '150px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                  }}
                  title="Select recorded attendance date from Firebase"
                >
                  {availableAttendanceDates.map((d) => (
                    <option key={d} value={d}>
                      {d === todayDate ? `Today (${d})` : d}
                    </option>
                  ))}
                  {!availableAttendanceDates.includes(selectedDate) && (
                    <option value="custom">Date: {selectedDate}</option>
                  )}
                </select>
                <i
                  className="fa-solid fa-chevron-down"
                  style={{
                    position: 'absolute',
                    right: '10px',
                    pointerEvents: 'none',
                    fontSize: '10px',
                    color: '#64748b'
                  }}
                ></i>
              </div>

              {/* Native Calendar Date Picker */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '5px 10px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                }}
                title="Select date from calendar"
              >
                <i className="fa-regular fa-calendar" style={{ color: 'var(--primary)', fontSize: '13px' }}></i>
                <input
                  type="date"
                  value={selectedDate}
                  max={todayDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value);
                    }
                  }}
                  style={{
                    border: 'none',
                    outline: 'none',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: '#0f172a',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* Reset to Today button */}
              {selectedDate !== todayDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayDate)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: '1px solid #bfdbfe',
                    backgroundColor: '#eff6ff',
                    color: '#1d4ed8',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease'
                  }}
                  title="Return to Today"
                >
                  <i className="fa-solid fa-rotate-left" style={{ fontSize: '11px' }}></i>
                  <span>Today</span>
                </button>
              )}

              {/* Status pill badge */}
              <div
                style={{
                  fontSize: '12px',
                  color: selectedDate === todayDate ? '#15803d' : '#b45309',
                  backgroundColor: selectedDate === todayDate ? '#f0fdf4' : '#fffbeb',
                  border: selectedDate === todayDate ? '1px solid #bbf7d0' : '1px solid #fde68a',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                <i
                  className={selectedDate === todayDate ? "fa-solid fa-circle-dot" : "fa-solid fa-clock-rotate-left"}
                  style={{ fontSize: '10px' }}
                ></i>
                <span>{selectedDate === todayDate ? "Today's View" : `Viewing: ${selectedDate}`}</span>
              </div>
            </div>
          )}

          {attendanceMode === 'monthly' && (
            <div
              style={{
                fontSize: '12.5px',
                color: '#6d28d9',
                backgroundColor: '#f5f3ff',
                padding: '6px 14px',
                borderRadius: '20px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                border: '1px solid #ddd6fe'
              }}
            >
              <i className="fa-solid fa-calendar" style={{ color: '#7c3aed' }}></i>
              <span>Month: {selectedMonth} {selectedYear}</span>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. DAILY ATTENDANCE SUB-TAB                                               */}
      {/* ========================================================================= */}
      {attendanceMode === 'daily' && (
        <div>
          <div className="filter-header">
            {/* Class Filter Chips */}
            <div className="chips-row" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '8px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
              <button
                type="button"
                className={`chip ${classFilter === 'all' ? 'active' : ''}`}
                onClick={() => setClassFilter('all')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 14px',
                  borderRadius: '12px',
                  fontSize: '12.5px',
                  fontWeight: classFilter === 'all' ? 700 : 600,
                  cursor: 'pointer',
                  border: classFilter === 'all' ? '1.5px solid #2563eb' : '1.5px solid #e2e8f0',
                  background: classFilter === 'all' ? '#eff6ff' : '#ffffff',
                  color: classFilter === 'all' ? '#1e3a8a' : '#334155',
                  boxShadow: classFilter === 'all' ? '0 4px 12px -2px rgba(37, 99, 235, 0.2)' : '0 1px 2px rgba(0, 0, 0, 0.03)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <span
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '7px',
                    background: classFilter === 'all' ? '#dbeafe' : '#f1f5f9',
                    color: classFilter === 'all' ? '#1d4ed8' : '#64748b',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px'
                  }}
                >
                  <i className="fa-solid fa-school"></i>
                </span>
                <span style={{ color: classFilter === 'all' ? '#1e3a8a' : '#334155', fontWeight: classFilter === 'all' ? 800 : 600 }}>All Classes</span>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: classFilter === 'all' ? '#2563eb' : '#f1f5f9',
                    color: classFilter === 'all' ? '#ffffff' : '#64748b'
                  }}
                >
                  {state.students.length}
                </span>
              </button>

              {sortedClasses.map((c) => {
                const count = studentCountByClassId[c.id] || 0;
                const isAct = classFilter === c.id;
                const theme = getClassTheme(c);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`chip ${isAct ? 'active' : ''}`}
                    onClick={() => setClassFilter(c.id)}
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

              {unassignedCount > 0 && (
                <button
                  type="button"
                  className={`chip ${classFilter === 'unassigned' ? 'active' : ''}`}
                  onClick={() => setClassFilter('unassigned')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '12px',
                    fontSize: '12.5px',
                    fontWeight: classFilter === 'unassigned' ? 700 : 600,
                    cursor: 'pointer',
                    border: classFilter === 'unassigned' ? '1.5px solid #ef4444' : '1.5px solid #fee2e2',
                    backgroundColor: classFilter === 'unassigned' ? '#fef2f2' : '#ffffff',
                    color: '#dc2626',
                    boxShadow: classFilter === 'unassigned' ? '0 4px 12px -2px rgba(239, 68, 68, 0.25)' : '0 1px 2px rgba(0, 0, 0, 0.03)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '12px' }}></i>
                  <span>Unassigned</span>
                  <span
                    style={{
                      padding: '2px 7px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: classFilter === 'unassigned' ? '#dc2626' : '#fee2e2',
                      color: classFilter === 'unassigned' ? '#ffffff' : '#dc2626'
                    }}
                  >
                    {unassignedCount}
                  </span>
                </button>
              )}
            </div>

            {/* Row 2: Attendance Tracking Badges + Quick Mark + Search Box */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              paddingBottom: '12px',
              borderBottom: '1px solid #f1f5f9'
            }}>
              {/* Left: Attendance Metrics & Quick Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* Soft Attendance Summary Badges */}
                <span
                  style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    color: '#059669',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(16, 185, 129, 0.18)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 700
                  }}
                >
                  <i className="fa-solid fa-circle-check" style={{ fontSize: '11px', color: '#10b981' }}></i>
                  Present: {dailyPresentCount}
                </span>

                <span
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    color: '#dc2626',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.18)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 700
                  }}
                >
                  <i className="fa-solid fa-circle-xmark" style={{ fontSize: '11px', color: '#ef4444' }}></i>
                  Absent: {dailyAbsentCount}
                </span>

                {dailyNotMarkedCount > 0 && (
                  <span
                    style={{
                      background: '#f8fafc',
                      color: '#64748b',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: 600
                    }}
                    title="Attendance not recorded for today yet"
                  >
                    <i className="fa-regular fa-clock" style={{ fontSize: '11px', color: '#94a3b8' }}></i>
                    Not Marked: {dailyNotMarkedCount}
                  </span>
                )}

                {/* Subtle vertical separator */}
                <div style={{ width: '1px', height: '18px', backgroundColor: '#e2e8f0', margin: '0 4px' }} />

                {/* Quick Mark All Buttons */}
                <button
                  type="button"
                  onClick={() => handleMarkAll('Present')}
                  disabled={filteredDailyStudents.length === 0}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: '#f0fdf4',
                    color: '#15803d',
                    border: '1px solid #bbf7d0',
                    cursor: filteredDailyStudents.length === 0 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title={`Mark all ${filteredDailyStudents.length} students in current view as Present`}
                >
                  <i className="fa-solid fa-check-double" style={{ fontSize: '11px' }}></i>
                  <span>Mark All Present</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleMarkAll('Absent')}
                  disabled={filteredDailyStudents.length === 0}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: '#fff1f2',
                    color: '#be123c',
                    border: '1px solid #fecdd3',
                    cursor: filteredDailyStudents.length === 0 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title={`Mark all ${filteredDailyStudents.length} students in current view as Absent`}
                >
                  <i className="fa-solid fa-xmark" style={{ fontSize: '11px' }}></i>
                  <span>Mark All Absent</span>
                </button>
              </div>

              {/* Right: Search Box */}
              <div className="search-input-box" style={{ width: '280px', margin: 0 }}>
                <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--text-muted)' }}></i>
                <input
                  type="text"
                  placeholder="Search student name or roll number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ fontSize: '12.5px' }}
                />
                {searchQuery && (
                  <i
                    className="fa-solid fa-xmark"
                    style={{ cursor: 'pointer', color: 'var(--text-muted)' }}
                    onClick={() => setSearchQuery('')}
                  ></i>
                )}
              </div>
            </div>

            {/* Row 3: Action Toolbar - Primary CTAs on Left + Unified Data Tools on Right */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              paddingTop: '2px'
            }}>
              {/* Left: Primary Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* BULK SEND: Send Attendance to All Parents */}
                <button
                  type="button"
                  onClick={() => setShowBulkDailyModal(true)}
                  disabled={isDailySending || filteredDailyStudents.length === 0}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    backgroundColor: '#4338ca',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 700,
                    boxShadow: '0 2px 6px rgba(67, 56, 202, 0.22)',
                    whiteSpace: 'nowrap',
                    cursor: (isDailySending || filteredDailyStudents.length === 0) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title={`Send ${selectedDate === todayDate ? "today's" : selectedDate} attendance alert to all parents in current view`}
                >
                  <i className="fa-solid fa-paper-plane" style={{ fontSize: '12px' }}></i>
                  <span>{selectedDate === todayDate ? "Send Today's Attendance" : `Send Attendance (${selectedDate})`}</span>
                </button>

                <button
                  type="button"
                  onClick={() => openModal('addStudent')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 700,
                    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.22)',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <i className="fa-solid fa-user-plus" style={{ fontSize: '12px' }}></i>
                  <span>Add Student</span>
                </button>
              </div>

              {/* Right: Data / Excel Tools (Unified, Clean, Premium Neutral Design) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {openImportModal && (
                  <button
                    type="button"
                    onClick={() => openImportModal('students', classFilter !== 'all' && classFilter !== 'unassigned' ? classFilter : '')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#ffffff',
                      color: '#334155',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '7px 14px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                    title="Import students from Excel file"
                  >
                    <i className="fa-solid fa-file-import" style={{ color: '#059669', fontSize: '13px' }}></i>
                    <span>Import Excel</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => downloadBlankExcelTemplate ? downloadBlankExcelTemplate('students') : (openImportModal && openImportModal('students'))}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '7px 14px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                  title="Download clean blank Excel template with headers to add new students"
                >
                  <i className="fa-solid fa-file-arrow-down" style={{ color: '#059669', fontSize: '13px' }}></i>
                  <span>Blank Template</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportExcel(attendanceMap)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '7px 14px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                  title="Export student attendance report to Excel"
                >
                  <i className="fa-solid fa-file-export" style={{ color: '#059669', fontSize: '13px' }}></i>
                  <span>Export Excel</span>
                </button>
              </div>
            </div>
          </div>

          {/* Daily Attendance Student Table */}
          <div className="data-table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                  <th style={{ width: '55px', textAlign: 'center', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 8px' }}>Roll No</th>
                  <th style={{ textAlign: 'left', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 12px' }}>Student Name</th>
                  <th style={{ width: '130px', textAlign: 'left', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 10px', whiteSpace: 'nowrap' }}>Enrolled Class</th>
                  <th style={{ width: '175px', textAlign: 'left', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 10px', whiteSpace: 'nowrap' }}>Attendance ({selectedDate === todayDate ? 'Today' : selectedDate})</th>
                  <th style={{ textAlign: 'left', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 12px' }}>Parent / Guardian</th>
                  <th style={{ width: '160px', textAlign: 'left', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 10px', whiteSpace: 'nowrap' }}>Send to Parent</th>
                  <th style={{ width: '60px', textAlign: 'center', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 6px', whiteSpace: 'nowrap' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDailyStudents.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      <i className="fa-solid fa-user-slash" style={{ fontSize: '28px', marginBottom: '8px', display: 'block', opacity: 0.5 }}></i>
                      No students found matching current filters.
                    </td>
                  </tr>
                ) : (
                  pagedDailyStudents.map((s) => {
                    const cls = classesById.get(s.classId);
                    const status = getStudentStatus(s);
                    const isPresent = status === 'Present';
                    const isAbsent = status === 'Absent';
                    const isNotMarked = status === 'Not Marked';
                    const hasPhone = Boolean((s.parentPhone || '').replace(/\s+/g, ''));
                    const sentInfo = dailySentMap[s.id];

                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {/* Roll No */}
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '10px 8px' }}>
                          <div className="roll-badge" style={{ margin: '0 auto', width: '32px', height: '32px', fontSize: '12px', fontWeight: 800 }}>
                            {s.rollNo || '-'}
                          </div>
                        </td>

                        {/* Student Name */}
                        <td style={{ verticalAlign: 'middle', padding: '10px 12px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.name}>
                            {s.name}
                          </div>
                        </td>

                        {/* Enrolled Class */}
                        <td style={{ verticalAlign: 'middle', padding: '10px 10px' }}>
                          {cls ? (
                            <ClassBadge classItem={cls} label={formatClassName(cls)} />
                          ) : (
                            <select
                              className="form-control"
                              style={{ fontSize: '11px', padding: '4px 8px', height: 'auto', border: '1px solid #ef4444', color: '#b91c1c' }}
                              onChange={(e) => updateStudentClass && updateStudentClass(s.id, e.target.value)}
                              defaultValue=""
                            >
                              <option value="" disabled>⚠️ Select Class...</option>
                              {state.classes.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {formatClassName(c)}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>

                        {/* Attendance Toggle */}
                        <td style={{ verticalAlign: 'middle', padding: '10px 10px' }}>
                          <button
                            type="button"
                            onClick={() => toggleAttendance(s)}
                            style={{
                              background: isPresent ? '#dcfce7' : isAbsent ? '#fef2f2' : '#f8fafc',
                              color: isPresent ? '#15803d' : isAbsent ? '#b91c1c' : '#64748b',
                              border: isPresent ? '1px solid #bbf7d0' : isAbsent ? '1px solid #fecaca' : '1px solid #cbd5e1',
                              padding: '5px 10px',
                              borderRadius: '8px',
                              fontWeight: '700',
                              fontSize: '11.5px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              transition: 'all 0.2s ease',
                              whiteSpace: 'nowrap'
                            }}
                            title="Click to toggle: Present / Absent / Not Marked"
                          >
                            <i className={`fa-solid ${isPresent ? 'fa-circle-check' : isAbsent ? 'fa-circle-xmark' : 'fa-clock'}`} style={{ fontSize: '11px' }}></i>
                            <span>{isPresent ? 'Present Today' : isAbsent ? 'Absent Today' : 'Not Marked'}</span>
                          </button>
                        </td>

                        {/* Parent / Guardian Name & Contact */}
                        <td style={{ verticalAlign: 'middle', padding: '10px 12px' }}>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '12.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {s.parentName || 'Parent'}
                            </div>
                            {hasPhone ? (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                <i className="fa-solid fa-phone" style={{ fontSize: '9.5px', color: '#10b981' }}></i>
                                <span>{s.parentPhone}</span>
                              </div>
                            ) : (
                              <div style={{ fontSize: '10.5px', color: '#f59e0b', fontStyle: 'italic', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '9.5px' }}></i>
                                <span>No phone registered</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Send to Parent */}
                        <td style={{ verticalAlign: 'middle', padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {sentInfo ? (
                              renderStatusBadge(sentInfo.status)
                            ) : null}

                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => handleInitiateDailySend(s)}
                              disabled={isDailySending}
                              style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                borderRadius: '7px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                borderColor: '#cbd5e1',
                                whiteSpace: 'nowrap',
                                backgroundColor: '#f8fafc',
                                fontWeight: 600
                              }}
                              title={hasPhone ? "Send attendance alert to parent via App & WhatsApp" : "Parent phone not available"}
                            >
                              <i className="fa-solid fa-paper-plane" style={{ color: 'var(--primary)', fontSize: '10px' }}></i>
                              <span>{sentInfo ? 'Resend' : 'Send'}</span>
                            </button>
                          </div>
                        </td>

                        {/* Action: Edit & Delete */}
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '10px 6px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                padding: '6px',
                                borderRadius: '6px',
                                color: '#94a3b8',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#2563eb';
                                e.currentTarget.style.backgroundColor = '#eff6ff';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#94a3b8';
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              title="Edit student details"
                              onClick={() => handleOpenEditStudent(s)}
                            >
                              <i className="fa-solid fa-pen-to-square" style={{ fontSize: '12px' }}></i>
                            </button>
                            <button
                              type="button"
                              style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                padding: '6px',
                                borderRadius: '6px',
                                color: '#94a3b8',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#ef4444';
                                e.currentTarget.style.backgroundColor = '#fee2e2';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#94a3b8';
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              title="Delete student"
                              onClick={() => deleteStudent(s.id)}
                            >
                              <i className="fa-solid fa-trash" style={{ fontSize: '12px' }}></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {filteredDailyStudents.length > 50 && (
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
                  Showing <strong style={{ color: '#0f172a' }}>{dailyPageSize === 'all' ? 1 : ((dailyPage - 1) * dailyPageSize + 1)}</strong> to{' '}
                  <strong style={{ color: '#0f172a' }}>
                    {dailyPageSize === 'all' ? filteredDailyStudents.length : Math.min(dailyPage * dailyPageSize, filteredDailyStudents.length)}
                  </strong>{' '}
                  of <strong style={{ color: '#0f172a' }}>{filteredDailyStudents.length}</strong> students
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 600 }}>Rows:</span>
                    <select
                      value={dailyPageSize}
                      onChange={(e) => {
                        const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                        setDailyPageSize(val);
                        setDailyPage(1);
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
                      <option value="all">All ({filteredDailyStudents.length})</option>
                    </select>
                  </div>
                  {dailyPageSize !== 'all' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        disabled={dailyPage <= 1}
                        onClick={() => setDailyPage((p) => Math.max(1, p - 1))}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          background: dailyPage <= 1 ? '#f8fafc' : '#ffffff',
                          color: dailyPage <= 1 ? '#94a3b8' : '#334155',
                          cursor: dailyPage <= 1 ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                          fontSize: '12px'
                        }}
                      >
                        Previous
                      </button>
                      <span style={{ fontSize: '12.5px', color: '#475569', fontWeight: 600, minWidth: '85px', textAlign: 'center' }}>
                        Page {dailyPage} of {totalDailyPages || 1}
                      </span>
                      <button
                        type="button"
                        disabled={dailyPage >= totalDailyPages}
                        onClick={() => setDailyPage((p) => Math.min(totalDailyPages, p + 1))}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          background: dailyPage >= totalDailyPages ? '#f8fafc' : '#ffffff',
                          color: dailyPage >= totalDailyPages ? '#94a3b8' : '#334155',
                          cursor: dailyPage >= totalDailyPages ? 'not-allowed' : 'pointer',
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MONTHLY ATTENDANCE SUB-TAB                                             */}
      {/* 4. MONTHLY ATTENDANCE SUB-TAB                                             */}
      {/* ========================================================================= */}
      {attendanceMode === 'monthly' && (
        <div style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
          {/* 1. Small Top Summary Section (Total Working Days, Attendance Taken, Not Marked only once) */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 18px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            {/* Left: Summary Metrics */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    backgroundColor: '#eef2ff',
                    color: '#4f46e5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px'
                  }}
                >
                  <i className="fa-solid fa-calendar-days"></i>
                </span>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, lineHeight: 1 }}>Total Working Days</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', marginTop: '3px' }}>
                    {monthlySummary.totalWorkingDays} Days
                  </div>
                </div>
              </div>

              <div style={{ width: '1px', height: '22px', backgroundColor: '#e2e8f0' }}></div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    backgroundColor: '#e0f2fe',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px'
                  }}
                >
                  <i className="fa-solid fa-clipboard-check"></i>
                </span>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, lineHeight: 1 }}>Attendance Taken</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#0369a1', marginTop: '3px' }}>
                    {monthlySummary.attendanceTakenDays} Days
                  </div>
                </div>
              </div>

              <div style={{ width: '1px', height: '22px', backgroundColor: '#e2e8f0' }}></div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    backgroundColor: '#fef3c7',
                    color: '#d97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px'
                  }}
                >
                  <i className="fa-solid fa-clock"></i>
                </span>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, lineHeight: 1 }}>Not Marked</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#b45309', marginTop: '3px' }}>
                    {monthlySummary.notMarkedDays} Days
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Class Average & Student Count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: monthlySummary.overallPercentage >= 75 ? '#15803d' : '#b45309',
                  backgroundColor: monthlySummary.overallPercentage >= 75 ? '#f0fdf4' : '#fffbeb',
                  border: `1px solid ${monthlySummary.overallPercentage >= 75 ? '#bbf7d0' : '#fde68a'}`,
                  padding: '3px 10px',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <i className="fa-solid fa-chart-pie" style={{ fontSize: '11px' }}></i>
                Average: {monthlySummary.overallPercentage}%
              </span>

              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#475569',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <i className="fa-solid fa-users" style={{ fontSize: '11px', color: '#64748b' }}></i>
                {monthlyFilteredStudents.length} Students
              </span>
            </div>
          </div>

          {/* 2. Compact Filters & Bulk Actions Toolbar */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}
          >
            {/* Filter Dropdowns & Search Box */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
              {/* Class Filter */}
              <div style={{ minWidth: '125px' }}>
                <select
                  className="form-control"
                  value={monthlyClassId}
                  onChange={(e) => {
                    setMonthlyClassId(e.target.value);
                    setMonthlyDivision('all');
                  }}
                  style={{ height: '34px', fontSize: '12px', padding: '4px 8px', borderRadius: '8px' }}
                >
                  <option value="all">All Classes</option>
                  {distinctClassNames.map((cName) => (
                    <option key={cName} value={cName}>
                      {cName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Division Filter */}
              <div style={{ minWidth: '95px' }}>
                <select
                  className="form-control"
                  value={monthlyDivision}
                  onChange={(e) => setMonthlyDivision(e.target.value)}
                  style={{ height: '34px', fontSize: '12px', padding: '4px 8px', borderRadius: '8px' }}
                >
                  <option value="all">All Divs</option>
                  {monthlyAvailableDivisions.map((div) => (
                    <option key={div} value={div}>
                      Div {div}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month Filter */}
              <div style={{ minWidth: '115px' }}>
                <select
                  className="form-control"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{ height: '34px', fontSize: '12px', padding: '4px 8px', borderRadius: '8px' }}
                >
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Year Filter */}
              <div style={{ minWidth: '80px' }}>
                <select
                  className="form-control"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  style={{ height: '34px', fontSize: '12px', padding: '4px 8px', borderRadius: '8px' }}
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Working Days Config */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '2px 8px',
                  height: '34px'
                }}
                title="Configurable total working days for this month (default 25)"
              >
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Working Days:
                </span>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={customWorkingDays}
                  onChange={(e) => setCustomWorkingDays(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
                  style={{
                    width: '44px',
                    height: '24px',
                    fontSize: '12px',
                    fontWeight: 700,
                    textAlign: 'center',
                    border: '1px solid #cbd5e1',
                    borderRadius: '5px',
                    padding: '0 2px',
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>

              {/* Attendance Status Filter */}
              <div style={{ minWidth: '135px' }}>
                <select
                  className="form-control"
                  value={monthlyStatusFilter}
                  onChange={(e) => setMonthlyStatusFilter(e.target.value)}
                  style={{ height: '34px', fontSize: '12px', padding: '4px 8px', borderRadius: '8px' }}
                >
                  <option value="all">All Status</option>
                  <option value="above75">Regular (≥ 75%)</option>
                  <option value="below75">Low (&lt; 75%)</option>
                  <option value="below60">Critical (&lt; 60%)</option>
                  <option value="sent">Sent to Parent</option>
                  <option value="not_sent">Not Sent</option>
                </select>
              </div>

              {/* Search Box */}
              <div style={{ flex: '1 1 180px', minWidth: '160px', maxWidth: '280px' }}>
                <div className="search-input-box" style={{ height: '34px', padding: '4px 10px', borderRadius: '8px' }}>
                  <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--text-muted)', fontSize: '11px' }}></i>
                  <input
                    type="text"
                    placeholder="Search name or roll..."
                    value={monthlySearchQuery}
                    onChange={(e) => setMonthlySearchQuery(e.target.value)}
                    style={{ fontSize: '12px' }}
                  />
                </div>
              </div>
            </div>

            {/* Compact Bulk Actions Dropdown Menu */}
            <div className="monthly-bulk-action-menu" style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMonthlyBulkMenu((prev) => !prev);
                }}
                disabled={isMonthlySending || monthlyFilteredStudents.length === 0}
                style={{
                  height: '34px',
                  padding: '6px 14px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#4f46e5',
                  boxShadow: '0 1px 3px rgba(79, 70, 229, 0.25)'
                }}
              >
                <i className="fa-solid fa-paper-plane" style={{ fontSize: '11px' }}></i>
                <span>Send & Webhook Actions</span>
                <i className="fa-solid fa-chevron-down" style={{ fontSize: '9px', marginLeft: '2px' }}></i>
              </button>

              {showMonthlyBulkMenu && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 4px)',
                    zIndex: 60,
                    minWidth: '240px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    boxShadow: '0 4px 18px rgba(15, 23, 42, 0.12)',
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowMonthlyBulkMenu(false);
                      setShowBulkMonthlyModal(true);
                    }}
                    disabled={isMonthlySending || monthlyFilteredStudents.length === 0}
                    style={{
                      border: 'none',
                      background: 'none',
                      padding: '8px 12px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: '#1e293b',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <i className="fa-solid fa-paper-plane" style={{ color: '#4f46e5', width: '16px' }}></i>
                    <span>Send to All Parents ({monthlyFilteredStudents.length})</span>
                  </button>

                </div>
              )}
            </div>
          </div>

          {/* 3. Essential 8-Column Table (Roll No, Student Name, Class, Present, Absent, Attendance %, Parent Contact, Actions) */}
          <div className="data-table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                  <th style={{ width: '55px', textAlign: 'center', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 8px' }}>Roll No</th>
                  <th style={{ textAlign: 'left', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 12px' }}>Student Name</th>
                  <th style={{ width: '120px', textAlign: 'left', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 10px', whiteSpace: 'nowrap' }}>Class</th>
                  <th style={{ width: '70px', textAlign: 'center', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 8px', whiteSpace: 'nowrap' }}>Present</th>
                  <th style={{ width: '70px', textAlign: 'center', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 8px', whiteSpace: 'nowrap' }}>Absent</th>
                  <th style={{ width: '110px', textAlign: 'center', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 10px', whiteSpace: 'nowrap' }}>Attendance %</th>
                  <th style={{ textAlign: 'left', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 12px' }}>Parent Contact</th>
                  <th style={{ width: '90px', textAlign: 'center', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 8px', whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {monthlyFilteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      <i className="fa-solid fa-users-slash" style={{ fontSize: '28px', marginBottom: '8px', display: 'block', opacity: 0.4 }}></i>
                      No students found matching current filters.
                    </td>
                  </tr>
                ) : (
                  pagedMonthlyStudents.map((s) => {
                    const stats = getStudentMonthlyStats(s);
                    const hasPhone = Boolean((s.parentPhone || '').replace(/\s+/g, ''));
                    const isGoodAttendance = stats.percentage >= 75;

                    const pctStyle = isGoodAttendance
                      ? { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' }
                      : stats.percentage >= 60
                      ? { bg: '#fef3c7', text: '#b45309', border: '#fde68a' }
                      : { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca' };

                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {/* 1. Roll No */}
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '10px 8px' }}>
                          <div className="roll-badge" style={{ margin: '0 auto', width: '32px', height: '32px', fontSize: '12px', fontWeight: 800 }}>
                            {s.rollNo || '-'}
                          </div>
                        </td>

                        {/* 2. Student Name */}
                        <td style={{ verticalAlign: 'middle', padding: '10px 12px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.name}>
                            {s.name}
                          </div>
                        </td>

                        {/* 3. Class */}
                        <td style={{ verticalAlign: 'middle', padding: '10px 10px' }}>
                          <ClassBadge classItem={stats.classDisplay} />
                        </td>

                        {/* 4. Present */}
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '9px 8px' }}>
                          <span
                            style={{
                              fontWeight: 800,
                              color: '#15803d',
                              fontSize: '12.5px',
                              background: '#f0fdf4',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              border: '1px solid #dcfce7',
                              display: 'inline-block',
                              minWidth: '28px'
                            }}
                          >
                            {stats.presentDays}
                          </span>
                        </td>

                        {/* 5. Absent */}
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '9px 8px' }}>
                          <span
                            style={{
                              fontWeight: 800,
                              color: stats.absentDays > 0 ? '#b91c1c' : '#64748b',
                              fontSize: '12.5px',
                              background: stats.absentDays > 0 ? '#fef2f2' : '#f8fafc',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              border: stats.absentDays > 0 ? '1px solid #fee2e2' : '1px solid #f1f5f9',
                              display: 'inline-block',
                              minWidth: '28px'
                            }}
                          >
                            {stats.absentDays}
                          </span>
                        </td>

                        {/* 6. Attendance % */}
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '9px 10px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 800,
                              backgroundColor: pctStyle.bg,
                              color: pctStyle.text,
                              border: `1px solid ${pctStyle.border}`
                            }}
                          >
                            {stats.percentage}%
                          </span>
                        </td>

                        {/* 7. Parent Contact */}
                        <td style={{ verticalAlign: 'middle', padding: '9px 12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 600, fontSize: '12px', color: '#1e293b' }}>
                                {s.parentName || 'Parent'}
                              </span>
                              {stats.status === 'Sent Successfully' && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    color: '#15803d',
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '2px'
                                  }}
                                  title="Sent Successfully"
                                >
                                  <i className="fa-solid fa-circle-check" style={{ fontSize: '9px' }}></i> Sent
                                </span>
                              )}
                            </div>
                            {hasPhone ? (
                              <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <i className="fa-solid fa-phone" style={{ fontSize: '9px', color: '#94a3b8' }}></i>
                                {s.parentPhone}
                              </div>
                            ) : (
                              <span style={{ fontSize: '10.5px', color: '#dc2626', fontWeight: 600 }}>
                                No phone number
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 8. Actions (Compact Dropdown Menu) */}
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '9px 10px' }}>
                          <div className="monthly-row-action-menu" style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMonthlyRowMenu(activeMonthlyRowMenu === s.id ? null : s.id);
                              }}
                              style={{
                                padding: '4px 9px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                borderRadius: '7px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#334155',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                              }}
                              title="Actions"
                            >
                              <span>Actions</span>
                              <i className="fa-solid fa-chevron-down" style={{ fontSize: '8.5px', color: '#64748b' }}></i>
                            </button>

                            {activeMonthlyRowMenu === s.id && (
                              <div
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: 'calc(100% + 4px)',
                                  zIndex: 50,
                                  minWidth: '165px',
                                  backgroundColor: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '9px',
                                  boxShadow: '0 4px 16px rgba(15, 23, 42, 0.12)',
                                  padding: '4px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                  textAlign: 'left'
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMonthlyRowMenu(null);
                                    handleInitiateMonthlySend(s);
                                  }}
                                  disabled={isMonthlySending}
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    padding: '6px 10px',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    color: '#1e293b',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '7px',
                                    width: '100%',
                                    textAlign: 'left'
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  <i className="fa-solid fa-paper-plane" style={{ color: '#4f46e5', width: '14px', fontSize: '11px' }}></i>
                                  <span>{stats.status === 'Sent Successfully' ? 'Resend to Parent' : 'Send to Parent'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMonthlyRowMenu(null);
                                    handleOpenMonthlyWebhookSingle(s);
                                  }}
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    padding: '6px 10px',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    color: '#1e293b',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '7px',
                                    width: '100%',
                                    textAlign: 'left'
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  <i className="fa-solid fa-satellite-dish" style={{ color: '#7c3aed', width: '14px', fontSize: '11px' }}></i>
                                  <span>Send to Webhook</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {monthlyFilteredStudents.length > 50 && (
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
                  Showing <strong style={{ color: '#0f172a' }}>{monthlyPageSize === 'all' ? 1 : ((monthlyPage - 1) * monthlyPageSize + 1)}</strong> to{' '}
                  <strong style={{ color: '#0f172a' }}>
                    {monthlyPageSize === 'all' ? monthlyFilteredStudents.length : Math.min(monthlyPage * monthlyPageSize, monthlyFilteredStudents.length)}
                  </strong>{' '}
                  of <strong style={{ color: '#0f172a' }}>{monthlyFilteredStudents.length}</strong> students
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 600 }}>Rows:</span>
                    <select
                      value={monthlyPageSize}
                      onChange={(e) => {
                        const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                        setMonthlyPageSize(val);
                        setMonthlyPage(1);
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
                      <option value="all">All ({monthlyFilteredStudents.length})</option>
                    </select>
                  </div>
                  {monthlyPageSize !== 'all' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        disabled={monthlyPage <= 1}
                        onClick={() => setMonthlyPage((p) => Math.max(1, p - 1))}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          background: monthlyPage <= 1 ? '#f8fafc' : '#ffffff',
                          color: monthlyPage <= 1 ? '#94a3b8' : '#334155',
                          cursor: monthlyPage <= 1 ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                          fontSize: '12px'
                        }}
                      >
                        Previous
                      </button>
                      <span style={{ fontSize: '12.5px', color: '#475569', fontWeight: 600, minWidth: '85px', textAlign: 'center' }}>
                        Page {monthlyPage} of {totalMonthlyPages || 1}
                      </span>
                      <button
                        type="button"
                        disabled={monthlyPage >= totalMonthlyPages}
                        onClick={() => setMonthlyPage((p) => Math.min(totalMonthlyPages, p + 1))}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          background: monthlyPage >= totalMonthlyPages ? '#f8fafc' : '#ffffff',
                          color: monthlyPage >= totalMonthlyPages ? '#94a3b8' : '#334155',
                          cursor: monthlyPage >= totalMonthlyPages ? 'not-allowed' : 'pointer',
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONFIRMATION & RESULT MODALS                                              */}
      {/* ========================================================================= */}

      {/* 1. Modal: Single Daily Send Confirmation */}
      {confirmDailyModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                <i className="fa-solid fa-paper-plane" style={{ color: 'var(--primary)' }}></i>
                Send Today's Attendance
              </h3>
              <button className="close-btn" onClick={() => setConfirmDailyModal(null)} disabled={isDailySending}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '18px 24px' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '14px' }}>
                Do you want to send today's attendance to this parent?
              </p>

              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '14px',
                  fontSize: '13px'
                }}
              >
                <div style={{ marginBottom: '6px' }}>
                  <strong>Student:</strong> {confirmDailyModal.student.name} (Roll No: {confirmDailyModal.student.rollNo || '-'})
                </div>
                <div style={{ marginBottom: '6px' }}>
                  <strong>Class & Division:</strong> {confirmDailyModal.clsName} - {confirmDailyModal.divName}
                </div>
                <div style={{ marginBottom: '6px' }}>
                  <strong>Date:</strong> {confirmDailyModal.date}
                </div>
                <div style={{ marginBottom: '6px' }}>
                  <strong>Status:</strong>{' '}
                  <span style={{ fontWeight: 800, color: confirmDailyModal.status === 'Present' ? '#15803d' : '#b91c1c' }}>
                    {confirmDailyModal.status}
                  </span>
                </div>
                <div>
                  <strong>Parent Phone:</strong>{' '}
                  {confirmDailyModal.student.parentPhone ? (
                    <span style={{ fontFamily: 'monospace' }}>{confirmDailyModal.student.parentPhone}</span>
                  ) : (
                    <span style={{ color: '#ef4444', fontStyle: 'italic' }}>Not registered (will fail)</span>
                  )}
                </div>
              </div>

              {/* Message Preview */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Message Preview:
                </label>
                <pre
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#e2e8f0',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    lineHeight: '1.4'
                  }}
                >
                  {confirmDailyModal.message}
                </pre>
              </div>

              {/* Automated WhatsApp Delivery Indicator */}
              <div
                style={{
                  marginTop: '12px',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#166534',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-solid fa-paper-plane" style={{ fontSize: '15px', color: '#16a34a' }}></i>
                <span>
                  <strong>App & WhatsApp Delivery:</strong> Will dispatch message directly to parent's WhatsApp via 1automations Webhook and send in-app notification to the mobile app.
                </span>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmDailyModal(null)}
                disabled={isDailySending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmDailySend}
                disabled={isDailySending}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {isDailySending ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane"></i>
                    <span>Confirm & Send</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal: Bulk Daily Send Confirmation */}
      {showBulkDailyModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-card" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                <i className="fa-solid fa-bullhorn" style={{ color: 'var(--primary)' }}></i>
                Send Today's Attendance to All
              </h3>
              <button className="close-btn" onClick={() => setShowBulkDailyModal(false)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '18px 24px' }}>
              <p style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>
                Send today's attendance to all parents?
              </p>

              {(() => {
                const total = filteredDailyStudents.length;
                const markedStudents = filteredDailyStudents.filter((s) => getStudentStatus(s) !== 'Not Marked');
                const notMarkedCount = total - markedStudents.length;
                const withPhone = markedStudents.filter((s) => (s.parentPhone || '').replace(/\s+/g, '')).length;
                const missing = markedStudents.length - withPhone;

                return (
                  <div>
                    {markedStudents.length === 0 ? (
                      <div
                        style={{
                          backgroundColor: '#fef3c7',
                          border: '1px solid #fde68a',
                          color: '#92400e',
                          borderRadius: '12px',
                          padding: '14px 18px',
                          marginBottom: '14px',
                          fontSize: '13px',
                          lineHeight: '1.5'
                        }}
                      >
                        <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }}></i>
                        <strong>Notice:</strong> Attendance has not been taken for any student today yet. Please mark students as Present or Absent before sending alerts to parents.
                      </div>
                    ) : (
                      <div
                        style={{
                          backgroundColor: '#f8fafc',
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px',
                          padding: '14px 18px',
                          marginBottom: '14px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Attendance Marked:</span>
                          <strong>{markedStudents.length} / {total}</strong>
                        </div>
                        {notMarkedCount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#64748b' }}>
                            <span>Not Marked (will be skipped):</span>
                            <strong>{notMarkedCount}</strong>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#15803d' }}>
                          <span>Valid Parent Mobile:</span>
                          <strong>{withPhone}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#b91c1c' }}>
                          <span>Missing Parent Contact (skipped):</span>
                          <strong>{missing}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Parents will receive real-time notifications in the Android app and school alerts.
              </p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowBulkDailyModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmBulkDailySend}
                disabled={filteredDailyStudents.filter((s) => getStudentStatus(s) !== 'Not Marked').length === 0}
                style={{ backgroundColor: '#4f46e5', borderColor: '#4338ca', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="fa-solid fa-paper-plane"></i>
                <span>Send to All Parents</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal: Bulk Daily Result Summary */}
      {bulkDailyResult && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-card" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                <i className="fa-solid fa-circle-check" style={{ color: '#10b981' }}></i>
                Attendance Dispatch Summary
              </h3>
              <button className="close-btn" onClick={() => setBulkDailyResult(null)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '18px 24px' }}>
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  fontSize: '13.5px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Students:</span>
                  <strong style={{ fontSize: '15px' }}>{bulkDailyResult.total}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#15803d' }}>
                  <span>Sent Successfully:</span>
                  <strong style={{ fontSize: '15px' }}>{bulkDailyResult.sentCount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c' }}>
                  <span>Missing Contact:</span>
                  <strong style={{ fontSize: '15px' }}>{bulkDailyResult.missingCount}</strong>
                </div>
                {bulkDailyResult.failedCount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', color: '#ef4444' }}>
                    <span>Failed Deliveries:</span>
                    <strong style={{ fontSize: '15px' }}>{bulkDailyResult.failedCount}</strong>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setBulkDailyResult(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}



      {/* 4. Modal: Single Monthly Send Confirmation */}
      {confirmMonthlyModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                <i className="fa-solid fa-paper-plane" style={{ color: 'var(--primary)' }}></i>
                Send Monthly Attendance
              </h3>
              <button className="close-btn" onClick={() => setConfirmMonthlyModal(null)} disabled={isMonthlySending}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '18px 24px' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '14px' }}>
                Do you want to send this monthly attendance summary to the parent?
              </p>

              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '14px',
                  fontSize: '13px'
                }}
              >
                <div style={{ marginBottom: '6px' }}>
                  <strong>Student:</strong> {confirmMonthlyModal.student.name} (Roll: {confirmMonthlyModal.student.rollNo || '-'})
                </div>
                <div style={{ marginBottom: '6px' }}>
                  <strong>Period:</strong> {selectedMonth} {selectedYear}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', background: '#ffffff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', margin: '8px 0', fontSize: '12.5px' }}>
                  <div><strong>Total Working Days:</strong> {confirmMonthlyModal.stats.totalWorkingDays}</div>
                  <div><strong style={{ color: '#2563eb' }}>Attendance Taken:</strong> {confirmMonthlyModal.stats.attendanceTakenDays} Days</div>
                  <div><strong style={{ color: '#b45309' }}>Attendance Not Marked:</strong> {confirmMonthlyModal.stats.notMarkedDays} Days</div>
                  <div><strong style={{ color: '#15803d' }}>Present:</strong> {confirmMonthlyModal.stats.presentDays} Days</div>
                  <div><strong style={{ color: '#b91c1c' }}>Absent:</strong> {confirmMonthlyModal.stats.absentDays} Days</div>
                  <div><strong>Attendance:</strong> <span style={{ fontWeight: 800, color: confirmMonthlyModal.stats.percentage >= 75 ? '#15803d' : '#b91c1c' }}>{confirmMonthlyModal.stats.percentage}%</span></div>
                </div>
                <div>
                  <strong>Parent Phone:</strong>{' '}
                  {confirmMonthlyModal.student.parentPhone ? (
                    <span style={{ fontFamily: 'monospace' }}>{confirmMonthlyModal.student.parentPhone}</span>
                  ) : (
                    <span style={{ color: '#ef4444', fontStyle: 'italic' }}>Missing (will fail)</span>
                  )}
                </div>
              </div>

              {/* Message Preview */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Message Preview:
                </label>
                <pre
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#e2e8f0',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    lineHeight: '1.4'
                  }}
                >
                  {confirmMonthlyModal.message}
                </pre>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmMonthlyModal(null)}
                disabled={isMonthlySending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmMonthlySend}
                disabled={isMonthlySending}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {isMonthlySending ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane"></i>
                    <span>Confirm & Send</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal: Bulk Monthly Send Confirmation */}
      {showBulkMonthlyModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-card" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                <i className="fa-solid fa-envelopes-bulk" style={{ color: 'var(--primary)' }}></i>
                Send Monthly Attendance to All
              </h3>
              <button className="close-btn" onClick={() => setShowBulkMonthlyModal(false)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '18px 24px' }}>
              <p style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>
                Send monthly attendance report to all parents?
              </p>

              {(() => {
                const total = monthlyFilteredStudents.length;
                const withPhone = monthlyFilteredStudents.filter((s) => (s.parentPhone || '').replace(/\s+/g, '')).length;
                const missing = total - withPhone;

                return (
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '14px 18px',
                      marginBottom: '14px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Month & Year:</span>
                      <strong>{selectedMonth} {selectedYear}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Students:</span>
                      <strong>{total}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#15803d' }}>
                      <span>Valid Parent Mobile:</span>
                      <strong>{withPhone}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#b91c1c' }}>
                      <span>Missing Parent Contact (skipped):</span>
                      <strong>{missing}</strong>
                    </div>
                  </div>
                );
              })()}

              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Summaries will be logged in monthly history and pushed directly to parents' Android apps via Firebase.
              </p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowBulkMonthlyModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmBulkMonthlySend}
                style={{ backgroundColor: '#4f46e5', borderColor: '#4338ca', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="fa-solid fa-paper-plane"></i>
                <span>Send to All Parents</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal: Bulk Monthly Result Summary */}
      {bulkMonthlyResult && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-card" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                <i className="fa-solid fa-circle-check" style={{ color: '#10b981' }}></i>
                Monthly Report Dispatch Summary
              </h3>
              <button className="close-btn" onClick={() => setBulkMonthlyResult(null)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '18px 24px' }}>
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  fontSize: '13.5px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Students:</span>
                  <strong style={{ fontSize: '15px' }}>{bulkMonthlyResult.total}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#15803d' }}>
                  <span>Sent Successfully:</span>
                  <strong style={{ fontSize: '15px' }}>{bulkMonthlyResult.sentCount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c' }}>
                  <span>Missing Contact:</span>
                  <strong style={{ fontSize: '15px' }}>{bulkMonthlyResult.missingCount}</strong>
                </div>
                {bulkMonthlyResult.failedCount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', color: '#ef4444' }}>
                    <span>Failed Deliveries:</span>
                    <strong style={{ fontSize: '15px' }}>{bulkMonthlyResult.failedCount}</strong>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setBulkMonthlyResult(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT STUDENT MODAL                                                        */}
      {/* ========================================================================= */}
      {editingStudent && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                <i className="fa-solid fa-pen-to-square" style={{ color: 'var(--primary)' }}></i>
                Edit Student Details
              </h3>
              <button className="close-btn" onClick={() => setEditingStudent(null)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleSaveStudentEdit}>
              <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Student Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Rahul Sharma"
                    value={editStudentName}
                    onChange={(e) => setEditStudentName(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                      Roll Number
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 101"
                      value={editStudentRoll}
                      onChange={(e) => setEditStudentRoll(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                      Assign Class *
                    </label>
                    <select
                      className="form-control"
                      value={editStudentClassId}
                      onChange={(e) => setEditStudentClassId(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      {(state.classes || []).map((c) => (
                        <option key={c.id} value={c.id}>
                          Class {c.name} {c.section ? `(${c.section})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Parent / Guardian Name
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Rajesh Sharma"
                    value={editStudentParentName}
                    onChange={(e) => setEditStudentParentName(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Parent WhatsApp Phone (10 digits)
                  </label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="e.g. 9876543210"
                    value={editStudentParentPhone}
                    onChange={(e) => setEditStudentParentPhone(e.target.value)}
                    style={{ width: '100%' }}
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                    Siblings can share the same phone number for parent portal access.
                  </small>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingStudent(null)}
                  disabled={isSubmittingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingEdit}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {isSubmittingEdit ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-floppy-disk"></i>
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
