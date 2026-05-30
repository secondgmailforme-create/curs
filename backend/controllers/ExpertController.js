const ROLES = require('../constants/roles');

class ExpertController {
    constructor(ticketService, authService) {
        this.ticketService = ticketService;
        this.authService = authService;
        this.getMyTickets = this.getMyTickets.bind(this);
        this.acceptTicket = this.acceptTicket.bind(this);
        this.completeTicket = this.completeTicket.bind(this);
        this.reopenTicket = this.reopenTicket.bind(this);
        this.sendExpertMessage = this.sendExpertMessage.bind(this);
        this.getChatHistory = this.getChatHistory.bind(this);
        this.escalateToAdmin = this.escalateToAdmin.bind(this);
        this.generateAIResponse = this.generateAIResponse.bind(this);
    }

    // Получить все заявки назначенные эксперту
    async getMyTickets(req, res) {
        try {
            const user = req.user;

            if (!user || user.role_id !== ROLES.EXPERT) {
                return res.status(403).json({ error: 'Доступно только экспертам' });
            }

            const tickets = await this.ticketService.getExpertAssignedTickets(user.id);
            
            // Получаем категории для обогащения
            const categoriesResult = await this.ticketService.getExpertCategories(user.id);
            
            // Обогащаем заявки информацией о категории
            const enrichedTickets = await Promise.all(tickets.map(async (ticket) => {
                const history = await this.ticketService.getTicketHistory(ticket.id);
                const category = categoriesResult.find(c => c.id === ticket.category_id);
                
                return {
                    ...ticket,
                    history,
                    category_name: category?.name || 'Без категории',
                    category_color: this.getCategoryColor(category?.name)
                };
            }));

            res.json({
                success: true,
                data: enrichedTickets
            });
        } catch (error) {
            console.error('Get expert tickets error:', error);
            res.status(500).json({ error: 'Ошибка при получении заявок' });
        }
    }


    async getQueueTickets(req, res) {
        try {
            const user = req.user;
            
            if (!user || user.role_id !== ROLES.EXPERT) {
                return res.status(403).json({ error: 'Доступно только экспертам' });
            }
            
            // Получаем категории эксперта
            const categories = await this.ticketService.getExpertCategories(user.id);
            const categoryIds = categories.map(c => c.id);
            
            if (categoryIds.length === 0) {
                return res.json({ success: true, data: [] });
            }
            
            // Получаем заявки из очереди (waiting_for_expert) по категориям эксперта
            const queueTickets = await this.ticketService.getWaitingForExpertTicketsByCategories(categoryIds);
            
            res.json({
                success: true,
                data: queueTickets
            });
        } catch (error) {
            console.error('Get queue tickets error:', error);
            res.status(500).json({ error: 'Ошибка при получении заявок из очереди' });
        }
    }

    getCategoryColor(categoryName) {
        const colors = {
            'Оплата': '#e74c3c',
            'Доставка': '#3498db',
            'Техподдержка': '#2ecc71',
            'Консультация': '#f39c12',
            'Возврат': '#9b59b6'
        };
        return colors[categoryName] || '#95a5a6';
    }

