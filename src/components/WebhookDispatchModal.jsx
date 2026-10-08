import React, { useState, useEffect } from 'react';
import {
  getWebhookConfig,
  subscribeWebhooksList,
  buildDailyAttendancePayload,
  buildMonthlyAttendancePayload,
  buildExamReportPayload,
  sendWebhookRequest,
  dispatchSmartWebhook,
  isWhatsAppGatewayUrl,
  resolveWebhookUrlForStudent,
  formatWhatsAppPhone,
  OFFICIAL_DAILY_WEBHOOK_URL,
  OFFICIAL_MONTHLY_WEBHOOK_URL,
  OFFICIAL_EXAM_WEBHOOK_URL
} from '../services/webhookService';

export default function WebhookDispatchModal({
  isOpen,
  onClose,
  dispatchData, // { type: 'daily' | 'monthly' | 'exam', scope: 'single' | 'bulk', student, students, classInfo, date, month, year, academicYear, workingDays, examInfo, schoolProfile }
  onOpenSettings
}) {
  const [config, setConfig] = useState(() => {
    try {
      const raw = localStorage.getItem('smartclass_webhook_config');
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  });
  const [webhooksList, setWebhooksList] = useState([]);
  const [selectedWebhookId, setSelectedWebhookId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState(null); // { success: boolean, message: string, details?: any }
  const [dispatchProgress, setDispatchProgress] = useState(null); // { current, total, studentName, phone, status }
  const [filterMode, setFilterMode] = useState('all'); // for daily: 'all' | 'present' | 'absent'
  const [singleStatus, setSingleStatus] = useState('Present');

  useEffect(() => {
    if (isOpen) {
      setSendResult(null);
      setDispatchProgress(null);
      setFilterMode('all');
      loadConfig();
      if (dispatchData?.student) {
        const raw = String(dispatchData.student.status || '').trim().toLowerCase();
        setSingleStatus(raw === 'absent' ? 'Absent' : 'Present');
      }
    }
  }, [isOpen, dispatchData]);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeWebhooksList((list) => {
      setWebhooksList(list || []);
    });
    return () => unsub();
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      const cfg = await getWebhookConfig();
      setConfig(cfg);
    } catch (e) {
      console.error('Error loading webhook config:', e);
    }
  };

  if (!isOpen || !dispatchData) return null;

  const {
    type = 'daily', // 'daily' | 'monthly' | 'exam'
    scope = 'bulk', // 'single' | 'bulk'
    student = null,
    students = [],
    classInfo = null,
    date = null,
    month = null,
    year = null,
    academicYear = null,
    workingDays = 24,
    examInfo = null,
    schoolProfile = {}
  } = dispatchData;

  // Filter webhooks for this category
  const categoryWebhooks = webhooksList.filter((w) => w.category === type && w.isEnabled !== false);
  const selectedWebhookItem = categoryWebhooks.find((w) => w.id === selectedWebhookId) || categoryWebhooks[0];

  // Resolve target webhook URL
  let targetUrl = selectedWebhookItem?.url || '';
  let secretToken = selectedWebhookItem?.secretToken || config?.secretToken || '';
  let typeTitle = '';
  let typeIcon = '';
  let badgeColor = '';

  if (type === 'daily') {
    if (!targetUrl) targetUrl = config?.dailyAttendanceUrl || OFFICIAL_DAILY_WEBHOOK_URL;
    typeTitle = 'Daily Attendance Webhook';
    typeIcon = 'fa-calendar-day';
    badgeColor = '#2563eb';
  } else if (type === 'monthly') {
    if (!targetUrl) targetUrl = config?.monthlyAttendanceUrl || OFFICIAL_MONTHLY_WEBHOOK_URL;
    typeTitle = 'Monthly Attendance Webhook';
    typeIcon = 'fa-calendar-days';
    badgeColor = '#7c3aed';
  } else if (type === 'exam') {
    if (!targetUrl) targetUrl = config?.examReportsUrl || OFFICIAL_EXAM_WEBHOOK_URL;
    typeTitle = 'Exam Reports Webhook';
    typeIcon = 'fa-file-invoice';
    badgeColor = '#0d9488';
  }

  const isSingle = scope === 'single' && student;
  const singleStudentName = student?.name || student?.studentName || 'Student';
  const singleStudentPhone = student?.parentPhone || student?.phone || 'Not Available';
  const singleStudentRoll = student?.rollNo || 'N/A';

  const currentSingleStudent = isSingle
    ? { ...student, status: singleStatus }
    : (students.length === 1 ? { ...students[0], status: singleStatus } : null);

  // Filter students based on scope and filterMode
  let effectiveStudents = [];
  if (isSingle) {
    effectiveStudents = [currentSingleStudent];
  } else {
    effectiveStudents = [...students].map((s) => {
      const raw = String(s.status || '').trim().toLowerCase();
      // In bulk, if un-marked, default to Present for clean template delivery
      return { ...s, status: raw === 'absent' ? 'Absent' : 'Present' };
    });
    if (type === 'daily' && filterMode !== 'all') {
      effectiveStudents = effectiveStudents.filter((s) => {
        const raw = String(s.status || '').trim().toLowerCase();
        if (filterMode === 'present') return raw === 'present';
        if (filterMode === 'absent') return raw === 'absent';
        return true;
      });
    }
  }

  const isWhatsApp = isWhatsAppGatewayUrl(targetUrl);
  const singleTargetStudent = currentSingleStudent;
  const singleResolved = (singleTargetStudent && targetUrl)
    ? resolveWebhookUrlForStudent(targetUrl, singleTargetStudent, schoolProfile, type)
    : null;

  // Construct payload preview
  let payload = null;
  if (type === 'daily') {
    payload = buildDailyAttendancePayload({
      students: effectiveStudents,
      classInfo,
      date,
      schoolProfile
    });
  } else if (type === 'monthly') {
    payload = buildMonthlyAttendancePayload({
      students: effectiveStudents,
      classInfo,
      month,
      year,
      academicYear,
      totalWorkingDays: workingDays,
      schoolProfile
    });
  } else if (type === 'exam') {
    payload = buildExamReportPayload({
      students: effectiveStudents,
      classInfo,
      examInfo,
      schoolProfile
    });
  }

  const handleDispatch = async () => {
    if (!targetUrl || !targetUrl.trim()) {
      alert('Webhook URL is not configured. Please click "Configure URL" to add your endpoint.');
      return;
    }

    setIsSending(true);
    setSendResult(null);
    setDispatchProgress(null);

    try {
      const res = await dispatchSmartWebhook({
        targetUrl,
        payload,
        secretToken: selectedWebhookItem?.secretToken || config?.secretToken || '',
        scope,
        student: currentSingleStudent,
        students: effectiveStudents,
        schoolProfile,
        date,
        eventType: type === 'exam' ? 'exam_reports' : (type === 'monthly' ? 'monthly_attendance' : 'daily_attendance'),
        onProgress: (prog) => {
          setDispatchProgress(prog);
        }
      });

      if (res.mode === 'single') {
        setSendResult({
          success: true,
          message: `Successfully delivered WhatsApp attendance alert to parent of ${res.studentName} (+${res.recipientPhone})!`
        });
      } else if (res.mode === 'bulk_whatsapp') {
        const skippedTxt = res.skippedCount > 0 ? ` (${res.skippedCount} students skipped due to missing phone numbers)` : '';
        setSendResult({
          success: res.success,
          message: `WhatsApp Delivery Complete! Sent to ${res.sentCount} parents successfully.${skippedTxt}`
        });
      } else {
        setSendResult({
          success: true,
          message: `Successfully dispatched to webhook! Sent ${res.studentCount} student records with parent contact numbers. (${res.durationMs}ms)`
        });
      }

      setTimeout(() => {
        onClose();
      }, 3500);
    } catch (err) {
      setSendResult({
        success: false,
        message: err.message || 'Failed to dispatch webhook.'
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1350 }}>
      <div
        className="modal-box"
        style={{
          maxWidth: '620px',
          width: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          borderRadius: '16px',
          backgroundColor: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: `${badgeColor}15`,
                color: badgeColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px'
              }}
            >
              <i className={`fa-solid ${typeIcon}`}></i>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                Dispatch {typeTitle}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#64748b' }}>
                On-click payload delivery to your external webhook endpoint
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '4px'
            }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '22px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Result Alert */}
          {sendResult && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                marginBottom: '16px',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                backgroundColor: sendResult.success ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${sendResult.success ? '#86efac' : '#fca5a5'}`,
                color: sendResult.success ? '#15803d' : '#b91c1c'
              }}
            >
              <i
                className={`fa-solid ${
                  sendResult.success ? 'fa-circle-check' : 'fa-circle-exclamation'
                }`}
                style={{ marginTop: '2px' }}
              ></i>
              <div>{sendResult.message}</div>
            </div>
          )}

          {/* Live Progress Bar during Sending */}
          {isSending && dispatchProgress && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                backgroundColor: '#f0fdf4',
                border: '1.5px solid #86efac',
                marginBottom: '16px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', fontWeight: 700, color: '#166534', marginBottom: '8px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-brands fa-whatsapp fa-bounce" style={{ color: '#16a34a', fontSize: '16px' }}></i>
                  <span>Sending to Parent WhatsApp ({dispatchProgress.current} / {dispatchProgress.total})</span>
                </span>
                <span style={{ backgroundColor: '#bbf7d0', color: '#14532d', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
                  {Math.round((dispatchProgress.current / dispatchProgress.total) * 100)}%
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: '#dcfce7', borderRadius: '999px', overflow: 'hidden', marginBottom: '8px' }}>
                <div
                  style={{
                    width: `${(dispatchProgress.current / dispatchProgress.total) * 100}%`,
                    height: '100%',
                    backgroundColor: '#16a34a',
                    borderRadius: '999px',
                    transition: 'width 0.25s ease'
                  }}
                ></div>
              </div>
              <div style={{ fontSize: '11.5px', color: '#15803d', display: 'flex', justifyContent: 'space-between' }}>
                <span>Student: <strong>{dispatchProgress.studentName}</strong></span>
                <span>Parent WhatsApp: <strong>+{dispatchProgress.phone}</strong></span>
              </div>
            </div>
          )}

          {/* Webhook Endpoint Status Box */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              border: isWhatsApp ? '1px solid #86efac' : '1px solid #e2e8f0',
              backgroundColor: isWhatsApp ? '#f0fdf4' : '#f8fafc',
              marginBottom: '18px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Delivery Gateway
                </span>
                {isWhatsApp && (
                  <span
                    style={{
                      backgroundColor: '#dcfce7',
                      color: '#15803d',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <i className="fa-brands fa-whatsapp"></i> 1Automations WhatsApp Gateway Active
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onOpenSettings) onOpenSettings();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline'
                }}
              >
                Configure / Change URL
              </button>
            </div>

            {targetUrl ? (
              <div
                style={{
                  backgroundColor: '#ffffff',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-lock" style={{ color: '#16a34a', fontSize: '13px' }}></i>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a' }}>
                    {isWhatsApp ? '1Automations WhatsApp API' : 'Custom Webhook API'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                    Connected & Encrypted
                  </span>
                </div>
                {isWhatsApp && isSingle && singleResolved && (
                  <div style={{ fontSize: '11.5px', color: '#15803d', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <i className="fa-solid fa-check-double"></i>
                    <span>Parent: <strong>+{singleResolved.formattedPhone}</strong></span>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  padding: '8px 10px',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  color: '#b45309',
                  borderRadius: '6px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>
                  <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }}></i>
                  No webhook URL configured for this report!
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    if (onOpenSettings) onOpenSettings();
                  }}
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                >
                  Set URL
                </button>
              </div>
            )}
          </div>

          {/* Scope Card */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: isSingle ? '#f0fdf4' : '#eff6ff',
              border: `1.5px solid ${isSingle ? '#86efac' : '#bfdbfe'}`,
              marginBottom: '18px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: isSingle ? '#16a34a' : 'var(--primary)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px'
                }}
              >
                <i className={`fa-solid ${isSingle ? 'fa-user-check' : 'fa-users'}`}></i>
              </div>
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: isSingle ? '#166534' : '#1e40af',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {isSingle ? 'Single Student Target' : 'Selected Class / Category Target'}
                </span>
                <h4 style={{ margin: '1px 0 0', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                  {isSingle
                    ? `${singleStudentName} (Roll: ${singleStudentRoll})`
                    : classInfo?.name || 'All Students in Selected Class'}
                </h4>
              </div>
            </div>

            {isSingle ? (
              <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #bbf7d0', fontSize: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '10px' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Parent Name: </span>
                    <strong>{student?.parentName || 'Parent / Guardian'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Parent WhatsApp: </span>
                    <strong style={{ color: singleResolved?.formattedPhone ? '#047857' : '#dc2626' }}>
                      {singleResolved?.formattedPhone ? `+${singleResolved.formattedPhone}` : 'No valid mobile registered'}
                    </strong>
                  </div>
                </div>

                {type === 'daily' && (
                  <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: '#334155' }}>Attendance Status:</span>
                    <button
                      type="button"
                      onClick={() => setSingleStatus('Present')}
                      style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        border: singleStatus === 'Present' ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        backgroundColor: singleStatus === 'Present' ? '#16a34a' : '#f8fafc',
                        color: singleStatus === 'Present' ? '#ffffff' : '#475569',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: singleStatus === 'Present' ? '0 1px 3px rgba(22, 163, 74, 0.3)' : 'none'
                      }}
                    >
                      <i className="fa-solid fa-check"></i> Present
                    </button>
                    <button
                      type="button"
                      onClick={() => setSingleStatus('Absent')}
                      style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        border: singleStatus === 'Absent' ? '1.5px solid #dc2626' : '1px solid #cbd5e1',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        backgroundColor: singleStatus === 'Absent' ? '#dc2626' : '#f8fafc',
                        color: singleStatus === 'Absent' ? '#ffffff' : '#475569',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: singleStatus === 'Absent' ? '0 1px 3px rgba(220, 38, 38, 0.3)' : 'none'
                      }}
                    >
                      <i className="fa-solid fa-xmark"></i> Absent
                    </button>
                    {(!student?.status || student?.status === 'Not Marked') && (
                      <span style={{ fontSize: '11px', color: '#65a30d', fontWeight: 600 }}>
                        (Auto-defaulted to Present for clean delivery)
                      </span>
                    )}
                  </div>
                )}

                {singleResolved?.templateMessage && (
                  <div
                    style={{
                      padding: '8px 10px',
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #bbf7d0',
                      fontSize: '11.5px',
                      color: '#1e293b'
                    }}
                  >
                    <span style={{ color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                      WhatsApp Message Template Preview:
                    </span>
                    <span style={{ fontFamily: 'monospace', color: '#0f172a', wordBreak: 'break-all' }}>
                      {singleResolved.templateMessage}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  marginTop: '10px',
                  paddingTop: '8px',
                  borderTop: '1px solid #bfdbfe',
                  display: 'flex',
                  gap: '16px',
                  fontSize: '12px',
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <span style={{ color: '#64748b' }}>Total Selected: </span>
                  <strong>{effectiveStudents.length} Students</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Valid WhatsApp Contacts: </span>
                  <strong style={{ color: '#16a34a' }}>
                    {effectiveStudents.filter(s => Boolean(formatWhatsAppPhone(s.parentPhone || s.phone))).length} Parents
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Mode: </span>
                  <strong>{isWhatsApp ? 'WhatsApp Multi-Parent Dispatch' : type.toUpperCase()}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Type-Specific Filter & Summary Details */}
          {type === 'daily' && !isSingle && (
            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                Filter Scope for Daily Attendance:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { id: 'all', label: `All Students (${students.length})` },
                  { id: 'present', label: `Only Present (${students.filter(s => String(s.status || '').trim().toLowerCase() === 'present').length})` },
                  { id: 'absent', label: `Only Absent (${students.filter(s => String(s.status || '').trim().toLowerCase() === 'absent').length})` }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterMode(tab.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: filterMode === tab.id ? '1.5px solid var(--primary)' : '1px solid #cbd5e1',
                      backgroundColor: filterMode === tab.id ? '#eff6ff' : '#ffffff',
                      color: filterMode === tab.id ? 'var(--primary)' : '#475569'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Payload Info Breakdown */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#f8fafc',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              fontSize: '12px'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center' }}>
              <div style={{ padding: '6px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Students Count</span>
                <strong style={{ fontSize: '15px', color: '#0f172a' }}>{effectiveStudents.length}</strong>
              </div>

              <div style={{ padding: '6px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Valid Parent Phones</span>
                <strong style={{ fontSize: '15px', color: '#16a34a' }}>
                  {effectiveStudents.filter(s => Boolean(s.parentPhone || s.phone)).length}
                </strong>
              </div>

              <div style={{ padding: '6px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                  {type === 'daily' ? 'Date' : type === 'monthly' ? 'Month' : 'Exam'}
                </span>
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                  {type === 'daily' ? (date || 'Today') : type === 'monthly' ? `${month || ''} ${year || ''}` : (examInfo?.title || 'All')}
                </strong>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#ffffff'
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isSending}
            style={{ padding: '8px 16px' }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleDispatch}
            disabled={isSending || !targetUrl}
            style={{
              padding: '8px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: isSending ? '#94a3b8' : badgeColor,
              borderColor: isSending ? '#94a3b8' : badgeColor
            }}
          >
            {isSending ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i> Dispatching Webhook...
              </>
            ) : (
              <>
                <i className="fa-solid fa-paper-plane"></i>
                <span>
                  {isSingle ? 'Send Single Student Report' : `Dispatch All (${effectiveStudents.length}) to Webhook`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
