/* =============================================
   DOCVAULT — app.js
   Lógica completa: auth, CRUD, dashboard, preview
   ============================================= */

// ---------- STORAGE KEYS ----------
const STORAGE_USERS = 'docvault_users';
const STORAGE_SESSION = 'docvault_session';
const STORAGE_DOCS = 'docvault_documents';

// ---------- GLOBAL STATE ----------
let currentUser = null;
let documents = [];
let currentView = 'grid';       // 'grid' | 'list'
let currentPreviewDocId = null; // doc actualmente en vista previa
let deleteTargetId = null;      // id del doc a eliminar (confirmación)
let chartInstance = null;       // instancia Chart.js

// ---------- UTILIDADES ----------
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getToday() {
  return new Date(new Date().toISOString().split('T')[0]);
}

/**
 * Calcula el estado de un documento basado en su fecha de vencimiento.
 * Retorna: 'current' (vigente), 'expiring' (por vencer <=7 días), 'expired' (vencido)
 */
function computeStatus(expiryDateStr) {
  if (!expiryDateStr) return 'current'; // sin fecha -> vigente
  const expiry = new Date(expiryDateStr + 'T00:00:00');
  const today = getToday();
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'expired';
  if (diffDays <= 7) return 'expiring';
  return 'current';
}

// ---------- TOAST ----------
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-ico">${icons[type] || icons.info}</span><span class="toast-txt">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ---------- AUTH ----------
function loadUsers() {
  return JSON.parse(localStorage.getItem(STORAGE_USERS)) || [];
}
function saveUsers(users) {
  localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
}

function showRegister() {
  document.getElementById('login-form').classList.remove('active');
  document.getElementById('register-form').classList.add('active');
  document.getElementById('login-error').classList.add('hidden');
  document.getElementById('reg-error').classList.add('hidden');
}
function showLogin() {
  document.getElementById('register-form').classList.remove('active');
  document.getElementById('login-form').classList.add('active');
  document.getElementById('reg-error').classList.add('hidden');
  document.getElementById('login-error').classList.add('hidden');
}

function handleRegister() {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errorEl = document.getElementById('reg-error');
  errorEl.classList.add('hidden');
  if (!name || !email || !password) {
    errorEl.textContent = 'Todos los campos son obligatorios.';
    errorEl.classList.remove('hidden');
    return;
  }
  if (password.length < 6) {
    errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    errorEl.classList.remove('hidden');
    return;
  }
  const users = loadUsers();
  if (users.find(u => u.email === email)) {
    errorEl.textContent = 'Este correo ya está registrado.';
    errorEl.classList.remove('hidden');
    return;
  }
  const newUser = { id: generateId(), name, email, password };
  users.push(newUser);
  saveUsers(users);
  showToast('Cuenta creada exitosamente. Ahora inicia sesión.', 'success');
  showLogin();
}

function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.classList.add('hidden');
  if (!email || !password) {
    errorEl.textContent = 'Ingresa correo y contraseña.';
    errorEl.classList.remove('hidden');
    return;
  }
  const users = loadUsers();
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    errorEl.textContent = 'Credenciales incorrectas.';
    errorEl.classList.remove('hidden');
    return;
  }
  // Guardar sesión
  sessionStorage.setItem(STORAGE_SESSION, JSON.stringify(user));
  currentUser = user;
  showApp();
}

function logout() {
  sessionStorage.removeItem(STORAGE_SESSION);
  currentUser = null;
  documents = [];
  hideApp();
  showToast('Sesión cerrada.', 'info');
}

function checkSession() {
  const sessionData = sessionStorage.getItem(STORAGE_SESSION);
  if (sessionData) {
    currentUser = JSON.parse(sessionData);
    showApp();
  }
}

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  // Actualizar UI de usuario
  document.getElementById('user-name-display').textContent = currentUser.name;
  document.getElementById('user-avatar-sidebar').textContent = currentUser.name.charAt(0).toUpperCase();
  loadDocuments();
  switchSection('dashboard', document.querySelector('[data-section="dashboard"]'));
}

function hideApp() {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  showLogin();
}

// ---------- DOCUMENTOS (localStorage) ----------
function loadDocuments() {
  const allDocs = JSON.parse(localStorage.getItem(STORAGE_DOCS)) || [];
  documents = allDocs.filter(d => d.userId === currentUser.id);
}

