//Репозоторий для журнала действий
class LogRepository {
    constructor(pool) {
        this.pool = pool; // проверка подключения к бд
    }

// ---------------------------- БАЗОВЫЕ МЕТОДЫ -------------------------------

    //Метод для сохранения записи в журнал
    async create(logData) {
        const { user_id, action, entity_type, entity_id } = logData;
        const result = await this.pool.query(
            "INSERT INTO logs (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4) RETURNING *",
            [user_id, action, entity_type, entity_id]
        );
        return result.rows[0];
    }
    
    //Метод для просмотра действий определенного пользователя
    async findByUser(user_id) {
        const result = await this.pool.query(
            "SELECT * FROM logs WHERE user_id = $1 ORDER BY created_at DESC",
            [user_id]
        );
        return result.rows;
    }

    //Метод для просмотра действий определенного обьекта
    async findByEntity(entity_type, entity_id) {
        const result = await this.pool.query(
            "SELECT * FROM logs WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC",
            [entity_type, entity_id]
        );
        return result.rows;
    }

// ---------------------------- МЕТОДЫ ДЛЯ АДМИНА -------------------------------

    //Просмотр полного списка логов
    async findAll() {
        const result = await this.pool.query("SELECT * FROM logs ORDER BY created_at DESC");
        return result.rows;
    }

    //Просмотр списка логов по дате
    async findByDateRange(start, end) {
        const result = await this.pool.query(
            "SELECT * FROM logs WHERE created_at BETWEEN $1 AND $2 ORDER BY created_at DESC",
            [start, end]
        );
        return result.rows;
    }
}

module.exports = LogRepository; //Выгрузка