//Сервис для работы с уведомлениями
class NotificationService {
    constructor(notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    //Метод для показа уведомления передачи заявки определенным сотрудником
    async notifyAssignment(ticketId, userId, role) {
        const roleNames = {
            operator: 'оператору',
            expert: 'эксперту',
            admin: 'администратору'
        };

        return await this.notificationRepository.create({
            user_id: userId,
            type: 'assignment',
            title: 'Новая заявка',
            message: `Заявка #${ticketId} назначена ${roleNames[role] || 'вам'}`,
            link: `/tickets/${ticketId}`
        });
    }

    //Метод для показа уведомления изменения статуса
    async notifyStatusChange(ticketId, userId, oldStatus, newStatus) {
        return await this.notificationRepository.create({
            user_id: userId,
            type: 'status_change',
            title: 'Статус заявки изменён',
            message: `Заявка #${ticketId}: "${oldStatus}" → "${newStatus}"`,
            link: `/tickets/${ticketId}`
        });
    }

    //Метод для показа уведомления о решение заявки
    async notifyResolved(ticketId, clientId) {
        return await this.notificationRepository.create({
            user_id: clientId,
            type: 'resolved',
            title: 'Заявка решена',
            message: `Ваша заявка #${ticketId} была решена`,
            link: `/tickets/${ticketId}`
        });
    }

    //Метод для показа уведомления об оставленном новом комментарии
    async notifyNewComment(ticketId, userId, authorName) {
        return await this.notificationRepository.create({
            user_id: userId,
            type: 'new_comment',
            title: 'Новый комментарий',
            message: `${authorName} оставил комментарий в заявке #${ticketId}`,
            link: `/tickets/${ticketId}`
        });
    }

    //Метод для показа уведомления
    async getMyNotifications(userId) {
        return await this.notificationRepository.findByUser(userId);
    }

    //Метод для показа не прочитанных уведомления
    async getUnread(userId) {
        return await this.notificationRepository.findUnreadByUser(userId);
    }

    //Метод для просмотра уведомления
    async markAsRead(id) {
        return await this.notificationRepository.markAsRead(id);
    }

    //Метод для просмотра всех уведомлений
    async markAllAsRead(userId) {
        return await this.notificationRepository.markAllAsRead(userId);
    }
}

module.exports = NotificationService; //Выгрузка