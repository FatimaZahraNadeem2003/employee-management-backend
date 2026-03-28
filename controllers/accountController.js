const { User, Teacher, Student } = require('../models');
const { BadRequestError, NotFoundError } = require('../errors');
const { StatusCodes } = require('http-status-codes');
const bcrypt = require('bcryptjs');

const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).select('-password');

    if (!user) {
      throw new NotFoundError('User not found');
    }

    let profile = null;
    if (user.role === 'teacher') {
      profile = await Teacher.findOne({ userId: user._id });
    } else if (user.role === 'student') {
      profile = await Student.findOne({ userId: user._id });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        user,
        profile
      }
    });
  } catch (error) {
    console.error('Get my profile error:', error);
    throw error;
  }
};

const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const updateData = req.body;

    const allowedUpdates = {
      firstName: updateData.firstName,
      lastName: updateData.lastName,
    };

    Object.keys(allowedUpdates).forEach(key => 
      allowedUpdates[key] === undefined && delete allowedUpdates[key]
    );

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      allowedUpdates,
      { returnDocument: 'after', runValidators: true }
    ).select('-password');

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update my profile error:', error);
    throw error;
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isPasswordCorrect = await user.comparePassword(currentPassword);
    if (!isPasswordCorrect) {
      throw new BadRequestError('Current password is incorrect');
    }

    user.password = newPassword;
    await user.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    throw error;
  }
};

const getMyNotifications = async (req, res) => {
  try {
    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        notifications: [],
        unreadCount: 0
      }
    });
  } catch (error) {
    console.error('Get my notifications error:', error);
    throw error;
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  changePassword,
  getMyNotifications
};