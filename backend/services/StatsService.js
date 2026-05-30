const { Parser } = require('json2csv'); // Импорт библиотеки для парсинга данных

//Сервис для статистика для админа
class StatsService {
    constructor(ticketRepository, userRepository,logRepository,aiTrainingRepository) {
        this.ticketRepository = ticketRepository;
        this.userRepository = userRepository;
        this.logRepository = logRepository;
        this.aiTrainingRepository = aiTrainingRepository;
    }
// ---------------------------- МЕТОДЫ ДЛЯ АДМИНА -------------------------------
    //Метод для основной статистики
    async getDashboardStats() {
        const allTickets = await this.ticketRepository.findAll({});
        const resolvedTickets = allTickets.filter(t => {
            return t.status_id === 5; // resolved
        });

        const operators = await this.userRepository.findByRole(2);
        const experts = await this.userRepository.findByRole(3);

        const avgResolutionTime = this.calculateAvgResolutionTime(resolvedTickets);

        return {
            totalTickets: allTickets.length,
            openTickets: allTickets.filter(t => t.status_id !== 5).length,
            resolvedTickets: resolvedTickets.length,
            avgResolutionTime: `${Math.round(avgResolutionTime)} ч`,
            operatorsCount: operators.length,
            expertsCount: experts.length
        };
    }

    //Метод для поиса среднго времени
    calculateAvgResolutionTime(resolvedTickets) {
        if (resolvedTickets.length === 0) return 0;

        let totalHours = 0;
        for (const ticket of resolvedTickets) {
            if (ticket.created_at && ticket.resolved_at) {
                const created = new Date(ticket.created_at);
                const resolved = new Date(ticket.resolved_at);
                const hours = (resolved - created) / (1000 * 60 * 60);
                totalHours += hours;
            }
        }
        return totalHours / resolvedTickets.length;
    }

    //Метод для статистики времени заявок
    async getAdvancedStats() {
        const allTickets = await this.ticketRepository.findAll({});
        
        const byCategory = {};
        for (const ticket of allTickets) {
            const catId = ticket.category_id;
            if (catId) {
                byCategory[catId] = (byCategory[catId] || 0) + 1;
            }
        }
        
        const byHour = {};
        for (const ticket of allTickets) {
            if (ticket.created_at) {
                const hour = new Date(ticket.created_at).getHours();
                byHour[hour] = (byHour[hour] || 0) + 1;
            }
        }
        
        return {
            total: allTickets.length,
            byCategory,
            byHour,
            avgResolutionTime: this.calculateAvgResolutionTime(
                allTickets.filter(t => t.resolved_at)
            )
        };
    }
    
    //Метод для экспорта заявок в CSV
    async exportTicketsToCSV(filters = {}) {
        const tickets = await this.ticketRepository.findAll(filters);
        
        const fields = ['id', 'title', 'description', 'status_id', 'priority', 'created_at', 'resolved_at'];
        const parser = new Parser({ fields });
        return parser.parse(tickets);
    }

    //Метод для поучения недельной статистики клиента
    async getClientWeeklyStats(clientId) {
        const weeklyData = await this.ticketRepository.getWeeklyTicketCount(clientId);
        const diff = weeklyData.this_week - weeklyData.last_week;
        const trend = diff > 0 ? `+${diff}` : `${diff}`;
        
        return {
            this_week: weeklyData.this_week,
            last_week: weeklyData.last_week,
            trend: trend
        };
    }

     // Получение логов (с пагинацией для безопасности)
    async getLogs(limit = 100, offset = 0, start = null, end = null) {
        if (start && end) {
            return await this.logRepository.findByDateRange(start, end);
        }
        return await this.logRepository.findAll(limit, offset); 
    }

    // Получение данных для обучения ИИ
    async getAITrainingData() {
        return await this.aiTrainingRepository.findAll();
    }

}

module.exports = StatsService; //Выгрузка