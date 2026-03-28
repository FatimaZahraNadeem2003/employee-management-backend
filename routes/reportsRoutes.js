const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authentication');
const { adminMiddleware } = require('../middleware/authorization');
const {
  getDashboardStats,
  getEmployeesCount,
  getProjectsCount,
  getTodayMeetings,
  getManagerWorkload
} = require('../controllers/reportsController');

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/dashboard', getDashboardStats);
router.get('/employees-count', getEmployeesCount);
router.get('/projects-count', getProjectsCount);
router.get('/today-meetings', getTodayMeetings);
router.get('/manager-workload', getManagerWorkload);

module.exports = router;