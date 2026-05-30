const bcrypt = require('bcryptjs'); //импортируем библиотеку для шифрования паролей
const jwt = require('jsonwebtoken'); //импортируем библиотеку для паролей
const ROLES = require('../constants/roles'); // импортируем константы ролей
const crypto = require('crypto'); // импортируем библиотеку для паролей
const { isDisposableEmail } = require('../utils/emailBlacklist'); // импортируем проверка email на валидность

//Сервис для авторазации пользователей
class AuthService {
    constructor(userRepository,logRepository,emailService) {
        this.userRepository = userRepository;
        this.logRepository = logRepository;
        this.emailService = emailService;
    }

// ---------------------------- БАЗОВЫЕ МЕТОДЫ (CRUD) -------------------------------

    //Метод для регистрации пользователя
    async register(email, password, full_name, phone = null) {
        if (isDisposableEmail(email)) {
            throw new Error('Используйте постоянный email адрес');
        }
        const existingUser = await this.userRepository.findByEmail(email);
        if (existingUser) {
            // Если пользователь уже подтвержден, регистрироваться заново нельзя
            if (existingUser.is_verified) {
                throw new Error('Пользователь с таким email уже существует и подтвержден');
            }
            
            
            const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
            const codeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 минут

            // Обновляем код и срок действия у существующего неподтвержденного пользователя
            await this.userRepository.saveVerificationCode(existingUser.id, verificationCode, codeExpires);
            
            // Обновляем пароль и имя, если пользователь решил их поменять при повторной попытке
            const hashedPassword = await this._hashPassword(password);
            await this.userRepository.updateUser(existingUser.id, {
                password_hash: hashedPassword,
                full_name: full_name,
                phone: phone
            });

            try {
                await this.emailService.sendVerificationCode(email, verificationCode);
                console.log(`Обновленный код верификации для ${email}: ${verificationCode}`);
            } catch(err) {
                console.error('Ошибка отправки email:', err.message);
            }

            return { 
                newUser: { ...existingUser, password_hash: undefined }, // Возвращаем обновленного пользователя
                token: null 
            };
        }

        const hashedPassword = await this._hashPassword(password);

        // Если EMAIL_USER не задан — авто-подтверждаем (локальный режим без почты)
        const skipVerification = !process.env.EMAIL_USER;

        const newUser = await this.userRepository.createNewUser({
            email,
            phone,
            full_name,
            password_hash: hashedPassword,
            role_id: ROLES.CLIENT,
            is_verified: skipVerification
        });

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const codeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 минут

        await this.userRepository.saveVerificationCode(email, verificationCode, codeExpires);

        try {
            await this.emailService.sendVerificationCode(email, verificationCode);
            console.log(`Код верификации для ${email}: ${verificationCode}`);
        } catch(err) {
            console.error('Ошибка отправки email:', err.message);
        }

        await this.logRepository.create({
            user_id: newUser.id,
            action: 'register',
            entity_type: 'user',
            entity_id: newUser.id
        });

        const token = this.generateToken(newUser);
        return { newUser, token:null };
    }

    //Метод для входа пользователя
    async login(email, password) {
        const user = await this.userRepository.findByEmail(email);
        
        if (!user) {
            throw new Error('Пользователь не найден');
        }
        

        if (user.is_active === false) {
            throw new Error('Ваш аккаунт заблокирован. Обратитесь к администратору.');
        }
        
      
        if (user.deleted_at !== null) {
            throw new Error('Ваш аккаунт удалён. Обратитесь к администратору.');
        }
        
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            throw new Error('Неверный email или пароль');
        }
        
        const token = this.generateToken(user);
        
