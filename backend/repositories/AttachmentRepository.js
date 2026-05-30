//Репозоторий для вложений к заявкам(файлы, фото и т.п)
class AttachmentRepository {
    constructor(pool) {
        this.pool = pool; // проверка подключения бд
    }
    
// ---------------------------- БАЗОВЫЕ МЕТОДЫ (CRUD) -------------------------------

    //Метод для загрузки файлов в Базу данных
    async create(attachmentData) {
        const { ticket_id, filename, filepath, filesize, uploaded_by } = attachmentData;
        const result = await this.pool.query(
            "INSERT INTO attachments (ticket_id, filename, filepath, filesize, uploaded_by) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [ticket_id, filename, filepath, filesize, uploaded_by]
        );
        return result.rows[0];
    }

    //Метод для нахождения файлов по id
    async findById(id) {
        const result = await this.pool.query(
            "SELECT * FROM attachments WHERE id = $1 AND deleted_at IS NULL",
            [id]
        );
        return result.rows[0];
    }

    //Метод для нахождения файлов по заявке
    async findByTicket(ticket_id) {
        const result = await this.pool.query(
            "SELECT * FROM attachments WHERE ticket_id = $1 AND deleted_at IS NULL",
            [ticket_id]
        );
        return result.rows;
    }
    
    //Метод для мягкого удаления, тоесть файлы физически не удаляются, только помечаются
    async softDelete(id) {
        const result = await this.pool.query(
            "UPDATE attachments SET deleted_at = NOW() WHERE id = $1 RETURNING *",
            [id]
        );
        return result.rows[0];
    }
}

module.exports = AttachmentRepository; //Выгрузка