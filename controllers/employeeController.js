const { Employee, User } = require('../models');
const { BadRequestError, NotFoundError } = require('../errors');
const { StatusCodes } = require('http-status-codes');

const addEmployee = async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      password,
      employeeId,
      position,
      department,
      dateOfBirth,
      gender,
      contactNumber,
      address,
      emergencyContact,
      joiningDate,
      status,
      salary
    } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new BadRequestError('Email already in use');
    }

    const existingEmployee = await Employee.findOne({ employeeId });
    if (existingEmployee) {
      throw new BadRequestError('Employee ID already exists');
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password: password || 'employee123',
      role: 'employee'
    });

    const employee = await Employee.create({
      userId: user._id,
      employeeId,
      position,
      department,
      dateOfBirth,
      gender,
      contactNumber,
      address,
      emergencyContact,
      joiningDate: joiningDate || Date.now(),
      status: status || 'active',
      salary: salary || 0
    });

    await employee.populate('userId', '-password');

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Employee added successfully',
      data: employee
    });
  } catch (error) {
    console.error('Add employee error:', error);
    
    if (error.code === 11000) {
      throw new BadRequestError('Employee ID already exists');
    }
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      throw new BadRequestError(messages.join(', '));
    }
    
    throw error;
  }
};

const getAllEmployees = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, department, position, status } = req.query;

    const query = {};
    if (department) query.department = { $regex: department, $options: 'i' };
    if (position) query.position = { $regex: position, $options: 'i' };
    if (status) query.status = status;

    if (search && search.trim() !== '') {
      const users = await User.find({
        role: 'employee',
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id').limit(100).lean();
      
      const userIds = users.map(u => u._id);
      if (userIds.length > 0) {
        query.userId = { $in: userIds };
      } else {
        const employeesByDept = await Employee.find({
          $or: [
            { employeeId: { $regex: search, $options: 'i' } },
            { position: { $regex: search, $options: 'i' } }
          ]
        }).select('_id').limit(100).lean();
        
        if (employeesByDept.length > 0) {
          query._id = { $in: employeesByDept.map(s => s._id) };
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
    
    const employees = await Employee.find(query)
      .populate({
        path: 'userId',
        select: '-password'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Employee.countDocuments(query);

    res.status(StatusCodes.OK).json({
      success: true,
      count: employees.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: employees
    });
  } catch (error) {
    console.error('Get all employees error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      msg: 'Failed to fetch employees'
    });
  }
};

const getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestError('Invalid employee ID format');
    }

    const employee = await Employee.findById(id)
      .populate({
        path: 'userId',
        select: '-password'
      })
      .lean();

    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: employee
    });
  } catch (error) {
    console.error('Get employee by id error:', error);
    
    if (error.name === 'CastError') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        msg: 'Invalid employee ID format'
      });
    }
    
    throw error;
  }
};

const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestError('Invalid employee ID format');
    }

    const employee = await Employee.findById(id);
    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    if (updateData.status === 'terminated' && employee.status !== 'terminated') {
      console.log(`Employee ${employee._id} is being terminated`);
    }

    if (updateData.firstName || updateData.lastName || updateData.email) {
      const userUpdate = {};
      if (updateData.firstName) userUpdate.firstName = updateData.firstName;
      if (updateData.lastName) userUpdate.lastName = updateData.lastName;
      if (updateData.email) userUpdate.email = updateData.email;

      if (Object.keys(userUpdate).length > 0) {
        await User.findByIdAndUpdate(employee.userId, userUpdate, {
          returnDocument: 'after',
          runValidators: true
        });
      }
    }

    const employeeUpdate = { ...updateData };
    delete employeeUpdate.firstName;
    delete employeeUpdate.lastName;
    delete employeeUpdate.email;
    delete employeeUpdate.password;

    const updatedEmployee = await Employee.findByIdAndUpdate(
      id,
      employeeUpdate,
      { returnDocument: 'after', runValidators: true }
    ).populate({
      path: 'userId',
      select: '-password'
    }).lean();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Employee updated successfully',
      data: updatedEmployee
    });
  } catch (error) {
    console.error('Update employee error:', error);
    
    if (error.code === 11000) {
      throw new BadRequestError('Employee ID already exists');
    }
    
    throw error;
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestError('Invalid employee ID format');
    }

    const employee = await Employee.findById(id);
    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    await User.findByIdAndDelete(employee.userId);
    await employee.deleteOne();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Employee deleted successfully'
    });
  } catch (error) {
    console.error('Delete employee error:', error);
    throw error;
  }
};

module.exports = {
  addEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee
};