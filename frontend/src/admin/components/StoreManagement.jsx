

// import React, { useState, useEffect, useRef } from 'react';
// import api from '../services/api';

// const EMPTY_FORM = {
//   store_identifier: '',
//   shop_domain: '',
//   brand_name: '',
//   is_active: true,
//   store_group: '',
//   store_group_name: '',
// };

// const PRESET_COLORS = ['#667eea', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

// const EMPTY_GROUP_FORM = {
//   group_name: '',
//   group_key: '',
//   color: PRESET_COLORS[0],
// };

// const slugify = (str) =>
//   (str || '')
//     .toLowerCase()
//     .trim()
//     .replace(/[^a-z0-9]+/g, '-')
//     .replace(/^-+|-+$/g, '');

// function StoreManagement({ onBack, onStoresUpdated }) {
//   const [stores, setStores]           = useState([]);
//   const [loading, setLoading]         = useState(true);
//   const [saving, setSaving]           = useState(false);
//   const [error, setError]             = useState(null);
//   const [successMsg, setSuccessMsg]   = useState(null);

//   const [groups, setGroups]           = useState([]);
//   const [loadingGroups, setLoadingGroups] = useState(true);
//   const [groupMode, setGroupMode]     = useState('select'); // 'select' | 'new'
//   const slugEditedRef                 = useRef(false); // tracks manual edits to the slug field in "new group" mode

//   const [showModal, setShowModal]         = useState(false);
//   const [modalMode, setModalMode]         = useState('add');
//   const [editingStore, setEditingStore]   = useState(null);
//   const [form, setForm]                   = useState(EMPTY_FORM);
//   const [formErrors, setFormErrors]       = useState({});

//   const [deleteTarget, setDeleteTarget]       = useState(null);
//   const [showDeleteModal, setShowDeleteModal] = useState(false);

//   // ── Group management modal ─────────────────────────────────────────────
//   const [showGroupModal, setShowGroupModal]   = useState(false);
//   const [groupForm, setGroupForm]             = useState(EMPTY_GROUP_FORM);
//   const [groupFormErrors, setGroupFormErrors] = useState({});
//   const [savingGroup, setSavingGroup]         = useState(false);
//   const groupSlugEditedRef                    = useRef(false);

//   const [search, setSearch]             = useState('');
//   const [filterActive, setFilterActive] = useState('all');

//   useEffect(() => { loadStores(); loadGroups(); }, []);

//   const normalize = (s) => ({
//     id:               s.id,
//     brand_name:       s.brandName        || s.brand_name       || s.name       || '',
//     store_identifier: s.storeIdentifier  || s.store_identifier || s.identifier || '',
//     shop_domain:      s.shopDomain       || s.shop_domain      || s.domain     || '',
//     is_active:
//       s.isActive  !== undefined ? s.isActive  :
//       s.is_active !== undefined ? s.is_active : true,
//     store_group:      s.storeGroup      || s.store_group      || '',
//     store_group_name: s.storeGroupName  || s.store_group_name || '',
//   });

//   const loadStores = async () => {
//     try {
//       setLoading(true);
//       setError(null);
//       const data = await api.fetch('/api/stores/all').catch(() => api.fetch('/api/stores'));
//       const raw  = Array.isArray(data) ? data : (data?.stores || data?.data || []);
//       console.log('🏪 [Stores] loaded:', raw.length, 'records');
//       setStores(raw.map(normalize));
//     } catch (err) {
//       console.error('Failed to load stores:', err);
//       setError('Failed to load stores: ' + err.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const loadGroups = async () => {
//     try {
//       setLoadingGroups(true);
//       const data = await api.getStoreGroups();
//       setGroups(Array.isArray(data) ? data : []);
//     } catch (err) {
//       console.error('Failed to load store groups:', err);
//       setGroups([]);
//     } finally {
//       setLoadingGroups(false);
//     }
//   };

//   const groupColorMap = React.useMemo(
//     () => Object.fromEntries(groups.map(g => [g.storeGroup, g.color])),
//     [groups]
//   );

//   const showSuccess = (msg) => {
//     setSuccessMsg(msg);
//     setTimeout(() => setSuccessMsg(null), 3500);
//   };

//   const filteredStores = stores.filter((s) => {
//     const q = search.toLowerCase();
//     const matchesSearch =
//       !q ||
//       (s.brand_name        || '').toLowerCase().includes(q) ||
//       (s.store_identifier  || '').toLowerCase().includes(q) ||
//       (s.shop_domain       || '').toLowerCase().includes(q) ||
//       (s.store_group_name  || '').toLowerCase().includes(q) ||
//       (s.store_group       || '').toLowerCase().includes(q);
//     const matchesActive =
//       filterActive === 'all' ||
//       (filterActive === 'active'   &&  s.is_active) ||
//       (filterActive === 'inactive' && !s.is_active);
//     return matchesSearch && matchesActive;
//   });

//   const openAddModal = () => {
//     setModalMode('add');
//     setEditingStore(null);
//     setForm(EMPTY_FORM);
//     setFormErrors({});
//     slugEditedRef.current = false;
//     setGroupMode(groups.length > 0 ? 'select' : 'new');
//     setShowModal(true);
//   };

//   const openEditModal = (store) => {
//     setModalMode('edit');
//     setEditingStore(store);
//     setForm({
//       store_identifier: store.store_identifier || '',
//       shop_domain:      store.shop_domain      || '',
//       brand_name:       store.brand_name       || '',
//       is_active:        store.is_active !== false,
//       store_group:      store.store_group      || '',
//       store_group_name: store.store_group_name || '',
//     });
//     setFormErrors({});
//     slugEditedRef.current = true; // don't auto-overwrite an existing store's slug while editing
//     // If this store's current group isn't in the known groups list (e.g. ungrouped,
//     // or a group that only exists on inactive stores), fall back to "new" mode so
//     // the value is still visible/editable rather than silently hidden.
//     const knownSlugs = groups.map(g => g.storeGroup);
//     setGroupMode(store.store_group && knownSlugs.includes(store.store_group) ? 'select' : 'new');
//     setShowModal(true);
//   };

//   const closeModal = () => {
//     setShowModal(false);
//     setEditingStore(null);
//     setForm(EMPTY_FORM);
//     setFormErrors({});
//     slugEditedRef.current = false;
//   };

//   const validate = () => {
//     const errs = {};
//     if (!form.store_identifier.trim()) errs.store_identifier = 'Store identifier is required';
//     if (!form.shop_domain.trim())      errs.shop_domain      = 'Shop domain is required';
//     if (!form.brand_name.trim())       errs.brand_name       = 'Brand name is required';
//     if (!form.store_group.trim())      errs.store_group       = 'A store group is required';
//     return errs;
//   };

//   const handleGroupSelectChange = (value) => {
//     if (value === '__new__') {
//       setGroupMode('new');
//       slugEditedRef.current = false;
//       handleFormChange('store_group', '');
//       handleFormChange('store_group_name', '');
//       return;
//     }
//     setGroupMode('select');
//     const match = groups.find(g => g.storeGroup === value);
//     handleFormChange('store_group', value);
//     handleFormChange('store_group_name', match?.storeGroupName || '');
//   };

//   const handleNewGroupNameChange = (value) => {
//     handleFormChange('store_group_name', value);
//     if (!slugEditedRef.current) {
//       handleFormChange('store_group', slugify(value));
//     }
//   };

//   const handleNewGroupSlugChange = (value) => {
//     slugEditedRef.current = true;
//     handleFormChange('store_group', slugify(value));
//   };

//   const handleSave = async () => {
//     const errs = validate();
//     if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }
//     setSaving(true);
//     setError(null);
//     try {
//       const payload = {
//         storeIdentifier: form.store_identifier.trim(),
//         shopDomain:      form.shop_domain.trim(),
//         brandName:       form.brand_name.trim(),
//         isActive:        form.is_active,
//         storeGroup:      form.store_group.trim(),
//         storeGroupName:  form.store_group_name.trim() || null,
//       };
//       if (modalMode === 'add') {
//         await api.fetch('/api/stores', { method: 'POST', body: JSON.stringify(payload) });
//         showSuccess(`Store "${payload.brandName}" added successfully`);
//       } else {
//         await api.fetch(`/api/stores/${editingStore.id}`, { method: 'PUT', body: JSON.stringify(payload) });
//         showSuccess(`Store "${payload.brandName}" updated successfully`);
//       }
//       await loadStores();
//       await loadGroups();
//       if (onStoresUpdated) onStoresUpdated();
//       closeModal();
//     } catch (err) {
//       console.error('Failed to save store:', err);
//       setError(err.message || 'Failed to save store');
//     } finally {
//       setSaving(false);
//     }
//   };

