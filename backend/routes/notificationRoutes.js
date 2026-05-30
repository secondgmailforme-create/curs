const express = require('express'); //Импорт библиотеки express
const router = express.Router(); //Импорт библиотеки router для маршрутизации

module.exports = (notificationController, authMiddleware) => {
    
    router.use(authMiddleware.authenticate);

    router.get('/', notificationController.getMyNotifications.bind(notificationController)); // GET /api/notifications - мои уведомления

    router.get('/unread', notificationController.getUnread.bind(notificationController));  // GET /api/notifications/unread - непрочитанные

    router.put('/:id/read', notificationController.markAsRead.bind(notificationController)); // PUT /api/notifications/:id/read - прочитать одно

    router.put('/read-all', notificationController.markAllAsRead.bind(notificationController)); // PUT /api/notifications/read-all - прочитать все

    router.get('/settings', notificationController.getSettings.bind(notificationController)); // GET /api/notifications/settings
    router.post('/settings', notificationController.saveSettings.bind(notificationController)); // POST /api/notifications/settings

    return router;
};