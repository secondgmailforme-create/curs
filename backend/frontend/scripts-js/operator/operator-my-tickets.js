// ========== МОДУЛЬ: МОИ ЗАЯВКИ ОПЕРАТОРА ==========
(function() {
    // Конфигурация статусов для каждой вкладки
    const TAB_CONFIGS = {
        new: {
            statuses: ['new', 'новая'],
            status_ids: [1],
            label: 'Новые'
        },
        inprogress: {
            statuses: ['in_progress', 'operator_assigned', 'active', 'escalated'],
            status_ids: [2, 3, 5, 6],
            label: 'В работе'
        },
        completed: {
            statuses: ['resolved', 'closed', 'cancelled', 'completed'],
            status_ids: [7, 8],
            label: 'Завершенные'
        }
    };

    let allTickets = [];
    let currentTab = 'new';

    // Загрузка всех заявок
    async function loadTickets() {
        try {
            const response = await fetch('/api/operator/tickets', { 
                credentials: 'include' 
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            allTickets = Array.isArray(data) ? data : (data.data || data.tickets || []);
            return true;
        } catch (error) {
            console.error('Load tickets error:', error);
            return false;
        }
    }

    // Фильтрация заявок по текущей вкладке
    function filterTicketsByTab(tabName) {
        const config = TAB_CONFIGS[tabName];
        if (!config) return [];
        
        return allTickets.filter(ticket => {
            const statusId = ticket.status_id || ticket.status;
            return config.status_ids.includes(parseInt(statusId));
        });
    }

    // Подсчет количества заявок
    function updateTabCounts() {
        Object.keys(TAB_CONFIGS).forEach(tabName => {
            const config = TAB_CONFIGS[tabName];
            const count = allTickets.filter(ticket => {
                const statusId = ticket.status_id || ticket.status;
                return config.status_ids.includes(parseInt(statusId));
            }).length;

            const badgeEl = document.getElementById(`${tabName}-count`);
            if (badgeEl) badgeEl.textContent = count;
        });
    }

    // Обновление ползунка вкладок
    function updateTabSlider() {
        const tabsWrapper = document.querySelector('.tabs-wrapper');
        if (!tabsWrapper) return;
        
        let slider = document.querySelector('.tab-slider');
        if (!slider) {
            slider = document.createElement('div');
            slider.className = 'tab-slider';
            tabsWrapper.style.position = 'relative';
            tabsWrapper.appendChild(slider);
        }
        
        const activeBtn = document.querySelector('.tab-btn-modern.active');
        if (!activeBtn) return;
        
        const offsetLeft = activeBtn.offsetLeft;
        const width = activeBtn.offsetWidth;
        
        slider.style.cssText = `
            position: absolute;
            top: 6px;
            bottom: 6px;
            left: 0;
            background: linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%);
            border-radius: 12px;
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 1;
            box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);
            transform: translateX(${offsetLeft}px);
            width: ${width}px;
        `;
        
        // Поднимаем кнопки над ползунком
        const buttons = document.querySelectorAll('.tab-btn-modern');
        buttons.forEach(btn => {
            btn.style.position = 'relative';
            btn.style.zIndex = '2';
            btn.style.background = 'transparent';
        });
    }

    // Получение текста статуса
    function getStatusText(statusId) {
        const statuses = {
            1: 'Новая',
            2: 'В работе',
            3: 'Ожидает',
            4: 'Эскалирована',
            5: 'В работе',
            6: 'Передана',
            7: 'Решена',
            8: 'Закрыта'
        };
        return statuses[statusId] || 'Неизвестно';
    }

    // Рендеринг карточки
    function renderTicketCard(ticket, tabName) {
        const statusId = ticket.status_id || ticket.status;
        const createdAt = new Date(ticket.created_at).toLocaleString('ru-RU');
        const isNew = tabName === 'new';
        const isInProgress = tabName === 'inprogress';
        const isCompleted = tabName === 'completed';
        
        let actions = '';
        let icon = '';
        
        if (isNew) {
            actions = `
                <button onclick="event.stopPropagation(); window.acceptTicket(${ticket.id})" class="btn-action btn-accept">Принять</button>
            `;
        } else if (isInProgress) {
            actions = `
                <button onclick="event.stopPropagation(); window.openOperatorChat(${ticket.id})" class="btn-action btn-chat">💬 Чат</button>
                <button onclick="event.stopPropagation(); window.transferToExpert(${ticket.id})" class="btn-action btn-transfer">Эксперту</button>
                <button onclick="event.stopPropagation(); window.completeTicket(${ticket.id})" class="btn-action btn-accept">Завершить</button>
            `;
        } else if (isCompleted) {
            icon = '✅';
            actions = `
                <button onclick="event.stopPropagation(); window.showTicketModal(${ticket.id})" class="btn-action btn-view">Просмотр</button>
                <button onclick="event.stopPropagation(); window.reopenTicket(${ticket.id})" class="btn-action btn-transfer">Вернуть</button>
            `;
        }
        
        return `
            <div class="ticket-card ${tabName}" data-ticket-id="${ticket.id}" onclick="window.showTicketModal(${ticket.id})">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="flex: 1;">
                        <h3 style="margin: 0 0 8px 0; font-size: 18px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <span class="ticket-id">#${escapeHtml(String(ticket.id))}</span>
                            ${escapeHtml(ticket.title || ticket.subject || 'Без темы')}
                        </h3>
                        <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">
                            👤 Клиент: ${escapeHtml(ticket.client_name || ticket.user_email || 'Аноним')}
                        </p>
                        <p style="margin: 0 0 16px 0; color: #475569; line-height: 1.5;">
                            ${escapeHtml(ticket.description ? ticket.description.substring(0, 150) + (ticket.description.length > 150 ? '...' : '') : 'Нет описания')}
                        </p>
                        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                            <span class="status-badge-modern st-${statusId}">${escapeHtml(getStatusText(statusId))}</span>
                            <span style="font-size: 12px; color: #94a3b8;">📅 ${escapeHtml(createdAt)}</span>
                        </div>
                    </div>
                    <div style="font-size: 32px; opacity: 0.6;">${icon}</div>
                </div>
                <div class="action-buttons">${actions}</div>
            </div>
        `;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Рендеринг списка
    async function renderTickets() {
        const container = document.getElementById('tickets-container');
        if (!container) return;

        container.innerHTML = '<div class="loading-state"><div class="spinner"></div><span>Загрузка данных...</span></div>';

        const success = await loadTickets();
        if (!success) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <h3>Ошибка загрузки</h3>
                    <p>Не удалось получить данные. Попробуйте позже.</p>
                </div>
            `;
            return;
        }

        updateTabCounts();
        const filtered = filterTicketsByTab(currentTab);
        
        if (filtered.length === 0) {
            const emptyMessages = {
                new: { title: 'Нет новых заявок', message: 'Все новые заявки обработаны' },
                inprogress: { title: 'Нет заявок в работе', message: 'Активные заявки отсутствуют' },
                completed: { title: 'Нет завершенных заявок', message: 'Архив пуст' }
            };
            const msg = emptyMessages[currentTab];
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <h3>${msg.title}</h3>
                    <p>${msg.message}</p>
                </div>
            `;
            return;
        }

        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        container.innerHTML = filtered.map(ticket => renderTicketCard(ticket, currentTab)).join('');
    }

    // Переключение вкладок
    window.switchTab = function(tabName) {
        currentTab = tabName;
        
        // Обновляем активный класс на кнопках
        const tabs = document.querySelectorAll('.tab-btn-modern');
        tabs.forEach(tab => {
            if (tab.getAttribute('data-tab') === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Обновляем ползунок
        updateTabSlider();
        
        // Рендерим заявки
        renderTickets();
    };

    // Обновление списка
    window.loadCurrentTabTickets = function() {
        renderTickets();
    };

    // Действия с заявками
    window.acceptTicket = async function(ticketId) {
        if (!confirm('Принять заявку в работу?')) return;
        try {
            const response = await fetch(`/api/operator/tickets/${ticketId}/accept`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            if (response.ok) {
                alert('✅ Заявка принята');
                renderTickets();
            } else {
                alert('❌ Ошибка');
            }
        } catch (error) {
            console.error('Accept error:', error);
            alert('❌ Ошибка сети');
        }
    };

    window.transferToExpert = async function(ticketId) {
        if (!confirm('Передать заявку эксперту?')) return;
        try {
            const response = await fetch(`/api/operator/tickets/${ticketId}/transfer-expert`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            if (response.ok) {
                alert('✅ Заявка передана эксперту');
                renderTickets();
            } else {
                alert('❌ Ошибка');
            }
        } catch (error) {
            console.error('Transfer error:', error);
            alert('❌ Ошибка сети');
        }
    };

    window.completeTicket = async function(ticketId) {
        if (!confirm('Завершить заявку?')) return;
        try {
            const response = await fetch(`/api/operator/tickets/${ticketId}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            if (response.ok) {
                alert('✅ Заявка завершена');
                renderTickets();
            } else {
                alert('❌ Ошибка');
            }
        } catch (error) {
            console.error('Complete error:', error);
            alert('❌ Ошибка сети');
        }
    };

    window.reopenTicket = async function(ticketId) {
        if (!confirm('Вернуть заявку в работу?')) return;
        try {
            const response = await fetch(`/api/operator/tickets/${ticketId}/reopen`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            if (response.ok) {
                alert('✅ Заявка возвращена');
                renderTickets();
            } else {
                alert('❌ Ошибка');
            }
        } catch (error) {
            console.error('Reopen error:', error);
            alert('❌ Ошибка сети');
        }
    };

    window.openOperatorChat = function(ticketId) {
        const path = '/OPERATOR-CHAT?ticketId=' + ticketId;
        if (typeof window.loadPage === 'function') {
            window.loadPage('operator-chat', ticketId);
        } else {
            window.location.href = path;
        }
    };

    // Инициализация
    window.initMyTicketsModule = function() {
        // Навешиваем обработчики на кнопки
        const refreshBtn = document.querySelector('.btn-refresh-modern');
        if (refreshBtn) {
            refreshBtn.onclick = () => renderTickets();
        }
        
        // Навешиваем обработчики на вкладки
        const tabs = document.querySelectorAll('.tab-btn-modern');
        tabs.forEach(tab => {
            tab.onclick = (e) => {
                e.preventDefault();
                const tabName = tab.getAttribute('data-tab');
                if (tabName) window.switchTab(tabName);
            };
        });
        
        // Загружаем заявки
        renderTickets();
        
        // Обновляем ползунок при загрузке
        setTimeout(updateTabSlider, 100);
        
        // Обновляем ползунок при изменении размера окна
        window.addEventListener('resize', () => {
            setTimeout(updateTabSlider, 100);
        });
    };

    // Автозапуск
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.initMyTicketsModule());
    } else {
        window.initMyTicketsModule();
    }
})();