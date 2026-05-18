const { Manager, User } = require('../models');
const { BadRequestError, NotFoundError } = require('../errors');
const { StatusCodes } = require('http-status-codes');

const addManager = async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      password,
      employeeId,
      department,
      qualification,
      experience,
      dateOfBirth,
      gender,
      contactNumber,
      emergencyContact,
      address,
      joiningDate,
      status,
      bio
    } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new BadRequestError('Email already in use');
    }

    const existingManager = await Manager.findOne({ employeeId });
    if (existingManager) {
      throw new BadRequestError('Employee ID already exists');
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password: password || 'manager123',
      role: 'manager'
    });

    const manager = await Manager.create({
      userId: user._id,
      employeeId,
      department,
      qualification,
      experience: experience || 0,
      dateOfBirth,
      gender,
      contactNumber,
      emergencyContact,
      address,
      joiningDate: joiningDate || Date.now(),
      status: status || 'active',
      bio
    });

    await manager.populate('userId', '-password');

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Manager added successfully',
      data: manager
    });
  } catch (error) {
    console.error('Add manager error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      throw new BadRequestError(`${field} already exists`);
    }
    throw error;
  }
};

const getAllManagers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, department, status } = req.query;

    const query = {};
    if (department) query.department = { $regex: department, $options: 'i' };
    if (status) query.status = status;

    let userIds = [];
    if (search) {
      const users = await User.find({
        role: 'manager',
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      userIds = users.map(u => u._id);
      if (userIds.length > 0) {
        query.userId = { $in: userIds };
      } else {
        const managerSearch = await Manager.find({
          $or: [
            { employeeId: { $regex: search, $options: 'i' } },
            { qualification: { $regex: search, $options: 'i' } },
            { department: { $regex: search, $options: 'i' } }
          ]
        }).select('_id');
        
        const managerIds = managerSearch.map(t => t._id);
        if (managerIds.length > 0) {
          query._id = { $in: managerIds };
        } else {
          return res.status(StatusCodes.OK).json({
            success: true,
            count: 0,
            total: 0,
            page: parseInt(page),
            pages: 0,
            data: []
          });
        }
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const managers = await Manager.find(query)
      .populate({
        path: 'userId',
        select: '-password'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Manager.countDocuments(query);

    res.status(StatusCodes.OK).json({
      success: true,
      count: managers.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: managers
    });
  } catch (error) {
    console.error('Get all managers error:', error);
    throw error;
  }
};

const getManagerById = async (req, res) => {
  try {
    const { id } = req.params;

    const manager = await Manager.findById(id)
      .populate({
        path: 'userId',
        select: '-password'
      });

    if (!manager) {
      throw new NotFoundError('Manager not found');
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: manager
    });
  } catch (error) {
    console.error('Get manager by id error:', error);
    throw error;
  }
};

const updateManager = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const manager = await Manager.findById(id);
    if (!manager) {
      throw new NotFoundError('Manager not found');
    }

    if (updateData.employeeId && updateData.employeeId !== manager.employeeId) {
      const existingManager = await Manager.findOne({ 
        employeeId: updateData.employeeId,
        _id: { $ne: id }
      });
      if (existingManager) {
        throw new BadRequestError('Employee ID already exists');
      }
    }

    if (updateData.firstName || updateData.lastName || updateData.email) {
      const userUpdate = {};
      if (updateData.firstName) userUpdate.firstName = updateData.firstName;
      if (updateData.lastName) userUpdate.lastName = updateData.lastName;
      if (updateData.email) {
        const existingUser = await User.findOne({ 
          email: updateData.email,
          _id: { $ne: manager.userId }
        });
        if (existingUser) {
          throw new BadRequestError('Email already in use');
        }
        userUpdate.email = updateData.email;
      }

      if (Object.keys(userUpdate).length > 0) {
        await User.findByIdAndUpdate(manager.userId, userUpdate, {
          returnDocument: 'after',
          runValidators: true
        });
      }
    }

    const managerUpdate = { ...updateData };
    delete managerUpdate.firstName;
    delete managerUpdate.lastName;
    delete managerUpdate.email;
    delete managerUpdate.password;

    const updatedManager = await Manager.findByIdAndUpdate(
      id,
      managerUpdate,
      { returnDocument: 'after', runValidators: true }
    ).populate({
      path: 'userId',
      select: '-password'
    }).lean();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Manager updated successfully',
      data: updatedManager
    });
  } catch (error) {
    console.error('Update manager error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      throw new BadRequestError(`${field} already exists`);
    }
    throw error;
  }
};

const deleteManager = async (req, res) => {
  try {
    const { id } = req.params;

    const manager = await Manager.findById(id);
    if (!manager) {
      throw new NotFoundError('Manager not found');
    }

    const Project = require('../models/Project');
    const assignedProjects = await Project.find({ managerId: id });
    if (assignedProjects.length > 0) {
      throw new BadRequestError('Cannot delete manager with assigned projects. Please reassign projects first.');
    }

    await User.findByIdAndDelete(manager.userId);
    await manager.deleteOne();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Manager deleted successfully'
    });
  } catch (error) {
    console.error('Delete manager error:', error);
    throw error;
  }
};

const getManagerStats = async (req, res) => {
  try {
    const totalManagers = await Manager.countDocuments();
    const activeManagers = await Manager.countDocuments({ status: 'active' });
    const onLeaveManagers = await Manager.countDocuments({ status: 'on-leave' });
    
    const departmentStats = await Manager.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        total: totalManagers,
        active: activeManagers,
        onLeave: onLeaveManagers,
        byDepartment: departmentStats
      }
    });
  } catch (error) {
    console.error('Get manager stats error:', error);
    throw error;
  }
};

module.exports = {
  addManager,
  getAllManagers,
  getManagerById,
  updateManager,
  deleteManager,
  getManagerStats
};