class ExpertChat {
    constructor() {
        this.socket = null;
        this.ticketId = null;
        this.currentExpertId = null;
        this.expertName = null;
        this.isTransferredToAdmin = false;
        this.canWrite = false;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;

        this.messagesContainer = null;
        this.messageInput = null;
        this.sendBtn = null;
        this.aiResponseBtn = null;
        this.adminBtn = null;
        this.completeBtn = null;
        this.statusBadge = null;
        this.openModalBtn = null;
        this.modal = null;
        this.modalCloseBtn = null;
        this.ticketList = null;
    }

    async init(ticketId, expertId, expertName) {
        this.currentExpertId = expertId;
        this.expertName = expertName || 'Эксперт';

        this.messagesContainer = document.getElementById('expertChatMessages');
        this.messageInput = document.getElementById('expertMessageInput');
        this.sendBtn = document.getElementById('expertSendBtn');
        this.statusBadge = document.getElementById('expertChatStatus');
        this.aiResponseBtn = document.getElementById('expertAiResponseBtn');
        this.adminBtn = document.getElementById('expertToAdminBtn');
        this.completeBtn = document.getElementById('expertCompleteBtn');
        this.openModalBtn = document.getElementById('openExpertTicketSwitcherBtn');
        this.modal = document.getElementById('expertTicketSwitcherModal');
        this.modalCloseBtn = document.getElementById('closeExpertTicketSwitcherBtn');
        this.ticketList = document.getElementById('expertTicketSwitcherList');

        if (!this.messagesContainer) {
            console.error('ExpertChat: Messages container not found');
            return;
        }

        this.setupModalHandlers();
        await this.initSocket();

        if (ticketId) {
            await this.joinTicketRoom(ticketId);
        } else {
            this.showEmptyState();
        }

        this.setupEventListeners();
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
            const response = await fetch('/api/expert/tickets', {
                credentials: 'include'
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const result = await response.json();
            let tickets = result.data || result.tickets || [];

            tickets = tickets.filter(ticket => {
                const statusId = parseInt(ticket.status_id || ticket.status);
                return statusId === 5;
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
                    card.style.borderColor = '#f59e0b';
                    card.style.transform = 'translateY(-2px)';
                    card.style.background = '#fffbeb';
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
                        <span style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px;">🟠 В работе</span>
                    </div>
                    <div style="color: #64748b; font-size: 14px; margin-bottom: 5px;">${this.escapeHtml(ticket.title || 'Чат с поддержкой')}</div>
                    <div style="color: #94a3b8; font-size: 12px;">👤 Клиент: ${this.escapeHtml(ticket.client_name || 'Неизвестно')}</div>
                    <div style="color: #cbd5e1; font-size: 11px; margin-top: 5px;">${new Date(ticket.created_at).toLocaleString()}</div>
                `;
                
                this.ticketList.appendChild(card);
            });

        } catch (err) {
            console.error('ExpertChat: Load tickets error', err);
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
        localStorage.setItem('lastExpertTicketId', newTicketId);
        await this.joinTicketRoom(newTicketId);
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
                console.log('ExpertChat: Socket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                
                if (this.currentExpertId) {
                    this.socket.emit('register', this.currentExpertId);
                }
                
                if (this.ticketId) {
                    this.socket.emit('join_ticket_room', this.ticketId);
                    this.loadChatHistory();
                }
                
                resolve(true);
            });

            this.socket.on('connect_error', (error) => {
                console.error('ExpertChat: Socket connection error:', error);
                this.isConnected = false;
                this.showMessageSystem('⚠️ Проблема с соединением. Сообщения могут доставляться с задержкой.');
            });

            this.socket.on('disconnect', (reason) => {
                console.log('ExpertChat: Socket disconnected:', reason);
                this.isConnected = false;
            });

            this.socket.on('reconnect', (attemptNumber) => {
                console.log('ExpertChat: Socket reconnected after', attemptNumber, 'attempts');
                this.isConnected = true;
                this.showMessageSystem('Соединение восстановлено');
                
                if (this.currentExpertId) {
                    this.socket.emit('register', this.currentExpertId);
                }
                
                if (this.ticketId) {
                    this.socket.emit('join_ticket_room', this.ticketId);
                    this.loadChatHistory();
                }
            });

            this.socket.on('reconnect_failed', () => {
                console.error('ExpertChat: Socket reconnection failed');
                this.showMessageSystem('Не удалось восстановить соединение. Обновите страницу.');
            });

            this.setupSocketListeners();
            
            setTimeout(() => {
                if (!this.isConnected) {
                    console.warn('ExpertChat: Socket connection timeout');
                    resolve(false);
                }
            }, 5000);
        });
    }

    setupSocketListeners() {
        if (!this.socket) return;

        this.socket.on('new_message', (data) => {
            console.log('ExpertChat: New message received', data);
            if (String(this.ticketId) === String(data.ticketId)) {
                if (data.sender !== 'expert') {
                    this.appendMessage(data.sender, data.message, data.timestamp, data.attachments || []);
                    if (!document.hasFocus()) {
                        this.showNotification('Новое сообщение', data.message);
                    }
                }
            }
        });

        this.socket.on('chat_history', (data) => {
            console.log('ExpertChat: Chat history received', data);
            if (String(data.ticketId) === String(this.ticketId)) {
                this.renderHistory(data.messages || []);
            }
        });

        this.socket.on('ai_response', (data) => {
            if (String(data.ticketId) === String(this.ticketId)) {
                if (data.sender !== 'expert' && !data.transferred_to_admin) {
                    this.appendMessage('ai', data.message, data.timestamp, data.attachments || []);
                }
                if (data.transferred_to_admin) {
                    this.handleTransferToAdmin(data);
                }
            }
        });

        this.socket.on('transferred_to_admin', (data) => {
            if (String(data.ticketId) === String(this.ticketId)) {
                this.handleTransferToAdmin(data);
            }
        });

        this.socket.on('ticket_completed', (data) => {
            if (String(this.ticketId) === String(data.ticketId)) {
                this.showMessageSystem('✅ Заявка завершена клиентом');
                this.canWrite = false;
                this.disableChat();
            }
        });

        this.socket.on('status_change', (data) => {
            if (String(this.ticketId) === String(data.ticketId) && (data.newStatus === 'completed' || data.newStatus === 'resolved')) {
                this.showMessageSystem('✅ Заявка завершена');
                this.canWrite = false;
                this.disableChat();
            }
        });
    }

    setupEventListeners() {
        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', () => this.sendMessage());
        }
        
        if (this.messageInput) {
            this.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        if (this.aiResponseBtn) {
            this.aiResponseBtn.addEventListener('click', () => this.getAiResponse());
        }

        if (this.adminBtn) {
            this.adminBtn.addEventListener('click', () => this.transferToAdmin());
        }

        if (this.completeBtn) {
            this.completeBtn.addEventListener('click', () => this.completeTicket());
        }
    }

    async joinTicketRoom(ticketId) {
        this.ticketId = ticketId;
        
        await this.loadChatHistoryHttp(ticketId);
        
        if (this.socket && this.socket.connected) {
            this.socket.emit('join_ticket_room', ticketId);
        }
        
        this.canWrite = true;
        this.enableChat();
        
        if (this.statusBadge) {
            try {
                const response = await fetch(`/api/tickets/${ticketId}`, {
                    credentials: 'include'
                });
                const ticket = await response.json();
                this.statusBadge.textContent = `Заявка #${ticketId} | Категория: ${ticket.category_name || 'Не определена'} | ✏️ Можно писать`;
            } catch (err) {
                this.statusBadge.textContent = `Заявка #${ticketId} | ✏️ Можно писать`;
            }
            this.statusBadge.style.background = 'rgba(245, 158, 11, 0.2)';
        }
    }

    async loadChatHistoryHttp(ticketId) {
        try {
            const response = await fetch(`/api/expert/tickets/${ticketId}/chat-history`, {
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
            console.error('ExpertChat: Load history error', err);
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
        this.appendMessage('expert', message, new Date().toISOString(), []);
        if (this.messageInput) this.messageInput.value = '';

        try {
            const response = await fetch(`/api/expert/tickets/${this.ticketId}/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ message })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                console.error('ExpertChat: Send error', data.error);
                this.showMessageSystem('❌ Ошибка отправки');
                const lastMsg = this.messagesContainer.lastChild;
                if (lastMsg && lastMsg.querySelector('.message-text')?.textContent === message) {
                    lastMsg.remove();
                }
            } else if (this.socket && this.socket.connected) {
                this.socket.emit('chat_message', {
                    ticketId: this.ticketId,
                    message: message,
                    userId: this.currentExpertId,
                    expertId: this.currentExpertId,
                    expertName: this.expertName,
                    sender: 'expert',
                    timestamp: new Date().toISOString()
                });
            }
        } catch (err) {
            console.error('ExpertChat: Network error', err);
            this.showMessageSystem('❌ Ошибка сети');
            const lastMsg = this.messagesContainer.lastChild;
            if (lastMsg && lastMsg.querySelector('.message-text')?.textContent === message) {
                lastMsg.remove();
            }
        }
    }

    async getAiResponse() {
        if (!this.ticketId) return;

        if (this.aiResponseBtn) {
            this.aiResponseBtn.disabled = true;
            this.aiResponseBtn.textContent = '⏳ Загрузка...';
        }

        try {
            const res = await fetch(`/api/expert/tickets/${this.ticketId}/ai-response`, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await res.json();

            if (data.success && data.data?.response && this.messageInput) {
                this.messageInput.value = data.data.response;
                this.showMessageSystem('🤖 Ответ от AI получен');
                this.messageInput.focus();
            } else {
                this.showMessageSystem('❌ Ошибка получения ответа от AI');
            }
        } catch (err) {
            console.error('ExpertChat: AI response error', err);
            this.showMessageSystem('❌ Ошибка сети');
        } finally {
            if (this.aiResponseBtn) {
                this.aiResponseBtn.disabled = false;
                this.aiResponseBtn.textContent = '🤖 Ответ от AI';
            }
        }
    }

    transferToAdmin() {
        if (!this.ticketId) return;

        if (!confirm('⚠️ Вы уверены, что хотите передать эту заявку администратору?')) return;

        if (this.adminBtn) {
            this.adminBtn.disabled = true;
            this.adminBtn.textContent = '⏳ Передача...';
        }

        fetch(`/api/expert/tickets/${this.ticketId}/transfer-admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                this.showMessageSystem('Заявка передана администратору');
                this.canWrite = false;
                this.disableChat();
                if (this.socket && this.socket.connected) {
                    this.socket.emit('transfer_to_admin', { ticketId: this.ticketId });
                }
                if (this.statusBadge) {
                    this.statusBadge.textContent = `Заявка #${this.ticketId} | Передана администратору`;
                    this.statusBadge.style.background = 'rgba(244, 67, 54, 0.3)';
                }
            } else {
                this.showMessageSystem('Ошибка: ' + (data.error || 'Неизвестная ошибка'));
                if (this.adminBtn) {
                    this.adminBtn.disabled = false;
                    this.adminBtn.textContent = 'Админу';
                }
            }
        })
        .catch(err => {
            console.error('ExpertChat: Transfer error', err);
            this.showMessageSystem('Ошибка сети');
            if (this.adminBtn) {
                this.adminBtn.disabled = false;
                this.adminBtn.textContent = 'Админу';
            }
        });
    }

    completeTicket() {
        if (!this.ticketId) return;

        if (!confirm('✅ Вы уверены, что хотите завершить эту заявку?')) return;

        if (this.completeBtn) {
            this.completeBtn.disabled = true;
            this.completeBtn.textContent = '⏳ Завершение...';
        }

        fetch(`/api/expert/tickets/${this.ticketId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                this.showMessageSystem('✅ Заявка завершена');
                this.canWrite = false;
                this.disableChat();
                
                if (this.socket && this.socket.connected) {
                    console.log('ExpertChat: Sending ticket_completed for ticket:', this.ticketId);
                    this.socket.emit('ticket_completed', { 
                        ticketId: this.ticketId,
                        completedBy: this.expertName,
                        timestamp: new Date().toISOString()
                    });
                }
                
                if (this.statusBadge) {
                    this.statusBadge.textContent = `Заявка #${this.ticketId} | Завершена`;
                    this.statusBadge.style.background = 'rgba(76, 175, 80, 0.3)';
                }
                this.addCompletionMessage();
            } else {
                this.showMessageSystem('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'));
                if (this.completeBtn) {
                    this.completeBtn.disabled = false;
                    this.completeBtn.textContent = '✅ Завершить';
                }
            }
        })
        .catch(err => {
            console.error('ExpertChat: Complete error', err);
            this.showMessageSystem('❌ Ошибка сети');
            if (this.completeBtn) {
                this.completeBtn.disabled = false;
                this.completeBtn.textContent = '✅ Завершить';
            }
        });
    }

