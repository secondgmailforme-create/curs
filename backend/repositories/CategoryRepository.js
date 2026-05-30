//Репозоторий для категорий заявок
class CategoryRepository {
    constructor(pool) {
        this.pool = pool; // проверка подключения бд
    }
// ---------------------------- БАЗОВЫЕ МЕТОДЫ (CRUD) -------------------------------

    //Метод для показа всех категорий
    async findAll() {
        const result = await this.pool.query("SELECT * FROM categories WHERE deleted_at IS NULL");
        return result.rows;
    }

    //Метод для показа категории по id
    async findById(id) {
        const result = await this.pool.query(
            "SELECT * FROM categories WHERE id = $1 AND deleted_at IS NULL",
            [id]
        );
        return result.rows[0];
    }

    //Метод для показа категории по expert
    async findByExpert(expert_id) {
        const result = await this.pool.query(
            "SELECT * FROM categories WHERE expert_id = $1 AND deleted_at IS NULL",
            [expert_id]
        );
        return result.rows;
    }

     //Метод для мягкого удаления
    async softDelete(id) {
        const result = await this.pool.query(
            "UPDATE categories SET deleted_at = NOW() WHERE id = $1 RETURNING *",
            [id]
        );
        return result.rows[0];
    }

// ---------------------------- МЕТОДЫ ДЛЯ АДМИНА -------------------------------

    //Метод для созданий новых категорий
    async create(name, expert_id = null) {
        const result = await this.pool.query(
            "INSERT INTO categories (name, expert_id) VALUES ($1, $2) RETURNING *",
            [name, expert_id]
        );
        return result.rows[0];
    }

    //Метод для обновления эксперта если, к примеру он уволился либо он перезагружен
    async updateExpert(id, expert_id) {
        const result = await this.pool.query(
            "UPDATE categories SET expert_id = $1 WHERE id = $2 RETURNING *",
            [expert_id, id]);
        return result.rows[0];
    }
}

module.exports = CategoryRepository; //Выгрузка