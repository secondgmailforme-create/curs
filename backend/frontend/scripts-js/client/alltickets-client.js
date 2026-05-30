// ========== ФУНКЦИЯ КОНВЕРТАЦИИ ДАТЫ ИЗ DD.MM.YYYY В YYYY-MM-DD ==========
function convertDateFormat(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('.');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return null;
}

// ========== ПАРСИНГ ДАТЫ ИЗ INPUT ==========
function parseDateFromInput() {
    const dateInput = document.getElementById('range-picker');
    if (!dateInput || !dateInput.value) {
        return { date_from: null, date_to: null };
    }
    
    let dateStr = dateInput.value.trim();
    
    // Поддерживаем разные разделители: em-dash, en-dash, hyphen, "to"
    const rangeMatch = dateStr.split(/\s*[—–-]\s*|\s+to\s+/i);
    
    if (rangeMatch.length === 2) {
        return {
            date_from: convertDateFormat(rangeMatch[0].trim()),
            date_to: convertDateFormat(rangeMatch[1].trim())
        };
    } else if (dateStr.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
        const singleDate = convertDateFormat(dateStr);
        return {
            date_from: singleDate,
            date_to: singleDate
        };
    }
    
    return { date_from: null, date_to: null };
}

// ========== ФИЛЬТРЫ ==========
let currentFilters = {
    category_id: 'all',
    status_id: 'all',
    date_from: null,
    date_to: null
};

