//Сервис для работы с файлами
class AttachmentService {
    constructor(attachmentRepository) {
        this.attachmentRepository = attachmentRepository;
    }

    //Добавление вложения
    async addAttachment(ticketId, fileName, fileUrl, mimeType, fileSize = null, uploadedBy = null) {
        return await this.attachmentRepository.create({
            ticket_id: ticketId,
            filename: fileName,
            filepath: fileUrl, 
            filesize: fileSize,
            uploaded_by: uploadedBy,
            mime_type: mimeType
        });
    }

    //Получить вложения по заявке
    async getAttachmentsByTicket(ticketId) {
        const attachments = await this.attachmentRepository.findByTicket(ticketId);
        // Добавляем полный URL для каждого вложения
        return attachments.map(att => ({
            ...att,
            url: att.filepath  
        }));
    }

    //Удалить вложение
    async deleteAttachment(id) {
        return await this.attachmentRepository.softDelete(id);
    }
}

module.exports = AttachmentService;