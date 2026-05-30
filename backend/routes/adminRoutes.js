const express = require('express'); // Импортируем библиотеку express
const router = express.Router(); // Импортируем библиотеку для маршршрутизации
const ROLES = require('../constants/roles'); // Импортируем константы ролей


module.exports = (adminController, authMiddleware, roleMiddleware) => {
    //Все админские роуты требуют авторизации
    router.use(authMiddleware.authenticate);

    //Проверка роли АДМИНА
    router.use(roleMiddleware.checkRole([ROLES.ADMIN]));

// ---------------------------- СТАТИСТИКА И ДАШБОРД -------------------------------

    router.get('/stats', adminController.getDashboard);
    router.get('/predictions', adminController.getAIPredictions); // Получение прогноза от AI
    router.get('/logs', adminController.getLogs); // Получение логов
    router.get('/ai-data', adminController.getAITrainingData); // Получение списка данных для обучения AI
    router.get('/ai-data/export', adminController.exportTrainingData); 
    router.get('/export-csv', adminController.exportTickets); // Экспортирование заявок
    router.get('/experts-rating', adminController.getExpertsRating); // Получения рейтинга эксперта
    router.get('/escalated-tickets', adminController.getEscalatedTickets); // Получение эскалированных заявок

// ---------------------------- УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ -------------------------------

    router.post('/users', adminController.createUser); // СОЗДАНИЕ
    router.get('/users', adminController.getUsers); // Получение списка
    router.post('/users/:userId/ban', adminController.banUser); // Бан пользователя
    router.post('/users/:userId/restore', adminController.restoreUser); // восстановление пользователя

// ---------------------------- УПРАВЛЕНИЕ СТАТУСАМИ -------------------------------

    router.post('/statuses', adminController.createStatus); // СОЗДАНИЕ
    router.put('/statuses/:id', adminController.updateStatus); // ОБНОВЛЕНИЕ
    router.delete('/statuses/:id', adminController.deleteStatus); // УДАЛЕНИЕ

// ---------------------------- УПРАВЛЕНИЕ КАТЕГОРИЯМИ -------------------------------

    router.get('/categories', adminController.getAll);       // Получение списка
    router.get('/categories/:id', adminController.getById); // Получение по ID
    router.post('/categories', adminController.createCategory);     // Создание
    router.patch('/categories/:id/expert', adminController.reassignCategoryExpert); // Смена эксперта
    router.delete('/categories/:id', adminController.deleteCategory); // Удаление

    
    router.post('/tickets/:id/message', adminController.sendAdminMessage); // Отправить сообщение
    router.post('/tickets/:id/complete', adminController.completeTicket); // Завершить заявку
    router.get('/tickets/:id/ai-response', adminController.generateAIResponse); // AI ответ
    
    return router;
};