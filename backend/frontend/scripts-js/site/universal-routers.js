// ==========================================
// ЕДИНЫЙ УНИВЕРСАЛЬНЫЙ РОУТЕР ДЛЯ ВСЕХ РОЛЕЙ
// ==========================================

// Конфигурация маршрутов по ролям
const ROUTES_CONFIG = {
    1: { // CLIENT
        name: 'client',
        label: 'Клиент',
        routes: {
            '/Dashboard': 'dashboard-client',
            '/MY-TICKETS': 'tickets-client',
            '/CHAT': 'chatai-client',
            '/SETTINGS': 'settings-site',
            '/PROFILE-SETTINGS': 'settings-profile'
        },
        navLinks: [
            { href: '/Dashboard', label: 'Главная', page: 'dashboard-client' },
            { href: '/MY-TICKETS', label: 'Мои заявки', page: 'tickets-client' },
            { href: '/CHAT', label: 'Чат', page: 'chatai-client' },
            { href: '/SETTINGS', label: 'Настройки', page: 'settings-site' }
        ],
        dashboardPage: 'dashboard-client',
        defaultRoute: '/Dashboard'
    },
    2: { // OPERATOR
        name: 'operator',
        label: 'Оператор',
        routes: {
            '/Operator-Dashboard': 'dashboard-operator',
            '/OPERATOR-TICKETS': 'operator-tickets',
            '/OPERATOR-MY-TICKETS': 'operator-my-tickets',
            '/OPERATOR-NEW': 'operator-new',
            '/OPERATOR-INPROGRESS': 'operator-inprogress',
            '/OPERATOR-COMPLETED': 'operator-completed',
            '/OPERATOR-CHAT': 'operator-chat',
            '/SETTINGS': 'settings-site',
            '/PROFILE-SETTINGS': 'settings-profile'
        },
        navLinks: [
            { href: '/Operator-Dashboard', label: 'Главная', page: 'dashboard-operator' },
            { href: '/OPERATOR-MY-TICKETS', label: 'Мои заявки', page: 'operator-my-tickets' },
            { href: '/OPERATOR-CHAT', label: 'Чат с клиентом', page: 'operator-chat' },
            { href: '/SETTINGS', label: 'Настройки', page: 'settings-site' }
        ],
        dashboardPage: 'dashboard-operator',
        defaultRoute: '/Operator-Dashboard'
    },
    3: { // EXPERT
        name: 'expert',
        label: 'Эксперт',
        routes: {
            '/Expert-Dashboard': 'dashboard-expert',
            '/EXPERT-TICKETS': 'expert-my-tickets',
            '/EXPERT-CHAT': 'expert-chat',
            '/SETTINGS': 'settings-site',
            '/PROFILE-SETTINGS': 'settings-profile'
        },
        navLinks: [
            { href: '/Expert-Dashboard', label: 'Главная', page: 'dashboard-expert' },
            { href: '/EXPERT-TICKETS', label: 'Заявки экспертов', page: 'expert-tickets' },
            { href: '/EXPERT-CHAT', label: 'Чат с клиентом', page: 'expert-chat' },
            { href: '/SETTINGS', label: 'Настройки', page: 'settings-site' }
        ],
        dashboardPage: 'dashboard-expert',
        defaultRoute: '/Expert-Dashboard'
    },
    4: { // ADMIN
        name: 'admin',
        label: 'Администратор',
        routes: {
            '/Admin-Dashboard': 'admin-dashboard',
            '/ADMIN-USERS': 'admin-users',
            '/ADMIN-TICKETS': 'admin-tickets',
            '/ADMIN-CHAT': 'admin-chat',
            '/ADMIN-STATS': 'admin-stats',
            '/ADMIN-AI-DATA': 'admin-ai-data',
            '/ADMIN-LOGS': 'admin-logs',
            '/SETTINGS': 'settings-site',
            '/PROFILE-SETTINGS': 'settings-profile'
        },
        navLinks: [
            { href: '/Admin-Dashboard', label: 'Главная', page: 'admin-dashboard' },
            { href: '/ADMIN-USERS', label: 'Пользователи', page: 'admin-users' },
            { href: '/ADMIN-TICKETS', label: 'Мои заявки', page: 'admin-tickets' },
            { href: '/ADMIN-CHAT', label: 'Чат с клиентом', page: 'admin-chat' },
            { href: '/ADMIN-STATS', label: 'Статистика', page: 'admin-stats' },
            { href: '/ADMIN-AI-DATA', label: 'AI данные', page: 'admin-ai-data' },
            { href: '/ADMIN-LOGS', label: 'Логи', page: 'admin-logs' },
            { href: '/SETTINGS', label: 'Настройки', page: 'settings-site' }
        ],
        dashboardPage: 'admin-dashboard',
        defaultRoute: '/Admin-Dashboard'
    }
};

