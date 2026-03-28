const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const { BadRequestError, NotFoundError, UnauthenticatedError } = require('../errors');
const { StatusCodes } = require('http-status-codes');


const searchUsers = asyncHandler(async (req, res) => {
  const { searchQuery, excludeCurrentUser = 'true' } = req.query;
  
  if (!searchQuery) {
    throw new BadRequestError('Search query is required');
  }

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
  
  res.status(StatusCodes.OK).json({
    success: true,
    count: users.length,
    data: users
  });
});


const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const user = await User.findById(id).select('-password');
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  let profile = null;
  if (user.role === 'student') {
    profile = await Student.findOne({ userId: user._id });
  } else if (user.role === 'teacher') {
    profile = await Teacher.findOne({ userId: user._id });
  }
  
  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      user,
      profile
    }
  });
});


const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, email } = req.body;
  
  if (req.user.userId !== id && req.user.role !== 'admin') {
    throw new UnauthenticatedError('Not authorized to update this user');
  }
  
  const user = await User.findByIdAndUpdate(
    id,
    { firstName, lastName, email },
    { returnDocument: 'after', runValidators: true }
  ).select('-password');
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  res.status(StatusCodes.OK).json({
    success: true,
    data: user
  });
});


const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const user = await User.findById(id);
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  if (user.role === 'student') {
    await Student.findOneAndDelete({ userId: user._id });
  } else if (user.role === 'teacher') {
    await Teacher.findOneAndDelete({ userId: user._id });
  }
  
  await user.deleteOne();
  
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'User deleted successfully'
  });
});


const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, role } = req.query;
  
  const query = {};
  if (role) {
    query.role = role;
  }
  
  const users = await User.find(query)
    .select('-password')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });
    
  const total = await User.countDocuments(query);
  
  res.status(StatusCodes.OK).json({
    success: true,
    data: users,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    }
  });
});

module.exports = {
  searchUsers,
  getUserById,
  updateUser,
  deleteUser,
  getAllUsers
};