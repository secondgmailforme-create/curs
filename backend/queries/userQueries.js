const STATUSES = require('../constants/statuses');// импорт констант статусов
 
// SQL для расчета рейтинга эксперта
module.exports = {
  UPDATE_EXPERT_RATING: `
    UPDATE users u
    SET rating = (
        SELECT COALESCE(AVG(5 - EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600), 0)
        FROM tickets t
        WHERE t.expert_id = u.id AND t.status_id = $2
    ) + (u.resolved_count * 0.01)
    WHERE u.id = $1
    RETURNING rating
  `,
}