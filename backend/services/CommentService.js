//Сервис для работы с комментариями 
class CommentService {
    constructor(commentRepository) {
        this.commentRepository = commentRepository;
    }

    //Метод для создания комментария
    async createComment(ticketId, userId, text) {
        return await this.commentRepository.create({ ticket_id: ticketId, user_id: userId, text });
    }

    //Метод для получения комментария
    async getCommentsByTicket(ticketId) {
        return await this.commentRepository.findByTicket(ticketId);
    }
    
    // Метод для AI-автоответа
    async addAutoReply(ticketId, responseText) {
        return await this.commentRepository.create({
            ticket_id: ticketId,
            user_id: null,
            text: `Автоответ AI:\n\n${responseText}`
        });
    }
}

module.exports = CommentService; //Выгрузка