//Сервис для работы с webservicem
class WebSocketService {
    constructor(io) {
        this.io = io;
    }
    //Метод для отправки сообщения о изменения приоритета и изменения цвета на другой цвет
    notifyPriorityUpdate(ticketId, newColor) {
        this.io.emit('priority-update', { ticketId, newColor });
    }

    //Метод для отправки сообщения о создание заявки и зменения цвета на цвет для - "новая"
    notifyTicketCreated(ticketId, assignedTo) {
       if (assignedTo) {
            this.io.to(`user_${assignedTo}`).emit('new-ticket', { ticketId });
        } else {
            this.io.emit('new-ticket-queue', { ticketId });
        }
    }

    //Метод для отправки сообщения о изменение статуса заявки и изменения цвета на соответсвующий 
    notifyStatusChange(ticketId, userId, newStatus) {
       if (userId) {
           this.io.to(`user_${userId}`).emit('status-change', { ticketId, newStatus });
       } else {
           this.io.emit('status-change', { ticketId, newStatus });
       }
    }

    notifyNewMessage(ticketId, recipientUserId, messageData) {
        if (recipientUserId) {
            this.io.to(`user_${recipientUserId}`).emit('new-message-notification', {
                ticketId,
                ...messageData
            });
        }
    }

    notifyTicketColorUpdate(ticketId, color, reason) {
        this.io.emit('ticket-color-update', { ticketId, color, reason });
    }
}

module.exports = WebSocketService; //Выгрузка