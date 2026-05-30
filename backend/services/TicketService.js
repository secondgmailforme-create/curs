const STATUSES = require('../constants/statuses');
const ROLES = require('../constants/roles');

// ---------------------------- КЛАСС TICKET SERVICE -------------------------------
class TicketService {
    constructor(
        ticketRepository, 
        statusRepository, 
        ticketHistoryRepository, 
        notificationService,
        logRepository,
        emailService,
        userRepository,
        aiService,
        commentRepository,
        aiTrainingDataRepository,
        chatRepository
    ) {
        this.ticketRepository = ticketRepository;
        this.statusRepository = statusRepository;
        this.ticketHistoryRepository = ticketHistoryRepository;
        this.notificationService = notificationService;
        this.logRepository = logRepository;
        this.emailService = emailService;
        this.userRepository = userRepository;
        this.aiService = aiService;
        this.commentRepository = commentRepository;
        this.aiTrainingDataRepository = aiTrainingDataRepository;
        this.chatRepo = chatRepository; 

        this._pendingMessages = new Map();
        this._cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [key, timestamp] of this._pendingMessages.entries()) {
                if (now - timestamp > 10000) { // 10 секунд окно
                    this._pendingMessages.delete(key);
                }
            }
        }, 5000);
         this.closedStatusCodes = [7, 8];      // Решена, Отменена
         this.activeStatusCodes = [1, 2, 3, 4, 5, 6]; // Активные статусы
    }

    // ---------------------------- ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ -------------------------------
     
    async _findTicketOrThrow(ticketId) {
        const ticket = await this.ticketRepository.findById(ticketId);
        if (!ticket) {
            throw new Error('Ticket not found');
        }
        return ticket;
    }

    async _getStatusOrThrow(statusCode) {
        const status = await this.statusRepository.findByCode(statusCode);
        if (!status) {
            throw new Error(`Status "${statusCode}" not found`);
        }
        return status;
    }

    async _addHistory(ticketId, userId, action, oldStatusId, newStatusId) {
        await this.ticketHistoryRepository.create({
            ticket_id: ticketId,
            user_id: userId,
            action,
            old_status_id: oldStatusId,
            new_status_id: newStatusId,
            old_data: null,
            new_data: null
        });
    }

    async _logAction(userId, action, entityType, entityId) {
        await this.logRepository.create({
            user_id: userId,
            action,
            entity_type: entityType,
            entity_id: entityId
        });
    }

    async _saveToAITraining(ticket) {
        const inputText = ticket.description || ticket.body || "Нет описания";
        const outputText = ""; 
        if (!inputText || inputText.trim() === "") {
            console.warn('Пропуск сохранения в AI: нет текста заявки');
            return;
        }
        try {
            await this.aiTrainingDataRepository.create({
                ticket_id: ticket.id,
                input_text: inputText,
                output_text: outputText,
                category_id: ticket.category_id,
            });
        } catch (error) {
            console.error('Ошибка сохранения в AI training:', error.message);
        }
    }

    // ---------------------------- ДЕДУПЛИКАЦИЯ СООБЩЕНИЙ -------------------------------
    _getMessageHash(ticketId, sender, message, attachments = []) {
        const fileHash = attachments
            .map(f => `${f.filename || f.name}_${f.size || 0}`)
            .sort()
            .join('|');
        // Используем округление времени до 5 секунд для устойчивости к задержкам
        const timeBucket = Math.floor(Date.now() / 5000);
        return `${ticketId}_${sender}_${message}_${fileHash}_${timeBucket}`;
    }

    // ---------------------------- ОСНОВНАЯ ЛОГИКА -------------------------------

    async createTicket(client_id, title, description, category_id = null, status_id = null, assigned_operator_id = null) {
        await this.checkDailyLimit(client_id);
        
        let finalCategoryId = category_id;
        let aiCategory = null;
        
        if (!finalCategoryId && description) {
            try {
                const aiResult = await this.aiService.generateResponse(description, false);
                if (aiResult.category) {
                    aiCategory = aiResult.category;
                    const categoryResult = await this.ticketRepository.pool.query(
                        'SELECT id FROM categories WHERE LOWER(name) = LOWER($1)',
                        [aiCategory]
                    );
                    if (categoryResult.rows[0]) {
                        finalCategoryId = categoryResult.rows[0].id;
                        console.log(`AI определил категорию: ${aiCategory} (ID: ${finalCategoryId})`);
                    }
                }
            } catch (err) {
                console.error('AI classification error:', err);
            }
        }
        
        let finalStatusId = status_id;
        if (!finalStatusId) {
            if (assigned_operator_id) {
                const inProgressStatus = await this._getStatusOrThrow(STATUSES.IN_PROGRESS_OPERATOR);
                finalStatusId = inProgressStatus.id;
            } else {
                const newStatus = await this._getStatusOrThrow(STATUSES.NEW);
                finalStatusId = newStatus.id;
            }
        }
        
        const prioritycat = this.getPriorityByCategory(finalCategoryId);
        const expertId = null;
        const targetStatusId = finalStatusId;  

        const ticketData = {
            title,
            description,
            client_id,
            operator_id: assigned_operator_id,
            expert_id: expertId,
            category_id: finalCategoryId,
            status_id: targetStatusId,
            priority: prioritycat
        };
        
        const ticket = await this.ticketRepository.create(ticketData);
        await this._saveToAITraining(ticket);
        await this._addHistory(ticket.id, client_id, 'create', null, finalStatusId);
        await this._logAction(client_id, 'create_ticket', 'ticket', ticket.id);
        
        const client = await this.userRepository.findById(client_id);
        if (client?.email) {
            await this.emailService.sendTicketCreatedEmail(client.email, ticket.id, title).catch(err => console.error('Email error:', err));
        }
        
        if (expertId) {
            await this.notificationService.notifyAssignment(ticket.id, expertId, 'expert');
            if (global.io) {
                global.io.to(`user_${expertId}`).emit('new_ticket_assigned', {
                    ticketId: ticket.id,
                    category: aiCategory,
                    message: description?.substring(0, 100)
                });
            }
        }

        await this.incrementDailyTickets(client_id);
        return ticket;
    }

    async assignOperator(ticketId, operatorId) {
        const ticket = await this._findTicketOrThrow(ticketId);
        const newStatus = await this._getStatusOrThrow(STATUSES.NEW);
        const inProgressStatusOp = await this._getStatusOrThrow(STATUSES.IN_PROGRESS_OPERATOR);

        if (ticket.status_id !== newStatus.id && ticket.status_id !== inProgressStatusOp.id) {
            throw new Error('Only new tickets can be taken by operator');
        }

        const inProgressStatus = await this._getStatusOrThrow(STATUSES.IN_PROGRESS_OPERATOR);

        await this.ticketRepository.assignOperator(ticketId, operatorId);
        await this.ticketRepository.updateStatus(ticketId, inProgressStatus.id);

        await this._addHistory(ticketId, operatorId, 'assign_operator', ticket.status_id, inProgressStatus.id);
        await this.notificationService.notifyAssignment(ticketId, operatorId, 'operator');
        await this._logAction(operatorId, 'assign_operator', 'ticket', ticketId);

        if (global.io) {
            global.io.to(`ticket_${ticketId}`).emit('status_change', {
                ticketId,
                newStatus: 'in_progress_operator',
                timestamp: new Date().toISOString()
            });
        }

        return await this.ticketRepository.findById(ticketId);
    }

    async acceptTicketById(ticketId, operatorId) {
        return await this.assignOperator(ticketId, operatorId);
    }

    async transferToExpert(ticketId, operatorId, expertId = null) {
        const ticket = await this._findTicketOrThrow(ticketId);
        const inProgressStatus = await this._getStatusOrThrow(STATUSES.IN_PROGRESS_OPERATOR);
        
        if (ticket.status_id !== inProgressStatus.id) {
            throw new Error('Only tickets in progress can be transferred');
        }
        
        let targetExpertId = expertId;
        if (!targetExpertId) {
            const bestExpert = await this.getBestExpertByCategory(ticket.category_id);
            if (!bestExpert) {
                throw new Error('No expert available for this category');
            }
            targetExpertId = bestExpert.id;
        }

        const waitingStatus = await this._getStatusOrThrow(STATUSES.WAITING_FOR_EXPERT);
        await this.ticketRepository.assignExpert(ticketId, targetExpertId);
        await this.ticketRepository.updateStatus(ticketId, waitingStatus.id);

        await this._addHistory(ticketId, operatorId, 'transfer_to_expert', ticket.status_id, waitingStatus.id);
        await this.notificationService.notifyAssignment(ticketId, targetExpertId, 'expert');
        await this._logAction(operatorId, 'transfer_to_expert', 'ticket', ticketId);

        if (global.io) {
            global.io.to(`ticket_${ticketId}`).emit('status_change', {
                ticketId,
                newStatus: 'waiting_for_expert',
                timestamp: new Date().toISOString()
            });
        }

        return await this.ticketRepository.findById(ticketId);
    }

    async assignExpert(ticketId, expertId) {
        const ticket = await this._findTicketOrThrow(ticketId);
        const waitingStatus = await this._getStatusOrThrow(STATUSES.WAITING_FOR_EXPERT);

        if (ticket.status_id !== waitingStatus.id) {
            throw new Error('Only tickets waiting for expert can be assigned');
        }

        const inProgressExpertStatus = await this._getStatusOrThrow(STATUSES.IN_PROGRESS_EXPERT);
        
        await this.ticketRepository.assignExpert(ticketId, expertId);
        await this.ticketRepository.updateStatus(ticketId, inProgressExpertStatus.id);

        await this._addHistory(ticketId, expertId, 'assign_expert', ticket.status_id, inProgressExpertStatus.id);
        await this._logAction(expertId, 'assign_expert', 'ticket', ticketId);
        
        if (global.io) {
            global.io.to(`ticket_${ticketId}`).emit('status_change', {
                ticketId: ticketId,
                newStatus: 'in_progress_expert',
                timestamp: new Date().toISOString()
            });
        }
        
        return await this.ticketRepository.findById(ticketId);
    }

    async resolveTicket(ticketId, expertId) {
        const ticket = await this._findTicketOrThrow(ticketId);
        const inProgressExpertStatus = await this._getStatusOrThrow(STATUSES.IN_PROGRESS_EXPERT);

        if (ticket.status_id !== inProgressExpertStatus.id) {
            throw new Error('Only tickets in progress can be resolved');
        }

        const resolvedStatus = await this._getStatusOrThrow(STATUSES.RESOLVED);
        await this.ticketRepository.updateStatus(ticketId, resolvedStatus.id);
        await this._addHistory(ticketId, expertId, 'resolve', ticket.status_id, resolvedStatus.id);
        await this.notificationService.notifyResolved(ticketId, ticket.client_id);
        await this._saveToAITraining(ticket);

        const client = await this.userRepository.findById(ticket.client_id);
        if (client?.email) {
            await this.emailService.sendTicketResolvedEmail(client.email, ticketId, ticket.title);
        }
        await this._logAction(expertId, 'resolve_ticket', 'ticket', ticketId);
        await this.userRepository.updateExpertRating(expertId, resolvedStatus.id);
    
        if (global.io) {
            global.io.to(`ticket_${ticketId}`).emit('status_change', {
                ticketId,
                newStatus: 'resolved',
                timestamp: new Date().toISOString()
            });
        }
        
        return await this.ticketRepository.findById(ticketId);
    }

    async resolveTicketByOperator(ticketId, operatorId) {
        const ticket = await this._findTicketOrThrow(ticketId);
        const inProgressOperatorStatus = await this._getStatusOrThrow(STATUSES.IN_PROGRESS_OPERATOR);

        if (ticket.status_id !== inProgressOperatorStatus.id) {
            throw new Error('Только заявки в работе оператора могут быть завершены');
        }

        const resolvedStatus = await this._getStatusOrThrow(STATUSES.RESOLVED);
        await this.ticketRepository.updateStatus(ticketId, resolvedStatus.id);
        await this._addHistory(ticketId, operatorId, 'resolve', ticket.status_id, resolvedStatus.id);
        await this.notificationService.notifyResolved(ticketId, ticket.client_id);
        await this._saveToAITraining(ticket);

        const client = await this.userRepository.findById(ticket.client_id);
        if (client?.email) {
            await this.emailService.sendTicketResolvedEmail(client.email, ticketId, ticket.title);
        }
        await this._logAction(operatorId, 'resolve_ticket', 'ticket', ticketId);

        if (global.io) {
            global.io.to(`ticket_${ticketId}`).emit('status_change', {
                ticketId,
                newStatus: 'resolved',
                timestamp: new Date().toISOString()
            });
        }

        return await this.ticketRepository.findById(ticketId);
    }

    async resolveTicketByExpert(ticketId, expertId) {
        console.log('resolveTicketByExpert called:', { ticketId, expertId });
        
        const id = parseInt(ticketId, 10);
        if (isNaN(id)) throw new Error('Invalid ticket ID');
        
        const expert = parseInt(expertId, 10);
        if (isNaN(expert)) throw new Error('Invalid expert ID');
        
        const ticket = await this._findTicketOrThrow(id);
        console.log('Ticket found:', { id: ticket.id, status_id: ticket.status_id });
        
        const inProgressExpertStatus = await this._getStatusOrThrow(STATUSES.IN_PROGRESS_EXPERT);
        const expectedStatusId = parseInt(inProgressExpertStatus.id, 10);
        
        if (parseInt(ticket.status_id, 10) !== expectedStatusId) {
            throw new Error(`Только заявки в работе эксперта могут быть завершены. Текущий статус: ${ticket.status_id}, ожидается: ${expectedStatusId}`);
        }
        
        const resolvedStatus = await this._getStatusOrThrow(STATUSES.RESOLVED);
        const resolvedStatusId = parseInt(resolvedStatus.id, 10);
        
        console.log('Resolved status ID:', resolvedStatusId);
        
        await this.ticketRepository.updateStatus(id, resolvedStatusId);
        await this._addHistory(id, expert, 'resolve', ticket.status_id, resolvedStatusId);
        await this.notificationService.notifyResolved(id, ticket.client_id);
        await this._saveToAITraining(ticket);
        
        const client = await this.userRepository.findById(ticket.client_id);
        if (client?.email) {
            await this.emailService.sendTicketResolvedEmail(client.email, id, ticket.title);
        }
        
        await this._logAction(expert, 'resolve_ticket', 'ticket', id);
        
   
        if (global.io) {
            global.io.to(`ticket_${id}`).emit('status_change', {
                ticketId: id,
                newStatus: 'resolved',
                timestamp: new Date().toISOString()
            });
        }
        
        console.log('resolveTicketByExpert completed');
        return await this.ticketRepository.findById(id);
    }

    async reopenTicket(ticketId, userId) {
        const ticket = await this._findTicketOrThrow(ticketId);
        const resolvedStatus = await this._getStatusOrThrow(STATUSES.RESOLVED);
        
        if (ticket.status_id !== resolvedStatus.id) {
            throw new Error('Only resolved tickets can be reopened');
        }
        

        const user = await this.userRepository.findById(userId);
        
        let newStatusId;
        let targetOperatorId = null;
        let targetExpertId = null;
        
        if (user.role_id === ROLES.CLIENT) {
            // Клиент переоткрывает - возвращаем тому, кто вёл заявку
            if (ticket.expert_id) {
                // Если был эксперт - возвращаем эксперту
                newStatusId = (await this._getStatusOrThrow(STATUSES.WAITING_FOR_EXPERT)).id;
                targetExpertId = ticket.expert_id;
            } else if (ticket.operator_id) {
                // Если был оператор - возвращаем оператору
                newStatusId = (await this._getStatusOrThrow(STATUSES.IN_PROGRESS_OPERATOR)).id;
                targetOperatorId = ticket.operator_id;
            } else {
                // Нет назначенного - в новую
                newStatusId = (await this._getStatusOrThrow(STATUSES.NEW)).id;
            }
        } 
        else if (user.role_id === ROLES.OPERATOR) {
            // Оператор переоткрывает - заявка возвращается оператору
            newStatusId = (await this._getStatusOrThrow(STATUSES.IN_PROGRESS_OPERATOR)).id;
            targetOperatorId = userId;
            
            // Сбрасываем эксперта, если был
            if (ticket.expert_id) {
                await this.ticketRepository.updateExpert(ticketId, null);
            }
        }
        else if (user.role_id === ROLES.EXPERT) {
            // Эксперт переоткрывает - заявка возвращается эксперту
            newStatusId = (await this._getStatusOrThrow(STATUSES.IN_PROGRESS_EXPERT)).id;
            targetExpertId = userId;
        }
        else if (user.role_id === ROLES.ADMIN) {
            // Админ переоткрывает - возвращаем тому, кто вёл заявку
            if (ticket.expert_id) {
                newStatusId = (await this._getStatusOrThrow(STATUSES.IN_PROGRESS_EXPERT)).id;
                targetExpertId = ticket.expert_id;
            } else if (ticket.operator_id) {
                newStatusId = (await this._getStatusOrThrow(STATUSES.IN_PROGRESS_OPERATOR)).id;
                targetOperatorId = ticket.operator_id;
            } else {
                newStatusId = (await this._getStatusOrThrow(STATUSES.NEW)).id;
            }
        }
        else {
            // По умолчанию - новая заявка
            newStatusId = (await this._getStatusOrThrow(STATUSES.NEW)).id;
        }
        
        // Обновляем статус и назначенных сотрудников
        await this.ticketRepository.updateStatus(ticketId, newStatusId);
        
        if (targetOperatorId) {
            await this.ticketRepository.updateOperator(ticketId, targetOperatorId);
        }
        if (targetExpertId !== undefined) {
            await this.ticketRepository.updateExpert(ticketId, targetExpertId);
        }
        
        await this._addHistory(ticketId, userId, 'reopen', ticket.status_id, newStatusId);
        await this._logAction(userId, 'reopen_ticket', 'ticket', ticketId);
        
        if (global.io) {
            let statusCode = '';
            if (newStatusId === (await this._getStatusOrThrow(STATUSES.NEW)).id) statusCode = 'new';
            else if (newStatusId === (await this._getStatusOrThrow(STATUSES.IN_PROGRESS_OPERATOR)).id) statusCode = 'in_progress_operator';
            else if (newStatusId === (await this._getStatusOrThrow(STATUSES.WAITING_FOR_EXPERT)).id) statusCode = 'waiting_for_expert';
            else if (newStatusId === (await this._getStatusOrThrow(STATUSES.IN_PROGRESS_EXPERT)).id) statusCode = 'in_progress_expert';
            else statusCode = 'reopened';
            
            global.io.to(`ticket_${ticketId}`).emit('status_change', {
                ticketId,
                newStatus: statusCode,
                timestamp: new Date().toISOString()
            });
            
            // Уведомляем назначенного сотрудника
            if (targetOperatorId) {
                global.io.to(`user_${targetOperatorId}`).emit('ticket_reopened', {
                    ticketId,
                    message: `Заявка #${ticketId} была переоткрыта`
                });
            }
            if (targetExpertId) {
                global.io.to(`user_${targetExpertId}`).emit('ticket_reopened', {
                    ticketId,
                    message: `Заявка #${ticketId} была переоткрыта`
                });
            }
        }
        
        return await this.ticketRepository.findById(ticketId);
    }

    async getExpertCategories(expertId) {
        const result = await this.ticketRepository.pool.query(
            `SELECT c.* FROM categories c
            WHERE c.expert_id = $1 AND c.deleted_at IS NULL`,
            [expertId]
        );
        return result.rows;
    }

    async getTicketsByExpertAndCategories(expertId, categoryIds) {
        if (!categoryIds.length) return [];
        
        const result = await this.ticketRepository.pool.query(
            `SELECT t.*, 
                    s.name as status_name,
                    s.code as status_code,
                    u.full_name as client_name,
                    u.email as client_email
            FROM tickets t
            LEFT JOIN statuses s ON s.id = t.status_id
            LEFT JOIN users u ON u.id = t.client_id
            WHERE t.category_id = ANY($1::int[])
            AND (t.expert_id = $2 OR t.expert_id IS NULL)
            AND t.deleted_at IS NULL
            ORDER BY 
                CASE WHEN t.status_id IN (SELECT id FROM statuses WHERE code IN ('waiting_for_expert', 'escalated')) THEN 0 ELSE 1 END,
                t.created_at ASC`,
            [categoryIds, expertId]
        );
        return result.rows;
    }
    
    async getExpertAssignedTickets(expertId) {
        const result = await this.ticketRepository.pool.query(
            `SELECT t.*, 
                    s.name as status_name,
                    s.code as status_code,
                    u.full_name as client_name,
                    u.email as client_email
            FROM tickets t
            LEFT JOIN statuses s ON s.id = t.status_id
            LEFT JOIN users u ON u.id = t.client_id
            WHERE t.expert_id = $1  -- ТОЛЬКО назначенные эксперту
            AND t.deleted_at IS NULL
            ORDER BY t.created_at DESC`,
            [expertId]
        );
        return result.rows;
    }
    async getWaitingForExpertTicketsByCategories(categoryIds) {
        if (!categoryIds.length) return [];
        
        const result = await this.ticketRepository.pool.query(
            `SELECT t.*, 
                    u.full_name as client_name, 
                    u.email as client_email,
                    s.code as status_code,
                    s.name as status_name,
                    c.name as category_name,
                    op.full_name as operator_name
            FROM tickets t
            LEFT JOIN users u ON t.client_id = u.id
            LEFT JOIN statuses s ON t.status_id = s.id
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN users op ON t.operator_id = op.id
            WHERE t.category_id = ANY($1::int[])
            AND t.expert_id IS NULL
            AND t.deleted_at IS NULL
            AND t.status_id IN (
                SELECT id FROM statuses WHERE code IN ('waiting_for_expert')
            )
            ORDER BY t.created_at ASC`,
            [categoryIds]
        );
        
        return result.rows;
    }


    async escalateToAdmin(ticketId, expertId) {
        const ticket = await this._findTicketOrThrow(ticketId);
        const inProgressExpertStatus = await this._getStatusOrThrow(STATUSES.IN_PROGRESS_EXPERT);

        if (ticket.status_id !== inProgressExpertStatus.id) {
            throw new Error('Only tickets in progress can be escalated');
        }

        const escalatedStatus = await this._getStatusOrThrow(STATUSES.ESCALATED);
        await this.ticketRepository.updateStatus(ticketId, escalatedStatus.id);
        await this._addHistory(ticketId, expertId, 'escalate', ticket.status_id, escalatedStatus.id);

        const admins = await this.userRepository.findByRole(ROLES.ADMIN);
        if (admins && admins.length > 0) {
            for (const admin of admins) {
                await this.notificationService.notifyAssignment(ticketId, admin.id, 'admin');
                if (global.io) {
                    global.io.to(`user_${admin.id}`).emit('escalated_ticket', {
                        ticketId: ticketId,
                        expertName: `Эксперт #${expertId}`,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }
        
        await this._logAction(expertId, 'escalate_ticket', 'ticket', ticketId);
        
        if (global.io) {
            global.io.to(`ticket_${ticketId}`).emit('status_change', {
                ticketId: ticketId,
                newStatus: 'escalated',
                timestamp: new Date().toISOString()
            });
        }
        
        return await this.ticketRepository.findById(ticketId);
    }

    async checkDailyLimit(client_id) {
        const today = new Date().toISOString().split('T')[0];
        const user = await this.userRepository.findById(client_id);
        
        if (!user.last_ticket_date || user.last_ticket_date !== today){
            await this.userRepository.resetDailyTickets(client_id);
            return true;
        }
        
        if (user.daily_tickets_count >= 5) {
            throw new Error('Превышен лимит заявок в день (5). Пожалуйста, обратитесь в поддержку.');
        }
        return true;
    }

    async incrementDailyTickets(client_id) {
        await this.userRepository.incrementDailyTickets(client_id);
    }

    async getBestExpertByCategory(categoryId) {
        if (!categoryId) return null;
        const experts = await this.ticketRepository.getExpertsByCategoryWithLoad(categoryId);
        return experts.length > 0 ? experts[0] : null;
    }

    async getTicketById(ticketId) {
        try {
            return await this._findTicketOrThrow(ticketId);
        } catch (error) {
            console.error('getTicketById error:', error);
            throw error;
        }
    }

    // ---------------------------- СОХРАНЕНИЕ СООБЩЕНИЙ С ДЕДУПЛИКАЦИЕЙ -------------------------------
    async saveOperatorMessage(ticketId, operatorId, message, attachments = []) {
        try {
            const msgHash = this._getMessageHash(ticketId, 'operator', message, attachments);
            
            // Проверяем дубль
            if (this._pendingMessages.has(msgHash)) {
                console.log('Дубль сообщения оператора, пропускаем');
                return { success: false, duplicate: true };
            }
            
            this._pendingMessages.set(msgHash, Date.now());
            
            const ticket = await this._findTicketOrThrow(ticketId);
            const savedMessage = await this.chatRepo.saveMessage(ticketId, 'operator', message, attachments);
            
            return { success: true, message: savedMessage };
        } catch (error) {
            console.error('saveOperatorMessage error:', error);
            throw error;
        }
    }

    async saveAdminMessage(ticketId, adminId, message, attachments = []) {
        try {
            const msgHash = this._getMessageHash(ticketId, 'admin', message, attachments);
            
            if (this._pendingMessages.has(msgHash)) {
                console.log('Дубль сообщения админа, пропускаем');
                return { success: false, duplicate: true };
            }
            
            this._pendingMessages.set(msgHash, Date.now());
            
            const ticket = await this._findTicketOrThrow(ticketId);
            const savedMessage = await this.chatRepo.saveMessage(ticketId, 'admin', message, attachments);
            
            return { success: true, message: savedMessage };
        } catch (error) {
            console.error('saveAdminMessage error:', error);
            throw error;
        }
    }

    async saveExpertMessage(ticketId, expertId, message, attachments = []) {
        try {
            console.log('saveExpertMessage called:', { ticketId, expertId, message, attachments });
            
            const msgHash = this._getMessageHash(ticketId, 'expert', message, attachments);
            
            // Проверяем дубль
            if (this._pendingMessages.has(msgHash)) {
                console.log('Дубль сообщения эксперта, пропускаем');
                return { success: false, duplicate: true };
            }
            
            this._pendingMessages.set(msgHash, Date.now());
            
            // Проверяем, что эксперт имеет право писать в этот тикет
            const ticket = await this._findTicketOrThrow(ticketId);
            
            // Проверяем, что эксперт назначен на заявку
            if (ticket.expert_id !== expertId) {
                throw new Error('Вы не назначены на эту заявку');
            }
            
            // Проверяем статус заявки (должен быть "В работе у эксперта" - статус 5)
            const inProgressExpertStatus = await this._getStatusOrThrow(STATUSES.IN_PROGRESS_EXPERT);
            if (ticket.status_id !== inProgressExpertStatus.id) {
                throw new Error('Нельзя отправлять сообщения в заявке с текущим статусом');
            }
            
            const savedMessage = await this.chatRepo.saveMessage(ticketId, 'expert', message, attachments);
            
            return { success: true, message: savedMessage };
        } catch (error) {
            console.error('saveExpertMessage error:', error);
            throw error;
        }
    }

    async completeTicketByAdmin(ticketId, adminId) {
        const id = parseInt(ticketId, 10);
        if (isNaN(id)) throw new Error('Invalid ticket ID');
        const admin = parseInt(adminId, 10);
        if (isNaN(admin)) throw new Error('Invalid admin ID');

        const ticket = await this._findTicketOrThrow(id);
        const resolvedStatus = await this._getStatusOrThrow(STATUSES.RESOLVED);
        const resolvedStatusId = parseInt(resolvedStatus.id, 10);

        await this.ticketRepository.updateStatus(id, resolvedStatusId);
        await this._addHistory(id, admin, 'complete', ticket.status_id, resolvedStatusId);
        await this.notificationService.notifyResolved(id, ticket.client_id);
        await this._saveToAITraining(ticket);

        const client = await this.userRepository.findById(ticket.client_id);
        if (client?.email) {
            await this.emailService.sendTicketResolvedEmail(client.email, id, ticket.title);
        }
        await this._logAction(admin, 'complete_ticket', 'ticket', id);
        
        
        if (global.io) {
            global.io.to(`ticket_${id}`).emit('status_change', {
                ticketId: id,
                newStatus: 'resolved',
                timestamp: new Date().toISOString()
            });
        }
        
        return await this.ticketRepository.findById(id);
    }

    // ✅ ДОБАВЛЕНО: Очистка ресурсов при уничтожении сервиса
    destroy() {
        if (this._cleanupInterval) {
            clearInterval(this._cleanupInterval);
            this._cleanupInterval = null;
        }
        this._pendingMessages.clear();
    }

    // ---------------------------- ПОЛУЧЕНИЕ ИСТОРИИ С ФИЛЬТРАЦИЕЙ -------------------------------
    async getChatHistory(ticketId) {
        const messages = await this.chatRepo.getMessagesByTicket(ticketId);
        
        // ✅ ФИЛЬТРУЕМ СИСТЕМНЫЕ СООБЩЕНИЯ
        const filteredMessages = messages.filter(msg => {
            if (msg.sender === 'system' || msg.sender === 'operator') {
                const hideList = [
                    'создана и передана',
                    'назначен на заявку',
                    '✅ Заявка #',
                    'Заявка #',
                    'Здравствуйте! Я ваш оператор'
                ];
                return !hideList.some(hide => msg.text?.includes(hide));
            }
            return true;
        });
        
        return filteredMessages;
    }

    async getTicketHistory(ticketId) {
        return await this.ticketHistoryRepository.findByTicket(ticketId);
    }

    async getTicketsByClient(clientId, filters = {}) {
        return await this.ticketRepository.findByClient(clientId, filters);
    }

    async getTicketsByExpert(expertId) {
        const assignedTickets = await this.ticketRepository.findByExpert(expertId);
        const waitingTickets = await this.ticketRepository.findUnassignedWaitingForExpertTickets();
        const escalatedTickets = await this.ticketRepository.findEscalatedToExpertTickets();
        
        const ticketMap = new Map();
        
        [...assignedTickets, ...waitingTickets, ...escalatedTickets].forEach(ticket => {
            ticketMap.set(ticket.id, ticket);
        });
        
        const allTickets = Array.from(ticketMap.values());
        
        allTickets.sort((a, b) => {
            const aIsWaiting = a.status_code === 'waiting_for_expert' || a.status_code === 'escalated';
            const bIsWaiting = b.status_code === 'waiting_for_expert' || b.status_code === 'escalated';
            
            if (aIsWaiting && !bIsWaiting) return -1;
            if (!aIsWaiting && bIsWaiting) return 1;
            
            return new Date(b.created_at) - new Date(a.created_at);
        });
        
        const enrichedTickets = await Promise.all(
            allTickets.map(async (ticket) => {
                const history = await this.getTicketHistory(ticket.id);
                return {
                    ...ticket,
                    history: history,
                    is_from_queue: ticket.expert_id === null,
                    can_take: ticket.expert_id === null && (ticket.status_code === 'waiting_for_expert' || ticket.status_code === 'escalated')
                };
            })
        );
        
        return enrichedTickets;
    }

    async getEscalatedToAdminTickets() {
        const tickets = await this.ticketRepository.findEscalatedToAdminTickets();

        const enrichedTickets = await Promise.all(
            tickets.map(async (ticket) => {
                const history = await this.getTicketHistory(ticket.id);
                return {
                    ...ticket,
                    history: history
                };
            })
        );

        return enrichedTickets;
    }
    
    async getTicketsByOperator(operatorId) {
        // 1. Свои назначенные заявки
        const assignedTickets = await this.ticketRepository.findByOperator(operatorId);
        
        // 2. Заявки из общей очереди (статус "Ожидает оператора")
        const queueTickets = await this.ticketRepository.findWaitingForOperatorTickets();
        
        console.log(`Operator ${operatorId}: ${assignedTickets.length} assigned, ${queueTickets.length} in queue`);
        
        // Объединяем, но без дубликатов
        const ticketMap = new Map();
        
        // Сначала добавляем свои заявки
        assignedTickets.forEach(ticket => {
            ticketMap.set(ticket.id, { ...ticket, isAssigned: true, isFromQueue: false });
        });
        
        // Добавляем заявки из очереди (если их ещё нет в списке)
        queueTickets.forEach(ticket => {
            if (!ticketMap.has(ticket.id)) {
                ticketMap.set(ticket.id, { ...ticket, isAssigned: false, isFromQueue: true });
            }
        });
        
        // Сортируем: сначала свои, потом очередь, по дате создания
        const result = Array.from(ticketMap.values());
        result.sort((a, b) => {
            // Сначала свои заявки
            if (a.isAssigned !== b.isAssigned) return a.isAssigned ? -1 : 1;
            // Потом по дате (новые сверху)
            return new Date(b.created_at) - new Date(a.created_at);
        });
        
        return result;
    }

    getPriorityByCategory(categoryId) {
        if (!categoryId || typeof categoryId !== 'number') {
            return 'medium';
        }
        const priorityMap = {
            1: 'high',
            2: 'medium',
            3: 'medium',
            4: 'low',
            5: 'high'
        };
        return priorityMap[categoryId] || 'medium';
    }
}

module.exports = TicketService;