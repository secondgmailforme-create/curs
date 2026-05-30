const userQueries = require('../queries/userQueries'); // Импорт констант SQL запросов для Рейтинга
const tokenQueries = require('../queries/tokenQueries'); // Импорт констант SQL запросов для токенов
const STATUSES = require('../constants/statuses');// Импорт констант статусов заявок

//Репозоторий для пользователя
class UserRepository {
    constructor(pool) {
        this.pool = pool; // проверка подключения к бд
        this.resolvedStatusId = STATUSES.RESOLVED; 
    }
// ---------------------------- БАЗОВЫЕ МЕТОДЫ (CRUD) -------------------------------

    //Метод для поиска пользователя по email
    async findByEmail(email) {
        const result = await this.pool.query("SELECT * FROM users WHERE email = $1", [email]);
        return result.rows[0];
    }

    //Метод для поиска пользователя по id
    async findById(id) {
        const result = await this.pool.query("SELECT * FROM users WHERE id = $1", [id]);
        return result.rows[0];
    }

    //Метод для поиска пользователя по роли
    async findByRole(role_id) {
        const result = await this.pool.query(
            "SELECT * FROM users WHERE role_id = $1 AND deleted_at IS NULL",
            [role_id]
        );
        return result.rows;
    }

    //Метод для создания нового пользователя
    async createNewUser(data) {
        const { email, phone, full_name, password_hash, role_id } = data;
        const result = await this.pool.query(
            "INSERT INTO users (email, phone, full_name, password_hash, role_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [email, phone, full_name, password_hash, role_id]
        );
        return result.rows[0];
    }

    //Метод для обновления пользователя
    async update(id, data) {
        const fields = [];
        const values = [];
        let paramCounter = 1;
        
        if (data.full_name !== undefined) {
            fields.push(`full_name = $${paramCounter++}`);
            values.push(data.full_name);
        }
        if (data.phone !== undefined) {
            fields.push(`phone = $${paramCounter++}`);
            values.push(data.phone);
        }
        if (data.email !== undefined) {
            fields.push(`email = $${paramCounter++}`);
            values.push(data.email);
        }
        if (data.is_active !== undefined) {
            fields.push(`is_active = $${paramCounter++}`);
            values.push(data.is_active);
        }
        
        if (data.is_verified !== undefined) {
            fields.push(`is_verified = $${paramCounter++}`);
            values.push(data.is_verified);
        }
        
        if (fields.length === 0) return null;
        
        values.push(id);
        const query = `
            UPDATE users 
            SET ${fields.join(', ')}, updated_at = NOW()
            WHERE id = $${paramCounter}
            RETURNING *
        `;
        
        console.log('Update query:', query);
        console.log('Update values:', values);
        
        const result = await this.pool.query(query, values);
        console.log('Update result:', result.rows);
        
        return result.rows[0];
    }

    // Обновление профиля с аватаром
   async updateProfile(userId, data) {
        const { full_name, phone } = data;
        
       
        const userExists = await this.pool.query(
            "SELECT id FROM users WHERE id = $1",  // ← убрали AND deleted_at IS NULL
            [userId]
        );
        
        if (userExists.rows.length === 0) {
            throw new Error('Пользователь не найден');
        }
        
        const query = `
            UPDATE users 
            SET full_name = COALESCE($1, full_name),
                phone = COALESCE($2, phone),
                updated_at = NOW()
            WHERE id = $3  -- ← убрали AND deleted_at IS NULL
            RETURNING id, full_name, phone, email, created_at
        `;
        
        const values = [
            full_name !== undefined ? full_name : null,
            phone !== undefined ? phone : null,
            userId
        ];
        
        try {
            const result = await this.pool.query(query, values);
            
            if (result.rows.length === 0) {
                throw new Error('Пользователь не найден');
            }
            
            return result.rows[0];
        } catch (error) {
            console.error('Ошибка updateProfile:', error);
            throw error;
        }
    }
    //Метод для обновления пользователя
    async updateUser(userId, data) {
        const query = `
            UPDATE users 
            SET password_hash = COALESCE($1, password_hash),
                full_name = COALESCE($2, full_name),
                phone = COALESCE($3, phone)
            WHERE id = $4
            RETURNING *;
        `;
        const values = [data.password_hash, data.full_name, data.phone, userId];
        const result = await this.pool.query(query, values);
        return result.rows[0];
    }

    //Метод для мягкого удаления пользователя
    async softDelete(id) {
        const result = await this.pool.query(
            "UPDATE users SET deleted_at = NOW() WHERE id = $1 RETURNING *",
            [id]
        );
        return result.rows[0];
    }

    // Метод для сброса счетчика ежедневных заявок и даты
    async resetDailyTickets(userId) {
        await this.pool.query(
            "UPDATE users SET daily_tickets_count = 0, last_ticket_date = CURRENT_DATE WHERE id = $1",
            [userId]
        );
    }

