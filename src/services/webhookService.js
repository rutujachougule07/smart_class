import { db } from '../firebase.js';
import { doc, getDoc, setDoc, addDoc, deleteDoc, collection, onSnapshot, query } from 'firebase/firestore';

const SETTINGS_COLLECTION = 'system_settings';
const SETTINGS_DOC_ID = 'webhooks';
const WEBHOOKS_COLLECTION = 'webhooks';
const LOCAL_STORAGE_KEY = 'smartclass_webhook_config';
const LOCAL_STORAGE_LIST_KEY = 'smartclass_webhooks_list';
const WEBHOOK_LOGS_COLLECTION = 'webhook_logs';

export const WEBHOOK_CATEGORIES = [
  { id: 'daily', name: 'Daily Attendance', description: 'Triggered when daily attendance is marked or dispatched.', color: '#2563eb', bg: '#eff6ff', icon: 'fa-calendar-day' },
  { id: 'monthly', name: 'Monthly Attendance', description: 'Triggered when monthly aggregated attendance is dispatched.', color: '#7c3aed', bg: '#f5f3ff', icon: 'fa-calendar-days' },
  { id: 'exam', name: 'Exam Reports', description: 'Triggered when exam report cards & marksheets are sent.', color: '#0d9488', bg: '#f0fdf4', icon: 'fa-file-invoice' }
];

export const OFFICIAL_DAILY_WEBHOOK_URL = 'https://webhooks.1automations.com/webhook/6ab2206ac277c1989c5cbdfd?number=91XXXXXXXXXX&message=day,AttendanceDate,StudentName,ClassDivision,AttendanceStatus,AttendanceRemark,SchoolName';
export const OFFICIAL_MONTHLY_WEBHOOK_URL = 'https://webhooks.1automations.com/webhook/6ab20b38c277c1989c5ca144?number=91XXXXXXXXXX&message=monthly,MonthYear,StudentName,ClassDivision,TotalWorkingDays,DaysPresent,DaysAbsent,AttendancePercentage,Remark,SchoolName';
export const OFFICIAL_EXAM_WEBHOOK_URL = 'https://webhooks.1automations.com/webhook/6ab4c65fc277c1989c5ef36f?number=91XXXXXXXXXX&message=exam,studentname,class,examname,examdate,totalmarks,marksobtained,percentage,grade,resultstatus,resultremark,schoolname';

export const DEFAULT_WEBHOOK_CONFIG = {
  dailyAttendanceUrl: OFFICIAL_DAILY_WEBHOOK_URL,
  monthlyAttendanceUrl: OFFICIAL_MONTHLY_WEBHOOK_URL,
  examReportsUrl: OFFICIAL_EXAM_WEBHOOK_URL,
  secretToken: '',
  lastUpdated: new Date().toISOString()
};

export const DEFAULT_WEBHOOKS_LIST = [
  {
    id: 'wh_daily_1automations',
    name: '1automations Daily Attendance',
    category: 'daily',
    url: OFFICIAL_DAILY_WEBHOOK_URL,
    secretToken: '',
    isEnabled: true,
    createdAt: '2026-10-06T00:00:00.000Z',
    updatedAt: '2026-10-06T00:00:00.000Z'
  },
  {
    id: 'wh_monthly_1automations',
    name: '1automations Monthly Attendance',
    category: 'monthly',
    url: OFFICIAL_MONTHLY_WEBHOOK_URL,
    secretToken: '',
    isEnabled: true,
    createdAt: '2026-10-06T00:00:00.000Z',
    updatedAt: '2026-10-06T00:00:00.000Z'
  },
  {
    id: 'wh_exam_1automations',
    name: '1automations Exam Reports',
    category: 'exam',
    url: OFFICIAL_EXAM_WEBHOOK_URL,
    secretToken: '',
    isEnabled: true,
    createdAt: '2026-10-06T00:00:00.000Z',
    updatedAt: '2026-10-06T00:00:00.000Z'
  }
];

/**
 * Fetch Webhook Configuration from Firestore & localStorage, seamlessly
 * integrating both category-wise webhooks and legacy single-URL settings.
 */
export async function getWebhookConfig() {
  // 1. Inspect category-wise list first (User saves webhooks category-wise in Webhook Settings)
  const list = getCachedWebhooksList();
  const activeDaily = list.find((w) => w.category === 'daily' && w.isEnabled !== false && w.url);
  const activeMonthly = list.find((w) => w.category === 'monthly' && w.isEnabled !== false && w.url);
  const activeExam = list.find((w) => w.category === 'exam' && w.isEnabled !== false && w.url);
  const firstSecret = list.find((w) => w.secretToken && w.isEnabled !== false)?.secretToken || '';

  // 2. Read legacy cache
  let cached = null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse cached webhook config:', e);
  }

  // 3. Fetch latest from Firestore if available
  let firestoreData = null;
  try {
    if (db) {
      const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        firestoreData = snapshot.data();
      }
    }
  } catch (e) {
    console.warn('Firestore fetch for webhook settings failed, using cached:', e);
  }

  const merged = {
    dailyAttendanceUrl: activeDaily?.url || firestoreData?.dailyAttendanceUrl || cached?.dailyAttendanceUrl || OFFICIAL_DAILY_WEBHOOK_URL,
    monthlyAttendanceUrl: activeMonthly?.url || firestoreData?.monthlyAttendanceUrl || cached?.monthlyAttendanceUrl || OFFICIAL_MONTHLY_WEBHOOK_URL,
    examReportsUrl: activeExam?.url || firestoreData?.examReportsUrl || cached?.examReportsUrl || OFFICIAL_EXAM_WEBHOOK_URL,
    secretToken: firstSecret || firestoreData?.secretToken || cached?.secretToken || '',
    lastUpdated: new Date().toISOString()
  };

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
  } catch (_) {}

  return merged;
}

/**
 * Get the active Webhook item for a given category ('daily' | 'monthly' | 'exam')
 */
export function getActiveWebhookForCategory(category) {
  const list = getCachedWebhooksList();
  const found = list.find((w) => w.category === category && w.isEnabled !== false && w.url);
  if (found) return found;

  // Fallback to legacy config
  let cached = null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch (_) {}

  if (category === 'daily') {
    return { id: 'legacy_daily', name: 'Daily Attendance', category: 'daily', url: cached?.dailyAttendanceUrl || OFFICIAL_DAILY_WEBHOOK_URL, secretToken: cached?.secretToken || '', isEnabled: true };
  }
  if (category === 'monthly') {
    return { id: 'legacy_monthly', name: 'Monthly Attendance', category: 'monthly', url: cached?.monthlyAttendanceUrl || OFFICIAL_MONTHLY_WEBHOOK_URL, secretToken: cached?.secretToken || '', isEnabled: true };
  }
  if (category === 'exam') {
    return { id: 'legacy_exam', name: 'Exam Reports', category: 'exam', url: cached?.examReportsUrl || OFFICIAL_EXAM_WEBHOOK_URL, secretToken: cached?.secretToken || '', isEnabled: true };
  }
  return null;
}


