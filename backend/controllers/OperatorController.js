const ROLES = require('../constants/roles');

class OperatorController {
    constructor(ticketService, authService) {
        this.ticketService = ticketService;
        this.authService = authService;
        this.getMyTickets = this.getMyTickets.bind(this);
        this.acceptTicket = this.acceptTicket.bind(this);
        this.transferToExpert = this.transferToExpert.bind(this);
        this.completeTicket = this.completeTicket.bind(this);
        this.reopenTicket = this.reopenTicket.bind(this);
        this.sendOperatorMessage = this.sendOperatorMessage.bind(this);
        this.getChatHistory = this.getChatHistory.bind(this);
    }

    // Получить все заявки назначенные оператору
     async getMyTickets(req, res) {
        try {
            const user = req.user;

            console.log('=== GetMyTickets Debug ===');
            console.log('req.user:', user);
            console.log('user.id:', user?.id);
            console.log('user.role_id:', user?.role_id);

            if (!user || user.role_id !== ROLES.OPERATOR) {
                console.error('Access denied: not an operator');
                return res.status(403).json({ error: 'Доступно только операторам' });
            }

            if (!user.id) {
                console.error('User ID is missing');
                return res.status(400).json({ error: 'ID пользователя не найден' });
            }

            const tickets = await this.ticketService.getTicketsByOperator(user.id);
            console.log('Tickets found:', tickets?.length || 0);

            res.json({
                success: true,
                data: tickets
            });
        } catch (error) {
            console.error('Get operator tickets error:', error);
            console.error('Error stack:', error.stack);
            res.status(500).json({
                error: 'Ошибка при получении заявок',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Принять заявку в работу
    async acceptTicket(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            if (!user || user.role_id !== ROLES.OPERATOR) {
                return res.status(403).json({ error: 'Доступно только операторам' });
            }

            await this.ticketService.acceptTicketById(id, user.id);

            res.json({
                success: true,
                message: 'Заявка принята в работу'
            });
        } catch (error) {
            console.error('Accept ticket error:', error);
            res.status(500).json({ error: 'Ошибка при принятии заявки' });
        }
    }

    
async transferToExpert(req, res) {
    try {
        const { id } = req.params;
        const user = req.user;

        if (!user || user.role_id !== ROLES.OPERATOR) {
            return res.status(403).json({ error: 'Доступно только операторам' });
        }

        // Получаем заявку
        const ticket = await this.ticketService.getTicketById(id);
        
        if (!ticket) {
            return res.status(404).json({ error: 'Заявка не найдена' });
        }
        
        // Если нет категории, пытаемся определить через AI
        let categoryId = ticket.category_id;
        let expertId = ticket.expert_id;
        
        if (!categoryId && ticket.description) {
            const aiResult = await this.ticketService.aiService.generateResponse(ticket.description, false);
            if (aiResult.category) {
                const categoryResult = await this.ticketService.ticketRepository.pool.query(
                    'SELECT id FROM categories WHERE LOWER(name) = LOWER($1)',
                    [aiResult.category]
                );
                if (categoryResult.rows[0]) {
                    categoryId = categoryResult.rows[0].id;
                    // Обновляем категорию в заявке
                    await this.ticketService.ticketRepository.pool.query(
                        'UPDATE tickets SET category_id = $1 WHERE id = $2',
                        [categoryId, id]
                    );
                }
            }
        }
        
        // Если нет эксперта, но есть категория - ищем эксперта по категории
        if (!expertId && categoryId) {
            const expertResult = await this.ticketService.ticketRepository.pool.query(
                `SELECT u.id FROM users u
                 INNER JOIN categories c ON c.expert_id = u.id
                 WHERE c.id = $1 AND u.role_id = 3 AND u.deleted_at IS NULL`,
                [categoryId]
            );
            if (expertResult.rows[0]) {
                expertId = expertResult.rows[0].id;
            }
        }

        // Передаем заявку эксперту
        await this.ticketService.transferToExpert(id, user.id, expertId);

        // Отправляем уведомление эксперту
        if (expertId && global.io) {
            global.io.to(`user_${expertId}`).emit('new_ticket_assigned', {
                ticketId: id,
                categoryId: categoryId,
                message: ticket.description?.substring(0, 100)
            });
        }

        res.json({
            success: true,
            message: 'Заявка передана эксперту',
            expertId: expertId,
            categoryId: categoryId
        });
    } catch (error) {
        console.error('Transfer to expert error:', error);
        res.status(500).json({ error: error.message || 'Ошибка при передаче заявки эксперту' });
    }
}

    async completeTicket(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            if (!user || user.role_id !== ROLES.OPERATOR) {
                return res.status(403).json({ error: 'Доступно только операторам' });
            }

            // Оператор может завершить заявку, переводя её в статус resolved
            await this.ticketService.resolveTicketByOperator(id, user.id);

            res.json({
                success: true,
                message: 'Заявка завершена'
            });
        } catch (error) {
            console.error('Complete ticket error:', error);
            res.status(500).json({ error: error.message || 'Ошибка при завершении заявки' });
        }
    }

    // Вернуть заявку в работу (reopen)
    async reopenTicket(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            if (!user || user.role_id !== ROLES.OPERATOR) {
                return res.status(403).json({ error: 'Доступно только операторам' });
            }

            await this.ticketService.reopenTicket(id, user.id);

            res.json({
                success: true,
                message: 'Заявка возвращена в работу'
            });
        } catch (error) {
            console.error('Reopen ticket error:', error);
            res.status(500).json({ error: error.message || 'Ошибка при возврате заявки' });
        }
    }


    // Отправить сообщение в чат от имени оператора
    async sendOperatorMessage(req, res) {
        try {
            const { id } = req.params;
            const { message } = req.body;
            const user = req.user;

            if (!user || user.role_id !== ROLES.OPERATOR) {
                return res.status(403).json({ error: 'Доступно только операторам' });
            }

            if (!message || message.trim() === '') {
                return res.status(400).json({ error: 'Сообщение не может быть пустым' });
            }

            const ticketId = parseInt(id);

            // Получаем информацию о тикете для отправки уведомления
            const ticketInfo = await this.ticketService.getTicketById(ticketId);

            // Сохраняем сообщение через сервис
             await this.ticketService.saveOperatorMessage(ticketId, user.id, message);
            if (global.io) {
                global.io.to(`ticket_${ticketId}`).emit('new_message', {
                    ticketId: ticketId,
                    sender: 'operator',
                    message: message,
                    operatorName: user.full_name || 'Оператор',
                    timestamp: new Date().toISOString()
                });
            if (ticketInfo && ticketInfo.user_id && ticketInfo.user_id !== user.id) {
                    global.io.to(`user_${ticketInfo.user_id}`).emit('new-message-notification', {
                        ticketId: ticketId,
                        count: 1
                    });
                }   
            }

            res.json({
                success: true,
                message: 'Сообщение отправлено'
            });
        } catch (error) {
            console.error('Send operator message error:', error);
            res.status(500).json({
                error: 'Ошибка при отправке сообщения',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Получить историю чата для заявки
    async getChatHistory(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            if (!user || user.role_id !== ROLES.OPERATOR) {
                return res.status(403).json({ error: 'Доступно только операторам' });
            }

            const messages = await this.ticketService.getChatHistory(id);

            res.json({
                success: true,
                data: messages
            });
        } catch (error) {
            console.error('Get chat history error:', error);
            res.status(500).json({ error: 'Ошибка при получении истории чата' });
        }
    }
}

module.exports = OperatorController;