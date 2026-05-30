const Joi = require('joi'); //Импорт библиотеки JOI для валидации


const createTicketSchema = Joi.object({
    title: Joi.string().min(3).trim().max(255).required(), //Название обязательное, минимальное количество 3 - максимальное количество 255.Входные данные, строка, обрезанная от пробелов
    description: Joi.string().min(10).required(), //Описание обязательное, минимальное количество 10.Входные данные, строка.
    category_id: Joi.number().integer().positive().optional() //Категория обязательна.Входные данные, число.
});

const transferSchema = Joi.object({
    expert_id: Joi.number().integer().positive().allow(null).required()//ID эксперт обязательн.Входные данные, число.
});

const createCategorySchema = Joi.object({
    name: Joi.string().min(3).max(100).required(), //имя обязательна, минимальное количество символов 3 - максимальное количество 100.Входные данные, строка.
    expert_id: Joi.number().integer().positive().optional() //ID эксперт не обязательн.Входные данные, число.
});

module.exports = { createTicketSchema, transferSchema, createCategorySchema }; //Выгрузка