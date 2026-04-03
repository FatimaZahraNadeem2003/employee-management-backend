const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authentication');
const { employeeAuth, adminMiddleware } = require('../middleware/authorization');
const {
  getEmployeeProfile,
  updateEmployeeProfile,
  getEmployeeProjects,
  getEmployeeProjectDetails,
  getEmployeeSchedule,
  getAllEmployeePerformances,
  getProjectPerformance,
  getEmployeeProgress,
  getAvailableProjects,
  assignToProject,
  changePassword
} = require('../controllers/employeeModuleController');

const {
  addEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee
} = require('../controllers/employeeController');

// Employee module routes
router.get('/profile', authMiddleware, employeeAuth, getEmployeeProfile);
router.put('/profile', authMiddleware, employeeAuth, updateEmployeeProfile);

router.put('/change-password', authMiddleware, employeeAuth, changePassword);

router.get('/projects/available', authMiddleware, employeeAuth, getAvailableProjects);
router.get('/projects', authMiddleware, employeeAuth, getEmployeeProjects);
router.post('/assign', authMiddleware, employeeAuth, assignToProject);

router.get('/schedule', authMiddleware, employeeAuth, getEmployeeSchedule);
router.get('/performances', authMiddleware, employeeAuth, getAllEmployeePerformances);
router.get('/progress', authMiddleware, employeeAuth, getEmployeeProgress);

router.get('/projects/:projectId', authMiddleware, employeeAuth, getEmployeeProjectDetails);
router.get('/performances/project/:projectId', authMiddleware, employeeAuth, getProjectPerformance);

// Admin routes for employees
router.post('/', authMiddleware, adminMiddleware, addEmployee);
router.get('/', authMiddleware, adminMiddleware, getAllEmployees);
router.get('/:id', authMiddleware, adminMiddleware, getEmployeeById);
router.put('/:id', authMiddleware, adminMiddleware, updateEmployee);
router.delete('/:id', authMiddleware, adminMiddleware, deleteEmployee);

module.exports = router;