        return { user, token };
    }

    //Метод для обновления пользователя
    async updateProfile(userId, data) {

        const user = await this.userRepository.findById(userId);
        if (!user || user.deleted_at) {
            throw new Error('User not found');
        }
        const existing = await this.userRepository.findByEmail(data.email);
            if (existing) {
                throw new Error('Email already in use');
            }
            
        const updatedUser = await this.userRepository.update(userId, data);

        await this.logRepository.create({
            user_id: userId,
            action: 'update_profile',
            entity_type: 'user',
            entity_id: userId
        });

        return updatedUser;
    }

    //Метод для создания пользователя если зашел через сторонний сервис
    async createOAuthUser(email, full_name) {
        const tempPassword = crypto.randomBytes(16).toString('hex'); 
        const hashedPassword = await this._hashPassword(tempPassword);
        
        const user = await this.userRepository.createNewUser({
            email,
            full_name,
            password_hash: hashedPassword,
            role_id: ROLES.CLIENT,
            is_verified: true
        });
        
        return user;
    }

    //Метод для поиска пользователя по его роли
    async getUserRole(user_id) {
        const user = await this.userRepository.findById(user_id);
        return user?.role_id;
    }

    //Метод для поиска пользователя по его id
    async getUserById(userId) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        return user;
    }

// ---------------------------- МЕТОДЫ БЕЗОПАСНОСТИ ----------------------------

    //Метод для изменения пароля
    async changePassword(userId, oldPassword, newPassword) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const isValid = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isValid) {
            throw new Error('Invalid current password');
        }

        const hashedPassword = await this._hashPassword(newPassword);

        await this.userRepository.updatePassword(userId, hashedPassword);

        await this.logRepository.create({
            user_id: userId,
            action: 'change_password',
            entity_type: 'user',
            entity_id: userId
        });

        return { message: 'Password changed successfully' };
    }

    //Метод если пользователь забыл пароль
    async forgotPassword(email) {
        const user = await this.userRepository.findByEmail(email);
        if (!user) {
            return { message: 'If your email is registered, you will receive a reset link' };
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // 1 час

        await this.userRepository.savePasswordResetToken(user.id, resetToken, expiresAt);

        await this.emailService.sendResetPasswordEmail(email, resetToken);

        return { message: 'If your email is registered, you will receive a reset link' };
    }

    //Метод для смены пароля
    async resetPassword(token, newPassword) {
        const resetRecord = await this.userRepository.findPasswordResetToken(token);
        if (!resetRecord || new Date(resetRecord.expires_at) < new Date()) {
            throw new Error('Invalid or expired reset token');
        }

        const hashedPassword = await this._hashPassword(newPassword);

        await this.userRepository.updatePassword(resetRecord.user_id, hashedPassword);
        await this.userRepository.deletePasswordResetToken(token);

        await this.logRepository.create({
            user_id: resetRecord.user_id,
            action: 'reset_password',
            entity_type: 'user',
            entity_id: resetRecord.user_id
        });

        return { message: 'Password reset successfully' };
    }

    //Метод для сохранения верификационного кода
    async sendVerificationCode(email) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await this.userRepository.saveVerificationCode(email, code, expiresAt);
        await this.emailService.sendVerificationCode(email, code);

        return { message: "Код отправлен на почту" };
    }

    async resendVerificationCodeByEmail(email) {
        const user = await this.userRepository.findByEmail(email);
        if (!user) throw new Error('Пользователь не найден');
        if (user.is_verified) throw new Error('Email уже подтвержден');

        // Проверяем последний отправленный код
        const lastCode = await this.userRepository.getLastVerificationCode(user.email);
        
        if (lastCode) {
        const now = new Date();
        const lastCodeTime = new Date(lastCode.created_at).getTime();
        const nextAllowedTime = lastCodeTime + 60 * 1000; // 60 секунд
        
        if (now.getTime() < nextAllowedTime) {
            const waitSeconds = Math.ceil((nextAllowedTime - now.getTime()) / 1000);
            
            // Создаем ошибку с дополнительными данными
            const error = new Error(`Пожалуйста, подождите ${waitSeconds} сек.`);
            error.code = 'TOO_MANY_REQUESTS';
            error.waitSeconds = waitSeconds; // Передаем секунды на фронтенд
            throw error;
        }
    }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await this.userRepository.saveVerificationCode(user.email, code, expiresAt);
        await this.emailService.sendVerificationCode(user.email, code);

        console.log(`Код верификации для ${user.email}: ${code}`);

        return { message: 'Код верификации отправлен повторно' };
    }

    //Метод для проверки верификационного кода
    async verifyEmail(userId, code) {
        const user = await this.userRepository.findById(userId);
        if (!user) throw new Error('Пользователь не найден');
        if (user.is_verified) throw new Error('Email уже подтвержден');

        const validCode = await this.userRepository.verifyCode(user.email, code);
        
        if (!validCode) {
            throw new Error('Неверный или истекший код подтверждения');
        }

        await this.userRepository.markVerificationCodeAsUsed(validCode.id);
        
        await this.userRepository.markEmailAsVerified(userId);

        return { message: 'Email успешно подтвержден' };
    }
