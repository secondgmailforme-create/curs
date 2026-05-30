// admin-users.js - Управление пользователями

class AdminUsersManager {
    constructor() {
        this.users = [];
        this.filteredUsers = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.currentAction = null;
        this.selectedUserId = null;
        
        // Ждем появления контейнера в DOM
        this.waitForContainer();
    }

    waitForContainer() {
        const checkInterval = setInterval(() => {
            const container = document.getElementById('usersTableBody');
            if (container) {
                clearInterval(checkInterval);
                console.log('AdminUsersManager: Container found, initializing...');
                this.init();
            }
        }, 100);
        
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!document.getElementById('usersTableBody')) {
                console.warn('AdminUsersManager: Container not found after timeout');
            }
        }, 10000);
    }

    async init() {
        console.log('AdminUsersManager: Initializing...');
        this.bindEvents();
        await this.loadUsers();
    }

    bindEvents() {
        document.addEventListener('click', (e) => {
            if (e.target.id === 'createUserBtn' || e.target.closest('#createUserBtn')) {
                e.preventDefault();
                this.openCreateModal();
            }
        });

        document.addEventListener('input', (e) => {
            if (e.target.id === 'searchUsers') {
                this.filterUsers();
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target.id === 'filterRole' || e.target.id === 'filterStatus') {
                this.filterUsers();
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-close')) {
                this.closeAllModals();
            }
            if (e.target.classList.contains('modal-cancel')) {
                this.closeAllModals();
            }
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
            if (e.target.classList.contains('confirm-action')) {
                this.executeAction();
            }
            if (e.target.classList.contains('confirm-cancel')) {
                this.closeAllModals();
            }
        });

        const userForm = document.getElementById('userForm');
        if (userForm) {
            userForm.addEventListener('submit', (e) => this.handleUserSubmit(e));
        }
    }

    async loadUsers() {
        try {
            this.showLoading();
            console.log('Loading users...');
            
            const response = await fetch('/api/admin/users', {
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            const result = await response.json();
            console.log('Users loaded:', result);
            
            this.users = result.data || result.users || result;
            
            if (!Array.isArray(this.users)) {
                console.error('Users is not an array:', this.users);
                this.users = [];
            }
            
            console.log(`Loaded ${this.users.length} users`);
            this.filterUsers();
        } catch (error) {
            console.error('Load users error:', error);
            this.showError(error.message || 'Не удалось загрузить пользователей');
            this.renderTable([]);
        }
    }

    filterUsers() {
        const searchInput = document.getElementById('searchUsers');
        const roleSelect = document.getElementById('filterRole');
        const statusSelect = document.getElementById('filterStatus');
        
        const searchTerm = searchInput?.value.toLowerCase() || '';
        const roleFilter = roleSelect?.value || 'all';
        const statusFilter = statusSelect?.value || 'all';

        this.filteredUsers = this.users.filter(user => {
            const matchesSearch = !searchTerm || 
                user.full_name?.toLowerCase().includes(searchTerm) ||
                user.email?.toLowerCase().includes(searchTerm) ||
                user.phone?.toLowerCase().includes(searchTerm);

            const userRole = user.role_id || user.role;
            const matchesRole = roleFilter === 'all' || userRole == roleFilter;

        
            let matchesStatus = true;
            if (statusFilter === 'active') matchesStatus = user.is_active === true;
            if (statusFilter === 'banned') matchesStatus = user.is_active === false;

            return matchesSearch && matchesRole && matchesStatus;
        });

        console.log(`Filtered: ${this.filteredUsers.length} users`);
        this.currentPage = 1;
        this.render();
    }

    render() {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const pageUsers = this.filteredUsers.slice(start, end);
        
        this.renderTable(pageUsers);
        this.renderPagination();
    }

    renderTable(users) {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) {
            console.warn('usersTableBody not found, retrying...');
            setTimeout(() => this.renderTable(users), 100);
            return;
        }

        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Пользователи не найдены<\/td></tr>';
            return;
        }

        tbody.innerHTML = users.map(user => {
            const isActive = user.is_active === true;
            const isDeleted = user.deleted_at !== null;
            
            return `
            <tr>
                <td>${this.escapeHtml(String(user.id))}<\/td>
                <td><strong>${this.escapeHtml(user.full_name || '-')}</strong><\/td>
                <td>${this.escapeHtml(user.email || '-')}<\/td>
                <td>${this.escapeHtml(user.phone || '-')}<\/td>
                <td>${this.getRoleBadge(user.role_id || user.role)}<\/td>
                <td>${this.getStatusBadge(isActive, isDeleted)}<\/td>
                <td class="action-buttons">
                    ${!isDeleted ? (isActive ? `
                        <button class="action-btn action-ban" onclick="window.adminUsers.banUser(${user.id}, '${this.escapeHtml(user.full_name || user.email)}')" title="Заблокировать">
                            🔒
                        </button>
                    ` : `
                        <button class="action-btn action-restore" onclick="window.adminUsers.restoreUser(${user.id}, '${this.escapeHtml(user.full_name || user.email)}')" title="Восстановить">
                            🔓
                        </button>
                    `) : ''}
                 <\/td>
             \n            `;
        }).join('');
    }

    renderPagination() {
        const container = document.getElementById('usersPagination');
        if (!container) return;

        const totalPages = Math.ceil(this.filteredUsers.length / this.itemsPerPage);
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let pages = [];
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                pages.push(i);
            } else if (pages[pages.length - 1] !== '...') {
                pages.push('...');
            }
        }

        container.innerHTML = `
            <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="window.adminUsers.goToPage(${this.currentPage - 1})">←</button>
            ${pages.map(page => `
                <button class="pagination-btn ${page === this.currentPage ? 'active' : ''}" 
                    ${page === '...' ? 'disabled' : `onclick="window.adminUsers.goToPage(${page})"`}>
                    ${page}
                </button>
            `).join('')}
            <button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="window.adminUsers.goToPage(${this.currentPage + 1})">→</button>
        `;
    }

    goToPage(page) {
        this.currentPage = page;
        this.render();
    }

    openCreateModal() {
        this.currentAction = 'create';
        this.selectedUserId = null;
        
        const modal = document.getElementById('userModal');
        const title = document.getElementById('modalTitle');
        const passwordGroup = document.getElementById('passwordGroup');
        const form = document.getElementById('userForm');
        
        if (title) title.textContent = 'Создание пользователя';
        if (passwordGroup) passwordGroup.style.display = 'none';
        if (form) form.reset();
        
        if (modal) modal.style.display = 'flex';
    }

    async handleUserSubmit(e) {
        e.preventDefault();
        
        const userData = {
            full_name: document.getElementById('fullName')?.value.trim(),
            email: document.getElementById('email')?.value.trim(),
            phone: document.getElementById('phone')?.value.trim(),
            role_id: parseInt(document.getElementById('roleId')?.value)
        };

        if (!userData.full_name) {
            this.showToast('Введите ФИО', 'error');
            return;
        }
        if (!userData.email) {
            this.showToast('Введите Email', 'error');
            return;
        }

        await this.createUser(userData);
    }

    async createUser(userData) {
        try {
            this.showToast('Создание пользователя...', 'info');
            
            const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(userData)
            });

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Ошибка создания пользователя');
            }

            if (result.email_sent) {
                this.showToast(`✅ Пользователь создан. Пароль отправлен на email: ${userData.email}`, 'success');
            } else {
                this.showToast(`⚠️ Пользователь создан, но email не отправлен. Пароль: ${result.generated_password || 'смотрите в логах'}`, 'warning');
            }
            
            this.closeAllModals();
            await this.loadUsers();
        } catch (error) {
            console.error('Create user error:', error);
            this.showToast(error.message, 'error');
        }
    }

    async banUser(userId, userName) {
        this.currentAction = 'ban';
        this.selectedUserId = userId;
        
        const confirmModal = document.getElementById('confirmModal');
        const confirmMessage = document.getElementById('confirmMessage');
        
        if (confirmMessage) {
            confirmMessage.textContent = `Заблокировать пользователя "${userName}"? Он не сможет заходить в систему.`;
        }
        
        if (confirmModal) confirmModal.style.display = 'flex';
    }

    async restoreUser(userId, userName) {
        this.currentAction = 'restore';
        this.selectedUserId = userId;
        
        const confirmModal = document.getElementById('confirmModal');
        const confirmMessage = document.getElementById('confirmMessage');
        
        if (confirmMessage) {
            confirmMessage.textContent = `Восстановить пользователя "${userName}"? Он сможет заходить в систему.`;
        }
        
        if (confirmModal) confirmModal.style.display = 'flex';
    }

    async executeAction() {
        if (!this.currentAction || !this.selectedUserId) return;

        try {
            let response;
            if (this.currentAction === 'ban') {
                response = await fetch(`/api/admin/users/${this.selectedUserId}/ban`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
            } else if (this.currentAction === 'restore') {
                response = await fetch(`/api/admin/users/${this.selectedUserId}/restore`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
            } else {
                return;
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка выполнения действия');
            }

            this.showToast(this.currentAction === 'ban' ? '✅ Пользователь заблокирован' : '✅ Пользователь восстановлен', 'success');
            this.closeAllModals();
            await this.loadUsers();
        } catch (error) {
            console.error('Action error:', error);
            this.showToast(error.message, 'error');
        } finally {
            this.currentAction = null;
            this.selectedUserId = null;
        }
    }

    closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });
    }

    getRoleBadge(roleId) {
        const roles = {
            1: { name: 'Клиент', class: 'role-user' },
            2: { name: 'Оператор', class: 'role-operator' },
            3: { name: 'Эксперт', class: 'role-expert' },
            4: { name: 'Администратор', class: 'role-admin' }
        };
        const role = roles[roleId] || { name: 'Неизвестно', class: '' };
        return `<span class="role-badge ${role.class}">${role.name}</span>`;
    }

    getStatusBadge(isActive, isDeleted) {
        if (isDeleted) {
            return '<span class="status-badge status-deleted">🗑 Удалён</span>';
        }
        if (!isActive) {
            return '<span class="status-badge status-banned">⛔ Заблокирован</span>';
        }
        return '<span class="status-badge status-active">✅ Активен</span>';
    }

    showLoading() {
        const tbody = document.getElementById('usersTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" class="loading-row">⏳ Загрузка пользователей...<\/td></tr>';
        }
    }

    showToast(message, type = 'success') {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = '✅';
        if (type === 'error') icon = '❌';
        if (type === 'warning') icon = '⚠️';
        if (type === 'info') icon = 'ℹ️';
        
        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
        
        let bgColor = '#10b981';
        if (type === 'error') bgColor = '#ef4444';
        if (type === 'warning') bgColor = '#f59e0b';
        if (type === 'info') bgColor = '#3b82f6';
        
        toast.style.cssText = `
            background: ${bgColor};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            margin-bottom: 10px;
            display: flex;
            gap: 10px;
            align-items: center;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Инициализация
let adminUsers = null;
let adminUsersInstance = null;

window.initAdminUsers = function() {
    if (adminUsersInstance) {
        adminUsersInstance.loadUsers();
    } else {
        adminUsersInstance = new AdminUsersManager();
        adminUsers = adminUsersInstance;
        window.adminUsers = adminUsersInstance;
    }
};

window.adminUsers = null;
window.adminUsersInstance = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.initAdminUsers();
    });
} else {
    window.initAdminUsers();
}

// Добавляем стили
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    .toast-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
    }
    .action-buttons {
        display: flex;
        gap: 8px;
    }
    .action-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 18px;
        padding: 4px 8px;
        border-radius: 6px;
        transition: all 0.2s;
    }
    .action-ban:hover {
        background: #fee2e2;
        transform: scale(1.1);
    }
    .action-restore:hover {
        background: #dcfce7;
        transform: scale(1.1);
    }
    .role-badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
    }
    .role-admin { background: #e0e7ff; color: #4338ca; }
    .role-operator { background: #d1fae5; color: #065f46; }
    .role-expert { background: #fef3c7; color: #92400e; }
    .role-user { background: #e2e3e5; color: #383d41; }
    .status-badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
    }
    .status-active { background: #d1fae5; color: #065f46; }
    .status-banned { background: #fee2e2; color: #991b1b; }
    .status-deleted { background: #e5e7eb; color: #4b5563; }
    .loading-row {
        text-align: center;
        padding: 40px;
        color: #6b7280;
    }
`;
document.head.appendChild(style);