// ==================== APP STATE STORE ====================
const state = {
  schoolProfile: {
    schoolId: 'SCH-2026-904',
    schoolName: 'St. Mary Senior Secondary School',
    adminName: 'Principal Administrator'
  },
  classes: [
    { id: 'c1', name: 'Class 10', section: 'A', roomNumber: 'Room 101' },
    { id: 'c2', name: 'Class 10', section: 'B', roomNumber: 'Room 102' },
    { id: 'c3', name: 'Class 9', section: 'A', roomNumber: 'Room 201' },
    { id: 'c4', name: 'Class 9', section: 'B', roomNumber: 'Room 202' }
  ],
  teachers: [
    { id: 't1', name: 'Dr. Ramesh Kumar', subject: 'Mathematics', qualification: 'Ph.D, M.Sc', phone: '9876543210', assignedClassId: 'c1' },
    { id: 't2', name: 'Mrs. Sunita Verma', subject: 'Science', qualification: 'M.Sc, B.Ed', phone: '9812345678', assignedClassId: 'c2' },
    { id: 't3', name: 'Mr. Amit Gupta', subject: 'English', qualification: 'M.A, B.Ed', phone: '9765432109', assignedClassId: null }
  ],
  students: [
    { id: 's1', rollNo: '101', name: 'Rahul Sharma', classId: 'c1', parentName: 'Vikram Sharma', parentPhone: '9876543210' },
    { id: 's2', rollNo: '102', name: 'Priya Patel', classId: 'c1', parentName: 'Suresh Patel', parentPhone: '9812345678' },
    { id: 's3', rollNo: '103', name: 'Aman Verma', classId: 'c2', parentName: 'Rajesh Verma', parentPhone: '9765432109' },
    { id: 's4', rollNo: '104', name: 'Ananya Singh', classId: 'c2', parentName: 'Sunil Singh', parentPhone: '9834567890' }
  ],
  exams: [
    { id: 'e1', title: 'Mid-Term Examination', classId: 'c1', subject: 'Mathematics', maxMarks: 100 }
  ],
  notices: [
    { id: 'n1', title: 'Parent-Teacher Meeting Scheduled', content: 'PTM for Term 1 examination results will be held this Saturday from 9:00 AM to 1:00 PM.', priority: 'Urgent', targetRole: 'All', author: 'Principal Admin', date: '2 Sep 2026' },
    { id: 'n2', title: 'Annual Sports Day Selection', content: 'Registrations are open for track and field athletics.', priority: 'Normal', targetRole: 'Students', author: 'Sports Dept', date: '1 Sep 2026' }
  ],
  activeStudentClassFilter: 'all'
};

const tabTitles = [
  ['Dashboard Overview', 'School operational metrics & real-time control center'],
  ['Class Management', 'Manage school sections, class teachers & capacity'],
  ['Teacher Directory', 'Faculty profiles, qualifications & class assignments'],
  ['Student Management', 'Enrolled students registry, filters & Excel bulk operations'],
  ['Exams & Marks Portal', 'Class exam schedules, marks entry & result publishing'],
  ['Notice Board', 'School wide announcements & targeted notifications']
];

// Load from LocalStorage if exists
function loadState() {
  const saved = localStorage.getItem('smartclass_web_admin');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      Object.assign(state, parsed);
    } catch(e) { console.error('Local storage parse error', e); }
  }
}

function saveState() {
  localStorage.setItem('smartclass_web_admin', JSON.stringify(state));
}

// Navigation & Tab Switching
function switchTab(index, element) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));

  document.querySelectorAll('.tab-content')[index].classList.add('active');
  if (element) {
    element.classList.add('active');
  } else {
    document.querySelectorAll('.nav-link')[index].classList.add('active');
  }

  document.getElementById('header-title-text').innerText = tabTitles[index][0];
  document.getElementById('header-subtitle-text').innerText = tabTitles[index][1];
}

// Render Core UI Component Views
function renderAll() {
  document.getElementById('stat-students').innerText = state.students.length;
  document.getElementById('stat-teachers').innerText = state.teachers.length;
  document.getElementById('stat-classes').innerText = state.classes.length;
  document.getElementById('stat-classes-sub').innerText = `${state.classes.length} Classes Enrolled`;

  document.getElementById('nav-class-count').innerText = state.classes.length;
  document.getElementById('nav-teacher-count').innerText = state.teachers.length;
  document.getElementById('nav-student-count').innerText = state.students.length;
  document.getElementById('nav-exam-count').innerText = state.exams.length;
  document.getElementById('nav-notice-count').innerText = state.notices.length;

  renderClasses();
  renderTeachers();
  renderStudents();
  renderExams();
  renderNotices();
  populateDropdowns();
}