    //Метод для увеличение счетчика заявок
    async incrementDailyTickets(userId) {
        await this.pool.query(
            "UPDATE users SET daily_tickets_count = daily_tickets_count + 1 WHERE id = $1",
            [userId]
        );
    }
    
    //Метод для получение пользователя с его лимитами
    async findByIdWithLimits(userId) {
        const result = await this.pool.query(
            "SELECT * FROM users WHERE id = $1",
            [userId]
        );
        return result.rows[0];
    }

// ---------------------------- МЕТОДЫ БЕЗОПАСНОСТИ И РОЛЕЙ ----------------------------

    //Метод для обновления пароля пользователя
    async updatePassword(id, password_hash) {
        const result = await this.pool.query(
            "UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING *",
            [password_hash, id]
        );
        return result.rows[0];
    }

    //Метод для обновления гугл id
    async updateGoogleId(userId, googleId) {
        const result = await this.pool.query(
            'UPDATE users SET google_id = $1 WHERE id = $2 RETURNING *',
            [googleId, userId]
        );
        return result.rows[0];
    }

     //Метод для поиска гугл id
    async findByGoogleId(googleId) {
        const result = await this.pool.query(
            'SELECT * FROM users WHERE google_id = $1',
            [googleId]
        );
        return result.rows[0];
    }

// ---------------------------- РАБОТА С ТОКЕНАМИ ----------------------------

    //Метод для сохранения токена ссесии
    async saveRefreshToken(userId, refreshToken, expiresAt) {
        await this.pool.query('DELETE FROM user_tokens WHERE user_id = $1', [userId]);
        await this.pool.query(
            'INSERT INTO user_tokens (user_id, refresh_token, expires_at) VALUES ($1, $2, $3)',
            [userId, refreshToken, expiresAt]
        );
    }

    //Метод для поиска токена ссесии
    async findRefreshToken(refreshToken) {
        const result = await this.pool.query(tokenQueries.FIND_REFRESH_TOKEN, [refreshToken]);
        return result.rows[0];
    }

    //Метод для удаления токена
    async deleteRefreshToken(refreshToken) {
        await this.pool.query('DELETE FROM user_tokens WHERE refresh_token = $1', [refreshToken]);
    }

    //Метод для сохранения токена изменения пароля
    async savePasswordResetToken(userId, token, expiresAt) {
        await this.pool.query('DELETE FROM password_resets WHERE user_id = $1', [userId]);
        await this.pool.query(
            'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [userId, token, expiresAt]
        );
    }

    //Метод для поиска токена изменения пароля
     async findPasswordResetToken(token) {
        const result = await this.pool.query(tokenQueries.FIND_PASSWORD_RESET_TOKEN, [token]);
        return result.rows[0];
    }

    //Метод для удаления токена изменения пароля
    async deletePasswordResetToken(token) {
        await this.pool.query(tokenQueries.DELETE_PASSWORD_RESET_TOKEN, [token]);
    }



// ---------------------------- БИЗНЕС-ЛОГИКА (РЕЙТИНГ) ----------------------------

    //Метод для обновления рейтинга expert
    async updateExpertRating(expertId) {
        const result = await this.pool.query(
            userQueries.UPDATE_EXPERT_RATING,
            [expertId, this.resolvedStatusId]
        );
        return result.rows[0];
    }

// ---------------------------- МЕТОДЫ ДЛЯ ВЕРИФИКАЦИИ EMAIL ----------------------------

    //Метод для сохранения верификационного кода email
    async saveVerificationCode(email, code, expiresAt) {
        await this.pool.query( "DELETE FROM verification_codes WHERE email = $1 AND is_used = FALSE", [email]);
        const result = await this.pool.query("INSERT INTO verification_codes (email, code, expires_at) VALUES ($1, $2, $3) RETURNING *", [email, code, expiresAt]);
        return result.rows[0];
    }

    async getLastVerificationCode(email) {
        const result = await this.pool.query(
            `SELECT * FROM verification_codes 
            WHERE email = $1 AND is_used = FALSE 
            ORDER BY created_at DESC LIMIT 1`,
            [email]
        );
        return result.rows[0];
    }

    //Метод для логики кода
    async verifyCode(email, code) {
        const result = await this.pool.query(
            `SELECT * FROM verification_codes 
             WHERE email = $1 AND code = $2 AND expires_at > NOW() AND is_used = FALSE 
             ORDER BY created_at DESC LIMIT 1`,
            [email, code]
        );

        if (result.rows.length === 0) {
            return false;
        }

        await this.pool.query(
            "UPDATE verification_codes SET is_used = TRUE WHERE id = $1",
            [result.rows[0].id]
        );

        return true;
    }

