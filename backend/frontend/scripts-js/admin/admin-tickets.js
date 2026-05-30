// Скрипт для отображения заявок, эскалированных экспертами администратору
window.loadAdminTickets = loadAdminTickets;
async function loadAdminTickets() {
    const ticketsContainer = document.getElementById('admin-tickets-list');
    const loadingIndicator = document.getElementById('admin-tickets-loading');

    if (!ticketsContainer) {
        console.error('AdminTickets: Container not found');
        return;
    }
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    ticketsContainer.innerHTML = '';

    try {
        const response = await fetch('/api/admin/escalated-tickets', { credentials: 'include' });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('API endpoint not implemented');
            }
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        const tickets = result.data || [];
        renderTickets(tickets, ticketsContainer);

    } catch (error) {
        console.error('AdminTickets: Load error', error);
        ticketsContainer.innerHTML = `
            <div class="error-message">
                <p>⚠️ ${error.message}</p>
                <p class="hint">Раздел в разработке. Ожидайте обновления бэкенда.</p>
            </div>
        `;
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

function renderTickets(tickets, container) {
    if (!tickets || tickets.length === 0) {
        container.innerHTML = '<div class="empty-state">Нет новых эскалаций от экспертов</div>';
        return;
    }

    tickets.forEach(ticket => {
        const ticketCard = document.createElement('div');
        ticketCard.className = 'ticket-card';
        ticketCard.innerHTML = `
            <div class="ticket-header">
                <span class="ticket-id">#${ticket.id}</span>
                <span class="badge badge-escalation">От эксперта</span>
                <span class="ticket-date">${new Date(ticket.created_at).toLocaleDateString()}</span>
            </div>
            <div class="ticket-body">
                <h3>${escapeHtml(ticket.title || ticket.subject || 'Без темы')}</h3>
                <p>${escapeHtml(ticket.description ? ticket.description.substring(0, 100) + '...' : 'Нет описания')}</p>
                <div class="ticket-meta">
                    <span>Клиент: ${escapeHtml(ticket.client_name || 'Аноним')}</span>
                    <span>Эксперт: ${escapeHtml(ticket.expert_name || 'Не назначен')}</span>
                </div>
            </div>
            <div class="ticket-footer">
                <button class="btn btn-primary" onclick="openAdminTicket(${ticket.id})">Разобрать</button>
            </div>
        `;
        container.appendChild(ticketCard);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.openAdminTicket = (id) => {
    // Переход на страницу чата админа
    const newPath = '/ADMIN-CHAT?ticketId=' + id;
    window.history.pushState({ page: 'admin-chat', ticketId: id }, '', newPath);

    // Загружаем чат
    if (window.loadPage) {
        window.loadPage('admin-chat', id);
    } else {
        window.location.href = newPath;
    }
};

// Запуск загрузки при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    loadAdminTickets();
});