function renderClasses() {
  const overviewGrid = document.getElementById('overview-classes-list');
  const fullGrid = document.getElementById('classes-full-grid');
  let html = '';

  state.classes.forEach(c => {
    const studentCount = state.students.filter(s => s.classId === c.id).length;
    const teacher = state.teachers.find(t => t.assignedClassId === c.id);

    html += `
      <div class="data-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="class-tag">${c.name} - ${c.section}</span>
          <span style="font-size: 12px; color: var(--text-secondary);">${c.roomNumber}</span>
        </div>
        <div>
          <p style="font-size: 13px; font-weight: 700; color: var(--text-primary);">Class Teacher: ${teacher ? teacher.name : '<span style="color: var(--rose);">Not Assigned</span>'}</p>
          <p style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${studentCount} Students Enrolled</p>
        </div>
        <div style="display: flex; justify-content: flex-end;">
          <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px; color: var(--rose);" onclick="deleteClass('${c.id}')"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      </div>
    `;
  });

  overviewGrid.innerHTML = html;
  fullGrid.innerHTML = html;
}

function renderTeachers() {
  const fullGrid = document.getElementById('teachers-full-grid');
  let html = '';

  state.teachers.forEach(t => {
    let classOptions = `<option value="">Unassigned</option>`;
    state.classes.forEach(c => {
      classOptions += `<option value="${c.id}" ${t.assignedClassId === c.id ? 'selected' : ''}>${c.name} - ${c.section}</option>`;
    });

    html += `
      <div class="data-card">
        <div style="display: flex; gap: 12px; align-items: center;">
          <div class="admin-avatar" style="width: 42px; height: 42px;">${t.name[0]}</div>
          <div style="flex: 1;">
            <h4 style="font-size: 15px; font-weight: 700;">${t.name}</h4>
            <p style="font-size: 12px; color: var(--text-secondary);">${t.subject} • ${t.qualification}</p>
          </div>
          <i class="fa-solid fa-trash" style="color: var(--rose); cursor: pointer;" onclick="deleteTeacher('${t.id}')"></i>
        </div>
        <div style="font-size: 12px; color: var(--text-secondary); display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
          <span><i class="fa-solid fa-phone"></i> ${t.phone}</span>
          <select class="form-control" style="width: auto; padding: 4px 8px; font-size: 11px;" onchange="assignTeacherClass('${t.id}', this.value)">
            ${classOptions}
          </select>
        </div>
      </div>
    `;
  });

  fullGrid.innerHTML = html;
}

function renderStudents() {
  const chipsContainer = document.getElementById('student-class-chips');
  const tableBody = document.getElementById('students-table-body');
  const query = document.getElementById('student-search-input').value.toLowerCase();

  let chipsHtml = `<div class="chip ${state.activeStudentClassFilter === 'all' ? 'active' : ''}" onclick="filterStudentClass('all')">All Classes (${state.students.length})</div>`;
  state.classes.forEach(c => {
    const count = state.students.filter(s => s.classId === c.id).length;
    chipsHtml += `<div class="chip ${state.activeStudentClassFilter === c.id ? 'active' : ''}" onclick="filterStudentClass('${c.id}')">${c.name} - ${c.section} (${count})</div>`;
  });
  chipsContainer.innerHTML = chipsHtml;

  let filtered = state.students;
  if (state.activeStudentClassFilter !== 'all') {
    filtered = filtered.filter(s => s.classId === state.activeStudentClassFilter);
  }
  if (query) {
    filtered = filtered.filter(s => s.name.toLowerCase().includes(query) || s.rollNo.includes(query));
  }

  let tbodyHtml = '';
  filtered.forEach(s => {
    const cls = state.classes.find(c => c.id === s.classId);
    tbodyHtml += `
      <tr>
        <td><div class="roll-badge">${s.rollNo}</div></td>
        <td style="font-weight: 700;">${s.name}</td>
        <td><span class="class-tag" style="font-size: 11px; padding: 2px 8px;">${cls ? cls.name + ' - ' + cls.section : 'Unassigned'}</span></td>
        <td>${s.parentName} (${s.parentPhone})</td>
        <td><i class="fa-solid fa-trash" style="color: var(--rose); cursor: pointer;" onclick="deleteStudent('${s.id}')"></i></td>
      </tr>
    `;
  });

  tableBody.innerHTML = tbodyHtml;
}

function filterStudentClass(classId) {
  state.activeStudentClassFilter = classId;
  renderStudents();
}

