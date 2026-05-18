const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authentication');
const { adminMiddleware } = require('../middleware/authorization');
const assignmentController = require('../controllers/assignmentController');

const {
  createAssignment,
  getAllAssignments,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  getEmployeeProjects,
  bulkAssign
} = assignmentController;

router.use(authMiddleware);
router.use(adminMiddleware);

router.post('/bulk', bulkAssign);
router.get('/employee/:employeeId', getEmployeeProjects);

router.route('/')
  .post(createAssignment)
  .get(getAllAssignments);

router.route('/:id')
  .get(getAssignmentById)
  .put(updateAssignment)
  .delete(deleteAssignment);

module.exports = router;