// Глобальное состояние
let currentUser = null;
let currentRoleConfig = null;
let isNavInitialized = false;
let currentPage = null;

// ==========================================
// ГЛОБАЛЬНЫЙ ПЕРЕКЛЮЧАТЕЛЬ ЯЗЫКА
// ==========================================

function initGlobalLanguageSelector() {
    const langSelect = document.getElementById('globalLanguageSelect');
    if (!langSelect) {
        setTimeout(initGlobalLanguageSelector, 100);
        return;
    }
    
    const savedLang = localStorage.getItem('settings_language') || 'ru';
    langSelect.value = savedLang;
    
    langSelect.addEventListener('change', (e) => {
        const newLang = e.target.value;
        localStorage.setItem('settings_language', newLang);
        
        const translations = window.globalTranslations?.[newLang];
        if (translations) {
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (translations[key]) {
                    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                        if (el.placeholder !== undefined) {
                            el.placeholder = translations[key];
                        }
                    } else {
                        el.textContent = translations[key];
                    }
                }
            });
            
            document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                const key = el.getAttribute('data-i18n-placeholder');
                if (translations[key]) {
                    el.placeholder = translations[key];
                }
            });
        }
        
        if (window.applyGlobalTranslations) {
            window.applyGlobalTranslations(newLang);
        }
        
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: newLang } }));
    });
}

function syncLanguageOnPageLoad() {
    const savedLang = localStorage.getItem('settings_language') || 'ru';
    const globalSelect = document.getElementById('globalLanguageSelect');
    
    if (globalSelect && globalSelect.value !== savedLang) {
        globalSelect.value = savedLang;
    }
    
    if (savedLang !== 'ru') {
        setTimeout(() => {
            const translations = window.globalTranslations?.[savedLang];
            if (translations) {
                document.querySelectorAll('[data-i18n]').forEach(el => {
                    const key = el.getAttribute('data-i18n');
                    if (translations[key]) {
                        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                            if (el.placeholder !== undefined) {
                                el.placeholder = translations[key];
                            }
                        } else {
                            el.textContent = translations[key];
                        }
                    }
                });
                
                document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                    const key = el.getAttribute('data-i18n-placeholder');
                    if (translations[key]) {
                        el.placeholder = translations[key];
                    }
                });
            }
            
            if (window.applyGlobalTranslations) {
                window.applyGlobalTranslations(savedLang);
            }
        }, 150);
    }
}

function getCurrentPageName() {
    const path = window.location.pathname;
    const pageMap = {
        '/Dashboard': 'dashboard-client',
        '/MY-TICKETS': 'tickets-client',
        '/CHAT': 'chatai-client.html',
        '/SETTINGS': 'settings-site',
        '/PROFILE-SETTINGS': 'settings-profile',
        '/Operator-Dashboard': 'dashboard-operator',
        '/OPERATOR-MY-TICKETS': 'operator-my-tickets',
        '/OPERATOR-CHAT': 'operator-chat',
        '/Expert-Dashboard': 'dashboard-expert',
        '/EXPERT-TICKETS': 'expert-tickets',
        '/EXPERT-CHAT': 'expert-chat',
        '/Admin-Dashboard': 'admin-dashboard',
        '/ADMIN-USERS': 'admin-users',
        '/ADMIN-TICKETS': 'admin-tickets',
        '/ADMIN-CHAT': 'admin-chat',
        '/ADMIN-STATS': 'admin-stats',
        '/ADMIN-AI-DATA': 'admin-ai-data',
        '/ADMIN-LOGS': 'admin-logs'
    };
    return pageMap[path] || 'dashboard-client';
}

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

function normalizePath(path) {
    if (!path || path === '/') return '/';
    return path.replace(/\/$/, '').toUpperCase();
}

function updateActiveLink(path) {
    const links = document.querySelectorAll('.nav-links a');
    if (links.length === 0) return;
    links.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === path) {
            link.classList.add('active');
        }
    });
}

