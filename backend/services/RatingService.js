
//Сервис для работы с оценками заявок
class RatingService {
    constructor(ratingRepository, ticketRepository) {
        this.ratingRepository = ratingRepository;
        this.ticketRepository = ticketRepository;
    }

    //Метод для создания оценки заявки
    async rateTicket(ticketId, clientId, rating, comment = '') {
        const ticket = await this.ticketRepository.findById(ticketId);

        if (!ticket) {
            throw new Error('Заявка не найдена');
        }

        // Проверяем, что заявка завершена
        const resolvedStatus = await this.ticketRepository.pool.query(
            "SELECT id FROM statuses WHERE code = 'resolved'"
        );

        if (ticket.status_id !== resolvedStatus.rows[0]?.id) {
            throw new Error('Оценить можно только завершенную заявку');
        }

        return await this.ratingRepository.create({
            ticket_id: ticketId,
            client_id: clientId,
            operator_id: ticket.operator_id,
            expert_id: ticket.expert_id,
            rating: parseInt(rating, 10),
            comment: comment || null
        });
    }

    //Метод для получения оценки по заявке
    async getRatingByTicket(ticketId) {
        return await this.ratingRepository.findByTicket(ticketId);
    }

    //Метод для получения среднего рейтинга оператора
    async getOperatorAverageRating(operatorId) {
        return await this.ratingRepository.getOperatorAverageRating(operatorId);
    }

    //Метод для получения среднего рейтинга эксперта
    async getExpertAverageRating(expertId) {
        return await this.ratingRepository.getExpertAverageRating(expertId);
    }

    //Метод для получения всех оценок оператора
    async getOperatorRatings(operatorId, limit = 50, offset = 0) {
        return await this.ratingRepository.getOperatorRatings(operatorId, limit, offset);
    }

    //Метод для получения всех оценок эксперта
    async getExpertRatings(expertId, limit = 50, offset = 0) {
        return await this.ratingRepository.getExpertRatings(expertId, limit, offset);
    }
    async getAdminStats() {
        // Получаем общую статистику по всем оценкам
        const totalStats = await this.ratingRepository.getGlobalStats();
        
        // Получаем топ операторов по рейтингу
        const topOperators = await this.ratingRepository.getTopOperators();
        
        // Получаем топ экспертов по рейтингу
        const topExperts = await this.ratingRepository.getTopExperts();
        
        return {
            global: totalStats,
            top_operators: topOperators,
            top_experts: topExperts
        };
    }

    async getAllRatings(limit, offset) {
        return await this.ratingRepository.getAllRatings(limit, offset);
    }
}

module.exports = RatingService;