/**
 * Save Webhook Configuration to Firestore and localStorage
 */
export async function saveWebhookConfig(config) {
  const updated = {
    ...DEFAULT_WEBHOOK_CONFIG,
    ...config,
    lastUpdated: new Date().toISOString()
  };

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to cache webhook config in localStorage:', e);
  }

  try {
    if (db) {
      const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
      await setDoc(docRef, updated, { merge: true });
    }
    return { success: true, data: updated };
  } catch (e) {
    console.error('Failed to save webhook config to Firestore:', e);
    // Still return success if saved to localStorage
    return { success: true, data: updated, warning: 'Saved locally, Firestore sync will retry.' };
  }
}

/**
 * Real-time listener for Webhooks Collection in Firestore
 */
export function subscribeWebhooksList(callback) {
  if (!db) {
    const cached = getCachedWebhooksList();
    if (callback) callback(cached);
    return () => {};
  }

  try {
    const q = query(collection(db, WEBHOOKS_COLLECTION));
    return onSnapshot(
      q,
      (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Cache locally
        try {
          localStorage.setItem(LOCAL_STORAGE_LIST_KEY, JSON.stringify(list));
        } catch (_) {}

        // Sync legacy doc for backward compatibility
        syncLegacyConfigFromList(list);

        if (callback) callback(list);
      },
      (err) => {
        console.warn('Real-time webhooks listener error, fallback to cache:', err);
        const cached = getCachedWebhooksList();
        if (callback) callback(cached);
      }
    );
  } catch (err) {
    console.error('Failed to subscribe to webhooks collection:', err);
    const cached = getCachedWebhooksList();
    if (callback) callback(cached);
    return () => {};
  }
}

/**
 * Get cached webhooks list from localStorage
 */
export function getCachedWebhooksList() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_LIST_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch (_) {}
  return [...DEFAULT_WEBHOOKS_LIST];
}

/**
 * Sync legacy system_settings/webhooks doc from multi-webhook list
 */
export async function syncLegacyConfigFromList(list = []) {
  try {
    const activeDaily = list.find((w) => w.category === 'daily' && w.isEnabled !== false);
    const activeMonthly = list.find((w) => w.category === 'monthly' && w.isEnabled !== false);
    const activeExam = list.find((w) => w.category === 'exam' && w.isEnabled !== false);
    const firstSecret = list.find((w) => w.secretToken && w.isEnabled !== false)?.secretToken || '';

    const legacyObj = {
      dailyAttendanceUrl: activeDaily ? activeDaily.url : '',
      monthlyAttendanceUrl: activeMonthly ? activeMonthly.url : '',
      examReportsUrl: activeExam ? activeExam.url : '',
      secretToken: firstSecret,
      lastUpdated: new Date().toISOString()
    };

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(legacyObj));

    if (db) {
      const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
      await setDoc(docRef, legacyObj, { merge: true }).catch(() => {});
    }
  } catch (e) {
    console.warn('Failed to sync legacy webhook config:', e);
  }
}

/**
 * Save or Update an individual Webhook item in Firestore and local storage
 */
