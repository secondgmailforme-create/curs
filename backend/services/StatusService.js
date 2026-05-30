//Сервис по работе с сервисом
class StatusService {
    constructor(statusRepository) {
        this.statusRepository = statusRepository;
    }

    //Метод для создание статуса
    async create(code, name) {
        if (!code || !name) throw new Error('Code and Name are required');
        return await this.statusRepository.create(code, name);
    }

    //Метод для обновления статуса
    async update(id, code, name) {
        const status = await this.statusRepository.findById(id); // Убедись, что findById есть в репо
        if (!status) throw new Error('Status not found');
        return await this.statusRepository.update(id, code, name);
    }

    //Метод для удаления статуса
    async delete(id) {
        return await this.statusRepository.softDelete(id);
    }

    //Метод для получения всех статусов
    async getAll() {
        return await this.statusRepository.findAll();
    }
}

module.exports = StatusService; //Выгрузка