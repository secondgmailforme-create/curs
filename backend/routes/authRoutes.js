const express = require('express'); //Импорт библиотеки express
const router = express.Router(); //Импорт библиотеки router для маршрутизации

module.exports = (authController, authMiddleware) => {

    // Публичные роуты
    router.post('/register', authController.register.bind(authController)); //регистрация
    router.post('/login', authController.login.bind(authController)); //вход
    router.post('/refresh', authController.refresh.bind(authController)); //для токена
    router.post('/forgot-password', authController.forgotPassword.bind(authController)); //забыл пароль
    router.post('/reset-password', authController.resetPassword.bind(authController)); // поменять пароль(меняет админ)
    router.post('/verify-email', authController.verifyEmail.bind(authController)); //Проверка кода из email
    router.post('/resend-verification', authController.resendVerificationCode.bind(authController));

    // Защищенные роуты (требуют валидный токен)
    router.get('/me', authMiddleware.authenticate, authController.getMe.bind(authController)); // узнать информации о себе
    router.put('/change-password', authMiddleware.authenticate, authController.changePassword.bind(authController)); //поменять пароль
    router.post('/logout', authMiddleware.authenticate, authController.logout.bind(authController)); //выйти
    router.delete('/delete-account', authMiddleware.authenticate, authController.deleteAccount.bind(authController));
    return router;
};