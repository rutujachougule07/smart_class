import React, { useState } from 'react';
import { verifyAdminLogin } from '../services/adminAuthService';

export default function AdminLogin({ onLoginSuccess, schoolProfile, onBackToLanding }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const schoolName = schoolProfile?.schoolName || 'SmartClass Management System';
  const schoolId = schoolProfile?.schoolId || 'ADMIN-PORTAL';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!identifier.trim()) {
      setErrorMsg('Please enter your admin username or email.');
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await verifyAdminLogin(identifier, password, rememberMe);
      if (res.success) {
        if (onLoginSuccess) {
          onLoginSuccess(res.user);
        }
      } else {
        setErrorMsg(res.message || 'Invalid credentials. Please try again.');
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred during login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        backgroundImage: 'radial-gradient(at 0% 0%, rgba(37, 99, 235, 0.08) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(124, 58, 237, 0.08) 0px, transparent 50%)',
        padding: '20px',
        boxSizing: 'border-box',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(15, 23, 42, 0.03)',
          overflow: 'hidden',
          animation: 'fadeIn 0.3s ease-out'
        }}
      >
        {/* Top Header & Branding */}
        <div
          style={{
            padding: onBackToLanding ? '20px 32px 24px 32px' : '36px 32px 24px 32px',
            textAlign: 'center',
            borderBottom: '1px solid #f1f5f9',
            position: 'relative'
          }}
        >
          {onBackToLanding && (
            <div style={{ textAlign: 'left', marginBottom: '14px' }}>
              <button
                type="button"
                onClick={onBackToLanding}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#64748b',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#1e293b';
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#64748b';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <i className="fa-solid fa-arrow-left" style={{ fontSize: '12px' }}></i>
                <span>Back to Campus Portal</span>
              </button>
            </div>
          )}
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              marginBottom: '16px',
              boxShadow: '0 10px 20px -5px rgba(37, 99, 235, 0.35)'
            }}
          >
            <i className="fa-solid fa-shield-halved"></i>
          </div>

          <h2
            style={{
              margin: '0 0 6px 0',
              fontSize: '21px',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em'
            }}
          >
            {schoolName}
          </h2>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '11.5px',
              fontWeight: 700,
              border: '1px solid #dbeafe',
              marginTop: '4px'
            }}
          >
            <i className="fa-solid fa-lock" style={{ fontSize: '10px' }}></i>
            <span>Administrator Portal • {schoolId}</span>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ padding: '28px 32px 32px 32px' }}>
          {errorMsg && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                padding: '11px 14px',
                borderRadius: '12px',
                fontSize: '12.5px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                marginBottom: '20px'
              }}
            >
              <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '14px', flexShrink: 0 }}></i>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Username / Email Field */}
          <div style={{ marginBottom: '18px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#334155',
                marginBottom: '7px'
              }}
            >
              Username or Email
            </label>
            <div style={{ position: 'relative' }}>
              <i
                className="fa-solid fa-user"
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  fontSize: '13px'
                }}
              ></i>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter username (e.g. admin)"
                autoComplete="username"
                style={{
                  width: '100%',
                  padding: '11px 14px 11px 40px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#2563eb';
                  e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#cbd5e1';
                  e.target.style.boxShadow = 'none';
                }}
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: '#334155',
                  margin: 0
                }}
              >
                Password
              </label>
            </div>
            <div style={{ position: 'relative' }}>
              <i
                className="fa-solid fa-lock"
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  fontSize: '13px'
                }}
              ></i>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                autoComplete="current-password"
                style={{
                  width: '100%',
                  padding: '11px 42px 11px 40px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#2563eb';
                  e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#cbd5e1';
                  e.target.style.boxShadow = 'none';
                }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                  fontSize: '13px'
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '22px'
            }}
          >
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12.5px',
                color: '#475569',
                cursor: 'pointer',
                userSelect: 'none',
                fontWeight: 500
              }}
            >
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#2563eb' }}
              />
              <span>Remember me on this browser</span>
            </label>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px 20px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
              transition: 'all 0.2s ease',
              opacity: isLoading ? 0.75 : 1
            }}
            onMouseEnter={(e) => {
              if (!isLoading) e.currentTarget.style.backgroundColor = '#1d4ed8';
            }}
            onMouseLeave={(e) => {
              if (!isLoading) e.currentTarget.style.backgroundColor = '#2563eb';
            }}
          >
            {isLoading ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-right-to-bracket"></i>
                <span>Log In to Admin Panel</span>
              </>
            )}
          </button>


        </form>

        {/* Footer info */}
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #f1f5f9',
            textAlign: 'center',
            fontSize: '11.5px',
            color: '#94a3b8'
          }}
        >
          <i className="fa-solid fa-shield" style={{ marginRight: '5px' }}></i>
          Secured with Firebase Firestore Encryption
        </div>
      </div>
    </div>
  );
}
