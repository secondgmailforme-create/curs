// Скрипт для дашборда эксперта - статистика и последние заявки

async function getExpertDashboardStats() {
    const url = "/api/expert/tickets";
    const urlRating = "/api/ratings/expert/stats";
    
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

        if (!count || !work || !weeklyTrend || !resolved || !war || !pro || !time || !ai) {
            console.warn('Some dashboard elements not found');
            return;
        }

        ai.innerHTML = 'AI ускоряет ответ';

        // Загрузка рейтинга эксперта
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
                console.warn('Failed to load rating:', ratingError);
                ratingValue.innerHTML = '—';
                ratingComment.innerHTML = 'Ошибка';
            }
        }

        // Получение всех заявок эксперта
        const ticketsResponse = await fetch(url, { credentials: 'include' });
        let tickets = [];
        if (ticketsResponse.ok) {
            try {
                const result = await ticketsResponse.json();
                tickets = result.data || [];
                if (!Array.isArray(tickets)) {
                    console.warn('Tickets response is not an array');
                    tickets = [];
                }
            } catch (e) {
                console.warn('Failed to parse tickets JSON:', e);
                tickets = [];
            }
        }

       
        // Статусы эксперта:5 (В работе у эксперта), 7 (Решена)
        const EXPERT_STATUSES = [5,7];
        const expertTickets = tickets.filter(ticket => 
            ticket.expert_id !== null && EXPERT_STATUSES.includes(ticket.status_id)
        );
        
        // Устанавливаем общее количество заявок (только экспертные)
        count.innerHTML = expertTickets.length;

        let workCount = 0;      // Статус 5 - В работе у эксперта
        let resolvedCount = 0;  // Статус 7 - Решена
        

        // Вычисление среднего времени
        const resolvedTickets = expertTickets.filter(t => t.resolved_at && t.status_id === 7);
        if (resolvedTickets.length > 0) {
            const totalMinutes = resolvedTickets.reduce((acc, t) => {
                const created = new Date(t.created_at);
                const resolvedDate = new Date(t.resolved_at);
                return acc + (resolvedDate - created) / 60000;
            }, 0);
            const avg = Math.round(totalMinutes / resolvedTickets.length);
            time.innerHTML = `${avg} мин`;
            time.style.color = avg > 60 ? 'red' : 'green';
            ai.style.color = avg > 60 ? 'red' : 'green';
        } else {
            time.innerHTML = `0 мин`;
            time.style.color = 'black';
            ai.style.color = 'green';
        }

        // Подсчёт статусов ТОЛЬКО среди заявок эксперта
        expertTickets.forEach(ticket => {
            const statusId = ticket.status_id;
            if (statusId === 5) {  // В работе (эксперт)
                workCount++;
            } else if (statusId === 7) {  // Решена
                resolvedCount++;
            }
        });

        // Процент успеха (только решённые от всех экспертных)
        const totalExpertTickets = workCount + resolvedCount;
        if (totalExpertTickets > 0) {
            const successRate = Math.round((resolvedCount * 100) / totalExpertTickets);
            pro.innerHTML = `${successRate}% успеха`;
            pro.style.color = successRate >= 50 ? 'green' : 'red';
        } else {
            pro.innerHTML = '0% успеха';
            pro.style.color = 'red';
        }

        // Внимание (есть активные заявки или ожидающие)
        if (workCount > 0) {
            war.innerHTML = 'Требуют внимания';
            war.style.color = 'red';
        } else {
            war.innerHTML = 'Все хорошо';
            war.style.color = 'green';
        }

        resolved.innerHTML = resolvedCount;
        work.innerHTML = workCount;

    } catch (error) {
        console.error('Ошибка getExpertDashboardStats:', error);

        // Сброс всех значений при ошибке
        const elements = ['successtic', 'worktickets', 'counttickets', 'process', 'timetickets'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '0';
        });

        const weeklyEl = document.getElementById('mintime');
        if (weeklyEl) weeklyEl.innerHTML = '0 за неделю';

        const aiEl = document.getElementById('aitickets');
        if (aiEl) aiEl.innerHTML = 'AI ускоряет ответ';

        const warEl = document.getElementById('wartick');
        if (warEl) {
            warEl.style.color = 'green';
            warEl.innerHTML = 'Все хорошо';
        }
    }
}

async function getExpertDashboardTickets() {
    const url = "/api/expert/tickets";
    const table = document.getElementById('tabletick');
    if (!table) {
        console.warn('Table element not found');
        return;
    }
    try {
        const response = await fetch(url, { credentials: 'include' });
        const result = await response.json();
        let data = result.data || [];

        if (!Array.isArray(data)) {
            console.warn('Tickets response is not an array');
            data = [];
        }

        
        const EXPERT_STATUSES = [5];
        const expertTickets = data.filter(ticket => 
            ticket.expert_id !== null && EXPERT_STATUSES.includes(ticket.status_id)
        );

        const sortedTickets = [...expertTickets].sort((a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
        );
        const lastThree = sortedTickets.slice(0, 3);
        table.innerHTML = '';
        
        if (lastThree.length > 0) {
            lastThree.forEach(ticket => {
                const idtable = document.createElement('tr');
                idtable.classList.add('tabletickgop');
                const createdDate = new Date(ticket.created_at).toLocaleString();
                let statusText = '';
                let statusClass = '';
                switch (ticket.status_id) {
                    case 5:
                        statusText = 'В работе (эксперт)';
                        statusClass = 'status progress';
                        break;
                    default:
                        statusText = 'Неизвестно';
                        statusClass = '';
                }
                idtable.innerHTML = `
                    <td>${ticket.id}</td>
                    <td>${ticket.title || '-'}</td>
                    <td>${ticket.description ? ticket.description.substring(0, 50) : '—'}${ticket.description && ticket.description.length > 50 ? '...' : ''}</td>
                    <td>${createdDate}</td>
                    <td>${ticket.category_name || ticket.category_id || '—'}</td>
                    <td><span class="${statusClass}">${statusText}</span></td>
                `;
                table.appendChild(idtable);
                idtable.addEventListener('click', () => {
                    if (window.openExpertChat) {
                        window.openExpertChat(ticket.id);
                    }
                });
                idtable.style.cursor = 'pointer';
            });
            
            if (expertTickets.length > 3) {
                const button = document.createElement('tr');
                button.innerHTML = `
                    <tr class="more-row">
                        <td colspan="6" style="text-align: center;">
                            <a href="/EXPERT-TICKETS" class="more-link" data-page="experttickets">Все заявки</a>
                        </td>
                    </tr>
                `;
                table.appendChild(button);
            }
        } else {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="6" style="text-align: center;">У вас пока нет заявок</td>`;
            table.appendChild(row);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="6" style="text-align: center; color: red;">Ошибка загрузки заявок</td>`;
        table.appendChild(row);
    }
}

window.getExpertDashboardStats = getExpertDashboardStats;
window.getExpertDashboardTickets = getExpertDashboardTickets;