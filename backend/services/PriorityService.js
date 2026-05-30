//Сервис для работы с приоритетом заявки
class PriorityService {

    //Метод для определения цвета заявки
    getColor(createdAt) {
        const created = new Date(createdAt);
        const now = new Date();
        const hours = (now - created) / (1000 * 60 * 60);

        if (hours < 1) return 'green';
        if (hours < 3) return 'yellow';
        return 'red';
    }

    //Метод для автоматически добавления в бд цвет заявки
    enrichTicketsWithColor(tickets) {
        return tickets.map(ticket => ({
            ...ticket,
            priorityColor: this.getColor(ticket.created_at)
        }));
    }
    
    //Метод для расшифрофки цвета заявки
    getPriorityText(color) {
        const texts = {
            green: 'Низкий (ожидание < 1 ч)',
            yellow: 'Средний (ожидание 1-3 ч)',
            red: 'Высокий (ожидание > 3 ч)'
        };
        return texts[color] || 'Неизвестно';
    }
}

module.exports = PriorityService; //Выгрузка