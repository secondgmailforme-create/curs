//Репозоторий для самообучения AI 
class AITrainingDataRepository {
    constructor(pool) {
        this.pool = pool; // проверка подключения бд
    }

// ---------------------------- БАЗОВЫЕ МЕТОДЫ (CRUD) -------------------------------

    //Метод для загрузки данных заявки в таблицу данных для обучения
    async create(data) {
        const { ticket_id, input_text, output_text, category_id, model_used, generation_time } = data;
        const result = await this.pool.query(
            "INSERT INTO ai_training_data (ticket_id, input_text, output_text, category_id, model_used, generation_time) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
            [ticket_id, input_text, output_text, category_id, model_used || null, generation_time || null]
        );
        return result.rows[0];
    }

    //Метод для удобного поиска по категории среди данных для обучения
    async findByCategory(category_id) {
        const result = await this.pool.query(
            "SELECT * FROM ai_training_data WHERE category_id = $1",
            [category_id]
        );
        return result.rows;
    }

    //Метод для векторного поиска
    async findSimilar(inputEmbedding, limit = 5) {
        const result = await this.pool.query(
            "SELECT * FROM ai_training_data ORDER BY created_at DESC LIMIT $1",
            [limit]
        );
        return result.rows;
    }

// ---------------------------- МЕТОДЫ ДЛЯ АДМИНА -------------------------------

    //Метод, который показывает все данные для обучения AI
    async findAll() {
        const result = await this.pool.query("SELECT * FROM ai_training_data");
        return result.rows;
    }
}

module.exports = AITrainingDataRepository; //Выгрузка