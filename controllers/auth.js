const User = require("../models/User");
const Employee = require("../models/Employee");
const Manager = require("../models/Manager");
const { BadRequestError, UnauthenticatedError } = require("../errors");
const { StatusCodes } = require("http-status-codes");

const register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, role, ...rest } = req.body;
  
    if (!firstName || !lastName || !email || !password) {
      throw new BadRequestError("Please provide all values");
    }
    
    if (firstName.length < 2 || firstName.length > 50) {
      throw new BadRequestError("First name must be between 2 and 50 characters");
    }
    
    if (lastName.length < 2 || lastName.length > 50) {
      throw new BadRequestError("Last name must be between 2 and 50 characters");
    }
    
    const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestError("Please provide a valid email address");
    }
    
    if (email.length > 100) {
      throw new BadRequestError("Email address cannot exceed 100 characters");
    }
    
    if (password.length < 6) {
      throw new BadRequestError("Password must be at least 6 characters long");
    }
    
    const validRoles = ['admin', 'manager', 'employee'];
    if (role && !validRoles.includes(role)) {
      throw new BadRequestError("Invalid role. Must be admin, manager, or employee");
    }
    
    const userAlreadyExists = await User.findOne({ email });
    if (userAlreadyExists) {
      throw new BadRequestError("Email already in use");
    }
  
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: role || 'employee',
    });
  
    if (user.role === 'employee') {
      await Employee.create({
        userId: user._id,
        employeeId: rest.employeeId || `EMP${Date.now()}`,
        position: rest.position || 'Not Assigned',
        department: rest.department || 'Not Assigned',
        contactNumber: rest.contactNumber || '',
        salary: rest.salary || 0
      });
    } else if (user.role === 'manager') {
      await Manager.create({
        userId: user._id,
        employeeId: rest.employeeId || `MGR${Date.now()}`,
        department: rest.department || 'Not Assigned',
        qualification: rest.qualification || 'Not Specified',
        contactNumber: rest.contactNumber || 'Not Provided'
      });
    }
  
    const token = user.createJWT();
  
    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 11000) {
      return res.status(StatusCodes.BAD_REQUEST).json({ 
        success: false,
        msg: 'Email already exists. Please use a different email address.' 
      });
    }
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        msg: messages.join(', ')
      });
    }
    
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;
  
    if (!email || !password) {
      throw new BadRequestError("Please provide email and password");
    }
  
    const user = await User.findOne({ email });
    if (!user) {
      throw new UnauthenticatedError("Invalid Email");
    }
  
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      throw new UnauthenticatedError("Invalid Password");
    }
  
    if (role && user.role !== role) {
      throw new UnauthenticatedError(`You are registered as ${user.role}, not as ${role}`);
    }
  
    let profile = null;
    if (user.role === 'employee') {
      profile = await Employee.findOne({ userId: user._id });
      
      if (profile && profile.status === 'terminated') {
        throw new UnauthenticatedError("Your employment has been terminated. Please contact administration.");
      }
      
      if (profile && profile.status === 'on-leave') {
        throw new UnauthenticatedError("Your account is on leave. Please contact administration.");
      }
      
    } else if (user.role === 'manager') {
      profile = await Manager.findOne({ userId: user._id });
      
      if (profile && (profile.status === 'inactive' || profile.status === 'resigned')) {
        throw new UnauthenticatedError("Your account is not active. Please contact administration.");
      }
    }
  
    const token = user.createJWT();
  
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        profile
      },
      token,
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    
    if (!user) {
      throw new UnauthenticatedError('User not found');
    }
    
    let profile = null;
    if (user.role === 'employee') {
      profile = await Employee.findOne({ userId: user._id });
    } else if (user.role === 'manager') {
      profile = await Manager.findOne({ userId: user._id });
    } else if (user.role === 'admin') {
      const EmployeeModel = require('../models/Employee');
      const ManagerModel = require('../models/Manager');
      const ProjectModel = require('../models/Project');
      
      const employeeCount = await EmployeeModel.countDocuments();
      const managerCount = await ManagerModel.countDocuments();
      const projectCount = await ProjectModel.countDocuments();
      profile = { stats: { employeeCount, managerCount, projectCount } };
    }
    
    res.status(StatusCodes.OK).json({
      success: true,
      user: {
        ...user.toObject(),
        profile
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe
};