function saveAllDocuments() {
  const allDocs = JSON.parse(localStorage.getItem(STORAGE_DOCS)) || [];
  const otherDocs = allDocs.filter(d => d.userId !== currentUser.id);
  const updated = [...otherDocs, ...documents];
  localStorage.setItem(STORAGE_DOCS, JSON.stringify(updated));
}

function getDocById(id) {
  return documents.find(d => d.id === id) || null;
}

// ---------- NAVEGACIÓN ----------
function switchSection(sectionId, navEl) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const section = document.getElementById(`section-${sectionId}`);
  if (section) section.classList.add('active');
  if (navEl) navEl.classList.add('active');
  // Actualizar header
  const titles = {
    dashboard: ['Dashboard', 'Resumen de tus documentos'],
    documents: ['Documentos', 'Gestiona tu archivo personal'],
    preview: ['Vista de Documento / Código', 'Visualización detallada'],
    expiring: ['Recordatorios', 'Documentos que requieren atención']
  };
  document.getElementById('page-title').textContent = titles[sectionId][0];
  document.getElementById('page-subtitle').textContent = titles[sectionId][1];
  // Refrescar contenido
  if (sectionId === 'dashboard') refreshDashboard();
  if (sectionId === 'documents') renderDocuments();
  if (sectionId === 'preview') refreshPreviewPanel();
  if (sectionId === 'expiring') refreshExpiringSection();
}

// ---------- DASHBOARD ----------
function getStats() {
  const stats = { total: 0, current: 0, expiring: 0, expired: 0 };
  documents.forEach(d => {
    stats.total++;
    const status = computeStatus(d.expiryDate);
    if (status === 'current') stats.current++;
    else if (status === 'expiring') stats.expiring++;
    else if (status === 'expired') stats.expired++;
  });
  return stats;
}

function refreshDashboard() {
  const stats = getStats();
  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-current').textContent = stats.current;
  document.getElementById('stat-expiring').textContent = stats.expiring;
  document.getElementById('stat-expired').textContent = stats.expired;
  // Leyenda chart
  document.getElementById('legend-current').textContent = stats.current;
  document.getElementById('legend-expiring').textContent = stats.expiring;
  document.getElementById('legend-expired').textContent = stats.expired;
  document.getElementById('chart-center-num').textContent = stats.total;
  updateChart(stats);
  renderRecentDocs();
  renderCategoryBreakdown();
  updateAlertsBanner();
}

function updateChart(stats) {
  const ctx = document.getElementById('statusChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();
  const data = [stats.current, stats.expiring, stats.expired];
  const allZero = data.every(v => v === 0);
  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Vigentes', 'Por vencer', 'Vencidos'],
      datasets: [{
        data: allZero ? [1, 0, 0] : data,
        backgroundColor: ['#22C55E', '#F59E0B', '#EF4444'],
        borderColor: '#1E293B',
        borderWidth: 3,
        hoverBorderColor: '#1E293B'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#1E293B', titleColor: '#E5E7EB', bodyColor: '#94A3B8' }
      }
    }
  });
}

