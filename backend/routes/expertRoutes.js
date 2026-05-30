
const express = require('express');
const router = express.Router();
const ROLES = require('../constants/roles');

module.exports = (expertController, authMiddleware, roleMiddleware) => {
    // Все роуты требуют авторизации
    router.use(authMiddleware.authenticate);

    // Проверка что пользователь - эксперт
    router.use(roleMiddleware.checkRole([ROLES.EXPERT]));

    // Получить мои заявки
    router.get('/tickets', expertController.getMyTickets);

    // Получить заявки из очереди (ожидают эксперта)
router.get('/tickets/queue', expertController.getQueueTickets);

    // Принять заявку в работу
    router.put('/tickets/:id/accept', expertController.acceptTicket);

    // Завершить заявку
    router.post('/tickets/:id/complete', expertController.completeTicket);

    // Вернуть заявку в работу (reopen)
    router.post('/tickets/:id/reopen', expertController.reopenTicket);

    // Отправить заявку админу
     router.post('/tickets/:id/transfer-admin', expertController.escalateToAdmin);

    // Отправить сообщение в чат
    router.post('/tickets/:id/message', expertController.sendExpertMessage);

    // Получить историю чата
    router.get('/tickets/:id/chat-history', expertController.getChatHistory);

    // Сгенерировать ответ от AI
    router.get('/tickets/:id/ai-response', expertController.generateAIResponse);

    return router;
};