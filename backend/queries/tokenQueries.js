const STATUSES = require('../constants/statuses');// Импорт констант статусов

//SQL запросы по токенам сохранить, найти, удалить
module.exports = {

  FIND_REFRESH_TOKEN: `
    SELECT * FROM user_tokens WHERE refresh_token = $1
  `,

  FIND_PASSWORD_RESET_TOKEN: `
    SELECT * FROM password_resets WHERE token = $1
  `,

  DELETE_PASSWORD_RESET_TOKEN: `
    DELETE FROM password_resets WHERE token = $1
  `
};