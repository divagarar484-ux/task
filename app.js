const API = 'http://localhost:5000/api';
let currentPage = 1;
let deleteTargetId = null;
let searchTimer = null;

// ── HELPERS ──────────────────────────────────────────────────────────────────

function getToken() { return localStorage.getItem('token'); }
function getUser() { return JSON.parse(localStorage.getItem('user') || 'null'); }

function saveAuth(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
}

function clearAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

async function apiFetch(path, options = {}) {
    const token = getToken();
    const res = await fetch(`${API}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...options,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
}

function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast ${type}`;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 3000);
}

function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.classList.remove('hidden');
}

function clearError(id) { document.getElementById(id).classList.add('hidden'); }

function setLoading(btnId, loaderId, loading) {
    document.querySelector(`#${btnId} .btn-text`).classList.toggle('hidden', loading);
    document.querySelector(`#${btnId} .btn-loader`).classList.toggle('hidden', !loading);
    document.getElementById(btnId).disabled = loading;
}

// ── AUTH ─────────────────────────────────────────────────────────────────────

function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`${name}-screen`).classList.add('active');
}

function switchTab(tab) {
    document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}

async function handleLogin(e) {
    e.preventDefault();
    clearError('login-error');
    setLoading('login-btn', 'login-btn', true);
    try {
        const data = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email: document.getElementById('login-email').value,
                password: document.getElementById('login-password').value,
            }),
        });
        saveAuth(data.token, data.user);
        initDashboard();
    } catch (err) {
        showError('login-error', err.message);
    } finally {
        setLoading('login-btn', 'login-btn', false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    clearError('register-error');
    setLoading('register-btn', 'register-btn', true);
    try {
        const data = await apiFetch('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                name: document.getElementById('reg-name').value,
                email: document.getElementById('reg-email').value,
                password: document.getElementById('reg-password').value,
            }),
        });
        saveAuth(data.token, data.user);
        initDashboard();
    } catch (err) {
        showError('register-error', err.message);
    } finally {
        setLoading('register-btn', 'register-btn', false);
    }
}

function handleLogout() {
    clearAuth();
    showScreen('auth');
}

// ── DASHBOARD ────────────────────────────────────────────────────────────────

function initDashboard() {
    const user = getUser();
    if (!user) return showScreen('auth');

    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-email').textContent = user.email;
    document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();
    setGreeting();
    showScreen('dashboard');
    initParticles();
    loadTasks();
}

// ── FLOATING PARTICLES ────────────────────────────────────────────────────────

function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const COLORS = [
        'rgba(124,106,247,', 'rgba(167,143,247,',
        'rgba(76,201,160,', 'rgba(247,90,124,',
        'rgba(247,197,106,', 'rgba(255,255,255,',
    ];

    const particles = Array.from({ length: 90 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2.5 + 0.8,
        vx: (Math.random() - 0.5) * 0.55,
        vy: (Math.random() - 0.5) * 0.55,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        opacity: Math.random() * 0.35 + 0.08,
        phase: Math.random() * Math.PI * 2,   // for size breathing
    }));

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(p => {
            p.phase += 0.018;
            const radius = p.r + Math.sin(p.phase) * 0.6;

            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color + p.opacity + ')';
            ctx.fill();

            // Move
            p.x += p.vx;
            p.y += p.vy;

            // Wrap around edges
            if (p.x < -6) p.x = canvas.width + 6;
            if (p.x > canvas.width + 6) p.x = -6;
            if (p.y < -6) p.y = canvas.height + 6;
            if (p.y > canvas.height + 6) p.y = -6;
        });

        requestAnimationFrame(animate);
    }
    animate();
}

function setGreeting() {
    const h = new Date().getHours();
    const g = h < 12 ? 'Good morning ☀️' : h < 17 ? 'Good afternoon 🌤' : 'Good evening 🌙';
    document.getElementById('greeting').textContent = g;
}

