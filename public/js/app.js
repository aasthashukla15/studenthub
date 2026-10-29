// StudentHub frontend - plain JavaScript that talks to the Express API using fetch()
(() => {
  'use strict';

  const API = '/api';
  const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
  const DEFAULT_DEPARTMENTS = [
    'Computer Science',
    'Information Technology',
    'Electronics & Communication',
    'Electrical Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Business Administration',
  ];

  // ---------- Page state ----------
  const state = {
    students: [],
    statSemester: null, // semester chosen on the dashboard card
    editingId: null, // id of the student being edited (null = adding)
    deletingId: null, // id of the student waiting for delete confirmation
    knownDepartments: [],
  };

  // ---------- Small helpers ----------
  const $ = (selector) => document.querySelector(selector);

  const el = {
    statTotal: $('#statTotal'),
    statDepartments: $('#statDepartments'),
    statAvgCgpa: $('#statAvgCgpa'),
    statSemester: $('#statSemester'),
    statSemesterCount: $('#statSemesterCount'),
    recentList: $('#recentList'),

    searchInput: $('#searchInput'),
    departmentFilter: $('#departmentFilter'),
    semesterFilter: $('#semesterFilter'),
    clearFiltersBtn: $('#clearFiltersBtn'),
    resultCount: $('#resultCount'),

    loadingState: $('#loadingState'),
    errorState: $('#errorState'),
    errorMessage: $('#errorMessage'),
    retryBtn: $('#retryBtn'),
    emptyState: $('#emptyState'),
    emptyTitle: $('#emptyTitle'),
    emptyText: $('#emptyText'),
    emptyActionBtn: $('#emptyActionBtn'),
    tableWrap: $('#tableWrap'),
    studentsBody: $('#studentsBody'),

    addStudentBtn: $('#addStudentBtn'),
    studentModal: $('#studentModal'),
    modalTitle: $('#modalTitle'),
    studentForm: $('#studentForm'),
    formError: $('#formError'),
    saveBtn: $('#saveBtn'),
    departmentOptions: $('#departmentOptions'),

    deleteModal: $('#deleteModal'),
    deleteText: $('#deleteText'),
    confirmDeleteBtn: $('#confirmDeleteBtn'),

    toasts: $('#toasts'),
  };

  const formFields = ['name', 'registrationNumber', 'email', 'department', 'semester', 'cgpa'];

  // Prevent HTML injection when we put user data into the page
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function initials(name) {
    const parts = String(name).trim().split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // ---------- Talking to the server ----------
  class ApiError extends Error {
    constructor(message, status, fieldErrors = {}) {
      super(message);
      this.status = status;
      this.fieldErrors = fieldErrors;
    }
  }

  async function api(path, options = {}) {
    let response;
    try {
      response = await fetch(API + path, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
    } catch (networkError) {
      throw new ApiError('Cannot reach the server. Please check that it is running.', 0);
    }

    let body = null;
    try {
      body = await response.json();
    } catch (parseError) {
      /* response was not JSON */
    }

    if (!response.ok || !body || body.success === false) {
      throw new ApiError(body?.message || `Request failed (status ${response.status})`, response.status, body?.errors || {});
    }
    return body;
  }

  // ---------- Toast messages ----------
  function toast(message, type = 'success') {
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.textContent = message;
    el.toasts.appendChild(node);
    setTimeout(() => node.remove(), 4000);
  }

  // ---------- Filters ----------
  function currentFilters() {
    return {
      search: el.searchInput.value.trim(),
      department: el.departmentFilter.value,
      semester: el.semesterFilter.value,
    };
  }

  function hasActiveFilters() {
    const f = currentFilters();
    return Boolean(f.search || f.department || f.semester);
  }

  function fillSemesterSelect(select, placeholder) {
    select.innerHTML = '';
    if (placeholder !== undefined) {
      select.add(new Option(placeholder, ''));
    }
    SEMESTERS.forEach((s) => select.add(new Option(`Semester ${s}`, s)));
  }

  // Keep the department dropdown (filter) and the datalist (form) up to date with the database
  function updateDepartmentLists(departmentsFromDb) {
    state.knownDepartments = departmentsFromDb;

    const selected = el.departmentFilter.value;
    el.departmentFilter.innerHTML = '<option value="">All departments</option>';
    departmentsFromDb.forEach((d) => el.departmentFilter.add(new Option(d, d)));
    // Keep the user's selection if that department still exists
    el.departmentFilter.value = departmentsFromDb.includes(selected) ? selected : '';

    const merged = [...new Set([...DEFAULT_DEPARTMENTS, ...departmentsFromDb])].sort();
    el.departmentOptions.innerHTML = merged.map((d) => `<option value="${escapeHtml(d)}"></option>`).join('');
  }

  // ---------- Dashboard ----------
  async function loadStats() {
    try {
      const query = state.statSemester ? `?semester=${state.statSemester}` : '';
      const { data } = await api('/stats' + query);

      el.statTotal.textContent = data.totalStudents;
      el.statDepartments.textContent = data.totalDepartments;
      el.statAvgCgpa.textContent = data.totalStudents ? data.averageCgpa.toFixed(2) : '0.00';

      if (data.currentSemester) {
        state.statSemester = data.currentSemester;
        el.statSemester.value = String(data.currentSemester);
      }
      el.statSemesterCount.textContent = data.studentsInSemester;

      updateDepartmentLists(data.departments);
    } catch (err) {
      [el.statTotal, el.statDepartments, el.statAvgCgpa, el.statSemesterCount].forEach((n) => (n.textContent = '-'));
      toast(err.message, 'error');
    }
  }

  async function loadRecent() {
    try {
      const { data } = await api('/students?limit=5');
      if (!data.length) {
        el.recentList.innerHTML = '<li class="recent-empty">No students added yet.</li>';
        return;
      }
      el.recentList.innerHTML = data
        .map(
          (s) => `
        <li class="recent-item">
          <span class="avatar">${escapeHtml(initials(s.name))}</span>
          <div class="recent-info">
            <p class="recent-name">${escapeHtml(s.name)}</p>
            <p class="recent-meta">${escapeHtml(s.registrationNumber)} &middot; ${escapeHtml(s.department)} &middot; Sem ${s.semester}</p>
          </div>
          <span class="recent-date">${formatDate(s.createdAt)}</span>
        </li>`
        )
        .join('');
    } catch (err) {
      el.recentList.innerHTML = `<li class="recent-empty">${escapeHtml(err.message)}</li>`;
    }
  }

  // ---------- Students table ----------
  function showOnly(which) {
    el.loadingState.hidden = which !== 'loading';
    el.errorState.hidden = which !== 'error';
    el.emptyState.hidden = which !== 'empty';
    el.tableWrap.hidden = which !== 'table';
  }

  function cgpaBadge(cgpa) {
    if (cgpa === undefined || cgpa === null) return '<span class="badge none">N/A</span>';
    const level = cgpa >= 8 ? 'high' : cgpa >= 6 ? 'mid' : 'low';
    return `<span class="badge ${level}">${Number(cgpa).toFixed(2)}</span>`;
  }

  function renderStudents() {
    const students = state.students;
    const filtered = hasActiveFilters();

    el.resultCount.textContent = students.length
      ? `Showing ${students.length} student${students.length === 1 ? '' : 's'}${filtered ? ' (filtered)' : ''}`
      : filtered
      ? 'No matching students'
      : 'No students yet';

    if (!students.length) {
      if (filtered) {
        el.emptyTitle.textContent = 'No students match your search';
        el.emptyText.textContent = 'Try a different name, registration number, department or semester.';
        el.emptyActionBtn.textContent = 'Clear filters';
        el.emptyActionBtn.dataset.action = 'clear';
      } else {
        el.emptyTitle.textContent = 'No students yet';
        el.emptyText.textContent = 'Your database is empty. Add your first student to get started.';
        el.emptyActionBtn.textContent = 'Add Student';
        el.emptyActionBtn.dataset.action = 'add';
      }
      showOnly('empty');
      return;
    }

    el.studentsBody.innerHTML = students
      .map(
        (s) => `
      <tr data-id="${s._id}">
        <td data-label="Reg. No."><span class="reg-no">${escapeHtml(s.registrationNumber)}</span></td>
        <td data-label="Name"><span class="cell-name">${escapeHtml(s.name)}</span></td>
        <td data-label="Email" class="cell-email">${escapeHtml(s.email)}</td>
        <td data-label="Department">${escapeHtml(s.department)}</td>
        <td data-label="Semester">${s.semester}</td>
        <td data-label="CGPA">${cgpaBadge(s.cgpa)}</td>
        <td data-label="Actions" class="actions-cell">
          <div class="row-actions">
            <button class="icon-btn" type="button" data-action="edit" data-id="${s._id}" title="Edit student" aria-label="Edit ${escapeHtml(s.name)}">
              <svg class="icon"><use href="#i-edit"/></svg>
            </button>
            <button class="icon-btn danger" type="button" data-action="delete" data-id="${s._id}" title="Delete student" aria-label="Delete ${escapeHtml(s.name)}">
              <svg class="icon"><use href="#i-trash"/></svg>
            </button>
          </div>
        </td>
      </tr>`
      )
      .join('');
    showOnly('table');
  }

  async function loadStudents() {
    showOnly('loading');
    el.resultCount.textContent = 'Loading students...';

    const f = currentFilters();
    const params = new URLSearchParams();
    if (f.search) params.set('search', f.search);
    if (f.department) params.set('department', f.department);
    if (f.semester) params.set('semester', f.semester);
    const query = params.toString() ? `?${params}` : '';

    try {
      const { data } = await api('/students' + query);
      state.students = data;
      renderStudents();
    } catch (err) {
      el.resultCount.textContent = 'Could not load students';
      el.errorMessage.textContent = err.message;
      showOnly('error');
    }
  }

  // Reload everything from the server (used after add / edit / delete)
  function refreshAll() {
    return Promise.all([loadStats(), loadRecent(), loadStudents()]);
  }

  // ---------- Modals ----------
  function openModal(modal) {
    modal.hidden = false;
    document.body.classList.add('no-scroll');
  }

  function closeModals() {
    el.studentModal.hidden = true;
    el.deleteModal.hidden = true;
    document.body.classList.remove('no-scroll');
    state.editingId = null;
    state.deletingId = null;
  }

  function clearFormErrors() {
    el.formError.hidden = true;
    el.formError.textContent = '';
    document.querySelectorAll('[data-error-for]').forEach((p) => (p.textContent = ''));
    document.querySelectorAll('.field.invalid').forEach((f) => f.classList.remove('invalid'));
  }

  function showFieldErrors(errors) {
    let firstInvalid = null;
    Object.entries(errors).forEach(([field, message]) => {
      const holder = document.querySelector(`[data-error-for="${field}"]`);
      const input = el.studentForm.elements[field];
      if (holder) holder.textContent = message;
      if (input) {
        input.closest('.field').classList.add('invalid');
        if (!firstInvalid) firstInvalid = input;
      }
    });
    if (firstInvalid) firstInvalid.focus();
  }

  function openAddForm() {
    state.editingId = null;
    el.studentForm.reset();
    clearFormErrors();
    el.modalTitle.textContent = 'Add Student';
    el.saveBtn.textContent = 'Save Student';
    openModal(el.studentModal);
    el.studentForm.elements.name.focus();
  }

  async function openEditForm(id) {
    try {
      // GET /api/students/:id -> load the latest copy of this student from MongoDB
      const { data: s } = await api(`/students/${id}`);
      state.editingId = id;
      el.studentForm.reset();
      clearFormErrors();

      el.studentForm.elements.name.value = s.name;
      el.studentForm.elements.registrationNumber.value = s.registrationNumber;
      el.studentForm.elements.email.value = s.email;
      el.studentForm.elements.department.value = s.department;
      el.studentForm.elements.semester.value = String(s.semester);
      el.studentForm.elements.cgpa.value = s.cgpa ?? '';

      el.modalTitle.textContent = 'Edit Student';
      el.saveBtn.textContent = 'Update Student';
      openModal(el.studentModal);
      el.studentForm.elements.name.focus();
    } catch (err) {
      toast(err.message, 'error');
      if (err.status === 404) refreshAll(); // the student was already deleted elsewhere
    }
  }

  // ---------- Form validation (frontend) ----------
  function readForm() {
    const f = el.studentForm.elements;
    return {
      name: f.name.value.trim(),
      registrationNumber: f.registrationNumber.value.trim(),
      email: f.email.value.trim(),
      department: f.department.value.trim(),
      semester: f.semester.value,
      cgpa: f.cgpa.value.trim(),
    };
  }

  function validate(v) {
    const errors = {};

    if (!v.name) errors.name = 'Student name is required';
    else if (v.name.length < 2) errors.name = 'Name must be at least 2 characters';

    if (!v.registrationNumber) errors.registrationNumber = 'Registration number is required';
    else if (!/^[A-Za-z0-9\-/._]{3,30}$/.test(v.registrationNumber))
      errors.registrationNumber = 'Use 3-30 letters, numbers, or - / . _ (no spaces)';

    if (!v.email) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.email = 'Please enter a valid email address';

    if (!v.department) errors.department = 'Department is required';

    if (!v.semester) errors.semester = 'Please select a semester';

    if (v.cgpa !== '') {
      const n = Number(v.cgpa);
      if (Number.isNaN(n) || n < 0 || n > 10) errors.cgpa = 'CGPA must be a number from 0 to 10';
    }
    return errors;
  }

  async function submitForm(event) {
    event.preventDefault();
    clearFormErrors();

    const values = readForm();
    const errors = validate(values);
    if (Object.keys(errors).length) {
      showFieldErrors(errors);
      return;
    }

    // Build the JSON body (CGPA is optional)
    const payload = {
      name: values.name,
      registrationNumber: values.registrationNumber,
      email: values.email,
      department: values.department,
      semester: Number(values.semester),
    };
    if (values.cgpa !== '') payload.cgpa = Number(values.cgpa);

    const isEditing = Boolean(state.editingId);
    el.saveBtn.disabled = true;
    el.saveBtn.textContent = 'Saving...';

    try {
      const result = await api(isEditing ? `/students/${state.editingId}` : '/students', {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });

      closeModals();
      toast(result.message); // message comes straight from the server
      await refreshAll(); // table, dashboard and recent list are re-read from MongoDB
    } catch (err) {
      // Show server-side validation problems (for example a duplicate registration number) next to the field
      if (Object.keys(err.fieldErrors).length) showFieldErrors(err.fieldErrors);
      el.formError.textContent = err.message;
      el.formError.hidden = false;

      if (err.status === 404) {
        // The student disappeared while we were editing
        closeModals();
        toast(err.message, 'error');
        refreshAll();
      }
    } finally {
      el.saveBtn.disabled = false;
      el.saveBtn.textContent = state.editingId ? 'Update Student' : 'Save Student';
    }
  }

  // ---------- Delete ----------
  function askDelete(id) {
    const student = state.students.find((s) => s._id === id);
    state.deletingId = id;
    el.deleteText.textContent = student
      ? `You are about to delete ${student.name} (${student.registrationNumber}). This action cannot be undone.`
      : 'This action cannot be undone.';
    openModal(el.deleteModal);
  }

  async function confirmDelete() {
    const id = state.deletingId;
    if (!id) return;

    el.confirmDeleteBtn.disabled = true;
    el.confirmDeleteBtn.textContent = 'Deleting...';
    try {
      const result = await api(`/students/${id}`, { method: 'DELETE' });
      closeModals();
      toast(result.message);
      await refreshAll();
    } catch (err) {
      closeModals();
      toast(err.message, 'error');
      if (err.status === 404) refreshAll();
    } finally {
      el.confirmDeleteBtn.disabled = false;
      el.confirmDeleteBtn.textContent = 'Yes, delete';
    }
  }

  // ---------- Events ----------
  function clearFilters() {
    el.searchInput.value = '';
    el.departmentFilter.value = '';
    el.semesterFilter.value = '';
    loadStudents();
  }

  function bindEvents() {
    el.addStudentBtn.addEventListener('click', openAddForm);
    el.studentForm.addEventListener('submit', submitForm);
    el.confirmDeleteBtn.addEventListener('click', confirmDelete);
    el.retryBtn.addEventListener('click', refreshAll);

    // Search waits 300ms after typing stops, so we do not hit the server on every key
    el.searchInput.addEventListener('input', debounce(loadStudents, 300));
    el.departmentFilter.addEventListener('change', loadStudents);
    el.semesterFilter.addEventListener('change', loadStudents);
    el.clearFiltersBtn.addEventListener('click', clearFilters);

    el.emptyActionBtn.addEventListener('click', () => {
      if (el.emptyActionBtn.dataset.action === 'clear') clearFilters();
      else openAddForm();
    });

    // Dashboard semester card
    el.statSemester.addEventListener('change', () => {
      state.statSemester = Number(el.statSemester.value);
      loadStats();
    });

    // Edit / delete buttons inside the table (event delegation)
    el.studentsBody.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      if (button.dataset.action === 'edit') openEditForm(button.dataset.id);
      if (button.dataset.action === 'delete') askDelete(button.dataset.id);
    });

    // Close buttons, backdrop click and the Escape key
    document.querySelectorAll('[data-close-modal]').forEach((btn) => btn.addEventListener('click', closeModals));
    [el.studentModal, el.deleteModal].forEach((modal) =>
      modal.addEventListener('mousedown', (event) => {
        if (event.target === modal) closeModals();
      })
    );
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeModals();
    });

    // Remove a field's red error as soon as the user edits it
    formFields.forEach((name) => {
      const input = el.studentForm.elements[name];
      input.addEventListener('input', () => {
        input.closest('.field').classList.remove('invalid');
        const holder = document.querySelector(`[data-error-for="${name}"]`);
        if (holder) holder.textContent = '';
      });
    });
  }

  // ---------- Start ----------
  function init() {
    fillSemesterSelect(el.semesterFilter, 'All semesters');
    fillSemesterSelect(el.statSemester);
    fillSemesterSelect(el.studentForm.elements.semester, 'Select semester');
    bindEvents();
    refreshAll();
  }

  init();
})();
