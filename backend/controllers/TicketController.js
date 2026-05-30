const BaseController = require('./BaseController'); //Импорт Базового класса
const { createTicketSchema, transferSchema } = require('../schemas/ticketSchemas'); //импорт схем
const path = require('path');
//Контроллер по работе с заявками
class TicketController extends BaseController {
    constructor(
        ticketService, 
        authService, 
        priorityService, 
        aiService, 
        notificationService,
        statsService,
        commentService,      
        attachmentService 
    ) {
        super();
        this.ticketService = ticketService;
        this.authService = authService;
        this.priorityService = priorityService;
        this.aiService = aiService;
        this.notificationService = notificationService;
        this.statsService = statsService; 
        this.commentService = commentService;
        this.attachmentService = attachmentService;
    }

    //Метод для создания заявки
    async create(req, res) {
        try {
            const { title, description, category_id } = req.body;
            const client_id = req.user.id;

            const { error } = createTicketSchema.validate({ title, description, category_id });
            if (error) {
                return this.validationError(res, error.details.map(el => el.message));
            }

            let cleanTitle = title;
            let cleanDescription = description;
            
            if (containsProfanity(title)) {
                cleanTitle = filterProfanity(title);
            }
            if (containsProfanity(description)) {
                cleanDescription = filterProfanity(description);
            }

            const ticket = await this.ticketService.createTicket(
                client_id,
                cleanTitle,
                cleanDescription,
                category_id
            );

            let autoResponse = null;
            try {
                const aiResult = await this.aiService.generateResponse(cleanDescription);
                autoResponse = aiResult.response;
                
                await this.commentService.addAutoReply(ticket.id, autoResponse);
                
                await this.notificationService.notifyNewComment(ticket.id, client_id, 'AI Bot'); 
            } catch (aiError) {
                console.error('Auto-response generation failed:', aiError.message);
            }

            this.success(res, {
                ticket_id: ticket.id,
                ticket,
                message: autoResponse
            }, 201);

        } catch (error) {
            console.error('Create Ticket Error:', error);
            res.status(400).json({ error: error.message });
        }
    }

    //Метод для просмотра всех заявок
    async getAll(req, res) {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        const tickets = await this.ticketService.getTicketsByRole(req.user, limit, offset);
        const enrichedTickets = this.priorityService.enrichTicketsWithColor(tickets);
        
        this.success(res, enrichedTickets);
    }

    //Метод для просмотра заявок по id
    async getById(req, res) {
        const { id } = req.params;
        try {
            const ticket = await this.ticketService.getTicketById(id);
            const enrichedTicket = {
                ...ticket,
                priorityColor: this.priorityService.getColor(ticket.created_at)
            };
            this.success(res, enrichedTicket);
        } catch (error) {
            this.notFound(res, 'Ticket not found');
        }
    }

// ---------------------------- СТАТИСТИККА-------------------------------

    //Метод для получение статистики клиента
    async getClientWeeklyStats(req, res) {
        const clientId = req.user?.id;
        if (!clientId) {
            return this.validationError(res, ['User ID not found']);
        }
        try {
            const stats = await this.statsService.getClientWeeklyStats(clientId);
            this.success(res, stats);
        } catch (error) {
            console.error('getClientWeeklyStats error:', error);
            res.status(500).json({ error: error.message });
        }
    }

// ---------------------------- ДЕЙСТВИЯ С ЗАЯВКАМИ-------------------------------

    //Метод для взятие заявки оператор
    async assignOperator(req, res) {
        const { id } = req.params;
        const operator_id = req.user.id;
        const ticket = await this.ticketService.assignOperator(id, operator_id);
        this.success(res, ticket);
    }

    //Метод для отправки заявки к эксперту
    async transferToExpert(req, res) {
        const { error } = transferSchema.validate(req.body);
        if (error) {
            return this.validationError(res, error.details.map(el => el.message));
        }
        const { id } = req.params;
        const { expertId } = req.body;
        const operatorId = req.user.id;
        
        const ticket = await this.ticketService.transferToExpert(id, operatorId, expertId);
        this.success(res, ticket);
    }

    //Метод для принятие заявки эксперта
    async assignExpert(req, res) {
        const { id } = req.params;
        const expertId = req.user.id;
        const ticket = await this.ticketService.assignExpert(id, expertId);
        this.success(res, ticket);
    }

    //Метод для завершение заявки
    async resolve(req, res) {
        const { id } = req.params;
        const expertId = req.user.id;
        const ticket = await this.ticketService.resolveTicket(id, expertId);
        this.success(res, ticket);
    }

    //Метод для переоткрытие заявки
    async reopen(req, res) {
        const { id } = req.params;
        const clientId = req.user.id;
        const ticket = await this.ticketService.reopenTicket(id, clientId);
        this.success(res, ticket);
    }

