//Репозоторий для статусов заявок
class StatusRepository {
    constructor(pool) {
        this.pool = pool; // проверка подключения к бд
    }

// ---------------------------- БАЗОВЫЕ МЕТОДЫ (CRUD) -------------------------------

    //Метод для показа всех статусов
    async findAll() {
        const result = await this.pool.query("SELECT * FROM statuses WHERE deleted_at IS NULL");
        return result.rows;
    }

    //Метод для показа статуса по id
    async findById(id) {
        const result = await this.pool.query(
            "SELECT * FROM statuses WHERE id = $1 AND deleted_at IS NULL",
            [id]
        );
        return result.rows[0];
    }

    //Метод для показа статуса по коду
    async findByCode(code) {
        const result = await this.pool.query(
            "SELECT * FROM statuses WHERE code = $1 AND deleted_at IS NULL",
            [code]
        );
        return result.rows[0];
    }

    //Метод для обновления статуса
    async update(id, code, name) {
        const result = await this.pool.query(
            "UPDATE statuses SET code = $1, name = $2 WHERE id = $3 AND deleted_at IS NULL RETURNING *",
            [code, name, id]
        );
        return result.rows[0];
    }

     //Метод для мягкого удаления
    async softDelete(id) {
        const result = await this.pool.query(
            "UPDATE statuses SET deleted_at = NOW() WHERE id = $1 RETURNING *",
            [id]
        );
        return result.rows[0];
    }

// ---------------------------- МЕТОДЫ ДЛЯ АДМИНА -------------------------------

    //Метод для создания нового статуса
    async create(code, name) {
        const result = await this.pool.query(
            "INSERT INTO statuses (code, name) VALUES ($1, $2) RETURNING *",
            [code, name]
        );
        return result.rows[0];
    }
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

module.exports = StatusRepository; //Выгрузка