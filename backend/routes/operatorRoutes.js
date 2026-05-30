const express = require('express');
const router = express.Router();
const ROLES = require('../constants/roles');

module.exports = (operatorController, authMiddleware, roleMiddleware) => {
    // Все роуты требуют авторизации
    router.use(authMiddleware.authenticate);

    // Проверка что пользователь - оператор
    router.use(roleMiddleware.checkRole([ROLES.OPERATOR]));

    // Получить мои заявки
    router.get('/tickets', operatorController.getMyTickets);

    // Принять заявку в работу
    router.put('/tickets/:id/accept', operatorController.acceptTicket);

    // Передать заявку эксперту
    router.put('/tickets/:id/transfer-expert', operatorController.transferToExpert);
    
    // Отправить сообщение в чат
    router.post('/tickets/:id/message', operatorController.sendOperatorMessage);

    router.post('/tickets/:id/complete', operatorController.completeTicket);

    router.post('/tickets/:id/reopen', operatorController.reopenTicket);

    // Получить историю чата
   router.get('/tickets/:id/chat-history', operatorController.getChatHistory);

    return router;
};