import React, { useState, useEffect } from 'react';
import { subscribeWebhooksList, WEBHOOK_CATEGORIES } from '../services/webhookService';
import {
  subscribeAdminCredentials,
  updateAdminCredentials
} from '../services/adminAuthService';

export default function SettingsTab({ schoolProfile, updateSchoolProfile, clearAllData, openWebhookSettings }) {
  const [profile, setProfile] = useState({
    schoolName: schoolProfile.schoolName || '',
    adminName: schoolProfile.adminName || '',
    schoolId: schoolProfile.schoolId || ''
  });

  const [savedMsg, setSavedMsg] = useState(false);
  const [webhooksList, setWebhooksList] = useState([]);

  // Admin Credentials State
  const [adminCreds, setAdminCreds] = useState({
    username: 'admin',
    password: 'admin123',
    email: 'admin@smartclass.com',
    adminName: 'School Administrator'
  });
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [isSavingCreds, setIsSavingCreds] = useState(false);
  const [credsSuccessMsg, setCredsSuccessMsg] = useState('');
  const [credsErrorMsg, setCredsErrorMsg] = useState('');

  useEffect(() => {
    const unsub = subscribeWebhooksList((list) => {
      setWebhooksList(list || []);
    });
    const unsubCreds = subscribeAdminCredentials((creds) => {
      if (creds) {
        setAdminCreds({
          username: creds.username || 'admin',
          password: creds.password || 'admin123',
          email: creds.email || 'admin@smartclass.com',
          adminName: creds.adminName || 'School Administrator'
        });
      }
    });
    return () => {
      unsub();
      unsubCreds();
    };
  }, []);

  const handleSaveCredentials = async (e) => {
    e.preventDefault();
    setIsSavingCreds(true);
    setCredsSuccessMsg('');
    setCredsErrorMsg('');
    try {
      const res = await updateAdminCredentials(adminCreds);
      if (res.success) {
        setCredsSuccessMsg(res.message || 'Admin login credentials updated successfully in Firebase!');
        setTimeout(() => setCredsSuccessMsg(''), 4000);
      } else {
        setCredsErrorMsg(res.message || 'Failed to update credentials.');
      }
    } catch (err) {
      setCredsErrorMsg('Error saving credentials: ' + err.message);
    } finally {
      setIsSavingCreds(false);
    }
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    updateSchoolProfile(profile);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  const totalActiveWebhooks = webhooksList.filter(w => w.isEnabled !== false).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Save Success Toast */}
      {savedMsg && (
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          color: '#166534',
          padding: '12px 16px',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <i className="fa-solid fa-circle-check" style={{ color: '#16a34a' }}></i>
          <span>Settings updated successfully!</span>
        </div>
      )}

      {/* School Profile Settings */}
      <div className="data-card">
        <div className="section-title" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-school" style={{ color: 'var(--primary)' }}></i>
            <span>School Profile Settings</span>
          </div>
        </div>

        <form onSubmit={handleSaveProfile}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div className="form-group">
              <label>School / Institution Name</label>
              <input
                type="text"
                className="form-control"
                value={profile.schoolName}
                onChange={(e) => setProfile({ ...profile, schoolName: e.target.value })}
                placeholder="Enter School Name"
                required
              />
            </div>

            <div className="form-group">
              <label>Administrator Name</label>
              <input
                type="text"
                className="form-control"
                value={profile.adminName}
                onChange={(e) => setProfile({ ...profile, adminName: e.target.value })}
                placeholder="Enter Admin Name"
                required
              />
            </div>

            <div className="form-group">
              <label>School ID / Code</label>
              <input
                type="text"
                className="form-control"
                value={profile.schoolId}
                onChange={(e) => setProfile({ ...profile, schoolId: e.target.value })}
                placeholder="e.g. SCH-2026-904"
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px' }}>
              <i className="fa-solid fa-floppy-disk" style={{ marginRight: '6px' }}></i> Save Profile Changes
            </button>
          </div>
        </form>
      </div>

      {/* Admin Login & Security Settings */}
      <div className="data-card" style={{ border: '1px solid #e2e8f0', borderRadius: '16px' }}>
        <div className="section-title" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px'
              }}
            >
              <i className="fa-solid fa-shield-halved"></i>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                Admin Portal Login & Security
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                Manage your master administrator login credentials stored securely in Firebase Firestore.
              </p>
            </div>
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: '#ecfdf5',
              color: '#15803d',
              padding: '3px 9px',
              borderRadius: '20px',
              border: '1px solid #bbf7d0',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <i className="fa-solid fa-cloud" style={{ fontSize: '10px' }}></i> Firebase Synced
          </span>
        </div>

        {credsSuccessMsg && (
          <div
            style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#166534',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '12.5px',
              fontWeight: 600,
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className="fa-solid fa-circle-check" style={{ color: '#16a34a' }}></i>
            <span>{credsSuccessMsg}</span>
          </div>
        )}

        {credsErrorMsg && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '12.5px',
              fontWeight: 600,
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className="fa-solid fa-circle-exclamation"></i>
            <span>{credsErrorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSaveCredentials}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="form-group">
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>
                Admin Username <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={adminCreds.username}
                onChange={(e) => setAdminCreds({ ...adminCreds, username: e.target.value })}
                placeholder="e.g. admin"
                required
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>
                Admin Password <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showAdminPass ? 'text' : 'password'}
                  className="form-control"
                  value={adminCreds.password}
                  onChange={(e) => setAdminCreds({ ...adminCreds, password: e.target.value })}
                  placeholder="Enter secure password"
                  style={{ paddingRight: '38px' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPass(!showAdminPass)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                  title={showAdminPass ? 'Hide password' : 'Show password'}
                >
                  <i className={`fa-solid ${showAdminPass ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>
                Administrator Display Name
              </label>
              <input
                type="text"
                className="form-control"
                value={adminCreds.adminName}
                onChange={(e) => setAdminCreds({ ...adminCreds, adminName: e.target.value })}
                placeholder="e.g. Principal Administrator"
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>
                Email Address (Optional)
              </label>
              <input
                type="email"
                className="form-control"
                value={adminCreds.email}
                onChange={(e) => setAdminCreds({ ...adminCreds, email: e.target.value })}
                placeholder="admin@smartclass.com"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
            <button
              type="submit"
              disabled={isSavingCreds}
              className="btn btn-primary"
              style={{
                padding: '9px 22px',
                fontSize: '13px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px'
              }}
            >
              {isSavingCreds ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>Saving to Firebase...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-lock"></i>
                  <span>Update Admin Credentials</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Centralized Category-Wise Webhooks Settings */}
      <div className="data-card" style={{ border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            paddingBottom: '14px',
            borderBottom: '1px solid #f1f5f9'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px'
              }}
            >
              <i className="fa-solid fa-network-wired"></i>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Category-Wise Webhook Integrations</span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: '#dcfce7',
                    color: '#15803d',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <i className="fa-solid fa-cloud" style={{ fontSize: '10px' }}></i> Firebase Synced
                </span>
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                Configure and manage automated API webhooks categorized for Daily Attendance, Monthly Attendance, and Exam Reports.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (openWebhookSettings) openWebhookSettings();
            }}
            style={{
              padding: '10px 20px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
            }}
          >
            <i className="fa-solid fa-gear"></i>
            <span>Manage Webhooks</span>
          </button>
        </div>

        {/* Category Breakdown Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginTop: '14px' }}>
          {WEBHOOK_CATEGORIES.map((cat) => {
            const count = webhooksList.filter((w) => w.category === cat.id && w.isEnabled !== false).length;
            const totalInCat = webhooksList.filter((w) => w.category === cat.id).length;

            return (
              <div
                key={cat.id}
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: cat.bg,
                      color: cat.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '15px'
                    }}
                  >
                    <i className={`fa-solid ${cat.icon}`}></i>
                  </div>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', display: 'block' }}>
                      {cat.name}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {count > 0 ? `${count} Active Webhook${count > 1 ? 's' : ''}` : 'No active webhook'}
                    </span>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '8px',
                    backgroundColor: count > 0 ? '#dcfce7' : '#f1f5f9',
                    color: count > 0 ? '#15803d' : '#94a3b8'
                  }}
                >
                  {count > 0 ? 'Active' : 'Unset'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Quick Footer Callout */}
        <div
          style={{
            marginTop: '16px',
            padding: '12px 14px',
            borderRadius: '10px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12.5px',
            color: '#475569'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-database" style={{ color: '#2563eb' }}></i>
            <span>
              Total Webhooks Stored on Firebase: <strong>{webhooksList.length}</strong> ({totalActiveWebhooks} Active)
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (openWebhookSettings) openWebhookSettings();
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>Add / Edit / Delete Webhooks</span>
            <i className="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
}