//   const openDeleteModal  = (store) => { setDeleteTarget(store); setShowDeleteModal(true); };
//   const closeDeleteModal = ()      => { setDeleteTarget(null);  setShowDeleteModal(false); };

//   const handleDelete = async () => {
//     if (!deleteTarget) return;
//     setSaving(true);
//     setError(null);
//     try {
//       await api.fetch(`/api/stores/${deleteTarget.id}`, { method: 'DELETE' });
//       // Remove from local state immediately — backend soft-deletes (is_active=false)
//       // so reloading would show it as inactive. We want it gone from the UI.
//       setStores((prev) => prev.filter((s) => s.id !== deleteTarget.id));
//       showSuccess(`Store "${deleteTarget.brand_name}" deleted`);
//       if (onStoresUpdated) onStoresUpdated();
//       closeDeleteModal();
//     } catch (err) {
//       console.error('Failed to delete store:', err);
//       setError(err.message || 'Failed to delete store');
//       closeDeleteModal();
//     } finally {
//       setSaving(false);
//     }
//   };

//   const handleToggleActive = async (store) => {
//     try {
//       await api.fetch(`/api/stores/${store.id}`, {
//         method: 'PUT',
//         body: JSON.stringify({
//           storeIdentifier: store.store_identifier,
//           shopDomain:      store.shop_domain,
//           brandName:       store.brand_name,
//           isActive:        !store.is_active,
//           // PUT overwrites the whole row (no COALESCE) — these MUST be re-sent
//           // here or the store's group gets silently nulled out on every toggle.
//           storeGroup:      store.store_group || null,
//           storeGroupName:  store.store_group_name || null,
//         }),
//       });
//       showSuccess(store.is_active ? `"${store.brand_name}" deactivated` : `"${store.brand_name}" activated`);
//       await loadStores();
//       if (onStoresUpdated) onStoresUpdated();
//     } catch (err) {
//       console.error('Toggle active failed:', err);
//       setError('Failed to update store status');
//     }
//   };

//   const handleFormChange = (field, value) => {
//     setForm((prev) => ({ ...prev, [field]: value }));
//     if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: undefined }));
//   };

//   // ── Group management ──────────────────────────────────────────────────

//   const openGroupModal = () => {
//     setGroupForm(EMPTY_GROUP_FORM);
//     setGroupFormErrors({});
//     groupSlugEditedRef.current = false;
//     setShowGroupModal(true);
//   };

//   const closeGroupModal = () => {
//     setShowGroupModal(false);
//     setGroupForm(EMPTY_GROUP_FORM);
//     setGroupFormErrors({});
//     groupSlugEditedRef.current = false;
//   };

//   const handleGroupFormChange = (field, value) => {
//     setGroupForm((prev) => ({ ...prev, [field]: value }));
//     if (groupFormErrors[field]) setGroupFormErrors((prev) => ({ ...prev, [field]: undefined }));
//   };

//   const handleGroupNameChange = (value) => {
//     handleGroupFormChange('group_name', value);
//     if (!groupSlugEditedRef.current) {
//       handleGroupFormChange('group_key', slugify(value));
//     }
//   };

//   const handleGroupKeyChange = (value) => {
//     groupSlugEditedRef.current = true;
//     handleGroupFormChange('group_key', slugify(value));
//   };

//   const validateGroupForm = () => {
//     const errs = {};
//     if (!groupForm.group_name.trim()) errs.group_name = 'Group name is required';
//     if (!groupForm.group_key.trim())  errs.group_key  = 'Group key is required';
//     if (groups.some(g => g.storeGroup === groupForm.group_key.trim()))
//       errs.group_key = 'A group with this key already exists';
//     return errs;
//   };

//   const handleSaveGroup = async () => {
//     const errs = validateGroupForm();
//     if (Object.keys(errs).length > 0) { setGroupFormErrors(errs); return; }
//     setSavingGroup(true);
//     setError(null);
//     try {
//       await api.createStoreGroup({
//         groupKey:  groupForm.group_key.trim(),
//         groupName: groupForm.group_name.trim(),
//         color:     groupForm.color,
//       });
//       showSuccess(`Group "${groupForm.group_name.trim()}" created`);
//       await loadGroups();
//       closeGroupModal();
//     } catch (err) {
//       console.error('Failed to create group:', err);
//       setGroupFormErrors({ group_key: err.message || 'Failed to create group' });
//     } finally {
//       setSavingGroup(false);
//     }
//   };

//   const totalStores    = stores.length;
//   const activeStores   = stores.filter((s) => s.is_active !== false).length;
//   const inactiveStores = totalStores - activeStores;

//   return (
//     <div className="store-management">
//       <div className="store-management-inner">

//         {/* Header */}
//         <div className="page-header">
//           <div className="page-header-left">
//             <button className="btn-back" onClick={onBack} type="button">← Back</button>
//             <div>
//               <h2>🏪 Manage Stores</h2>
//               <p className="page-subtitle">
//                 {totalStores} stores &nbsp;·&nbsp; {activeStores} active &nbsp;·&nbsp; {inactiveStores} inactive
//               </p>
//             </div>
//           </div>
//           <div className="page-header-actions">
//             <button className="btn-secondary" onClick={openGroupModal} type="button">🎨 New Group</button>
//             <button className="btn-primary" onClick={openAddModal} type="button">+ Add Store</button>
//           </div>
//         </div>

//         {/* Alerts */}
//         {error && (
//           <div className="alert alert-error">
//             <span>⚠️ {error}</span>
//             <button onClick={() => setError(null)} type="button">×</button>
//           </div>
//         )}
//         {successMsg && (
//           <div className="alert alert-success">
//             <span>✅ {successMsg}</span>
//           </div>
//         )}

//         {/* Filters */}
//         <div className="store-filters">
//           <input
//             className="store-search"
//             type="text"
//             placeholder="🔍 Search by name, identifier, domain, group…"
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//           />
//           <div className="filter-tabs">
//             {['all', 'active', 'inactive'].map((f) => (
//               <button
//                 key={f}
//                 className={`filter-tab ${filterActive === f ? 'active' : ''}`}
//                 onClick={() => setFilterActive(f)}
//                 type="button"
//               >
//                 {f === 'all'      ? `All (${totalStores})`       :
//                  f === 'active'   ? `Active (${activeStores})`   :
//                                     `Inactive (${inactiveStores})`}
//               </button>
//             ))}
//           </div>
//         </div>

//         {/* Table */}
//         {loading ? (
//           <div className="loading-state">
//             <div className="spinner"></div>
//             <p>Loading stores…</p>
//           </div>
//         ) : filteredStores.length === 0 ? (
//           <div className="empty-state">
//             <div className="empty-icon">🏪</div>
//             <h3>{search || filterActive !== 'all' ? 'No stores match your search' : 'No stores yet'}</h3>
//             {!search && filterActive === 'all' && <p>Add your first store to get started.</p>}
//             {(search || filterActive !== 'all') && (
//               <button
//                 className="btn-secondary"
//                 onClick={() => { setSearch(''); setFilterActive('all'); }}
//                 type="button"
//               >
//                 Clear filters
//               </button>
//             )}
//           </div>
//         ) : (
//           <div className="store-table-wrapper">
//             <table className="store-table">
//               <thead>
//                 <tr>
//                   <th>Brand Name</th>
//                   <th>Identifier</th>
//                   <th>Shop Domain</th>
//                   <th>Group</th>
//                   <th>Status</th>
//                   <th>Actions</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {filteredStores.map((store) => (
//                   <tr key={store.id} className={!store.is_active ? 'row-inactive' : ''}>
//                     <td><span className="store-brand-name">{store.brand_name || '—'}</span></td>
//                     <td><code className="store-identifier">{store.store_identifier}</code></td>
//                     <td className="store-domain">{store.shop_domain || '—'}</td>
//                     <td>
//                       {store.store_group ? (
//                         <span
//                           className="group-badge"
//                           style={{ borderLeft: `4px solid ${groupColorMap[store.store_group] || '#94a3b8'}` }}
//                         >
//                           {store.store_group_name || store.store_group}
//                         </span>
//                       ) : (
//                         <span className="group-badge group-badge-empty">Ungrouped</span>
//                       )}
//                     </td>
//                     <td>
//                       <button
//                         className={`status-toggle ${store.is_active !== false ? 'status-active' : 'status-inactive'}`}
//                         onClick={() => handleToggleActive(store)}
//                         type="button"
//                         title={store.is_active !== false ? 'Click to deactivate' : 'Click to activate'}
//                       >
//                         {store.is_active !== false ? '● Active' : '○ Inactive'}
//                       </button>
//                     </td>
//                     <td>
//                       <div className="row-actions">
//                         <button className="btn-row-edit"   onClick={() => openEditModal(store)}   type="button" title="Edit">✏️</button>
//                         <button className="btn-row-delete" onClick={() => openDeleteModal(store)} type="button" title="Delete">🗑️</button>
//                       </div>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         )}

