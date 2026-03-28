const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authentication');
const { managerAuth, adminMiddleware } = require('../middleware/authorization');
const {
  getManagerDashboardStats,
  getManagerProjects,
  getProjectDetails,
  getProjectEmployees,
  addPerformance,
  updatePerformance,
  getProjectPerformances,
  getEmployeePerformances,
  getManagerSchedule,
  updateSchedule,
  addRemark,
  getEmployeeRemarks,
  getManagerProfile,
  updateManagerProfile
} = require('../controllers/managerModuleController');

const {
  addManager,
  getAllManagers,
  getManagerById,
  updateManager,
  deleteManager,
  getManagerStats
} = require('../controllers/managerController');

const { changePassword } = require('../controllers/managerModuleController');

router.get('/dashboard/stats', authMiddleware, managerAuth, getManagerDashboardStats);

router.get('/projects', authMiddleware, managerAuth, getManagerProjects);
router.get('/projects/:projectId', authMiddleware, managerAuth, getProjectDetails);
router.get('/projects/:projectId/employees', authMiddleware, managerAuth, getProjectEmployees);

router.post('/performances', authMiddleware, managerAuth, addPerformance);
router.put('/performances/:id', authMiddleware, managerAuth, updatePerformance);
router.get('/performances/project/:projectId', authMiddleware, managerAuth, getProjectPerformances);
router.get('/performances/employee/:employeeId', authMiddleware, managerAuth, getEmployeePerformances);

router.get('/schedules', authMiddleware, managerAuth, getManagerSchedule);
router.put('/schedules/:id', authMiddleware, managerAuth, updateSchedule);

router.post('/remarks', authMiddleware, managerAuth, addRemark);
router.get('/remarks/employee/:employeeId', authMiddleware, managerAuth, getEmployeeRemarks);

router.get('/profile', authMiddleware, managerAuth, getManagerProfile);
router.put('/profile', authMiddleware, managerAuth, updateManagerProfile);
router.put('/change-password', authMiddleware, managerAuth, changePassword);

router.post('/', authMiddleware, adminMiddleware, addManager);
router.get('/', authMiddleware, adminMiddleware, getAllManagers);
router.get('/stats', authMiddleware, adminMiddleware, getManagerStats);
router.get('/:id', authMiddleware, adminMiddleware, getManagerById);
router.put('/:id', authMiddleware, adminMiddleware, updateManager);
router.delete('/:id', authMiddleware, adminMiddleware, deleteManager);

module.exports = router;