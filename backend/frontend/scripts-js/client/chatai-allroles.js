// ---------------------------- КЛАСС AIChat -------------------------------
// ОСНОВНОЙ КЛАСС ДЛЯ УПРАВЛЕНИЯ ЧАТОМ С AI И ОПЕРАТОРАМИ

class AIChat {
    // ---------------------------- СТАТИЧЕСКАЯ КОНФИГУРАЦИЯ -------------------------------
    static CONFIG = {
        MAX_MESSAGE_CACHE: 500,
        SOCKET_TIMEOUT: 5000,
        MAX_FILE_SIZE: 10 * 1024 * 1024,
        ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        TICKET_STATUS_CLOSED: [5, 6],
        OPTIMISTIC_UPDATE_TIMEOUT: 5000,
        RECONNECT_DELAY: 1000,
        RECONNECT_ATTEMPTS: 10,
        DEDUP_WINDOW_MS: 3000,
        MAX_ATTACHMENTS_PER_MESSAGE: 5,
        OPTIMISTIC_MESSAGE_TIMEOUT: 30000,
        HEARTBEAT_INTERVAL: 30000,
        MESSAGE_DEDUP_WINDOW: 10000
    };

    // ---------------------------- КОНСТРУКТОР -------------------------------
    constructor() {
        this.socket = null;
        this.currentTicketId = null;
        this.userId = null;
        this.messages = [];
        this.isConnected = false;
        this.isTransferredToOperator = false;
        this.isWaitingForOperator = false;
        this.operatorName = null;
        this.operatorId = null;
        this.hasRequestedOperator = false;
        this.isChatCompleted = false;
        this.isInitialized = false;
        this.isJoinedToRoom = false;
        this.waitingForAIResponse = false;
        this.selectedFiles = [];
        this.addedMessageIds = new Map();
        this.pendingFiles = null;
        this.messagesContainer = null;
        this.historyLoaded = false;
        this.lastSentTime = null;
        this.lastSentMessage = null;
        this.listenersAttached = false;
        this.optimisticMessages = new Map();
        this._msgCounter = 0;
        this.pendingFileUpload = false;
        this.welcomeMessageAdded = false;
        this.firstUserMessageSent = false;
        this._removingWelcome = false;
        this._renderScheduled = false;
        this._recentHashes = new Map();
        this._hashCleanupInterval = setInterval(() => {
            const now = Date.now();
            const window = AIChat.CONFIG.MESSAGE_DEDUP_WINDOW;
            for (const [hash, time] of this._recentHashes.entries()) {
                if (now - time > window) {
                    this._recentHashes.delete(hash);
                }
            }
        }, 5000);
        
        this.heartbeatInterval = null;
        this._optimisticCleanupTimer = null;
    }

    // ---------------------------- ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ КЛЮЧЕЙ -------------------------------
    getMessageKey(message, source = 'unknown') {
        const time = message.created_at || new Date().toISOString();
        const text = (message.message || '').trim();
        const base = `${message.sender}|${text}|${time}|${source}`;
        return message.isOptimistic ? `${base}|opt|${Date.now()}` : base;
    }

    getFileMessageKey(message, source = 'unknown') {
        if (!message.attachments?.length) return null;
        const fileHash = message.attachments
            .map(f => `${f.filename || f.name}_${f.size || 0}`)
            .sort()
            .join('||');
        const time = message.created_at || new Date().toISOString();
        const base = `${message.sender}|files|${fileHash}|${time}|${source}`;
        return message.isOptimistic ? `${base}|opt|${Date.now()}` : base;
    }

    hashMessageContent(message) {
        const text = (message.message || '').trim().toLowerCase();
        const files = (message.attachments || [])
            .map(f => `${(f.filename || f.name || '').toLowerCase()}_${f.size || 0}`)
            .sort()
            .join(',');
        const sender = message.sender || 'unknown';
        return `${sender}|${text}|${files}`;
    }

    // ---------------------------- ПРОВЕРКА НА ДУБЛЬ -------------------------------
    isDuplicate(message, source = 'unknown') {
        const contentHash = this.hashMessageContent(message);
        const msgTime = new Date(message.created_at || message.timestamp || Date.now()).getTime();
        const now = Date.now();
        const window = AIChat.CONFIG.MESSAGE_DEDUP_WINDOW;
        
        if (this._recentHashes.has(contentHash)) {
            const hashTime = this._recentHashes.get(contentHash);
            if (Math.abs(now - hashTime) < window) {
                return true;
            }
        }
        
        this._recentHashes.set(contentHash, now);
        
        for (const existing of this.messages) {
            const existingTime = new Date(existing.created_at || existing.timestamp).getTime();
            if (Math.abs(existingTime - msgTime) > window) continue;
            if (existing.sender !== message.sender) continue;
            
            const sameText = (existing.message || '').trim().toLowerCase() === 
                          (message.message || '').trim().toLowerCase();
            if (!sameText) continue;
            
            const exFiles = (existing.attachments || [])
                .map(f => `${(f.filename || f.name || '').toLowerCase()}_${f.size}`)
                .sort().join(',');
            const msgFiles = (message.attachments || [])
                .map(f => `${(f.filename || f.name || '').toLowerCase()}_${f.size}`)
                .sort().join(',');
                
            if (exFiles === msgFiles) return true;
        }
        return false;
    }

