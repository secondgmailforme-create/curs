// Класс для чата админа
class AdminChat {
    constructor() {
        this.socket = null;
        this.ticketId = null;
        this.currentAdminId = null;
        this.adminName = null;
        this.messagesContainer = null;
        this.messageInput = null;
        this.sendBtn = null;
        this.aiResponseBtn = null;
        this.completeBtn = null;
        this.statusBadge = null;
        this.isConnected = false;
    }

    ensureDomElements() {
        this.messagesContainer = document.getElementById('adminChatMessages');
        this.messageInput = document.getElementById('adminMessageInput');
        this.sendBtn = document.getElementById('adminSendBtn');
        this.statusBadge = document.getElementById('adminChatStatus');
        this.aiResponseBtn = document.getElementById('adminAiResponseBtn');
        this.completeBtn = document.getElementById('adminCompleteBtn');
        
        return !!this.messagesContainer;
    }

    async init(ticketId, adminId, adminName) {
        this.currentAdminId = adminId;
        this.adminName = adminName || 'Администратор';
        this.ticketId = ticketId;

        if (!this.ensureDomElements()) {
            console.error('AdminChat: messagesContainer not found');
            return;
        }

        await this.initSocket();

        if (ticketId) {
            await this.joinTicketRoom(ticketId);
        }

        this.setupEventListeners();
    }

