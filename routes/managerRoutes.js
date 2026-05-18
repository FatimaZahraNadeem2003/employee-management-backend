const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authentication');
const { managerAuth, adminMiddleware } = require('../middleware/authorization');

// Import controllers
const managerModuleController = require('../controllers/managerModuleController');
const managerController = require('../controllers/managerController');

// Manager module routes
router.get('/dashboard/stats', authMiddleware, managerAuth, managerModuleController.getManagerDashboardStats);

router.get('/projects', authMiddleware, managerAuth, managerModuleController.getManagerProjects);
router.get('/projects/:projectId', authMiddleware, managerAuth, managerModuleController.getProjectDetails);
router.get('/projects/:projectId/employees', authMiddleware, managerAuth, managerModuleController.getProjectEmployees);

router.post('/performances', authMiddleware, managerAuth, managerModuleController.addPerformance);
router.put('/performances/:id', authMiddleware, managerAuth, managerModuleController.updatePerformance);
router.get('/performances/project/:projectId', authMiddleware, managerAuth, managerModuleController.getProjectPerformances);
router.get('/performances/employee/:employeeId', authMiddleware, managerAuth, managerModuleController.getEmployeePerformances);

router.get('/schedules', authMiddleware, managerAuth, managerModuleController.getManagerSchedule);
router.put('/schedules/:id', authMiddleware, managerAuth, managerModuleController.updateSchedule);

router.post('/remarks', authMiddleware, managerAuth, managerModuleController.addRemark);
router.get('/remarks/employee/:employeeId', authMiddleware, managerAuth, managerModuleController.getEmployeeRemarks);

router.get('/profile', authMiddleware, managerAuth, managerModuleController.getManagerProfile);
router.put('/profile', authMiddleware, managerAuth, managerModuleController.updateManagerProfile);
router.put('/change-password', authMiddleware, managerAuth, managerModuleController.changePassword);

// Admin routes for managers (from managerController)
router.post('/', authMiddleware, adminMiddleware, managerController.addManager);
router.get('/', authMiddleware, adminMiddleware, managerController.getAllManagers);
router.get('/stats', authMiddleware, adminMiddleware, managerController.getManagerStats);
router.get('/:id', authMiddleware, adminMiddleware, managerController.getManagerById);
router.put('/:id', authMiddleware, adminMiddleware, managerController.updateManager);
router.delete('/:id', authMiddleware, adminMiddleware, managerController.deleteManager);

module.exports = router;