import { db } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const SETTINGS_COLLECTION = 'system_settings';
const CREDENTIALS_DOC_ID = 'admin_credentials';
const SESSION_STORAGE_KEY = 'smartclass_admin_auth_session';

export const DEFAULT_ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123',
  email: 'admin@smartclass.com',
  adminName: 'School Administrator',
  role: 'super_admin'
};

/**
 * Fetch Admin Credentials from Firestore (or initialize with defaults if not present)
 */
export async function getAdminCredentials() {
  try {
    if (db) {
      const docRef = doc(db, SETTINGS_COLLECTION, CREDENTIALS_DOC_ID);
      const snapshot = await getDoc(docRef);

      if (snapshot.exists()) {
        const data = snapshot.data();
        return {
          username: data.username || DEFAULT_ADMIN_CREDENTIALS.username,
          password: data.password || DEFAULT_ADMIN_CREDENTIALS.password,
          email: data.email || DEFAULT_ADMIN_CREDENTIALS.email,
          adminName: data.adminName || DEFAULT_ADMIN_CREDENTIALS.adminName,
          role: data.role || DEFAULT_ADMIN_CREDENTIALS.role,
          updatedAt: data.updatedAt || null
        };
      } else {
        // Document does not exist yet -> Seed with default master admin credentials in Firebase
        const seedData = {
          ...DEFAULT_ADMIN_CREDENTIALS,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(docRef, seedData, { merge: true });
        return seedData;
      }
    }
  } catch (err) {
    console.warn('Firebase error fetching admin credentials, falling back to defaults:', err);
  }

  return { ...DEFAULT_ADMIN_CREDENTIALS };
}

/**
 * Real-time listener for Admin Credentials in Firestore
 */
export function subscribeAdminCredentials(callback) {
  if (!db) {
    if (callback) callback(DEFAULT_ADMIN_CREDENTIALS);
    return () => {};
  }

  try {
    const docRef = doc(db, SETTINGS_COLLECTION, CREDENTIALS_DOC_ID);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (callback) {
            callback({
              username: data.username || DEFAULT_ADMIN_CREDENTIALS.username,
              password: data.password || DEFAULT_ADMIN_CREDENTIALS.password,
              email: data.email || DEFAULT_ADMIN_CREDENTIALS.email,
              adminName: data.adminName || DEFAULT_ADMIN_CREDENTIALS.adminName,
              role: data.role || DEFAULT_ADMIN_CREDENTIALS.role
            });
          }
        } else {
          // Auto-seed if not found
          setDoc(docRef, { ...DEFAULT_ADMIN_CREDENTIALS, createdAt: new Date().toISOString() }, { merge: true });
          if (callback) callback(DEFAULT_ADMIN_CREDENTIALS);
        }
      },
      (err) => {
        console.warn('Real-time admin credentials listener warning:', err);
        if (callback) callback(DEFAULT_ADMIN_CREDENTIALS);
      }
    );
  } catch (err) {
    console.error('Failed to subscribe to admin credentials:', err);
    if (callback) callback(DEFAULT_ADMIN_CREDENTIALS);
    return () => {};
  }
}

/**
 * Verify Login Credentials against Firebase Firestore
 */
export async function verifyAdminLogin(identifier, password, rememberMe = true) {
  if (!identifier || !password) {
    return { success: false, message: 'Please enter both username/email and password.' };
  }

  const cleanId = String(identifier).trim().toLowerCase();
  const cleanPass = String(password).trim();

  try {
    const creds = await getAdminCredentials();

    const usernameMatch = creds.username && creds.username.trim().toLowerCase() === cleanId;
    const emailMatch = creds.email && creds.email.trim().toLowerCase() === cleanId;
    const passwordMatch = creds.password && creds.password.trim() === cleanPass;

    if ((usernameMatch || emailMatch) && passwordMatch) {
      const session = {
        username: creds.username,
        email: creds.email,
        adminName: creds.adminName || 'Administrator',
        role: creds.role || 'super_admin',
        loginTime: new Date().toISOString()
      };

      try {
        if (rememberMe) {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
        } else {
          sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      } catch (storageErr) {
        console.warn('Storage saving error:', storageErr);
      }

      return { success: true, user: session };
    }

    return {
      success: false,
      message: 'Invalid username/email or password. Please verify and try again.'
    };
  } catch (err) {
    console.error('Error during admin verification:', err);
    return {
      success: false,
      message: 'Authentication failed due to a network or database issue. Please try again.'
    };
  }
}

/**
 * Retrieve Active Admin Session from localStorage or sessionStorage
 */
export function getCurrentAdminSession() {
  try {
    const local = localStorage.getItem(SESSION_STORAGE_KEY);
    if (local) return JSON.parse(local);

    const session = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (session) return JSON.parse(session);
  } catch (e) {
    console.warn('Error reading admin session:', e);
  }
  return null;
}

/**
 * Log Out Admin
 */
export function adminLogout() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (e) {
    console.warn('Error removing admin session:', e);
  }
}

/**
 * Update Admin Credentials in Firebase Firestore
 */
export async function updateAdminCredentials({ username, password, email, adminName }) {
  if (!username || !password) {
    return { success: false, message: 'Username and password cannot be empty.' };
  }

  const updated = {
    username: username.trim(),
    password: password.trim(),
    email: (email || '').trim().toLowerCase(),
    adminName: (adminName || 'School Administrator').trim(),
    updatedAt: new Date().toISOString()
  };

  try {
    if (db) {
      const docRef = doc(db, SETTINGS_COLLECTION, CREDENTIALS_DOC_ID);
      await setDoc(docRef, updated, { merge: true });
    }

    // Update active session if exists
    const current = getCurrentAdminSession();
    if (current) {
      const newSession = {
        ...current,
        username: updated.username,
        email: updated.email,
        adminName: updated.adminName
      };
      if (localStorage.getItem(SESSION_STORAGE_KEY)) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
      }
      if (sessionStorage.getItem(SESSION_STORAGE_KEY)) {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
      }
    }

    return { success: true, message: 'Admin login credentials updated successfully in Firebase!' };
  } catch (err) {
    console.error('Failed to update admin credentials in Firestore:', err);
    return { success: false, message: 'Failed to save to Firebase: ' + err.message };
  }
}