async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            if (data && data.user) {
                currentUser = data.user;
                const roleId = data.user.role_id || data.user.role;
                currentRoleConfig = ROUTES_CONFIG[roleId] || ROUTES_CONFIG[1];
                return true;
            }
        }
        return false;
    } catch (e) {
        console.error('Router: Auth error', e);
        return false;
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const existingScript = document.querySelector(`script[src="${src}"]`);
        if (existingScript) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => {
            console.error('Router: Script load error', src);
            reject(new Error(`Failed to load script: ${src}`));
        };
        document.head.appendChild(script);
    });
}

function cleanupPage(pageName) {
    if (currentPage === 'chatai-client' && pageName !== 'chatai-client') {
        const inst = window.chatInstance;
        if (inst && inst.socket) {
            inst.isConnected = false;
        }
    }
    if (currentPage === 'operator-chat' && pageName !== 'operator-chat') {
        const inst = window.operatorChatInstance;
        if (inst && inst.socket) {
            inst.isConnected = false;
        }
    }
    if (currentPage === 'expert-chat' && pageName !== 'expert-chat') {
        const inst = window.expertChatInstance;
        if (inst && inst.socket) {
            inst.socket.close();
        }
    }
    currentPage = pageName;
}

async function loadPage(pageName, ticketId = null) {
    const app = document.getElementById('app');
    if (!app) return;

    cleanupPage(pageName);
    try {
        let html = '';
        let htmlPath = '';

        if (pageName === 'chatai-client') {
            htmlPath = '/htmls/client/chatai-client.html';
        } else if (pageName === 'operator-chat') {
            htmlPath = '/htmls/operator/operator-chat.html';
        } else if (pageName === 'expert-chat') {
            htmlPath = '/htmls/expert/expert-chat.html';
        } else if (pageName === 'dashboard-client' || pageName === 'tickets-client') {
            htmlPath = `/htmls/client/${pageName}.html`;
        } else if (pageName === 'settings-site' || pageName === 'settings-profile') {
            htmlPath = `/htmls/site/${pageName}.html`;
        } else if (pageName === 'dashboard-operator' || pageName === 'operator-tickets' || pageName === 'operator-my-tickets' || pageName === 'operator-new' || pageName === 'operator-inprogress' || pageName === 'operator-completed') {
            htmlPath = `/htmls/operator/${pageName}.html`;
        } else if (pageName === 'dashboard-expert' || pageName === 'expert-tickets' || pageName === 'expert-my-tickets') {
            htmlPath = `/htmls/expert/${pageName}.html`;
        } else if (pageName === 'admin' || pageName === 'admin-users' || pageName === 'admin-tickets') {
            htmlPath = `/htmls/admin/${pageName}.html`;
        } else if (pageName === 'admin-dashboard' || pageName === 'admin-users' || 
            pageName === 'admin-tickets' || pageName === 'admin-stats' || 
            pageName === 'admin-ai-data' || pageName === 'admin-logs' || pageName === 'admin-chat') {
            htmlPath = `/htmls/admin/${pageName}.html`;
        } else {
            htmlPath = `/htmls/site/${pageName}.html`;
        }

        const res = await fetch(htmlPath);
        if (res.ok) {
            html = await res.text();
        } else {
            throw new Error(`Страница ${pageName} не найдена`);
        }

        app.innerHTML = html;
        await initPageScripts(pageName, ticketId);


        if (currentUser) {
            const el = document.getElementById('userInfo');
            if (el) el.textContent = currentUser.full_name || currentUser.email;

            const avatarEl = document.getElementById('userAvatar');
            if (avatarEl && currentUser.full_name) {
                const initials = currentUser.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                avatarEl.textContent = initials;
            }

            const roleEl = document.getElementById('userRole');
            if (roleEl && currentRoleConfig) {
                roleEl.textContent = currentRoleConfig.label;
            }
        }
        
        syncLanguageOnPageLoad();
        
    } catch (err) {
        console.error('Router: Load page error', err);
        app.innerHTML = `<div style="color:red; padding:20px;">Ошибка: ${err.message}</div>`;
    }
}