async function loadTasks() {
    const status = document.getElementById('filter-status').value;
    const sort = document.getElementById('filter-sort').value;
    const search = document.getElementById('search-input').value;
    const params = new URLSearchParams({ page: currentPage, limit: 9 });
    if (status) params.append('status', status);
    if (sort) params.append('sort', sort);
    if (search) params.append('search', search);

    try {
        const data = await apiFetch(`/tasks?${params}`);
        renderTasks(data.data);
        renderPagination(data.page, data.pages);
        updateStats(data);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function updateStats(data) {
    document.getElementById('stat-total').textContent = data.total;
    // For precise stats, you need dedicated queries; do rough count from current view
}

function renderTasks(tasks) {
    const grid = document.getElementById('task-grid');
    if (!tasks.length) {
        grid.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>No tasks found. Create your first one!</p></div>`;
        return;
    }
    grid.innerHTML = tasks.map(task => {
        const due = task.dueDate ? new Date(task.dueDate) : null;
        const overdue = due && due < new Date() && task.status !== 'Completed';
        const dueBadge = due
            ? `<span class="badge badge-due ${overdue ? 'overdue' : ''}">📅 ${due.toLocaleDateString()}</span>`
            : '';
        const statusKey = task.status.replace(' ', '').toLowerCase();
        return `
        <div class="task-card priority-${task.priority.toLowerCase()}" id="card-${task._id}">
            <div class="task-card-header">
                <div class="task-title-text">${escapeHtml(task.title)}</div>
                <div class="task-card-actions">
                    <button class="icon-btn" onclick="openEditModal('${task._id}')" title="Edit">✏️</button>
                    <button class="icon-btn del" onclick="openDeleteModal('${task._id}')" title="Delete">🗑️</button>
                </div>
            </div>
            ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ''}
            <div class="task-meta">
                <span class="badge badge-priority-${task.priority.toLowerCase()}">${task.priority}</span>
                <span class="badge badge-status-${statusKey}">${task.status}</span>
                ${dueBadge}
            </div>
        </div>`;
    }).join('');
}

function renderPagination(page, pages) {
    const div = document.getElementById('pagination');
    if (pages <= 1) { div.innerHTML = ''; return; }
    let html = '';
    for (let i = 1; i <= pages; i++) {
        html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    div.innerHTML = html;
}

function goToPage(p) { currentPage = p; loadTasks(); }
function debounceSearch() { clearTimeout(searchTimer); searchTimer = setTimeout(() => { currentPage = 1; loadTasks(); }, 400); }

// ── TASK MODAL ────────────────────────────────────────────────────────────────

function openTaskModal() {
    document.getElementById('modal-title').textContent = 'New Task';
    document.getElementById('task-submit-btn').textContent = 'Create Task';
    document.getElementById('task-form').reset();
    document.getElementById('task-id').value = '';
    clearError('task-error');
    document.getElementById('task-modal').classList.remove('hidden');
}

async function openEditModal(id) {
    try {
        const data = await apiFetch(`/tasks/${id}`);
        const t = data.data;
        document.getElementById('modal-title').textContent = 'Edit Task';
        document.getElementById('task-submit-btn').textContent = 'Save Changes';
        document.getElementById('task-id').value = t._id;
        document.getElementById('task-title').value = t.title;
        document.getElementById('task-desc').value = t.description || '';
        document.getElementById('task-priority').value = t.priority;
        document.getElementById('task-status').value = t.status;
        document.getElementById('task-due').value = t.dueDate ? t.dueDate.slice(0, 10) : '';
        clearError('task-error');
        document.getElementById('task-modal').classList.remove('hidden');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function closeTaskModal() { document.getElementById('task-modal').classList.add('hidden'); }
function closeModalOnOverlay(e) { if (e.target.id === 'task-modal') closeTaskModal(); }

async function handleTaskSubmit(e) {
    e.preventDefault();
    clearError('task-error');
    const id = document.getElementById('task-id').value;
    const newStatus = document.getElementById('task-status').value;
    const body = {
        title: document.getElementById('task-title').value,
        description: document.getElementById('task-desc').value,
        priority: document.getElementById('task-priority').value,
        status: newStatus,
        dueDate: document.getElementById('task-due').value || undefined,
    };
    try {
        if (id) {
            await apiFetch(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(body) });
            if (newStatus === 'Completed') {
                closeTaskModal();
                celebrateCompletion();
            } else {
                showToast('Task updated! ✅');
            }
        } else {
            await apiFetch('/tasks', { method: 'POST', body: JSON.stringify(body) });
            if (newStatus === 'Completed') {
                closeTaskModal();
                celebrateCompletion();
            } else {
                showToast('Task created! 🎉');
            }
        }
        loadTasks();
    } catch (err) {
        showError('task-error', err.message);
    }
}

// ── CELEBRATION ───────────────────────────────────────────────────────────────

function celebrateCompletion() {
    const overlay = document.getElementById('celebrate-overlay');
    const canvas = document.getElementById('confetti-canvas');
    overlay.classList.remove('hidden');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext('2d');
    const colors = ['#7c6af7', '#f75a7c', '#4cc9a0', '#f7c56a', '#a78ff7', '#ffffff'];
    const particles = Array.from({ length: 160 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        r: Math.random() * 8 + 4,
        d: Math.random() * 160 + 80,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 10,
        speed: Math.random() * 3 + 1.5,
        spin: (Math.random() - 0.5) * 0.12,
        angle: Math.random() * Math.PI * 2,
    }));

    let frame;
    let elapsed = 0;
    const DURATION = 3200; // ms

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            // Draw a small rectangle (confetti piece)
            ctx.rect(-p.r / 2, -p.r / 2, p.r, p.r * 0.5);
            ctx.fill();
            ctx.restore();

            p.y += p.speed;
            p.x += Math.sin(p.angle) * 1.5;
            p.angle += p.spin;
            if (p.y > canvas.height) {
                p.y = -10;
                p.x = Math.random() * canvas.width;
            }
        });
        elapsed += 16;
        if (elapsed < DURATION) {
            frame = requestAnimationFrame(draw);
        } else {
            cancelAnimationFrame(frame);
        }
    }
    draw();

    // Auto-dismiss after 3.5s
    setTimeout(() => {
        overlay.classList.add('hidden');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 3500);
}

// Close celebration if clicked
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('celebrate-overlay').addEventListener('click', () => {
        document.getElementById('celebrate-overlay').classList.add('hidden');
    });
});

// ── DELETE MODAL ──────────────────────────────────────────────────────────────

function openDeleteModal(id) {
    deleteTargetId = id;
    document.getElementById('delete-modal').classList.remove('hidden');
}
function closeDeleteModal() { document.getElementById('delete-modal').classList.add('hidden'); }
function closeDeleteOnOverlay(e) { if (e.target.id === 'delete-modal') closeDeleteModal(); }

async function confirmDelete() {
    if (!deleteTargetId) return;
    try {
        await apiFetch(`/tasks/${deleteTargetId}`, { method: 'DELETE' });
        showToast('Task deleted');
        closeDeleteModal();
        loadTasks();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ── UTILS ─────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── INIT ──────────────────────────────────────────────────────────────────────

if (getToken()) {
    initDashboard();
} else {
    showScreen('auth');
}
