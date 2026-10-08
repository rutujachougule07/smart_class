import React, { useState, useEffect } from 'react';
import {
  WEBHOOK_CATEGORIES,
  subscribeWebhooksList,
  saveWebhookItem,
  deleteWebhookItem,
  toggleWebhookItemStatus,
  testWebhookPing
} from '../services/webhookService';

export default function WebhookSettingsModal({ isOpen, onClose }) {
  const [webhooks, setWebhooks] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Form State for Add/Edit Modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'daily',
    url: '',
    secretToken: '',
    isEnabled: true
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete Confirmation State
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Ping Testing State
  const [activeTestId, setActiveTestId] = useState(null);
  const [testResults, setTestResults] = useState({});

  // Toast Notification
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    const unsub = subscribeWebhooksList((list) => {
      setWebhooks(list || []);
      setIsLoading(false);
    });

    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter webhooks by category tab
  const filteredWebhooks = activeCategory === 'all'
    ? webhooks
    : webhooks.filter((w) => w.category === activeCategory);

  const openAddModal = (defaultCategory = 'daily') => {
    setEditingItem(null);
    setFormData({
      name: '',
      category: activeCategory !== 'all' ? activeCategory : defaultCategory,
      url: '',
      secretToken: '',
      isEnabled: true
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      category: item.category || 'daily',
      url: item.url || '',
      secretToken: item.secretToken || '',
      isEnabled: item.isEnabled !== false
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSaveWebhook = async (e) => {
    e.preventDefault();
    if (!formData.url || !formData.url.trim()) {
      setFormError('Webhook URL is required.');
      return;
    }

    if (!formData.name || !formData.name.trim()) {
      setFormError('Webhook Name is required.');
      return;
    }

    setIsSaving(true);
    setFormError('');

    try {
      const res = await saveWebhookItem({
        id: editingItem ? editingItem.id : null,
        ...formData,
        createdAt: editingItem?.createdAt
      });

      if (res.success) {
        showToast(editingItem ? 'Webhook updated successfully on Firebase!' : 'New Webhook saved successfully to Firebase!');
        setIsFormOpen(false);
      }
    } catch (err) {
      setFormError(err.message || 'Failed to save webhook.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteWebhookItem(id);
      showToast('Webhook deleted from Firebase!');
      setDeleteConfirmId(null);
    } catch (err) {
      alert('Failed to delete webhook: ' + err.message);
    }
  };

  const handleToggleStatus = async (item) => {
    try {
      const newStatus = !item.isEnabled;
      await toggleWebhookItemStatus(item.id, newStatus);
      showToast(`Webhook ${newStatus ? 'Activated' : 'Deactivated'}!`);
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const handleTestPing = async (item) => {
    if (!item.url || !item.url.trim()) {
      setTestResults(prev => ({
        ...prev,
        [item.id]: { success: false, message: 'Please specify a valid webhook URL first.' }
      }));
      return;
    }

    setActiveTestId(item.id);
    setTestResults(prev => ({
      ...prev,
      [item.id]: { loading: true }
    }));

    try {
      const res = await testWebhookPing(item.url, item.secretToken);
      setTestResults(prev => ({
        ...prev,
        [item.id]: {
          success: res.success,
          message: res.message
        }
      }));
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        [item.id]: {
          success: false,
          message: err.message || 'Ping connection failed.'
        }
      }));
    } finally {
      setActiveTestId(null);
    }
  };

  // Preset Helper Buttons
  const applyPresetUrl = (type) => {
    if (type === '1automations') {
      setFormData(prev => ({
        ...prev,
        name: prev.name || 'WhatsApp 1Automations Gateway',
        url: 'https://1automations.com/api/send?number=91XXXXXXXXXX&message=day,AttendanceDate,StudentName,ClassDivision,AttendanceStatus,AttendanceRemark,SchoolName'
      }));
    } else if (type === 'zapier') {
      setFormData(prev => ({
        ...prev,
        name: prev.name || 'Zapier Attendance Hook',
        url: 'https://hooks.zapier.com/hooks/catch/1234567/abcde'
      }));
    } else if (type === 'make') {
      setFormData(prev => ({
        ...prev,
        name: prev.name || 'Make.com Automation Webhook',
        url: 'https://hook.eu1.make.com/your_unique_webhook_id'
      }));
    }
  };

  const getCategoryMeta = (catId) => {
    return WEBHOOK_CATEGORIES.find((c) => c.id === catId) || WEBHOOK_CATEGORIES[0];
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1300 }}>
      <div
        className="modal-box"
        style={{
          maxWidth: '850px',
          width: '95vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          borderRadius: '20px',
          backgroundColor: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 28px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                color: '#60a5fa'
              }}
            >
              <i className="fa-solid fa-network-wired"></i>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 700, color: '#ffffff' }}>
                  Category-Wise Webhooks
                </h3>
                <span
                  style={{
                    backgroundColor: 'rgba(34, 197, 94, 0.2)',
                    color: '#4ade80',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '12px',
                    border: '1px solid rgba(74, 222, 128, 0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <i className="fa-solid fa-cloud"></i> Firebase Cloud Synced
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#94a3b8' }}>
                Manage, Edit, and Store automated webhooks per category on Firebase Firestore
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#ffffff',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px'
            }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Modal Main Content */}
        <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1, backgroundColor: '#f8fafc' }}>
          {/* Toast Notification */}
          {toastMsg && (
            <div
              style={{
                padding: '12px 18px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #86efac',
                color: '#15803d',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '18px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
              }}
            >
              <i className="fa-solid fa-circle-check"></i>
              <span>{toastMsg}</span>
            </div>
          )}

          {/* Action Header Row & Category Tabs */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  Filter Category:
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  ({webhooks.length} Total Webhook{webhooks.length === 1 ? '' : 's'})
                </span>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => openAddModal()}
                style={{
                  padding: '9px 18px',
                  fontSize: '13px',
                  fontWeight: 700,
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                }}
              >
                <i className="fa-solid fa-plus"></i>
                <span>Add Webhook</span>
              </button>
            </div>

            {/* Category Filter Pills */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                paddingBottom: '4px',
                scrollbarWidth: 'thin'
              }}
            >
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: activeCategory === 'all' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                  backgroundColor: activeCategory === 'all' ? '#2563eb' : '#ffffff',
                  color: activeCategory === 'all' ? '#ffffff' : '#475569',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                All Categories ({webhooks.length})
              </button>

              {WEBHOOK_CATEGORIES.map((cat) => {
                const count = webhooks.filter((w) => w.category === cat.id).length;
                const isActive = activeCategory === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: isActive ? `1.5px solid ${cat.color}` : '1px solid #cbd5e1',
                      backgroundColor: isActive ? cat.color : '#ffffff',
                      color: isActive ? '#ffffff' : '#475569',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <i className={`fa-solid ${cat.icon}`}></i>
                    <span>{cat.name}</span>
                    <span
                      style={{
                        backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                        color: isActive ? '#ffffff' : '#64748b',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontSize: '10.5px'
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Webhooks List View */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '50px 0', color: '#64748b' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '28px', color: '#2563eb', marginBottom: '12px' }}></i>
              <p style={{ fontWeight: 600 }}>Syncing webhooks from Firebase Firestore...</p>
            </div>
          ) : filteredWebhooks.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '44px 20px',
                borderRadius: '16px',
                backgroundColor: '#ffffff',
                border: '2px dashed #cbd5e1'
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  marginBottom: '14px'
                }}
              >
                <i className="fa-solid fa-network-wired"></i>
              </div>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                No webhooks configured for this category
              </h4>
              <p style={{ margin: '6px 0 16px', fontSize: '13px', color: '#64748b', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                Add your WhatsApp Gateway, Zapier, Make, or custom API endpoints to automate dispatches.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => openAddModal(activeCategory !== 'all' ? activeCategory : 'daily')}
                style={{ padding: '9px 20px', fontSize: '13px', fontWeight: 700 }}
              >
                <i className="fa-solid fa-plus" style={{ marginRight: '6px' }}></i>
                Add Webhook for {activeCategory === 'all' ? 'Daily Attendance' : getCategoryMeta(activeCategory).name}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {filteredWebhooks.map((item) => {
                const catMeta = getCategoryMeta(item.category);
                const result = testResults[item.id];
                const isTesting = activeTestId === item.id;

                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '18px 20px',
                      borderRadius: '14px',
                      border: item.isEnabled ? '1px solid #e2e8f0' : '1px solid #cbd5e1',
                      backgroundColor: item.isEnabled ? '#ffffff' : '#f8fafc',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                      transition: 'all 0.2s ease',
                      opacity: item.isEnabled ? 1 : 0.7
                    }}
                  >
                    {/* Top Info Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            backgroundColor: catMeta.bg,
                            color: catMeta.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '16px'
                          }}
                        >
                          <i className={`fa-solid ${catMeta.icon}`}></i>
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                              {item.name}
                            </h4>
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                backgroundColor: catMeta.bg,
                                color: catMeta.color,
                                border: `1px solid ${catMeta.color}30`
                              }}
                            >
                              {catMeta.name}
                            </span>
                          </div>
                          <span style={{ fontSize: '11.5px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                            Last updated: {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'Recently'}
                          </span>
                        </div>
                      </div>

                      {/* Active Toggle Switch & Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(item)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            border: item.isEnabled ? '1px solid #bbf7d0' : '1px solid #cbd5e1',
                            backgroundColor: item.isEnabled ? '#dcfce7' : '#f1f5f9',
                            color: item.isEnabled ? '#15803d' : '#64748b',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <i className={`fa-solid ${item.isEnabled ? 'fa-toggle-on' : 'fa-toggle-off'}`} style={{ fontSize: '14px' }}></i>
                          <span>{item.isEnabled ? 'Active' : 'Inactive'}</span>
                        </button>

                        {item.secretToken && (
                          <span
                            title="Bearer Token Protected"
                            style={{
                              fontSize: '11px',
                              backgroundColor: '#fef3c7',
                              color: '#b45309',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <i className="fa-solid fa-key"></i> Token
                          </span>
                        )}
                      </div>
                    </div>

                    {/* URL Display */}
                    <div
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        color: '#0f172a',
                        wordBreak: 'break-all',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        marginBottom: '12px'
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.url}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(item.url);
                          showToast('Webhook URL copied to clipboard!');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          fontSize: '12px',
                          padding: '2px 6px'
                        }}
                        title="Copy URL"
                      >
                        <i className="fa-regular fa-copy"></i>
                      </button>
                    </div>

                    {/* Card Actions Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleTestPing(item)}
                        disabled={isTesting || !item.url}
                        className="btn btn-secondary"
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {isTesting ? (
                          <>
                            <i className="fa-solid fa-spinner fa-spin"></i> Testing Ping...
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-bolt" style={{ color: '#eab308' }}></i> Test Ping
                          </>
                        )}
                      </button>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600 }}
                        >
                          <i className="fa-solid fa-pen" style={{ marginRight: '4px' }}></i> Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(item.id)}
                          className="btn btn-danger-outline"
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#dc2626',
                            borderColor: '#fca5a5'
                          }}
                        >
                          <i className="fa-solid fa-trash-can" style={{ marginRight: '4px' }}></i> Delete
                        </button>
                      </div>
                    </div>

                    {/* Ping Test Feedback */}
                    {result && (
                      <div
                        style={{
                          marginTop: '10px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          backgroundColor: result.success ? '#f0fdf4' : '#fef2f2',
                          border: `1px solid ${result.success ? '#86efac' : '#fca5a5'}`,
                          color: result.success ? '#15803d' : '#b91c1c'
                        }}
                      >
                        <i className={`fa-solid ${result.success ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
                        <span>{result.message}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            backgroundColor: '#ffffff'
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '9px 24px', fontWeight: 700 }}
          >
            Close Settings
          </button>
        </div>
      </div>

      {/* Add / Edit Webhook Form Modal Overlay */}
      {isFormOpen && (
        <div className="modal-overlay" style={{ zIndex: 1400 }}>
          <div
            className="modal-box"
            style={{
              maxWidth: '560px',
              width: '90vw',
              borderRadius: '16px',
              backgroundColor: '#ffffff',
              padding: '0',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div
              style={{
                padding: '16px 22px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#f8fafc'
              }}
            >
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                {editingItem ? 'Edit Webhook' : 'Add New Webhook'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSaveWebhook} style={{ padding: '20px 22px' }}>
              {formError && (
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fca5a5',
                    color: '#b91c1c',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    marginBottom: '14px',
                    fontWeight: 600
                  }}
                >
                  <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '6px' }}></i>
                  {formError}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Category Selection */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Webhook Category <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <select
                    className="form-control"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    style={{ fontSize: '13px', fontWeight: 600 }}
                  >
                    {WEBHOOK_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} — ({cat.description})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Webhook Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Webhook Title / Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Daily Attendance WhatsApp Gateway"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    style={{ fontSize: '13px' }}
                    required
                  />
                </div>

                {/* Target Webhook URL */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>
                      Target Webhook URL <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => applyPresetUrl('1automations')}
                        style={{
                          fontSize: '10.5px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: '#dcfce7',
                          color: '#15803d',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 700
                        }}
                      >
                        WhatsApp Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPresetUrl('zapier')}
                        style={{
                          fontSize: '10.5px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: '#ffedd5',
                          color: '#c2410c',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 700
                        }}
                      >
                        Zapier
                      </button>
                    </div>
                  </div>
                  <input
                    type="url"
                    className="form-control"
                    placeholder="https://1automations.com/... or https://hooks.zapier.com/..."
                    value={formData.url}
                    onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                    style={{ fontSize: '13px', fontFamily: 'monospace' }}
                    required
                  />
                </div>

                {/* Secret Authorization Token */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Authorization Secret Token (Bearer API Key - Optional)
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="e.g. sk_live_secret_token_key"
                    value={formData.secretToken}
                    onChange={(e) => setFormData(prev => ({ ...prev, secretToken: e.target.value }))}
                    style={{ fontSize: '13px' }}
                  />
                </div>

                {/* Enabled Status Switch */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                  <input
                    type="checkbox"
                    id="isEnabledCheck"
                    checked={formData.isEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, isEnabled: e.target.checked }))}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="isEnabledCheck" style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}>
                    Enable this webhook for immediate dispatches
                  </label>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsFormOpen(false)}
                  disabled={isSaving}
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving}
                  style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {isSaving ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i> Saving...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-floppy-disk"></i> Save Webhook to Firebase
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="modal-overlay" style={{ zIndex: 1500 }}>
          <div
            className="modal-box"
            style={{
              maxWidth: '420px',
              width: '90vw',
              borderRadius: '16px',
              backgroundColor: '#ffffff',
              padding: '22px',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                marginBottom: '12px'
              }}
            >
              <i className="fa-solid fa-trash-can"></i>
            </div>
            <h4 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
              Delete Webhook Configuration?
            </h4>
            <p style={{ margin: '8px 0 18px', fontSize: '13px', color: '#64748b' }}>
              Are you sure you want to delete this webhook from Firebase? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteConfirmId(null)}
                style={{ padding: '8px 18px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleDelete(deleteConfirmId)}
                style={{ padding: '8px 20px', backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 700 }}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
