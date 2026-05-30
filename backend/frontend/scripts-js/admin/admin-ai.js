// admin-ai.js - Управление AI данными

class AdminAIManager {
    constructor() {
        this.trainingData = [];
        this.filteredData = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.isLoading = false;
        this.dataLoaded = false;
        
        this.init();
    }


    async init() {
        // Пересоздаём элементы для очистки обработчиков
        this.recreateEventElements();
        this.bindEvents();
        
        const cachedData = this.getCachedData();
        
        if (cachedData && !this.dataLoaded) {
            console.log('Loading data from cache...');
            this.restoreFromCache(cachedData);
            this.dataLoaded = true;
        } else if (!this.isLoading && !this.dataLoaded) {
            console.log('Loading fresh data...');
            await this.loadAllData(false);
            this.dataLoaded = true;
        }
    }

    recreateEventElements() {
        const refreshBtn = document.getElementById('refreshAIData');
        if (refreshBtn) {
            const newBtn = refreshBtn.cloneNode(true);
            refreshBtn.parentNode.replaceChild(newBtn, refreshBtn);
        }

        const exportBtn = document.getElementById('exportTrainingData');
        if (exportBtn) {
            const newBtn = exportBtn.cloneNode(true);
            exportBtn.parentNode.replaceChild(newBtn, exportBtn);
        }
    }

    saveToCache(data) {
        try {
            const cacheData = {
                predictions: data.predictions,
                dashboardStats: data.dashboardStats,
                trainingData: data.trainingData,
                timestamp: Date.now()
            };
            sessionStorage.setItem('adminAICache', JSON.stringify(cacheData));
            console.log('Data saved to cache');
        } catch (e) {
            console.warn('Failed to save to cache:', e);
        }
    }

    getCachedData() {
        try {
            const cached = sessionStorage.getItem('adminAICache');
            if (cached) {
                const data = JSON.parse(cached);
                // Кэш живёт 5 минут
                if (Date.now() - data.timestamp < 300000) {
                    return data;
                } else {
                    console.log('Cache expired, removing...');
                    sessionStorage.removeItem('adminAICache');
                }
            }
        } catch (e) {
            console.warn('Failed to read cache:', e);
        }
        return null;
    }

    restoreFromCache(cachedData) {
        if (cachedData.predictions) {
            this.displayPredictions(cachedData.predictions);
        }
        if (cachedData.dashboardStats) {
            this.displayDashboardStats(cachedData.dashboardStats);
        }
        if (cachedData.trainingData) {
            this.trainingData = cachedData.trainingData;
            this.filteredData = [...this.trainingData];
            this.renderTrainingTable();
            this.renderTrainingPagination();
            
            const countEl = document.getElementById('trainingCount');
            if (countEl) {
                countEl.textContent = `${this.trainingData.length} записей`;
            }
        }
    }

    displayPredictions(data) {
        const loadForecast = document.getElementById('loadForecast');
        if (loadForecast) {
            const forecastMap = {
                'низкая': { text: '📉 Низкая', class: 'low' },
                'средняя': { text: '📊 Средняя', class: 'medium' },
                'высокая': { text: '📈 Высокая', class: 'high' }
            };
            const forecast = forecastMap[data.load_forecast] || { text: data.load_forecast || 'Средняя', class: 'medium' };
            loadForecast.textContent = forecast.text;
            loadForecast.className = `prediction-value ${forecast.class}`;
        }
        
        const peakHours = document.getElementById('peakHours');
        if (peakHours && data.peak_hours) {
            peakHours.textContent = data.peak_hours.join(' · ');
        }
        
        const recommendations = document.getElementById('recommendations');
        if (recommendations && data.recommendations) {
            if (Array.isArray(data.recommendations) && data.recommendations.length > 0) {
                recommendations.innerHTML = data.recommendations
                    .map(rec => `<div class="recommendation-item">${this.escapeHtml(rec)}</div>`)
                    .join('');
            } else {
                recommendations.innerHTML = '<div class="recommendation-item">Нет активных рекомендаций</div>';
            }
        }
    }

