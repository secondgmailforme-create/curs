//Репозоторий для уведомлений
class NotificationRepository {
    constructor(pool) {
        this.pool = pool; // проверка подключения к бд
    }

// ---------------------------- БАЗОВЫЕ МЕТОДЫ (CRUD) -------------------------------

    //Метод для создания уведомления с ссылкой
    async create(notificationData) {
        const { user_id, type, title, message, link } = notificationData;
        const result = await this.pool.query(
            "INSERT INTO notifications (user_id, type, title, message, link) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [user_id, type, title, message, link]
        );
        return result.rows[0];
    }

    //Метод для показа всех уведомлений по пользователю
    async findByUser(user_id) {
        const result = await this.pool.query(
            "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC",
            [user_id]
        );
        return result.rows;
    }

    //Метод для показа не прочитанных уведомлений
    async findUnreadByUser(user_id) {
        const result = await this.pool.query(
            "SELECT * FROM notifications WHERE user_id = $1 AND is_read = false ORDER BY created_at DESC",
            [user_id]
        );
        return result.rows;
    }

    //Метод, чтобы удалить старые уведомления через время автоматически
    async deleteOld(days) {
        const result = await this.pool.query(
            "DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '1 day' * $1 RETURNING *",
            [days]
        );
        return result.rows;
    }

// ---------------------------- МЕТОДЫ ДЛЯ УКАЗАТЕЛЯ ПРОЧИТАННОСТИ УВЕДОМЛЕНИЙ -------------------------------

    //Метод чтобы прочитать одно уведомление
    async markAsRead(id) {
        const result = await this.pool.query(
            "UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *",
            [id]
        );
        return result.rows[0];
    }

    //Метод, чтобы просмотреть все уведомления
    async markAllAsRead(user_id) {
        const result = await this.pool.query(
            "UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false RETURNING *",
            [user_id]
        );
        return result.rows;
    }

}

module.exports = NotificationRepository; //Выгрузка