//         {/* Add / Edit Modal */}
//         {showModal && (
//           <div className="modal-overlay" onClick={closeModal}>
//             <div className="modal-content store-modal" onClick={(e) => e.stopPropagation()}>
//               <div className="modal-header">
//                 <h3>{modalMode === 'add' ? '➕ Add Store' : '✏️ Edit Store'}</h3>
//                 <button className="modal-close" onClick={closeModal} type="button">×</button>
//               </div>
//               <div className="modal-body">
//                 <div className="form-grid">
//                   <div className={`form-group ${formErrors.brand_name ? 'has-error' : ''}`}>
//                     <label>Brand Name *</label>
//                     <input
//                       type="text"
//                       placeholder="Mount Pearl Peptides"
//                       value={form.brand_name}
//                       onChange={(e) => handleFormChange('brand_name', e.target.value)}
//                     />
//                     {formErrors.brand_name && <span className="field-error">{formErrors.brand_name}</span>}
//                   </div>

//                   <div className={`form-group ${formErrors.store_identifier ? 'has-error' : ''}`}>
//                     <label>Store Identifier *</label>
//                     <input
//                       type="text"
//                       placeholder="0nrr62-s0"
//                       value={form.store_identifier}
//                       onChange={(e) => handleFormChange('store_identifier', e.target.value)}
//                       disabled={modalMode === 'edit'}
//                     />
//                     {modalMode === 'edit' && <span className="field-hint">Cannot be changed after creation</span>}
//                     {formErrors.store_identifier && <span className="field-error">{formErrors.store_identifier}</span>}
//                   </div>

//                   <div className={`form-group form-group-full ${formErrors.shop_domain ? 'has-error' : ''}`}>
//                     <label>Shopify Domain *</label>
//                     <input
//                       type="text"
//                       placeholder="0nrr62-s0.myshopify.com"
//                       value={form.shop_domain}
//                       onChange={(e) => handleFormChange('shop_domain', e.target.value)}
//                     />
//                     {formErrors.shop_domain && <span className="field-error">{formErrors.shop_domain}</span>}
//                   </div>

//                   <div className={`form-group form-group-full ${formErrors.store_group ? 'has-error' : ''}`}>
//                     <label>Store Group *</label>
//                     {groupMode === 'select' ? (
//                       <>
//                         <select
//                           value={form.store_group}
//                           onChange={(e) => handleGroupSelectChange(e.target.value)}
//                           disabled={loadingGroups}
//                         >
//                           <option value="">{loadingGroups ? 'Loading groups…' : '-- Select a group --'}</option>
//                           {groups.map((g) => (
//                             <option key={g.storeGroup} value={g.storeGroup}>
//                               {g.storeGroupName || g.storeGroup} ({g.storeCount})
//                             </option>
//                           ))}
//                           <option value="__new__">➕ Create new group…</option>
//                         </select>
//                         {formErrors.store_group && <span className="field-error">{formErrors.store_group}</span>}
//                       </>
//                     ) : (
//                       <div className="new-group-box">
//                         <div className="new-group-row">
//                           <input
//                             type="text"
//                             placeholder="Group name (e.g. Car Body Kits)"
//                             value={form.store_group_name}
//                             onChange={(e) => handleNewGroupNameChange(e.target.value)}
//                           />
//                           <input
//                             type="text"
//                             placeholder="group-slug"
//                             value={form.store_group}
//                             onChange={(e) => handleNewGroupSlugChange(e.target.value)}
//                           />
//                         </div>
//                         {formErrors.store_group && <span className="field-error">{formErrors.store_group}</span>}
//                         {groups.length > 0 && (
//                           <button
//                             type="button"
//                             className="btn-link"
//                             onClick={() => { setGroupMode('select'); handleFormChange('store_group', ''); handleFormChange('store_group_name', ''); }}
//                           >
//                             ← Choose an existing group instead
//                           </button>
//                         )}
//                       </div>
//                     )}
//                   </div>

//                   <div className="form-group form-group-full">
//                     <label>Status</label>
//                     <div className="status-row">
//                       <label className="toggle-switch">
//                         <input
//                           type="checkbox"
//                           checked={form.is_active}
//                           onChange={(e) => handleFormChange('is_active', e.target.checked)}
//                         />
//                         <span className="toggle-slider"></span>
//                       </label>
//                       <span className={form.is_active ? 'status-text active' : 'status-text inactive'}>
//                         {form.is_active ? 'Active' : 'Inactive'}
//                       </span>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//               <div className="modal-footer">
//                 <button className="btn-cancel"  onClick={closeModal} type="button" disabled={saving}>Cancel</button>
//                 <button className="btn-primary" onClick={handleSave} type="button" disabled={saving}>
//                   {saving ? 'Saving…' : modalMode === 'add' ? 'Add Store' : 'Save Changes'}
//                 </button>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* New Group Modal */}
//         {showGroupModal && (
//           <div className="modal-overlay" onClick={closeGroupModal}>
//             <div className="modal-content group-modal" onClick={(e) => e.stopPropagation()}>
//               <div className="modal-header">
//                 <h3>🎨 New Store Group</h3>
//                 <button className="modal-close" onClick={closeGroupModal} type="button">×</button>
//               </div>
//               <div className="modal-body">
//                 {groups.length > 0 && (
//                   <div className="existing-groups-preview">
//                     <span className="existing-groups-label">Existing groups</span>
//                     <div className="existing-groups-chips">
//                       {groups.map((g) => (
//                         <span key={g.storeGroup} className="existing-group-chip" style={{ borderLeft: `4px solid ${g.color || '#94a3b8'}` }}>
//                           {g.storeGroupName || g.storeGroup} ({g.storeCount})
//                         </span>
//                       ))}
//                     </div>
//                   </div>
//                 )}

//                 <div className="form-grid">
//                   <div className={`form-group form-group-full ${groupFormErrors.group_name ? 'has-error' : ''}`}>
//                     <label>Group Name *</label>
//                     <input
//                       type="text"
//                       placeholder="Car Body Kits"
//                       value={groupForm.group_name}
//                       onChange={(e) => handleGroupNameChange(e.target.value)}
//                       autoFocus
//                     />
//                     {groupFormErrors.group_name && <span className="field-error">{groupFormErrors.group_name}</span>}
//                   </div>

//                   <div className={`form-group form-group-full ${groupFormErrors.group_key ? 'has-error' : ''}`}>
//                     <label>Group Key *</label>
//                     <input
//                       type="text"
//                       placeholder="car-body-kits"
//                       value={groupForm.group_key}
//                       onChange={(e) => handleGroupKeyChange(e.target.value)}
//                     />
//                     <span className="field-hint">Used internally to link stores to this group. Auto-filled from the name.</span>
//                     {groupFormErrors.group_key && <span className="field-error">{groupFormErrors.group_key}</span>}
//                   </div>

