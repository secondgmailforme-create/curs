const BaseController = require('./BaseController'); //Импорт Базового класса
const { createUserSchema } = require('../schemas/adminSchemas'); //Импорт схемы валидации joi
const ROLES = require('../constants/roles'); //Импорт констант Ролей

//Контроллер для админа
class AdminController extends BaseController {
    constructor(
        authService, 
        categoryService,
        statsService, 
        userService,
        statusService,
        ticketService,
        userRepository,
        emailService,
        aiService 
    ) {
        super();
        this.authService = authService;
        this.categoryService = categoryService;
        this.statsService = statsService;
        this.userService = userService;
        this.statusService = statusService;
        this.ticketService = ticketService;
        this.userRepository = userRepository;  
        this.emailService = emailService;
        this.aiService = aiService;     
    }


// ---------------------------- ПОЛЬЗОВАТЕЛИ -------------------------------

    //Метод для создания пользователя или сотрудника
    async createUser(req, res) {
        try {
            const { full_name, email, phone, role_id } = req.body;
            
            // Валидация
            if (!full_name || !email || !role_id) {
                return res.status(400).json({ error: 'Заполните все обязательные поля' });
            }
            
            // Проверяем, существует ли пользователь
            const existingUser = await this.userRepository.findByEmail(email);
            if (existingUser) {
                return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
            }
            
            // Генерируем случайный пароль
            const generateRandomPassword = () => {
                const length = 10;
                const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
                let password = '';
                for (let i = 0; i < length; i++) {
                    const randomIndex = Math.floor(Math.random() * charset.length);
                    password += charset[randomIndex];
                }
                return password;
            };
            
            const plainPassword = generateRandomPassword();
            
            // Хешируем пароль
            const bcrypt = require('bcrypt');
            const saltRounds = 10;
            const password_hash = await bcrypt.hash(plainPassword, saltRounds);
            
            // Создаем пользователя
            const userData = {
                email,
                phone: phone || null,
                full_name,
                password_hash,
                role_id: parseInt(role_id),
                is_verified: true
            };
            
            const newUser = await this.userRepository.createNewUser(userData);
            
            // Отправляем email с паролем
            let emailSent = false;
            try {
                await this.emailService.sendWelcomeWithPasswordEmail(email, full_name, plainPassword);
                emailSent = true;
            } catch (emailError) {
                console.error('Failed to send welcome email:', emailError);
            }
            
            // Не возвращаем пароль в ответе
            const { password_hash: _, ...userWithoutPassword } = newUser;
            
            res.status(201).json({
                success: true,
                data: userWithoutPassword,
                email_sent: emailSent,
                message: emailSent ? 'Пользователь создан, пароль отправлен на email' : 'Пользователь создан, но не удалось отправить email'
            });
            
        } catch (error) {
            console.error('Create user error:', error);
            res.status(500).json({ error: error.message || 'Ошибка создания пользователя' });
        }
    }

    //Метод для получения всех пользователей
    async getUsers(req, res) {
        const users = await this.userService.getAllActiveUsers();
        this.success(res, users);
    }

