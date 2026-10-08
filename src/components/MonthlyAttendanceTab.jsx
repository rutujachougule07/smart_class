import React, { useState, useMemo, useEffect } from 'react';
import { formatWhatsAppPhone } from '../services/webhookService';

export default function MonthlyAttendanceTab({
  state,
  onSendMonthlyAttendance,
  onSendBulkMonthlyAttendance,
  updateStudentAttendance
}) {
  const currentDate = new Date();
  const currentMonthName = currentDate.toLocaleString('en-US', { month: 'long' });
  const currentYear = currentDate.getFullYear();

  const [selectedClassId, setSelectedClassId] = useState('all');
  const [selectedDivision, setSelectedDivision] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(currentMonthName);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('2026-2027');
  const [customWorkingDays, setCustomWorkingDays] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all'); // 'all' | 'General' | specific subject e.g. 'Mathematics'
  const [activeRowMenu, setActiveRowMenu] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('sheet'); // 'sheet' | 'history'

  // Close row actions menu on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.monthly-row-action-menu')) {
        setActiveRowMenu(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Modals state
  const [confirmSingleModal, setConfirmSingleModal] = useState(null); // student object with stats
  const [confirmBulkModal, setConfirmBulkModal] = useState(false);
  const [dateWiseModal, setDateWiseModal] = useState(null); // student object with dates
  const [viewHistoryMessageModal, setViewHistoryMessageModal] = useState(null); // history item
  const [isSending, setIsSending] = useState(false);
  const [notificationBanner, setNotificationBanner] = useState(null);

  // Month metadata
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthIndex = months.indexOf(selectedMonth);
  const monthNumStr = String(monthIndex + 1).padStart(2, '0');
  const yearMonthKey = `${selectedYear}-${monthNumStr}`; // e.g. '2026-09'

  // Helper to format class name cleanly without duplicating "Class" or missing section
  const formatClassName = (cls) => {
    if (!cls) return 'Class Unassigned';
    const rawName = String(cls.name || '').trim();
    const rawSec = String(cls.section || '').trim();
    if (rawSec && !rawName.toLowerCase().includes(rawSec.toLowerCase())) {
      return `${rawName} - ${rawSec}`;
    }
    return rawName || 'Class';
  };

  // Distinct Classes and Divisions
  const uniqueClassNames = useMemo(() => {
    const names = new Set();
    state.classes.forEach((c) => {
      if (c.name) names.add(String(c.name).trim());
    });
    return Array.from(names).sort();
  }, [state.classes]);

  const uniqueDivisions = useMemo(() => {
    const sections = new Set();
    state.classes.forEach((c) => {
      if (c.section && c.section.trim()) {
        sections.add(String(c.section).trim().toUpperCase());
      } else if (c.name) {
        const m = String(c.name).trim().match(/[0-9]+\s*([A-Za-z]+)$/);
        if (m && m[1]) {
          sections.add(m[1].toUpperCase());
        }
      }
    });
    return Array.from(sections).sort();
  }, [state.classes]);

  // Distinct Subjects across curriculum and attendance records
  const availableSubjects = useMemo(() => {
    const set = new Set();
    state.classes.forEach((c) => {
      if (Array.isArray(c.subjects)) {
        c.subjects.forEach((s) => s && set.add(String(s).trim()));
      }
    });
    (state.attendance || []).forEach((a) => {
      if (a && a.subject && String(a.subject).trim() && String(a.subject).trim() !== 'General') {
        set.add(String(a.subject).trim());
      }
    });
    return Array.from(set).sort();
  }, [state.classes, state.attendance]);

  // Days in selected month
  const daysInSelectedMonth = useMemo(() => {
    return new Date(selectedYear, monthIndex + 1, 0).getDate();
  }, [selectedYear, monthIndex]);

  // Total working days (standardized to 25 working days per school calendar)
  const defaultWorkingDays = 25;

  const workingDays = customWorkingDays !== '' && !isNaN(Number(customWorkingDays))
    ? Number(customWorkingDays)
    : defaultWorkingDays;

  // Map attendance records for the selected month, filtered by selectedSubject
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
      if (!status) return;

      // Filter by selected lecture / subject
      if (selectedSubject !== 'all') {
        const recordSubj = String(a.subject || 'General').trim().toLowerCase();
        if (recordSubj !== selectedSubject.toLowerCase()) return;
      }

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
  }, [state.attendance, yearMonthKey, selectedSubject]);

  // Map sent history for quick status resolution
  const sentHistoryMap = useMemo(() => {
    const map = new Map(); // `${studentId}_${month}_${year}` -> history record
    (state.monthlyAttendanceHistory || []).forEach((h) => {
      if (!h || !h.studentId) return;
      const key = `${h.studentId}_${h.month}_${h.year || selectedYear}`;
      // Keep newest
      if (!map.has(key)) {
        map.set(key, h);
      }
    });
    return map;
  }, [state.monthlyAttendanceHistory, selectedYear]);

  // Compute student stats
  const getStudentMonthlyStats = (student) => {
    const sMap = monthAttendanceMap.get(student.id) || (student.rollNo ? monthAttendanceMap.get(String(student.rollNo)) : null);
    
    let presentCount = 0;
    let absentCount = 0;

    if (sMap) {
      for (const status of sMap.values()) {
        if (status === 'Present') presentCount++;
        else if (status === 'Absent') absentCount++;
      }
    }

    // 1. Total working days is 25 (or customized)
    const totalWorking = Math.max(1, workingDays);
    const finalPresent = presentCount;
    const finalAbsent = absentCount;
    // 2. Attendance taken days (only days with recorded attendance)
    const attendanceTakenDays = finalPresent + finalAbsent;
    // 3. Days without attendance records are "Attendance Not Marked" (NOT Absent)
    const notMarkedDays = Math.max(0, totalWorking - attendanceTakenDays);
    // 4. Calculate % using ONLY days on which attendance was actually taken
    const percentage = attendanceTakenDays > 0 ? Number(((finalPresent / attendanceTakenDays) * 100).toFixed(1)) : 0;

    const historyKey = `${student.id}_${selectedMonth}_${selectedYear}`;
    const historyItem = sentHistoryMap.get(historyKey);

    let status = 'Not Sent';
    if (historyItem) {
      status = historyItem.status || 'Sent Successfully';
    } else if (!student.parentPhone || !student.parentPhone.trim()) {
      status = 'Contact Number Missing';
    }

    const cls = state.classes.find((c) => c.id === student.classId);
    const classDisplay = formatClassName(cls);

    return {
      totalWorkingDays: totalWorking,
      attendanceTakenDays,
      notMarkedDays,
      presentDays: finalPresent,
      absentDays: finalAbsent,
      percentage,
      status,
      historyItem,
      classDisplay
    };
  };

  // Filter students based on Class, Division, Attendance Status, and Search Query
  const filteredStudents = useMemo(() => {
    const list = state.students.filter((s) => {
      const cls = state.classes.find((c) => c.id === s.classId);
      
      // Class filter
      if (selectedClassId !== 'all') {
        if (!cls || String(cls.name).trim().toLowerCase() !== selectedClassId.toLowerCase()) {
          return false;
        }
      }

      // Division filter
      if (selectedDivision !== 'all') {
        if (!cls) return false;
        const directSec = String(cls.section || '').trim().toLowerCase();
        const nameHasSec = String(cls.name || '').trim().toLowerCase().endsWith(selectedDivision.toLowerCase());
        if (directSec !== selectedDivision.toLowerCase() && !nameHasSec) {
          return false;
        }
      }

      // Attendance status filter
      if (statusFilter !== 'all') {
        const stats = getStudentMonthlyStats(s);
        if (statusFilter === 'above75' && stats.percentage < 75) return false;
        if (statusFilter === 'below75' && stats.percentage >= 75) return false;
        if (statusFilter === 'below60' && stats.percentage >= 60) return false;
        if (statusFilter === 'sent' && stats.status !== 'Sent Successfully') return false;
        if (statusFilter === 'not_sent' && stats.status === 'Sent Successfully') return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (s.name || '').toLowerCase().includes(q);
        const matchesRoll = String(s.rollNo || '').toLowerCase().includes(q);
        if (!matchesName && !matchesRoll) return false;
      }

      return true;
    });

    const parseRoll = (roll) => {
      if (roll === undefined || roll === null || roll === '') return 999999;
      const num = Number(roll);
      if (!isNaN(num)) return num;
      const match = String(roll).match(/\d+/);
      return match ? parseInt(match[0], 10) : 999999;
    };

    return [...list].sort((a, b) => {
      const rollA = parseRoll(a.rollNo);
      const rollB = parseRoll(b.rollNo);
      if (rollA !== rollB) return rollA - rollB;
      return String(a.rollNo || '').localeCompare(String(b.rollNo || ''), undefined, { numeric: true, sensitivity: 'base' }) ||
        (a.name || '').localeCompare(b.name || '');
    });
  }, [state.students, state.classes, selectedClassId, selectedDivision, searchQuery, statusFilter, monthAttendanceMap, selectedMonth, selectedYear, sentHistoryMap]);

  // Generate standardized message matching user specification
  const generateParentMessage = (student, stats) => {
    const schoolName = state.schoolProfile?.schoolName || 'SmartClass Academy';
    const remarks = stats.percentage < 75
      ? 'Remarks: Attendance is below 75%. Attention required. Regular attendance is necessary for academic progress.'
      : 'Remarks: Satisfactory attendance record. Keep up the good work!';

    return `Dear Parent,
Here is the monthly attendance summary from ${schoolName}:

• School Name: ${schoolName}
• Student Name: ${student.name}
• Roll Number: ${student.rollNo || 'N/A'}
• Class & Division: ${stats.classDisplay}
• Month & Year: ${selectedMonth} ${selectedYear}
• Total Working Days: ${stats.totalWorkingDays}
• Attendance Taken: ${stats.attendanceTakenDays} Days
• Attendance Not Marked: ${stats.notMarkedDays} Days
• Present Days: ${stats.presentDays}
• Absent Days: ${stats.absentDays}
• Attendance Percentage: ${stats.percentage}%

${remarks}

Please review the attendance regularly.`;
  };

  // Trigger individual send
  const handleConfirmSingleSend = async () => {
    if (!confirmSingleModal) return;
    const { student, stats } = confirmSingleModal;
    setIsSending(true);

    try {
      if (onSendMonthlyAttendance) {
        await onSendMonthlyAttendance({
          student,
          month: selectedMonth,
          year: selectedYear,
          academicYear: selectedAcademicYear,
          stats,
          message: generateParentMessage(student, stats)
        });
      }

      setNotificationBanner({
        type: stats.status === 'Contact Number Missing' ? 'warning' : 'success',
        text: stats.status === 'Contact Number Missing'
          ? `Parent contact number not available for ${student.name}. Logged as Contact Number Missing.`
          : `Monthly attendance summary for ${student.name} sent successfully to parent (${student.parentPhone})!`
      });
      setConfirmSingleModal(null);
    } catch (err) {
      setNotificationBanner({
        type: 'error',
        text: `Failed to send attendance: ${err.message || err.toString()}`
      });
    } finally {
      setIsSending(false);
      setTimeout(() => setNotificationBanner(null), 5000);
    }
  };

  // Trigger bulk send
  const handleConfirmBulkSend = async () => {
    setIsSending(true);
    try {
      const targets = filteredStudents.map((student) => {
        const stats = getStudentMonthlyStats(student);
        return {
          student,
          month: selectedMonth,
          year: selectedYear,
          academicYear: selectedAcademicYear,
          stats,
          message: generateParentMessage(student, stats)
        };
      });

      if (onSendBulkMonthlyAttendance) {
        const res = await onSendBulkMonthlyAttendance(targets);
        setNotificationBanner({
          type: 'success',
          text: `Bulk dispatch completed: ${res?.sentCount || targets.length} sent successfully, ${res?.missingCount || 0} missing phone numbers.`
        });
      }

      setConfirmBulkModal(false);
    } catch (err) {
      setNotificationBanner({
        type: 'error',
        text: `Bulk dispatch failed: ${err.message || err.toString()}`
      });
    } finally {
      setIsSending(false);
      setTimeout(() => setNotificationBanner(null), 6000);
    }
  };

  // Export to Excel
  const exportMonthlyExcel = () => {
    let csv = `\uFEFF"Roll No","Student Name","Class & Division","Month","Academic Year","Total Working Days","Attendance Taken","Attendance Not Marked","Present Days","Absent Days","Attendance %","Parent Name","Parent Phone","Send Status"\n`;

    filteredStudents.forEach((s) => {
      const stats = getStudentMonthlyStats(s);
      csv += `"${s.rollNo}","${s.name}","${stats.classDisplay}","${selectedMonth} ${selectedYear}","${selectedAcademicYear}","${stats.totalWorkingDays}","${stats.attendanceTakenDays}","${stats.notMarkedDays}","${stats.presentDays}","${stats.absentDays}","${stats.percentage}%","${s.parentName || ''}","${s.parentPhone || 'Not Available'}","${stats.status}"\n`;
    });

    const blob = new Blob([csv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Monthly_Attendance_${selectedMonth}_${selectedYear}_${selectedClassId}_${selectedDivision}.xls`;
    link.click();
  };

  // Status Badge component
  const renderStatusBadge = (status) => {
    if (status === 'Sent Successfully') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
          <i className="fa-solid fa-circle-check"></i> Sent Successfully
        </span>
      );
    }
    if (status === 'Contact Number Missing') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }} title="Parent contact number not available">
          <i className="fa-solid fa-triangle-exclamation"></i> Contact Missing
        </span>
      );
    }
    if (status === 'Failed') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
          <i className="fa-solid fa-circle-xmark"></i> Failed
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
        <i className="fa-solid fa-clock"></i> Not Sent
      </span>
    );
  };

  // Summary counts for filtered set
  const summaryCounts = useMemo(() => {
    let totalEligible = filteredStudents.length;
    let withPhones = 0;
    let missingPhones = 0;
    let alreadySent = 0;

    filteredStudents.forEach((s) => {
      if (s.parentPhone && s.parentPhone.trim()) withPhones++;
      else missingPhones++;

      const key = `${s.id}_${selectedMonth}_${selectedYear}`;
      if (sentHistoryMap.has(key)) alreadySent++;
    });

    return { totalEligible, withPhones, missingPhones, alreadySent };
  }, [filteredStudents, selectedMonth, selectedYear, sentHistoryMap]);

  // Overall attendance metrics summary for selected class/month
  const monthlySummary = useMemo(() => {
    const totalWorking = Math.max(1, workingDays);
    const students = filteredStudents;
    const totalStudents = students.length;

    if (totalStudents === 0) {
      return {
        totalWorkingDays: totalWorking,
        attendanceTakenDays: 0,
        notMarkedDays: totalWorking,
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
    const classNotMarkedDays = Math.max(0, totalWorking - classAttendanceTakenDays);
    const avgPresent = totalStudents > 0 ? Number((totalPresentSum / totalStudents).toFixed(1)) : 0;
    const avgAbsent = totalStudents > 0 ? Number((totalAbsentSum / totalStudents).toFixed(1)) : 0;
    const overallPercentage = totalTakenSum > 0
      ? Number(((totalPresentSum / totalTakenSum) * 100).toFixed(1))
      : 0;

    return {
      totalWorkingDays: totalWorking,
      attendanceTakenDays: classAttendanceTakenDays,
      notMarkedDays: classNotMarkedDays,
      avgPresent,
      avgAbsent,
      overallPercentage,
      totalStudents
    };
  }, [filteredStudents, monthAttendanceMap, workingDays]);

  return (
    <div>
      {/* Toast Notification Banner */}
      {notificationBanner && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 18px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 600,
          fontSize: '13.5px',
          backgroundColor: notificationBanner.type === 'success' ? '#dcfce7' : (notificationBanner.type === 'warning' ? '#fef3c7' : '#fee2e2'),
          color: notificationBanner.type === 'success' ? '#166534' : (notificationBanner.type === 'warning' ? '#92400e' : '#991b1b'),
          border: `1px solid ${notificationBanner.type === 'success' ? '#86efac' : (notificationBanner.type === 'warning' ? '#fde047' : '#fca5a5')}`,
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
        }}>
          <i className={`fa-solid ${notificationBanner.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} style={{ fontSize: '16px' }}></i>
          <span style={{ flex: 1 }}>{notificationBanner.text}</span>
          <i className="fa-solid fa-xmark" style={{ cursor: 'pointer' }} onClick={() => setNotificationBanner(null)}></i>
        </div>
      )}

      {/* Main Filter & Header Card */}
      <div className="data-card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-calendar-check" style={{ color: 'var(--primary)' }}></i>
              Monthly Attendance for Parents
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Calculate working days, verify attendance percentage, and send official monthly summaries to parents.
            </p>
          </div>

          {/* Sub-tab Navigation Switcher */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px', gap: '4px' }}>
            <button
              onClick={() => setActiveSubTab('sheet')}
              style={{
                border: 'none',
                padding: '6px 14px',
                borderRadius: '7px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                background: activeSubTab === 'sheet' ? '#ffffff' : 'transparent',
                color: activeSubTab === 'sheet' ? 'var(--primary)' : 'var(--text-secondary)',
                boxShadow: activeSubTab === 'sheet' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-solid fa-table-list"></i> Monthly Sheet & Dispatch
            </button>
            <button
              onClick={() => setActiveSubTab('history')}
              style={{
                border: 'none',
                padding: '6px 14px',
                borderRadius: '7px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                background: activeSubTab === 'history' ? '#ffffff' : 'transparent',
                color: activeSubTab === 'history' ? 'var(--primary)' : 'var(--text-secondary)',
                boxShadow: activeSubTab === 'history' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-solid fa-clock-rotate-left"></i> Sent History Log
              <span className="nav-badge" style={{ marginLeft: '4px', fontSize: '10px', padding: '1px 6px' }}>
                {(state.monthlyAttendanceHistory || []).length}
              </span>
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '10px',
          alignItems: 'flex-end',
          background: '#f8fafc',
          padding: '12px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0'
        }}>
          {/* 1. Class */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              <i className="fa-solid fa-door-open" style={{ marginRight: '4px', color: 'var(--primary)' }}></i> Class
            </label>
            <select
              className="form-control"
              style={{ height: '34px', fontSize: '12.5px' }}
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
            >
              <option value="all">All Classes</option>
              {uniqueClassNames.map((name) => (
                <option key={name} value={name}>
                  {name.toLowerCase().startsWith('class') ? name : `Class ${name}`}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Division */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              <i className="fa-solid fa-layer-group" style={{ marginRight: '4px', color: 'var(--primary)' }}></i> Division
            </label>
            <select
              className="form-control"
              style={{ height: '34px', fontSize: '12.5px' }}
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
            >
              <option value="all">All Divisions</option>
              {uniqueDivisions.map((sec) => (
                <option key={sec} value={sec}>Division {sec}</option>
              ))}
            </select>
          </div>

          {/* 3. Month */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              <i className="fa-solid fa-calendar-days" style={{ marginRight: '4px', color: 'var(--primary)' }}></i> Month
            </label>
            <select
              className="form-control"
              style={{ height: '34px', fontSize: '12.5px' }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* 4. Academic Year */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              <i className="fa-solid fa-graduation-cap" style={{ marginRight: '4px', color: 'var(--primary)' }}></i> Academic Year
            </label>
            <select
              className="form-control"
              style={{ height: '34px', fontSize: '12.5px' }}
              value={selectedAcademicYear}
              onChange={(e) => setSelectedAcademicYear(e.target.value)}
            >
              <option value="2026-2027">2026-2027</option>
              <option value="2025-2026">2025-2026</option>
              <option value="2024-2025">2024-2025</option>
            </select>
          </div>

          {/* 5. Lecture / Subject Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              <i className="fa-solid fa-book-open" style={{ marginRight: '4px', color: 'var(--primary)' }}></i> Lecture / Subject
            </label>
            <select
              className="form-control"
              style={{ height: '34px', fontSize: '12.5px' }}
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              <option value="all">All Lectures (Overall Daily)</option>
              {availableSubjects.map((subj) => (
                <option key={subj} value={subj}>
                  {subj === 'General' ? 'General (Daily Whole Day)' : `Lecture: ${subj}`}
                </option>
              ))}
            </select>
          </div>

          {/* 6. Attendance Status Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              <i className="fa-solid fa-filter" style={{ marginRight: '4px', color: 'var(--primary)' }}></i> Attendance Status
            </label>
            <select
              className="form-control"
              style={{ height: '34px', fontSize: '12.5px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="above75">Regular (≥ 75%)</option>
              <option value="below75">Low (&lt; 75%)</option>
              <option value="below60">Critical (&lt; 60%)</option>
              <option value="sent">Sent to Parent</option>
              <option value="not_sent">Not Sent</option>
            </select>
          </div>

          {/* 6. Total Working Days in Month */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              <i className="fa-solid fa-business-time" style={{ marginRight: '4px', color: 'var(--primary)' }}></i> Working Days
            </label>
            <input
              type="number"
              min="1"
              max="31"
              className="form-control"
              style={{ height: '34px', fontSize: '12.5px' }}
              value={customWorkingDays !== '' ? customWorkingDays : defaultWorkingDays}
              onChange={(e) => setCustomWorkingDays(e.target.value)}
              placeholder="25"
            />
          </div>
        </div>

        {/* Top Small Summary Section: Total Working Days, Attendance Taken, Not Marked only once */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '10px 16px',
          marginTop: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Left: 3 Core Working Metrics */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '28px', height: '28px', borderRadius: '7px', backgroundColor: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>
                <i className="fa-solid fa-calendar-days"></i>
              </span>
              <div>
                <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, lineHeight: 1 }}>Total Working Days</div>
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#1e293b', marginTop: '2px' }}>
                  {monthlySummary.totalWorkingDays} Days
                </div>
              </div>
            </div>

            <div style={{ width: '1px', height: '20px', backgroundColor: '#cbd5e1' }}></div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '28px', height: '28px', borderRadius: '7px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>
                <i className="fa-solid fa-clipboard-check"></i>
              </span>
              <div>
                <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, lineHeight: 1 }}>Attendance Taken</div>
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0369a1', marginTop: '2px' }}>
                  {monthlySummary.attendanceTakenDays} Days
                </div>
              </div>
            </div>

            <div style={{ width: '1px', height: '20px', backgroundColor: '#cbd5e1' }}></div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '28px', height: '28px', borderRadius: '7px', backgroundColor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>
                <i className="fa-solid fa-clock"></i>
              </span>
              <div>
                <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, lineHeight: 1 }}>Not Marked</div>
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#b45309', marginTop: '2px' }}>
                  {monthlySummary.notMarkedDays} Days
                </div>
              </div>
            </div>
          </div>

          {/* Right: Average & Student Count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '11.5px',
              fontWeight: 700,
              color: monthlySummary.overallPercentage >= 75 ? '#15803d' : '#b45309',
              backgroundColor: monthlySummary.overallPercentage >= 75 ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${monthlySummary.overallPercentage >= 75 ? '#bbf7d0' : '#fde68a'}`,
              padding: '2px 8px',
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <i className="fa-solid fa-chart-pie" style={{ fontSize: '10px' }}></i> Average: {monthlySummary.overallPercentage}%
            </span>

            <span style={{
              fontSize: '11.5px',
              fontWeight: 700,
              color: '#475569',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              padding: '2px 8px',
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <i className="fa-solid fa-users" style={{ fontSize: '10px', color: '#64748b' }}></i> {filteredStudents.length} Students
            </span>
          </div>
        </div>
      </div>

      {/* VIEW 1: MONTHLY ATTENDANCE SHEET & DISPATCH */}
      {activeSubTab === 'sheet' && (
        <>
          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
            <div className="search-input-box" style={{ maxWidth: '300px', flex: 1, height: '34px', padding: '4px 10px', borderRadius: '8px' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--text-muted)', fontSize: '11px' }}></i>
              <input
                type="text"
                placeholder="Search name or roll..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                onClick={exportMonthlyExcel}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', height: '34px', fontSize: '12px', padding: '6px 12px' }}
                title="Download Excel Sheet"
              >
                <i className="fa-solid fa-file-excel" style={{ color: '#107c41' }}></i> Export Excel
              </button>

              <button
                className="btn btn-primary"
                onClick={() => setConfirmBulkModal(true)}
                disabled={filteredStudents.length === 0 || isSending}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px', fontSize: '12px', padding: '6px 14px', backgroundColor: '#4f46e5' }}
                title="Send monthly attendance summary to all filtered parents"
              >
                <i className="fa-solid fa-paper-plane" style={{ fontSize: '11px' }}></i> Send to All Parents ({filteredStudents.length})
              </button>
            </div>
          </div>

          {/* Essential 8-Column Table (Roll No, Student Name, Class, Present, Absent, Attendance %, Parent Contact, Actions) */}
          <div className="data-table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <table className="data-table" style={{ width: '100%', minWidth: '980px', tableLayout: 'fixed', borderCollapse: 'collapse', margin: 0 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                  <th style={{ width: '65px', textAlign: 'center', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 8px' }}>Roll No</th>
                  <th style={{ width: '18%', textAlign: 'left', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 12px' }}>Student Name</th>
                  <th style={{ width: '13%', textAlign: 'left', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 10px' }}>Class</th>
                  <th style={{ width: '10%', textAlign: 'center', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 8px' }}>Present</th>
                  <th style={{ width: '10%', textAlign: 'center', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 8px' }}>Absent</th>
                  <th style={{ width: '13%', textAlign: 'center', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 10px' }}>Attendance %</th>
                  <th style={{ width: '24%', textAlign: 'left', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 12px' }}>Parent Contact</th>
                  <th style={{ width: '105px', textAlign: 'center', fontSize: '11.5px', fontWeight: 700, color: '#475569', padding: '11px 8px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      <i className="fa-solid fa-users-slash" style={{ fontSize: '28px', color: '#cbd5e1', display: 'block', marginBottom: '8px', opacity: 0.4 }}></i>
                      No students found matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => {
                    const stats = getStudentMonthlyStats(s);
                    const hasPhone = Boolean(s.parentPhone && s.parentPhone.trim());
                    
                    // Percentage color tag
                    const pctColor = stats.percentage >= 75
                      ? { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' }
                      : (stats.percentage >= 60
                          ? { bg: '#fef3c7', text: '#b45309', border: '#fde68a' }
                          : { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca' });

                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {/* 1. Roll No */}
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '9px 8px' }}>
                          <div className="roll-badge" style={{ margin: '0 auto', width: '30px', height: '30px', fontSize: '12px' }}>
                            {s.rollNo || '-'}
                          </div>
                        </td>

                        {/* 2. Student Name */}
                        <td style={{ verticalAlign: 'middle', padding: '9px 12px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                            {s.name}
                          </div>
                        </td>

                        {/* 3. Class */}
                        <td style={{ verticalAlign: 'middle', padding: '9px 10px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontWeight: 700,
                              fontSize: '11px'
                            }}
                          >
                            <i className="fa-solid fa-graduation-cap" style={{ marginRight: '4px', fontSize: '9px', color: '#2563eb' }}></i>
                            {stats.classDisplay}
                          </span>
                        </td>

                        {/* 4. Present */}
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '9px 8px' }}>
                          <span style={{
                            fontWeight: 800,
                            color: '#15803d',
                            fontSize: '12.5px',
                            background: '#f0fdf4',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            border: '1px solid #dcfce7',
                            display: 'inline-block',
                            minWidth: '28px'
                          }}>
                            {stats.presentDays}
                          </span>
                        </td>

                        {/* 5. Absent */}
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '9px 8px' }}>
                          <span style={{
                            fontWeight: 800,
                            color: stats.absentDays > 0 ? '#b91c1c' : '#64748b',
                            fontSize: '12.5px',
                            background: stats.absentDays > 0 ? '#fef2f2' : '#f8fafc',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            border: stats.absentDays > 0 ? '1px solid #fee2e2' : '1px solid #f1f5f9',
                            display: 'inline-block',
                            minWidth: '28px'
                          }}>
                            {stats.absentDays}
                          </span>
                        </td>

                        {/* 6. Attendance % */}
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '9px 10px' }}>
                          <span style={{
                            display: 'inline-block',
                            background: pctColor.bg,
                            color: pctColor.text,
                            border: `1px solid ${pctColor.border}`,
                            padding: '3px 8px',
                            borderRadius: '8px',
                            fontWeight: 800,
                            fontSize: '12px'
                          }}>
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
                                <span style={{ fontSize: '10px', color: '#15803d', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
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
                                setActiveRowMenu(activeRowMenu === s.id ? null : s.id);
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

                            {activeRowMenu === s.id && (
                              <div
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: 'calc(100% + 4px)',
                                  zIndex: 50,
                                  minWidth: '160px',
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
                                    setActiveRowMenu(null);
                                    if (!hasPhone) {
                                      alert("Parent contact number not available");
                                      return;
                                    }
                                    setConfirmSingleModal({ student: s, stats });
                                  }}
                                  disabled={isSending}
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
                                    setActiveRowMenu(null);
                                    setDateWiseModal({ student: s, stats });
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
                                  <i className="fa-solid fa-calendar-day" style={{ color: '#0284c7', width: '14px', fontSize: '11px' }}></i>
                                  <span>Date-wise Breakdown</span>
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
          </div>
        </>
      )}

      {/* VIEW 2: SENT HISTORY LOG */}
      {activeSubTab === 'history' && (
        <div className="data-table-container" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="data-table" style={{ width: '100%', tableLayout: 'auto' }}>
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center', padding: '10px 4px', whiteSpace: 'nowrap' }}>#</th>
                <th style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>Student</th>
                <th style={{ width: '50px', textAlign: 'center', padding: '10px 4px', whiteSpace: 'nowrap' }}>Roll</th>
                <th style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>Class</th>
                <th style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>Parent Contact</th>
                <th style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>Month & Year</th>
                <th style={{ textAlign: 'center', width: '75px', padding: '10px 4px', whiteSpace: 'nowrap' }}>Att %</th>
                <th style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>Sent Date & Time</th>
                <th style={{ textAlign: 'center', width: '130px', padding: '10px 6px', whiteSpace: 'nowrap' }}>Status</th>
                <th style={{ textAlign: 'center', width: '75px', padding: '10px 4px', whiteSpace: 'nowrap' }}>Message</th>
              </tr>
            </thead>
            <tbody>
              {(!state.monthlyAttendanceHistory || state.monthlyAttendanceHistory.length === 0) ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                    <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: '28px', color: '#cbd5e1', display: 'block', marginBottom: '8px' }}></i>
                    No monthly attendance messages have been sent yet. Sent summaries will appear here in real-time.
                  </td>
                </tr>
              ) : (
                [...state.monthlyAttendanceHistory]
                  .sort((a, b) => (b.sentAt || b.createdAt || '').localeCompare(a.sentAt || a.createdAt || ''))
                  .map((h, idx) => {
                    const sentDateFormatted = h.sentAt
                      ? new Date(h.sentAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : (h.dateStr || 'Recent');

                    return (
                      <tr key={h.id || idx}>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '8px 4px' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 700, verticalAlign: 'middle', padding: '8px 8px', whiteSpace: 'nowrap' }}>{h.studentName}</td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '8px 4px' }}>
                          <div className="roll-badge" style={{ margin: '0 auto', width: '28px', height: '28px', fontSize: '11px' }}>{h.rollNo || '-'}</div>
                        </td>
                        <td style={{ verticalAlign: 'middle', padding: '8px 6px', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              whiteSpace: 'nowrap',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              padding: '2px 7px',
                              borderRadius: '6px',
                              fontWeight: 700,
                              fontSize: '11px'
                            }}
                          >
                            <i className="fa-solid fa-graduation-cap" style={{ marginRight: '4px', fontSize: '10px', color: '#2563eb' }}></i>
                            {h.className || 'Class'}
                          </span>
                        </td>
                        <td style={{ verticalAlign: 'middle', padding: '8px 8px' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap' }}>{h.parentName || 'Parent'}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                              {h.parentPhone || 'No Phone'}
                            </div>
                          </div>
                        </td>
                        <td style={{ verticalAlign: 'middle', padding: '8px 8px', whiteSpace: 'nowrap' }}>
                          <strong style={{ fontSize: '12px' }}>{h.month} {h.year}</strong>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{h.academicYear}</div>
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '8px 4px', fontWeight: 800 }}>
                          <span style={{ fontSize: '12px' }}>{h.attendancePercentage !== undefined ? `${h.attendancePercentage}%` : '-'}</span>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            ({h.presentDays}/{h.totalWorkingDays}d)
                          </div>
                        </td>
                        <td style={{ fontSize: '11.5px', color: '#475569', verticalAlign: 'middle', padding: '8px 8px', whiteSpace: 'nowrap' }}>
                          <i className="fa-regular fa-clock" style={{ marginRight: '4px' }}></i>
                          {sentDateFormatted}
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '8px 4px', whiteSpace: 'nowrap' }}>
                          {renderStatusBadge(h.status)}
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '8px 4px', whiteSpace: 'nowrap' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '3px 7px', fontSize: '10.5px', whiteSpace: 'nowrap' }}
                            onClick={() => setViewHistoryMessageModal(h)}
                            title="View full text message sent to parent"
                          >
                            <i className="fa-solid fa-eye" style={{ marginRight: '3px' }}></i> View
                          </button>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: CONFIRM INDIVIDUAL SEND */}
      {confirmSingleModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-paper-plane" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>
                Send Attendance to Parent?
              </h3>
              <i className="fa-solid fa-xmark" style={{ cursor: 'pointer' }} onClick={() => setConfirmSingleModal(null)}></i>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
              Confirm sending the <strong>{selectedMonth} {selectedYear}</strong> monthly attendance summary to the parent:
            </p>

            {/* Student & Parent Summary Box */}
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12.5px', color: '#64748b' }}>Student:</span>
                <span style={{ fontSize: '12.5px', fontWeight: 700 }}>{confirmSingleModal.student.name} (Roll: {confirmSingleModal.student.rollNo})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12.5px', color: '#64748b' }}>Class:</span>
                <span style={{ fontSize: '12.5px', fontWeight: 600 }}>{confirmSingleModal.stats.classDisplay}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12.5px', color: '#64748b' }}>Parent:</span>
                <span style={{ fontSize: '12.5px', fontWeight: 600 }}>{confirmSingleModal.student.parentName || 'Parent'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12.5px', color: '#64748b' }}>Parent Mobile:</span>
                <span style={{ fontSize: '12.5px', fontWeight: 700, fontFamily: 'monospace', color: confirmSingleModal.student.parentPhone ? '#1e3a8a' : '#b91c1c' }}>
                  {confirmSingleModal.student.parentPhone || '⚠️ Parent contact number not available'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '6px', marginTop: '6px' }}>
                <span style={{ fontSize: '12.5px', color: '#64748b' }}>Attendance:</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>
                  {confirmSingleModal.stats.presentDays} / {confirmSingleModal.stats.totalWorkingDays} Days ({confirmSingleModal.stats.percentage}%)
                </span>
              </div>
            </div>

            {/* Message Preview */}
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Message Preview:
            </label>
            <pre style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12px',
              fontFamily: 'inherit',
              whiteSpace: 'pre-wrap',
              color: '#1e293b',
              margin: '0 0 16px',
              lineHeight: '1.5'
            }}>
              {generateParentMessage(confirmSingleModal.student, confirmSingleModal.stats)}
            </pre>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmSingleModal(null)} disabled={isSending}>
                Cancel
              </button>
              {confirmSingleModal.student?.parentPhone && (
                <a
                  href={`https://wa.me/${formatWhatsAppPhone(confirmSingleModal.student.parentPhone)}?text=${encodeURIComponent(generateParentMessage(confirmSingleModal.student, confirmSingleModal.stats))}`}
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
                className="btn btn-primary"
                onClick={handleConfirmSingleSend}
                disabled={isSending || !confirmSingleModal.student.parentPhone}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {isSending ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Sending...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane"></i> Confirm & Send Attendance
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRM BULK SEND ("SEND TO ALL PARENTS") */}
      {confirmBulkModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-bullhorn" style={{ color: '#4338ca', marginRight: '8px' }}></i>
                Send {selectedMonth} {selectedYear} Attendance to Parents?
              </h3>
              <i className="fa-solid fa-xmark" style={{ cursor: 'pointer' }} onClick={() => setConfirmBulkModal(false)}></i>
            </div>

            <p style={{ fontSize: '13.5px', color: '#1e293b', margin: '0 0 14px' }}>
              You are about to dispatch monthly attendance summaries to all students in <strong>{selectedClassId === 'all' ? 'All Classes' : `Class ${selectedClassId}`}</strong> ({selectedDivision === 'all' ? 'All Divisions' : `Division ${selectedDivision}`}).
            </p>

            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12.5px', color: '#64748b' }}>Target Group:</span>
                <span style={{ fontSize: '12.5px', fontWeight: 700 }}>
                  {selectedClassId === 'all' ? 'All Classes' : `Class ${selectedClassId}`} ({selectedDivision === 'all' ? 'All Divisions' : `Div ${selectedDivision}`})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12.5px', color: '#64748b' }}>Month & Academic Year:</span>
                <span style={{ fontSize: '12.5px', fontWeight: 700 }}>{selectedMonth} {selectedYear} ({selectedAcademicYear})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12.5px', color: '#64748b' }}>Total Students:</span>
                <span style={{ fontSize: '12.5px', fontWeight: 700 }}>{summaryCounts.totalEligible}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12.5px', color: '#15803d' }}>Ready to Send (Phone Available):</span>
                <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#15803d' }}>{summaryCounts.withPhones}</span>
              </div>
              {summaryCounts.missingPhones > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c' }}>
                  <span style={{ fontSize: '12.5px' }}>Contact Number Missing:</span>
                  <span style={{ fontSize: '12.5px', fontWeight: 800 }}>{summaryCounts.missingPhones} (Will be flagged)</span>
                </div>
              )}
            </div>

            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#1e40af' }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: '6px' }}></i>
              Each parent will receive their respective child's individual attendance summary, present days, and attendance percentage.
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmBulkModal(false)} disabled={isSending}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmBulkSend}
                disabled={isSending || summaryCounts.totalEligible === 0}
                style={{ backgroundColor: '#4338ca', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {isSending ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Dispatching Summaries...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane"></i> Yes, Send to All Parents
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DATE-WISE ATTENDANCE BREAKDOWN */}
      {dateWiseModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-calendar-days" style={{ color: 'var(--teal)', marginRight: '8px' }}></i>
                Date-wise Attendance: {dateWiseModal.student.name}
              </h3>
              <i className="fa-solid fa-xmark" style={{ cursor: 'pointer' }} onClick={() => setDateWiseModal(null)}></i>
            </div>

            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '12.5px' }}>
              <span>Roll: <strong>{dateWiseModal.student.rollNo}</strong> • {dateWiseModal.stats.classDisplay}</span>
              <span>Month: <strong>{selectedMonth} {selectedYear}</strong></span>
              <span>Score: <strong style={{ color: 'var(--primary)' }}>{dateWiseModal.stats.presentDays} / {dateWiseModal.stats.totalWorkingDays} ({dateWiseModal.stats.percentage}%)</strong></span>
            </div>

            {/* Calendar list */}
            <div style={{ maxHeight: '360px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Day</th>
                    <th>Date</th>
                    <th>Weekday</th>
                    <th style={{ textAlign: 'center' }}>Attendance Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: daysInSelectedMonth }, (_, i) => {
                    const dayNum = i + 1;
                    const dateObj = new Date(selectedYear, monthIndex, dayNum);
                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                    const isSunday = dateObj.getDay() === 0;
                    const dateStr = `${selectedYear}-${monthNumStr}-${String(dayNum).padStart(2, '0')}`;

                    // Check marked status
                    const sMap = monthAttendanceMap.get(dateWiseModal.student.id) || (dateWiseModal.student.rollNo ? monthAttendanceMap.get(dateWiseModal.student.rollNo) : null);
                    let markedStatus = sMap ? sMap.get(dateStr) : null;

                    const dayLectures = (state.attendance || []).filter((a) => {
                      if (!a) return false;
                      const rawD = String(a.date || a.attendanceDate || '').trim().split('T')[0];
                      const isMatch = (a.studentId && a.studentId === dateWiseModal.student.id) ||
                                      (dateWiseModal.student.rollNo && String(a.studentId) === String(dateWiseModal.student.rollNo));
                      return isMatch && rawD === dateStr;
                    });

                    if (!markedStatus) {
                      if (isSunday) markedStatus = 'Sunday';
                    }

                    return (
                      <tr key={dateStr} style={{ background: isSunday ? '#f8fafc' : '#ffffff' }}>
                        <td style={{ fontWeight: 700, color: '#64748b' }}>#{dayNum}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{dateStr}</td>
                        <td style={{ color: isSunday ? '#dc2626' : '#475569', fontWeight: isSunday ? 700 : 500 }}>
                          {dayName}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {dayLectures.length > 1 && selectedSubject === 'all' ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center' }}>
                              {dayLectures.map((lec, idx) => {
                                const isPres = String(lec.status || '').toLowerCase() === 'present';
                                return (
                                  <span
                                    key={idx}
                                    style={{
                                      background: isPres ? '#dcfce7' : '#fee2e2',
                                      color: isPres ? '#15803d' : '#b91c1c',
                                      padding: '2px 8px',
                                      borderRadius: '8px',
                                      fontSize: '11px',
                                      fontWeight: 700
                                    }}
                                  >
                                    {lec.subject || 'General'}: {isPres ? 'P' : 'A'}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <>
                              {markedStatus === 'Present' && (
                                <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 10px', borderRadius: '10px', fontSize: '11.5px', fontWeight: 700 }}>
                                  <i className="fa-solid fa-circle-check" style={{ marginRight: '4px' }}></i> Present
                                </span>
                              )}
                              {markedStatus === 'Absent' && (
                                <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '3px 10px', borderRadius: '10px', fontSize: '11.5px', fontWeight: 700 }}>
                                  <i className="fa-solid fa-circle-xmark" style={{ marginRight: '4px' }}></i> Absent
                                </span>
                              )}
                              {markedStatus === 'Sunday' && (
                                <span style={{ background: '#f1f5f9', color: '#94a3b8', padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>
                                  Sunday Holiday
                                </span>
                              )}
                              {(!markedStatus || markedStatus === 'Not Marked') && (
                                <span style={{ background: '#f1f5f9', color: '#64748b', padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>
                                  Not Marked
                                </span>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDateWiseModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: VIEW HISTORY MESSAGE CONTENT */}
      {viewHistoryMessageModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-message" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>
                Sent Message Record
              </h3>
              <i className="fa-solid fa-xmark" style={{ cursor: 'pointer' }} onClick={() => setViewHistoryMessageModal(null)}></i>
            </div>

            <div style={{ fontSize: '12.5px', marginBottom: '10px', color: '#475569' }}>
              Sent to: <strong>{viewHistoryMessageModal.parentName || 'Parent'}</strong> ({viewHistoryMessageModal.parentPhone || 'No Phone'}) for <strong>{viewHistoryMessageModal.studentName}</strong>
            </div>

            <pre style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12.5px',
              fontFamily: 'inherit',
              whiteSpace: 'pre-wrap',
              color: '#1e293b',
              margin: '0 0 16px',
              lineHeight: '1.5'
            }}>
              {viewHistoryMessageModal.message || 'No message text recorded.'}
            </pre>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setViewHistoryMessageModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
