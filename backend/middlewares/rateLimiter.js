const rateLimit = require('express-rate-limit');

// Основной лимитер для API
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100, // Максимум 100 запросов с одного IP
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again after 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Лимитер для авторизации (строгий)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 10, // Максимум 10 попыток входа
    message: {
        success: false,
        error: 'Too many login attempts, please try again after 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true // Не считаем успешные запросы
});

// Лимитер для регистрации
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 час
    max: 5, // Максимум 5 регистраций в час
    message: {
        success: false,
        error: 'Too many registration attempts, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Лимитер для создания тикетов
const ticketLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 20, // Максимум 20 тикетов
    message: {
        success: false,
        error: 'Too many tickets created, please slow down'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Лимитер для сообщений в чате
const chatLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 минута
    max: 30, // Максимум 30 сообщений в минуту
    message: {
        success: false,
        error: 'Too many messages, please slow down'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Лимитер для перевода текста
const translateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 минута
    max: 20, // Максимум 20 переводов в минуту
    message: {
        success: false,
        error: 'Too many translation requests, please slow down'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Лимитер для загрузки файлов
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 50, // Максимум 50 загрузок
    message: {
        success: false,
        error: 'Too many file uploads, please slow down'
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = {
    apiLimiter,
    authLimiter,
    registerLimiter,
    ticketLimiter,
    chatLimiter,
    translateLimiter,
    uploadLimiter
};