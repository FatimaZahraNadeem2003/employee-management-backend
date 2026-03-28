const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authentication');
const { adminMiddleware } = require('../middleware/authorization');
const {
  createSchedule,
  getAllSchedules,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
  getWeeklySchedule
} = require('../controllers/scheduleController');

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/weekly', getWeeklySchedule);
router.route('/')
  .post(createSchedule)
  .get(getAllSchedules);
router.route('/:id')
  .get(getScheduleById)
  .put(updateSchedule)
  .delete(deleteSchedule);

module.exports = router;