function renderRecentDocs() {
  const container = document.getElementById('recent-documents');
  const recent = [...documents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  if (recent.length === 0) {
    container.innerHTML = '<div class="empty-state small">Sin documentos aún</div>';
    return;
  }
  container.innerHTML = recent.map(d => {
    const status = computeStatus(d.expiryDate);
    const iconBg = status === 'current' ? 'var(--accent-lt)' : status === 'expiring' ? 'var(--warning-lt)' : 'var(--danger-lt)';
    return `<div class="recent-item" onclick="openPreview('${d.id}'); switchSection('preview', null);">
      <div class="recent-doc-icon" style="background:${iconBg};">◫</div>
      <div class="recent-info">
        <div class="recent-name">${escapeHtml(d.name)}</div>
        <div class="recent-cat">${escapeHtml(d.category)}</div>
      </div>
      <div class="status-dot ${status}"></div>
    </div>`;
  }).join('');
}

function renderCategoryBreakdown() {
  const container = document.getElementById('category-breakdown');
  const cats = {};
  documents.forEach(d => { cats[d.category] = (cats[d.category] || 0) + 1; });
  if (Object.keys(cats).length === 0) {
    container.innerHTML = '<span style="color:var(--txt3);font-size:13px;padding:14px 18px;">No hay documentos.</span>';
    return;
  }
  container.innerHTML = Object.entries(cats).map(([cat, count]) =>
    `<div class="cat-chip"><span class="cat-chip-name">${escapeHtml(cat)}</span><span class="cat-chip-count">${count}</span></div>`
  ).join('');
}

function updateAlertsBanner() {
  const banner = document.getElementById('alerts-banner');
  const stats = getStats();
  if (stats.expiring > 0 || stats.expired > 0) {
    banner.classList.remove('hidden');
    banner.innerHTML = `⚠️ Atención: tienes <a href="#" onclick="switchSection('expiring', null); return false;">${stats.expiring} doc(s) por vencer</a> y ${stats.expired} vencido(s).`;
  } else {
    banner.classList.add('hidden');
  }
  // Badge del sidebar
  const badge = document.getElementById('expiring-badge');
  if (stats.expiring > 0) {
    badge.textContent = stats.expiring;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
  // Notificación del navegador (si hay permiso)
  if (stats.expiring > 0 && Notification.permission === 'granted') {
    new Notification('DocVault', { body: `Tienes ${stats.expiring} documento(s) por vencer.` });
  }
}

// Solicitar permiso notificaciones al iniciar
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// ---------- SECCIÓN DOCUMENTOS ----------
function setView(view, btn) {
  currentView = view;
  document.getElementById('btn-view-grid').classList.toggle('active', view === 'grid');
  document.getElementById('btn-view-list').classList.toggle('active', view === 'list');
  renderDocuments();
}

function applyFilters() {
  renderDocuments();
}

function handleSearch(query) {
  renderDocuments();
  // También actualiza resultados en documento si estamos en esa sección
  if (document.getElementById('section-documents').classList.contains('active')) {
    renderDocuments();
  }
}

function getFilteredDocuments() {
  const search = (document.getElementById('global-search')?.value || '').toLowerCase();
  const catFilter = document.getElementById('filter-category')?.value || '';
  const statusFilter = document.getElementById('filter-status')?.value || '';
  return documents.filter(d => {
    const matchesSearch = !search || d.name.toLowerCase().includes(search) || d.category.toLowerCase().includes(search);
    const matchesCat = !catFilter || d.category === catFilter;
    const matchesStatus = !statusFilter || computeStatus(d.expiryDate) === statusFilter;
    return matchesSearch && matchesCat && matchesStatus;
  });
}

function renderDocuments() {
  const container = document.getElementById('documents-container');
  const filtered = getFilteredDocuments();
  document.getElementById('results-count').textContent = `${filtered.length} documento(s)`;
  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">◫</div><h3>No se encontraron documentos</h3><p>Agrega uno nuevo o ajusta los filtros.</p></div>`;
    container.className = 'documents-grid';
    return;
  }
  if (currentView === 'grid') {
    container.className = 'documents-grid';
    container.innerHTML = filtered.map(d => buildDocCard(d)).join('');
  } else {
    container.className = 'documents-list';
    container.innerHTML = filtered.map(d => buildDocListItem(d)).join('');
  }
}

function buildDocCard(doc) {
  const status = computeStatus(doc.expiryDate);
  return `<div class="doc-card ${status}" onclick="openPreview('${doc.id}'); switchSection('preview', null);">
    <div class="doc-card-head">
      <span class="doc-card-name">${escapeHtml(doc.name)}</span>
      <div class="doc-card-btns" onclick="event.stopPropagation();">
        <button class="doc-act-btn" onclick="openEditDocumentModal('${doc.id}')" title="Editar">✎</button>
        <button class="doc-act-btn del" onclick="openDeleteModal('${doc.id}')" title="Eliminar">✕</button>
      </div>
    </div>
    <div class="doc-card-tags">
      <span class="tag-cat">${escapeHtml(doc.category)}</span>
      <span class="tag-status ${status}">${status === 'current' ? 'Vigente' : status === 'expiring' ? 'Por vencer' : 'Vencido'}</span>
    </div>
    <div class="doc-card-expiry">Vence: ${formatDate(doc.expiryDate)}</div>
    ${doc.description ? `<div class="doc-card-desc">${escapeHtml(doc.description)}</div>` : ''}
  </div>`;
}

function buildDocListItem(doc) {
  const status = computeStatus(doc.expiryDate);
  return `<div class="doc-list-item ${status}" onclick="openPreview('${doc.id}'); switchSection('preview', null);">
    <span class="doc-list-name">${escapeHtml(doc.name)}</span>
    <span class="doc-list-cat">${escapeHtml(doc.category)}</span>
    <span class="doc-list-date">${formatDate(doc.expiryDate)}</span>
    <span class="doc-list-st"><span class="tag-status ${status}">${status === 'current' ? 'Vigente' : status === 'expiring' ? 'Por vencer' : 'Vencido'}</span></span>
    <div class="doc-list-acts" onclick="event.stopPropagation();">
      <button class="doc-act-btn" onclick="openEditDocumentModal('${doc.id}')">✎</button>
      <button class="doc-act-btn del" onclick="openDeleteModal('${doc.id}')">✕</button>
    </div>
  </div>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

// ---------- MODAL DE DOCUMENTO ----------
let selectedFileData = null; // { base64, name, type }

function openDocumentModal(docId = null) {
  const modal = document.getElementById('document-modal');
  const title = document.getElementById('modal-title');
  document.getElementById('modal-error').classList.add('hidden');
  clearFile();
  if (docId) {
    const doc = getDocById(docId);
    if (!doc) return;
    title.textContent = 'Editar Documento';
    document.getElementById('modal-doc-id').value = doc.id;
    document.getElementById('doc-name').value = doc.name;
    document.getElementById('doc-category').value = doc.category;
    document.getElementById('doc-expiry').value = doc.expiryDate || '';
    document.getElementById('doc-description').value = doc.description || '';
    if (doc.fileData) {
      selectedFileData = { base64: doc.fileData, name: doc.fileName, type: doc.fileType };
      showSelectedFile(doc.fileName);
    }
  } else {
    title.textContent = 'Nuevo Documento';
    document.getElementById('modal-doc-id').value = '';
    document.getElementById('doc-name').value = '';
    document.getElementById('doc-category').value = '';
    document.getElementById('doc-expiry').value = '';
    document.getElementById('doc-description').value = '';
    selectedFileData = null;
  }
  modal.classList.remove('hidden');
}

function closeDocumentModal() {
  document.getElementById('document-modal').classList.add('hidden');
}

function modalOverlayClick(event, modalId) {
  if (event.target === document.getElementById(modalId)) {
    if (modalId === 'document-modal') closeDocumentModal();
    if (modalId === 'delete-modal') closeDeleteModal();
  }
}

function handleDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function handleDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
}
function handleFileSelect(input) {
  if (input.files[0]) processFile(input.files[0]);
}
function processFile(file) {
  if (file.size > 5 * 1024 * 1024) {
    showToast('El archivo no debe superar 5 MB.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    selectedFileData = { base64: reader.result, name: file.name, type: file.type };
    showSelectedFile(file.name);
  };
  reader.readAsDataURL(file);
}
function showSelectedFile(name) {
  document.getElementById('file-placeholder').classList.add('hidden');
  document.getElementById('file-selected-display').classList.remove('hidden');
  document.getElementById('selected-file-name-display').textContent = name;
}
function clearFile(event) {
  if (event) event.stopPropagation();
  selectedFileData = null;
  document.getElementById('doc-file').value = '';
  document.getElementById('file-placeholder').classList.remove('hidden');
  document.getElementById('file-selected-display').classList.add('hidden');
}

function saveDocument() {
  const docId = document.getElementById('modal-doc-id').value;
  const name = document.getElementById('doc-name').value.trim();
  const category = document.getElementById('doc-category').value;
  const expiryDate = document.getElementById('doc-expiry').value;
  const description = document.getElementById('doc-description').value.trim();
  const errorEl = document.getElementById('modal-error');
  errorEl.classList.add('hidden');
  if (!name || !category || !expiryDate) {
    errorEl.textContent = 'Nombre, categoría y fecha de vencimiento son obligatorios.';
    errorEl.classList.remove('hidden');
    return;
  }
  if (docId) {
    // Editar
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    doc.name = name;
    doc.category = category;
    doc.expiryDate = expiryDate;
    doc.description = description;
    if (selectedFileData) {
      doc.fileData = selectedFileData.base64;
      doc.fileName = selectedFileData.name;
      doc.fileType = selectedFileData.type;
    } else {
      // Si no se seleccionó archivo nuevo, mantener el existente (o vacío)
      // Si se quitó explícitamente, selectedFileData es null, lo dejamos sin archivo
      if (!selectedFileData && !doc.fileData) {
        // ya está vacío
      } else if (!selectedFileData) {
        // El usuario no tocó el archivo, mantener el actual
      }
    }
    saveAllDocuments();
    showToast('Documento actualizado correctamente.', 'success');
  } else {
    // Nuevo
    const newDoc = {
      id: generateId(),
      userId: currentUser.id,
      name,
      category,
      expiryDate,
      description,
      fileData: selectedFileData ? selectedFileData.base64 : null,
      fileName: selectedFileData ? selectedFileData.name : '',
      fileType: selectedFileData ? selectedFileData.type : '',
      createdAt: new Date().toISOString()
    };
    documents.push(newDoc);
    saveAllDocuments();
    showToast('Documento creado exitosamente.', 'success');
  }
  closeDocumentModal();
  refreshAll();
  if (document.getElementById('section-preview').classList.contains('active') && currentPreviewDocId) {
    openPreview(currentPreviewDocId);
  }
}

function openEditDocumentModal(docId) {
  openDocumentModal(docId);
}

// ---------- ELIMINAR ----------
function openDeleteModal(docId) {
  const doc = getDocById(docId);
  if (!doc) return;
  deleteTargetId = docId;
  document.getElementById('delete-doc-name-display').textContent = doc.name;
  document.getElementById('delete-modal').classList.remove('hidden');
}
function closeDeleteModal() {
  document.getElementById('delete-modal').classList.add('hidden');
  deleteTargetId = null;
}
function confirmDelete() {
  if (!deleteTargetId) return;
  documents = documents.filter(d => d.id !== deleteTargetId);
  saveAllDocuments();
  showToast('Documento eliminado.', 'success');
  closeDeleteModal();
  if (currentPreviewDocId === deleteTargetId) {
    currentPreviewDocId = null;
    refreshPreviewPanel();
  }
  deleteTargetId = null;
  refreshAll();
}

function deleteDocumentFromPreview() {
  if (currentPreviewDocId) openDeleteModal(currentPreviewDocId);
}

// ---------- REFRESCO GLOBAL ----------
function refreshAll() {
  refreshDashboard();
  renderDocuments();
  refreshPreviewPanel();
  refreshExpiringSection();
}

// ---------- VISTA PREVIA ----------
function refreshPreviewPanel() {
  const listEl = document.getElementById('preview-doc-list');
  const countEl = document.getElementById('preview-doc-count');
  countEl.textContent = `${documents.length} docs`;
  listEl.innerHTML = documents.map(d => {
    const activeClass = d.id === currentPreviewDocId ? 'active' : '';
    return `<div class="preview-list-item ${activeClass}" onclick="openPreview('${d.id}')">
      <div class="preview-list-info">
        <div class="preview-list-name">${escapeHtml(d.name)}</div>
        <div class="preview-list-cat">${escapeHtml(d.category)}</div>
      </div>
    </div>`;
  }).join('');
  // Si no hay selección y hay docs, seleccionar el primero
  if (!currentPreviewDocId && documents.length > 0) {
    openPreview(documents[0].id);
  } else if (documents.length === 0) {
    clearPreview();
  }
}

function openPreview(docId) {
  currentPreviewDocId = docId;
  const doc = getDocById(docId);
  if (!doc) { clearPreview(); return; }
  document.getElementById('preview-placeholder').classList.add('hidden');
  document.getElementById('preview-content').classList.remove('hidden');
  document.getElementById('preview-doc-name').textContent = doc.name;
  document.getElementById('preview-doc-category').textContent = doc.category;
  const status = computeStatus(doc.expiryDate);
  const statusTag = document.getElementById('preview-doc-status');
  statusTag.textContent = status === 'current' ? 'Vigente' : status === 'expiring' ? 'Por vencer' : 'Vencido';
  statusTag.className = `preview-status-tag ${status}`;
  document.getElementById('preview-doc-expiry').textContent = formatDate(doc.expiryDate);
  document.getElementById('preview-doc-cat-detail').textContent = doc.category;
  document.getElementById('preview-doc-created').textContent = formatDate(doc.createdAt);
  document.getElementById('preview-doc-description').textContent = doc.description || 'Sin descripción.';
  // Archivo
  const viewer = document.getElementById('preview-viewer-content');
  const downloadLink = document.getElementById('preview-download-link');
  if (doc.fileData) {
    downloadLink.classList.remove('hidden');
    downloadLink.href = doc.fileData;
    downloadLink.download = doc.fileName || 'documento';
    if (doc.fileType && doc.fileType.startsWith('image/')) {
      viewer.innerHTML = `<img src="${doc.fileData}" alt="${escapeHtml(doc.name)}" />`;
    } else if (doc.fileType === 'application/pdf') {
      viewer.innerHTML = `<iframe src="${doc.fileData}" title="PDF preview"></iframe>`;
    } else {
      viewer.innerHTML = `<div class="no-file-state"><span class="no-file-icon">◫</span><p>Archivo no previsualizable</p></div>`;
    }
  } else {
    downloadLink.classList.add('hidden');
    viewer.innerHTML = `<div class="no-file-state"><span class="no-file-icon">◫</span><p>No hay archivo adjunto</p></div>`;
  }
  // Actualizar lista lateral
  document.querySelectorAll('.preview-list-item').forEach(el => {
    el.classList.toggle('active', el.textContent.includes(doc.name) && el.textContent.includes(doc.category));
  });
}

function clearPreview() {
  currentPreviewDocId = null;
  document.getElementById('preview-placeholder').classList.remove('hidden');
  document.getElementById('preview-content').classList.add('hidden');
  document.getElementById('preview-viewer-content').innerHTML = `<div class="no-file-state"><span class="no-file-icon">◫</span><p>No hay archivo adjunto</p></div>`;
}

function editDocumentFromPreview() {
  if (currentPreviewDocId) openEditDocumentModal(currentPreviewDocId);
}

// ---------- SECCIÓN RECORDATORIOS ----------
function refreshExpiringSection() {
  const expiring = documents.filter(d => computeStatus(d.expiryDate) === 'expiring');
  const expired = documents.filter(d => computeStatus(d.expiryDate) === 'expired');
  document.getElementById('count-expiring').textContent = expiring.length;
  document.getElementById('count-expired').textContent = expired.length;
  document.getElementById('expiring-list').innerHTML = buildAlertList(expiring, 'expiring');
  document.getElementById('expired-list').innerHTML = buildAlertList(expired, 'expired');
}

function buildAlertList(list, type) {
  if (list.length === 0) return '<div class="empty-state small">Todo en orden ✓</div>';
  return list.map(d => {
    const days = Math.ceil((new Date(d.expiryDate + 'T00:00:00') - getToday()) / (1000*3600*24));
    const countdownText = type === 'expiring' ? `en ${days} día(s)` : `venció hace ${Math.abs(days)} día(s)`;
    return `<div class="alert-item ${type}" onclick="openPreview('${d.id}'); switchSection('preview', null);">
      <div class="alert-info">
        <div class="alert-name">${escapeHtml(d.name)}</div>
        <div class="alert-meta">${escapeHtml(d.category)} — ${formatDate(d.expiryDate)}</div>
      </div>
      <span class="alert-countdown ${type === 'expiring' ? 'warning' : 'danger'}">${countdownText}</span>
    </div>`;
  }).join('');
}

// ---------- INICIALIZACIÓN ----------
document.addEventListener('DOMContentLoaded', () => {
  // Atajo de teclado global: Ctrl+K / Cmd+K enfoca búsqueda
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('global-search').focus();
    }
  });
  checkSession();
});

// ---------- SOPORTE ----------
function openSupportModal() {
  document.getElementById('support-modal').classList.remove('hidden');
  // Pre-fill email if user is logged in
  if (currentUser) {
    document.getElementById('support-email').value = currentUser.email || '';
  }
  document.getElementById('support-error').classList.add('hidden');
}
function closeSupportModal() {
  document.getElementById('support-modal').classList.add('hidden');
}
function sendSupport() {
  const email = document.getElementById('support-email').value.trim();
  const problem = document.getElementById('support-problem').value.trim();
  const errorEl = document.getElementById('support-error');
  errorEl.classList.add('hidden');
  if (!email || !problem) {
    errorEl.textContent = 'Todos los campos son obligatorios.';
    errorEl.classList.remove('hidden');
    return;
  }
  // Simulación de envío (sin backend)
  showToast('Mensaje de soporte enviado. Te contactaremos pronto.', 'success');
  closeSupportModal();
  document.getElementById('support-email').value = '';
  document.getElementById('support-problem').value = '';
}