// admin-logs.js - Управление системными логами
(async function() {
    try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (!response.ok) throw new Error('Not authorized');
        
        const data = await response.json();
        const user = data.user;
        
        // Если пользователь не админ (role_id !== 4) - не инициализируем скрипт
        if (!user || user.role_id !== 4) {
            console.log('AdminLogs: Skipped - user is not an admin (role_id:', user?.role_id, ')');
            return;
        }
        
        // Если админ - запускаем инициализацию
        console.log('AdminLogs: Admin detected, initializing...');
        initAdminLogs();
        
    } catch (error) {
        console.error('AdminLogs: Auth check failed', error);
    }
})();

// --- КЛАСС AdminLogsManager ---
class AdminLogsManager {
    constructor() {
        this.logs = [];
        this.filteredLogs = [];
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.currentPageLogs = [];
        this.filters = {
            startDate: null,
            endDate: null,
            action: 'all',
            search: ''
        };
        
        this.init();
    }

    async init() {
        this.recreateEventElements();
        this.initDateFilters();
        await this.loadLogs();
        this.bindEvents();
    }

    recreateEventElements() {
        const refreshBtn = document.getElementById('refreshLogs');
        if (refreshBtn) {
            const newBtn = refreshBtn.cloneNode(true);
            refreshBtn.parentNode.replaceChild(newBtn, refreshBtn);
        }

        const exportBtn = document.getElementById('exportLogs');
        if (exportBtn) {
            const newBtn = exportBtn.cloneNode(true);
            exportBtn.parentNode.replaceChild(newBtn, exportBtn);
        }

        const applyBtn = document.getElementById('applyFilters');
        if (applyBtn) {
            const newBtn = applyBtn.cloneNode(true);
            applyBtn.parentNode.replaceChild(newBtn, applyBtn);
        }

        const resetBtn = document.getElementById('resetFilters');
        if (resetBtn) {
            const newBtn = resetBtn.cloneNode(true);
            resetBtn.parentNode.replaceChild(newBtn, resetBtn);
        }
    }

