//Репозоторий для истории заявок
class TicketHistoryRepository {
    constructor(pool) {
        this.pool = pool; // проверка подключения к бд
    }

// ---------------------------- БАЗОВЫЕ МЕТОДЫ (CRUD) -------------------------------

    //Метод для записи истории в БД
    async create(historyData) {
        const { ticket_id, user_id, action, old_status_id, new_status_id, old_data, new_data } = historyData;
        const result = await this.pool.query(
            `INSERT INTO ticket_history (ticket_id, user_id, action, old_status_id, new_status_id, old_data, new_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [ticket_id, user_id, action, old_status_id, new_status_id, old_data, new_data]
        );
        return result.rows[0];
    }

    //Метод для поиска истории определенной заявки
    async findByTicket(ticket_id) {
        const result = await this.pool.query(
            "SELECT * FROM ticket_history WHERE ticket_id = $1 ORDER BY changed_at DESC",
            [ticket_id]
        );
        return result.rows;
    }

    //Метод для поиска истории по пользователю
    async findByUser(user_id) {
        const result = await this.pool.query(
            "SELECT * FROM ticket_history WHERE user_id = $1 ORDER BY changed_at DESC",
            [user_id]
        );
        return result.rows;
    }
}

module.exports = TicketHistoryRepository; //Выгрузка