    handleTransferToAdmin(data) {
        this.isTransferredToAdmin = true;
        if (this.statusBadge) {
            this.statusBadge.textContent = `Чат с клиентом (Передан администратору: ${data.adminName || 'администратор'})`;
        }
        this.showMessageSystem(`Заявка передана администратору: ${data.adminName || 'администратор'}`);
        this.disableChat();
    }

    enableChat() {
        if (this.messageInput) {
            this.messageInput.disabled = false;
            this.messageInput.placeholder = 'Напишите сообщение...';
            this.messageInput.focus();
        }
        if (this.sendBtn) this.sendBtn.disabled = false;
        if (this.aiResponseBtn) this.aiResponseBtn.disabled = false;
        if (this.adminBtn) this.adminBtn.disabled = false;
        if (this.completeBtn) this.completeBtn.disabled = false;
    }

    disableChat() {
        if (this.messageInput) {
            this.messageInput.disabled = true;
            this.messageInput.placeholder = 'Чат недоступен';
        }
        if (this.sendBtn) this.sendBtn.disabled = true;
        if (this.aiResponseBtn) this.aiResponseBtn.disabled = true;
        if (this.adminBtn) this.adminBtn.disabled = true;
        if (this.completeBtn) this.completeBtn.disabled = true;
    }

