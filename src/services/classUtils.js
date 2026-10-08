/**
 * Shared Class Matching and Normalization Utilities for SGM SmartClass
 * Ensures 100% interoperability between Flutter mobile app identifiers (e.g. "c_1", "Class 10 - A", "10-A")
 * and Web Admin Panel identifiers.
 */

export const normalizeClassKey = (input) => {
  if (!input) return '';
  return String(input)
    .toLowerCase()
    .replace(/^c_/g, '')
    .replace(/class/g, '')
    .replace(/standard/g, '')
    .replace(/grade/g, '')
    .replace(/th/g, '')
    .replace(/st/g, '')
    .replace(/nd/g, '')
    .replace(/rd/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

export const findClassObject = (identifier, classes = []) => {
  if (!identifier || !Array.isArray(classes)) return null;
  const rawId = String(identifier).trim();
  const norm = normalizeClassKey(rawId);

  // 1. Direct ID match
  const byId = classes.find((c) => c.id === rawId);
  if (byId) return byId;

  // 2. Normalized matches
  return classes.find((c) => {
    if (!c) return false;
    if (c.id === rawId) return true;
    if (normalizeClassKey(c.id) === norm) return true;
    if (normalizeClassKey(c.name) === norm) return true;
    if (normalizeClassKey(`${c.name}${c.section}`) === norm) return true;
    if (normalizeClassKey(`${c.name}-${c.section}`) === norm) return true;
    if (normalizeClassKey(`${c.name} ${c.section}`) === norm) return true;
    return false;
  }) || null;
};

export const isClassMatch = (classA, classB, classes = []) => {
  if (!classA || !classB) return false;
  if (classA === classB) return true;
  if (classA === 'all' || classB === 'all' || classA === 'global' || classB === 'global') return true;

  const keyA = normalizeClassKey(classA);
  const keyB = normalizeClassKey(classB);
  if (keyA && keyB && keyA === keyB) return true;

  const objA = findClassObject(classA, classes);
  const objB = findClassObject(classB, classes);

  if (objA && objB && objA.id === objB.id) return true;
  if (objA && (objA.id === classB || normalizeClassKey(objA.id) === keyB || normalizeClassKey(objA.name) === keyB || normalizeClassKey(`${objA.name}${objA.section}`) === keyB)) return true;
  if (objB && (objB.id === classA || normalizeClassKey(objB.id) === keyA || normalizeClassKey(objB.name) === keyA || normalizeClassKey(`${objB.name}${objB.section}`) === keyA)) return true;

  return false;
};

export const resolveCanonicalClassId = (rawIdentifier, classes = []) => {
  if (!rawIdentifier) return '';
  const obj = findClassObject(rawIdentifier, classes);
  return obj ? obj.id : String(rawIdentifier);
};

export const resolveCanonicalClassName = (rawIdentifier, classes = []) => {
  if (!rawIdentifier) return '';
  const obj = findClassObject(rawIdentifier, classes);
  if (obj) {
    return `${obj.name}${obj.section ? ' - ' + obj.section : ''}`;
  }
  return String(rawIdentifier);
};