//                   <div className="form-group form-group-full">
//                     <label>Dashboard Color</label>
//                     <div className="new-group-color-row">
//                       <input
//                         type="color"
//                         className="color-swatch-input"
//                         value={groupForm.color}
//                         onChange={(e) => handleGroupFormChange('color', e.target.value)}
//                       />
//                       <div className="color-presets">
//                         {PRESET_COLORS.map((c) => (
//                           <button
//                             key={c}
//                             type="button"
//                             className={`color-preset ${groupForm.color === c ? 'color-preset-active' : ''}`}
//                             style={{ background: c }}
//                             onClick={() => handleGroupFormChange('color', c)}
//                             title={c}
//                           />
//                         ))}
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//               <div className="modal-footer">
//                 <button className="btn-cancel"  onClick={closeGroupModal} type="button" disabled={savingGroup}>Cancel</button>
//                 <button className="btn-primary" onClick={handleSaveGroup} type="button" disabled={savingGroup}>
//                   {savingGroup ? 'Creating…' : 'Create Group'}
//                 </button>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* Delete Confirm Modal */}
//         {showDeleteModal && deleteTarget && (
//           <div className="modal-overlay" onClick={closeDeleteModal}>
//             <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
//               <div className="modal-header">
//                 <h3>🗑️ Delete Store</h3>
//               </div>
//               <div className="modal-body">
//                 <p>Are you sure you want to delete <strong>{deleteTarget.brand_name}</strong>?</p>
//                 <p className="delete-warning">⚠️ This will remove the store and may affect associated conversations.</p>
//               </div>
//               <div className="modal-footer">
//                 <button className="btn-cancel" onClick={closeDeleteModal} type="button" disabled={saving}>Cancel</button>
//                 <button className="btn-logout" onClick={handleDelete}     type="button" disabled={saving}>
//                   {saving ? 'Deleting…' : 'Yes, Delete'}
//                 </button>
//               </div>
//             </div>
//           </div>
//         )}

//       </div>

//       <style>{`
//         .store-management {
//           height: 100%;
//           overflow-y: auto;
//           overflow-x: hidden;
//           box-sizing: border-box;
//           background: var(--bg-color, #f0f2f5);
//           /* scroll container — parent must have a fixed height */
//         }
//         .store-management-inner {
//           max-width: 1400px;
//           width: 100%;
//           margin: 0 auto;
//           padding: 28px 32px 60px;
//           box-sizing: border-box;
//         }
//         .page-header {
//           display: flex;
//           align-items: center;
//           justify-content: space-between;
//           margin-bottom: 22px;
//           gap: 16px;
//         }
//         .page-header-left {
//           display: flex;
//           align-items: center;
//           gap: 12px;
//         }
//         .page-header-actions { display: flex; gap: 10px; }
//         .page-header-left h2 { margin: 0 0 3px 0; font-size: 20px; font-weight: 700; color: var(--text-primary, #111); }
//         .page-subtitle { margin: 0; font-size: 13px; color: var(--text-secondary, #888); }
//         .btn-back {
//           background: none;
//           border: 1px solid var(--border-color, #e2e8f0);
//           border-radius: 6px;
//           padding: 6px 12px;
//           font-size: 13px;
//           cursor: pointer;
//           color: var(--text-secondary, #555);
//           white-space: nowrap;
//         }
//         .btn-back:hover { background: var(--hover-bg, #f1f5f9); }
//         .btn-primary {
//           background: var(--primary-color, #25d366);
//           color: #fff;
//           border: none;
//           border-radius: 8px;
//           padding: 9px 18px;
//           font-size: 14px;
//           font-weight: 600;
//           cursor: pointer;
//           white-space: nowrap;
//         }
//         .btn-primary:hover    { filter: brightness(1.08); }
//         .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
//         .btn-secondary {
//           background: none;
//           border: 1px solid var(--border-color, #e2e8f0);
//           border-radius: 8px;
//           padding: 8px 16px;
//           font-size: 14px;
//           cursor: pointer;
//           color: var(--text-primary, #333);
//           white-space: nowrap;
//         }
//         .btn-secondary:hover { background: var(--hover-bg, #f1f5f9); }
//         .alert {
//           display: flex;
//           align-items: center;
//           justify-content: space-between;
//           padding: 10px 14px;
//           border-radius: 8px;
//           font-size: 14px;
//           margin-bottom: 16px;
//           gap: 8px;
//         }
//         .alert button  { background: none; border: none; cursor: pointer; font-size: 16px; }
//         .alert-error   { background: #fef2f2; color: #c0392b; border: 1px solid #fecaca; }
//         .alert-success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
//         .store-filters {
//           display: flex;
//           align-items: center;
//           gap: 12px;
//           margin-bottom: 16px;
//           flex-wrap: wrap;
//         }
//         .store-search {
//           flex: 1;
//           min-width: 200px;
//           padding: 8px 12px;
//           border: 1px solid var(--border-color, #e2e8f0);
//           border-radius: 8px;
//           font-size: 14px;
//           background: var(--input-bg, #fff);
//           color: var(--text-primary, #333);
//         }
//         .store-search:focus { outline: none; border-color: var(--primary-color, #25d366); }
//         .filter-tabs {
//           display: flex;
//           gap: 4px;
//           background: var(--surface-bg, #e8ecf0);
//           border-radius: 8px;
//           padding: 3px;
//         }
//         .filter-tab {
//           background: none;
//           border: none;
//           border-radius: 6px;
//           padding: 5px 13px;
//           font-size: 13px;
//           cursor: pointer;
//           color: var(--text-secondary, #888);
//         }
//         .filter-tab.active {
//           background: #fff;
//           color: var(--text-primary, #333);
//           font-weight: 600;
//           box-shadow: 0 1px 3px rgba(0,0,0,0.1);
//         }
//         .store-table-wrapper {
//           background: var(--card-bg, #fff);
//           border: 1px solid var(--border-color, #e2e8f0);
//           border-radius: 12px;
//           overflow: hidden;
//           overflow-x: auto;
//           box-shadow: 0 1px 4px rgba(0,0,0,0.05);
//         }
//         .store-table { width: 100%; border-collapse: collapse; font-size: 14px; }
//         .store-table thead { background: var(--surface-bg, #f8fafc); }
//         .store-table th {
//           text-align: left;
//           padding: 11px 16px;
//           font-size: 11px;
//           font-weight: 700;
//           text-transform: uppercase;
//           letter-spacing: 0.06em;
//           color: var(--text-secondary, #999);
//           border-bottom: 1px solid var(--border-color, #e8ecf0);
//           white-space: nowrap;
//         }
//         .store-table td {
//           padding: 13px 16px;
//           border-bottom: 1px solid var(--border-color, #f0f4f8);
//           color: var(--text-primary, #333);
//           vertical-align: middle;
//         }
//         .store-table tr:last-child td  { border-bottom: none; }
//         .store-table tbody tr:hover td { background: var(--hover-bg, #f8fafc); }
//         .row-inactive td { opacity: 0.5; }
//         .store-brand-name { font-weight: 600; color: var(--text-primary, #111); }
//         .store-identifier {
//           background: var(--surface-bg, #f1f5f9);
//           padding: 2px 7px;
//           border-radius: 4px;
//           font-size: 12px;
//           font-family: monospace;
//           color: var(--text-secondary, #555);
//         }
//         .store-domain { font-size: 13px; color: var(--text-secondary, #666); }
//         .group-badge {
//           display: inline-block;
//           background: #eef2ff;
//           color: #4338ca;
//           border-radius: 4px;
//           padding: 3px 10px;
//           font-size: 12px;
//           font-weight: 600;
//           white-space: nowrap;
//         }
//         .group-badge-empty { background: #f1f5f9; color: #94a3b8; border-left: none !important; }
//         .status-toggle {
//           border: none;
//           border-radius: 20px;
//           padding: 3px 10px;
//           font-size: 12px;
//           font-weight: 600;
//           cursor: pointer;
//           white-space: nowrap;
//         }
//         .status-active   { background: #dcfce7; color: #166534; }
//         .status-inactive { background: #f1f5f9; color: #888; }
//         .row-actions { display: flex; gap: 4px; }
//         .btn-row-edit, .btn-row-delete {
//           background: none;
//           border: 1px solid transparent;
//           border-radius: 6px;
//           padding: 4px 8px;
//           cursor: pointer;
//           font-size: 15px;
//           line-height: 1;
//         }
//         .btn-row-edit:hover   { background: #eff6ff; border-color: #bfdbfe; }
//         .btn-row-delete:hover { background: #fef2f2; border-color: #fecaca; }
//         .loading-state, .empty-state {
//           text-align: center;
//           padding: 60px 20px;
//           color: var(--text-secondary, #888);
//           background: var(--card-bg, #fff);
//           border: 1px solid var(--border-color, #e2e8f0);
//           border-radius: 12px;
//         }
//         .loading-state .spinner {
//           width: 36px; height: 36px;
//           border: 3px solid var(--border-color, #e2e8f0);
//           border-top-color: var(--primary-color, #25d366);
//           border-radius: 50%;
//           animation: spin 0.8s linear infinite;
//           margin: 0 auto 12px;
//         }
//         @keyframes spin { to { transform: rotate(360deg); } }
//         .empty-icon    { font-size: 48px; margin-bottom: 12px; }
//         .empty-state h3 { margin: 0 0 6px; color: var(--text-primary, #333); }
//         .empty-state p  { margin: 0 0 16px; }
//         .store-modal { width: 560px; max-width: 95vw; }
//         .group-modal { width: 480px; max-width: 95vw; }
//         .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
//         @media (max-width: 520px) { .form-grid { grid-template-columns: 1fr; } }
//         .form-group { display: flex; flex-direction: column; gap: 5px; }
//         .form-group label { font-size: 13px; font-weight: 600; color: var(--text-primary, #333); }
//         .form-group input[type="text"],
//         .form-group select {
//           padding: 8px 10px;
//           border: 1px solid var(--border-color, #e2e8f0);
//           border-radius: 7px;
//           font-size: 14px;
//           background: var(--input-bg, #fff);
//           color: var(--text-primary, #333);
//         }
//         .form-group input:focus,
//         .form-group select:focus { outline: none; border-color: var(--primary-color, #25d366); }
//         .form-group input:disabled,
//         .form-group select:disabled { background: var(--surface-bg, #f8fafc); color: var(--text-secondary, #999); cursor: not-allowed; }
//         .has-error input,
//         .has-error select { border-color: #f87171 !important; }
//         .field-error { font-size: 12px; color: #ef4444; }
//         .field-hint  { font-size: 12px; color: var(--text-secondary, #888); }
//         .form-group-full   { grid-column: 1 / -1; }
//         .new-group-box { display: flex; flex-direction: column; gap: 8px; }
//         .new-group-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
//         @media (max-width: 520px) { .new-group-row { grid-template-columns: 1fr; } }
//         .new-group-row input {
//           padding: 8px 10px;
//           border: 1px solid var(--border-color, #e2e8f0);
//           border-radius: 7px;
//           font-size: 14px;
//           background: var(--input-bg, #fff);
//           color: var(--text-primary, #333);
//         }
//         .new-group-color-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
//         .color-swatch-input {
//           width: 34px; height: 30px; padding: 2px;
//           border: 1px solid var(--border-color, #e2e8f0);
//           border-radius: 6px;
//           cursor: pointer;
//           background: none;
//         }
//         .color-presets { display: flex; gap: 6px; }
//         .color-preset {
//           width: 22px; height: 22px;
//           border-radius: 50%;
//           border: 2px solid transparent;
//           cursor: pointer;
//           padding: 0;
//         }
//         .color-preset-active { border-color: #1f2937; box-shadow: 0 0 0 1px #fff inset; }
//         .btn-link {
//           background: none;
//           border: none;
//           color: var(--primary-color, #25d366);
//           font-size: 12px;
//           cursor: pointer;
//           text-align: left;
//           padding: 0;
//           text-decoration: underline;
//         }
//         .existing-groups-preview { margin-bottom: 18px; }
//         .existing-groups-label {
//           display: block;
//           font-size: 12px;
//           font-weight: 600;
//           color: var(--text-secondary, #888);
//           margin-bottom: 8px;
//         }
//         .existing-groups-chips { display: flex; flex-wrap: wrap; gap: 6px; }
//         .existing-group-chip {
//           background: var(--surface-bg, #f8fafc);
//           border-radius: 4px;
//           padding: 3px 10px;
//           font-size: 12px;
//           font-weight: 600;
//           color: var(--text-primary, #333);
//           white-space: nowrap;
//         }
//         .status-row { display: flex; align-items: center; gap: 12px; }
//         .toggle-switch { display: inline-flex; cursor: pointer; user-select: none; flex-shrink: 0; }
//         .toggle-switch input { display: none; }
//         .toggle-slider {
//           position: relative;
//           display: inline-block;
//           width: 44px;
//           height: 24px;
//           background: #cbd5e1;
//           border-radius: 12px;
//           transition: background 0.2s;
//         }
//         .toggle-slider::after {
//           content: '';
//           position: absolute;
//           top: 3px;
//           left: 3px;
//           width: 18px;
//           height: 18px;
//           background: #fff;
//           border-radius: 50%;
//           transition: transform 0.2s;
//           box-shadow: 0 1px 3px rgba(0,0,0,0.25);
//         }
//         .toggle-switch input:checked + .toggle-slider { background: var(--primary-color, #25d366); }
//         .toggle-switch input:checked + .toggle-slider::after { transform: translateX(20px); }
//         .status-text { font-size: 14px; font-weight: 600; white-space: nowrap; }
//         .status-text.active { color: #166534; }
//         .status-text.inactive { color: #888; }
//         .delete-modal { max-width: 400px; }
//         .delete-warning {
//           color: #b45309;
//           background: #fffbeb;
//           border: 1px solid #fde68a;
//           border-radius: 6px;
//           padding: 8px 10px;
//           font-size: 13px;
//           margin-top: 8px;
//         }
//         .modal-close {
//           background: none;
//           border: none;
//           font-size: 20px;
//           cursor: pointer;
//           color: var(--text-secondary, #888);
//           line-height: 1;
//           padding: 0 4px;
//         }
//         .modal-close:hover { color: var(--text-primary, #333); }
//       `}</style>
//     </div>
//   );
// }