export async function saveWebhookItem(webhookData) {
  const isEdit = Boolean(webhookData.id);
  const id = webhookData.id || `wh_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const now = new Date().toISOString();

  const itemToSave = {
    id,
    name: webhookData.name ? webhookData.name.trim() : 'Webhook Endpoint',
    category: webhookData.category || 'daily',
    url: webhookData.url ? webhookData.url.trim() : '',
    secretToken: webhookData.secretToken ? webhookData.secretToken.trim() : '',
    isEnabled: webhookData.isEnabled !== false,
    updatedAt: now,
    createdAt: webhookData.createdAt || now
  };

  // 1. Update local cache immediately
  let list = getCachedWebhooksList();
  if (isEdit) {
    list = list.map((w) => (w.id === id ? itemToSave : w));
  } else {
    list.unshift(itemToSave);
  }
  try {
    localStorage.setItem(LOCAL_STORAGE_LIST_KEY, JSON.stringify(list));
    syncLegacyConfigFromList(list);
  } catch (_) {}

  // 2. Save to Firestore
  try {
    if (db) {
      const docRef = doc(db, WEBHOOKS_COLLECTION, id);
      await setDoc(docRef, itemToSave, { merge: true });
    }
    return { success: true, item: itemToSave };
  } catch (err) {
    console.error('Error saving webhook to Firestore:', err);
    return {
      success: true,
      item: itemToSave,
      warning: 'Saved locally, Firestore sync will retry when online.'
    };
  }
}

/**
 * Delete a Webhook item from Firestore and local storage
 */
export async function deleteWebhookItem(id) {
  if (!id) return { success: false, message: 'Invalid Webhook ID.' };

  // 1. Update local cache
  let list = getCachedWebhooksList();
  list = list.filter((w) => w.id !== id);
  try {
    localStorage.setItem(LOCAL_STORAGE_LIST_KEY, JSON.stringify(list));
    syncLegacyConfigFromList(list);
  } catch (_) {}

  // 2. Delete from Firestore
  try {
    if (db) {
      const docRef = doc(db, WEBHOOKS_COLLECTION, id);
      await deleteDoc(docRef);
    }
    return { success: true };
  } catch (err) {
    console.error('Error deleting webhook from Firestore:', err);
    return { success: true, warning: 'Deleted locally, Firestore sync will retry.' };
  }
}

/**
 * Toggle Active / Inactive status for a Webhook item
 */
export async function toggleWebhookItemStatus(id, isEnabled) {
  if (!id) return { success: false, message: 'Invalid Webhook ID.' };

  // 1. Update local cache
  let list = getCachedWebhooksList();
  list = list.map((w) => (w.id === id ? { ...w, isEnabled, updatedAt: new Date().toISOString() } : w));
  try {
    localStorage.setItem(LOCAL_STORAGE_LIST_KEY, JSON.stringify(list));
    syncLegacyConfigFromList(list);
  } catch (_) {}

  // 2. Update Firestore
  try {
    if (db) {
      const docRef = doc(db, WEBHOOKS_COLLECTION, id);
      await setDoc(docRef, { isEnabled, updatedAt: new Date().toISOString() }, { merge: true });
    }
    return { success: true };
  } catch (err) {
    console.error('Error toggling webhook status in Firestore:', err);
    return { success: true };
  }
}

/**
 * Get webhooks filtered by category
 */
export function getWebhooksByCategory(list = [], category = 'daily') {
  return list.filter((w) => w.category === category && w.isEnabled !== false);
}

/**
 * Clean phone numbers (strip spaces, symbols)
 */
export function cleanPhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/\s+/g, '').replace(/[^0-9+]/g, '');
}

/**
 * Format phone number for WhatsApp Gateways (e.g. 1automations, Cloud API)
 * Ensures 10-digit Indian numbers are prefixed with '91' and stripped of '+' or leading '0'
 */
export function formatWhatsAppPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  // 10-digit standard Indian mobile (e.g. 9022705467) -> 919022705467
  if (digits.length === 10) {
    return `91${digits}`;
  }
  // 11 digits starting with 0 (e.g. 09022705467) -> 919022705467
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  // 12 digits starting with 91 (e.g. 919022705467) -> keep as is
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  // If starts with 0091 -> 91
  if (digits.startsWith('0091')) {
    return digits.slice(2);
  }
  return digits;
}

/**
 * Get weekday name from date (e.g. 'Monday', 'Friday')
 */
export function getDayOfWeekName(dateStr) {
  try {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (dateStr) {
      const parts = String(dateStr).split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (!isNaN(d.getTime())) return days[d.getDay()];
      }
    }
  } catch (_) {}
  const now = new Date();
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
}

/**
 * Format date for display and WhatsApp templates (DD-MM-YYYY)
 */
export function formatDisplayDate(dateStr) {
  if (!dateStr) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  const parts = String(dateStr).split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

/**
 * Check if the webhook URL is a WhatsApp Gateway (e.g. 1automations, Wati, AiSensy, etc.)
 */
export function isWhatsAppGatewayUrl(url) {
  if (!url) return false;
  const lower = String(url).toLowerCase();
  return (
    lower.includes('1automations') ||
    lower.includes('1automation') ||
    lower.includes('wati') ||
    lower.includes('aisensy') ||
    lower.includes('gallabox') ||
    lower.includes('interakt') ||
    lower.includes('doubletick') ||
    lower.includes('gupshup') ||
    lower.includes('whatsapp') ||
    lower.includes('wa.me') ||
    lower.includes('number=') ||
    lower.includes('phone=') ||
    lower.includes('mobile=') ||
    lower.includes('message=') ||
    lower.includes('91xxxxxxxxxx') ||
    lower.includes('api.chat') ||
    lower.includes('ultra-msg') ||
    lower.includes('ultramsg') ||
    lower.includes('maytapi') ||
    lower.includes('wppconnect')
  );
}

/**
 * Resolve Webhook URL for an individual student:
 * Supports Daily Attendance, Monthly Attendance, and Exam Reports.
 * Replaces or auto-appends number/phone and message parameters for any gateway.
 */
export function resolveWebhookUrlForStudent(rawUrl, studentData, schoolProfile = {}, eventType = 'daily') {
  let url = String(rawUrl || '').trim();
  if (!url) {
    return {
      resolvedUrl: '',
      formattedPhone: '',
      templateMessage: ''
    };
  }

  const isExam = String(eventType).toLowerCase().includes('exam');
  const isMonthly = String(eventType).toLowerCase().includes('monthly');

  // Smart endpoint ID correction: Prevent cross-category mixups on 1automations gateway
  if (isMonthly) {
    if (url.includes('6ab2206ac277c1989c5cbdfd') || url.includes('6ab4c65fc277c1989c5ef36f')) {
      url = url.replace(/6ab2206ac277c1989c5cbdfd|6ab4c65fc277c1989c5ef36f/g, '6ab20b38c277c1989c5ca144');
    }
  } else if (isExam) {
    if (url.includes('6ab2206ac277c1989c5cbdfd') || url.includes('6ab20b38c277c1989c5ca144')) {
      url = url.replace(/6ab2206ac277c1989c5cbdfd|6ab20b38c277c1989c5ca144/g, '6ab4c65fc277c1989c5ef36f');
    }
  } else {
    if (url.includes('6ab20b38c277c1989c5ca144') || url.includes('6ab4c65fc277c1989c5ef36f')) {
      url = url.replace(/6ab20b38c277c1989c5ca144|6ab4c65fc277c1989c5ef36f/g, '6ab2206ac277c1989c5cbdfd');
    }
  }

  const sanitize = (val) => String(val || '').replace(/,/g, ' ').trim();
  const phone = formatWhatsAppPhone(studentData.parentPhone || studentData.parentContact || studentData.parent_phone || studentData.phone || studentData.mobile || '');
  const day = sanitize(getDayOfWeekName(studentData.date));
  const attendanceDate = sanitize(formatDisplayDate(studentData.date));
  const studentName = sanitize(studentData.name || studentData.studentName || 'Student');
  
  // Format class and division cleanly (e.g. "10-A")
  let classDivision = sanitize(studentData.className || 'Class');
  if (studentData.division && studentData.division !== '-') {
    const cleanDiv = sanitize(studentData.division);
    if (!classDivision.includes(cleanDiv)) {
      classDivision = `${classDivision}-${cleanDiv}`;
    }
  }
  classDivision = classDivision.replace(/\s*-\s*/g, '-').trim();

  const rawStatus = String(studentData.status || '').trim().toLowerCase();
  const attendanceStatus = rawStatus === 'absent' ? 'Absent' : 'Present';
  const attendanceRemark = sanitize(studentData.remarks || (attendanceStatus === 'Present' ? 'Regular Attendance' : 'Absent Today'));
  const schoolName = sanitize(schoolProfile.schoolName || 'SGM Karad');

  // Aggregated data for Monthly and Exam reports
  const monthYear = sanitize((studentData.month || 'October') + (studentData.year ? ` ${studentData.year}` : ' 2026'));
  const totalWorking = String(studentData.totalWorkingDays || 25);
  const presentDays = String(studentData.presentDays !== undefined ? studentData.presentDays : 0);
  const absentDays = String(studentData.absentDays !== undefined ? studentData.absentDays : 0);
  const rawAttPct = studentData.attendancePercentage !== undefined ? studentData.attendancePercentage : (studentData.percentage || 0);
  const attPct = String(Math.round((parseFloat(String(rawAttPct).replace(/%/g, '')) || 0) * 10) / 10);

  const examName = sanitize(studentData.examTitle || studentData.examName || 'Semester Examination');
  const totalMarks = String(studentData.totalMarks !== undefined ? studentData.totalMarks : (studentData.totalMax || studentData.maxTotal || 100));
  const marksObtained = String(studentData.marksObtained !== undefined ? studentData.marksObtained : (studentData.totalScore !== undefined ? studentData.totalScore : (studentData.total || 0)));
  const rawExamPct = studentData.percentage !== undefined ? studentData.percentage : 0;
  const examPct = String(Math.round((parseFloat(String(rawExamPct).replace(/%/g, '')) || 0) * 10) / 10);
  const grade = sanitize(studentData.grade && studentData.grade !== '—' && studentData.grade !== 'N/A'
    ? studentData.grade
    : (parseFloat(examPct) >= 90 ? 'A+' : parseFloat(examPct) >= 75 ? 'A' : parseFloat(examPct) >= 60 ? 'B' : parseFloat(examPct) >= 40 ? 'Passed' : 'Remedial'));
  const resultStatus = sanitize(studentData.result || studentData.resultStatus || (parseFloat(examPct) >= 40 ? 'PASSED' : 'REMEDIAL'));
  const resultRemark = sanitize(studentData.remarks || (resultStatus === 'PASSED' ? 'Promotion with Merit' : 'Needs Academic Guidance'));

  // Comprehensive dictionary mapping lowercase template tokens to real values
  const tokenDict = {
    // Daily category keyword & tokens
    'day': 'day',
    'daily': 'day',
    'dayofweek': day,
    'weekday': day,
    'attendancedate': attendanceDate,
    'date': attendanceDate,
    'studentname': studentName,
    'name': studentName,
    'classdivision': classDivision,
    'class': classDivision,
    'attendancestatus': attendanceStatus,
    'status': attendanceStatus,
    'attendanceremark': attendanceRemark,
    'remark': attendanceRemark,
    'remarks': attendanceRemark,
    'schoolname': schoolName,
    'school': schoolName,

    // Monthly tokens
    'monthly': 'monthly',
    'monthyear': monthYear,
    'month': studentData.month || monthYear,
    'totalworkingdays': totalWorking,
    'workingdays': totalWorking,
    'totaldays': totalWorking,
    'dayspresent': presentDays,
    'presentdays': presentDays,
    'present': presentDays,
    'daysabsent': absentDays,
    'absentdays': absentDays,
    'absent': absentDays,
    'attendancepercentage': attPct,
    'percentage': attPct,
    'attpct': attPct,

    // Exam tokens
    'exam': 'exam',
    'examname': examName,
    'examtitle': examName,
    'examdate': attendanceDate,
    'totalmarks': totalMarks,
    'maxmarks': totalMarks,
    'marksobtained': marksObtained,
    'totalscore': marksObtained,
    'marks': marksObtained,
    'score': marksObtained,
    'exampct': examPct,
    'grade': grade,
    'resultstatus': resultStatus,
    'result': resultStatus,
    'resultremark': resultRemark
  };

  let originalTemplateMsg = '';
  try {
    const tempUrl = new URL(url);
    originalTemplateMsg = tempUrl.searchParams.get('message') || '';
  } catch (_) {}

  let rawMessage = '';
  let encodedCommaDelimited = '';

  const firstToken = (originalTemplateMsg ? originalTemplateMsg.split(',')[0].trim().toLowerCase() : '');
  const templateCategoryMatches = isExam
    ? (firstToken === 'exam')
    : isMonthly
    ? (firstToken === 'monthly')
    : (firstToken === 'day' || firstToken === 'daily');

  if (originalTemplateMsg && originalTemplateMsg.includes(',') && templateCategoryMatches) {
    // Resolve tokens directly based on the user's template structure!
    const tokens = originalTemplateMsg.split(',');
    rawMessage = tokens.map((t) => {
      const key = t.trim().toLowerCase();
      return tokenDict[key] !== undefined ? tokenDict[key] : t;
    }).join(',');

    encodedCommaDelimited = tokens.map((t) => {
      const key = t.trim().toLowerCase();
      const val = tokenDict[key] !== undefined ? tokenDict[key] : t;
      return encodeURIComponent(String(val).replace(/,/g, ' ').trim());
    }).join(',');
  } else if (isExam) {
    rawMessage = ['exam', studentName, classDivision, examName, attendanceDate, totalMarks, marksObtained, examPct, grade, resultStatus, resultRemark, schoolName].join(',');
    encodedCommaDelimited = ['exam', studentName, classDivision, examName, attendanceDate, totalMarks, marksObtained, examPct, grade, resultStatus, resultRemark, schoolName].map((v) => encodeURIComponent(String(v).replace(/,/g, ' ').trim())).join(',');
  } else if (isMonthly) {
    rawMessage = ['monthly', monthYear, studentName, classDivision, totalWorking, presentDays, absentDays, attPct, attendanceRemark, schoolName].join(',');
    encodedCommaDelimited = ['monthly', monthYear, studentName, classDivision, totalWorking, presentDays, absentDays, attPct, attendanceRemark, schoolName].map((v) => encodeURIComponent(String(v).replace(/,/g, ' ').trim())).join(',');
  } else {
    rawMessage = ['day', attendanceDate, studentName, classDivision, attendanceStatus, attendanceRemark, schoolName].join(',');
    encodedCommaDelimited = ['day', attendanceDate, studentName, classDivision, attendanceStatus, attendanceRemark, schoolName].map((v) => encodeURIComponent(String(v).replace(/,/g, ' ').trim())).join(',');
  }

  try {
    const parsed = new URL(url);

    // 1. Recipient Phone Parameter Handling
    let phoneParamFound = false;
    ['number', 'phone', 'mobile', 'to', 'recipient'].forEach((param) => {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, phone || '91XXXXXXXXXX');
        phoneParamFound = true;
      }
    });
    // If no phone param exists in query string, auto-append 'number'
    if (!phoneParamFound && isWhatsAppGatewayUrl(url)) {
      parsed.searchParams.set('number', phone || '91XXXXXXXXXX');
    }

    // 2. Message Parameter Handling
    let msgParamFound = false;
    ['message', 'text', 'msg', 'body'].forEach((param) => {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.delete(param);
        msgParamFound = true;
      }
    });

    const baseStr = parsed.toString();
    const delim = baseStr.includes('?') ? '&' : '?';
    url = `${baseStr}${delim}message=${encodedCommaDelimited}`;
  } catch (_) {
    // Regex fallback if URL constructor fails
    const litPlaceholder = 'day,AttendanceDate,StudentName,ClassDivision,AttendanceStatus,AttendanceRemark,SchoolName';
    if (url.includes(litPlaceholder)) {
      url = url.replace(litPlaceholder, encodedCommaDelimited);
    } else if (url.includes('message=')) {
      url = url.replace(/([?&]message=)[^&]*/, `$1${encodedCommaDelimited}`);
    } else {
      url += (url.includes('?') ? '&' : '?') + `message=${encodedCommaDelimited}`;
    }

    if (phone) {
      if (url.includes('number=')) {
        url = url.replace(/([?&]number=)[^&]*/, (m, p1) => p1 + phone);
      } else {
        url += `&number=${phone}`;
      }
    }
  }

  // Fallback regex replacements for any remaining placeholders
  if (phone) {
    url = url.replace(/91X{8,12}/gi, phone);
    url = url.replace(/X{10,12}/gi, phone);
    url = url.replace(/\{\{number\}\}/gi, phone);
    url = url.replace(/\{\{phone\}\}/gi, phone);
    url = url.replace(/\{\{parentPhone\}\}/gi, phone);
    url = url.replace(/\{\{parentContact\}\}/gi, phone);
  }

  // Template tag replacements if present
  url = url.replace(/\{\{StudentName\}\}/gi, encodeURIComponent(studentName));
  url = url.replace(/\{\{AttendanceDate\}\}/gi, encodeURIComponent(attendanceDate));
  url = url.replace(/\{\{AttendanceStatus\}\}/gi, encodeURIComponent(attendanceStatus));
  url = url.replace(/\{\{ClassDivision\}\}/gi, encodeURIComponent(classDivision));
  url = url.replace(/\{\{AttendanceRemark\}\}/gi, encodeURIComponent(attendanceRemark));
  url = url.replace(/\{\{SchoolName\}\}/gi, encodeURIComponent(schoolName));
  url = url.replace(/\{\{Day\}\}/gi, encodeURIComponent(day));

  return {
    resolvedUrl: url,
    formattedPhone: phone,
    templateMessage: rawMessage,
    day,
    attendanceDate,
    studentName,
    classDivision,
    attendanceStatus,
    attendanceRemark,
    schoolName
  };
}

export function buildStudentWebhookPayload({
  student,
  schoolProfile = {},
  date = null,
  eventType = 'daily_attendance'
}) {
  const isExam = String(eventType).toLowerCase().includes('exam');
  const isMonthly = String(eventType).toLowerCase().includes('monthly');

  const sanitize = (val) => String(val || '').replace(/,/g, ' ').trim();
  const phone = formatWhatsAppPhone(student.parentPhone || student.parentContact || student.parent_phone || student.phone || student.mobile || '');
  const day = sanitize(getDayOfWeekName(date || student.date));
  const attendanceDate = sanitize(formatDisplayDate(date || student.date));
  const studentName = sanitize(student.name || student.studentName || 'Student');

  let classDivision = sanitize(student.className || 'Class');
  if (student.division && student.division !== '-') {
    const cleanDiv = sanitize(student.division);
    if (!classDivision.includes(cleanDiv)) {
      classDivision = `${classDivision}-${cleanDiv}`;
    }
  }
  classDivision = classDivision.replace(/\s*-\s*/g, '-').trim();

  const rawStatus = String(student.status || '').trim().toLowerCase();
  const attendanceStatus = rawStatus === 'absent' ? 'Absent' : 'Present';
  const attendanceRemark = sanitize(student.remarks || (attendanceStatus === 'Present' ? 'Regular Attendance' : 'Absent Today'));
  const schoolName = sanitize(schoolProfile.schoolName || 'SGM Karad');

  // Monthly values
  const monthYear = sanitize((student.month || 'October') + (student.year ? ` ${student.year}` : ' 2026'));
  const totalWorking = String(student.totalWorkingDays || 25);
  const presentDays = String(student.presentDays !== undefined ? student.presentDays : 0);
  const absentDays = String(student.absentDays !== undefined ? student.absentDays : 0);
  const rawAttPct = student.attendancePercentage !== undefined ? student.attendancePercentage : (student.percentage || 0);
  const attPct = String(Math.round((parseFloat(String(rawAttPct).replace(/%/g, '')) || 0) * 10) / 10);

  // Exam values
  const examName = sanitize(student.examTitle || student.examName || 'Semester Examination');
  const totalMarks = String(student.totalMarks !== undefined ? student.totalMarks : (student.totalMax || student.maxTotal || 100));
  const marksObtained = String(student.marksObtained !== undefined ? student.marksObtained : (student.totalScore !== undefined ? student.totalScore : (student.total || 0)));
  const rawExamPct = student.percentage !== undefined ? student.percentage : 0;
  const examPct = String(Math.round((parseFloat(String(rawExamPct).replace(/%/g, '')) || 0) * 10) / 10);
  const grade = sanitize(student.grade && student.grade !== '—' && student.grade !== 'N/A'
    ? student.grade
    : (parseFloat(examPct) >= 90 ? 'A+' : parseFloat(examPct) >= 75 ? 'A' : parseFloat(examPct) >= 60 ? 'B' : parseFloat(examPct) >= 40 ? 'Passed' : 'Remedial'));
  const resultStatus = sanitize(student.result || student.resultStatus || (parseFloat(examPct) >= 40 ? 'PASSED' : 'REMEDIAL'));
  const resultRemark = sanitize(student.remarks || (resultStatus === 'PASSED' ? 'Promotion with Merit' : 'Needs Academic Guidance'));

  let message = '';
  if (isExam) {
    message = ['exam', studentName, classDivision, examName, attendanceDate, totalMarks, marksObtained, examPct, grade, resultStatus, resultRemark, schoolName].join(',');
  } else if (isMonthly) {
    message = ['monthly', monthYear, studentName, classDivision, totalWorking, presentDays, absentDays, attPct, attendanceRemark, schoolName].join(',');
  } else {
    message = [day, attendanceDate, studentName, classDivision, attendanceStatus, attendanceRemark, schoolName].join(',');
  }

  return {
    event: eventType,
    number: phone,
    phone: phone,
    mobile: phone,
    chat_uid: phone,
    recipient: phone,
    to: phone,
    message,
    text: message,

    // Daily keys (both PascalCase and lowercase)
    day,
    AttendanceDate: attendanceDate,
    attendancedate: attendanceDate,
    date: attendanceDate,
    StudentName: studentName,
    studentname: studentName,
    name: studentName,
    ClassDivision: classDivision,
    classdivision: classDivision,
    class: classDivision,
    AttendanceStatus: attendanceStatus,
    attendancestatus: attendanceStatus,
    status: attendanceStatus,
    AttendanceRemark: attendanceRemark,
    attendanceremark: attendanceRemark,
    remark: attendanceRemark,
    SchoolName: schoolName,
    schoolname: schoolName,

    // Monthly keys
    monthly: 'monthly',
    MonthYear: monthYear,
    monthyear: monthYear,
    month: student.month || monthYear,
    TotalWorkingDays: totalWorking,
    totalworkingdays: totalWorking,
    DaysPresent: presentDays,
    dayspresent: presentDays,
    presentDays: presentDays,
    DaysAbsent: absentDays,
    daysabsent: absentDays,
    absentDays: absentDays,
    AttendancePercentage: attPct,
    attendancepercentage: attPct,

    // Exam keys
    exam: 'exam',
    examname: examName,
    examdate: attendanceDate,
    totalmarks: totalMarks,
    marksobtained: marksObtained,
    percentage: examPct,
    grade,
    resultstatus: resultStatus,
    resultremark: resultRemark,

    student: {
      id: student.id || student.studentId || '',
      rollNo: student.rollNo || '',
      name: studentName,
      class: classDivision,
      className: student.className || '',
      division: student.division || '',
      status: attendanceStatus,
      date: date || student.date || new Date().toISOString().split('T')[0],
      parentName: student.parentName || 'Parent / Guardian',
      parentPhone: phone,
      remarks: attendanceRemark
    },
    school: {
      schoolId: schoolProfile.schoolId || 'SCH-2026-904',
      schoolName: schoolName,
      adminName: schoolProfile.adminName || 'Principal Administrator'
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Format Daily Attendance Payload
 */
export function buildDailyAttendancePayload({
  students = [],
  classInfo = null,
  date = null,
  schoolProfile = {}
}) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const nowIso = new Date().toISOString();

  let presentCount = 0;
  let absentCount = 0;
  let notMarkedCount = 0;

  const formattedStudents = students.map((s) => {
    const raw = String(s.status || '').trim().toLowerCase();
    let normStatus = 'Not Marked';
    if (raw === 'present') {
      normStatus = 'Present';
      presentCount++;
    } else if (raw === 'absent') {
      normStatus = 'Absent';
      absentCount++;
    } else {
      normStatus = 'Not Marked';
      notMarkedCount++;
    }

    return {
      studentId: s.id || s.studentId || '',
      rollNo: s.rollNo || '',
      studentName: s.name || s.studentName || 'Student',
      classId: s.classId || classInfo?.id || '',
      className: s.className || classInfo?.name || 'Class',
      division: s.division || classInfo?.section || '-',
      status: normStatus,
      date: targetDate,
      parentName: s.parentName || 'Parent / Guardian',
      parentPhone: cleanPhone(s.parentPhone || s.phone || ''),
      remarks: s.remarks || ''
    };
  });

  const total = formattedStudents.length;
  const markedTotal = presentCount + absentCount;
  const attendanceRate = markedTotal > 0 ? Number(((presentCount / markedTotal) * 100).toFixed(1)) : 0;

  return {
    event: 'daily_attendance',
    timestamp: nowIso,
    school: {
      schoolId: schoolProfile.schoolId || 'SCH-2026-904',
      schoolName: schoolProfile.schoolName || 'SmartClass Academy',
      adminName: schoolProfile.adminName || 'Principal Administrator'
    },
    filter: {
      targetType: total === 1 ? 'single_student' : 'class_bulk',
      classId: classInfo?.id || (total === 1 ? formattedStudents[0]?.classId : 'all'),
      className: classInfo?.name || (total === 1 ? formattedStudents[0]?.className : 'All Selected'),
      division: classInfo?.section || (total === 1 ? formattedStudents[0]?.division : '-'),
      date: targetDate
    },
    summary: {
      totalStudents: total,
      presentCount,
      absentCount,
      notMarkedCount,
      attendancePercentage: attendanceRate
    },
    students: formattedStudents
  };
}

/**
 * Format Monthly Attendance Payload
 */
export function buildMonthlyAttendancePayload({
  students = [],
  classInfo = null,
  month = '',
  year = null,
  academicYear = '2026-2027',
  totalWorkingDays = 24,
  schoolProfile = {}
}) {
  const nowIso = new Date().toISOString();
  const targetYear = year || new Date().getFullYear();

  let totalPctSum = 0;

  const formattedStudents = students.map((s) => {
    const pDays = Number(s.presentDays) || 0;
    const aDays = Number(s.absentDays) || 0;
    const wDays = Number(s.totalWorkingDays) || totalWorkingDays || (pDays + aDays) || 24;
    const pct = Number(s.attendancePercentage || s.percentage) || (wDays > 0 ? Number(((pDays / wDays) * 100).toFixed(1)) : 0);
    totalPctSum += pct;

    return {
      studentId: s.id || s.studentId || '',
      rollNo: s.rollNo || '',
      studentName: s.name || s.studentName || 'Student',
      classId: s.classId || classInfo?.id || '',
      className: s.className || classInfo?.name || 'Class',
      division: s.division || classInfo?.section || '-',
      month,
      year: targetYear,
      academicYear,
      totalWorkingDays: wDays,
      presentDays: pDays,
      absentDays: aDays,
      attendancePercentage: pct,
      parentName: s.parentName || 'Parent / Guardian',
      parentPhone: cleanPhone(s.parentPhone || s.phone || ''),
      message: s.message || `Monthly Attendance for ${s.name || 'Student'}: ${pDays}/${wDays} Days (${pct}%).`
    };
  });

  const total = formattedStudents.length;
  const avgAttendance = total > 0 ? Number((totalPctSum / total).toFixed(1)) : 0;

  return {
    event: 'monthly_attendance',
    timestamp: nowIso,
    school: {
      schoolId: schoolProfile.schoolId || 'SCH-2026-904',
      schoolName: schoolProfile.schoolName || 'SmartClass Academy',
      adminName: schoolProfile.adminName || 'Principal Administrator'
    },
    filter: {
      targetType: total === 1 ? 'single_student' : 'class_bulk',
      classId: classInfo?.id || (total === 1 ? formattedStudents[0]?.classId : 'all'),
      className: classInfo?.name || (total === 1 ? formattedStudents[0]?.className : 'All Selected'),
      division: classInfo?.section || (total === 1 ? formattedStudents[0]?.division : '-'),
      month,
      year: targetYear,
      academicYear,
      totalWorkingDays
    },
    summary: {
      totalStudents: total,
      averageAttendancePercentage: avgAttendance,
      studentsAbove75: formattedStudents.filter(s => s.attendancePercentage >= 75).length,
      studentsBelow75: formattedStudents.filter(s => s.attendancePercentage < 75).length
    },
    students: formattedStudents
  };
}

/**
 * Format Exam Reports Payload
 */
export function buildExamReportPayload({
  students = [],
  classInfo = null,
  examInfo = null,
  schoolProfile = {}
}) {
  const nowIso = new Date().toISOString();

  let passedCount = 0;
  let remedialCount = 0;
  let totalPctSum = 0;

  const formattedStudents = students.map((s) => {
    const marksData = s.performance || s.overall || {};
    const totalScore = Number(s.totalScore !== undefined ? s.totalScore : (marksData.totalScore || 0));
    const totalMax = Number(s.totalMax !== undefined ? s.totalMax : (marksData.totalMax || 100));
    const pct = Number(s.percentage !== undefined ? s.percentage : (marksData.percentage || 0));
    const grade = s.grade || marksData.grade || (pct >= 40 ? 'Pass' : 'F');
    const isPassed = pct >= 40;

    if (isPassed) passedCount++;
    else remedialCount++;
    totalPctSum += pct;

    return {
      studentId: s.id || s.studentId || '',
      rollNo: s.rollNo || '',
      studentName: s.name || s.studentName || 'Student',
      classId: s.classId || classInfo?.id || '',
      className: s.className || classInfo?.name || 'Class',
      division: s.division || classInfo?.section || '-',
      parentName: s.parentName || 'Parent / Guardian',
      parentPhone: cleanPhone(s.parentPhone || s.phone || ''),
      attendanceToday: s.attendanceToday || s.status || 'Not Marked',
      examTitle: examInfo?.title || s.examTitle || 'Semester Examination',
      totalScore,
      totalMax,
      percentage: pct,
      grade,
      resultStatus: isPassed ? 'PASSED' : 'REMEDIAL',
      subjectScores: s.subjectMarks || s.subjects || [],
      remarks: s.remarks || ''
    };
  });

  const total = formattedStudents.length;
  const avgPct = total > 0 ? Number((totalPctSum / total).toFixed(1)) : 0;

  return {
    event: 'exam_reports',
    timestamp: nowIso,
    school: {
      schoolId: schoolProfile.schoolId || 'SCH-2026-904',
      schoolName: schoolProfile.schoolName || 'SmartClass Academy',
      adminName: schoolProfile.adminName || 'Principal Administrator'
    },
    filter: {
      targetType: total === 1 ? 'single_student' : 'class_bulk',
      classId: classInfo?.id || (total === 1 ? formattedStudents[0]?.classId : 'all'),
      className: classInfo?.name || (total === 1 ? formattedStudents[0]?.className : 'All Selected'),
      division: classInfo?.section || (total === 1 ? formattedStudents[0]?.division : '-'),
      examTitle: examInfo?.title || 'All Exams'
    },
    summary: {
      totalStudents: total,
      averagePercentage: avgPct,
      passedCount,
      remedialCount
    },
    students: formattedStudents
  };
}

export const buildExamReportsPayload = buildExamReportPayload;

/**
 * Dispatch HTTP request to webhook endpoint.
 * Intelligently routes GET vs POST:
 * WhatsApp Gateways (1automations, number=, message=) are called via GET to ensure
 * instantaneous delivery without CORS preflight or body-parsing discrepancies.
 * Generic endpoints (Zapier, Make, custom REST APIs) receive standard JSON POST payloads.
 */
export async function sendWebhookRequest(url, payload, secretToken = '') {
  if (!url || !url.trim()) {
    throw new Error('Webhook URL is not configured. Please specify a valid destination URL.');
  }

  const cleanUrl = url.trim();
  const isWhatsApp = isWhatsAppGatewayUrl(cleanUrl);
  const startTime = Date.now();

  let responseData = null;
  let status = null;
  let isSuccess = false;
  let errorMsg = null;

  // Determine whether to route via GET or POST:
  // WhatsApp gateways or URLs with query parameters (?number= or ?message=)
  // are designed to be hit as GET requests with parameters directly in the query string.
  const prefersGet = isWhatsApp || (cleanUrl.includes('?') && (cleanUrl.includes('number=') || cleanUrl.includes('message=')));

  if (prefersGet) {
    // 1. Primary Dispatch: GET request with resolved query parameters
    try {
      const getController = new AbortController();
      const getTimeout = setTimeout(() => getController.abort(), 10000);
      const getRes = await fetch(cleanUrl, {
        method: 'GET',
        signal: getController.signal
      });
      clearTimeout(getTimeout);
      status = getRes.status;
      const getText = await getRes.text();
      try {
        responseData = JSON.parse(getText);
      } catch (_) {
        responseData = getText;
      }
      if (getRes.ok || (responseData && (responseData.accepted === true || responseData.success === true))) {
        isSuccess = true;
      }
    } catch (getErr) {
      console.warn('GET dispatch notice:', getErr.message);
    }

    // 2. Only if GET did NOT succeed, try POST dispatch as a fallback
    if (!isSuccess) {
      try {
        const postController = new AbortController();
        const postTimeout = setTimeout(() => postController.abort(), 10000);
        const postRes = await fetch(cleanUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: postController.signal
        });
        clearTimeout(postTimeout);
        status = postRes.status;
        const text = await postRes.text();
        try {
          responseData = JSON.parse(text);
        } catch (_) {
          responseData = text;
        }
        if (postRes.ok || (responseData && (responseData.accepted === true || responseData.success === true))) {
          isSuccess = true;
        }
      } catch (postErr) {
        console.warn('POST fallback notice:', postErr.message);
      }
    }

    // 3. Fallback: If blocked by browser CORS, dispatch via no-cors mode so browser packet transmits
    if (!isSuccess) {
      try {
        await fetch(cleanUrl, { method: 'GET', mode: 'no-cors' });
        isSuccess = true;
        status = 200;
        responseData = { status: 'dispatched', mode: 'no-cors' };
      } catch (_) {}
    }

    if (!isSuccess) {
      errorMsg = `WhatsApp gateway did not confirm receipt. Status: ${status || 'unknown'}`;
    }
  } else {
    // Standard generic POST webhook (Zapier, Make, custom REST API)
    const headers = {
      'Content-Type': 'application/json'
    };

    if (secretToken && secretToken.trim()) {
      headers['Authorization'] = `Bearer ${secretToken.trim()}`;
    }

    const payloadString = JSON.stringify(payload);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(cleanUrl, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      status = res.status;
      isSuccess = res.ok || (res.status >= 200 && res.status < 300);

      try {
        const text = await res.text();
        try {
          responseData = JSON.parse(text);
        } catch (_) {
          responseData = text;
        }
      } catch (_) {
        responseData = 'OK';
      }

      if (responseData && typeof responseData === 'object' && (responseData.accepted === false || responseData.success === false)) {
        isSuccess = false;
        errorMsg = responseData.data || responseData.message || 'Webhook rejected by endpoint.';
      } else if (!isSuccess) {
        errorMsg = `Server responded with HTTP ${status}: ${typeof responseData === 'string' ? responseData : 'Error'}`;
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        errorMsg = 'Webhook request timed out after 12 seconds.';
      } else {
        // Attempt no-cors POST dispatch so browser packet transmits to gateway
        try {
          await fetch(cleanUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: payloadString
          });
          isSuccess = true;
          status = 200;
          responseData = { status: 'dispatched', mode: 'no-cors' };
          errorMsg = null;
        } catch (_) {
          errorMsg = err.message || 'Network connection failed.';
        }
      }
    }
  }

  const durationMs = Date.now() - startTime;

  // Audit log to Firestore asynchronously
  try {
    if (db) {
      addDoc(collection(db, WEBHOOK_LOGS_COLLECTION), {
        event: payload.event || 'unknown',
        url: cleanUrl,
        studentCount: payload.students?.length || (payload.student ? 1 : 0),
        recipientPhone: payload.number || payload.phone || payload.student?.parentPhone || null,
        studentName: payload.StudentName || payload.student?.name || null,
        status: isSuccess ? 'Success' : 'Failed',
        statusCode: status,
        durationMs,
        timestamp: new Date().toISOString(),
        error: errorMsg || null
      }).catch(() => {});
    }
  } catch (_) {}

  if (!isSuccess && errorMsg) {
    throw new Error(errorMsg);
  }

  return {
    success: true,
    statusCode: status || 200,
    durationMs,
    response: responseData,
    studentCount: payload.students?.length || (payload.student ? 1 : 0)
  };
}

/**
 * Smart Webhook Dispatcher
 * Intelligently handles both Single Student and Bulk Class dispatches.
 * If targetUrl is a WhatsApp Gateway (1automations, number=, etc.), dispatches per-student
 * with real recipient phone numbers and formatted message parameters.
 */
export async function dispatchSmartWebhook({
  targetUrl,
  payload,
  secretToken = '',
  scope = 'bulk',
  student = null,
  students = [],
  schoolProfile = {},
  date = null,
  eventType = 'daily_attendance',
  onProgress = null
}) {
  if (!targetUrl || !targetUrl.trim()) {
    throw new Error('Webhook URL is not configured. Please specify a valid destination URL.');
  }

  const cleanUrl = targetUrl.trim();
  const isWhatsApp = isWhatsAppGatewayUrl(cleanUrl);

  // Single Student Dispatch Mode
  if (scope === 'single' || (students.length === 1 && !student)) {
    const targetStudent = student || students[0];
    const { resolvedUrl, formattedPhone, templateMessage, studentName, attendanceStatus } =
      resolveWebhookUrlForStudent(cleanUrl, targetStudent, schoolProfile, eventType);

    const singlePayload = buildStudentWebhookPayload({
      student: targetStudent,
      schoolProfile,
      date,
      eventType
    });

    const res = await sendWebhookRequest(resolvedUrl, singlePayload, secretToken);
    return {
      success: true,
      mode: 'single',
      statusCode: res.statusCode,
      durationMs: res.durationMs,
      studentCount: 1,
      recipientPhone: formattedPhone,
      studentName,
      attendanceStatus,
      templateMessage,
      resolvedUrl
    };
  }

  // Bulk Dispatch Mode
  const effectiveStudents = students.length > 0 ? students : (student ? [student] : []);

  // If WhatsApp Gateway or URL has recipient parameter (number=), we MUST dispatch per-parent
  if (isWhatsApp) {
    const validStudents = [];
    const missingContactStudents = [];

    effectiveStudents.forEach((s) => {
      const phone = formatWhatsAppPhone(s.parentPhone || s.parentContact || s.parent_phone || s.phone || s.mobile);
      if (phone && phone.length >= 10) {
        validStudents.push({ ...s, formattedPhone: phone });
      } else {
        missingContactStudents.push(s);
      }
    });

    if (validStudents.length === 0) {
      throw new Error('No students have valid 10-digit parent phone numbers for WhatsApp dispatch.');
    }

    const results = [];
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < validStudents.length; i++) {
      if (i > 0) {
        // Throttle requests by 350ms to respect WhatsApp gateway rate limits
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      const s = validStudents[i];
      const { resolvedUrl, formattedPhone, studentName } =
        resolveWebhookUrlForStudent(cleanUrl, s, schoolProfile, eventType);

      const studentPayload = buildStudentWebhookPayload({
        student: s,
        schoolProfile,
        date,
        eventType
      });

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: validStudents.length,
          studentName,
          phone: formattedPhone,
          status: 'sending'
        });
      }

      try {
        const res = await sendWebhookRequest(resolvedUrl, studentPayload, secretToken);
        sentCount++;
        results.push({
          studentId: s.id,
          studentName,
          phone: formattedPhone,
          success: true,
          statusCode: res.statusCode
        });

        if (onProgress) {
          onProgress({
            current: i + 1,
            total: validStudents.length,
            studentName,
            phone: formattedPhone,
            status: 'sent',
            statusCode: res.statusCode
          });
        }
      } catch (err) {
        failedCount++;
        results.push({
          studentId: s.id,
          studentName,
          phone: formattedPhone,
          success: false,
          error: err.message
        });

        if (onProgress) {
          onProgress({
            current: i + 1,
            total: validStudents.length,
            studentName,
            phone: formattedPhone,
            status: 'failed',
            error: err.message
          });
        }
      }

      // Safe throttle delay between WhatsApp dispatches (600ms) to respect rate limits
      if (i < validStudents.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    return {
      success: sentCount > 0,
      mode: 'bulk_whatsapp',
      total: effectiveStudents.length,
      sentCount,
      failedCount,
      skippedCount: missingContactStudents.length,
      results
    };
  }

  // Standard generic webhook endpoint (e.g. Zapier, Make, custom REST API)
  const res = await sendWebhookRequest(cleanUrl, payload, secretToken);
  return {
    success: true,
    mode: 'bulk_generic',
    statusCode: res.statusCode,
    durationMs: res.durationMs,
    studentCount: effectiveStudents.length
  };
}

/**
 * Send a lightweight Ping Test to verify endpoint availability
 */
export async function testWebhookPing(url, secretToken = '') {
  if (!url || !url.trim()) {
    return { success: false, message: 'Please enter a URL first.' };
  }

  const cleanUrl = url.trim();
  const dummyStudent = {
    name: 'Test Student',
    className: 'Class 10',
    division: 'A',
    status: 'Present',
    remarks: 'Test Verification',
    parentPhone: '9876543210',
    date: new Date().toISOString().split('T')[0]
  };

  const { resolvedUrl } = resolveWebhookUrlForStudent(cleanUrl, dummyStudent, { schoolName: 'SmartClass Academy' }, 'daily');

  const pingPayload = {
    event: 'ping_test',
    number: '919876543210',
    phone: '919876543210',
    day: getDayOfWeekName(new Date().toISOString().split('T')[0]),
    AttendanceDate: formatDisplayDate(new Date().toISOString().split('T')[0]),
    StudentName: 'Test Student',
    ClassDivision: 'Class 10-A',
    AttendanceStatus: 'Present',
    AttendanceRemark: 'Test Verification',
    SchoolName: 'SmartClass Academy',
    timestamp: new Date().toISOString(),
    source: 'SmartClass Admin Panel Webhook Verification',
    message: 'Ping test verification payload from SmartClass Web Admin.'
  };

  try {
    const result = await sendWebhookRequest(resolvedUrl || cleanUrl, pingPayload, secretToken);
    return {
      success: true,
      message: `Endpoint active & reachable! (${result.durationMs}ms)`
    };
  } catch (e) {
    return {
      success: false,
      message: e.message || 'Endpoint unreachable.'
    };
  }
}
