const express = require('express');
const router = express.Router();
const { uploadAvatar, handleMulterError, validateUploadedFile } = require('../middlewares/fileUpload');

module.exports = (userController, authMiddleware) => {
    
    router.use(authMiddleware.authenticate);

    router.get('/', userController.getProfile);
    router.put('/', userController.updateProfile);
    return router;
};