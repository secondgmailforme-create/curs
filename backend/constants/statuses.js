//Константы для статусов заявок
const STATUSES = {
    NEW: 'new',                              // id 1
    IN_PROGRESS_OPERATOR: 'in_progress_operator', // id 2
    WAITING_FOR_OPERATOR: 'waiting_for_operator', // id 3
    WAITING_FOR_EXPERT: 'waiting_for_expert',   // id 4
    IN_PROGRESS_EXPERT: 'in_progress_expert',// id 5
    ESCALATED: 'escalated' ,   // id 6  
    RESOLVED: 'resolved',   // id 7                 
    CANCELED: 'canceled',   // id 8                 
    
                    
};
module.exports = STATUSES; //Выгрузка