async function initPageScripts(pageName, ticketId = null) {
    const isAdmin = currentRoleConfig && currentRoleConfig.name === 'admin';
    const isOperator = currentRoleConfig && currentRoleConfig.name === 'operator';
    const isExpert = currentRoleConfig && currentRoleConfig.name === 'expert';
    const isClient = currentRoleConfig && currentRoleConfig.name === 'client';
    if (pageName === 'operator-my-tickets') {
        await loadScript('/scripts-js/operator/operator-my-tickets.js');
        setTimeout(() => {
            if (typeof window.initMyTicketsModule === 'function') window.initMyTicketsModule();
        }, 50);
    }
    else if (pageName === 'tickets-client' || pageName === 'expert-tickets') {
        setTimeout(() => {
            if (typeof getALLListTicket === 'function') getALLListTicket();
            if (typeof initCustomSelect === 'function') {
                if (document.getElementById('subjectSelect')) initCustomSelect('subjectSelect');
                if (document.getElementById('statusSelect')) initCustomSelect('statusSelect');
            }
            if (document.getElementById('range-picker') && typeof flatpickr !== 'undefined') {
                flatpickr("#range-picker", {
                    mode: "range",
                    dateFormat: "d.m.Y",
                    locale: "ru",
                    maxDate: "today"
                });
            }
        }, 50);
    }
    else if (pageName === 'dashboard-client' && isClient) {
        await loadScript('/scripts-js/client/dasboard-client.js');
        setTimeout(() => {
            if (typeof getWorkTickets === 'function') getWorkTickets();
            if (typeof getListTicket === 'function') getListTicket();
        }, 100);
    }
    else if (pageName === 'dashboard-operator' && isOperator) {
        await loadScript('/scripts-js/operator/dashboard-operator.js');
        setTimeout(() => {
            if (typeof getOperatorDashboardStats === 'function') getOperatorDashboardStats();
            if (typeof getOperatorDashboardTickets === 'function') getOperatorDashboardTickets();
        }, 100);
    }
    else if (pageName === 'dashboard-expert' && isExpert) {
        await loadScript('/scripts-js/expert/dashboard-expert.js');
        setTimeout(() => {
            if (typeof getExpertDashboardStats === 'function') getExpertDashboardStats();
            if (typeof getExpertDashboardTickets === 'function') getExpertDashboardTickets();
        }, 100);
    }
    else if (pageName === 'expert-my-tickets' && isExpert) {
        await loadScript('/scripts-js/expert/expert-my-tickets.js');
        setTimeout(() => {
            if (typeof window.initMyTicketsModule === 'function') window.initMyTicketsModule();
        }, 50);
    }
    else if (pageName === 'chatai-client' && isClient) {
        try {
            const urlTicketId = new URLSearchParams(window.location.search).get('ticketId') || ticketId;
            if (typeof io === 'undefined') {
                await loadScript('/scripts-js/site/socket.io.js');
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            await loadScript('/scripts-js/client/chatai-allroles.js');
            setTimeout(() => {
                if (window.initAIChat) {
                    window.initAIChat(urlTicketId).catch(err => {
                        console.error('Router: Chat init error', err);
                    });
                }
            }, 50);
        } catch (error) {
            console.error('Router: Chat load error', error);
        }
    }
    else if (pageName === 'operator-chat' && isOperator) {
        try {
            const urlTicketId = new URLSearchParams(window.location.search).get('ticketId') || ticketId;
            if (typeof io === 'undefined') {
                await loadScript('/scripts-js/site/socket.io.js');
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            await loadScript('/scripts-js/operator/operator-chat.js');
            setTimeout(() => {
                if (window.initOperatorChat) {
                    window.initOperatorChat(urlTicketId).catch(err => {
                        console.error('Router: Operator chat init error', err);
                    });
                }
            }, 50);
        } catch (error) {
            console.error('Router: Operator chat load error', error);
        }
    }
    else if (pageName === 'expert-chat' && isExpert) {
        try {
            const urlTicketId = new URLSearchParams(window.location.search).get('ticketId') || ticketId;
            if (typeof io === 'undefined') {
                await loadScript('/scripts-js/site/socket.io.js');
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            await loadScript('/scripts-js/expert/expert-chat.js');
            setTimeout(() => {
                if (window.initExpertChat) {
                    window.initExpertChat(urlTicketId).catch(err => {
                        console.error('Router: Expert chat init error', err);
                    });
                }
            }, 50);
        } catch (error) {
            console.error('Router: Expert chat load error', error);
        }
    }
    else if (pageName === 'admin-dashboard' && isAdmin) {
        await loadScript('/scripts-js/admin/dashboard-admin.js');
        setTimeout(() => {
            if (typeof getAdminDashboardStats === 'function') getAdminDashboardStats();
            if (typeof getAdminDashboardTickets === 'function') getAdminDashboardTickets();
        }, 100);
    }
    else if (pageName === 'admin-tickets' && isAdmin) {
        await loadScript('/scripts-js/admin/admin-tickets.js');
        setTimeout(() => {
            if (typeof loadAdminTickets === 'function') loadAdminTickets();
        }, 100);
    }
    else if (pageName === 'admin-chat' && isAdmin) {
        try {
            const urlTicketId = new URLSearchParams(window.location.search).get('ticketId') || ticketId;
            if (typeof io === 'undefined') {
                await loadScript('/scripts-js/site/socket.io.js');
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            setTimeout(() => {
                if (window.initAdminChat) {
                    window.initAdminChat(urlTicketId).catch(err => {
                        console.error('Router: Admin chat init error', err);
                    });
                }
            }, 50);
        } catch (error) {
            console.error('Router: Admin chat load error', error);
        }
    }
    else if (pageName === 'admin-users' && isAdmin) {
        await loadScript('/scripts-js/admin/admin-users.js');
        setTimeout(() => {
            if (typeof window.initAdminUsers === 'function') {
                window.initAdminUsers();
            }
        }, 100);
    }
    else if (pageName === 'admin-ai-data' && isAdmin) {
        await loadScript('/scripts-js/admin/admin-ai.js');
        setTimeout(() => {
            if (window.adminAIManager) {
                window.adminAIManager = null;
            }
            // Вызываем функцию инициализации
            if (typeof initAdminAI === 'function') {
                initAdminAI();
            } else if (typeof window.initAdminAI === 'function') {
                window.initAdminAI();
            }
        }, 100);
    }
    else if (pageName === 'admin-logs' && isAdmin) {
        await loadScript('/scripts-js/admin/admin-logs.js');
        setTimeout(() => {
            if (typeof window.initAdminLogs === 'function') {
                window.initAdminLogs();
            }
        }, 100);
    }
}

// ==========================================
// НАВИГАЦИЯ
// ==========================================

function buildNavigation() {
    if (!currentRoleConfig) return;
    
    const navLinksContainer = document.querySelector('.nav-links');
    if (!navLinksContainer) {
        setTimeout(buildNavigation, 100);
        return;
    }
    
    navLinksContainer.innerHTML = currentRoleConfig.navLinks
        .map(link => `<li><a href="${link.href}" data-page="${link.page}">${link.label}</a></li>`)
        .join('');
}

function initNavigation() {
    if (isNavInitialized) return;
    isNavInitialized = true;

    document.addEventListener('click', function(e) {
        const link = e.target.closest('a');
        if (!link) return;
        if (link.hostname !== window.location.hostname) return;
        if (link.hash) return;
        if (link.target === '_blank') return;

        const path = link.pathname;
        const normPath = normalizePath(path);
        const pageName = currentRoleConfig.routes[normPath] || currentRoleConfig.routes[path];

        if (pageName) {
            e.preventDefault();
            history.pushState({ page: pageName }, '', path);
            loadPage(pageName);
            updateActiveLink(path);
        }
    });

    window.addEventListener('popstate', (event) => {
        const path = window.location.pathname;
        const pageName = currentRoleConfig.routes[normalizePath(path)] || currentRoleConfig.routes[path] || currentRoleConfig.dashboardPage;
        const urlTicketId = new URLSearchParams(window.location.search).get('ticketId');
        const stateTicketId = event.state ? event.state.ticketId : null;
        const ticketId = urlTicketId || stateTicketId;
        
        if (pageName === 'chatai-client' || pageName === 'operator-chat' || pageName === 'expert-chat') {
            loadPage(pageName, ticketId);
        } else {
            loadPage(pageName);
        }
        updateActiveLink(path);
    });
}

// ==========================================
// МОДАЛЬНОЕ ОКНО
// ==========================================

async function showTicketModal(ticketId) {
    if (window.chatInstance && typeof window.chatInstance.clearUnreadCount === 'function') {
        window.chatInstance.clearUnreadCount(ticketId);
    }
    const modal = document.getElementById('ticketModal');
    const modalBody = document.getElementById('modalBody');

    if (!modal || !modalBody) return;

    modalBody.innerHTML = '<div class="loader">Загрузка...</div>';
    modal.style.display = 'block';

    try {
        const [ticketResponse, historyResponse, messagesResponse] = await Promise.all([
            fetch(`/api/tickets/${ticketId}`, { credentials: 'include' }),
            fetch(`/api/tickets/${ticketId}/history`, { credentials: 'include' }),
            fetch(`/api/tickets/${ticketId}/messages`, { credentials: 'include' })
        ]);

        const ticket = await ticketResponse.json();
        const historyData = await historyResponse.json();
        const messagesData = await messagesResponse.json();
        const history = historyData.data || [];
        const messages = messagesData.messages || [];

        const statusNames = {
            1: 'Новая',
            2: 'В работе (оператор)',
            3: 'Ожидает оператора',
            4: 'Ожидает эксперта',
            5: 'В работе (эксперт)',
            6: 'Передана администратору',
            7: 'Решена',
            8: 'Отменена', 
        };
        
        let messagesHTML = '';
        if (messages.length > 0) {
            const lastMessages = messages.slice(-5);
            messagesHTML = `
                <div class="messages-section">
                    <h3>Последние сообщения</h3>
                    <div class="messages-list">
                        ${lastMessages.map(msg => {
                            const senderName = msg.sender === 'client' ? 'Вы' : 
                                            msg.sender === 'operator' ? 'Оператор' :
                                            msg.sender === 'expert' ? 'Эксперт' :
                                            msg.sender === 'ai' ? 'AI помощник' : msg.sender;
                            const time = new Date(msg.created_at).toLocaleString('ru-RU');
                            
                        
                            let attachmentsHtml = '';
                            if (msg.attachments && msg.attachments.length > 0) {
                                attachmentsHtml = '<div class="message-attachments" style="margin-top: 8px;">';
                                for (const att of msg.attachments) {
                                    const fileUrl = att.url || att.filepath || (att.filename ? `/uploads/${att.filename}` : null);
                                    if (!fileUrl) continue;
                                    
                                    const isImage = att.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(att.filename || '');
                                    
                                    if (isImage) {
                                        attachmentsHtml += `
                                            <div style="cursor: pointer; margin-top: 5px;" onclick="window.open('${escapeHtml(fileUrl)}', '_blank')">
                                                <img src="${escapeHtml(fileUrl)}" 
                                                    alt="Изображение" 
                                                    style="max-width: 100%; max-height: 200px; border-radius: 8px; object-fit: contain;">
                                            </div>
                                        `;
                                    } else {
                                        attachmentsHtml += `
                                            <a href="${escapeHtml(fileUrl)}" target="_blank" style="display: inline-block; margin-top: 5px; color: #8b5cf6; text-decoration: none;">
                                                📎 ${escapeHtml(att.filename || att.original_name || 'Файл')}
                                            </a>
                                        `;
                                    }
                                }
                                attachmentsHtml += '</div>';
                            }
                            
                            return `
                                <div class="message-item">
                                    <div class="message-sender"><strong>${escapeHtml(senderName)}:</strong></div>
                                    <div class="message-text">${escapeHtml(msg.text || msg.message)}</div>
                                    ${attachmentsHtml}
                                    <div class="message-time">${escapeHtml(time)}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    ${messages.length > 5 ? `<div class="more-messages">... и еще ${messages.length - 5} сообщений</div>` : ''}
                </div>
            `;
        }
        
        let historyHTML = '';
        if (history.length > 0) {
            historyHTML = `
                <div class="history-section">
                    <h3>История изменений</h3>
                    <div class="history-list">
                        ${history.map(item => {
                            const date = new Date(item.changed_at).toLocaleString('ru-RU');
                            const oldStatus = item.old_status_id ? statusNames[item.old_status_id] || 'Неизвестно' : '-';
                            const newStatus = item.new_status_id ? statusNames[item.new_status_id] || 'Неизвестно' : '-';
                            const actionNames = {
                                'create': 'Создание заявки',
                                'assign_operator': 'Назначен оператор',
                                'transfer_to_expert': 'Передана эксперту',
                                'assign_expert': 'Принята экспертом',
                                'resolve': 'Заявка решена',
                                'reopen': 'Заявка переоткрыта',
                                'escalate': 'Эскалирована админу',
                                'request_operator': 'Запрошен оператор'
                            };
                            const actionName = actionNames[item.action] || item.action;
                            return `
                                <div class="history-item">
                                    <div class="history-action">${escapeHtml(actionName)}</div>
                                    <div class="history-status">
                                        <span>Статус: ${escapeHtml(oldStatus)} → ${escapeHtml(newStatus)}</span>
                                    </div>
                                    <div class="history-date">${escapeHtml(date)}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

    
        const isOperator = currentRoleConfig && currentRoleConfig.name === 'operator';
        const isExpert = currentRoleConfig && currentRoleConfig.name === 'expert';
        const isAdmin = currentRoleConfig && currentRoleConfig.name === 'admin';
        const isClient = currentRoleConfig && currentRoleConfig.name === 'client';
        
        let isClosed = false;
        let chatPage = '';
        let chatPath = '';
        let showAcceptButton = false;  // для кнопки "Принять"
        
        if (isClient) {
            // Клиент может писать в чат, пока статус не 7 (Решена) или 8 (Отменена)
            isClosed = ticket.status_id === 7 || ticket.status_id === 8;
            chatPage = 'chatai-client';
            chatPath = '/CHAT?ticketId=';
        } else if (isOperator) {
            isClosed = ticket.status_id === 7 || ticket.status_id === 8;
            chatPage = 'operator-chat';
            chatPath = '/OPERATOR-CHAT?ticketId=';
        } else if (isExpert) {
            isClosed = ticket.status_id === 7 || ticket.status_id === 8;
            
          
            if (ticket.status_id === 4) {
                showAcceptButton = true;
                chatPage = null;
                chatPath = null;
            } else {
                chatPage = 'expert-chat';
                chatPath = '/EXPERT-CHAT?ticketId=';
            }
        } else if (isAdmin) {
            isClosed = ticket.status_id === 7 || ticket.status_id === 8;
            chatPage = 'admin-chat';
            chatPath = '/ADMIN-CHAT?ticketId=';
        }
        
        // Формируем HTML кнопок
        let chatButtonHTML = '';
        
        if (showAcceptButton) {
     
            chatButtonHTML = `
                <div class="chat-button-section">
                    <button id="acceptTicketBtn" class="chat-btn accept-btn" style="background: linear-gradient(135deg, #22c55e, #16a34a);">
                        ✅ Принять в работу
                    </button>
                    ${isClosed ? `<button id="reopenBtn" class="reopen-btn">Переоткрыть заявку</button>` : ''}
                </div>
            `;
        } else if (chatPage) {
            const chatButtonText = isClosed ? 'Заявка закрыта' : 'Открыть чат';
            chatButtonHTML = `
                <div class="chat-button-section">
                    <button id="openChatBtn" class="chat-btn ${isClosed ? 'disabled' : ''}"
                            ${isClosed ? 'disabled' : ''}>
                        💬 ${chatButtonText}
                    </button>
                    ${isClosed ? `<button id="reopenBtn" class="reopen-btn">Переоткрыть заявку</button>` : ''}
                </div>
            `;
        } else {
            chatButtonHTML = `
                <div class="chat-button-section">
                    ${isClosed ? `<button id="reopenBtn" class="reopen-btn">Переоткрыть заявку</button>` : ''}
                </div>
            `;
        }

        modalBody.innerHTML = `
            <h2>Заявка #${escapeHtml(String(ticket.id))}</h2>
            <div class="detail-card">
                <p><strong>Тема:</strong> ${escapeHtml(ticket.title || 'Без темы')}</p>
                <p><strong>Описание:</strong> ${escapeHtml(ticket.description || 'Нет описания')}</p>
                <p><strong>Статус:</strong> ${escapeHtml(statusNames[ticket.status_id] || 'Неизвестно')}</p>
                <p><strong>Приоритет:</strong> ${escapeHtml(ticket.priority || 'medium')}</p>
                <p><strong>Дата:</strong> ${escapeHtml(new Date(ticket.created_at).toLocaleString('ru-RU'))}</p>
            </div>
            ${messagesHTML}
            ${historyHTML}
            ${chatButtonHTML}
        `;

        setTimeout(() => {
            const openChatBtn = document.getElementById('openChatBtn');
            const acceptTicketBtn = document.getElementById('acceptTicketBtn');
            const reopenBtn = document.getElementById('reopenBtn');

            // Обработчик для кнопки "Открыть чат"
            if (openChatBtn && !openChatBtn.disabled) {
                openChatBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    modal.style.display = 'none';
                    const newPath = chatPath + ticketId;
                    window.history.pushState({ page: chatPage, ticketId: ticketId }, '', newPath);
                    loadPage(chatPage, ticketId);
                });
            }

            if (acceptTicketBtn) {
                acceptTicketBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (!confirm('Принять заявку в работу?')) return;
                    
                    try {
                        const response = await fetch(`/api/expert/tickets/${ticketId}/accept`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include'
                        });
                        
                        const data = await response.json();
                        
                        if (response.ok && data.success) {
                            alert('✅ Заявка принята в работу');
                            modal.style.display = 'none';
                            // Обновляем список заявок
                            if (typeof window.loadCurrentTabTickets === 'function') {
                                window.loadCurrentTabTickets();
                            }
                            // Обновляем дашборд
                            if (typeof getExpertDashboardStats === 'function') {
                                getExpertDashboardStats();
                            }
                            if (typeof getExpertDashboardTickets === 'function') {
                                getExpertDashboardTickets();
                            }
                            // Перезагружаем модальное окно, если нужно
                            if (document.getElementById('ticketModal').style.display === 'block') {
                                showTicketModal(ticketId);
                            }
                        } else {
                            alert('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'));
                        }
                    } catch (error) {
                        console.error('Accept ticket error:', error);
                        alert('❌ Ошибка сети');
                    }
                });
            }

            // Обработчик для кнопки "Переоткрыть"
            if (reopenBtn) {
                reopenBtn.addEventListener('click', async () => {
                    if (!confirm('Переоткрыть заявку? Это вернёт её в работу.')) return;
                    
                    try {
                        const response = await fetch(`/api/tickets/${ticketId}/reopen`, {
                            method: 'PUT',
                            credentials: 'include'
                        });
                        if (response.ok) {
                            alert('✅ Заявка переоткрыта');
                            modal.style.display = 'none';
                            if (typeof getALLListTicket === 'function') {
                                getALLListTicket();
                            }
                            if (typeof getListTicket === 'function') {
                                getListTicket();
                            }
                            if (typeof getWorkTickets === 'function') {
                                getWorkTickets();
                            }
                            if (typeof window.loadCurrentTabTickets === 'function') {
                                window.loadCurrentTabTickets();
                            }
                        } else {
                            const error = await response.json();
                            alert('❌ Ошибка: ' + (error.error || 'Не удалось переоткрыть заявку'));
                        }
                    } catch (error) {
                        console.error('Router: Reopen error', error);
                        alert('❌ Ошибка при переоткрытии заявки');
                    }
                });
            }
        }, 100);
    } catch (error) {
        console.error('Router: Modal error', error);
        modalBody.innerHTML = `<div class="error">Ошибка: ${escapeHtml(error.message)}</div>`;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('click', (e) => {
    const modal = document.getElementById('ticketModal');
    if (modal && (e.target.classList.contains('close') || e.target === modal)) {
        modal.style.display = 'none';
    }
});

// ==========================================
// ВЫХОД
// ==========================================

async function logout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.error('Router: Logout error', error);
    } finally {
        currentUser = null;
        currentRoleConfig = null;
        window.location.href = '/htmls/auth/login-client.html';
    }
}

window.openOperatorChat = function(ticketId) {
    if (currentPage === 'operator-chat' && window.operatorChatInstance) {
        window.operatorChatInstance.joinTicketRoom(ticketId);
    } else {
        const path = '/OPERATOR-CHAT?ticketId=' + ticketId;
        history.pushState({ page: 'operator-chat', ticketId: ticketId }, '', path);
        loadPage('operator-chat', ticketId);
    }
};

window.openExpertChat = function(ticketId) {
    if (currentPage === 'expert-chat' && window.expertChatInstance) {
        window.expertChatInstance.joinTicketRoom(ticketId);
    } else {
        const path = '/EXPERT-CHAT?ticketId=' + ticketId;
        history.pushState({ page: 'expert-chat', ticketId: ticketId }, '', path);
        loadPage('expert-chat', ticketId);
    }
};

// ==========================================
// ЗАПУСК ПРИЛОЖЕНИЯ
// ==========================================

async function startApp() {
    const isAuth = await checkAuth();

    if (!isAuth) {
        window.location.href = '/htmls/auth/login-client.html';
        return;
    }

    buildNavigation();
    document.body.classList.add('loaded');

    let path = window.location.pathname;
    if (path === '/app.html' || path === '/index.html' || path === '' || path === '/') {
        history.replaceState(null, '', currentRoleConfig.defaultRoute);
        path = currentRoleConfig.defaultRoute;
    }

    const pageName = currentRoleConfig.routes[normalizePath(path)] || currentRoleConfig.routes[path] || currentRoleConfig.dashboardPage;

    await loadPage(pageName);
    updateActiveLink(path);
    initNavigation();
    initGlobalLanguageSelector();
}

// Глобальные функции
window.logout = logout;
window.showTicketModal = showTicketModal;

// Запуск
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

(function() {
    setTimeout(() => {
        const loader = document.getElementById('loadingScreen');
        if (loader) {
            loader.style.opacity = '0';
            loader.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                loader.style.display = 'none';
            }, 100);
        }
    }, 9450);
})();