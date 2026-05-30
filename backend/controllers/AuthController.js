const BaseController = require('./BaseController'); //Импорт Базового класса
const { registerSchema, loginSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } = require('../schemas/authSchemas');  //Импорт схемы валидации joi
const COOKIE_OPTIONS = require('../constants/cookie'); //Импорт констант куки

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

//Контроллер для входа, для регистрации пользователя и иных действий
class AuthController extends BaseController {
    constructor(authService,userService,emailService) {
        super();
        this.authService = authService;
        this.userService = userService;
        this.emailService = emailService;

        // Хранилище кодов 2FA
        this.twoFACodes = new Map();
    }

    //Приватный метод для куки
    _setAuthCookie(res, token) {
        res.cookie('accessToken', token, COOKIE_OPTIONS);
    }

// ---------------------------- ВХОД, РЕГИСТРАЦИЯ И ВЫХОД -------------------------------
    
    //Метод для регистрации пользователя
    async register(req, res) {
        const { error } = registerSchema.validate(req.body);
        if (error) {
            return this.validationError(res, error.details.map(el => el.message));
        }

        const { email, password, full_name, phone } = req.body;
        const result = await this.authService.register(email, password, full_name, phone);
        
        this._setAuthCookie(res, result.token);
        this.success(res, {
            user: {
                id: result.newUser.id,
                email: result.newUser.email,
                full_name: result.newUser.full_name,
                role_id: result.newUser.role_id,
                is_verified: false
            },
            message: 'Регистрация успешна. Пожалуйста, подтвердите ваш email.'
        }, 201);
    }

    //Метод для входа пользователя
    async login(req, res) {
        const { error } = loginSchema.validate(req.body);
        if (error) {
            return this.validationError(res, error.details.map(el => el.message));
        }

        const { email, password } = req.body;
        const result = await this.authService.login(email, password);

        this._setAuthCookie(res, result.token);
        this.success(res, {
            user: {
                id: result.user.id,
                email: result.user.email,
                full_name: result.user.full_name,
                role_id: result.user.role_id
            }
        });
    }

    //Метод для выхода пользователя
    async logout(req, res) {
        const refreshToken = req.cookies?.refreshToken; 
        
        if (refreshToken) {
            try {
                await this.authService.logout(refreshToken); 
            } catch (e) {
                console.error('Logout DB error:', e.message);
            }
        }

        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        this.success(res, { message: 'Logged out successfully' });
    }
// ---------------------------- ПАРОЛИ И ТОКЕНЫ -------------------------------

    //Методы для токенов
    async refresh(req, res) {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return this.validationError(res, ['Refresh token is required']);
        }
        
        const result = await this.authService.refreshTokens(refreshToken);

        this._setAuthCookie(res, result.accessToken);

        this.success(res, { 
            refreshToken: result.refreshToken,
            accessToken: result.accessToken
        });
    }

    //Методы для изменения пароля 
    async changePassword(req, res) {
        const { error } = changePasswordSchema.validate(req.body);
        if (error) {
            return this.validationError(res, error.details.map(el => el.message));
        }

        const { oldPassword, newPassword } = req.body;
        const userId = req.user.id;

        const result = await this.authService.changePassword(userId, oldPassword, newPassword);
        this.success(res, result);
    }

    //Методы если забыли пароль
    async forgotPassword(req, res) {
        const { error } = forgotPasswordSchema.validate(req.body);
        if (error) {
            return this.validationError(res, error.details.map(el => el.message));
        }

        const { email } = req.body;
        const result = await this.authService.forgotPassword(email);
        this.success(res, result);
    }

    //Метод для восстановления пароля
    async resetPassword(req, res) {
        const { error } = resetPasswordSchema.validate(req.body);
        if (error) {
            return this.validationError(res, error.details.map(el => el.message));
        }

        const { token, newPassword } = req.body;
        const result = await this.authService.resetPassword(token, newPassword);
        this.success(res, result);
    }

    //Метод для проверки email
    async verifyEmail(req, res) {
        const { code, email } = req.body;
        
        if (!code || !email) {
            return this.validationError(res, ['Код и email обязательны']);
        }

        try {
            // Находим пользователя по email
            const user = await this.authService.userRepository.findByEmail(email);
            if (!user) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }

            // Проверяем код через сервис
            await this.authService.verifyEmail(user.id, code);
            
            // Генерируем токен ТОЛЬКО после успешного подтверждения
            const token = this.authService.generateToken(user);
            
            // Устанавливаем куки с токеном
            this._setAuthCookie(res, token);
            
            this.success(res, {
                message: 'Email успешно подтвержден',
                user: {
                    id: user.id,
                    email: user.email,
                    full_name: user.full_name,
                    role_id: user.role_id,
                    is_verified: true
                },
                redirect: '/login' // Перенаправляем на страницу входа
            });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    //Метод для повторной отправки кода верификации
    async resendVerificationCode(req, res) {
        const { email } = req.body;
        
        if (!email) {
            return this.validationError(res, ['Email обязателен']);
        }
        
        try {
            const result = await this.authService.resendVerificationCodeByEmail(email);
            this.success(res, result);
        } catch (error) {
        // Если это ошибка таймера, передаем секунды ожидания
        if (error.code === 'TOO_MANY_REQUESTS') {
            return res.status(429).json({ 
                error: error.message,
                waitSeconds: error.waitSeconds 
            });
        }
        res.status(400).json({ error: error.message });
    }
}

// ---------------------------- ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ-------------------------------

    //Получение информации о пользователе
    async getMe(req, res) {
        const user = req.user;
        if (!user) {
            return this.forbidden(res, 'Unauthorized');
        }

        const fullUser = await this.authService.getUserById(user.id);
        
        this.success(res, {
            user: {
                id: fullUser.id,
                email: fullUser.email,
                full_name: fullUser.full_name,
                role_id: fullUser.role_id
            }
        });
    }


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

module.exports = AuthController; //Выгрузка