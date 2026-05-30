
//Репозиторий для работы с оценками заявок
class RatingRepository {
    constructor(pool) {
        this.pool = pool;
    }

    //Метод для создания оценки
    async create(ratingData) {
        const { ticket_id, client_id, operator_id, expert_id, rating, comment } = ratingData;
        const result = await this.pool.query(
            `INSERT INTO ticket_ratings (ticket_id, client_id, operator_id, expert_id, rating, comment)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (ticket_id) DO UPDATE SET
                rating = EXCLUDED.rating,
                comment = EXCLUDED.comment,
                created_at = NOW()
             RETURNING *`,
            [ticket_id, client_id, operator_id, expert_id, rating, comment]
        );
        return result.rows[0];
    }

    //Метод для получения оценки по заявке
    async findByTicket(ticket_id) {
        const result = await this.pool.query(
            "SELECT * FROM ticket_ratings WHERE ticket_id = $1",
            [ticket_id]
        );
        return result.rows[0];
    }

    //Метод для получения среднего рейтинга оператора
    async getOperatorAverageRating(operator_id) {
        const result = await this.pool.query(
            `SELECT AVG(rating) as average_rating, COUNT(*) as total_ratings
             FROM ticket_ratings
             WHERE operator_id = $1 AND rating IS NOT NULL`,
            [operator_id]
        );
        return result.rows[0];
    }

    //Метод для получения среднего рейтинга эксперта
    async getExpertAverageRating(expert_id) {
        const result = await this.pool.query(
            `SELECT AVG(rating) as average_rating, COUNT(*) as total_ratings
             FROM ticket_ratings
             WHERE expert_id = $1 AND rating IS NOT NULL`,
            [expert_id]
        );
        return result.rows[0];
    }

    //Метод для получения всех оценок оператора
    async getOperatorRatings(operator_id, limit = 50, offset = 0) {
        const result = await this.pool.query(
            `SELECT tr.*, t.title as ticket_title, u.full_name as client_name
             FROM ticket_ratings tr
             JOIN tickets t ON tr.ticket_id = t.id
             LEFT JOIN users u ON tr.client_id = u.id
             WHERE tr.operator_id = $1
             ORDER BY tr.created_at DESC
             LIMIT $2 OFFSET $3`,
            [operator_id, limit, offset]
        );
        return result.rows;
    }

    //Метод для получения всех оценок эксперта
    async getExpertRatings(expert_id, limit = 50, offset = 0) {
        const result = await this.pool.query(
            `SELECT tr.*, t.title as ticket_title, u.full_name as client_name
             FROM ticket_ratings tr
             JOIN tickets t ON tr.ticket_id = t.id
             LEFT JOIN users u ON tr.client_id = u.id
             WHERE tr.expert_id = $1
             ORDER BY tr.created_at DESC
             LIMIT $2 OFFSET $3`,
            [expert_id, limit, offset]
        );
        return result.rows;
    }
    async getGlobalStats() {
        const result = await this.pool.query(`
            SELECT 
                AVG(rating) as average_rating,
                COUNT(*) as total_ratings,
                COUNT(DISTINCT operator_id) as operators_with_ratings,
                COUNT(DISTINCT expert_id) as experts_with_ratings
            FROM ticket_ratings
            WHERE rating IS NOT NULL
        `);
        return result.rows[0];
}

    async getTopOperators(limit = 10) {
        const result = await this.pool.query(`
            SELECT 
                u.id,
                u.full_name,
                u.email,
                AVG(tr.rating) as average_rating,
                COUNT(tr.id) as total_ratings
            FROM ticket_ratings tr
            JOIN users u ON tr.operator_id = u.id
            WHERE tr.operator_id IS NOT NULL AND tr.rating IS NOT NULL
            GROUP BY u.id, u.full_name, u.email
            HAVING COUNT(tr.id) >= 1
            ORDER BY average_rating DESC
            LIMIT $1
        `, [limit]);
        return result.rows;
    }

    async getTopExperts(limit = 10) {
        const result = await this.pool.query(`
            SELECT 
                u.id,
                u.full_name,
                u.email,
                AVG(tr.rating) as average_rating,
                COUNT(tr.id) as total_ratings
            FROM ticket_ratings tr
            JOIN users u ON tr.expert_id = u.id
            WHERE tr.expert_id IS NOT NULL AND tr.rating IS NOT NULL
            GROUP BY u.id, u.full_name, u.email
            HAVING COUNT(tr.id) >= 1
            ORDER BY average_rating DESC
            LIMIT $1
        `, [limit]);
        return result.rows;
    }

    async getAllRatings(limit = 100, offset = 0) {
        const result = await this.pool.query(`
            SELECT 
                tr.*,
                t.title as ticket_title,
                client.full_name as client_name,
                operator.full_name as operator_name,
                expert.full_name as expert_name
            FROM ticket_ratings tr
            JOIN tickets t ON tr.ticket_id = t.id
            LEFT JOIN users client ON tr.client_id = client.id
            LEFT JOIN users operator ON tr.operator_id = operator.id
            LEFT JOIN users expert ON tr.expert_id = expert.id
            ORDER BY tr.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);
        return result.rows;
    }
}

module.exports = RatingRepository;