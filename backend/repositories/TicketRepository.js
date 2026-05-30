const ticketQueries = require('../queries/ticketqueries'); // Импорт SQL запросов

//Репозоторий для заявок
class TicketRepository {
    constructor(pool) {
        this.pool = pool; // проверка подключения к бд
        this.closedStatusCodes = ticketQueries.CLOSED_STATUS_CODES; // Кэшируем массив статусов, чтобы не создавать его каждый раз заново
    }

// ---------------------------- GRUD ДЛЯ ПОИСКА ЗАЯВОК -------------------------------

    //Метод для показа всех заявок,  реализован динамический SQL
    async findAll(filters = {}, limit = 50, offset = 0) {   
        let sql = `
            SELECT t.*, 
                c.name as category_name,
                s.name as status_name,
                s.code as status_code
            FROM tickets t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN statuses s ON t.status_id = s.id
            WHERE t.deleted_at IS NULL
        `;
        const values = [];
        const conditions = [];
        let paramCounter = 1;

        // Фильтр по статусу
        if (filters.status_id && filters.status_id !== 'all') {
            conditions.push(`t.status_id = $${paramCounter}`);
            values.push(filters.status_id);
            paramCounter++;
        }
        
        // Фильтр по клиенту
        if (filters.client_id !== undefined) {
            conditions.push(`t.client_id = $${paramCounter}`);
            values.push(filters.client_id);
            paramCounter++;
        }
        
        // Фильтр по эксперту
        if (filters.expert_id !== undefined) {
            conditions.push(`t.expert_id = $${paramCounter}`);
            values.push(filters.expert_id);
            paramCounter++;
        }
        
        // Фильтр по оператору
        if (filters.operator_id !== undefined) {
            conditions.push(`t.operator_id = $${paramCounter}`);
            values.push(filters.operator_id);
            paramCounter++;
        }
        
        // Фильтр по приоритету
        if (filters.priority !== undefined) {
            conditions.push(`t.priority = $${paramCounter}`);
            values.push(filters.priority);
            paramCounter++;
        }

        // Фильтр по категории
        if (filters.category_id && filters.category_id !== 'all') {
            conditions.push(`t.category_id = $${paramCounter}`);
            values.push(parseInt(filters.category_id));
            paramCounter++;
        }

        // Фильтр по дате (начало)
        if (filters.date_from) {
            conditions.push(`DATE(t.created_at) >= $${paramCounter}`);
            values.push(filters.date_from);
            paramCounter++;
        }

        // Фильтр по дате (конец)
        if (filters.date_to) {
            conditions.push(`DATE(t.created_at) <= $${paramCounter}`);
            values.push(filters.date_to);
            paramCounter++;
        }

        // Поиск по тексту (название или описание)
        if (filters.search) {
            conditions.push(`(t.title ILIKE $${paramCounter} OR t.description ILIKE $${paramCounter})`);
            values.push(`%${filters.search}%`);
            paramCounter++;
        }

        if (conditions.length > 0) {
            sql += " AND " + conditions.join(" AND ");
        }

        sql += ` ORDER BY t.created_at DESC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
        values.push(limit, offset);

        const result = await this.pool.query(sql, values);
        return result.rows;
    }

    // Добавим метод для подсчета общего количества с фильтрами
    async countWithFilters(filters = {}) {
        let sql = `
            SELECT COUNT(*) as total
            FROM tickets t
            WHERE t.deleted_at IS NULL
        `;
        const values = [];
        const conditions = [];
        let paramCounter = 1;

        if (filters.status_id && filters.status_id !== 'all') {
            conditions.push(`t.status_id = $${paramCounter}`);
            values.push(filters.status_id);
            paramCounter++;
        }
        
        if (filters.client_id !== undefined) {
            conditions.push(`t.client_id = $${paramCounter}`);
            values.push(filters.client_id);
            paramCounter++;
        }
        
        if (filters.category_id && filters.category_id !== 'all') {
            conditions.push(`t.category_id = $${paramCounter}`);
            values.push(parseInt(filters.category_id));
            paramCounter++;
        }

        if (filters.date_from) {
            conditions.push(`DATE(t.created_at) >= $${paramCounter}`);
            values.push(filters.date_from);
            paramCounter++;
        }

        if (filters.date_to) {
            conditions.push(`DATE(t.created_at) <= $${paramCounter}`);
            values.push(filters.date_to);
            paramCounter++;
        }

        if (conditions.length > 0) {
            sql += " AND " + conditions.join(" AND ");
        }

        const result = await this.pool.query(sql, values);
        return parseInt(result.rows[0].total);
    }

    //Метод для поиска заявки по id
    async findById(id) {
        const result = await this.pool.query(
            `SELECT t.*,
                    op.full_name as operator_full_name,
                    u.full_name as client_name, u.email as client_email,
                    s.code as status_code, c.name as category_name
             FROM tickets t
             LEFT JOIN users u ON t.client_id = u.id
             LEFT JOIN users op ON t.operator_id = op.id
             LEFT JOIN statuses s ON t.status_id = s.id
             LEFT JOIN categories c ON t.category_id = c.id
             WHERE t.id = $1`,
            [id]
        );
        return result.rows[0];
    }

    //Метод для поиска заявки по клиенту
    async findByClient(client_id, filters = {}) {
        let sql = `
            SELECT t.*, 
                c.name as category_name,
                s.name as status_name,
                s.code as status_code
            FROM tickets t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN statuses s ON t.status_id = s.id
            WHERE t.client_id = $1 AND t.deleted_at IS NULL
        `;
        const values = [client_id];
        const conditions = [];
        let paramCounter = 2;

        if (filters.status_id && filters.status_id !== 'all') {
            conditions.push(`t.status_id = $${paramCounter}`);
            values.push(filters.status_id);
            paramCounter++;
        }
        
        if (filters.category_id && filters.category_id !== 'all') {
            conditions.push(`t.category_id = $${paramCounter}`);
            values.push(parseInt(filters.category_id));
            paramCounter++;
        }

        if (filters.date_from) {
            conditions.push(`DATE(t.created_at) >= $${paramCounter}`);
            values.push(filters.date_from);
            paramCounter++;
        }

        if (filters.date_to) {
            conditions.push(`DATE(t.created_at) <= $${paramCounter}`);
            values.push(filters.date_to);
            paramCounter++;
        }

        if (conditions.length > 0) {
            sql += " AND " + conditions.join(" AND ");
        }

        sql += ` ORDER BY t.created_at DESC`;

        const result = await this.pool.query(sql, values);
        return result.rows;
    }

   //Метод для поиска заявки по эксперту (расширенный)
    async findByExpert(expert_id) {
        const result = await this.pool.query(
            `SELECT t.*, u.full_name as client_name, u.email as client_email,
                    s.code as status_code, c.name as category_name
            FROM tickets t
            LEFT JOIN users u ON t.client_id = u.id
            LEFT JOIN statuses s ON t.status_id = s.id
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.expert_id = $1 
            AND t.deleted_at IS NULL
            ORDER BY t.created_at DESC`,
            [expert_id]
        );
        return result.rows;
    }

    //Метод для поиска заявок, ожидающих эксперта (общая очередь для экспертов)
    async findUnassignedWaitingForExpertTickets() {
        const result = await this.pool.query(
            `SELECT t.*, u.full_name as client_name, u.email as client_email,
                    s.code as status_code, c.name as category_name,
                    op.full_name as operator_name
            FROM tickets t
            LEFT JOIN users u ON t.client_id = u.id
            LEFT JOIN statuses s ON t.status_id = s.id
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN users op ON t.operator_id = op.id
            WHERE t.expert_id IS NULL
            AND t.deleted_at IS NULL
            AND t.status_id IN (
                SELECT id FROM statuses WHERE code IN ('waiting_for_expert')
            )
            ORDER BY t.created_at ASC`,
            []
        );
        return result.rows;
    }

    //Метод для поиска заявок, переданных эксперту (эскалированные)
    async findEscalatedToExpertTickets() {
        const result = await this.pool.query(
            `SELECT t.*, u.full_name as client_name, u.email as client_email,
                    s.code as status_code, c.name as category_name,
                    op.full_name as operator_name
            FROM tickets t
            LEFT JOIN users u ON t.client_id = u.id
            LEFT JOIN statuses s ON t.status_id = s.id
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN users op ON t.operator_id = op.id
            WHERE t.expert_id IS NULL
            AND t.deleted_at IS NULL
            AND t.status_id IN (
                SELECT id FROM statuses WHERE code IN ('escalated')
            )
            ORDER BY t.created_at ASC`,
            []
        );
        return result.rows;
    }

    async findEscalatedToAdminTickets() {
        const result = await this.pool.query(
            `SELECT t.*, u.full_name as client_name, u.email as client_email,
                    s.code as status_code, c.name as category_name,
                    op.full_name as operator_name, e.full_name as expert_name
            FROM tickets t
            LEFT JOIN users u ON t.client_id = u.id
            LEFT JOIN statuses s ON t.status_id = s.id
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN users op ON t.operator_id = op.id
            LEFT JOIN users e ON t.expert_id = e.id
            WHERE t.deleted_at IS NULL
            AND t.status_id IN (
                SELECT id FROM statuses WHERE code IN ('escalated')
            )
            ORDER BY t.created_at ASC`,
            []
        );
        return result.rows;
    }
    async findByAdminId(adminId) {
        const result = await this.pool.query(
            `SELECT t.*, u.full_name as client_name, u.email as client_email,
                    s.code as status_code, c.name as category_name,
                    op.full_name as operator_name, e.full_name as expert_name
            FROM tickets t
            LEFT JOIN users u ON t.client_id = u.id
            LEFT JOIN statuses s ON t.status_id = s.id
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN users op ON t.operator_id = op.id
            LEFT JOIN users e ON t.expert_id = e.id
            WHERE t.deleted_at IS NULL
            AND t.admin_id = $1
            ORDER BY t.created_at DESC`,
            [adminId]
        );
        return result.rows;
    }

    //Метод для поиска заявки по оператору
    async findByOperator(operator_id) {
        const result = await this.pool.query(
            `SELECT t.*, u.full_name as client_name, u.email as client_email,
                    s.code as status_code, c.name as category_name
            FROM tickets t
            LEFT JOIN users u ON t.client_id = u.id
            LEFT JOIN statuses s ON t.status_id = s.id
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.operator_id = $1 
            AND t.deleted_at IS NULL
            AND t.status_id NOT IN (5, 6)  -- Не показываем решённые и отменённые
            ORDER BY 
            CASE t.status_id 
                WHEN 2 THEN 1  -- В работе (оператор) - самые приоритетные
                WHEN 4 THEN 2  -- В работе (эксперт)
                WHEN 3 THEN 3  -- Ожидает эксперта
                ELSE 4
            END,
            t.created_at DESC`,
            [operator_id]
        );
        return result.rows;
    }
    async findUnassignedNewTickets() {
        const result = await this.pool.query(
            `SELECT t.*, u.full_name as client_name, u.email as client_email,
                    s.code as status_code, c.name as category_name
             FROM tickets t
             LEFT JOIN users u ON t.client_id = u.id
             LEFT JOIN statuses s ON t.status_id = s.id
             LEFT JOIN categories c ON t.category_id = c.id
             WHERE t.operator_id IS NULL
               AND t.deleted_at IS NULL
               AND t.status_id IN (
                   SELECT id FROM statuses WHERE code IN ('new')
               )
             ORDER BY t.created_at ASC`
        );
        return result.rows;
    }

    async findWaitingForOperatorTickets() {
        const result = await this.pool.query(
            `SELECT t.*, u.full_name as client_name, u.email as client_email,
                    s.code as status_code, c.name as category_name
            FROM tickets t
            LEFT JOIN users u ON t.client_id = u.id
            LEFT JOIN statuses s ON t.status_id = s.id
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.operator_id IS NULL
            AND t.deleted_at IS NULL
            AND t.status_id = (
                SELECT id FROM statuses WHERE code = 'waiting_for_operator'
            )
            ORDER BY t.created_at ASC`, 
        );
        return result.rows;
    }

    //Метод для поиска просроченных заявок
    async findOverdue(thresholdDate) {
        const params = [thresholdDate, ...this.closedStatusCodes];
        const result = await this.pool.query(ticketQueries.SQL_FIND_OVERDUE, params);
        return result.rows;
    }

// ---------------------------- GRUD ДЛЯ СОЗДАНИЯ И ОБНОВЛЕНИЯ ЗАЯВОК -------------------------------

    //Метод для создание заявки
    async create(ticketData) {
        const { title, description, client_id, operator_id, expert_id, category_id, status_id, priority} = ticketData;
        const result = await this.pool.query(
            "INSERT INTO tickets (title, description, client_id, operator_id, expert_id, category_id, status_id, priority) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
            [title, description, client_id, operator_id, expert_id, category_id, status_id, priority]
        );
        return result.rows[0];
    }

    //Метод для обновления статуса заявки
    async updateStatus(id, status_id) {
        const result = await this.pool.query(
            "UPDATE tickets SET status_id = $1 WHERE id = $2 RETURNING *",
            [status_id, id]
        );
        return result.rows[0];
    }

    //Метод для обновления оператора
    async updateOperator(id, operator_id) {
        const result = await this.pool.query(
            "UPDATE tickets SET operator_id = $1 WHERE id = $2 RETURNING *",
            [operator_id, id]
        );
        return result.rows[0];
    }

    async assignOperator(id, operator_id) {
        return await this.updateOperator(id, operator_id);
    }

    async assignExpert(id, expert_id) {
        return await this.updateExpert(id, expert_id);
    }


    //Метод для обновления эксперта
    async updateExpert(id, expert_id) {
        const result = await this.pool.query(
            "UPDATE tickets SET expert_id = $1 WHERE id = $2 RETURNING *",
            [expert_id, id]
        );
        return result.rows[0];
    }

    //Метод для обновления приоритета 
    async updatePriority(id, priority) {
        const result = await this.pool.query(
            "UPDATE tickets SET priority = $1 WHERE id = $2 RETURNING *",
            [priority, id]
        );
        return result.rows[0];
    }

// ---------------------------- ПРОЧИЕ МЕТОДЫ -------------------------------

    //Метод для мягкого удаления заявки
    async softDelete(id) {
        const result = await this.pool.query(
            "UPDATE tickets SET deleted_at = NOW() WHERE id = $1 RETURNING *",
            [id]
        );
        return result.rows[0];
    }

    //Метод для переоткрытия заявки
    async restore(id) {
        const result = await this.pool.query(
            "UPDATE tickets SET deleted_at = NULL WHERE id = $1 RETURNING *",
            [id]
        );
        return result.rows[0];
    }

    //Метод для количества заявок с конкректным статусом
    async countByStatus(status_id) {
        const result = await this.pool.query(
            "SELECT COUNT(*) FROM tickets WHERE status_id = $1",
            [status_id]
        );
        return parseInt(result.rows[0].count);
    }

// ---------------------------- Взаимодействие с экспертами -------------------------------

    //Метод для информации о загруженности эксперта
    async getExpertLoad(expertId) {
        const params = [expertId, ...this.closedStatusCodes];
        const result = await this.pool.query(ticketQueries.SQL_GET_EXPERT_LOAD, params);
        return parseInt(result.rows[0].load);
    }

    //Метод для фильтрации экспертов, тоесть система смотрит, если нужный эксперт свободен, то отдай ему заявку
    async getExpertsByCategoryWithLoad(categoryId) {
        const params = [categoryId, ...this.closedStatusCodes];
        const result = await this.pool.query(ticketQueries.SQL_GET_EXPERTS_BY_CATEGORY, params);
        return result.rows;
    }

    //Метод для показа активности клиента за две недели
    async getWeeklyTicketCount(clientId) {
        const result = await this.pool.query(ticketQueries.SQL_GET_WEEKLY_COUNT, [clientId]);
        return result.rows[0];
    }
}

module.exports = TicketRepository; //Выгрузка