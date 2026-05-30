class OperatorChat {
    constructor() {
        this.socket = null;
        this.ticketId = null;
        this.currentOperatorId = null;
        this.operatorName = null;
        this.isTransferredToOperator = false;
        this.canWrite = false;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;

        this.messagesContainer = null;
        this.messageInput = null;
        this.sendBtn = null;
        this.expertBtn = null;
        this.completeBtn = null;
        this.statusBadge = null;
        this.openModalBtn = null;
        this.modal = null;
        this.modalCloseBtn = null;
        this.ticketList = null;
    }

    async init(ticketId, operatorId, operatorName) {
        this.currentOperatorId = operatorId;
        this.operatorName = operatorName || 'Оператор';

        this.messagesContainer = document.getElementById('operatorChatMessages');
        this.messageInput = document.getElementById('operatorMessageInput');
        this.sendBtn = document.getElementById('operatorSendBtn');
        this.statusBadge = document.getElementById('operatorChatStatus');
        this.expertBtn = document.getElementById('operatorToExpertBtn');
        this.completeBtn = document.getElementById('operatorCompleteBtn');
        this.openModalBtn = document.getElementById('openOperatorTicketSwitcherBtn');
        this.modal = document.getElementById('operatorTicketSwitcherModal');
        this.modalCloseBtn = document.getElementById('closeOperatorTicketSwitcherBtn');
        this.ticketList = document.getElementById('operatorTicketSwitcherList');

        if (!this.messagesContainer) {
            console.error('OperatorChat: Messages container not found');
            return;
        }

        this.setupModalHandlers();
        await this.initSocket();

        if (ticketId) {
            await this.joinTicketRoom(ticketId);
        } else {
            this.showEmptyState();
        }

        if (this.sendBtn && this.messageInput) {
            this.sendBtn.addEventListener('click', () => this.sendMessage());
            this.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        if (this.expertBtn) {
            this.expertBtn.addEventListener('click', () => this.transferToExpert());
        }

        if (this.completeBtn) {
            this.completeBtn.addEventListener('click', () => this.completeTicket());
        }
    }

    async initSocket() {
        if (this.socket && this.socket.connected) return;

        return new Promise((resolve) => {
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
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 20000
            });

            this.socket.on('connect', () => {
                console.log('OperatorChat: Socket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                
                if (this.currentOperatorId) {
                    this.socket.emit('register', this.currentOperatorId);
                }
                
                if (this.ticketId) {
                    this.socket.emit('join_ticket_room', this.ticketId);
                }
                
                resolve(true);
            });

            this.socket.on('connect_error', (error) => {
                console.error('OperatorChat: Socket connection error:', error);
                this.isConnected = false;
                this.showMessageSystem('⚠️ Проблема с соединением. Сообщения могут доставляться с задержкой.');
            });

            this.socket.on('disconnect', (reason) => {
                console.log('OperatorChat: Socket disconnected:', reason);
                this.isConnected = false;
            });

            this.socket.on('reconnect', (attemptNumber) => {
                console.log('OperatorChat: Socket reconnected after', attemptNumber, 'attempts');
                this.isConnected = true;
                this.showMessageSystem('🔄 Соединение восстановлено');
                
                if (this.currentOperatorId) {
                    this.socket.emit('register', this.currentOperatorId);
                }
                
                if (this.ticketId) {
                    this.socket.emit('join_ticket_room', this.ticketId);
                    this.loadChatHistory();
                }
            });

            this.socket.on('reconnect_failed', () => {
                console.error('OperatorChat: Socket reconnection failed');
                this.showMessageSystem('❌ Не удалось восстановить соединение. Обновите страницу.');
            });

            this.setupSocketListeners();
            
            // Таймаут на случай если соединение не устанавливается
            setTimeout(() => {
                if (!this.isConnected) {
                    console.warn('OperatorChat: Socket connection timeout');
                    resolve(false);
                }
            }, 5000);
        });
    }

    setupSocketListeners() {
        if (!this.socket) return;

        this.socket.on('new_message', (data) => {
            console.log('OperatorChat: New message received', data);
            if (String(data.ticketId) === String(this.ticketId)) {
                if (data.sender !== 'operator') {
                    this.appendMessage(data.sender, data.message, data.timestamp, data.attachments || []);
                }
            }
        });

        this.socket.on('chat_history', (data) => {
            console.log('OperatorChat: Chat history received', data);
            if (String(data.ticketId) === String(this.ticketId)) {
                this.renderHistory(data.messages || []);
            }
        });

        this.socket.on('ai_response', (data) => {
            if (String(data.ticketId) === String(this.ticketId)) {
                if (data.sender !== 'operator' && !data.transferred_to_operator) {
                    this.appendMessage('ai', data.message, data.timestamp, data.attachments || []);
                }
                if (data.transferred_to_operator) {
                    this.handleTransferToOperator(data);
                }
            }
        });

        this.socket.on('transferred_to_operator', (data) => {
            if (String(data.ticketId) === String(this.ticketId)) {
                this.handleTransferToOperator(data);
            }
        });

        this.socket.on('status_change', (data) => {
            if (String(data.ticketId) === String(this.ticketId) && (data.newStatus === 'completed' || data.newStatus === 'resolved')) {
                this.showMessageSystem('Заявка завершена');
                this.canWrite = false;
                this.disableChat();
            }
        });
    }

    showEmptyState() {
        if (this.messagesContainer) {
            this.messagesContainer.innerHTML = `
                <div class="universal-empty-state">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <p style="margin-top: 15px;">Выберите заявку для начала работы</p>
                    <p style="font-size: 12px; color: #64748b; margin-top: 10px;">Нажмите на три точки в правом верхнем углу</p>
                </div>
            `;
        }
        
        this.disableChat();
        if (this.statusBadge) {
            this.statusBadge.textContent = 'Выберите заявку для начала работы';
        }
    }

    setupModalHandlers() {
        if (this.openModalBtn) {
            this.openModalBtn.onclick = (e) => {
                e.preventDefault();
                this.openTicketModal();
            };
        }

        if (this.modalCloseBtn) {
            this.modalCloseBtn.onclick = () => {
                this.closeTicketModal();
            };
        }

        if (this.modal) {
            this.modal.onclick = (e) => {
                if (e.target === this.modal) {
                    this.closeTicketModal();
                }
            };
        }
    }

    async openTicketModal() {
        if (!this.modal || !this.ticketList) return;

        this.modal.style.display = 'flex';
        this.ticketList.innerHTML = '<div style="text-align: center; padding: 20px;">⏳ Загрузка заявок...</div>';

        try {
            const response = await fetch('/api/operator/tickets', {
                credentials: 'include'
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const result = await response.json();
            let tickets = result.data || result.tickets || [];

            tickets = tickets.filter(ticket => {
                const statusId = parseInt(ticket.status_id || ticket.status);
                return statusId === 2;
            });

            if (tickets.length === 0) {
                this.ticketList.innerHTML = '<div style="text-align: center; padding: 20px; color: #94a3b8;">📭 Нет активных заявок</div>';
                return;
            }

            this.ticketList.innerHTML = '';

            tickets.forEach(ticket => {
                const card = document.createElement('div');
                card.className = 'universal-ticket-card';
                
                card.style.cssText = `
                    padding: 15px;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    margin-bottom: 10px;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: #ffffff;
                `;
                
                card.onmouseenter = () => {
                    card.style.borderColor = '#a855f7';
                    card.style.transform = 'translateY(-2px)';
                    card.style.background = '#faf5ff';
                };
                card.onmouseleave = () => {
                    card.style.borderColor = '#e2e8f0';
                    card.style.transform = 'translateY(0)';
                    card.style.background = '#ffffff';
                };
                
                card.onclick = () => {
                    this.switchTicket(ticket.id);
                };
                
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <strong style="color: #1e293b;">Заявка #${ticket.id}</strong>
                        <span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px;">🟢 В работе</span>
                    </div>
                    <div style="color: #64748b; font-size: 14px; margin-bottom: 5px;">${this.escapeHtml(ticket.title || 'Чат с поддержкой')}</div>
                    <div style="color: #94a3b8; font-size: 12px;">👤 Клиент: ${this.escapeHtml(ticket.client_name || 'Неизвестно')}</div>
                    <div style="color: #cbd5e1; font-size: 11px; margin-top: 5px;"> ${new Date(ticket.created_at).toLocaleString()}</div>
                `;
                
                this.ticketList.appendChild(card);
            });

        } catch (err) {
            console.error('OperatorChat: Load tickets error', err);
            this.ticketList.innerHTML = `<div style="text-align: center; padding: 20px; color: #ef4444;">❌ Ошибка: ${err.message}</div>`;
        }
    }

    closeTicketModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
    }

    async switchTicket(newTicketId) {
        this.closeTicketModal();
        localStorage.setItem('lastOperatorTicketId', newTicketId);
        await this.joinTicketRoom(newTicketId);
    }

    async joinTicketRoom(ticketId) {
        this.ticketId = ticketId;
        
        // Загружаем историю через HTTP
        await this.loadChatHistoryHttp(ticketId);
        
        // Подключаемся к комнате через сокет
        if (this.socket && this.socket.connected) {
            this.socket.emit('join_ticket_room', ticketId);
        }
        
        this.canWrite = true;
        this.enableChat();
        
        if (this.statusBadge) {
            this.statusBadge.textContent = `Заявка #${ticketId} | ✏️ Можно писать`;
        }
    }

    async loadChatHistoryHttp(ticketId) {
        try {
            const response = await fetch(`/api/operator/tickets/${ticketId}/chat-history`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const result = await response.json();
                const messages = result.data || result.messages || [];
                this.renderHistory(messages);
            } else {
                this.renderHistory([]);
            }
        } catch (err) {
            console.error('OperatorChat: Load history error', err);
            this.renderHistory([]);
        }
    }

    loadChatHistory() {
        if (!this.ticketId) return;
        if (this.socket && this.socket.connected) {
            this.socket.emit('get_chat_history', { ticketId: this.ticketId });
        } else {
            this.loadChatHistoryHttp(this.ticketId);
        }
    }

    sendMessage() {
        const message = this.messageInput?.value.trim();
        if (!message || !this.ticketId) return;
        
        this.sendMessageToServer(message);
    }

    async sendMessageToServer(message) {
        // Оптимистичное добавление
        this.appendMessage('operator', message, new Date().toISOString(), []);
        if (this.messageInput) this.messageInput.value = '';

        try {
            const response = await fetch(`/api/operator/tickets/${this.ticketId}/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ message })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                console.error('OperatorChat: Send error', data.error);
                this.showMessageSystem('Ошибка отправки');
                // Удаляем оптимистичное сообщение
                const lastMsg = this.messagesContainer.lastChild;
                if (lastMsg && lastMsg.querySelector('.message-text')?.textContent === message) {
                    lastMsg.remove();
                }
            }
        } catch (err) {
            console.error('OperatorChat: Network error', err);
            this.showMessageSystem('Ошибка сети');
            const lastMsg = this.messagesContainer.lastChild;
            if (lastMsg && lastMsg.querySelector('.message-text')?.textContent === message) {
                lastMsg.remove();
            }
        }
    }

    async transferToExpert() {
        if (!this.ticketId) return;

        if (!confirm('Вы уверены, что хотите передать эту заявку эксперту?')) return;

        try {
            const response = await fetch(`/api/operator/tickets/${this.ticketId}/transfer-expert`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showMessageSystem('Заявка передана эксперту');
                this.canWrite = false;
                this.disableChat();
                if (this.socket && this.socket.connected) {
                    this.socket.emit('transfer_to_expert', { ticketId: this.ticketId });
                }
            } else {
                alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'));
            }
        } catch (err) {
            console.error('OperatorChat: Transfer error', err);
            alert('Ошибка сети при передаче эксперту');
        }
    }

    async completeTicket() {
        if (!this.ticketId) return;

        if (!confirm('Вы уверены, что хотите завершить эту заявку?')) return;

        try {
            const response = await fetch(`/api/operator/tickets/${this.ticketId}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showMessageSystem('Заявка завершена');
                this.canWrite = false;
                this.disableChat();
                
                // ИСПРАВЛЕНО: отправляем 'ticket_completed', а не 'complete_ticket'
                if (this.socket && this.socket.connected) {
                    console.log('OperatorChat: Sending ticket_completed for ticket:', this.ticketId);
                    this.socket.emit('ticket_completed', { 
                        ticketId: this.ticketId,
                        completedBy: this.operatorName,
                        timestamp: new Date().toISOString()
                    });
                }
            } else {
                alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'));
            }
        } catch (err) {
            console.error('OperatorChat: Complete error', err);
            alert('Ошибка сети при завершении заявки');
        }
    }

    enableChat() {
        if (this.messageInput) {
            this.messageInput.disabled = false;
            this.messageInput.placeholder = 'Напишите сообщение...';
        }
        if (this.sendBtn) this.sendBtn.disabled = false;
        if (this.expertBtn) this.expertBtn.disabled = false;
        if (this.completeBtn) this.completeBtn.disabled = false;
    }

    disableChat() {
        if (this.messageInput) {
            this.messageInput.disabled = true;
            this.messageInput.placeholder = 'Чат недоступен';
        }
        if (this.sendBtn) this.sendBtn.disabled = true;
        if (this.expertBtn) this.expertBtn.disabled = true;
        if (this.completeBtn) this.completeBtn.disabled = true;
    }

    appendMessage(sender, message, timestamp, attachments = []) {
        if (!this.messagesContainer) return;

        const messageDiv = document.createElement('div');
        
        let senderClass = '';
        switch(sender) {
            case 'client': senderClass = 'client'; break;
            case 'operator': senderClass = 'operator'; break;
            case 'expert': senderClass = 'expert'; break;
            case 'ai': senderClass = 'ai'; break;
            default: senderClass = 'operator';
        }
        
        messageDiv.className = `universal-msg ${senderClass}`;
        const isRight = (sender === 'operator' || sender === 'expert');
        
        messageDiv.style.cssText = `
            max-width: 70%;
            padding: 14px 20px;
            border-radius: 18px;
            font-size: 15px;
            line-height: 1.5;
            position: relative;
            animation: universalPopIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            align-self: ${isRight ? 'flex-end' : 'flex-start'};
            background: ${sender === 'operator' ? '#28a745' : 
                        sender === 'expert' ? '#f59e0b' :
                        sender === 'ai' ? 'linear-gradient(135deg, #667eea, #764ba2)' :
                        sender === 'client' ? '#2d3748' : '#4a5568'};
            color: white;
        `;

        const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'}) : '';

        let html = '';
        
        if (message && message.trim()) {
            html += `<div class="message-text" style="white-space: pre-wrap; line-height: 1.4;">${this.escapeHtml(message)}</div>`;
        }
        
        if (attachments && attachments.length > 0) {
            html += '<div style="margin-top: 10px; display: flex; flex-direction: column; gap: 8px;">';
            for (const att of attachments) {
                const fileUrl = att.url || att.filepath || (att.filename ? `/uploads/${att.filename}` : null);
                if (!fileUrl) continue;
                
                const isImage = att.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(att.filename || '');
                
                if (isImage) {
                    html += `
                        <div style="cursor: pointer;" onclick="window.open('${this.escapeHtml(fileUrl)}', '_blank')">
                            <img src="${this.escapeHtml(fileUrl)}" 
                                 alt="Изображение" 
                                 style="max-width: 100%; max-height: 250px; border-radius: 8px; object-fit: contain;"
                                 loading="lazy">
                        </div>
                    `;
                } else {
                    html += `
                        <a href="${this.escapeHtml(fileUrl)}" 
                           target="_blank" 
                           style="color: white; text-decoration: underline; display: flex; align-items: center; gap: 5px;">
                            📎 ${this.escapeHtml(att.filename || att.original_name || 'Файл')}
                        </a>
                    `;
                }
            }
            html += '</div>';
        }
        
        html += `<div class="universal-msg-time" style="font-size: 10px; opacity: 0.7; margin-top: 6px; text-align: ${isRight ? 'right' : 'left'};">${this.escapeHtml(timeStr)}</div>`;
        
        messageDiv.innerHTML = html;
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    renderHistory(messages) {
        if (!this.messagesContainer) return;
        this.messagesContainer.innerHTML = '';

        if (messages.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'universal-empty-state';
            emptyDiv.innerHTML = '<p>История пуста</p><p>Напишите первое сообщение...</p>';
            this.messagesContainer.appendChild(emptyDiv);
            return;
        }

        messages.forEach(msg => {
            let sender = msg.sender === 'client' ? 'client' :
                        msg.sender === 'operator' ? 'operator' : 
                        msg.sender === 'expert' ? 'expert' : 'ai';
            this.appendMessage(sender, msg.message || msg.text, msg.created_at, msg.attachments || []);
        });
        
        this.scrollToBottom();
    }

    handleTransferToOperator(data) {
        this.isTransferredToOperator = true;
        if (this.statusBadge) {
            this.statusBadge.textContent = `Чат с клиентом (Оператор: ${data.operatorName || this.operatorName})`;
        }
        this.showMessageSystem(`Заявка передана оператору: ${data.operatorName || this.operatorName}`);
    }

    showMessageSystem(text) {
        if (!this.messagesContainer) return;
        const systemDiv = document.createElement('div');
        systemDiv.className = 'universal-msg system';
        systemDiv.style.cssText = `
            text-align: center;
            margin: 14px auto;
            font-size: 12px;
            color: #94a3b8;
            padding: 8px 16px;
            background: rgba(100, 116, 139, 0.2);
            border-radius: 20px;
            max-width: 80%;
            align-self: center;
        `;
        systemDiv.textContent = text;
        this.messagesContainer.appendChild(systemDiv);
        this.scrollToBottom();
    }

    scrollToBottom() {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
}

let operatorChatInstance = null;

window.initOperatorChat = async (ticketId = null) => {
    try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) throw new Error('Not authorized');

        const data = await res.json();
        const user = data.user;

        if (!user || user.role_id !== 2) {
            throw new Error('User is not an operator');
        }

        if (operatorChatInstance) {
            operatorChatInstance.disconnect();
        }

        operatorChatInstance = new OperatorChat();
        
        if (ticketId) {
            await operatorChatInstance.init(ticketId, user.id, user.full_name);
        } else {
            await operatorChatInstance.init(null, user.id, user.full_name);
        }
        
        window.operatorChatInstance = operatorChatInstance;
    } catch (error) {
        console.error('OperatorChat: Init error', error);
        throw error;
    }
};

window.addEventListener('beforeunload', () => {
    if (operatorChatInstance) {
        operatorChatInstance.disconnect();
    }
    window.operatorChatInstance = null;
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.initOperatorChat();
    });
} else {
    window.initOperatorChat();
}