// Модуль: Мои заявки эксперта (с вкладками)
(function() {
    // Конфигурация статусов для каждой вкладки - используем ID статусов как в dashboard
    const TAB_CONFIGS = {
        new: {
            statusIds: [4],  // 1 - Новая, 3 - Ожидает эксперта
            label: 'Ожидание'
        },
        inprogress: {
            statusIds: [5],  // 4 - В работе (эксперт)
            label: 'В работе'
        },
        completed: {
            statusIds: [7, 8],  // 5 - Решена, 6 - Отменена
            label: 'Завершенные'
        }
    };

    let allTickets = [];
    let currentTab = 'new';

    // Загрузка всех заявок эксперта
    async function loadExpertTickets() {
        try {
            const response = await fetch('/api/expert/tickets', { credentials: 'include' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const result = await response.json();
            allTickets = result.data || [];
            return true;
        } catch (error) {
            console.error('ExpertTickets: Load error', error);
            return false;
        }
    }

    // Фильтрация заявок по текущей вкладке
    function filterTicketsByTab(tabName) {
        const config = TAB_CONFIGS[tabName];
        if (!config) return [];
        return allTickets.filter(ticket => config.statusIds.includes(ticket.status_id));
    }

    // Подсчет количества заявок для каждой вкладки
    function updateTabCounts() {
        Object.keys(TAB_CONFIGS).forEach(tabName => {
            const count = filterTicketsByTab(tabName).length;
            const badgeEl = document.getElementById(`${tabName}-count`);
            if (badgeEl) badgeEl.textContent = count;
        });
    }
    
    function renderTicketCard(ticket, tabName) {
        const statusId = ticket.status_id;
        const createdAt = new Date(ticket.created_at).toLocaleString('ru-RU');
        
        let statusText = '';
        let statusClass = '';
        switch (statusId) {
            case 4:
                statusText = 'Ожидает эксперта';
                statusClass = 'status waiting';
                break;
            case 5:
                statusText = 'В работе (эксперт)';
                statusClass = 'status progress';
                break;
            case 7:
                statusText = 'Решена';
                statusClass = 'status done';
                break;
            case 8:
                statusText = 'Отменена';
                statusClass = 'status cancelled';
                break;
            default:
                statusText = 'Неизвестно';
                statusClass = '';
        }
        
        let actions = '';

        if (tabName === 'new') {
            actions = `
                <div style="display: flex; gap: 8px; margin-top: 12px;">
    
                    <button onclick="event.stopPropagation(); window.acceptTicketForExpert(${ticket.id}); return false;" class="btn-sm btn-success">
                        Принять в работу
                    </button>
                </div>
            `;
        } else if (tabName === 'inprogress') {
            actions = `
                <div style="display: flex; gap: 8px; margin-top: 12px;">
                    <button onclick="event.stopPropagation(); window.openExpertChatForTicket(${ticket.id}); return false;" class="btn-sm btn-primary">
                        💬 Открыть чат
                    </button>
                    <button onclick="event.stopPropagation(); window.completeTicketForExpert(${ticket.id}); return false;" class="btn-sm btn-success">
                        Завершить
                    </button>
                </div>
            `;
        } else if (tabName === 'completed') {
            actions = `
                <div style="display: flex; gap: 8px; margin-top: 12px;">
                    <button onclick="event.stopPropagation(); window.showTicketModal(${ticket.id}); return false;" class="btn-sm btn-info">
                        Просмотр
                    </button>
                </div>
            `;
        }

        return `
            <div class="ticket-card ${tabName}" style="margin-bottom: 16px; background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); cursor: pointer;" onclick="window.showTicketModal(${ticket.id})">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
                            <h3 style="margin: 0; font-size: 1rem;">#${escapeHtml(String(ticket.id))} ${escapeHtml(ticket.title || 'Без темы')}</h3>
                            <span class="${statusClass}" style="padding: 2px 8px; border-radius: 12px; font-size: 0.7rem;">${escapeHtml(statusText)}</span>
                        </div>
                        <p style="margin: 8px 0; color: #666; font-size: 0.85rem;">
                            Клиент: ${escapeHtml(ticket.client_name || ticket.client_email || 'Аноним')}
                        </p>
                        <p style="margin: 8px 0; color: #444; line-height: 1.4; font-size: 0.9rem;">
                            ${escapeHtml(ticket.description ? ticket.description.substring(0, 120) + (ticket.description.length > 120 ? '...' : '') : 'Нет описания')}
                        </p>
                        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                            <span style="font-size: 0.7rem; color: #999;">
                                ${escapeHtml(createdAt)}
                            </span>
                        </div>
                    </div>
                </div>
                ${actions}
            </div>
        `;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Глобальные функции для действий эксперта
    window.openExpertChatForTicket = function(ticketId) {
        const path = '/EXPERT-CHAT?ticketId=' + ticketId;
        if (typeof window.loadPage === 'function') {
            history.pushState({ page: 'expert-chat', ticketId: ticketId }, '', path);
            window.loadPage('expert-chat', ticketId);
        } else {
            window.location.href = path;
        }
    };

    window.acceptTicketForExpert = async function(ticketId) {
        if (!confirm('Принять заявку в работу?')) return;

        try {
            const response = await fetch(`/api/expert/tickets/${ticketId}/accept`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            if (response.ok) {
                alert('✅ Заявка принята в работу');
                window.loadCurrentTabTickets();
            } else {
                const error = await response.json();
                alert('❌ Ошибка: ' + (error.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('ExpertTickets: Accept error', error);
            alert('❌ Ошибка сети');
        }
    };

    window.completeTicketForExpert = async function(ticketId) {
        if (!confirm('✅ Завершить эту заявку?')) return;

        try {
            const response = await fetch(`/api/expert/tickets/${ticketId}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            if (response.ok) {
                alert('✅ Заявка завершена');
                window.loadCurrentTabTickets();
            } else {
                alert('❌ Ошибка при завершении заявки');
            }
        } catch (error) {
            console.error('ExpertTickets: Complete error', error);
            alert('❌ Ошибка сети');
        }
    };

    // Рендеринг списка заявок
    function renderTickets(tickets, tabName) {
        const container = document.getElementById('tickets-container');
        if (!container) return;

        if (tickets.length === 0) {
            const emptyMessages = {
                new: { title: 'Нет новых заявок', message: 'Нет заявок, ожидающих эксперта' },
                inprogress: { title: 'Нет заявок в работе', message: 'У вас нет активных заявок' },
                completed: { title: 'Нет завершенных заявок', message: 'Архив пуст' }
            };

            const msg = emptyMessages[tabName] || { title: 'Нет заявок', message: '' };

            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 40px; color: #999;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <h3>${escapeHtml(msg.title)}</h3>
                    <p>${escapeHtml(msg.message)}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = tickets.map(ticket => renderTicketCard(ticket, tabName)).join('');
    }

    // Загрузка заявок для текущей вкладки
    window.loadCurrentTabTickets = async function() {
        const container = document.getElementById('tickets-container');
        if (!container) return;

        container.innerHTML = '<div class="loading-spinner" style="text-align: center; padding: 40px;">Загрузка заявок...</div>';

        const success = await loadExpertTickets();
        if (!success) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 40px; color: red;">
                    <h3>Ошибка загрузки</h3>
                    <p>Не удалось получить данные. Попробуйте позже.</p>
                </div>
            `;
            return;
        }

        updateTabCounts();
        const filtered = filterTicketsByTab(currentTab);
        renderTickets(filtered, currentTab);
    };

    // Переключение вкладок
    window.switchTab = function(tabName) {
        currentTab = tabName;

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        const filtered = filterTicketsByTab(tabName);
        renderTickets(filtered, tabName);
    };

    // Инициализация при загрузке
    window.initMyTicketsModule = function() {
        window.loadCurrentTabTickets();

        if (typeof io !== 'undefined') {
            const socket = io({ transports: ['websocket', 'polling'] });

            socket.on('connect', () => {});
            socket.on('status_change', () => {
                window.loadCurrentTabTickets();
            });
            socket.on('new_message', () => {});
        }
    };
})();