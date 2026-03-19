import React, { useState, useEffect } from 'react';
import api from '../services/api';

const EMPTY_FORM = {
  store_identifier: '',
  shop_domain: '',
  brand_name: '',
  is_active: true,
};

function StoreManagement({ onBack, onStoresUpdated }) {
  const [stores, setStores]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);
  const [successMsg, setSuccessMsg]   = useState(null);

  const [showModal, setShowModal]         = useState(false);
  const [modalMode, setModalMode]         = useState('add');
  const [editingStore, setEditingStore]   = useState(null);
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [formErrors, setFormErrors]       = useState({});

  const [deleteTarget, setDeleteTarget]       = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [search, setSearch]             = useState('');
  const [filterActive, setFilterActive] = useState('all');

  useEffect(() => { loadStores(); }, []);

  const normalize = (s) => ({
    id:               s.id,
    brand_name:       s.brandName        || s.brand_name       || s.name       || '',
    store_identifier: s.storeIdentifier  || s.store_identifier || s.identifier || '',
    shop_domain:      s.shopDomain       || s.shop_domain      || s.domain     || '',
    is_active:
      s.isActive  !== undefined ? s.isActive  :
      s.is_active !== undefined ? s.is_active : true,
  });

  const loadStores = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.fetch('/api/stores/all').catch(() => api.fetch('/api/stores'));
      const raw  = Array.isArray(data) ? data : (data?.stores || data?.data || []);
      console.log('🏪 [Stores] loaded:', raw.length, 'records');
      setStores(raw.map(normalize));
    } catch (err) {
      console.error('Failed to load stores:', err);
      setError('Failed to load stores: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const filteredStores = stores.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      (s.brand_name        || '').toLowerCase().includes(q) ||
      (s.store_identifier  || '').toLowerCase().includes(q) ||
      (s.shop_domain       || '').toLowerCase().includes(q);
    const matchesActive =
      filterActive === 'all' ||
      (filterActive === 'active'   &&  s.is_active) ||
      (filterActive === 'inactive' && !s.is_active);
    return matchesSearch && matchesActive;
  });

  const openAddModal = () => {
    setModalMode('add');
    setEditingStore(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (store) => {
    setModalMode('edit');
    setEditingStore(store);
    setForm({
      store_identifier: store.store_identifier || '',
      shop_domain:      store.shop_domain      || '',
      brand_name:       store.brand_name       || '',
      is_active:        store.is_active !== false,
    });
    setFormErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingStore(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
  };

  const validate = () => {
    const errs = {};
    if (!form.store_identifier.trim()) errs.store_identifier = 'Store identifier is required';
    if (!form.shop_domain.trim())      errs.shop_domain      = 'Shop domain is required';
    if (!form.brand_name.trim())       errs.brand_name       = 'Brand name is required';
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        storeIdentifier: form.store_identifier.trim(),
        shopDomain:      form.shop_domain.trim(),
        brandName:       form.brand_name.trim(),
        isActive:        form.is_active,
      };
      if (modalMode === 'add') {
        await api.fetch('/api/stores', { method: 'POST', body: JSON.stringify(payload) });
        showSuccess(`Store "${payload.brandName}" added successfully`);
      } else {
        await api.fetch(`/api/stores/${editingStore.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showSuccess(`Store "${payload.brandName}" updated successfully`);
      }
      await loadStores();
      if (onStoresUpdated) onStoresUpdated();
      closeModal();
    } catch (err) {
      console.error('Failed to save store:', err);
      setError(err.message || 'Failed to save store');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal  = (store) => { setDeleteTarget(store); setShowDeleteModal(true); };
  const closeDeleteModal = ()      => { setDeleteTarget(null);  setShowDeleteModal(false); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setError(null);
    try {
      await api.fetch(`/api/stores/${deleteTarget.id}`, { method: 'DELETE' });
      // Remove from local state immediately — backend soft-deletes (is_active=false)
      // so reloading would show it as inactive. We want it gone from the UI.
      setStores((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      showSuccess(`Store "${deleteTarget.brand_name}" deleted`);
      if (onStoresUpdated) onStoresUpdated();
      closeDeleteModal();
    } catch (err) {
      console.error('Failed to delete store:', err);
      setError(err.message || 'Failed to delete store');
      closeDeleteModal();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (store) => {
    try {
      await api.fetch(`/api/stores/${store.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          storeIdentifier: store.store_identifier,
          shopDomain:      store.shop_domain,
          brandName:       store.brand_name,
          isActive:        !store.is_active,
        }),
      });
      showSuccess(store.is_active ? `"${store.brand_name}" deactivated` : `"${store.brand_name}" activated`);
      await loadStores();
      if (onStoresUpdated) onStoresUpdated();
    } catch (err) {
      console.error('Toggle active failed:', err);
      setError('Failed to update store status');
    }
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const totalStores    = stores.length;
  const activeStores   = stores.filter((s) => s.is_active !== false).length;
  const inactiveStores = totalStores - activeStores;

  return (
    <div className="store-management">
      <div className="store-management-inner">

        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <button className="btn-back" onClick={onBack} type="button">← Back</button>
            <div>
              <h2>🏪 Manage Stores</h2>
              <p className="page-subtitle">
                {totalStores} stores &nbsp;·&nbsp; {activeStores} active &nbsp;·&nbsp; {inactiveStores} inactive
              </p>
            </div>
          </div>
          <button className="btn-primary" onClick={openAddModal} type="button">+ Add Store</button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="alert alert-error">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} type="button">×</button>
          </div>
        )}
        {successMsg && (
          <div className="alert alert-success">
            <span>✅ {successMsg}</span>
          </div>
        )}

        {/* Filters */}
        <div className="store-filters">
          <input
            className="store-search"
            type="text"
            placeholder="🔍 Search by name, identifier, domain…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="filter-tabs">
            {['all', 'active', 'inactive'].map((f) => (
              <button
                key={f}
                className={`filter-tab ${filterActive === f ? 'active' : ''}`}
                onClick={() => setFilterActive(f)}
                type="button"
              >
                {f === 'all'      ? `All (${totalStores})`       :
                 f === 'active'   ? `Active (${activeStores})`   :
                                    `Inactive (${inactiveStores})`}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading stores…</p>
          </div>
        ) : filteredStores.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏪</div>
            <h3>{search || filterActive !== 'all' ? 'No stores match your search' : 'No stores yet'}</h3>
            {!search && filterActive === 'all' && <p>Add your first store to get started.</p>}
            {(search || filterActive !== 'all') && (
              <button
                className="btn-secondary"
                onClick={() => { setSearch(''); setFilterActive('all'); }}
                type="button"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="store-table-wrapper">
            <table className="store-table">
              <thead>
                <tr>
                  <th>Brand Name</th>
                  <th>Identifier</th>
                  <th>Shop Domain</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStores.map((store) => (
                  <tr key={store.id} className={!store.is_active ? 'row-inactive' : ''}>
                    <td><span className="store-brand-name">{store.brand_name || '—'}</span></td>
                    <td><code className="store-identifier">{store.store_identifier}</code></td>
                    <td className="store-domain">{store.shop_domain || '—'}</td>
                    <td>
                      <button
                        className={`status-toggle ${store.is_active !== false ? 'status-active' : 'status-inactive'}`}
                        onClick={() => handleToggleActive(store)}
                        type="button"
                        title={store.is_active !== false ? 'Click to deactivate' : 'Click to activate'}
                      >
                        {store.is_active !== false ? '● Active' : '○ Inactive'}
                      </button>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn-row-edit"   onClick={() => openEditModal(store)}   type="button" title="Edit">✏️</button>
                        <button className="btn-row-delete" onClick={() => openDeleteModal(store)} type="button" title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add / Edit Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content store-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{modalMode === 'add' ? '➕ Add Store' : '✏️ Edit Store'}</h3>
                <button className="modal-close" onClick={closeModal} type="button">×</button>
              </div>
              <div className="modal-body">
                <div className="form-grid">
                  <div className={`form-group ${formErrors.brand_name ? 'has-error' : ''}`}>
                    <label>Brand Name *</label>
                    <input
                      type="text"
                      placeholder="Mount Pearl Peptides"
                      value={form.brand_name}
                      onChange={(e) => handleFormChange('brand_name', e.target.value)}
                    />
                    {formErrors.brand_name && <span className="field-error">{formErrors.brand_name}</span>}
                  </div>

                  <div className={`form-group ${formErrors.store_identifier ? 'has-error' : ''}`}>
                    <label>Store Identifier *</label>
                    <input
                      type="text"
                      placeholder="0nrr62-s0"
                      value={form.store_identifier}
                      onChange={(e) => handleFormChange('store_identifier', e.target.value)}
                      disabled={modalMode === 'edit'}
                    />
                    {modalMode === 'edit' && <span className="field-hint">Cannot be changed after creation</span>}
                    {formErrors.store_identifier && <span className="field-error">{formErrors.store_identifier}</span>}
                  </div>

                  <div className={`form-group form-group-full ${formErrors.shop_domain ? 'has-error' : ''}`}>
                    <label>Shopify Domain *</label>
                    <input
                      type="text"
                      placeholder="0nrr62-s0.myshopify.com"
                      value={form.shop_domain}
                      onChange={(e) => handleFormChange('shop_domain', e.target.value)}
                    />
                    {formErrors.shop_domain && <span className="field-error">{formErrors.shop_domain}</span>}
                  </div>

                  <div className="form-group form-group-full">
                    <label>Status</label>
                    <div className="status-row">
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={form.is_active}
                          onChange={(e) => handleFormChange('is_active', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                      <span className={form.is_active ? 'status-text active' : 'status-text inactive'}>
                        {form.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-cancel"  onClick={closeModal} type="button" disabled={saving}>Cancel</button>
                <button className="btn-primary" onClick={handleSave} type="button" disabled={saving}>
                  {saving ? 'Saving…' : modalMode === 'add' ? 'Add Store' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm Modal */}
        {showDeleteModal && deleteTarget && (
          <div className="modal-overlay" onClick={closeDeleteModal}>
            <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>🗑️ Delete Store</h3>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete <strong>{deleteTarget.brand_name}</strong>?</p>
                <p className="delete-warning">⚠️ This will remove the store and may affect associated conversations.</p>
              </div>
              <div className="modal-footer">
                <button className="btn-cancel" onClick={closeDeleteModal} type="button" disabled={saving}>Cancel</button>
                <button className="btn-logout" onClick={handleDelete}     type="button" disabled={saving}>
                  {saving ? 'Deleting…' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      <style>{`
        .store-management {
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          box-sizing: border-box;
          background: var(--bg-color, #f0f2f5);
          /* scroll container — parent must have a fixed height */
        }
        .store-management-inner {
          max-width: 1400px;
          width: 100%;
          margin: 0 auto;
          padding: 28px 32px 60px;
          box-sizing: border-box;
        }
        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 22px;
          gap: 16px;
        }
        .page-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .page-header-left h2 { margin: 0 0 3px 0; font-size: 20px; font-weight: 700; color: var(--text-primary, #111); }
        .page-subtitle { margin: 0; font-size: 13px; color: var(--text-secondary, #888); }
        .btn-back {
          background: none;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 13px;
          cursor: pointer;
          color: var(--text-secondary, #555);
          white-space: nowrap;
        }
        .btn-back:hover { background: var(--hover-bg, #f1f5f9); }
        .btn-primary {
          background: var(--primary-color, #25d366);
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 9px 18px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .btn-primary:hover    { filter: brightness(1.08); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-secondary {
          background: none;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 14px;
          cursor: pointer;
          color: var(--text-primary, #333);
        }
        .btn-secondary:hover { background: var(--hover-bg, #f1f5f9); }
        .alert {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 16px;
          gap: 8px;
        }
        .alert button  { background: none; border: none; cursor: pointer; font-size: 16px; }
        .alert-error   { background: #fef2f2; color: #c0392b; border: 1px solid #fecaca; }
        .alert-success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
        .store-filters {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        .store-search {
          flex: 1;
          min-width: 200px;
          padding: 8px 12px;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 8px;
          font-size: 14px;
          background: var(--input-bg, #fff);
          color: var(--text-primary, #333);
        }
        .store-search:focus { outline: none; border-color: var(--primary-color, #25d366); }
        .filter-tabs {
          display: flex;
          gap: 4px;
          background: var(--surface-bg, #e8ecf0);
          border-radius: 8px;
          padding: 3px;
        }
        .filter-tab {
          background: none;
          border: none;
          border-radius: 6px;
          padding: 5px 13px;
          font-size: 13px;
          cursor: pointer;
          color: var(--text-secondary, #888);
        }
        .filter-tab.active {
          background: #fff;
          color: var(--text-primary, #333);
          font-weight: 600;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .store-table-wrapper {
          background: var(--card-bg, #fff);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 12px;
          overflow: hidden;
          overflow-x: auto;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }
        .store-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .store-table thead { background: var(--surface-bg, #f8fafc); }
        .store-table th {
          text-align: left;
          padding: 11px 16px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-secondary, #999);
          border-bottom: 1px solid var(--border-color, #e8ecf0);
          white-space: nowrap;
        }
        .store-table td {
          padding: 13px 16px;
          border-bottom: 1px solid var(--border-color, #f0f4f8);
          color: var(--text-primary, #333);
          vertical-align: middle;
        }
        .store-table tr:last-child td  { border-bottom: none; }
        .store-table tbody tr:hover td { background: var(--hover-bg, #f8fafc); }
        .row-inactive td { opacity: 0.5; }
        .store-brand-name { font-weight: 600; color: var(--text-primary, #111); }
        .store-identifier {
          background: var(--surface-bg, #f1f5f9);
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 12px;
          font-family: monospace;
          color: var(--text-secondary, #555);
        }
        .store-domain { font-size: 13px; color: var(--text-secondary, #666); }
        .status-toggle {
          border: none;
          border-radius: 20px;
          padding: 3px 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .status-active   { background: #dcfce7; color: #166534; }
        .status-inactive { background: #f1f5f9; color: #888; }
        .row-actions { display: flex; gap: 4px; }
        .btn-row-edit, .btn-row-delete {
          background: none;
          border: 1px solid transparent;
          border-radius: 6px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 15px;
          line-height: 1;
        }
        .btn-row-edit:hover   { background: #eff6ff; border-color: #bfdbfe; }
        .btn-row-delete:hover { background: #fef2f2; border-color: #fecaca; }
        .loading-state, .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: var(--text-secondary, #888);
          background: var(--card-bg, #fff);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 12px;
        }
        .loading-state .spinner {
          width: 36px; height: 36px;
          border: 3px solid var(--border-color, #e2e8f0);
          border-top-color: var(--primary-color, #25d366);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 12px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .empty-icon    { font-size: 48px; margin-bottom: 12px; }
        .empty-state h3 { margin: 0 0 6px; color: var(--text-primary, #333); }
        .empty-state p  { margin: 0 0 16px; }
        .store-modal { width: 560px; max-width: 95vw; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        @media (max-width: 520px) { .form-grid { grid-template-columns: 1fr; } }
        .form-group { display: flex; flex-direction: column; gap: 5px; }
        .form-group label { font-size: 13px; font-weight: 600; color: var(--text-primary, #333); }
        .form-group input[type="text"] {
          padding: 8px 10px;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 7px;
          font-size: 14px;
          background: var(--input-bg, #fff);
          color: var(--text-primary, #333);
        }
        .form-group input:focus    { outline: none; border-color: var(--primary-color, #25d366); }
        .form-group input:disabled { background: var(--surface-bg, #f8fafc); color: var(--text-secondary, #999); cursor: not-allowed; }
        .has-error input  { border-color: #f87171 !important; }
        .field-error { font-size: 12px; color: #ef4444; }
        .field-hint  { font-size: 12px; color: var(--text-secondary, #888); }
        .form-group-full   { grid-column: 1 / -1; }
        .status-row { display: flex; align-items: center; gap: 12px; }
        .toggle-switch { display: inline-flex; cursor: pointer; user-select: none; flex-shrink: 0; }
        .toggle-switch input { display: none; }
        .toggle-slider {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
          background: #cbd5e1;
          border-radius: 12px;
          transition: background 0.2s;
        }
        .toggle-slider::after {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          width: 18px;
          height: 18px;
          background: #fff;
          border-radius: 50%;
          transition: transform 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.25);
        }
        .toggle-switch input:checked + .toggle-slider { background: var(--primary-color, #25d366); }
        .toggle-switch input:checked + .toggle-slider::after { transform: translateX(20px); }
        .status-text { font-size: 14px; font-weight: 600; white-space: nowrap; }
        .status-text.active { color: #166534; }
        .status-text.inactive { color: #888; }
        .delete-modal { max-width: 400px; }
        .delete-warning {
          color: #b45309;
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 6px;
          padding: 8px 10px;
          font-size: 13px;
          margin-top: 8px;
        }
        .modal-close {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: var(--text-secondary, #888);
          line-height: 1;
          padding: 0 4px;
        }
        .modal-close:hover { color: var(--text-primary, #333); }
      `}</style>
    </div>
  );
}

export default StoreManagement;