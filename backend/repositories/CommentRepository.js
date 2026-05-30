//Репозоторий для комментариев к заявке
class CommentRepository {
    constructor(pool) {
        this.pool = pool; // проверка подключения бд
    }
// ---------------------------- БАЗОВЫЕ МЕТОДЫ (CRUD) -------------------------------

    //Метод для сохранения комментария
    async create(commentData) {
        const { ticket_id, user_id, text } = commentData;
        const result = await this.pool.query(
            "INSERT INTO comments (ticket_id, user_id, text) VALUES ($1, $2, $3) RETURNING *",
            [ticket_id, user_id, text]
        );
        return result.rows[0];
    }

    //Метод для поиска комментария по заявке
    async findByTicket(ticket_id) {
        const result = await this.pool.query(
            "SELECT * FROM comments WHERE ticket_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC",
            [ticket_id]
        );
        return result.rows;
    }

    //Метод для поиска комментария по пользователю
    async findByUser(user_id) {
        const result = await this.pool.query(
            "SELECT * FROM comments WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC",
            [user_id]
        );
        return result.rows;
    }

    //Метод для мягкого удаления комментария
    async softDelete(id) {
        const result = await this.pool.query(
            "UPDATE comments SET deleted_at = NOW() WHERE id = $1 RETURNING *",
            [id]
        );
        return result.rows[0];
    }
}

module.exports = CommentRepository; //Выгрузка