    //Метод для отправки заявки админу
    async escalate(req, res) {
        const { id } = req.params;
        const expertId = req.user.id;
        const ticket = await this.ticketService.escalateToAdmin(id, expertId);
        this.success(res, ticket);
    }

    //Метод для генерации ответа от ai
    async generateAIResponse(req, res) {
        try {
            const { id } = req.params;
            const ticket = await this.ticketService.getTicketById(id);
            
            if (!ticket) {
                return this.notFound(res, 'Ticket not found');
            }
            
            const aiResult = await this.aiService.generateResponse(ticket.description);
            
            this.success(res, {
                response: aiResult.response,
                category: aiResult.category,
                model_used: aiResult.model_used
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    //Метод для получение заявок пользователем
    async getMyTickets(req, res) {
        try {
            const clientId = req.user.id;
            
            // Получаем параметры фильтрации из запроса
            const filters = {
                status_id: req.query.status_id,
                category_id: req.query.category_id,
                date_from: req.query.date_from,
                date_to: req.query.date_to
            };
            
            // Передаем фильтры в сервис
            const tickets = await this.ticketService.getTicketsByClient(clientId, filters);
            
            const enrichedTickets = tickets.map(ticket => ({
                ...ticket,
                priorityColor: this.priorityService.getColor(ticket.created_at)
            }));
            
            this.success(res, enrichedTickets);
        } catch (error) {
            this.error(res, error.message);
        }
    }

    // Получить сообщения чата для заявки (для модального окна)
    async getMessages(req, res) {
        try {
            const ticketId = parseInt(req.params.id);
            const user = req.user;
            
            if (!user) {
                return res.status(401).json({ error: 'Не авторизован' });
            }
            
            // Проверяем, имеет ли пользователь доступ к этой заявке
            const ticket = await this.ticketService.getTicketById(ticketId);
            if (!ticket) {
                return res.status(404).json({ error: 'Заявка не найдена' });
            }
            
            // Проверка доступа в зависимости от роли
            const userRole = user.role_id;
            const hasAccess = 
                userRole === 1 ? ticket.client_id === user.id : // клиент
                userRole === 2 ? ticket.operator_id === user.id || ticket.operator_id === null : // оператор
                userRole === 3 ? ticket.expert_id === user.id : // эксперт
                userRole === 4; // админ - всё видит
            
            if (!hasAccess) {
                return res.status(403).json({ error: 'Нет доступа к этой заявке' });
            }
            
            // Получаем сообщения из чата
            const messages = await this.ticketService.getChatHistory(ticketId);
            
            res.json({
                success: true,
                messages: messages
            });
        } catch (error) {
            console.error('Get messages error:', error);
            res.status(500).json({ error: 'Ошибка при получении сообщений' });
        }
    }

    // Метод для загрузки файлов
    async uploadAttachment(req, res) {
        if (!req.file) return this.validationError(res, ['Файл не загружен']);

        const { id: ticketId } = req.params;
        
        // Получаем имя папки с датой (последняя папка в пути)
        const dateFolder = path.basename(path.dirname(req.file.path)); // "2026-05-28"
        const fileName = req.file.filename; // "hash_originalname.jpg"
        
        // Формируем правильный URL
        const fileUrl = `/uploads/${dateFolder}/${fileName}`;
        
        console.log('Date folder:', dateFolder);
        console.log('File name:', fileName);
        console.log('File URL:', fileUrl);
        
        const attachment = await this.attachmentService.addAttachment(
            ticketId, 
            req.file.originalname, 
            fileUrl,
            req.file.mimetype,
            req.file.size,
            req.user?.id
        );
        
        this.success(res, {
            id: attachment.id,
            filename: req.file.originalname,
            original_name: req.file.originalname,
            url: fileUrl,
            filepath: fileUrl,
            size: req.file.size,
            mime_type: req.file.mimetype,
            type: req.file.mimetype
        }, 201);
    }

    //Метод для просмотра файлов
    async getAttachments(req, res) {
        const { id: ticketId } = req.params;
        const attachments = await this.attachmentService.getAttachmentsByTicket(ticketId);
        this.success(res, attachments);
    }

    //Метод для добавления комментария к заявки
    async addComment(req, res) {
        const { text } = req.body;
        const { id: ticketId } = req.params;
        const comment = await this.commentService.createComment(ticketId, req.user.id, text);
        this.success(res, comment, 201);
    }

    //Метод для получения комментария к заявки
    async getComments(req, res) {
        const { id: ticketId } = req.params;
        const comments = await this.commentService.getCommentsByTicket(ticketId);
        this.success(res, comments);
    }
    async getHistory(req, res) {
        const { id: ticketId } = req.params;
        try {
            const history = await this.ticketService.getTicketHistory(ticketId);
            this.success(res, history);
        } catch (error) {
            console.error('Get History Error:', error);
            this.notFound(res, 'История не найдена');
        }
    }
}

module.exports = TicketController; //Выгрузка