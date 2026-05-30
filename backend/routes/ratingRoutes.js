
const express = require('express');
const router = express.Router();
const ROLES = require('../constants/roles');

module.exports = (ratingController, authMiddleware, roleMiddleware) => {
    // Все роуты требуют авторизации
    router.use(authMiddleware.authenticate);

    // Создать оценку заявки (только клиент)
    router.post('/', ratingController.createRating);

    // Получить оценку по заявке
    router.get('/ticket/:ticket_id', ratingController.getRatingByTicket);

    // Получить статистику оператора
    router.get('/operator/stats',
        roleMiddleware.checkRole([ROLES.OPERATOR, ROLES.ADMIN]),
        ratingController.getOperatorStats
    );

    // Получить статистику эксперта
    router.get('/expert/stats',
        roleMiddleware.checkRole([ROLES.EXPERT, ROLES.ADMIN]),
        ratingController.getExpertStats
    );

    // Получить свои оценки (для текущего пользователя)
router.get('/operator/me',
    roleMiddleware.checkRole([ROLES.OPERATOR, ROLES.ADMIN]),
    ratingController.getMyOperatorRatings
);

// Получить оценки конкретного оператора (для админа)
router.get('/operator/:id',
    roleMiddleware.checkRole([ROLES.ADMIN]),
    ratingController.getOperatorRatings
);

// Аналогично для эксперта
router.get('/expert/me',
    roleMiddleware.checkRole([ROLES.EXPERT, ROLES.ADMIN]),
    ratingController.getMyExpertRatings
);

router.get('/expert/:id',
    roleMiddleware.checkRole([ROLES.ADMIN]),
    ratingController.getExpertRatings
);

// Получить статистику для админа
router.get('/admin/stats',
    roleMiddleware.checkRole([ROLES.ADMIN]),
    ratingController.getAdminRatingStats
);

// Получить все оценки (для админа)
router.get('/admin/all',
    roleMiddleware.checkRole([ROLES.ADMIN]),
    ratingController.getAllRatings
);

    return router;
};