    appendMessage(sender, message, timestamp, attachments = []) {
        if (!this.messagesContainer) return;

        const messageDiv = document.createElement('div');
        
        let senderClass = '';
        switch(sender) {
            case 'client': senderClass = 'client'; break;
            case 'expert': senderClass = 'expert'; break;
            case 'ai': senderClass = 'ai'; break;
            case 'system': senderClass = 'system'; break;
            default: senderClass = 'expert';
        }
        
        messageDiv.className = `universal-msg ${senderClass}`;
        const isRight = (sender === 'expert');
        
        messageDiv.style.cssText = `
            max-width: 70%;
            padding: 14px 20px;
            border-radius: 18px;
            font-size: 15px;
            line-height: 1.5;
            position: relative;
            animation: universalPopIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            align-self: ${isRight ? 'flex-end' : 'flex-start'};
            background: ${sender === 'expert' ? '#f59e0b' : 
                        sender === 'ai' ? 'linear-gradient(135deg, #667eea, #764ba2)' :
                        sender === 'client' ? '#2d3748' : 
                        sender === 'system' ? '#6c757d' : '#4a5568'};
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
                        msg.sender === 'expert' ? 'expert' : 
                        msg.sender === 'ai' ? 'ai' : 
                        msg.sender === 'system' ? 'system' : 'expert';
            this.appendMessage(sender, msg.message || msg.text, msg.created_at, msg.attachments || []);
        });
        
        this.scrollToBottom();
    }

    addCompletionMessage() {
        if (!this.messagesContainer) return;
        
        const completionDiv = document.createElement('div');
        completionDiv.className = 'completion-message';
        completionDiv.style.cssText = 'text-align: center; padding: 20px; margin: 20px auto; background: #e8f5e9; border-radius: 10px; max-width: 80%;';
        
        completionDiv.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
            <div style="font-weight: bold; margin-bottom: 10px;">Заявка завершена</div>
            <div style="color: #666;">Чат закрыт. Спасибо за работу!</div>
        `;
        
        this.messagesContainer.appendChild(completionDiv);
        this.scrollToBottom();
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
        
        setTimeout(() => {
            if (systemDiv.parentNode) systemDiv.remove();
        }, 5000);
    }

    showNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body: body });
        } else if ('Notification' in window && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
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
            if (this.ticketId) {
                this.socket.emit('leave_ticket_room', this.ticketId);
            }
            this.socket.disconnect();
            this.socket = null;
        }
    }
}

// Глобальный экземпляр
let expertChatInstance = null;

// Глобальная функция инициализации
window.initExpertChat = async (ticketId = null) => {
    try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) throw new Error('Not authorized');

        const data = await res.json();
        const user = data.user;

        if (!user || user.role_id !== 3) {
            throw new Error('User is not an expert');
        }

        if (expertChatInstance) {
            expertChatInstance.disconnect();
            expertChatInstance = null;
        }

        expertChatInstance = new ExpertChat();
        
        if (ticketId) {
            await expertChatInstance.init(ticketId, user.id, user.full_name);
        } else {
            await expertChatInstance.init(null, user.id, user.full_name);
        }
        
        window.expertChatInstance = expertChatInstance;
        return expertChatInstance;
    } catch (error) {
        console.error('ExpertChat: Init error', error);
        throw error;
    }
};

// Очистка при уходе со страницы
window.addEventListener('beforeunload', () => {
    if (expertChatInstance) {
        expertChatInstance.disconnect();
    }
    window.expertChatInstance = null;
});