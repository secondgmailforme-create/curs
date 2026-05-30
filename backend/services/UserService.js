const bcrypt = require('bcryptjs'); //Импорт библиотеки для паролей
const ROLES = require('../constants/roles'); //Импорт констант ролей

//Сервис для работы админа со статистикой пользователей
class UserService {
    constructor(userRepository, logRepository) {
        this.userRepository = userRepository;
        this.logRepository = logRepository;
    }

// ---------------------------- МЕТОДЫ ДЛЯ АДМИНА -------------------------------

    // Метод для получения списка всех активных пользователей
    async getAllActiveUsers() {
        const users = await this.userRepository.findAllActive();
        return users.map(u => ({
            id: u.id,
            email: u.email,
            full_name: u.full_name, 
            phone: u.phone,
            role_id: u.role_id,
            is_verified: u.is_verified,
            is_active: u.is_active,       
            deleted_at: u.deleted_at        
        }));
    }
    // Метод для блокировки пользователя
    async banUser(adminId, userId) {
        // Проверяем, что админ не блокирует сам себя
        if (adminId == userId) {
            throw new Error('Нельзя заблокировать самого себя');
        }
        
        // Обновляем поле banned, а не deleted_at
        const user = await this.userRepository.update(userId, { is_active: false });
        if (!user) {
            throw new Error('Пользователь не найден');
        }
        
        return user;
    }
    
    // Метода для смены роли
    async changeRole(adminId, userId, newRoleId) {
        await this.userRepository.updateRole(userId, newRoleId);
        await this.logRepository.create({
            user_id: adminId, action: 'Change_role', entity_type: 'user', entity_id: userId
        });
    }

    // Метода для количества пользователей по роли
    async countUsersByRole(roleId) {
        return await this.userRepository.countByRole(roleId);
    }

    // Метода для восстановления пользователя
    async restoreUser(adminId, userId) {
        const user = await this.userRepository.update(userId, { is_active: true});
        if (!user) {
            throw new Error('Пользователь не найден');
        }
        await this.logRepository.create({
            user_id: adminId,
            action: 'restore_user',
            entity_type: 'user',
            entity_id: userId
        });
        
        return user;
    }

    // Метод для обновления настроек уведомлений
    async updateNotificationSettings(userId, settings) {
        return await this.userRepository.updateNotificationSettings(userId, settings);
    }

    // Метод для получения настроек пользователя
    async getUserSettings(userId) {
        const user = await this.userRepository.getUserSettings(userId);
        if (!user) throw new Error('Пользователь не найден');
        return {
            email_notifications_enabled: user.email_notifications_enabled !== false,
            push_notifications_enabled: user.push_notifications_enabled !== false,
            two_factor_enabled: user.two_factor_enabled === true
        };
    }

    // Метод для мягкого удаления пользователя (для AuthController)
    async softDelete(userId) {
        return await this.userRepository.softDelete(userId);
    }
}

module.exports = UserService; //Выгрузка