    async initSocket() {
        if (this.socket && this.socket.connected) return;

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}`;

        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }

        this.socket = io(wsUrl, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
            path: '/socket.io/',
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000
        });

        this.socket.on('connect', () => {
            this.isConnected = true;
            if (this.currentAdminId) {
                this.socket.emit('register', this.currentAdminId);
            }
            if (this.ticketId) {
                this.socket.emit('join_ticket_room', this.ticketId);
                this.loadChatHistory();
            }
        });

        this.socket.on('new_message', (data) => {
            if (String(this.ticketId) === String(data.ticketId)) {
                if (data.sender === 'admin') return;

                let sender = data.sender;
                if (sender === 'user' || sender === 'client') sender = 'client';
                if (sender === 'ai' || sender === 'bot') sender = 'ai';
                if (sender === 'expert') sender = 'expert';
                if (sender === 'operator') sender = 'operator';

                this.appendMessage(sender, data.message, data.timestamp, data.attachments || []);

                if (!document.hasFocus()) {
                    this.showNotification('Новое сообщение', data.message);
                }
            }
        });

        this.socket.on('chat_history', (data) => {
            if (String(data.ticketId) === String(this.ticketId)) {
                this.renderHistory(data.messages || []);
            }
        });

        this.socket.on('ticket_completed', (data) => {
            if (String(this.ticketId) === String(data.ticketId)) {
                this.onTicketCompleted(data);
            }
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
        });
    }

    setupEventListeners() {
        if (!this.ensureDomElements()) return;
        
        if (this.sendBtn) {
            const newSendBtn = this.sendBtn.cloneNode(true);
            this.sendBtn.parentNode.replaceChild(newSendBtn, this.sendBtn);
            this.sendBtn = newSendBtn;
            this.sendBtn.onclick = (e) => {
                e.preventDefault();
                this.sendMessage();
            };
        }

        if (this.messageInput) {
            this.messageInput.onkeypress = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            };
        }

        if (this.aiResponseBtn) {
            const newAiBtn = this.aiResponseBtn.cloneNode(true);
            this.aiResponseBtn.parentNode.replaceChild(newAiBtn, this.aiResponseBtn);
            this.aiResponseBtn = newAiBtn;
            this.aiResponseBtn.onclick = (e) => {
                e.preventDefault();
                this.getAiResponse();
            };
        }

        if (this.completeBtn) {
            const newCompleteBtn = this.completeBtn.cloneNode(true);
            this.completeBtn.parentNode.replaceChild(newCompleteBtn, this.completeBtn);
            this.completeBtn = newCompleteBtn;
            this.completeBtn.onclick = (e) => {
                e.preventDefault();
                this.completeTicket();
            };
        }
    }

    clearMessages() {
        if (!this.ensureDomElements()) return;
        if (this.messagesContainer) {
            this.messagesContainer.innerHTML = '';
        }
    }

    async joinTicketRoom(ticketId) {
        this.ticketId = ticketId;
        this.ensureDomElements();
        this.setupEventListeners();
        this.clearMessages();
        
        // Показываем индикатор загрузки
        if (this.messagesContainer) {
            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'chatLoadingIndicator';
            loadingDiv.style.textAlign = 'center';
            loadingDiv.style.padding = '20px';
            loadingDiv.style.color = '#94a3b8';
            loadingDiv.innerHTML = '⏳ Загрузка истории чата...';
            this.messagesContainer.appendChild(loadingDiv);
        }

        if (this.socket && this.socket.connected) {
            this.socket.emit('join_ticket_room', ticketId);
            this.loadChatHistory();
        } else {
            await this.initSocket();
            if (this.socket && this.socket.connected) {
                this.socket.emit('join_ticket_room', ticketId);
                this.loadChatHistory();
            }
        }

        if (this.statusBadge) {
            try {
                const response = await fetch(`/api/tickets/${ticketId}`, {
                    credentials: 'include'
                });
                const ticket = await response.json();
                this.statusBadge.textContent = `Заявка #${ticketId} | ${ticket.title || 'Без названия'}`;
            } catch (err) {
                this.statusBadge.textContent = `Заявка #${ticketId}`;
            }
            this.statusBadge.style.background = 'rgba(76, 175, 80, 0.3)';
        }

        this.enableChat();
    }

    loadChatHistory() {
        if (!this.ticketId || !this.socket || !this.socket.connected) return;
        this.socket.emit('get_chat_history', { ticketId: this.ticketId });
    }

    sendMessage() {
        if (!this.ensureDomElements()) return;
        
        const message = this.messageInput.value.trim();
        
        if (!message || !this.ticketId) return;

        this.messageInput.value = '';
        this.appendMessage('admin', message, new Date().toISOString());

        if (this.socket && this.socket.connected) {
            this.socket.emit('chat_message', {
                ticketId: this.ticketId,
                message: message,
                userId: this.currentAdminId,
                adminId: this.currentAdminId,
                adminName: this.adminName,
                sender: 'admin',
                timestamp: new Date().toISOString()
            });
        }

        // Backup fetch request
        fetch(`/api/admin/tickets/${this.ticketId}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ message })
        }).catch(err => console.error('AdminChat: fetch error', err));
    }

    async getAiResponse() {
        if (!this.ticketId) {
            console.error('AdminChat: No ticketId');
            return;
        }

        this.aiResponseBtn.disabled = true;
        this.aiResponseBtn.textContent = '⏳ Загрузка...';

        try {
            const res = await fetch(`/api/admin/tickets/${this.ticketId}/ai-response`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            
            let aiResponse = null;
            if (data.success && data.data?.response) aiResponse = data.data.response;
            else if (data.response) aiResponse = data.response;
            else if (data.data && typeof data.data === 'string') aiResponse = data.data;
            else if (data.message) aiResponse = data.message;
            else if (data.text) aiResponse = data.text;
            
            if (aiResponse) {
                this.messageInput.value = aiResponse;
                this.showSystemMessage('🤖 Ответ от AI получен');
                this.messageInput.focus();
                this.messageInput.style.border = '2px solid #10b981';
                setTimeout(() => {
                    if (this.messageInput) this.messageInput.style.border = '';
                }, 2000);
            } else {
                throw new Error('No response from AI');
            }
        } catch (err) {
            console.error('AdminChat: AI response error', err);
            this.showSystemMessage(`❌ Ошибка: ${err.message}`);
        } finally {
            this.aiResponseBtn.disabled = false;
            this.aiResponseBtn.textContent = '🤖 Ответ от AI';
        }
    }

    completeTicket() {
        if (!this.ticketId) {
            console.error('AdminChat: No ticketId');
            return;
        }

        if (!confirm('✅ Вы уверены, что хотите завершить эту заявку?')) return;

        this.completeBtn.disabled = true;
        this.completeBtn.textContent = '⏳ Завершение...';

        fetch(`/api/admin/tickets/${this.ticketId}/complete`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include'
        })
        .then(async res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(data => {
            let isSuccess = data.success === true || 
                           data.status === 'success' || 
                           data.completed === true ||
                           (data.message && data.message.includes('завершена'));
            
            if (isSuccess) {
                this.showSystemMessage('✅ Заявка успешно завершена');
                
                if (this.socket && this.socket.connected) {
                    console.log('AdminChat: Sending ticket_completed for ticket:', this.ticketId);
                    this.socket.emit('ticket_completed', { 
                        ticketId: this.ticketId,
                        completedBy: this.adminName,
                        timestamp: new Date().toISOString()
                    });
                }
                
                if (this.statusBadge) {
                    this.statusBadge.textContent = `Заявка #${this.ticketId} | Завершена`;
                }
                
                this.disableChat();
                this.addCompletionMessage();
                this.appendMessage('system', '✅ Заявка завершена. Спасибо за обращение!', new Date().toISOString());
            } else {
                throw new Error(data.error || data.message || 'Unknown error');
            }
        })
        .catch(err => {
            console.error('AdminChat: Complete error', err);
            this.showSystemMessage(`❌ Ошибка: ${err.message}`);
            this.completeBtn.disabled = false;
            this.completeBtn.textContent = '✅ Завершить';
        });
    }

    appendMessage(sender, message, timestamp, attachments = []) {
        if (!this.ensureDomElements()) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `admin-msg ${sender}`;

        const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'}) : '';

        let senderName = '';
        if (sender === 'client') senderName = 'Клиент';
        else if (sender === 'admin') senderName = this.adminName;
        else if (sender === 'ai') senderName = 'AI помощник';
        else if (sender === 'expert') senderName = 'Эксперт';
        else if (sender === 'operator') senderName = 'Оператор';
        else senderName = sender;

        let contentHtml = `<div class="message-bubble">${this.escapeHtml(message || '')}</div>`;

        if (attachments && attachments.length > 0) {
            const attachmentsHtml = attachments.map(file => {
                if (file.type && file.type.startsWith('image/')) {
                    return `<div style="margin-top: 8px;"><img src="${file.url}" alt="${file.filename}" style="max-width: 100%; border-radius: 8px; cursor: pointer;" onclick="window.open('${file.url}', '_blank')"></div>`;
                } else {
                    return `<div style="margin-top: 8px;"><a href="${file.url}" target="_blank" style="color: inherit; text-decoration: underline;">📄 ${file.filename}</a></div>`;
                }
            }).join('');
            contentHtml += attachmentsHtml;
        }

        messageDiv.innerHTML = `
            <div class="message-header" style="font-size: 0.7rem; color: rgba(255,255,255,0.7); margin-bottom: 3px;">${senderName}</div>
            ${contentHtml}
            <div class="admin-msg-time">${timeStr}</div>
        `;

        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    renderHistory(messages) {
        if (!this.ensureDomElements()) return;

        const loadingIndicator = document.getElementById('chatLoadingIndicator');
        if (loadingIndicator) loadingIndicator.remove();

        if (!messages || messages.length === 0) {
            this.messagesContainer.innerHTML = '<div class="admin-empty-state">📭 Нет сообщений. Напишите что-нибудь...</div>';
            return;
        }
        
        messages.forEach((msg) => {
            let sender = msg.sender;
            if (sender === 'user' || sender === 'client') sender = 'client';
            if (sender === 'assistant' || sender === 'bot') sender = 'ai';
            if (sender === 'admin') sender = 'admin';
            if (sender === 'expert') sender = 'expert';
            if (sender === 'operator') sender = 'operator';

            this.appendMessage(sender, msg.text || msg.message, msg.created_at, msg.attachments || []);
        });

        this.scrollToBottom();
    }

    showSystemMessage(text) {
        if (!this.ensureDomElements()) return;
        
        const systemMsg = document.createElement('div');
        systemMsg.style.textAlign = 'center';
        systemMsg.style.color = '#94a3b8';
        systemMsg.style.padding = '10px';
        systemMsg.style.fontSize = '13px';
        systemMsg.textContent = text;
        this.messagesContainer.appendChild(systemMsg);
        this.scrollToBottom();
    }

    addCompletionMessage() {
        if (!this.ensureDomElements()) return;

        const completionDiv = document.createElement('div');
        completionDiv.className = 'completion-message';
        completionDiv.style.textAlign = 'center';
        completionDiv.style.padding = '20px';
        completionDiv.style.margin = '20px auto';
        completionDiv.style.background = 'rgba(16, 185, 129, 0.1)';
        completionDiv.style.borderRadius = '10px';
        completionDiv.style.maxWidth = '80%';
        completionDiv.style.border = '1px solid rgba(16, 185, 129, 0.3)';

        completionDiv.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
            <div style="font-weight: bold; margin-bottom: 10px; color: #10b981;">Заявка завершена</div>
            <div style="color: #94a3b8;">Чат закрыт. Спасибо за работу!</div>
        `;

        this.messagesContainer.appendChild(completionDiv);
        this.scrollToBottom();
    }

    onTicketCompleted(data) {
        this.showSystemMessage(`✅ Заявка завершена ${data.completedByName ? `админом ${data.completedByName}` : ''}`);
        this.disableChat();
        this.addCompletionMessage();
    }

    showNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body: body });
        } else if ('Notification' in window && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    }

    enableChat() {
        this.ensureDomElements();
        
        if (this.messageInput) {
            this.messageInput.disabled = false;
            this.messageInput.placeholder = 'Напишите сообщение...';
            this.messageInput.focus();
        }
        if (this.sendBtn) this.sendBtn.disabled = false;
        if (this.aiResponseBtn) this.aiResponseBtn.disabled = false;
        if (this.completeBtn) this.completeBtn.disabled = false;
    }

    disableChat() {
        this.ensureDomElements();
        
        if (this.messageInput) {
            this.messageInput.disabled = true;
            this.messageInput.placeholder = 'Чат завершен';
        }
        if (this.sendBtn) this.sendBtn.disabled = true;
        if (this.aiResponseBtn) this.aiResponseBtn.disabled = true;
        if (this.completeBtn) this.completeBtn.disabled = true;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
    }
}

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
let globalAdminChatInstance = null;

// Закрытие модального окна
window.closeTicketModal = function() {
    const modal = document.getElementById('ticketSwitcherModal');
    if (modal) modal.style.display = 'none';
};

// Открытие модального окна
window.openTicketModal = async function() {
    const modal = document.getElementById('ticketSwitcherModal');
    const ticketList = document.getElementById('ticketSwitcherList');
    
    if (!modal || !ticketList) return;

    modal.style.display = 'flex';
    ticketList.innerHTML = '<div style="text-align: center; padding: 20px;">⏳ Загрузка заявок...</div>';

    try {
        const response = await fetch('/api/admin/escalated-tickets', {
            credentials: 'include'
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();
        const tickets = result.data || result.tickets || [];

        if (tickets.length === 0) {
            ticketList.innerHTML = '<div style="text-align: center; padding: 20px; color: #94a3b8;">📭 Нет эскалированных заявок</div>';
            return;
        }

        ticketList.innerHTML = '';

        tickets.forEach(ticket => {
            const card = document.createElement('div');
            card.style.cssText = `
                padding: 15px;
                border: 1px solid #334155;
                border-radius: 12px;
                margin-bottom: 10px;
                cursor: pointer;
                background: #1e293b;
                transition: all 0.2s;
            `;
            card.onmouseenter = () => {
                card.style.borderColor = '#8b5cf6';
                card.style.transform = 'translateY(-2px)';
            };
            card.onmouseleave = () => {
                card.style.borderColor = '#334155';
                card.style.transform = 'translateY(0)';
            };
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="color: #f1f5f9;">Заявка #${ticket.id}</strong>
                    <span style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px;">⚠️ Эскалирована</span>
                </div>
                <div style="color: #94a3b8; font-size: 14px; margin-bottom: 5px;">${ticket.title || 'Без названия'}</div>
                <div style="color: #64748b; font-size: 12px;">👤 Клиент: ${ticket.client_name || 'Неизвестно'}</div>
            `;
            
            card.onclick = () => window.switchTicket(ticket.id);
            ticketList.appendChild(card);
        });

    } catch (err) {
        console.error('AdminChat: Load tickets error', err);
        ticketList.innerHTML = `<div style="text-align: center; padding: 20px; color: #ef4444;">❌ Ошибка: ${err.message}</div>`;
    }
};