    // Принять заявку в работу
    async acceptTicket(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            if (!user || user.role_id !== ROLES.EXPERT) {
                return res.status(403).json({ error: 'Доступно только экспертам' });
            }

            await this.ticketService.assignExpert(id, user.id);

            res.json({
                success: true,
                message: 'Заявка принята в работу'
            });
        } catch (error) {
            console.error('Accept ticket error:', error);
            res.status(500).json({ error: 'Ошибка при принятии заявки' });
        }
    }

    // Завершить заявку
    async completeTicket(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            console.log('🏁 Complete ticket request:', { id, userId: user?.id });

            if (!user || user.role_id !== ROLES.EXPERT) {
                return res.status(403).json({ error: 'Доступно только экспертам' });
            }

            // Преобразуем в число
            const ticketId = parseInt(id, 10);
            if (isNaN(ticketId)) {
                return res.status(400).json({ error: 'Неверный ID заявки' });
            }

            await this.ticketService.resolveTicketByExpert(ticketId, user.id);

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

            if (!user || user.role_id !== ROLES.EXPERT) {
                return res.status(403).json({ error: 'Доступно только экспертам' });
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


    // Отправить сообщение в чат от имени эксперта
    async sendExpertMessage(req, res) {
        try {
            const { id } = req.params;
            const { message, attachments } = req.body;
            const user = req.user;

            if (!user || user.role_id !== ROLES.EXPERT) {
                return res.status(403).json({ error: 'Доступно только экспертам' });
            }

            // Сохраняем сообщение через сервис
            await this.ticketService.saveExpertMessage(id, user.id, message);
            const ticketId = parseInt(id);
            if (global.io) {
                global.io.to(`ticket_${ticketId}`).emit('new_message', {
                    ticketId: ticketId,
                    sender: 'expert',
                    message: message,
                    expertName: user.full_name || 'Эксперт',
                    timestamp: new Date().toISOString()
                });
            }

            res.json({
                success: true,
                message: 'Сообщение отправлено'
            });
        } catch (error) {
            console.error('Send expert message error:', error);
            res.status(500).json({ error: 'Ошибка при отправке сообщения' });
        }
    }

    // Получить историю чата для заявки
    async getChatHistory(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            if (!user || user.role_id !== ROLES.EXPERT) {
                return res.status(403).json({ error: 'Доступно только экспертам' });
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
    // Сгенерировать ответ от AI
    async generateAIResponse(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            if (!user || user.role_id !== ROLES.EXPERT) {
                return res.status(403).json({ error: 'Доступно только экспертам' });
            }

            // Получаем заявку
            const ticket = await this.ticketService.getTicketById(id);
            
            if (!ticket) {
                return res.status(404).json({ error: 'Заявка не найдена' });
            }

            // Получаем последнее сообщение клиента
            const messages = await this.ticketService.getChatHistory(id);
            const lastClientMessage = messages.filter(m => m.sender === 'client').pop();
            
            if (!lastClientMessage) {
                return res.status(404).json({ error: 'Нет сообщений от клиента для генерации ответа' });
            }

            // Генерируем ответ через AI
            const aiResult = await this.ticketService.aiService.generateResponse(lastClientMessage.message, false);
            
            res.json({
                success: true,
                data: {
                    response: aiResult.response,
                    category: aiResult.category,
                    model_used: aiResult.model_used,
                    generation_time: aiResult.generation_time
                }
            });
        } catch (error) {
            console.error('Generate AI response error:', error);
            res.status(500).json({ error: error.message || 'Ошибка при генерации ответа AI' });
        }
    }

    // Передать заявку администратору (эскалация)
    async escalateToAdmin(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            if (!user || user.role_id !== ROLES.EXPERT) {
                return res.status(403).json({ error: 'Доступно только экспертам' });
            }

            // Получаем заявку
            const ticket = await this.ticketService.getTicketById(id);
            
            if (!ticket) {
                return res.status(404).json({ error: 'Заявка не найдена' });
            }

            // Проверяем статус
            const inProgressExpertStatus = await this.ticketService.statusRepository.findByCode('in_progress_expert');
            if (ticket.status_id !== inProgressExpertStatus.id) {
                return res.status(400).json({ error: 'Только заявки в работе могут быть эскалированы' });
            }

            // Эскалируем админу
            await this.ticketService.escalateToAdmin(id, user.id);

            // Отправляем уведомление через сокет
            if (global.io) {
                global.io.to(`ticket_${id}`).emit('transferred_to_admin', {
                    ticketId: id,
                    expertName: user.full_name || 'Эксперт',
                    timestamp: new Date().toISOString()
                });
            }

            res.json({
                success: true,
                message: 'Заявка передана администратору'
            });
        } catch (error) {
            console.error('Escalate to admin error:', error);
            res.status(500).json({ error: error.message || 'Ошибка при передаче заявки администратору' });
        }
    }
}

module.exports = ExpertController;