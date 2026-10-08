import React from 'react';
import { getClassTheme } from '../services/classTheme';

/**
 * Modern, Education-Friendly Class Badge
 * Replaces harsh dark buttons with elegant, themed capsules.
 */
export default function ClassBadge({
  classItem,
  label,
  style = {},
  className = '',
  showIcon = true,
  size = 'sm'
}) {
  const theme = getClassTheme(classItem || label);

  let displayLabel = label;
  if (!displayLabel) {
    if (typeof classItem === 'string') {
      displayLabel = classItem;
    } else if (classItem && typeof classItem === 'object') {
      const sec = classItem.section && String(classItem.section).trim();
      displayLabel = sec ? `${classItem.name} - ${sec}` : (classItem.name || 'Unassigned');
    } else {
      displayLabel = 'Unassigned';
    }
  }

  const isSmall = size === 'sm';

  return (
    <span
      className={`class-tag ${theme.tagClass || ''} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSmall ? '5px' : '7px',
        padding: isSmall ? '3px 10px' : '5px 12px',
        borderRadius: '999px',
        fontSize: isSmall ? '11.5px' : '12.5px',
        fontWeight: 700,
        backgroundColor: theme.softBg,
        color: theme.color,
        border: `1px solid ${theme.border}`,
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
        whiteSpace: 'nowrap',
        letterSpacing: '0.2px',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'default',
        ...style
      }}
    >
      {showIcon && (
        <i
          className={`fa-solid ${theme.icon}`}
          style={{
            fontSize: isSmall ? '10px' : '11.5px',
            color: theme.accent,
            opacity: 0.95
          }}
        ></i>
      )}
      <span>{displayLabel}</span>
    </span>
  );
}
