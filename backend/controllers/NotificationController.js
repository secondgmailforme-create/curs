const BaseController = require('./BaseController'); //Импорт Базового класса

//Контролер по работе с уведомлениями
class NotificationController extends BaseController {
    constructor(notificationService,userService) {
        super();
        this.notificationService = notificationService;
         this.userService =  userService;
    }

    //Метод для получения всех уведомлений
    async getMyNotifications(req, res) {
        const userId = req.user.id;
        const notifications = await this.notificationService.getMyNotifications(userId);
        this.success(res, notifications);
    }

    //Метод для получения не прочитанных уведомлений
    async getUnread(req, res) {
        const userId = req.user.id;
        const notifications = await this.notificationService.getUnread(userId);
        this.success(res, notifications);
    }

    //Метод, чтобы прочитать уведомление
    async markAsRead(req, res) {
        const { id } = req.params;
        const notification = await this.notificationService.markAsRead(id);
        this.success(res, notification);
    }

    //Метод, чтобы прочитать все уведомления
    async markAllAsRead(req, res) {
        const userId = req.user.id;
        const notifications = await this.notificationService.markAllAsRead(userId);
        this.success(res, notifications);
    }

     // Метод для получения настроек уведомлений
    async getSettings(req, res) {
        const userId = req.user.id;
        try {
            const settings = await this.userService.getUserSettings(userId);
            this.success(res, settings);
        } catch (error) {
            console.error('Get notification settings error:', error);
            this.error(res, error.message || 'Ошибка получения настроек');
        }
    }

    // Метод для сохранения настроек уведомлений
    async saveSettings(req, res) {
        const userId = req.user.id;
        const { emailNotificationsEnabled, pushNotificationsEnabled } = req.body;
        try {
            await this.userService.updateNotificationSettings(userId, {
                email_notifications_enabled: emailNotificationsEnabled !== false,
                push_notifications_enabled: pushNotificationsEnabled !== false
            });
            this.success(res, { message: 'Настройки уведомлений сохранены' });
        } catch (error) {
            console.error('Save notification settings error:', error);
            this.error(res, error.message || 'Ошибка сохранения настроек');
        }
    }
}

module.exports = NotificationController; //Выгрузка