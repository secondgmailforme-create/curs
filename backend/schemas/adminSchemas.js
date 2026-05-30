const Joi = require('joi'); //импорт библиотеки JOI валидации

const createUserSchema = Joi.object({
    email: Joi.string().email().trim().required(), // email обязательный он должен включать @. Входные данные строка, обрезанная от пробелов
    password: Joi.string().min(6).required(), // пароль обязятельный, минимальное количество символов 6.Входные данные строка.
    full_name: Joi.string().trim().min(2).required(), // ФИО обязательно, минимальное количество символов 2. Входные данные строка, обрезанная от пробелов
    phone: Joi.string().trim().allow(null, '').optional(), // Номер телефона не обязательный может быть либо null, либо пустой строкой. Входные данные строка, обрезанная от пробелов
    role_id: Joi.number().integer().min(1).max(4).required() // Роль обязательно,макс количество символов 1-4(можно увеличить). Входные данные целочисленное число.
});

module.exports = { createUserSchema }; //Выгрузка