    displayDashboardStats(stats) {
        const totalTickets = stats.totalTickets || stats.total || 0;
        const resolvedTickets = stats.resolvedTickets || stats.resolved || 0;
        const resolvedRate = stats.resolvedRate || (totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0);
        
        const elements = {
            totalTickets: totalTickets,
            avgResolutionTime: stats.avgResolutionTime ? `${stats.avgResolutionTime} ч` : '0 ч',
            openTickets: stats.openTickets || stats.open || stats.active || 0,
            resolvedRate: `${resolvedRate}%`
        };
        
        for (const [id, value] of Object.entries(elements)) {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = value;
            }
        }
    }

    bindEvents() {
        const refreshBtn = document.getElementById('refreshAIData');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                console.log('Refresh button clicked');
                // При ручном обновлении очищаем кэш
                sessionStorage.removeItem('adminAICache');
                this.dataLoaded = false;
                await this.loadAllData(true);
            });
        }

        const exportBtn = document.getElementById('exportTrainingData');
        if (exportBtn) {
            exportBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                console.log('Export button clicked');
                await this.exportTrainingData();
            });
        }

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-close')) {
                this.closeModals();
            }
            if (e.target.classList.contains('modal')) {
                this.closeModals();
            }
        });
    }

    async loadAllData(showToast = false) {
        if (this.isLoading) {
            console.log('Already loading, skipping...');
            return;
        }
        
        this.isLoading = true;
        
        if (showToast) {
            this.showToast('Загрузка данных...', 'info');
        }
        
        let predictions = null;
        let dashboardStats = null;
        let trainingData = null;
        
        try {
            const [predictionsResult, statsResult, trainingResult] = await Promise.all([
                this.loadAIPredictions(),
                this.loadDashboardStats(),
                this.loadTrainingData()
            ]);
            
            predictions = predictionsResult;
            dashboardStats = statsResult;
            trainingData = trainingResult;
            
            this.saveToCache({
                predictions: predictions,
                dashboardStats: dashboardStats,
                trainingData: trainingData
            });
            
            if (showToast) {
                this.showToast('Данные обновлены', 'success');
            }
        } catch (error) {
            console.error('Load all data error:', error);
            if (showToast) {
                this.showToast('Ошибка загрузки данных', 'error');
            }
        } finally {
            this.isLoading = false;
        }
    }

    async loadAIPredictions() {
        try {
            const response = await fetch('/api/admin/predictions', {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Ошибка загрузки прогнозов');

            const result = await response.json();
            const data = result.data || result;
            
            this.displayPredictions(data);
            return data;
        } catch (error) {
            console.error('Load AI predictions error:', error);
            this.setDefaultPredictions();
            return null;
        }
    }

    setDefaultPredictions() {
        const loadForecast = document.getElementById('loadForecast');
        if (loadForecast) {
            loadForecast.textContent = '📊 Средняя';
            loadForecast.className = 'prediction-value medium';
        }
        
        const peakHours = document.getElementById('peakHours');
        if (peakHours) peakHours.textContent = '10:00-12:00 · 14:00-16:00';
        
        const recommendations = document.getElementById('recommendations');
        if (recommendations) {
            recommendations.innerHTML = '<div class="recommendation-item">Не удалось загрузить рекомендации</div>';
        }
    }

    async loadDashboardStats() {
        try {
            const response = await fetch('/api/admin/stats', {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Ошибка загрузки статистики');

            const result = await response.json();
            const stats = result.data || result;
            
            this.displayDashboardStats(stats);
            return stats;
        } catch (error) {
            console.error('Load dashboard stats error:', error);
            return null;
        }
    }

    async loadTrainingData() {
        try {
            const response = await fetch('/api/admin/ai-data', {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Ошибка загрузки тренировочных данных');

            const result = await response.json();
            
            let rawData = result.data || result;
            
            if (!Array.isArray(rawData)) {
                rawData = [];
            }
            
            this.trainingData = rawData.filter(item => {
                const question = item.input_text || item.question;
                return question && question.trim() !== '' && question !== '📎 Вложение';
            });
            
            console.log(`Loaded ${this.trainingData.length} training records`);
            
            this.filteredData = [...this.trainingData];
            this.currentPage = 1;
            this.renderTrainingTable();
            this.renderTrainingPagination();
            
            const countEl = document.getElementById('trainingCount');
            if (countEl) {
                countEl.textContent = `${this.trainingData.length} записей`;
            }
            
            return this.trainingData;
        } catch (error) {
            console.error('Load training data error:', error);
            this.trainingData = [];
            this.filteredData = [];
            this.renderTrainingTable();
            return [];
        }
    }

    renderTrainingTable() {
        const tbody = document.getElementById('trainingDataBody');
        if (!tbody) return;

        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const pageData = this.filteredData.slice(start, end);

        if (!pageData || pageData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading-row">Нет тренировочных данных<\/td></td>';
            return;
        }

        tbody.innerHTML = pageData.map(item => {
            const itemId = item.id || '-';
            const question = item.input_text || item.question || '-';
            const truncatedQuestion = this.truncate(this.escapeHtml(question), 60);
            const category = this.getCategoryBadge(item.category_id);
            const date = this.formatDate(item.created_at);
            
            const hasAnswer = item.output_text && item.output_text.trim() !== '';
            const usedText = hasAnswer ? 'С ответом' : 'Без ответа';
            const usedClass = hasAnswer ? 'yes' : 'no';
            
            const safeItem = JSON.stringify({
                id: item.id,
                input_text: item.input_text,
                output_text: item.output_text,
                category_id: item.category_id,
                created_at: item.created_at
            }).replace(/'/g, "&#39;");
            
            return `
                <tr data-training-item='${safeItem}' class="training-row">
                    <td>${itemId}<\/td>
                    <td><strong>${truncatedQuestion}<\/strong><\/td>
                    <td>${category}<\/td>
                    <td>${date}<\/td>
                    <td>
                        <span class="used-badge ${usedClass}"><\/span>
                        ${usedText}
                     <\/td>
                 \n            `;
        }).join('');
        
        const rows = tbody.querySelectorAll('.training-row');
        rows.forEach(row => {
            row.style.cursor = 'pointer';
            row.addEventListener('click', () => {
                const itemData = row.getAttribute('data-training-item');
                if (itemData) {
                    try {
                        const item = JSON.parse(itemData);
                        this.showTrainingDetail(item);
                    } catch (e) {
                        console.error('Error parsing training item:', e);
                    }
                }
            });
        });
    }

    renderTrainingPagination() {
        const container = document.getElementById('trainingPagination');
        if (!container) return;

        const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
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
        this.renderTrainingTable();
        this.renderTrainingPagination();
    }

    showTrainingDetail(item) {
        const modal = document.getElementById('trainingDetailModal');
        if (!modal) return;

        const question = item.input_text || item.question || '-';
        let answer = item.output_text || item.answer || item.response;
        
        if (!answer || answer.trim() === '') {
            answer = '🤖 AI ответ не сохранен.';
        }
        
        const category = this.getCategoryName(item.category_id);
        const date = this.formatDate(item.created_at);

        document.getElementById('detailQuestion').innerHTML = this.escapeHtml(question);
        document.getElementById('detailAnswer').innerHTML = this.escapeHtml(answer);
        document.getElementById('detailCategory').innerHTML = category;
        document.getElementById('detailModel').textContent = item.model_used || 'не указана';
        document.getElementById('detailTime').textContent = item.generation_time ? `${item.generation_time}ms` : '-';

        modal.style.display = 'flex';
    }

    getCategoryName(categoryId) {
        const categories = {
            1: 'Техподдержка',
            2: 'Оплата',
            3: 'Доставка',
            4: 'Возврат',
            5: 'Общее'
        };
        return categories[categoryId] || 'Общее';
    }

    getCategoryBadge(categoryId) {
        const categories = {
            1: { name: 'Техподдержка', class: 'technical' },
            2: { name: 'Оплата', class: 'billing' },
            3: { name: 'Доставка', class: 'delivery' },
            4: { name: 'Возврат', class: 'return' },
            5: { name: 'Общее', class: 'general' }
        };
        
        let categoryName = 'Общее';
        let categoryClass = 'general';
        
        if (typeof categoryId === 'number' && categories[categoryId]) {
            categoryName = categories[categoryId].name;
            categoryClass = categories[categoryId].class;
        }
        
        return `<span class="category-badge ${categoryClass}">${categoryName}</span>`;
    }

    truncate(text, length) {
        if (!text) return '-';
        if (text.length <= length) return text;
        return text.substring(0, length) + '...';
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
                minute: '2-digit'
            });
        } catch {
            return '-';
        }
    }

    async exportTrainingData() {
        console.log('ExportTrainingData called');
        try {
            const response = await fetch('/api/admin/ai-data/export', {
                credentials: 'include'
            });

            console.log('Export response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Export error response:', errorText);
                throw new Error('Ошибка экспорта');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ai-training-data-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.showToast('Экспорт завершён', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showToast('Ошибка экспорта данных: ' + error.message, 'error');
        }
    }

    closeModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });
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
let adminAIManager = null;

window.initAdminAI = function() {
    console.log('initAdminAI called');

    if (adminAIManager) {
        // Просто пересоздаём обработчики, не трогая кэш
        adminAIManager.recreateEventElements();
        adminAIManager.bindEvents();
        // Восстанавливаем отображение из кэша, если есть
        const cachedData = adminAIManager.getCachedData();
        if (cachedData) {
            adminAIManager.restoreFromCache(cachedData);
        }
    } else {
        adminAIManager = new AdminAIManager();
    }
};

// Стили
if (!document.querySelector('#admin-ai-styles')) {
    const style = document.createElement('style');
    style.id = 'admin-ai-styles';
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
        .category-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
        }
        .category-badge.general { background: #e0e7ff; color: #4338ca; }
        .category-badge.technical { background: #d1fae5; color: #065f46; }
        .category-badge.billing { background: #fef3c7; color: #92400e; }
        .category-badge.delivery { background: #fee2e2; color: #991b1b; }
        .category-badge.return { background: #f3e8ff; color: #6b21a5; }
        .used-badge {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 8px;
        }
        .used-badge.yes { background: #10b981; }
        .used-badge.no { background: #ef4444; }
        .loading-row {
            text-align: center;
            padding: 40px;
            color: #6b7280;
        }
        .pagination-btn {
            padding: 6px 12px;
            margin: 0 4px;
            border: 1px solid #ddd;
            background: white;
            cursor: pointer;
            border-radius: 6px;
        }
        .pagination-btn.active {
            background: #4f46e5;
            color: white;
            border-color: #4f46e5;
        }
        .pagination-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
    `;
    document.head.appendChild(style);
}