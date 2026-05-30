
const BaseController = require('./BaseController');

class SettingsController extends BaseController {
    constructor(authService, userService, emailService) {
        super();
        this.authService = authService;
        this.userService = userService;
        this.emailService = emailService;

        // Хранилище кодов 2FA в памяти (для демо)
        this.twoFACodes = new Map();
    }
    /**
     * DELETE /api/auth/delete-account
     * Удаляет аккаунт пользователя после проверки пароля
     */
    async deleteAccount(req, res) {
        try {
            const userId = req.user.id;
            const { password } = req.body;

            if (!password) {
                return this.validationError(res, ['Пароль обязателен']);
            }

            // Проверка пароля
            const user = await this.authService.getUserById(userId);
            if (!user) {
                return this.error(res, 'Пользователь не найден', 404);
            }

            const bcrypt = require('bcryptjs');
            const isValidPassword = await bcrypt.compare(password, user.password_hash);

            if (!isValidPassword) {
                return this.error(res, 'Неверный пароль', 400);
            }

            // Мягкое удаление пользователя
            await this.userService.softDelete(userId);

            // Очистка куки
            res.clearCookie('accessToken');
            res.clearCookie('refreshToken');

            this.success(res, {
                message: 'Аккаунт успешно удалён'
            });
        } catch (error) {
            console.error('Delete account error:', error);
            this.error(res, error.message || 'Ошибка при удалении аккаунта');
        }
    }
}

module.exports = SettingsController;