// ---------------------------- РАБОТА С ТОКЕНАМИ ----------------------------

    //Метод для генерации токена для пользователя
    generateToken(user) {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT_SECRET is not defined');
        }
        return jwt.sign(
            { id: user.id, email: user.email, role_id: user.role_id },
            secret,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );
    }

    //Метод для проверки токена для пользователя
    verifyToken(token) {
        return jwt.verify(token, process.env.JWT_SECRET);
    }

    //Метод для генерации токена
    generateRefreshToken() {
        return crypto.randomBytes(40).toString('hex');
    }

    //Метод для сохранения токена
    async saveRefreshToken(userId, refreshToken) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 дней

        await this.userRepository.saveRefreshToken(userId, refreshToken, expiresAt);
    }

    //Метод для проверка токена
    async verifyRefreshToken(refreshToken) {
        const tokenRecord = await this.userRepository.findRefreshToken(refreshToken);
        if (!tokenRecord || new Date(tokenRecord.expires_at) < new Date()) {
            throw new Error('Invalid or expired refresh token');
        }
        return tokenRecord.user_id;
    }

    //Метод для изменения токена
    async refreshTokens(refreshToken) {
        const userId = await this.verifyRefreshToken(refreshToken);
        const user = await this.userRepository.findById(userId);
        
        const newAccessToken = this.generateToken(user);
        const newRefreshToken = this.generateRefreshToken();
        
        await this.saveRefreshToken(userId, newRefreshToken);
        
        return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    }

    //Метод для удаления токена
    async logout(refreshToken) {
        if (!refreshToken) throw new Error('Refresh token is required');
        
        const tokenRecord = await this.userRepository.findRefreshToken(refreshToken);
        if (tokenRecord) {
            await this.userRepository.deleteRefreshToken(refreshToken);
            
            await this.logRepository.create({
                user_id: tokenRecord.user_id,
                action: 'logout',
                entity_type: 'user',
                entity_id: tokenRecord.user_id
            });
        }
        return { message: 'Logged out successfully' };
    }

// ---------------------------- МЕТОДЫ ДЛЯ АДМИНА -------------------------------

    //Метод для создания пользователя
    async createUser(email, password, full_name, phone, role_id) {
        const existingUser = await this.userRepository.findByEmail(email);
        if (existingUser) {
            throw new Error('User already exists');
        }

        const hashedPassword = await this._hashPassword(password);

        const data = { email, phone, full_name, password_hash: hashedPassword, role_id };
        const newUser = await this.userRepository.createNewUser(data);
        
        await this.logRepository.create({
            user_id: newUser.id,
            action: 'create_user',
            entity_type: 'user',
            entity_id: newUser.id
        });

        return newUser;
    }

// ---------------------------- ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ -------------------------------

    //приватный метод соли
    async _hashPassword(password) {
        return await bcrypt.hash(password, 10);
    }
}

module.exports = AuthService; //Выгрузка