    // ---------------------------- ОСНОВНОЙ МЕТОД ДОБАВЛЕНИЯ СООБЩЕНИЙ -------------------------------
    addMessageIfNotExists(message, source = 'unknown') {
        if (!message) return false;
        
        if (!message.message?.trim() && (!message.attachments || message.attachments.length === 0)) {
            return false;
        }
        
        if (message.sender === 'system' || message.sender === 'operator') {
            if (message.isSystemNotification || message.isInitialGreeting) {
                // Показываем
            } else {
                const skipPatterns = [
                    /создана и передана/i,
                    /назначен на заявку/i,
                    /техническое обновление статуса/i,
                    /auto_escalation/i
                ];
                if (skipPatterns.some(p => p.test(message.message || ''))) {
                    return false;
                }
                if (!message.message?.trim() && (!message.attachments || !message.attachments.length)) {
                    return false;
                }
            }
        }

        if (message.sender === 'client' && !message.isOptimistic) {
            if (this._tryReplaceOptimistic(message, source)) return true;
        }

        if (this.isDuplicate(message, source)) {
            return false;
        }

        const key = message.attachments?.length > 0 
            ? this.getFileMessageKey(message, source) 
            : this.getMessageKey(message, source);
            
        if (!key || this.addedMessageIds.has(key)) return false;

        this.messages.push(message);
        this.addedMessageIds.set(key, message);

        if (this.addedMessageIds.size > AIChat.CONFIG.MAX_MESSAGE_CACHE) {
            this._evictOldestMessage();
        }
        return true;
    }

    _evictOldestMessage() {
        const firstKey = this.addedMessageIds.keys().next().value;
        if (!firstKey) return;
        
        const oldMsg = this.addedMessageIds.get(firstKey);
        this.addedMessageIds.delete(firstKey);
        
        const idx = this.messages.indexOf(oldMsg);
        if (idx > -1) {
            this.cleanupObjectUrls(oldMsg);
            this.messages.splice(idx, 1);
        }
    }

    cleanupObjectUrls(message) {
        if (!message?.attachments?.length) return;
        message.attachments.forEach(att => { 
            if (att.url?.startsWith('blob:')) {
                try { URL.revokeObjectURL(att.url); } 
                catch (e) { /* Игнорируем */ }
            }
        });
    }

    // ---------------------------- ИНИЦИАЛИЗАЦИЯ ЧАТА -------------------------------
    async init(ticketId = null) {
        if (this.isInitialized) return;
        this.messagesContainer = document.getElementById('chatMessages');
        await this.getUserData();
        this.requestNotificationPermission();
        this.connectWebSocket();
        await this.waitForSocketConnection();
        if (ticketId) this.currentTicketId = ticketId;
        await this.loadOrCreateChat();
        this.render();
        this.startHeartbeat();
        this.startOptimisticCleanup();
        this.isInitialized = true;
    }

    startHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = setInterval(() => {
            if (this.socket?.connected) {
                this.socket.emit('ping');
            }
        }, AIChat.CONFIG.HEARTBEAT_INTERVAL);
    }

    startOptimisticCleanup() {
        if (this._optimisticCleanupTimer) clearInterval(this._optimisticCleanupTimer);
        this._optimisticCleanupTimer = setInterval(() => {
            const now = Date.now();
            for (const [key, msg] of this.optimisticMessages) {
                const msgTime = new Date(msg.created_at).getTime();
                if (now - msgTime > AIChat.CONFIG.OPTIMISTIC_MESSAGE_TIMEOUT) {
                    this.optimisticMessages.delete(key);
                    const idx = this.messages.indexOf(msg);
                    if (idx > -1) {
                        this.messages.splice(idx, 1);
                        this.sortAndRender();
                    }
                }
            }
        }, 10000);
    }

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    async waitForSocketConnection(timeoutMs = AIChat.CONFIG.SOCKET_TIMEOUT) {
        if (this.socket && this.isConnected) return true;
        return new Promise(resolve => {
            const start = Date.now();
            const check = setInterval(() => {
                if (this.isConnected) { 
                    clearInterval(check); 
                    resolve(true); 
                } else if (Date.now() - start > timeoutMs) { 
                    clearInterval(check); 
                    resolve(false); 
                }
            }, 100);
        });
    }

    showNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted' && !document.hasFocus()) {
            new Notification(title, { body, icon: '/files/logo-site.png' });
        }
    }

    async getUserData() {
        try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            const data = await res.json();
            if (data.user) this.userId = data.user.id;
        } catch (e) { 
            console.error('AIChat: getUserData error', e); 
        }
    }

    // ---------------------------- WEBSOCKET СОЕДИНЕНИЕ -------------------------------
    connectWebSocket() {
        if (this.socket?.connected) return;
        const wsUrl = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const fullUrl = `${wsUrl}//${window.location.host}`;
        if (this.socket) { 
            this.socket.removeAllListeners(); 
            this.socket.disconnect(); 
        }

        this.socket = io(fullUrl, {
            withCredentials: true, 
            transports: ['websocket', 'polling'],
            reconnection: true, 
            reconnectionAttempts: AIChat.CONFIG.RECONNECT_ATTEMPTS,
            reconnectionDelay: AIChat.CONFIG.RECONNECT_DELAY
        });

        this.socket.on('connect', () => {
            this.isConnected = true;
            if (this.userId) this.socket.emit('register', this.userId);
            if (this.currentTicketId) this.joinTicketRoom();
        });

        this.socket.on('operator_assigned', (data) => {
            this.isTransferredToOperator = true;
            this.isWaitingForOperator = false;
            this.operatorName = data.operatorName;
            this.operatorId = data.operatorId;
    
            this.updateInputState();
        });

        this.socket.on('operator_already_assigned', (data) => {
            this.showNotification('Оператор уже на связи', data.operatorName);
        });

        this.socket.on('pong', () => {});

        this.socket.on('new_message', (data) => {
            if (!this.currentTicketId && data.ticketId) {
                this.currentTicketId = data.ticketId;
                if (this.socket?.connected) {
                    this.socket.emit('join_ticket_room', this.currentTicketId);
                    this.isJoinedToRoom = true;
                }
            }

            if (String(this.currentTicketId) !== String(data.ticketId)) return;
            
            const hasText = data.message && data.message.trim().length > 0;
            const hasFiles = data.attachments && data.attachments.length > 0;
            if (!hasText && !hasFiles) return;

            const senderMap = { client: 'client', user: 'client', operator: 'operator', ai: 'ai', bot: 'ai', system: 'system' };
        
            const message = {
                id: data.id || Date.now(),
                sender: senderMap[data.sender] || 'ai',
                message: data.message || '',
                attachments: data.attachments || [],
                created_at: data.timestamp || new Date().toISOString(),
                isSystemNotification: data.isSystemNotification || false,
                isInitialGreeting: data.isInitialGreeting || false
            };

            if (this.addMessageIfNotExists(message, 'new_message')) {
                this.sortAndRender();
                
                if (message.sender === 'client' && !this.firstUserMessageSent) {
                    this.removeWelcomeMessageIfNeeded();
                    this.firstUserMessageSent = true;
                    this.sortAndRender();
                }

                const input = document.getElementById('chatInput');
                if (input) input.disabled = false;
                this.waitingForAIResponse = false;
                this.pendingFileUpload = false;
            }
        });

        this.socket.on('ticket_created_with_operator', (data) => {
            this.currentTicketId = data.ticketId;
            this.isTransferredToOperator = true;
            this.isWaitingForOperator = false;
            this.operatorName = data.operatorName;
            this.operatorId = data.operatorId;
            
            this.joinTicketRoom();
            this.updateInputState();
            
            if (this.pendingFiles?.length) {
                const files = [...this.pendingFiles];
                this.pendingFiles = null;
                this.uploadFilesAndSendMessage(this.currentTicketId, files, '');
            }
            
            setTimeout(() => {
                if (this.messages.length === 0 && this.historyLoaded === false) {
                    this.loadChatHistory();
                }
            }, 1500);
        });

        this.socket.on('ticket_created_waiting', (data) => {
            this.currentTicketId = data.ticketId;
            this.isWaitingForOperator = true;
            this.joinTicketRoom();
            this.updateInputState();
            
            if (this.pendingFiles?.length) {
                const files = [...this.pendingFiles];
                this.pendingFiles = null;
                this.uploadFilesAndSendMessage(this.currentTicketId, files, '');
            }
        });

        this.socket.on('ticket_created', (data) => {
            this.currentTicketId = data.ticketId;
            this.joinTicketRoom();
            this.updateInputState();
        });

        this.socket.on('ticket_completed', (data) => {
            console.log('AIChat: ticket_completed received', data);
            if (String(this.currentTicketId) === String(data.ticketId) && !this.isChatCompleted) {
                this.isChatCompleted = true;
                this.isWaitingForOperator = false;
                this.isTransferredToOperator = false;
                
                // Обновляем состояние UI
                this.updateInputState();
                
                // Показываем сообщение
                this.showSystemMessage('✅ Чат завершен. Спасибо за обращение!');
                
                // Показываем форму оценки
                this.showCompletionMessage();
                
                // Отключаем кнопки
                const sendBtn = document.getElementById('sendBtn');
                const attachBtn = document.getElementById('attachBtn');
                if (sendBtn) sendBtn.disabled = true;
                if (attachBtn) attachBtn.disabled = true;
            }
        });

        this.socket.on('chat_history', (data) => {
            if (String(data.ticketId) === String(this.currentTicketId) && !this.historyLoaded) {
                this.historyLoaded = true;
                this.renderHistory(data.messages || []);
            }
        });

        this.socket.on('room_joined', () => { 
            this.isJoinedToRoom = true; 
        });
        
        this.socket.on('disconnect', (reason) => {
            this.isConnected = false;
            this.isJoinedToRoom = false;
            if (this.currentTicketId && reason === 'io server disconnect') {
                this.socket.once('connect', () => {
                    if (this.userId) this.socket.emit('register', this.userId);
                    setTimeout(() => this.joinTicketRoom(), 500);
                });
            }
        });
        
        this.socket.on('reconnect', () => {
            this.isConnected = true;
            if (this.currentTicketId) this.joinTicketRoom();
        });
    }

    // ---------------------------- УПРАВЛЕНИЕ ПРИВЕТСТВИЕМ -------------------------------
    addWelcomeMessage() {
        if (this.welcomeMessageAdded) return;
        const msg = { 
            sender: 'ai', 
            message: '👋 Здравствуйте! Я виртуальный помощник. Чем могу помочь?',
            created_at: new Date().toISOString()
        };
        if (this.addMessageIfNotExists(msg, 'welcome')) {
            this.welcomeMessageAdded = true;
            this.sortAndRender();
        }
    }

    removeWelcomeMessageIfNeeded() {
        if (!this.welcomeMessageAdded || this.firstUserMessageSent) return;
        if (this._removingWelcome) return;
        
        this._removingWelcome = true;
        
        try {
            const welcomeText = '👋 Здравствуйте! Я виртуальный помощник. Чем могу помочь?';
            const idx = this.messages.findIndex(m => 
                m.sender === 'ai' && 
                m.message === welcomeText &&
                !m.isOptimistic
            );

            if (idx !== -1) {
                this.messages.splice(idx, 1);
                
                for (const [key, val] of this.addedMessageIds) {
                    if (val === this.messages[idx] || 
                        (val.sender === 'ai' && val.message === welcomeText)) {
                        this.addedMessageIds.delete(key);
                        break;
                    }
                }
                
                this.welcomeMessageAdded = false;
                this.firstUserMessageSent = true;
            }
        } finally {
            this._removingWelcome = false;
        }
    }

    joinTicketRoom() {
        if (this.currentTicketId && this.socket?.connected) {
            this.socket.emit('join_ticket_room', this.currentTicketId);
            this.isJoinedToRoom = true;
            setTimeout(() => { 
                if (!this.historyLoaded) this.loadChatHistory(); 
            }, 800);
        }
    }

    // ---------------------------- ЗАГРУЗКА ИСТОРИИ -------------------------------
    renderHistory(messages) {
        if (!messages?.length) {
            if (!this.messages.length) {
                this.addWelcomeMessage();
            }
            this.sortAndRender();
            return;
        }
        
        const senderMap = { client: 'client', user: 'client', operator: 'operator', ai: 'ai', bot: 'ai', system: 'system' };
        
        const filteredMessages = messages.filter(m => {
            if (m.sender === 'system' || m.sender === 'operator') {
                const hideList = ['создана и передана', 'назначен на заявку', 'Заявка #', 'Заявка #', 'Здравствуйте! Я ваш оператор'];
                if (hideList.some(hide => m.text?.includes(hide))) {
                    return false;
                }
                if (!m.text || m.text === '') return false;
            }
            return true;
        });
        
        for (const m of filteredMessages) {
            const msg = {
                id: m.id, 
                sender: senderMap[m.sender] || 'ai', 
                message: m.text || m.message,
                attachments: m.attachments || m.files || [], 
                created_at: m.created_at || new Date().toISOString()
            };
            
            if (!msg.message && (!msg.attachments || !msg.attachments.length)) {
                continue;
            }
            
            this.addMessageIfNotExists(msg, 'history');
        }
        this.sortAndRender();
        
        const hasUserOrOperator = this.messages.some(m => 
            m.sender === 'client' || m.sender === 'operator'
        );

        if (!hasUserOrOperator && !this.messages.some(m => 
            m.sender === 'ai' && m.message?.includes('виртуальный помощник')
        )) {
            this.addWelcomeMessage();
        }
        
        if (this.messages.some(m => m.sender === 'ai' && m.message?.includes('виртуальный помощник'))) {
            this.welcomeMessageAdded = true;
        }
        
        if (this.messages.some(m => m.sender === 'client')) {
            this.firstUserMessageSent = true;
            this.removeWelcomeMessageIfNeeded();
        }
        
        if (this.messages.some(m => m.sender === 'operator')) {
            this.isTransferredToOperator = true;
            this.isWaitingForOperator = false;
            this.updateInputState();
        }
    }

    sortAndRender() {
        this.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        this.renderMessages();
        this.scrollToBottom();
    }

    async loadOrCreateChat() {
        if (this.currentTicketId) { 
            this.joinTicketRoom(); 
            return; 
        }
        try {
            const res = await fetch('/api/tickets/my', { credentials: 'include' });
            const tickets = await res.json();
            const active = tickets.data?.find(t => !AIChat.CONFIG.TICKET_STATUS_CLOSED.includes(t.status_id));
            if (!active) {
                this.addWelcomeMessage();
            }
            if (active) { 
                this.currentTicketId = active.id; 
                this.joinTicketRoom(); 
            }
        } catch (e) { 
            console.error('AIChat: loadOrCreateChat error', e); 
            this.addWelcomeMessage();
        }
    }

    loadChatHistory() {
        if (!this.currentTicketId || !this.socket?.connected || this.historyLoaded) return;
        this.socket.emit('get_chat_history', { ticketId: this.currentTicketId });
    }

    // ---------------------------- РАБОТА С ФАЙЛАМИ -------------------------------
    async uploadFilesAndSendMessage(ticketId, files, messageText) {
        const uploaded = await this.uploadFilesWithRetry(ticketId, files);
        if (uploaded.length && this.socket?.connected) {
            this.socket.emit('chat_message', {
                ticketId: ticketId,
                message: messageText,
                userId: this.userId,
                sender: 'client',
                isCallingOperator: true,
                hasImages: true,
                attachments: uploaded,
                timestamp: new Date().toISOString(),
                hasOptimistic: true
            });
        }
        this.pendingFileUpload = false;
    }

    async uploadPendingFiles(ticketId, files = null) {
        const f = files || this.pendingFiles;
        if (!f?.length) return;
        this.pendingFiles = null;
        const uploaded = await this.uploadFilesWithRetry(ticketId, f);
        if (uploaded.length && this.socket?.connected) {
            this.socket.emit('chat_message', {
                ticketId: ticketId,
                message: '',
                userId: this.userId,
                sender: 'client',
                isCallingOperator: true,
                hasImages: true,
                attachments: uploaded,
                timestamp: new Date().toISOString(),
                hasOptimistic: true
            });
        }
    }
    
    async uploadFilesWithRetry(ticketId, files, maxRetries = 3) {
            const uploaded = [];
            for (const file of files) {
                let retries = 0;
                let success = false;
                
                while (!success && retries < maxRetries) {
                    const formData = new FormData();
                    // ВАЖНО: ключ должен быть 'file' (как в multer upload.single('file') или upload.array('file'))
                    formData.append('file', file);
                    
                    try {
                        const res = await fetch(`/api/tickets/${ticketId}/attachments`, { 
                            method: 'POST', 
                            credentials: 'include', 
                            body: formData
                        });
                        
                        if (!res.ok) {
                            const errorData = await res.json().catch(() => ({}));
                            throw new Error(errorData.error || `HTTP ${res.status}`);
                        }
                        
                        const data = await res.json();
                        // Проверяем структуру ответа
                        if (data.success && data.data) {
                            uploaded.push(data.data);
                        } else if (data.file || data.attachment) {
                            uploaded.push(data.file || data.attachment);
                        } else if (data.url || data.path) {
                            uploaded.push(data);
                        } else {
                            uploaded.push({ url: data.url, filename: file.name, size: file.size });
                        }
                        
                        success = true;
                        
                    } catch (e) {
                        retries++;
                        console.error(`Upload failed for ${file.name}, retry ${retries}/${maxRetries}`, e);
                        
                        if (retries === maxRetries) {
                            this.showError(`Не удалось загрузить: ${file.name}`);
                        } else {
                            await new Promise(r => setTimeout(r, 1000 * retries));
                        }
                    }
                }
            }
            return uploaded;
        }

    // ---------------------------- ОТПРАВКА СООБЩЕНИЯ -------------------------------
    async sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input?.value.trim() || '';
        const hasFiles = this.selectedFiles.length > 0;
        
        if (!message && !hasFiles) return;
        if (this.isChatCompleted) { 
            this.showError('Чат завершен'); 
            return; 
        }
        if (this.waitingForAIResponse && !this.isTransferredToOperator) { 
            this.showError('Подождите ответа AI'); 
            return; 
        }
        if (this.pendingFileUpload) {
            this.showError('Файлы уже загружаются');
            return;
        }
        
        if (hasFiles && this.selectedFiles.length > AIChat.CONFIG.MAX_ATTACHMENTS_PER_MESSAGE) {
            this.showError(`Максимум ${AIChat.CONFIG.MAX_ATTACHMENTS_PER_MESSAGE} файлов за раз`);
            return;
        }
        
        const text = message;
        if (input) { 
            input.value = ''; 
            input.disabled = true; 
        }
        
        this.lastSentMessage = text;
        this.lastSentTime = Date.now();
        const hasImages = this.selectedFiles.some(f => f.type?.startsWith('image/'));
        
        const shouldAddOptimistic = (!hasFiles) || (hasFiles && this.currentTicketId && text);
        
        if (shouldAddOptimistic && (text || (hasFiles && text))) {
            const localMsg = {
                sender: 'client',
                message: text,
                attachments: [],
                created_at: new Date().toISOString(),
                isOptimistic: true
            };
            const key = this.getMessageKey(localMsg);
            this.optimisticMessages.set(key, localMsg);
            if (this.addMessageIfNotExists(localMsg, 'local')) {
                this.sortAndRender();
            }
        }
        
        if (hasFiles && !this.currentTicketId) {
            this.pendingFiles = [...this.selectedFiles];
            this.pendingFileUpload = true;
            this.clearSelectedFiles();
        } else if (hasFiles && this.currentTicketId) {
            this.pendingFileUpload = true;
            const files = [...this.selectedFiles];
            this.clearSelectedFiles();
            const uploaded = await this.uploadFilesWithRetry(this.currentTicketId, files);
            this.pendingFileUpload = false;
            
            if (uploaded.length && this.socket?.connected) {
                this.socket.emit('chat_message', {
                    ticketId: this.currentTicketId,
                    message: text,
                    userId: this.userId,
                    sender: 'client',
                    isCallingOperator: true,
                    hasImages: true,
                    attachments: uploaded,
                    timestamp: new Date().toISOString(),
                    hasOptimistic: true
                });
            } else if (text && this.socket?.connected) {
                this.socket.emit('chat_message', {
                    ticketId: this.currentTicketId,
                    message: text,
                    userId: this.userId,
                    sender: 'client',
                    isCallingOperator: false,
                    hasImages: false,
                    attachments: [],
                    timestamp: new Date().toISOString()
                });
            }
            
            setTimeout(() => {
                if (input?.disabled && !this.waitingForAIResponse && !this.isWaitingForOperator && !this.isTransferredToOperator) {
                    input.disabled = false;
                }
            }, 5000);
            return;
        }
        
        if (this.socket?.connected) {
            this.socket.emit('chat_message', {
                ticketId: this.currentTicketId || null,
                message: text,
                userId: this.userId,
                sender: 'client',
                isCallingOperator: /оператор|сотрудник|специалист|человек|помогите|переключите|соедините/i.test(text) || hasImages,
                hasImages: hasImages,
                attachments: [],
                timestamp: new Date().toISOString()
            });
        } else {
            if (input) input.disabled = false;
            this.showError('Нет соединения с сервером');
            return;
        }
        
        setTimeout(() => {
            if (input?.disabled && !this.waitingForAIResponse && !this.isWaitingForOperator && !this.isTransferredToOperator) {
                input.disabled = false;
            }
        }, 5000);
    }


    // ---------------------------- ОТРИСОВКА СООБЩЕНИЙ -------------------------------
    renderMessages() {
        if (this._renderScheduled) return;
        this._renderScheduled = true;
        
        requestAnimationFrame(() => {
            this._renderScheduled = false;
            const container = document.getElementById('chatMessages');
            if (!container) return;
            container.innerHTML = '';

            for (const msg of this.messages) {
                if (!msg.message?.trim() && (!msg.attachments || msg.attachments.length === 0)) continue;

                if (msg.sender === 'system') {
                    const sysDiv = document.createElement('div');
                    sysDiv.className = 'universal-msg system';
                    sysDiv.style.cssText = `
                        text-align: center; 
                        margin: 14px auto; 
                        font-size: 12px; 
                        color: #94a3b8; 
                        padding: 8px 16px; 
                        background: rgba(100, 116, 139, 0.2);
                        border-radius: 20px;
                        max-width: 80%;
                    `;
                    sysDiv.textContent = msg.message;
                    container.appendChild(sysDiv);
                    continue;
                }

                const messageDiv = document.createElement('div');
                const senderClass = msg.sender === 'client' ? 'client' : 
                                   msg.sender === 'operator' ? 'operator' :
                                   msg.sender === 'expert' ? 'expert' :
                                   msg.sender === 'admin' ? 'admin' : 'ai';
                messageDiv.className = `universal-msg ${senderClass}`;
                
                if (msg.sender === 'ai') {
                    messageDiv.setAttribute('data-i18n-ai', 'true');
                    messageDiv.setAttribute('data-original', msg.message || '');
                    messageDiv.setAttribute('data-translated', 'false');
                }
                
                const isRight = (msg.sender === 'operator' || msg.sender === 'admin' || msg.sender === 'expert');
                
                messageDiv.style.cssText = `
                    max-width: 70%;
                    padding: 14px 20px;
                    border-radius: 18px;
                    font-size: 15px;
                    line-height: 1.5;
                    position: relative;
                    animation: universalPopIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    align-self: ${isRight ? 'flex-end' : 'flex-start'};
                    background: ${msg.sender === 'ai' ? 'linear-gradient(135deg, #667eea, #764ba2)' : 
                                msg.sender === 'client' ? '#2d3748' :
                                msg.sender === 'operator' ? '#28a745' :
                                msg.sender === 'admin' ? '#dc3545' : '#4a5568'};
                    color: white;
                `;

                let html = '';
                
                if (msg.message && msg.message.trim()) {
                    html += `<div class="message-text" style="white-space: pre-wrap; line-height: 1.4;">${this.escapeHtml(msg.message)}</div>`;
                }
                
                if (msg.attachments && msg.attachments.length > 0) {
                    html += '<div style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px;">';
                    html += msg.attachments.map(att => {
                        const url = att.url || att.path || (att.filename ? `/uploads/${att.filename}` : null);
                        if (!url) return '';
                        const safeUrl = this.escapeHtml(url).replace(/'/g, "\\'");
                        const isImg = att.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(att.filename || '');
                        return isImg 
                            ? `<img src="${safeUrl}" alt="Изображение" style="max-width: 100%; max-height: 250px; border-radius: 8px; cursor: pointer; object-fit: contain; margin-top: 6px;" class="clickable-image" data-full-url="${safeUrl}">`
                            : `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color: white; text-decoration: underline; font-size: 0.9em;">📄 ${this.escapeHtml(att.filename || 'Файл')}</a>`;
                    }).join('');
                    html += '</div>';
                }

                const timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                html += `<div class="universal-msg-time" style="font-size: 10px; opacity: 0.7; margin-top: 6px; text-align: ${isRight ? 'right' : 'left'};">${timeStr}</div>`;
                
                messageDiv.innerHTML = html;
                container.appendChild(messageDiv);
            }

            container.onclick = (e) => {
                if (e.target.classList.contains('clickable-image')) {
                    window.open(e.target.dataset.fullUrl, '_blank', 'noopener,noreferrer');
                }
            };
            
            this.scrollToBottom();
            
            if (window.translator && window.translator.targetLang !== 'ru') {
                setTimeout(() => {
                    if (window.translator && typeof window.translator.translateAIMessages === 'function') {
                        window.translator.translateAIMessages();
                    }
                }, 100);
            }
        });
    }

    // ---------------------------- ОЦЕНКА И ЗАВЕРШЕНИЕ ЧАТА -------------------------------
    showCompletionMessage() {
        const c = document.getElementById('chatMessages');
        if (!c) return;
        c.innerHTML = `<div class="rating-card" style="max-width: 450px; margin: 40px auto; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 24px; padding: 30px; text-align: center; color: white; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
            <div style="font-size: 56px; margin-bottom: 15px;">🎉</div>
            <h2 style="margin-bottom: 10px;">Спасибо за обращение!</h2>
            <p style="margin-bottom: 25px; opacity: 0.9;">Оцените работу оператора</p>
            <div class="rating-stars" style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: center; gap: 12px; font-size: 48px; cursor: pointer;">${[1,2,3,4,5].map(i=>`<span data-rating="${i}">☆</span>`).join('')}</div>
                <div class="rating-text" style="margin-top: 10px; font-size: 13px; opacity: 0.8;">Нажмите на звезду</div>
            </div>
            <div class="comment-section" style="display: none;">
                <textarea id="ratingComment" placeholder="Ваш комментарий..." style="width: 100%; padding: 12px; border-radius: 16px; border: none; margin-bottom: 15px; font-family: inherit; color: #333;"></textarea>
                <button id="submitRatingBtn" style="background: white; color: #667eea; border: none; padding: 12px 30px; border-radius: 30px; font-weight: bold; cursor: pointer;">Отправить</button>
            </div>
        </div>`;
        this.initRatingStars(c, this.currentTicketId);
    }

    initRatingStars(container, ticketId) {
        const stars = container.querySelectorAll('.rating-stars span');
        let sel = 0;
        stars.forEach(s => s.addEventListener('click', () => {
            sel = parseInt(s.dataset.rating);
            stars.forEach((x, i) => { 
                x.textContent = i < sel ? '★' : '☆'; 
                x.style.color = i < sel ? '#ffd700' : ''; 
            });
            container.querySelector('.comment-section').style.display = 'block';
        }));
        document.getElementById('submitRatingBtn')?.addEventListener('click', async () => {
            if (!sel) return alert('Выберите оценку');
            try {
                const res = await fetch('/api/ratings', {
                    method: 'POST', 
                    headers: {'Content-Type': 'application/json'}, 
                    credentials: 'include',
                    body: JSON.stringify({ 
                        ticket_id: ticketId, 
                        rating: sel, 
                        comment: document.getElementById('ratingComment')?.value || '' 
                    })
                });
                if (res.ok) {
                    container.innerHTML = `<div style="text-align: center; padding: 40px;">
                        <div style="font-size: 56px;">🙏</div>
                        <h3>Спасибо за вашу оценку!</h3>
                        <p>Чат будет закрыт...</p>
                    </div>`;
                    setTimeout(() => window.location.href = '/', 2000);
                }
            } catch (e) { 
                console.error('AIChat: Rating error', e); 
                alert('Не удалось отправить оценку'); 
            }
        });
    }

    // ---------------------------- ВСПОМОГАТЕЛЬНЫЕ UI МЕТОДЫ -------------------------------
    showError(msg) {
        const c = document.getElementById('chatMessages');
        if (c) {
            const d = document.createElement('div');
            Object.assign(d.style, { 
                color: 'red', 
                textAlign: 'center', 
                padding: '10px', 
                background: '#ffe0e0', 
                borderRadius: '10px', 
                margin: '10px' 
            });
            d.textContent = msg; 
            c.appendChild(d); 
            setTimeout(() => d.remove(), 3000);
        }
    }
    showSystemMessage(msg) {
        const c = document.getElementById('chatMessages');
        if (c) {
            const d = document.createElement('div');
            d.style.cssText = `
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
            d.textContent = msg;
            c.appendChild(d);
            this.scrollToBottom();
        }
    }

    scrollToBottom() { 
        const c = document.getElementById('chatMessages'); 
        if (c) c.scrollTop = c.scrollHeight; 
    }

    attachEventListeners() {
        if (this.listenersAttached) return;
        document.getElementById('sendBtn')?.addEventListener('click', () => this.sendMessage());
        const input = document.getElementById('chatInput');
        if (input) {
            input.addEventListener('keypress', e => { 
                if (e.key === 'Enter' && !e.shiftKey) { 
                    e.preventDefault(); 
                    this.sendMessage(); 
                } 
            });
        }
        const attach = document.getElementById('attachBtn'), fileInput = document.getElementById('fileInput');
        if (attach && fileInput) {
            attach.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', e => this.handleFileSelection(e.target.files));
        }
        document.getElementById('clearFilesBtn')?.addEventListener('click', () => this.clearSelectedFiles());
        this.listenersAttached = true;
    }

    render() { 
        this.renderMessages(); 
        this.attachEventListeners();  
        this.updateInputState();
    }

    updateInputState() {
        const i = document.getElementById('chatInput');
        if (!i) return;
        if (this.isChatCompleted) { 
            i.disabled = true; 
            i.placeholder = 'Чат завершен'; 
        } else if (this.isWaitingForOperator) { 
            i.disabled = true; 
            i.placeholder = 'Ожидание оператора...'; 
        } else { 
            i.disabled = false; 
            i.placeholder = 'Введите сообщение...'; 
        }
    }

    escapeHtml(t) { 
        if (!t) return ''; 
        const d = document.createElement('div'); 
        d.textContent = t; 
        return d.innerHTML.replace(/'/g, '&#39;').replace(/"/g, '&quot;'); 
    }

    // ---------------------------- РАБОТА С ФАЙЛАМИ (UI) -------------------------------
    handleFileSelection(files) {
        if (!files?.length) return;
        
        if (this.selectedFiles.length + files.length > AIChat.CONFIG.MAX_ATTACHMENTS_PER_MESSAGE) {
            this.showError(`Максимум ${AIChat.CONFIG.MAX_ATTACHMENTS_PER_MESSAGE} файлов за раз`);
            return;
        }
        
        for (const f of files) {
            if (f.size > AIChat.CONFIG.MAX_FILE_SIZE) { 
                this.showError(`Файл "${f.name}" слишком большой. Макс: 10MB`); 
                continue; 
            }
            if (!AIChat.CONFIG.ALLOWED_FILE_TYPES.includes(f.type)) { 
                this.showError(`Файл "${f.name}" имеет недопустимый тип`); 
                continue; 
            }
            this.selectedFiles.push(f);
        }
        this.renderFilePreview();
    }

    renderFilePreview() {
        const c = document.getElementById('filePreviewContainer'), l = document.getElementById('filePreviewList');
        if (!this.selectedFiles.length) { 
            if (c) c.style.display = 'none'; 
            return; 
        }
        if (c) c.style.display = 'flex';
        if (l) {
            l.innerHTML = '';
            this.selectedFiles.forEach((f, i) => {
                const item = document.createElement('div');
                item.className = 'file-preview-item';
                item.innerHTML = `<span>📷 ${this.escapeHtml(f.name)}</span>`;
                l.appendChild(item);
            });
        }
    }

    removeFile(index) { 
        if (index >= 0 && index < this.selectedFiles.length) { 
            const removed = this.selectedFiles.splice(index, 1)[0];
            if (removed.url?.startsWith('blob:')) {
                URL.revokeObjectURL(removed.url);
            }
            this.renderFilePreview(); 
        } 
    }
    
    clearSelectedFiles() { 
        this.selectedFiles.forEach(file => {
            if (file.url?.startsWith('blob:')) {
                URL.revokeObjectURL(file.url);
            }
        });
        this.selectedFiles = []; 
        const i = document.getElementById('fileInput'); 
        if (i) i.value = ''; 
        this.renderFilePreview(); 
    }

    // ---------------------------- ЗАМЕНА ОПТИМИСТИЧНЫХ СООБЩЕНИЙ -------------------------------
    _tryReplaceOptimistic(serverMsg, source) {
        const srvTime = new Date(serverMsg.created_at || serverMsg.timestamp || Date.now()).getTime();
        
        for (let i = 0; i < this.messages.length; i++) {
            const optMsg = this.messages[i];
            if (optMsg.sender !== 'client' || !optMsg.isOptimistic) continue;

            const optTime = new Date(optMsg.created_at).getTime();
            if (Math.abs(optTime - srvTime) > 30000) continue;
            
            const optText = (optMsg.message || '').trim().toLowerCase();
            const srvText = (serverMsg.message || '').trim().toLowerCase();
            if (optText !== srvText) continue;

            const optFiles = (optMsg.attachments || [])
                .map(f => `${(f.filename || f.name || '').toLowerCase()}_${f.size}`)
                .sort().join('|');
            const srvFiles = (serverMsg.attachments || [])
                .map(f => `${(f.filename || f.name || '').toLowerCase()}_${f.size}`)
                .sort().join('|');
            if (optFiles !== srvFiles) continue;

            const optKey = this.getMessageKey(optMsg, source);
            this.optimisticMessages.delete(optKey);
            
            this.messages[i] = { 
                ...serverMsg, 
                isOptimistic: false, 
                _replacedFromOpt: true,
                created_at: serverMsg.created_at || optMsg.created_at
            };
            const newMsg = this.messages[i];

            for (const [key, val] of this.addedMessageIds) {
                if (val.isOptimistic || key.includes('|opt|')) {
                    this.addedMessageIds.delete(key);
                }
            }

            const newKey = this.getMessageKey(newMsg, source);
            this.addedMessageIds.set(newKey, newMsg);

            this.cleanupObjectUrls(serverMsg);
            return true;
        }
        return false;
    }

    // ---------------------------- ОЧИСТКА РЕСУРСОВ -------------------------------
    destroy() {
        if (this._hashCleanupInterval) {
            clearInterval(this._hashCleanupInterval);
            this._hashCleanupInterval = null;
        }
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this._optimisticCleanupTimer) {
            clearInterval(this._optimisticCleanupTimer);
            this._optimisticCleanupTimer = null;
        }
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.messages.forEach(m => this.cleanupObjectUrls(m));
        this.selectedFiles.forEach(f => {
            if (f.url?.startsWith('blob:')) {
                try { URL.revokeObjectURL(f.url); } catch (e) {}
            }
        });
        this.addedMessageIds.clear();
        this.optimisticMessages.clear();
        this._recentHashes.clear();
        this.messages = [];
        this.selectedFiles = [];
    }
    
    translateAIMessages() {
        if (window.translator && window.translator.targetLang !== 'ru') {
            const aiMessages = document.querySelectorAll('.universal-msg.ai');
            for (const msg of aiMessages) {
                const original = msg.getAttribute('data-original');
                if (original && msg.getAttribute('data-translated') !== 'true') {
                    window.translator.translateSingleAIMessage(msg, original)
                        .then(translated => {
                            const textDiv = msg.querySelector('.message-text');
                            if (textDiv && translated !== textDiv.textContent) {
                                textDiv.textContent = translated;
                                msg.setAttribute('data-translated', 'true');
                            }
                        });
                }
            }
        }
    }
}

// ---------------------------- ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ ИНИЦИАЛИЗАЦИИ -------------------------------
let chatInstance = null;

window.initAIChat = async (ticketId = null) => {
    if (chatInstance?.socket) chatInstance.destroy();
    chatInstance = new AIChat();
    await chatInstance.init(ticketId);
    window.chatInstance = chatInstance;
};

window.getChatInstance = () => chatInstance;

// ---------------------------- ОЧИСТКА ПРИ УХОДЕ СО СТРАНИЦЫ -------------------------------
window.addEventListener('beforeunload', () => {
    if (chatInstance) chatInstance.destroy();
});