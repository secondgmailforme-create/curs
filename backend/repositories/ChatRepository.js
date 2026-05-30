//Репозоторий для сообщений чата
class ChatRepository {
    constructor(pool) {
        this.pool = pool; // проверка подключения бд
    }
// ---------------------------- БАЗОВЫЕ МЕТОДЫ -------------------------------

    async create(ticketId, sender, message) {
        return this.saveMessage(ticketId, sender, message);
    }
    
    //Метод для сохранения сообщений
    async saveMessage(ticketId, sender, message,attachments = []) {
        try {
            const result = await this.pool.query(
                `INSERT INTO chat_messages (ticket_id, sender, message, attachments, created_at)
                 VALUES ($1, $2, $3, $4, NOW())
                 RETURNING id, ticket_id, sender, message, attachments, created_at`,
                [ticketId, sender, message, JSON.stringify(attachments)]
            );
            return result.rows[0];
        } catch (error) {
            console.error('ChatRepository saveMessage error:', error);
            throw error;
        }
    }

    //Метод для выгрузки всего чата
    async getMessagesByTicket(ticketId, limit = 100) {
        const result = await this.pool.query(
            `SELECT id, ticket_id, sender, message, attachments, created_at
             FROM chat_messages 
             WHERE ticket_id = $1 
             ORDER BY created_at ASC 
             LIMIT $2`,
            [ticketId, limit]
        );
        return result.rows;
    }

    //Метод для показа последнего сообщения
    async getLastMessage(ticketId) {
        const result = await this.pool.query(
            `SELECT message, sender, attachments, created_at 
             FROM chat_messages 
             WHERE ticket_id = $1 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [ticketId]
        );
        return result.rows[0];
    }
    
    //Удалений всех сообщений
    async deleteMessagesByTicket(ticketId) {
        await this.pool.query(
            `DELETE FROM chat_messages WHERE ticket_id = $1`,
            [ticketId]
        );
    }
    async getUnreadCountForExpert(ticketId, expertId) {
        const result = await this.pool.query(
            `SELECT COUNT(*) as count
             FROM chat_messages
             WHERE ticket_id = $1
             AND sender != 'expert'
             AND created_at > (
                 SELECT MAX(created_at)
                 FROM chat_messages
                 WHERE ticket_id = $1
                 AND sender = 'expert'
             )`,
            [ticketId]
        );
        return parseInt(result.rows[0]?.count || 0);
    }

    //Метод для получения количества непрочитанных сообщений для админа
    async getUnreadCountForAdmin(ticketId) {
        const result = await this.pool.query(
            `SELECT COUNT(*) as count
             FROM chat_messages
             WHERE ticket_id = $1
             AND sender NOT IN ('admin', 'ai')
             AND created_at > (
                 SELECT MAX(created_at)
                 FROM chat_messages
                 WHERE ticket_id = $1
                 AND sender = 'admin'
             )`,
            [ticketId]
        );
        return parseInt(result.rows[0]?.count || 0);
    }
}

module.exports = ChatRepository; //Выгрузка