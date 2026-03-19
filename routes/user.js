const express = require('express');
const auth = require('../middleware/authentication');
const { searchUsers } = require('../controllers/userController');

const router = express.Router();

router.route('/search').get(auth, searchUsers);

module.exports = router;