    //Метод для получения рейтинга Эксперта
    async getExpertsRating(req, res) {
        try {
            const experts = await this.userService.getExpertsRating(); 
            this.success(res, experts);
        } catch (error) {
            console.error('Experts Rating Error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    //Метод для блокирования пользователя
    async banUser(req, res) {
        const { userId } = req.params;
        try {
            await this.userService.banUser(req.user.id, userId);
            this.success(res, { message: 'Пользователь заблокирован' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    //Метод для восстановления пользователя
    async restoreUser(req, res) {
        const { userId } = req.params;
        try {
            await this.userService.restoreUser(req.user.id, userId);
            this.success(res, { message: 'Пользователь восстановлен' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }


// ---------------------------- СТАТУСЫ -------------------------------

    //Метод для создания статуса заявки
    async createStatus(req, res) {
        try {
            const { code, name } = req.body;
            if (!code || !name) {
                return this.validationError(res, ['Поля code и name обязательны']);
            }
            const status = await this.statusService.create(code, name);
            this.success(res, status, 201);
        } catch (error) {
            console.error('Create Status Error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    //Метод для обновления статуса заявки
    async updateStatus(req, res) {
        try {
            const { id } = req.params;
            const { code, name } = req.body;
            if (!code || !name) {
                return this.validationError(res, ['Поля code и name обязательны']);
            }
            const status = await this.statusService.update(id, code, name);
            if (!status) {
                return this.notFound(res, 'Статус не найден');
            }
            this.success(res, status);
        } catch (error) {
            console.error('Update Status Error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    //Метод для удаления статуса заявки
    async deleteStatus(req, res) {
        const { id } = req.params;
        try {
            await this.statusService.delete(id);
            this.success(res, { message: 'Статус удален' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

// ---------------------------- КАТЕГОРИИ -------------------------------

    //Метод для создания категории заявки
    async createCategory(req, res) {
        try {
            const { name, expert_id } = req.body;
            if (!name) {
                return this.validationError(res, ['Название категории обязательно']);
            }
            const category = await this.categoryService.create(name, expert_id || null);
            this.success(res, category, 201);
        } catch (error) {
            console.error('Create Category Error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    //Метод для перезначения категории эксперта
    async reassignCategoryExpert(req, res) {
        try {
            const { id } = req.params;
            const { expert_id } = req.body;
            
            if (expert_id === undefined) {
                return this.validationError(res, ['expert_id обязателен']);
            }

            const category = await this.categoryService.updateExpert(id, expert_id);
            if (!category) {
                return this.notFound(res, 'Категория не найдена');
            }
            this.success(res, category);
        } catch (error) {
            console.error('Reassign Category Error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    //Метод для получения всех категорий
    async getAll(req, res) {
        const categories = await this.categoryService.getAllCategories();
        this.success(res, categories);
    }

    //Метод для получения категории по id
    async getById(req, res) {
        const { id } = req.params;
        const category = await this.categoryService.getCategoryById(id);
        if (!category) {
            return this.notFound(res, 'Category not found');
        }
        this.success(res, category);
    }

    //Метод для удалении категории
    async deleteCategory(req, res) {
        const { id } = req.params;
        try {
            await this.categoryService.delete(id);
            this.success(res, { message: 'Категория удалена' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

// ---------------------------- СТАТИСТИКА, ЛОГИ И AI -------------------------------

    //Метод для просмотра всех логов
    async getLogs(req, res) {
        try {
            const { start, end, limit, offset } = req.query;
            const logs = await this.statsService.getLogs(limit, offset, start, end);
            this.success(res, logs);
        } catch (error) {
            console.error('Get Logs Error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    //Метод для просмотра всех тренировочных данных для ai
    async getAITrainingData(req, res) {
        try {
            const data = await this.statsService.getAITrainingData();
            this.success(res, data);
        } catch (error) {
            console.error('Get AI Data Error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    //Метод для прогноза от ai
    async getAIPredictions(req, res) {
        try {
            // Проверяем наличие aiService
            if (!this.aiService) {
                console.warn('AI Service not available');
                return this.success(res, {
                    load_forecast: "средняя",
                    peak_hours: ["10:00-12:00", "14:00-16:00"],
                    recommendations: ["AI сервис временно недоступен"]
                });
            }
            
            // Получаем статистику
            let stats;
            try {
                stats = await this.statsService.getAdvancedStats();
            } catch (statsError) {
                console.error('Stats error:', statsError);
                stats = { total: 0, avgResolutionTime: 0, byHour: {} };
            }
            
            const prompt = this._buildAIPrompt(stats);
            
            // Генерируем ответ
            let aiResult;
            try {
                aiResult = await this.aiService.generateResponse(prompt, true);
                console.log('AI result:', aiResult);
            } catch (aiError) {
                console.error('AI generation error:', aiError);
                return this.success(res, {
                    load_forecast: "средняя",
                    peak_hours: ["10:00-12:00", "14:00-16:00"],
                    recommendations: ["AI генерация временно недоступна"]
                });
            }
            
            const predictions = this._parseAIResponse(aiResult.response);
            
            this.success(res, {
                load_forecast: predictions.load_forecast || "средняя",
                peak_hours: predictions.peak_hours || ["10:00-12:00", "14:00-16:00"],
                recommendations: predictions.recommendations || []
            });
        } catch (error) {
            console.error('AI Prediction Error:', error);
            this.success(res, {
                load_forecast: "средняя",
                peak_hours: ["10:00-12:00", "14:00-16:00"],
                recommendations: ["Не удалось получить прогноз от AI"]
            });
        }
    }

    //Метод для статистики 
    async getDashboard(req, res) {
        try {
            const stats = await this.statsService.getDashboardStats();
            this.success(res, stats);
        } catch (error) {
            console.error('Dashboard Error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    //Метод для экспорта заявок
    async exportTickets(req, res) {
        try {
            const csv = await this.statsService.exportTicketsToCSV(req.query);
            res.header('Content-Type', 'text/csv');
            res.attachment('tickets.csv');
            res.send(csv);
        } catch (error) {
            console.error('Export Error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async exportTrainingData(req, res) {
        try {
            const data = await this.statsService.getAITrainingData();
            
            // Формируем JSON для экспорта
            const exportData = data.map(item => ({
                id: item.id,
                question: item.question || item.input_text,
                answer: item.answer || item.output_text,
                category: item.category,
                model_used: item.model_used,
                generation_time: item.generation_time,
                created_at: item.created_at,
                used: item.used
            }));
            
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename=ai-training-data-${new Date().toISOString().split('T')[0]}.json`);
            res.send(JSON.stringify(exportData, null, 2));
        } catch (error) {
            console.error('Export training data error:', error);
            res.status(500).json({ error: error.message });
        }
    }


    //Метод для просмотра эскалированных заявок для админа
    async getEscalatedTickets(req, res) {
        try {
            const tickets = await this.ticketService.getEscalatedToAdminTickets();
            this.success(res, { data: tickets });
        } catch (error) {
            console.error('Get Escalated Tickets Error:', error);
            res.status(500).json({ error: error.message });
        }
    }

// ---------------------------- УПРАВЛЕНИЕ ЗАЯВКАМИ АДМИНА -------------------------------

    // Отправить сообщение в чат от имени админа
    async sendAdminMessage(req, res) {
        try {
            const { id } = req.params;
            const { message } = req.body;
            const user = req.user;

            if (!user || user.role_id !== ROLES.ADMIN) {
                return res.status(403).json({ error: 'Доступно только администраторам' });
            }

            // Сохраняем сообщение через сервис
            await this.ticketService.saveAdminMessage(id, user.id, message);
            const ticketId = parseInt(id);
            if (global.io) {
                global.io.to(`ticket_${ticketId}`).emit('new_message', {
                    ticketId: ticketId,
                    sender: 'admin',
                    message: message,
                    adminName: user.full_name || 'Администратор',
                    timestamp: new Date().toISOString()
                });
            }

            this.success(res, { message: 'Сообщение отправлено' });
        } catch (error) {
            console.error('Send admin message error:', error);
            res.status(500).json({ error: 'Ошибка при отправке сообщения' });
        }
    }

    // Завершить заявку
    async completeTicket(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            if (!user || user.role_id !== ROLES.ADMIN) {
                return res.status(403).json({ error: 'Доступно только администраторам' });
            }

            const ticketId = parseInt(id, 10);
            if (isNaN(ticketId)) {
                return res.status(400).json({ error: 'Неверный ID заявки' });
            }

            await this.ticketService.completeTicketByAdmin(ticketId, user.id);

            this.success(res, { message: 'Заявка завершена' });
        } catch (error) {
            console.error('Complete ticket error:', error);
            res.status(500).json({ error: error.message || 'Ошибка при завершении заявки' });
        }
    }

    // Сгенерировать ответ от AI
    async generateAIResponse(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            if (!user || user.role_id !== ROLES.ADMIN) {
                return res.status(403).json({ error: 'Доступно только администраторам' });
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

            this.success(res, {
                response: aiResult.response,
                category: aiResult.category,
                model_used: aiResult.model_used,
                generation_time: aiResult.generation_time
            });
        } catch (error) {
            console.error('Generate AI response error:', error);
            res.status(500).json({ error: error.message || 'Ошибка при генерации ответа AI' });
        }
    }

// ---------------------------- ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ -------------------------------

    // Приватный метод для описание задачи перед ai
    _buildAIPrompt(stats) {
        return `
Проанализируй данные call-центра за последние 30 дней:
📊 Статистика:
- Всего заявок: ${stats.total}
- Среднее время решения: ${stats.avgResolutionTime} ч
- Заявки по часам: ${JSON.stringify(stats.byHour)}
Ответь ТОЛЬКО в формате JSON:
{
    "load_forecast": "низкая/средняя/высокая",
    "peak_hours": ["час1", "час2"],
    "recommendations": ["совет1", "совет2"]
}
Используй русский язык.`;
}

   // Приватный метод для перехвата ответа от AI
    _parseAIResponse(rawResponse) {
        try {
            if (!rawResponse || rawResponse.trim() === '') {
                console.warn('Empty AI response');
                return {
                    load_forecast: "средняя",
                    peak_hours: ["10:00-12:00", "14:00-16:00"],
                    recommendations: ["AI ответ пуст, проверьте настройки"]
                };
            }
            
            let cleanResponse = rawResponse.trim();
            
            // Удаляем markdown блоки
            if (cleanResponse.includes('```json')) {
                const match = cleanResponse.match(/```json\s*([\s\S]*?)\s*```/);
                if (match) {
                    cleanResponse = match[1];
                }
            } else if (cleanResponse.includes('```')) {
                const match = cleanResponse.match(/```\s*([\s\S]*?)\s*```/);
                if (match) {
                    cleanResponse = match[1];
                }
            }
            
            // Удаляем лишний текст после JSON
            const jsonStart = cleanResponse.indexOf('{');
            const jsonEnd = cleanResponse.lastIndexOf('}');
            
            if (jsonStart !== -1 && jsonEnd !== -1) {
                cleanResponse = cleanResponse.substring(jsonStart, jsonEnd + 1);
            }
            
            console.log('Cleaned response for parsing:', cleanResponse);
            
            const parsed = JSON.parse(cleanResponse);
            
            // Нормализуем прогноз нагрузки
            let loadForecast = parsed.load_forecast || "средняя";
            if (loadForecast.toLowerCase() === 'низкий') loadForecast = 'низкая';
            if (loadForecast.toLowerCase() === 'высокий') loadForecast = 'высокая';
            if (loadForecast.toLowerCase() === 'изменяется') loadForecast = 'средняя';
            
            // ✅ Нормализуем рекомендации - извлекаем text из объектов
            let recommendations = [];
            if (Array.isArray(parsed.recommendations)) {
                recommendations = parsed.recommendations.map(rec => {
                    if (typeof rec === 'string') return rec;
                    if (rec && typeof rec === 'object') return rec.text || rec.message || rec.title || 'Рекомендация';
                    return String(rec);
                }).filter(r => r && r.trim());
            }
            
            // Если рекомендаций нет, добавляем стандартные
            if (recommendations.length === 0) {
                recommendations = [
                    "Проверьте загруженность операторов в часы пик",
                    "Оптимизируйте распределение заявок",
                    "Автоматизируйте ответы на частые вопросы"
                ];
            }
            
            // Нормализуем часы пик
            let peakHours = Array.isArray(parsed.peak_hours) ? parsed.peak_hours : ["10:00-12:00", "14:00-16:00"];
            peakHours = peakHours.map(hour => {
                if (hour === 'час6') return '06:00-08:00';
                if (hour === 'час8') return '08:00-10:00';
                if (hour === 'час14') return '14:00-16:00';
                if (hour === 'час0') return '00:00-02:00';
                if (hour === 'час1') return '01:00-03:00';
                if (hour === 'час2') return '02:00-04:00';
                if (hour === 'час3') return '03:00-05:00';
                if (hour === 'час4') return '04:00-06:00';
                if (hour === 'час5') return '05:00-07:00';
                if (hour === 'час6') return '06:00-08:00';
                if (hour === 'час7') return '07:00-09:00';
                if (hour === 'час8') return '08:00-10:00';
                if (hour === 'час9') return '09:00-11:00';
                if (hour === 'час10') return '10:00-12:00';
                if (hour === 'час11') return '11:00-13:00';
                if (hour === 'час12') return '12:00-14:00';
                if (hour === 'час13') return '13:00-15:00';
                if (hour === 'час14') return '14:00-16:00';
                if (hour === 'час15') return '15:00-17:00';
                if (hour === 'час16') return '16:00-18:00';
                if (hour === 'час17') return '17:00-19:00';
                if (hour === 'час18') return '18:00-20:00';
                if (hour === 'час19') return '19:00-21:00';
                if (hour === 'час20') return '20:00-22:00';
                if (hour === 'час21') return '21:00-23:00';
                if (hour === 'час22') return '22:00-00:00';
                if (hour === 'час23') return '23:00-01:00';
                return hour;
            });
            
            return {
                load_forecast: loadForecast,
                peak_hours: peakHours,
                recommendations: recommendations
            };
        } catch (e) {
            console.error('Failed to parse AI JSON:', e.message);
            console.error('Raw response:', rawResponse);
            return {
                load_forecast: "средняя",
                peak_hours: ["10:00-12:00", "14:00-16:00"],
                recommendations: ["Ошибка парсинга ответа AI"]
            };
        }
    }
}

module.exports = AdminController; // Выгрузка