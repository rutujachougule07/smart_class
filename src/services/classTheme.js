/**
 * Education-friendly Color Themes & Palettes for School Classes
 */

export function getClassTheme(classItem) {
  let name = '';
  if (typeof classItem === 'string') {
    name = classItem;
  } else if (classItem && typeof classItem === 'object') {
    name = `${classItem.name || ''} ${classItem.section || ''}`;
  }

  const numMatch = name.match(/\d+/);
  const num = numMatch ? parseInt(numMatch[0], 10) : 0;

  // Grade 10 - Indigo / Senior
  if (num === 10) {
    return {
      gradient: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
      softBg: '#eef2ff',
      badgeBg: '#e0e7ff',
      badgeText: '#3730a3',
      badgeBorder: '#c7d2fe',
      color: '#3730a3',
      border: '#c7d2fe',
      accent: '#4f46e5',
      lightAccent: 'rgba(79, 70, 229, 0.08)',
      tagClass: 'class-tag-indigo',
      icon: 'fa-graduation-cap'
    };
  }

  // Grade 9 - Teal / Modern Science
  if (num === 9) {
    return {
      gradient: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
      softBg: '#f0fdfa',
      badgeBg: '#ccfbf1',
      badgeText: '#0f766e',
      badgeBorder: '#99f6e4',
      color: '#0f766e',
      border: '#99f6e4',
      accent: '#0d9488',
      lightAccent: 'rgba(13, 148, 136, 0.08)',
      tagClass: 'class-tag-teal',
      icon: 'fa-book-open-reader'
    };
  }

  // Grade 8 - Amber / Dynamic
  if (num === 8) {
    return {
      gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
      softBg: '#fffbeb',
      badgeBg: '#fef3c7',
      badgeText: '#92400e',
      badgeBorder: '#fde68a',
      color: '#b45309',
      border: '#fde68a',
      accent: '#d97706',
      lightAccent: 'rgba(217, 119, 6, 0.08)',
      tagClass: 'class-tag-amber',
      icon: 'fa-shapes'
    };
  }

  // Grade 7 - Violet / Creative
  if (num === 7) {
    return {
      gradient: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
      softBg: '#faf5ff',
      badgeBg: '#f3e8ff',
      badgeText: '#6b21a8',
      badgeBorder: '#e9d5ff',
      color: '#7e22ce',
      border: '#e9d5ff',
      accent: '#7c3aed',
      lightAccent: 'rgba(124, 58, 237, 0.08)',
      tagClass: 'class-tag-purple',
      icon: 'fa-compass-drafting'
    };
  }

  // Grade 6 - Rose / Discovery
  if (num === 6) {
    return {
      gradient: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)',
      softBg: '#fff1f2',
      badgeBg: '#ffe4e6',
      badgeText: '#9f1239',
      badgeBorder: '#fecdd3',
      color: '#be123c',
      border: '#fecdd3',
      accent: '#e11d48',
      lightAccent: 'rgba(225, 29, 72, 0.08)',
      tagClass: 'class-tag',
      icon: 'fa-flask'
    };
  }

  // Default / All other classes - Professional Education Blue
  return {
    gradient: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
    softBg: '#eff6ff',
    badgeBg: '#dbeafe',
    badgeText: '#1e40af',
    badgeBorder: '#bfdbfe',
    color: '#1d4ed8',
    border: '#bfdbfe',
    accent: '#2563eb',
    lightAccent: 'rgba(37, 99, 235, 0.08)',
    tagClass: 'class-tag-sky',
    icon: 'fa-school'
  };
}
