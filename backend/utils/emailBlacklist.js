//Файл для проверки email

//Перечень одноразовых gmail
const disposableDomains = [
    'tempmail.com', '10minutemail.com', 'guerrillamail.com',
    'mailinator.com', 'yopmail.com', 'throwawaymail.com'
];

//Проверка, что gmail не одноразовый
function isDisposableEmail(email) {
    const domain = email.split('@')[1].toLowerCase();
    return disposableDomains.includes(domain);
}

module.exports = { isDisposableEmail }; //Выгрузка