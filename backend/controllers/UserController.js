// controllers/userController.js
const path = require('path');
const fs = require('fs');

class UserController {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }

    updateProfile = async (req, res) => {
        try {
        
        const userId = req.user.id;  // ← попробуйте также req.user.user_id, req.user.userId
        
            const { full_name, phone } = req.body;
            
            
            if (!full_name || full_name.trim().length < 2) {
                return res.status(400).json({ 
                    error: 'ФИО должно содержать минимум 2 символа' 
                });
            }
            
            const updatedUser = await this.userRepository.updateProfile(userId, {
                full_name: full_name.trim(),
                phone: phone || null
            });
            
            res.json(updatedUser);
            
        } catch (error) {
            console.error('Ошибка updateProfile:', error);
            res.status(500).json({ 
                error: 'Ошибка сервера: ' + error.message 
            });
        }
    };

    getProfile = async (req, res) => {
        try {
            const userId = req.user.id;
            const user = await this.userRepository.findById(userId);
            
            if (!user) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }
            
            res.json({
                id: user.id,
                full_name: user.full_name,
                phone: user.phone,
                email: user.email,
                created_at: user.created_at,
                avatar_url: user.avatar_url
            });
        } catch (error) {
            console.error('Ошибка getProfile:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    };
}

module.exports = UserController;