const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authentication');
const { managerOrEmployeeAuth } = require('../middleware/authorization');
const {
  getNotifications,
  markAsRead,
  clearAll
} = require('../controllers/notificationController');

router.use(authMiddleware);
router.use(managerOrEmployeeAuth);

router.get('/', getNotifications);
router.put('/:id/read', markAsRead);
router.delete('/clear', clearAll);

module.exports = router;