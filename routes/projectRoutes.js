const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authentication');
const { adminMiddleware } = require('../middleware/authorization');
const {
  validateProject,
  validateAssignManager,
  validateProjectUpdate
} = require('../middleware/validation');
const {
  addProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
  assignManager,
  getProjectStats
} = require('../controllers/projectController');

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/stats', getProjectStats);

router.post('/:projectId/assign-manager', validateAssignManager, assignManager);

router.route('/')
  .post(validateProject, addProject)
  .get(getAllProjects);

router.route('/:id')
  .get(getProjectById)
  .put(validateProjectUpdate, updateProject)
  .delete(deleteProject);

module.exports = router;