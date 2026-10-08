/**
 * Utilities for teacher assignments and subject resolution across classes.
 */

/**
 * Returns the list of subjects assigned to a teacher for a specific class.
 *
 * @param {Object} teacher - Teacher object
 * @param {Object} classItem - Class object
 * @returns {string[]} Array of assigned subject names (trimmed, case-insensitive unique)
 */
export function getTeacherAssignedSubjectsList(teacher, classItem) {
  if (!teacher || !classItem) return [];
  const subjects = [];

  const addSubj = (s) => {
    if (typeof s === 'string' && s.trim()) {
      const clean = s.trim();
      if (!subjects.some((existing) => existing.toLowerCase() === clean.toLowerCase())) {
        subjects.push(clean);
      }
    }
  };

  // 1. From classItem.subjectTeachers: { [subj]: teacherId }
  if (classItem.subjectTeachers && typeof classItem.subjectTeachers === 'object') {
    Object.entries(classItem.subjectTeachers).forEach(([subj, tid]) => {
      if (tid === teacher.id) {
        addSubj(subj);
      }
    });
  }

  // 2. From classItem.subjectTeacherAssignments: [ { subject, teacherId }, ... ]
  if (Array.isArray(classItem.subjectTeacherAssignments)) {
    classItem.subjectTeacherAssignments.forEach((item) => {
      if (item && item.teacherId === teacher.id && item.subject) {
        addSubj(item.subject);
      }
    });
  }

  // 3. From teacher.assignedSubjects: { [classId]: [subj1, subj2] }
  if (teacher.assignedSubjects && typeof teacher.assignedSubjects === 'object' && classItem.id) {
    const list = teacher.assignedSubjects[classItem.id];
    if (Array.isArray(list)) {
      list.forEach((s) => addSubj(s));
    }
  }

  // 4. From teacher.subjectAssignments: [ { classId, subject }, ... ]
  if (Array.isArray(teacher.subjectAssignments) && classItem.id) {
    teacher.subjectAssignments.forEach((sa) => {
      if (sa && sa.classId === classItem.id && sa.subject) {
        addSubj(sa.subject);
      }
    });
  }

  return subjects;
}

/**
 * Resolves the subject to display next to a teacher's name for a particular class,
 * prioritizing the class-specific assignment over the teacher's default profile subject.
 *
 * @param {Object} teacher - Teacher object ({ id, name, subject, ... })
 * @param {Object} classItem - Class object ({ id, name, section, subjectTeachers, ... })
 * @param {string|null} currentSubjectContext - The subject of the current row/assignment if applicable
 * @returns {string} The subject assigned to the teacher for that class
 */
export function getTeacherAssignedSubjectForClass(teacher, classItem, currentSubjectContext = null) {
  if (!teacher) return currentSubjectContext || 'General';

  // When evaluating within a specific subject assignment row (e.g. Science row in Subject-Wise Teacher Assignment):
  if (currentSubjectContext) {
    // If this teacher is currently assigned to this subject slot in the class:
    if (classItem?.subjectTeachers?.[currentSubjectContext] === teacher.id) {
      return currentSubjectContext;
    }

    const assigned = getTeacherAssignedSubjectsList(teacher, classItem);
    // If the teacher has subjects assigned in this class and currentSubjectContext is one of them:
    const match = assigned.find((s) => s.toLowerCase() === currentSubjectContext.toLowerCase());
    if (match) {
      return match;
    }

    // If teacher already has other subjects assigned in this class, show them
    if (assigned.length > 0) {
      return assigned.join(', ');
    }

    // If teacher has no subjects assigned in this class yet,
    // selecting them in this row will assign them to currentSubjectContext:
    return currentSubjectContext;
  }

  // General class context (e.g. Homeroom Class Teacher dropdown, Class Cards in Classes tab / Overview):
  const assigned = getTeacherAssignedSubjectsList(teacher, classItem);
  if (assigned.length > 0) {
    return assigned.join(', ');
  }

  // If the class has a specific curriculum subject:
  if (classItem?.subject) {
    return classItem.subject;
  }

  // Fallback to teacher default subject or General
  return teacher.subject || 'General';
}
