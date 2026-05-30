const express = require('express'); //Импорт библиотеки express
const router = express.Router(); //Импорт библиотеки router для маршрутизации
const ROLES = require('../constants/roles'); //Импорт константы ролей
const { upload, handleMulterError, validateUploadedFile } = require('../middlewares/fileUpload'); 
module.exports = (ticketController, authMiddleware, roleMiddleware) => {

    // Все тикет-роуты требуют авторизации
    router.use(authMiddleware.authenticate);

// ---------------------------- ОСНОВНЫЕ ДЕЙСТВИЯ -------------------------------

    router.post('/', ticketController.create); //Создание
    router.get('/', ticketController.getAll); // Список тикетов по роли
    router.get('/my', ticketController.getMyTickets); // Личные тикеты клиента
    router.get('/:id', ticketController.getById); // Список тикетов по id

// ---------------------------- СТАТИСТИКА КЛИЕНТА -------------------------------

    router.get('/stats/weekly', ticketController.getClientWeeklyStats); // Статистика за 2 недели

// ---------------------------- ДЕЙСТВИЯ С ТИКЕТОМ  -------------------------------

    router.put('/:id/assign-operator', roleMiddleware.checkRole([ROLES.OPERATOR]), ticketController.assignOperator); // оператор
    router.put('/:id/transfer', roleMiddleware.checkRole([ROLES.OPERATOR]), ticketController.transferToExpert); // передача эксперту
    router.put('/:id/assign-expert', roleMiddleware.checkRole([ROLES.EXPERT]), ticketController.assignExpert); // эксперт
    router.put('/:id/resolve', roleMiddleware.checkRole([ROLES.EXPERT]), ticketController.resolve); // решенно
    router.put('/:id/reopen', ticketController.reopen);
    router.put('/:id/escalate', roleMiddleware.checkRole([ROLES.EXPERT]), ticketController.escalate); // отправка админу

// ------------------------------------- AI ----------------------------------------

    router.post('/:id/generate-ai', ticketController.generateAIResponse); // ai

// ---------------------------- КОММЕНТАРИИ -------------------------------

    router.get('/:id/comments', ticketController.getComments); // получить комменты
    router.post('/:id/comments', ticketController.addComment); // добавить комменты

// ---------------------------- ИСТОРИЯ ЗАЯВКИ -------------------------------
   
router.get('/:id/messages', ticketController.getMessages);
router.get('/:id/history', ticketController.getHistory); // получить историю изменений
 router.post(
        '/:id/attachments',
        upload.single('file'),
        handleMulterError,
        validateUploadedFile,
        ticketController.uploadAttachment
    );
    router.get('/:id/attachments', ticketController.getAttachments); // получение файлов

    return router;
};