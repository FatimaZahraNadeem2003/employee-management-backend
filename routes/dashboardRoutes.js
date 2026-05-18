const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authentication');
const { managerOrEmployeeAuth } = require('../middleware/authorization');
const {
  getDashboardStats,
  getRecentActivity,
  getAnnouncements
} = require('../controllers/dashboardController');

router.use(authMiddleware);
router.use(managerOrEmployeeAuth);

router.get('/stats', getDashboardStats);
router.get('/recent-activity', getRecentActivity);
router.get('/announcements', getAnnouncements);

module.exports = router;