    //Методы дя того, чтобы пометить код использованным
    async markVerificationCodeAsUsed(codeId) {
        await this.pool.query(
            "UPDATE verification_codes SET is_used = TRUE WHERE id = $1",
            [codeId]
        );
    }

    //Метод для флага, что пользователь верефицирован
    async markEmailAsVerified(userId) {
        const result = await this.pool.query(
            "UPDATE users SET is_verified = TRUE WHERE id = $1 RETURNING *",
            [userId]
        );
        return result.rows[0];
    }


// ---------------------------- МЕТОДЫ ДЛЯ АДМИНА ----------------------------

   //Метод для показа активных пользователей 
    async findAllActive() {
        const result = await this.pool.query("SELECT * FROM users WHERE deleted_at IS NULL");
        return result.rows;
    }

    //Метод для показа всех пользователей, в том числе удаленных
    async findAll() {
        const result = await this.pool.query("SELECT * FROM users");
        return result.rows;
    }

    //Метод для показа суммы всех пользователей по роли
    async countByRole(role_id) {
        const result = await this.pool.query(
            "SELECT COALESCE(COUNT(*), 0) as count FROM users WHERE role_id = $1",
            [role_id]
        );
        return parseInt(result.rows[0].count);
    }

     //Метод для обновления роли пользователя
    async updateRole(id, role_id) {
        const result = await this.pool.query(
            "UPDATE users SET role_id = $1 WHERE id = $2 RETURNING *",
            [role_id, id]
        );
        return result.rows[0];
    }

    async findAllActiveOperators() {
        const result = await this.pool.query(
            `SELECT u.id, u.full_name, u.email,
                    (SELECT COUNT(*) FROM tickets t
                     WHERE t.operator_id = u.id
                     AND t.deleted_at IS NULL
                     AND t.status_id IN (
                         SELECT id FROM statuses WHERE code IN ('new', 'in_progress_operator')
                     )) as active_tickets_count
             FROM users u
             WHERE u.role_id = 2 AND u.deleted_at IS NULL
             ORDER BY active_tickets_count ASC`
        );
        return result.rows;
    }

    // Метод для получения количества активных заявок у оператора
    async getOperatorLoad(operatorId) {
        const result = await this.pool.query(
            `SELECT COUNT(*) as load
             FROM tickets
             WHERE operator_id = $1
             AND deleted_at IS NULL
             AND status_id IN (
                 SELECT id FROM statuses WHERE code IN ('new', 'in_progress_operator')
             )`,
            [operatorId]
        );
        return parseInt(result.rows[0].load);
    }

    async findExpertByCategory(categoryId) {
        const result = await this.pool.query(
            `SELECT u.*, c.name as category_name
            FROM users u
            INNER JOIN categories c ON c.expert_id = u.id
            WHERE c.id = $1 AND u.role_id = 3 AND u.deleted_at IS NULL
            LIMIT 1`,
            [categoryId]
        );
        return result.rows[0];
    }

    async findAllExpertsWithCategories() {
        const result = await this.pool.query(
            `SELECT u.*, 
                    json_agg(json_build_object('id', c.id, 'name', c.name)) as categories
            FROM users u
            INNER JOIN categories c ON c.expert_id = u.id
            WHERE u.role_id = 3 AND u.deleted_at IS NULL
            GROUP BY u.id`
        );
        return result.rows;
}

    async findLeastLoadedOperator() {
        const operators = await this.findAllActiveOperators();
        if (operators.length === 0) return null;

        // Возвращаем оператора с наименьшей загрузкой
        return operators[0];
    }

     // Метод для включения 2FA
    async enable2FA(userId) {
        const result = await this.pool.query(
            "UPDATE users SET two_factor_enabled = TRUE WHERE id = $1 RETURNING *",
            [userId]
        );
        return result.rows[0];
    }

    // Метод для отключения 2FA
    async disable2FA(userId) {
        const result = await this.pool.query(
            "UPDATE users SET two_factor_enabled = FALSE WHERE id = $1 RETURNING *",
            [userId]
        );
        return result.rows[0];
    }

    // Метод для обновления настроек уведомлений
    async updateNotificationSettings(userId, settings) {
        const { email_notifications_enabled, push_notifications_enabled } = settings;
        const result = await this.pool.query(
            `UPDATE users
             SET email_notifications_enabled = COALESCE($1, email_notifications_enabled),
                 push_notifications_enabled = COALESCE($2, push_notifications_enabled)
             WHERE id = $3
             RETURNING *`,
            [email_notifications_enabled, push_notifications_enabled, userId]
        );
        return result.rows[0];
    }

     // Метод для получения настроек пользователя
    async getUserSettings(userId) {
        const result = await this.pool.query(
            `SELECT email_notifications_enabled, push_notifications_enabled, two_factor_enabled
             FROM users WHERE id = $1`,
            [userId]
        );
        return result.rows[0];
    }

}



module.exports = UserRepository; //Выгрузка