const asyncHandler = require('express-async-handler');
const User = require('../models/User');

const searchUsers = asyncHandler(async (req, res) => {
  const { searchQuery, excludeCurrentUser = 'true' } = req.query;
  
  if (!searchQuery) {
    return res.status(400).json({ message: 'Search query is required' });
  }

  try {
    let query = {};
    
    if (excludeCurrentUser === 'true' || excludeCurrentUser === true) {
      query._id = { $ne: req.user.userId };
    }
    
    query.$or = [
      { firstName: { $regex: searchQuery, $options: 'i' } },
      { lastName: { $regex: searchQuery, $options: 'i' } },
      { email: { $regex: searchQuery, $options: 'i' } },
      { $expr: { $regexMatch: { input: { $concat: ["$firstName", " ", "$lastName"] }, regex: searchQuery, options: 'i' } } }
    ];

    if (req.user.role === 'student') {
      query.role = 'teacher';
    } else if (req.user.role === 'teacher') {
      query.role = 'student';
    } else {
      query.role = { $in: ['student', 'teacher'] };
    }

    const users = await User.find(query).select('-password');
    res.json(users);
  } catch (error) {
    console.error('Error in searchUsers:', error);
    res.status(500).json({ message: 'Server error during user search', error: error.message });
  }
});

module.exports = {
  searchUsers
};