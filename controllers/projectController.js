const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authentication');
const { adminMiddleware } = require('../middleware/authorization');
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

router.post('/:projectId/assign-manager', assignManager);

router.route('/')
  .post(addProject)
  .get(getAllProjects);

router.route('/:id')
  .get(getProjectById)
  .put(updateProject)
  .delete(deleteProject);

module.exports = router;