    bindEvents() {
        const refreshBtn = document.getElementById('refreshLogs');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadLogs(true));
        }

        const exportBtn = document.getElementById('exportLogs');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportLogs());
        }

        const applyBtn = document.getElementById('applyFilters');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.applyFilters());
        }

        const resetBtn = document.getElementById('resetFilters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetFilters());
        }

        const searchInput = document.getElementById('searchLogs');
        if (searchInput) {
            searchInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') this.applyFilters();
            });
        }

        const actionFilter = document.getElementById('filterAction');
        if (actionFilter) {
            actionFilter.addEventListener('change', () => this.applyFilters());
        }

        const startDate = document.getElementById('filterStartDate');
        const endDate = document.getElementById('filterEndDate');
        if (startDate) {
            startDate.addEventListener('change', () => this.applyFilters());
        }
        if (endDate) {
            endDate.addEventListener('change', () => this.applyFilters());
        }

        const closeModalBtn = document.querySelector('#logDetailModal .modal-close');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => this.closeModals());
        }
        
        const modal = document.getElementById('logDetailModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModals();
            });
        }
    }

    resetFilters() {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        const startInput = document.getElementById('filterStartDate');
        const endInput = document.getElementById('filterEndDate');
        const actionSelect = document.getElementById('filterAction');
        const searchInput = document.getElementById('searchLogs');
        
        if (startInput) startInput.value = this.formatDateTimeLocal(startDate);
        if (endInput) endInput.value = this.formatDateTimeLocal(endDate);
        if (actionSelect) actionSelect.value = 'all';
        if (searchInput) searchInput.value = '';
        
        this.filters.startDate = startDate;
        this.filters.endDate = endDate;
        this.filters.action = 'all';
        this.filters.search = '';
        
        this.applyFilters();
    }

    initDateFilters() {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const startInput = document.getElementById('filterStartDate');
        const endInput = document.getElementById('filterEndDate');

        if (startInput && !startInput.value) {
            startInput.value = this.formatDateTimeLocal(startDate);
            this.filters.startDate = startDate;
        } else if (startInput && startInput.value) {
            this.filters.startDate = new Date(startInput.value);
        }

        if (endInput && !endInput.value) {
            endInput.value = this.formatDateTimeLocal(endDate);
            this.filters.endDate = endDate;
        } else if (endInput && endInput.value) {
            this.filters.endDate = new Date(endInput.value);
        }
    }

    formatDateTimeLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    async loadLogs(showToast = false) {
        try {
            this.showLoading();
            
            const response = await fetch('/api/admin/logs?limit=10000&offset=0', {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Ошибка загрузки логов');

            const result = await response.json();
            
            this.logs = result.data || result;
            
            if (!Array.isArray(this.logs)) {
                this.logs = [];
            }
            
            console.log(`Loaded ${this.logs.length} logs`);
            
            this.applyFilters();
            
            if (showToast) {
                this.showToast('Логи обновлены', 'success');
            }
        } catch (error) {
            console.error('Load logs error:', error);
            this.showToast('Ошибка загрузки логов', 'error');
            this.logs = [];
            this.filteredLogs = [];
            this.renderTable([]);
        }
    }

    applyFilters() {
        const startInput = document.getElementById('filterStartDate');
        const endInput = document.getElementById('filterEndDate');
        const actionSelect = document.getElementById('filterAction');
        const searchInput = document.getElementById('searchLogs');

        if (startInput && startInput.value) {
            this.filters.startDate = new Date(startInput.value);
        }
        if (endInput && endInput.value) {
            this.filters.endDate = new Date(endInput.value);
        }
        this.filters.action = actionSelect?.value || 'all';
        this.filters.search = searchInput?.value.toLowerCase() || '';

        console.log('Applying filters:', this.filters);

        this.filteredLogs = this.logs.filter(log => {
            if (this.filters.startDate && this.filters.endDate) {
                const logDate = new Date(log.created_at);
                const start = new Date(this.filters.startDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(this.filters.endDate);
                end.setHours(23, 59, 59, 999);
                
                if (logDate < start || logDate > end) return false;
            }

            const action = (log.action || '').toLowerCase();
            if (this.filters.action !== 'all' && action !== this.filters.action) return false;

            if (this.filters.search) {
                const searchText = `${log.action} ${log.entity_type} ${log.entity_id}`.toLowerCase();
                if (!searchText.includes(this.filters.search)) return false;
            }

            return true;
        });

        console.log(`Filtered logs: ${this.filteredLogs.length} of ${this.logs.length}`);

        this.filteredLogs.sort((a, b) => {
            return new Date(b.created_at) - new Date(a.created_at);
        });

        this.currentPage = 1;
        this.updateStats();
        this.render();
    }

    updateStats() {
        const total = this.filteredLogs.length;
        
        const actionCounts = {};
        this.filteredLogs.forEach(log => {
            const action = log.action || 'unknown';
            actionCounts[action] = (actionCounts[action] || 0) + 1;
        });

        const elements = {
            totalLogsCount: total,
            createCount: (actionCounts.create_ticket || 0) + (actionCounts.register || 0),
            loginCount: actionCounts.login || 0,
            banCount: actionCounts.ban_user || 0,
            assignExpertCount: actionCounts.assign_expert || 0,
            escalateCount: actionCounts.escalate_ticket || 0,
            completeCount: actionCounts.complete_ticket || 0,
            changePasswordCount: actionCounts.change_password || 0
        };

        for (const [id, value] of Object.entries(elements)) {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        }
    }

    getActionBadge(action) {
        const badges = {
            'create_ticket': 'Создание заявки',
            'login': 'Вход в систему',
            'register': 'Регистрация',
            'ban_user': 'Блокировка',
            'restore_user': 'Восстановление',
            'assign_operator': 'Назначение оператора',
            'transfer_to_expert': 'Передача эксперту',
            'assign_expert': 'Назначение эксперта',
            'resolve_ticket': 'Решение заявки',
            'reopen_ticket': 'Переоткрытие',
            'complete_ticket': 'Завершение админом',
            'escalate_ticket': 'Эскалация админу',
            'change_password': 'Смена пароля'
        };
        return `<span class="action-badge">${badges[action] || action || 'Неизвестно'}</span>`;
    }

    getActionDescription(log) {
        const actionMap = {
            'create_ticket': `Создана заявка #${log.entity_id}`,
            'login': `Вход в систему`,
            'register': `Регистрация нового пользователя`,
            'ban_user': `Заблокирован пользователь #${log.entity_id}`,
            'restore_user': `Восстановлен пользователь #${log.entity_id}`,
            'assign_operator': `Назначен оператор на заявку #${log.entity_id}`,
            'transfer_to_expert': `Заявка #${log.entity_id} передана эксперту`,
            'assign_expert': `Назначен эксперт на заявку #${log.entity_id}`,
            'resolve_ticket': `Заявка #${log.entity_id} решена`,
            'reopen_ticket': `Заявка #${log.entity_id} переоткрыта`,
            'complete_ticket': `Заявка #${log.entity_id} завершена администратором`,
            'escalate_ticket': `Заявка #${log.entity_id} эскалирована администратору`,
            'change_password': `Смена пароля пользователем`
        };
        return actionMap[log.action] || `${log.action || 'Действие'} (${log.entity_type}: ${log.entity_id})`;
    }

    render() {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const pageLogs = this.filteredLogs.slice(start, end);
        
        this.renderTable(pageLogs);
        this.renderPagination();
        this.currentPageLogs = pageLogs;
    }

    renderTable(logs) {
        const tbody = document.getElementById('logsTableBody');
        if (!tbody) return;

        if (logs.length === 0) {
            tbody.innerHTML = '<table><td colspan="5" class="loading-row">📭 Логи не найдены<\/td></tr>';
            return;
        }

        tbody.innerHTML = logs.map((log, index) => {
            const action = log.action || 'unknown';
            const timestamp = log.created_at;
            const description = this.getActionDescription(log);
            const user = log.user_email || `ID: ${log.user_id || '-'}`;
            const details = `${log.entity_type || '-'}: #${log.entity_id || '-'}`;

            return `
                <tr data-log-index="${index}" class="log-row">
                    <td>${this.getActionBadge(action)}<\/td>
                    <td>${this.formatDate(timestamp)}<\/td>
                    <td class="log-description" title="${this.escapeHtml(description)}">${this.truncate(this.escapeHtml(description), 80)}<\/td>
                    <td>${this.escapeHtml(user)}<\/td>
                    <td>${this.escapeHtml(details)}<\/td>
                 \n            `;
        }).join('');
        
        const rows = tbody.querySelectorAll('.log-row');
        rows.forEach((row, idx) => {
            row.addEventListener('click', () => {
                const log = logs[idx];
                if (log) this.showLogDetailModal(log);
            });
            row.style.cursor = 'pointer';
        });
    }

    renderPagination() {
        const container = document.getElementById('logsPagination');
        if (!container) return;

        const totalPages = Math.ceil(this.filteredLogs.length / this.itemsPerPage);
        
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
            <button class="pagination-btn prev-page" ${this.currentPage === 1 ? 'disabled' : ''}>←</button>
            ${pages.map(page => `
                <button class="pagination-btn page-num ${page === this.currentPage ? 'active' : ''}" data-page="${page}">${page}</button>
            `).join('')}
            <button class="pagination-btn next-page" ${this.currentPage === totalPages ? 'disabled' : ''}>→</button>
        `;
        
        const prevBtn = container.querySelector('.prev-page');
        const nextBtn = container.querySelector('.next-page');
        const pageBtns = container.querySelectorAll('.page-num');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        }
        pageBtns.forEach(btn => {
            btn.addEventListener('click', () => this.goToPage(parseInt(btn.dataset.page)));
        });
    }

    goToPage(page) {
        this.currentPage = page;
        this.render();
    }

    showLogDetailModal(log) {
        const modal = document.getElementById('logDetailModal');
        if (!modal) return;

        const actionName = this.getActionDescription(log);
        const timestamp = log.created_at;
        const user = log.user_email || `ID: ${log.user_id || '-'}`;
        const entityType = log.entity_type || '-';
        const entityId = log.entity_id || '-';
        const oldData = log.old_data ? JSON.stringify(log.old_data, null, 2) : 'Нет данных';
        const newData = log.new_data ? JSON.stringify(log.new_data, null, 2) : 'Нет данных';

        document.getElementById('detailAction').textContent = actionName;
        document.getElementById('detailTime').textContent = this.formatDate(timestamp);
        document.getElementById('detailUser').textContent = user;
        document.getElementById('detailEntityType').textContent = entityType;
        document.getElementById('detailEntityId').textContent = entityId;
        
        const oldDataEl = document.getElementById('detailOldData');
        if (oldDataEl) oldDataEl.textContent = oldData;
        
        const newDataEl = document.getElementById('detailNewData');
        if (newDataEl) newDataEl.textContent = newData;

        modal.style.display = 'flex';
    }

    async exportLogs() {
        try {
            const exportData = this.filteredLogs.map(log => ({
                id: log.id,
                user_id: log.user_id,
                action: log.action,
                entity_type: log.entity_type,
                entity_id: log.entity_id,
                created_at: log.created_at,
                old_data: log.old_data,
                new_data: log.new_data
            }));

            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `logs-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showToast(`Экспортировано ${exportData.length} записей`, 'success');
        } catch (error) {
            console.error('Export logs error:', error);
            this.showToast('Ошибка экспорта логов', 'error');
        }
    }

    showLoading() {
        const tbody = document.getElementById('logsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading-row">⏳ Загрузка логов...<\/td></tr>';
        }
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch {
            return '-';
        }
    }

    truncate(text, length) {
        if (!text) return '-';
        if (text.length <= length) return text;
        return text.substring(0, length) + '...';
    }

    closeModals() {
        const modal = document.getElementById('logDetailModal');
        if (modal) modal.style.display = 'none';
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
        
        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
        
        let bgColor = '#10b981';
        if (type === 'error') bgColor = '#ef4444';
        if (type === 'warning') bgColor = '#f59e0b';
        
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
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Инициализация
let adminLogsManager = null;

function initAdminLogs() {
    if (adminLogsManager) {
        adminLogsManager = null;
    }
    adminLogsManager = new AdminLogsManager();
}

