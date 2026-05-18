const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authentication');
const { managerOrEmployeeAuth } = require('../middleware/authorization');
const {
  getMyFees,
  payFee,
  getFeeHistory
} = require('../controllers/feeController');

router.use(authMiddleware);
router.use(managerOrEmployeeAuth);

router.get('/fees', getMyFees);
router.post('/pay', payFee);
router.get('/history', getFeeHistory);

module.exports = router;