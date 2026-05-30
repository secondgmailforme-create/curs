// Скрипт для дашборда оператора - статистика и последние заявки

async function getOperatorDashboardStats() {
    const url = "/api/operator/tickets";
    const urlRating = "/api/ratings/operator/stats";

    try {
        const count = document.getElementById('counttickets');
        const work = document.getElementById('worktickets');
        const weeklyTrend = document.getElementById('mintime');
        const resolved = document.getElementById('successtic');
        const war = document.getElementById('wartick');
        const pro = document.getElementById('process');
        const time = document.getElementById('timetickets');
        const ai = document.getElementById('aitickets');

        const ratingValue = document.getElementById('ratingvalue');
        const ratingComment = document.getElementById('ratingcomment');

        if (!count || !work || !weeklyTrend || !resolved || !war || !pro || !time || !ai) return;

        ai.innerHTML = 'AI ускоряет ответ';

        // Загрузка рейтинга оператора
        if (ratingValue && ratingComment) {
            try {
                const ratingResponse = await fetch(urlRating, { credentials: 'include' });
                if (ratingResponse.ok) {
                    const ratingData = await ratingResponse.json();
                    const data = ratingData.data || ratingData;
                    if (data.average_rating) {
                        ratingValue.innerHTML = `${Number(data.average_rating).toFixed(1)} ⭐`;
                        ratingValue.style.color = data.average_rating >= 4 ? 'green' : (data.average_rating >= 3 ? 'orange' : 'red');
                        ratingComment.innerHTML = data.total_ratings ? `${data.total_ratings} оценок` : 'Нет оценок';
                    } else {
                        ratingValue.innerHTML = '—';
                        ratingComment.innerHTML = 'Нет оценок';
                    }
                } else {
                    ratingValue.innerHTML = '—';
                    ratingComment.innerHTML = 'Нет оценок';
                }
            } catch (ratingError) {
                ratingValue.innerHTML = '—';
                ratingComment.innerHTML = 'Ошибка';
            }
        }

        // Получение всех заявок оператора
        const ticketsResponse = await fetch(url, { credentials: 'include' });
        let tickets = [];
        if (ticketsResponse.ok) {
            try {
                const result = await ticketsResponse.json();
                tickets = result.data || [];
                if (!Array.isArray(tickets)) tickets = [];
            } catch (e) {
                tickets = [];
            }
        }

        // Устанавливаем общее количество заявок
        count.innerHTML = tickets.length;
        weeklyTrend.innerHTML = tickets.length + ' всего';
        weeklyTrend.style.color = 'black';

        let workCount = 0;
        let resolvedCount = 0;

        // Вычисление среднего времени
        const resolvedTickets = tickets.filter(t => t.resolved_at);
        if (resolvedTickets.length > 0) {
            const totalMinutes = resolvedTickets.reduce((acc, t) => {
                const created = new Date(t.created_at);
                const resolvedDate = new Date(t.resolved_at);
                return acc + (resolvedDate - created) / 60000;
            }, 0);
            const avg = Math.round(totalMinutes / resolvedTickets.length);
            time.innerHTML = `${avg} мин`;
            ai.style.color = avg > 60 ? 'red' : 'green';
        } else {
            time.innerHTML = `0 мин`;
            ai.style.color = 'green';
        }

        // Подсчёт статусов
        tickets.forEach(ticket => {
            const statusId = ticket.status_id;
            if ([2].includes(statusId)) {
                workCount++;
            } else if (statusId === 7) {
                resolvedCount++;
            }
        });

        // Процент успеха
        if (workCount !== 0) {
            const totalActive = workCount + resolvedCount;
            const successRate = Math.round((resolvedCount * 100) / totalActive);
            pro.innerHTML = `${successRate}% успеха`;
            pro.style.color = successRate >= 50 ? 'green' : 'red';
        } else {
            pro.innerHTML = '0% успеха';
            pro.style.color = 'red';
        }

        // Внимание
        if (workCount !== 0) {
            war.innerHTML = 'Требуют внимания';
            war.style.color = 'red';
        } else {
            war.innerHTML = 'Все хорошо';
            war.style.color = 'green';
        }

        resolved.innerHTML = resolvedCount;
        work.innerHTML = workCount;

    } catch (error) {
        console.error('OperatorDashboard: Stats error', error);

        // Сброс всех значений при ошибке
        const elements = ['successtic', 'worktickets', 'counttickets', 'process', 'timetickets'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '0';
        });

        const aiEl = document.getElementById('aitickets');
        if (aiEl) aiEl.innerHTML = 'AI ускоряет ответ';

        const warEl = document.getElementById('wartick');
        if (warEl) {
            warEl.style.color = 'green';
            warEl.innerHTML = 'Все хорошо';
        }
    }
}