// ========== ОСНОВНАЯ ФУНКЦИЯ ЗАГРУЗКИ ЗАЯВОК ==========
async function getALLListTicket() {
    const table = document.getElementById('tabletick');
    
    if (!table) return;
    
    // Получаем даты из input
    const dates = parseDateFromInput();
    
    currentFilters.date_from = dates.date_from;
    currentFilters.date_to = dates.date_to;
    
    // Собираем параметры
    const params = new URLSearchParams();
    
    if (currentFilters.category_id && currentFilters.category_id !== 'all') {
        params.append('category_id', currentFilters.category_id);
    }
    
    if (currentFilters.status_id && currentFilters.status_id !== 'all') {
        params.append('status_id', currentFilters.status_id);
    }
    
    if (currentFilters.date_from) {
        params.append('date_from', currentFilters.date_from);
    }
    
    if (currentFilters.date_to) {
        params.append('date_to', currentFilters.date_to);
    }
    
    const url = `/api/tickets/my${params.toString() ? '?' + params.toString() : ''}`;
    
    try {
        const response = await fetch(url, { credentials: 'include' });
        const tickets = await response.json();
        
        table.innerHTML = '';
        
        if (tickets.length > 0) {
            tickets.forEach(ticket => {
                const row = document.createElement('tr');
                row.classList.add('tabletickgop');
                row.setAttribute('data-ticket-id', ticket.id);
                const createdDate = new Date(ticket.created_at).toLocaleString();
                
                let statusText = '';
                let statusClass = '';
                switch (ticket.status_id) {
                    case 1: statusText = 'Новая'; statusClass = 'status new'; break;
                    case 2: statusText = 'В работе (оператор)'; statusClass = 'status progress'; break;
                    case 3: statusText = 'Ожидает оператора'; statusClass = 'status waiting'; break;
                    case 4: statusText = 'Ожидает эксперта'; statusClass = 'status waiting'; break;
                    case 5: statusText = 'В работе (эксперт)'; statusClass = 'status progress'; break;
                    case 6: statusText = 'Передана администратору'; statusClass = 'status progress'; break;
                    case 7: statusText = 'Решена'; statusClass = 'status done'; break;
                    case 8: statusText = 'Отменена'; break;
                    default: statusText = 'Неизвестно';
                }
                
                row.innerHTML = `
                    <td>${escapeHtml(String(ticket.id))}</td>
                    <td>${escapeHtml(ticket.title || '-')}</td>
                    <td>${escapeHtml(ticket.description ? ticket.description.substring(0, 50) : '—')}${ticket.description && ticket.description.length > 50 ? '...' : ''}</td>
                    <td>${escapeHtml(createdDate)}</td>
                    <td>${escapeHtml(ticket.category_name || '—')}</td>
                    <td><span class="${statusClass}">${escapeHtml(statusText)}</span></td>
                `;
                row.style.cursor = 'pointer';
                row.addEventListener('click', () => {
                    if (typeof showTicketModal === 'function') {
                        showTicketModal(ticket.id);
                    }
                });
                table.appendChild(row);
            });
        } else {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="6" style="text-align: center;">Заявки не найдены</td>`;
            table.appendChild(row);
        }
    } catch (error) {
        console.error('Tickets: Load error', error);
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

// ========== ФУНКЦИЯ ДЛЯ ОБНОВЛЕНИЯ ПОЛЗУНКА ВКЛАДОК ==========
function updateTabSlider(activeTabElement) {
    const tabsWrapper = document.querySelector('.tabs-wrapper');
    if (!tabsWrapper) return;
    
    let slider = document.querySelector('.tab-slider');
    
    // Создаем слайдер если его нет
    if (!slider) {
        slider = document.createElement('div');
        slider.className = 'tab-slider';
        tabsWrapper.style.position = 'relative';
        tabsWrapper.appendChild(slider);
    }
    
    // Получаем активную кнопку
    const activeBtn = activeTabElement || document.querySelector('.tab-btn-modern.active');
    if (!activeBtn) return;
    
    const offsetLeft = activeBtn.offsetLeft;
    const width = activeBtn.offsetWidth;
    
    slider.style.position = 'absolute';
    slider.style.top = '6px';
    slider.style.bottom = '6px';
    slider.style.background = 'linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)';
    slider.style.borderRadius = '12px';
    slider.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    slider.style.zIndex = '1';
    slider.style.boxShadow = '0 4px 12px rgba(168, 85, 247, 0.3)';
    
    slider.style.transform = `translateX(${offsetLeft}px)`;
    slider.style.width = `${width}px`;
}

// ========== ИНИЦИАЛИЗАЦИЯ КАСТОМНЫХ СЕЛЕКТОВ ==========
function initCustomSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const header = select.querySelector('.select-header');
    const optionsContainer = select.querySelector('.select-options');

    if (!header || !optionsContainer) return;

    const newHeader = header.cloneNode(true);
    header.parentNode.replaceChild(newHeader, header);
    
    const currentHeader = select.querySelector('.select-header');
    const currentOptions = select.querySelector('.select-options');
    const currentSelectedText = currentHeader.querySelector('.selected-text');

    currentHeader.addEventListener('click', (e) => {
        e.stopPropagation();
        
        document.querySelectorAll('.custom-select .select-options').forEach(opt => {
            if (opt !== currentOptions) opt.classList.remove('show');
        });
        document.querySelectorAll('.custom-select .select-header').forEach(h => {
            if (h !== currentHeader) h.classList.remove('active');
        });

        currentOptions.classList.toggle('show');
        currentHeader.classList.toggle('active');
    });

    currentOptions.querySelectorAll('.option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            
            currentOptions.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            
            if (currentSelectedText) {
                currentSelectedText.textContent = option.textContent;
            }
            
            const value = option.getAttribute('data-value');
            select.dataset.value = value;
            
            if (selectId === 'subjectSelect') {
                currentFilters.category_id = value;
            } else if (selectId === 'statusSelect') {
                currentFilters.status_id = value;
            }
            
            currentOptions.classList.remove('show');
            currentHeader.classList.remove('active');
            
            getALLListTicket();
        });
    });

    const closeHandler = (e) => {
        if (!select.contains(e.target)) {
            currentOptions.classList.remove('show');
            currentHeader.classList.remove('active');
            document.removeEventListener('click', closeHandler);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', closeHandler);
    }, 0);
}

// ========== ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ ВКЛАДОК С АНИМАЦИЕЙ ==========
function switchTab(tabName) {
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
    const activeTab = document.querySelector('.tab-btn-modern.active');
    updateTabSlider(activeTab);
    
    // Обновляем фильтр статуса
    let statusId = 'all';
    switch(tabName) {
        case 'new':
            statusId = '1';
            break;
        case 'inprogress':
            statusId = '2,5';
            break;
        case 'completed':
            statusId = '7';
            break;
        default:
            statusId = 'all';
    }
    
    // Обновляем селект статуса
    const statusSelect = document.getElementById('statusSelect');
    if (statusSelect) {
        const selectedText = statusSelect.querySelector('.selected-text');
        const options = statusSelect.querySelectorAll('.option');
        
        options.forEach(opt => {
            opt.classList.remove('selected');
            if (opt.getAttribute('data-value') === statusId) {
                opt.classList.add('selected');
                if (selectedText) {
                    selectedText.textContent = opt.textContent;
                }
                statusSelect.dataset.value = statusId;
            }
        });
        
        currentFilters.status_id = statusId;
    }
    
    // Загружаем заявки
    getALLListTicket();
}

// ========== ИНИЦИАЛИЗАЦИЯ ВКЛАДОК С ПОЛЗУНКОМ ==========
function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn-modern');
    if (tabs.length === 0) return;
    
    // Добавляем обработчики на вкладки
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            if (tabName) {
                switchTab(tabName);
            }
        });
    });
    
    // Инициализируем ползунок на активной вкладке
    const activeTab = document.querySelector('.tab-btn-modern.active');
    if (activeTab) {
        setTimeout(() => {
            updateTabSlider(activeTab);
        }, 100);
    }
    
    // Обновляем ползунок при изменении размера окна
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const currentActive = document.querySelector('.tab-btn-modern.active');
            if (currentActive) {
                updateTabSlider(currentActive);
            }
        }, 200);
    });
}

// ========== ИНИЦИАЛИЗАЦИЯ КАЛЕНДАРЯ С АВТО-ОБНОВЛЕНИЕМ ==========
function initDatePicker() {
    const picker = document.getElementById('range-picker');
    if (!picker) return;
    
    // Уничтожаем предыдущий экземпляр
    if (picker._flatpickr) {
        picker._flatpickr.destroy();
    }
    
    // Создаем новый экземпляр с onChange
    flatpickr(picker, {
        mode: "range",
        dateFormat: "d.m.Y",
        locale: "ru",
        rangeSeparator: ' — ',
        placeholder: "Выбрать Дату",
        maxDate: "today",
        onChange: function(selectedDates, dateStr, instance) {
            getALLListTicket();
        }
    });
}

// ========== ЗАПУСК ==========
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем, есть ли таблица (значит мы на странице клиента)
    if (!document.getElementById('tabletick')) return;
    
    // Инициализируем календарь (ВАЖНО: сначала календарь)
    initDatePicker();
    
    // Инициализируем селекты
    initCustomSelect('subjectSelect');
    initCustomSelect('statusSelect');
    
    // Инициализируем вкладки с ползунком
    initTabs();
    
    // Загружаем заявки
    getALLListTicket();
});