const STATUSES = require('../constants/statuses'); //  подключаем константы статусов
const CLOSED_STATUS_CODES = [STATUSES.RESOLVED, STATUSES.CANCELED]; // кэшируем коды статусов для удобства 

module.exports = {
//SQL ДЛЯ Выбора наилучшего эксперта
SQL_GET_EXPERTS_BY_CATEGORY: `
    SELECT u.id, u.full_name, u.email,
        (SELECT COUNT(*) FROM tickets t
        WHERE t.expert_id = u.id
        AND t.status_id NOT IN (
            SELECT id FROM statuses WHERE code IN ($2, $3)
        )) as current_load
    FROM users u
    WHERE u.role_id = 3 
    AND u.id IN (
        SELECT expert_id FROM categories WHERE id = $1
    )
    ORDER BY current_load ASC
`,

//SQL ДЛЯ СУММЫ ЗАЯВОК ЗА НЕДЕЛЮ ДЛЯ КЛИЕНТА
SQL_GET_WEEKLY_COUNT: `
    SELECT 
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as this_week,
        COUNT(CASE WHEN created_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days' THEN 1 END) as last_week
    FROM tickets
    WHERE client_id = $1
`,

//SQL ДЛЯ ПРОСРОЧЕННЫХ ЗАЯВОК
SQL_FIND_OVERDUE: `
    SELECT * FROM tickets 
    WHERE created_at < $1 
    AND status_id NOT IN (
        SELECT id FROM statuses WHERE code IN ($2, $3)
    ) 
    AND deleted_at IS NULL
`,

//SQL ДЛЯ загруженности эксперта
SQL_GET_EXPERT_LOAD: `
    SELECT COUNT(*) as load
    FROM tickets
    WHERE expert_id = $1
    AND status_id NOT IN (
        SELECT id FROM statuses WHERE code IN ($2, $3)
    )
`,
}