// Переключение заявки
window.switchTicket = async (newTicketId) => {
    window.closeTicketModal();

    if (globalAdminChatInstance) {
        await globalAdminChatInstance.joinTicketRoom(newTicketId);
    } else {
        await window.initAdminChat(newTicketId);
    }
    
    localStorage.setItem('lastAdminTicketId', newTicketId);
};

// Инициализация чата
window.initAdminChat = async (ticketId) => {
    const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
    const adminId = adminData.id || sessionStorage.getItem('admin_id');
    const adminName = adminData.name || sessionStorage.getItem('admin_name') || 'Администратор';

    if (!adminId) {
        console.error('AdminChat: Admin not authorized');
        return null;
    }

    if (!ticketId) {
        const urlParams = new URLSearchParams(window.location.search);
        ticketId = urlParams.get('ticketId');
    }

    if (!ticketId) return null;

    if (globalAdminChatInstance) {
        await globalAdminChatInstance.joinTicketRoom(ticketId);
    } else {
        globalAdminChatInstance = new AdminChat();
        await globalAdminChatInstance.init(ticketId, adminId, adminName);
    }
    
    window.adminChatInstance = globalAdminChatInstance;
    return globalAdminChatInstance;
};

// ========== ПРИВЯЗКА ОБРАБОТЧИКОВ К КНОПКАМ ==========
function bindModalHandlers() {
    const openBtn = document.getElementById('openTicketSwitcherBtn');
    if (openBtn && !openBtn.hasAttribute('data-modal-bound')) {
        openBtn.setAttribute('data-modal-bound', 'true');
        openBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.openTicketModal();
        };
    }
    
    const closeBtn = document.getElementById('closeTicketSwitcherBtn');
    if (closeBtn && !closeBtn.hasAttribute('data-close-bound')) {
        closeBtn.setAttribute('data-close-bound', 'true');
        closeBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.closeTicketModal();
        };
    }
    
    const modal = document.getElementById('ticketSwitcherModal');
    if (modal && !modal.hasAttribute('data-overlay-bound')) {
        modal.setAttribute('data-overlay-bound', 'true');
        modal.onclick = (e) => {
            if (e.target === modal) window.closeTicketModal();
        };
    }
}

// Запуск
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        bindModalHandlers();
        
        const urlParams = new URLSearchParams(window.location.search);
        const ticketId = urlParams.get('ticketId') || localStorage.getItem('lastAdminTicketId');
        if (ticketId) window.initAdminChat(ticketId);
    });
} else {
    bindModalHandlers();
    
    const urlParams = new URLSearchParams(window.location.search);
    const ticketId = urlParams.get('ticketId') || localStorage.getItem('lastAdminTicketId');
    if (ticketId) window.initAdminChat(ticketId);
}