function renderExams() {
  const container = document.getElementById('exams-list-grid');
  let html = '';
  state.exams.forEach(e => {
    const cls = state.classes.find(c => c.id === e.classId);
    html += `
      <div class="data-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h4 style="font-size: 16px; font-weight: 800;">${e.title}</h4>
          <span class="class-tag">${cls ? cls.name + ' - ' + cls.section : ''}</span>
        </div>
        <p style="font-size: 13px; color: var(--text-secondary);">Subject: ${e.subject} • Max Marks: ${e.maxMarks}</p>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button class="btn btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="alert('Marks Published!')"><i class="fa-solid fa-paper-plane"></i> Publish Marks</button>
          <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px; color: var(--rose);" onclick="deleteExam('${e.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function renderNotices() {
  const container = document.getElementById('notices-grid');
  let html = '';
  state.notices.forEach(n => {
    const priorityClass = n.priority === 'Urgent' ? 'priority-urgent' : (n.priority === 'High' ? 'priority-high' : 'priority-normal');
    html += `
      <div class="data-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="priority-badge ${priorityClass}">${n.priority} PRIORITY • ${n.targetRole}</span>
          <i class="fa-solid fa-trash" style="color: var(--rose); cursor: pointer;" onclick="deleteNotice('${n.id}')"></i>
        </div>
        <h4 style="font-size: 16px; font-weight: 700; margin-top: 8px;">${n.title}</h4>
        <p style="font-size: 13px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">${n.content}</p>
        <div style="font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between; margin-top: 10px;">
          <span>By: ${n.author}</span>
          <span>${n.date}</span>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function populateDropdowns() {
  const studentSelect = document.getElementById('new-student-class');
  const examSelect = document.getElementById('new-exam-class');
  let opts = '';

  state.classes.forEach(c => {
    opts += `<option value="${c.id}">${c.name} - ${c.section}</option>`;
  });

  if (studentSelect) studentSelect.innerHTML = opts;
  if (examSelect) examSelect.innerHTML = opts;
}

// Modal Handlers
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// CRUD Actions
function addClass() {
  const name = document.getElementById('new-class-name').value.trim();
  const section = document.getElementById('new-class-section').value.trim();
  const room = document.getElementById('new-class-room').value.trim();
  if (name && section) {
    state.classes.push({ id: 'c_' + Date.now(), name, section: section.toUpperCase(), roomNumber: room || 'Room 101' });
    saveState();
    closeModal('modal-add-class');
    renderAll();
  }
}

function deleteClass(id) {
  state.classes = state.classes.filter(c => c.id !== id);
  saveState();
  renderAll();
}

function addTeacher() {
  const name = document.getElementById('new-teacher-name').value.trim();
  const subject = document.getElementById('new-teacher-subject').value.trim();
  const qual = document.getElementById('new-teacher-qual').value.trim();
  const phone = document.getElementById('new-teacher-phone').value.trim();
  if (name && phone) {
    state.teachers.push({ id: 't_' + Date.now(), name, subject: subject || 'General', qualification: qual || 'B.Ed', phone, assignedClassId: null });
    saveState();
    closeModal('modal-add-teacher');
    renderAll();
  }
}

function deleteTeacher(id) {
  state.teachers = state.teachers.filter(t => t.id !== id);
  saveState();
  renderAll();
}

function assignTeacherClass(teacherId, classId) {
  const teacher = state.teachers.find(t => t.id === teacherId);
  if (teacher) {
    teacher.assignedClassId = classId || null;
    saveState();
    renderAll();
  }
}

function addStudent() {
  const classId = document.getElementById('new-student-class').value;
  const rollNo = document.getElementById('new-student-roll').value.trim();
  const name = document.getElementById('new-student-name').value.trim();
  const parentName = document.getElementById('new-student-parent').value.trim();
  const parentPhone = document.getElementById('new-student-phone').value.trim();

  if (name && classId) {
    state.students.push({ id: 's_' + Date.now(), rollNo: rollNo || '101', name, classId, parentName: parentName || 'Parent', parentPhone });
    saveState();
    closeModal('modal-add-student');
    renderAll();
  }
}

function deleteStudent(id) {
  state.students = state.students.filter(s => s.id !== id);
  saveState();
  renderAll();
}

function addExam() {
  const classId = document.getElementById('new-exam-class').value;
  const title = document.getElementById('new-exam-title').value.trim();
  const subject = document.getElementById('new-exam-subject').value.trim();
  const maxMarks = parseFloat(document.getElementById('new-exam-max').value) || 100;

  if (title && classId) {
    state.exams.push({ id: 'e_' + Date.now(), title, classId, subject: subject || 'General', maxMarks });
    saveState();
    closeModal('modal-add-exam');
    renderAll();
  }
}

function deleteExam(id) {
  state.exams = state.exams.filter(e => e.id !== id);
  saveState();
  renderAll();
}

function addNotice() {
  const title = document.getElementById('new-notice-title').value.trim();
  const content = document.getElementById('new-notice-content').value.trim();
  const priority = document.getElementById('new-notice-priority').value;
  const targetRole = document.getElementById('new-notice-target').value;

  if (title && content) {
    state.notices.unshift({ id: 'n_' + Date.now(), title, content, priority, targetRole, author: 'Principal Admin', date: 'Today' });
    saveState();
    closeModal('modal-add-notice');
    renderAll();
  }
}

function deleteNotice(id) {
  state.notices = state.notices.filter(n => n.id !== id);
  saveState();
  renderAll();
}

function exportStudentsToCSV() {
  let csv = 'Roll No,Student Name,Class,Parent Name,Parent Phone\n';
  state.students.forEach(s => {
    const cls = state.classes.find(c => c.id === s.classId);
    csv += `"${s.rollNo}","${s.name}","${cls ? cls.name + ' - ' + cls.section : ''}","${s.parentName}","${s.parentPhone}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Students_List.csv';
  a.click();
}

// Initial Boot
loadState();
renderAll();
