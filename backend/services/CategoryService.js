//Сервис для работы с категориями
class CategoryService {
    constructor(categoryRepository) {
        this.categoryRepository = categoryRepository;
    }
// ---------------------------- БАЗОВЫЕ МЕТОДЫ -------------------------------

    //Метод для показа всех категорий
    async getAllCategories() {
        return await this.categoryRepository.findAll();
    }

    //Метод для показа категории по id
    async getCategoryById(id) {
        const category = await this.categoryRepository.findById(id);
        if (!category) {
            throw new Error('Category not found');
        }
        return category;
    }

// ---------------------------- МЕТОДЫ ДЛЯ АДМИНА -------------------------------

    //Метод для создания категории
    async createCategory(name, expertId = null) {
        if (!name || name.trim() === '') {
            throw new Error('Название категории обязательно');
        }
        return await this.categoryRepository.create(name, expertId);
    }

    //Метод для обновления эксперта категории
    async updateCategoryExpert(id, expertId) {
        const category = await this.categoryRepository.findById(id);
        if (!category) {
            throw new Error('Категория не найдена');
        }
        return await this.categoryRepository.updateExpert(id, expertId);
    }

    //Метод для удаления категории 
    async deleteCategory(id) {
        const category = await this.categoryRepository.findById(id);
        if (!category) {
            throw new Error('Категория не найдена');
        }
        return await this.categoryRepository.softDelete(id);
    }

    //Метод для показа всех категорий
    async getAll() {
        return await this.categoryRepository.findAll();
    }
}

module.exports = CategoryService; //Выгрузка