// export default StoreManagement;







import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

const EMPTY_FORM = {
  store_identifier: '',
  shop_domain: '',
  brand_name: '',
  is_active: true,
  store_group: '',
  store_group_name: '',
};

const PRESET_COLORS = ['#667eea', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const EMPTY_GROUP_FORM = {
  group_name: '',
  group_key: '',
  color: PRESET_COLORS[0],
};

const slugify = (str) =>
  (str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function StoreManagement({ onBack, onStoresUpdated }) {
  const [stores, setStores]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);
  const [successMsg, setSuccessMsg]   = useState(null);

  const [groups, setGroups]           = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groupMode, setGroupMode]     = useState('select'); // 'select' | 'new'
  const slugEditedRef                 = useRef(false); // tracks manual edits to the slug field in "new group" mode

  const [showModal, setShowModal]         = useState(false);
  const [modalMode, setModalMode]         = useState('add');
  const [editingStore, setEditingStore]   = useState(null);
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [formErrors, setFormErrors]       = useState({});

  const [deleteTarget, setDeleteTarget]       = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // ── Group management modal ─────────────────────────────────────────────
  const [showGroupModal, setShowGroupModal]   = useState(false);
  const [groupForm, setGroupForm]             = useState(EMPTY_GROUP_FORM);
  const [groupFormErrors, setGroupFormErrors] = useState({});
  const [savingGroup, setSavingGroup]         = useState(false);
  const groupSlugEditedRef                    = useRef(false);
  const [groupModalError, setGroupModalError] = useState(null);

  // Editing existing groups inside the Manage Groups modal.
  // Drafts are keyed by groupKey; a missing entry means "unchanged" and the row
  // reads straight from the loaded group, so saving one row never clobbers edits
  // in progress on another.
  const [groupDrafts, setGroupDrafts]           = useState({}); // { [groupKey]: { name, color } }
  const [groupRowSaving, setGroupRowSaving]     = useState(null); // groupKey being saved
  const [groupRowDeleting, setGroupRowDeleting] = useState(null); // groupKey being deleted
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(null); // groupKey pending inline delete confirm
  const [showCreateGroup, setShowCreateGroup]   = useState(false); // reveals the create form inside the modal

  const [search, setSearch]             = useState('');
  const [filterActive, setFilterActive] = useState('all');

  useEffect(() => { loadStores(); loadGroups(); }, []);

  const normalize = (s) => ({
    id:               s.id,
    brand_name:       s.brandName        || s.brand_name       || s.name       || '',
    store_identifier: s.storeIdentifier  || s.store_identifier || s.identifier || '',
    shop_domain:      s.shopDomain       || s.shop_domain      || s.domain     || '',
    is_active:
      s.isActive  !== undefined ? s.isActive  :
      s.is_active !== undefined ? s.is_active : true,
    store_group:      s.storeGroup      || s.store_group      || '',
    store_group_name: s.storeGroupName  || s.store_group_name || '',
    // Derived server-side from whether an access_token exists. The token
    // itself is never sent to the browser.
    shopify_connected: s.shopifyConnected === true,
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

  const loadGroups = async () => {
    try {
      setLoadingGroups(true);
      const data = await api.getStoreGroups();
      setGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load store groups:', err);
      setGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  };

  const groupColorMap = React.useMemo(
    () => Object.fromEntries(groups.map(g => [g.storeGroup, g.color])),
    [groups]
  );

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
      (s.shop_domain       || '').toLowerCase().includes(q) ||
      (s.store_group_name  || '').toLowerCase().includes(q) ||
      (s.store_group       || '').toLowerCase().includes(q);
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
    slugEditedRef.current = false;
    setGroupMode(groups.length > 0 ? 'select' : 'new');
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
      store_group:      store.store_group      || '',
      store_group_name: store.store_group_name || '',
    });
    setFormErrors({});
    slugEditedRef.current = true; // don't auto-overwrite an existing store's slug while editing
    // If this store's current group isn't in the known groups list (e.g. ungrouped,
    // or a group that only exists on inactive stores), fall back to "new" mode so
    // the value is still visible/editable rather than silently hidden.
    const knownSlugs = groups.map(g => g.storeGroup);
    setGroupMode(store.store_group && knownSlugs.includes(store.store_group) ? 'select' : 'new');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingStore(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    slugEditedRef.current = false;
  };

  const validate = () => {
    const errs = {};
    if (!form.store_identifier.trim()) errs.store_identifier = 'Store identifier is required';
    if (!form.shop_domain.trim())      errs.shop_domain      = 'Shop domain is required';
    if (!form.brand_name.trim())       errs.brand_name       = 'Brand name is required';
    if (!form.store_group.trim())      errs.store_group       = 'A store group is required';
    return errs;
  };

  const handleGroupSelectChange = (value) => {
    if (value === '__new__') {
      setGroupMode('new');
      slugEditedRef.current = false;
      handleFormChange('store_group', '');
      handleFormChange('store_group_name', '');
      return;
    }
    setGroupMode('select');
    const match = groups.find(g => g.storeGroup === value);
    handleFormChange('store_group', value);
    handleFormChange('store_group_name', match?.storeGroupName || '');
  };

  const handleNewGroupNameChange = (value) => {
    handleFormChange('store_group_name', value);
    if (!slugEditedRef.current) {
      handleFormChange('store_group', slugify(value));
    }
  };

  const handleNewGroupSlugChange = (value) => {
    slugEditedRef.current = true;
    handleFormChange('store_group', slugify(value));
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
        storeGroup:      form.store_group.trim(),
        storeGroupName:  form.store_group_name.trim() || null,
      };
      if (modalMode === 'add') {
        await api.fetch('/api/stores', { method: 'POST', body: JSON.stringify(payload) });
        showSuccess(`Store "${payload.brandName}" added successfully`);
      } else {
        await api.fetch(`/api/stores/${editingStore.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showSuccess(`Store "${payload.brandName}" updated successfully`);
      }
      await loadStores();
      await loadGroups();
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

  // Kicks off the Shopify OAuth install for one store.
  //
  // Opens the backend's /auth endpoint in a new tab rather than fetching it:
  // the flow is a redirect chain through Shopify's consent screen and back to
  // /auth/callback, which only works in a real browser context. The token is
  // written server-side by the callback, so nothing sensitive passes through
  // here — this button only starts the journey.
  const handleConnectShopify = (store) => {
    if (!store.shop_domain) return;
    const base = (api.baseUrl || '').replace(/\/$/, '');
    window.open(`${base}/auth?shop=${encodeURIComponent(store.shop_domain)}`, '_blank', 'noopener');
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
          // PUT overwrites the whole row (no COALESCE) — these MUST be re-sent
          // here or the store's group gets silently nulled out on every toggle.
          storeGroup:      store.store_group || null,
          storeGroupName:  store.store_group_name || null,
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

  // ── Group management ──────────────────────────────────────────────────

  const openGroupModal = () => {
    setGroupForm(EMPTY_GROUP_FORM);
    setGroupFormErrors({});
    setGroupModalError(null);
    setGroupDrafts({});
    setConfirmDeleteGroup(null);
    setShowCreateGroup(groups.length === 0); // no groups yet → open straight into the create form
    groupSlugEditedRef.current = false;
    setShowGroupModal(true);
  };

  const closeGroupModal = () => {
    setShowGroupModal(false);
    setGroupForm(EMPTY_GROUP_FORM);
    setGroupFormErrors({});
    setGroupModalError(null);
    setGroupDrafts({});
    setConfirmDeleteGroup(null);
    setShowCreateGroup(false);
    groupSlugEditedRef.current = false;
  };

  const handleGroupFormChange = (field, value) => {
    setGroupForm((prev) => ({ ...prev, [field]: value }));
    if (groupFormErrors[field]) setGroupFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleGroupNameChange = (value) => {
    handleGroupFormChange('group_name', value);
    if (!groupSlugEditedRef.current) {
      handleGroupFormChange('group_key', slugify(value));
    }
  };

  const handleGroupKeyChange = (value) => {
    groupSlugEditedRef.current = true;
    handleGroupFormChange('group_key', slugify(value));
  };

  const validateGroupForm = () => {
    const errs = {};
    if (!groupForm.group_name.trim()) errs.group_name = 'Group name is required';
    if (!groupForm.group_key.trim())  errs.group_key  = 'Group key is required';
    if (groups.some(g => g.storeGroup === groupForm.group_key.trim()))
      errs.group_key = 'A group with this key already exists';
    return errs;
  };

  // Create a new group from inside the Manage Groups modal — stays open so the
  // new group appears in the list immediately.
  const handleSaveGroup = async () => {
    const errs = validateGroupForm();
    if (Object.keys(errs).length > 0) { setGroupFormErrors(errs); return; }
    setSavingGroup(true);
    setGroupModalError(null);
    try {
      await api.createStoreGroup({
        groupKey:  groupForm.group_key.trim(),
        groupName: groupForm.group_name.trim(),
        color:     groupForm.color,
      });
      showSuccess(`Group "${groupForm.group_name.trim()}" created`);
      await loadGroups();
      if (onStoresUpdated) onStoresUpdated();
      setGroupForm(EMPTY_GROUP_FORM);
      setGroupFormErrors({});
      groupSlugEditedRef.current = false;
      setShowCreateGroup(false);
    } catch (err) {
      console.error('Failed to create group:', err);
      setGroupFormErrors({ group_key: err.message || 'Failed to create group' });
    } finally {
      setSavingGroup(false);
    }
  };

  // Edit an existing group. The key is immutable — every store references it, so
  // only the display name and colour can change here.
  const groupDraftFor = (g) =>
    groupDrafts[g.storeGroup] || { name: g.storeGroupName || '', color: g.color || PRESET_COLORS[0] };

  const isGroupRowDirty = (g) => {
    const d = groupDraftFor(g);
    return d.name !== (g.storeGroupName || '') || d.color !== (g.color || PRESET_COLORS[0]);
  };

  const handleGroupDraftChange = (g, field, value) => {
    setGroupModalError(null);
    setGroupDrafts((prev) => {
      const base = prev[g.storeGroup] || { name: g.storeGroupName || '', color: g.color || PRESET_COLORS[0] };
      return { ...prev, [g.storeGroup]: { ...base, [field]: value } };
    });
  };

  const clearGroupDraft = (groupKey) =>
    setGroupDrafts((prev) => { const next = { ...prev }; delete next[groupKey]; return next; });

  const handleSaveGroupRow = async (g) => {
    const draft = groupDraftFor(g);
    if (!draft.name.trim()) { setGroupModalError('Group name cannot be empty'); return; }
    setGroupRowSaving(g.storeGroup);
    setGroupModalError(null);
    try {
      await api.updateStoreGroup({
        groupKey:  g.storeGroup,
        groupName: draft.name.trim(),
        color:     draft.color,
      });
      showSuccess(`Group "${draft.name.trim()}" updated`);
      await loadGroups();
      await loadStores();            // push the rename/colour through to the store table
      if (onStoresUpdated) onStoresUpdated();
      clearGroupDraft(g.storeGroup); // row re-reads the fresh values → no longer dirty
    } catch (err) {
      console.error('Failed to update group:', err);
      setGroupModalError(err.message || 'Failed to update group');
    } finally {
      setGroupRowSaving(null);
    }
  };

  const handleDeleteGroupRow = async (g) => {
    setGroupRowDeleting(g.storeGroup);
    setGroupModalError(null);
    try {
      await api.deleteStoreGroup(g.storeGroup);
      showSuccess(`Group "${g.storeGroupName || g.storeGroup}" deleted`);
      await loadGroups();
      await loadStores();            // stores that were in this group are now ungrouped
      if (onStoresUpdated) onStoresUpdated();
      clearGroupDraft(g.storeGroup);
      setConfirmDeleteGroup(null);
    } catch (err) {
      console.error('Failed to delete group:', err);
      setGroupModalError(err.message || 'Failed to delete group');
      setConfirmDeleteGroup(null);
    } finally {
      setGroupRowDeleting(null);
    }
  };

  const openCreateGroupForm = () => {
    setGroupForm(EMPTY_GROUP_FORM);
    setGroupFormErrors({});
    groupSlugEditedRef.current = false;
    setShowCreateGroup(true);
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
          <div className="page-header-actions">
            <button className="btn-secondary" onClick={openGroupModal} type="button">🎨 Manage Groups</button>
            <button className="btn-primary" onClick={openAddModal} type="button">+ Add Store</button>
          </div>
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
            placeholder="🔍 Search by name, identifier, domain, group…"
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
                  <th>Group</th>
                  <th>Shopify</th>
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
                      {store.store_group ? (
                        <span
                          className="group-badge"
                          style={{ borderLeft: `4px solid ${groupColorMap[store.store_group] || '#94a3b8'}` }}
                        >
                          {store.store_group_name || store.store_group}
                        </span>
                      ) : (
                        <span className="group-badge group-badge-empty">Ungrouped</span>
                      )}
                    </td>
                    <td>
                      {store.shopify_connected ? (
                        <span className="shopify-badge shopify-badge--connected">Connected</span>
                      ) : (
                        <button
                          type="button"
                          className="shopify-connect"
                          onClick={() => handleConnectShopify(store)}
                          disabled={!store.shop_domain}
                          title={store.shop_domain
                            ? `Install the app on ${store.shop_domain}`
                            : 'Add a shop domain before connecting'}
                        >
                          Connect
                        </button>
                      )}
                    </td>
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

                  <div className={`form-group form-group-full ${formErrors.store_group ? 'has-error' : ''}`}>
                    <label>Store Group *</label>
                    {groupMode === 'select' ? (
                      <>
                        <select
                          value={form.store_group}
                          onChange={(e) => handleGroupSelectChange(e.target.value)}
                          disabled={loadingGroups}
                        >
                          <option value="">{loadingGroups ? 'Loading groups…' : '-- Select a group --'}</option>
                          {groups.map((g) => (
                            <option key={g.storeGroup} value={g.storeGroup}>
                              {g.storeGroupName || g.storeGroup} ({g.storeCount})
                            </option>
                          ))}
                          <option value="__new__">➕ Create new group…</option>
                        </select>
                        {formErrors.store_group && <span className="field-error">{formErrors.store_group}</span>}
                      </>
                    ) : (
                      <div className="new-group-box">
                        <div className="new-group-row">
                          <input
                            type="text"
                            placeholder="Group name (e.g. Car Body Kits)"
                            value={form.store_group_name}
                            onChange={(e) => handleNewGroupNameChange(e.target.value)}
                          />
                          <input
                            type="text"
                            placeholder="group-slug"
                            value={form.store_group}
                            onChange={(e) => handleNewGroupSlugChange(e.target.value)}
                          />
                        </div>
                        {formErrors.store_group && <span className="field-error">{formErrors.store_group}</span>}
                        {groups.length > 0 && (
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => { setGroupMode('select'); handleFormChange('store_group', ''); handleFormChange('store_group_name', ''); }}
                          >
                            ← Choose an existing group instead
                          </button>
                        )}
                      </div>
                    )}
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

        {/* Manage Groups Modal */}
        {showGroupModal && (
          <div className="modal-overlay" onClick={closeGroupModal}>
            <div className="modal-content manage-groups-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>🎨 Manage Store Groups</h3>
                <button className="modal-close" onClick={closeGroupModal} type="button">×</button>
              </div>
              <div className="modal-body">
                {groupModalError && (
                  <div className="alert alert-error" style={{ marginBottom: 14 }}>
                    <span>⚠️ {groupModalError}</span>
                    <button onClick={() => setGroupModalError(null)} type="button">×</button>
                  </div>
                )}

                {loadingGroups ? (
                  <div className="group-manage-loading"><span className="spinner-sm" /> Loading groups…</div>
                ) : groups.length === 0 ? (
                  <div className="group-manage-empty">No groups yet. Create your first one below.</div>
                ) : (
                  <div className="group-manage-list">
                    {groups.map((g) => {
                      const draft      = groupDraftFor(g);
                      const dirty      = isGroupRowDirty(g);
                      const rowSaving  = groupRowSaving   === g.storeGroup;
                      const rowDeleting= groupRowDeleting === g.storeGroup;
                      const confirming = confirmDeleteGroup === g.storeGroup;

                      if (confirming) {
                        return (
                          <div className="group-manage-row" key={g.storeGroup}>
                            <div className="group-row-confirm">
                              <span>
                                Delete <strong>{g.storeGroupName || g.storeGroup}</strong>?
                                {g.storeCount > 0 && ` ${g.storeCount} store${g.storeCount === 1 ? '' : 's'} will be ungrouped.`}
                              </span>
                              <div className="group-row-confirm-actions">
                                <button className="btn-cancel-sm" type="button" onClick={() => setConfirmDeleteGroup(null)} disabled={rowDeleting}>Cancel</button>
                                <button className="btn-delete-sm" type="button" onClick={() => handleDeleteGroupRow(g)} disabled={rowDeleting}>
                                  {rowDeleting ? 'Deleting…' : 'Delete'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="group-manage-row" key={g.storeGroup}>
                          <div className="group-row-color">
                            <input
                              type="color"
                              className="color-swatch-input"
                              value={draft.color}
                              onChange={(e) => handleGroupDraftChange(g, 'color', e.target.value)}
                              title="Custom color"
                            />
                            <div className="color-presets">
                              {PRESET_COLORS.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  className={`color-preset ${draft.color === c ? 'color-preset-active' : ''}`}
                                  style={{ background: c }}
                                  onClick={() => handleGroupDraftChange(g, 'color', c)}
                                  title={c}
                                />
                              ))}
                            </div>
                          </div>

                          <div className="group-row-main">
                            <input
                              type="text"
                              className="group-row-name-input"
                              value={draft.name}
                              onChange={(e) => handleGroupDraftChange(g, 'name', e.target.value)}
                              placeholder="Group name"
                            />
                            <div className="group-row-meta">
                              <code className="group-row-key">{g.storeGroup}</code>
                              <span className="group-row-count">{g.storeCount} store{g.storeCount === 1 ? '' : 's'}</span>
                            </div>
                          </div>

<div className="group-row-actions">
  {dirty && (
    <button className="btn-row-save" type="button"
      onClick={() => handleSaveGroupRow(g)} disabled={rowSaving || !draft.name.trim()}>
      {rowSaving ? 'Saving…' : 'Save'}
    </button>
  )}
  {g.storeCount > 0 ? (
    <span className="group-row-locked"
      title="This group is in use. Move its stores to another group before it can be deleted.">🔒</span>
  ) : (
    <button className="btn-row-delete-group" type="button"
      onClick={() => setConfirmDeleteGroup(g.storeGroup)} title="Delete group">🗑️</button>
  )}
</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Create new group */}
                <div className="group-create-section">
                  {!showCreateGroup ? (
                    <button className="btn-add-group" type="button" onClick={openCreateGroupForm}>
                      ＋ New group
                    </button>
                  ) : (
                    <div className="group-create-box">
                      <div className="group-create-title">New group</div>
                      <div className="form-grid">
                        <div className={`form-group form-group-full ${groupFormErrors.group_name ? 'has-error' : ''}`}>
                          <label>Group Name *</label>
                          <input
                            type="text"
                            placeholder="Car Body Kits"
                            value={groupForm.group_name}
                            onChange={(e) => handleGroupNameChange(e.target.value)}
                            autoFocus
                          />
                          {groupFormErrors.group_name && <span className="field-error">{groupFormErrors.group_name}</span>}
                        </div>

                        <div className={`form-group form-group-full ${groupFormErrors.group_key ? 'has-error' : ''}`}>
                          <label>Group Key *</label>
                          <input
                            type="text"
                            placeholder="car-body-kits"
                            value={groupForm.group_key}
                            onChange={(e) => handleGroupKeyChange(e.target.value)}
                          />
                          <span className="field-hint">Links stores to this group. Auto-filled from the name and can't be changed later.</span>
                          {groupFormErrors.group_key && <span className="field-error">{groupFormErrors.group_key}</span>}
                        </div>

                        <div className="form-group form-group-full">
                          <label>Dashboard Color</label>
                          <div className="new-group-color-row">
                            <input
                              type="color"
                              className="color-swatch-input"
                              value={groupForm.color}
                              onChange={(e) => handleGroupFormChange('color', e.target.value)}
                            />
                            <div className="color-presets">
                              {PRESET_COLORS.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  className={`color-preset ${groupForm.color === c ? 'color-preset-active' : ''}`}
                                  style={{ background: c }}
                                  onClick={() => handleGroupFormChange('color', c)}
                                  title={c}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="group-create-actions">
                        <button className="btn-cancel" type="button" onClick={() => { setShowCreateGroup(false); setGroupFormErrors({}); }} disabled={savingGroup}>Cancel</button>
                        <button className="btn-primary" type="button" onClick={handleSaveGroup} disabled={savingGroup}>
                          {savingGroup ? 'Creating…' : 'Create Group'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-primary" onClick={closeGroupModal} type="button">Done</button>
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
        .page-header-actions { display: flex; gap: 10px; }
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
          white-space: nowrap;
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
        .shopify-badge {
          display: inline-block; font-size: 11px; font-weight: 600;
          padding: 3px 10px; border-radius: 999px; white-space: nowrap;
        }
        .shopify-badge--connected {
          color: #027a5b; background: rgba(0, 168, 132, 0.12);
          border: 1px solid rgba(0, 168, 132, 0.3);
        }
        /* Not an error state - most stores simply have not been installed yet,
           so this reads as an available action rather than a failure. */
        .shopify-connect {
          font: inherit; font-size: 11px; font-weight: 600;
          padding: 3px 12px; border-radius: 999px; cursor: pointer;
          color: #2563eb; background: #fff; border: 1px solid #bfdbfe;
        }
        .shopify-connect:hover:not(:disabled) { background: #eff6ff; border-color: #2563eb; }
        .shopify-connect:disabled { opacity: 0.5; cursor: not-allowed; color: #94a3b8; border-color: #e2e8f0; }
        .group-badge {
          display: inline-block;
          background: #eef2ff;
          color: #4338ca;
          border-radius: 4px;
          padding: 3px 10px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }
        .group-badge-empty { background: #f1f5f9; color: #94a3b8; border-left: none !important; }
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
        .manage-groups-modal { width: 560px; max-width: 95vw; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        @media (max-width: 520px) { .form-grid { grid-template-columns: 1fr; } }
        .form-group { display: flex; flex-direction: column; gap: 5px; }
        .form-group label { font-size: 13px; font-weight: 600; color: var(--text-primary, #333); }
        .form-group input[type="text"],
        .form-group select {
          padding: 8px 10px;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 7px;
          font-size: 14px;
          background: var(--input-bg, #fff);
          color: var(--text-primary, #333);
        }
        .form-group input:focus,
        .form-group select:focus { outline: none; border-color: var(--primary-color, #25d366); }
        .form-group input:disabled,
        .form-group select:disabled { background: var(--surface-bg, #f8fafc); color: var(--text-secondary, #999); cursor: not-allowed; }
        .has-error input,
        .has-error select { border-color: #f87171 !important; }
        .field-error { font-size: 12px; color: #ef4444; }
        .field-hint  { font-size: 12px; color: var(--text-secondary, #888); }
        .form-group-full   { grid-column: 1 / -1; }
        .new-group-box { display: flex; flex-direction: column; gap: 8px; }
        .new-group-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media (max-width: 520px) { .new-group-row { grid-template-columns: 1fr; } }
        .new-group-row input {
          padding: 8px 10px;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 7px;
          font-size: 14px;
          background: var(--input-bg, #fff);
          color: var(--text-primary, #333);
        }
        .new-group-color-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .color-swatch-input {
          width: 34px; height: 30px; padding: 2px;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 6px;
          cursor: pointer;
          background: none;
        }
        .color-presets { display: flex; gap: 6px; }
        .color-preset {
          width: 22px; height: 22px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          padding: 0;
        }
        .color-preset-active { border-color: #1f2937; box-shadow: 0 0 0 1px #fff inset; }
        .btn-link {
          background: none;
          border: none;
          color: var(--primary-color, #25d366);
          font-size: 12px;
          cursor: pointer;
          text-align: left;
          padding: 0;
          text-decoration: underline;
        }

        /* ── Manage groups modal ─────────────────────────────────────────── */
        .group-manage-loading, .group-manage-empty {
          display: flex; align-items: center; gap: 10px;
          padding: 18px 2px; font-size: 14px; color: var(--text-secondary, #888);
        }
        .spinner-sm {
          width: 18px; height: 18px;
          border: 2px solid var(--border-color, #e2e8f0);
          border-top-color: var(--primary-color, #25d366);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          flex-shrink: 0;
        }
        .group-manage-list {
          max-height: 46vh;
          overflow-y: auto;
          margin: 0 -4px 4px;
          padding: 0 4px;
        }
        .group-manage-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 0;
          border-bottom: 1px solid var(--border-color, #eef1f4);
          flex-wrap: wrap;
        }
        .group-manage-row:last-child { border-bottom: none; }
        .group-row-color { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
        .group-row-color .color-swatch-input { width: 30px; height: 28px; }
        .group-row-color .color-preset { width: 18px; height: 18px; }
        .group-row-main { flex: 1 1 200px; display: flex; flex-direction: column; gap: 5px; min-width: 0; }
        .group-row-name-input {
          padding: 7px 10px;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 7px;
          font-size: 14px;
          font-weight: 600;
          width: 100%;
          box-sizing: border-box;
          background: var(--input-bg, #fff);
          color: var(--text-primary, #333);
        }
        .group-row-name-input:focus { outline: none; border-color: var(--primary-color, #25d366); }
        .group-row-meta { display: flex; align-items: center; gap: 8px; }
        .group-row-key {
          background: var(--surface-bg, #f1f5f9);
          padding: 1px 7px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 11px;
          color: var(--text-secondary, #64748b);
        }
        .group-row-count { font-size: 12px; color: var(--text-secondary, #94a3b8); }
        .group-row-actions { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
        .btn-row-save {
          background: var(--primary-color, #25d366);
          color: #fff;
          border: none;
          border-radius: 7px;
          padding: 7px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .btn-row-save:hover    { filter: brightness(1.08); }
        .btn-row-save:disabled { opacity: 0.55; cursor: not-allowed; }
        .btn-row-delete-group {
          background: none;
          border: 1px solid transparent;
          border-radius: 6px;
          padding: 5px 8px;
          cursor: pointer;
          font-size: 15px;
          line-height: 1;
        }
        .btn-row-delete-group:hover { background: #fef2f2; border-color: #fecaca; }
        .group-row-confirm {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
          flex-wrap: wrap;
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 13px;
          color: #92400e;
        }
        .group-row-confirm strong { color: #78350f; }
        .group-row-confirm-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .btn-cancel-sm {
          background: none;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 6px;
          padding: 5px 12px;
          font-size: 13px;
          cursor: pointer;
          color: var(--text-secondary, #555);
        }
        .btn-cancel-sm:hover     { background: var(--hover-bg, #f1f5f9); }
        .btn-cancel-sm:disabled  { opacity: 0.6; cursor: not-allowed; }
        .btn-delete-sm {
          background: #ef4444;
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 5px 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .btn-delete-sm:hover     { filter: brightness(1.05); }
        .btn-delete-sm:disabled  { opacity: 0.6; cursor: not-allowed; }
        .group-create-section {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--border-color, #eef1f4);
        }
        .btn-add-group {
          width: 100%;
          background: none;
          border: 1px dashed var(--border-color, #cbd5e1);
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          color: var(--primary-color, #25d366);
        }
        .btn-add-group:hover { background: var(--hover-bg, #f8fafc); border-color: var(--primary-color, #25d366); }
        .group-create-box {
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 10px;
          padding: 16px;
          background: var(--surface-bg, #f8fafc);
        }
        .group-row-locked { font-size: 14px; opacity: 0.45; cursor: help; padding: 5px 6px; line-height: 1; }
        .group-create-title { font-size: 13px; font-weight: 700; color: var(--text-primary, #333); margin-bottom: 12px; }
        .group-create-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; }

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