async function getOperatorDashboardTickets() {
    const url = "/api/operator/tickets";
    const table = document.getElementById('tabletick');
    if (!table) return;
    
    try {
        const response = await fetch(url, { credentials: 'include' });
        const result = await response.json();
        let data = result.data || [];

        if (!Array.isArray(data)) data = [];

        const sortedTickets = [...data].sort((a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
        );
        const lastThree = sortedTickets.slice(0, 3);
        table.innerHTML = '';
        
        if (lastThree.length > 0) {
            lastThree.forEach(ticket => {
                const idtable = document.createElement('tr');
                idtable.classList.add('tabletickgop');
                idtable.setAttribute('data-ticket-id', ticket.id);
                const createdDate = new Date(ticket.created_at).toLocaleString();
                let statusText = '';
                let statusClass = '';
                
                switch (ticket.status_id) {
                    case 1:
                        statusText = 'Новая';
                        statusClass = 'status new';
                        break;
                    case 2:
                        statusText = 'В работе (оператор)';
                        statusClass = 'status progress';
                        break;
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
                    default:
                        statusText = 'Неизвестно';
                        statusClass = '';
                }
                
                idtable.innerHTML = `
                    <td>${escapeHtml(String(ticket.id))}</td>
                    <td>${escapeHtml(ticket.title || '-')}</td>
                    <td>${escapeHtml(ticket.description ? ticket.description.substring(0, 50) : '—')}${ticket.description && ticket.description.length > 50 ? '...' : ''}</td>
                    <td>${escapeHtml(createdDate)}</td>
                    <td>${escapeHtml(ticket.category_name || '—')}</td>
                    <td><span class="${statusClass}">${escapeHtml(statusText)}</span></td>
                `;
                table.appendChild(idtable);
                idtable.addEventListener('click', () => {
                    if (window.showTicketModal) {
                        window.showTicketModal(ticket.id);
                    }
                });
                idtable.style.cursor = 'pointer';
            });
            
            if (data.length > 3) {
                const button = document.createElement('tr');
                button.className = 'more-row';
                button.innerHTML = `
                    <td colspan="6" style="text-align: center;">
                        <a href="/OPERATOR-MY-TICKETS" class="more-link" data-page="operator-my-tickets" data-i18n="allTicketsLink">Все заявки</a>
                    </td>
                `;
                table.appendChild(button);
                
                if (window.applyTranslations) {
                    const currentLang = localStorage.getItem('settings_language') || 'ru';
                    window.applyTranslations(currentLang);
                }
            }
        } else {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="6" style="text-align: center;">У вас пока нет заявок</td>`;
            table.appendChild(row);
        }
    } catch (error) {
        console.error('OperatorDashboard: Tickets error', error);
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="6" style="text-align: center; color: red;">Ошибка загрузки заявок</td>`;
        table.appendChild(row);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.getOperatorDashboardStats = getOperatorDashboardStats;
window.getOperatorDashboardTickets = getOperatorDashboardTickets;