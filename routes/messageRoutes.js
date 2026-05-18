const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authentication');
const { managerOrEmployeeAuth } = require('../middleware/authorization');
const {
  getMyMessages,
  sendMessage,
  deleteMessage
} = require('../controllers/messageController');

router.use(authMiddleware);
router.use(managerOrEmployeeAuth);

router.get('/messages', getMyMessages);
router.post('/messages', sendMessage);
router.delete('/messages/:id', deleteMessage);

module.exports = router;