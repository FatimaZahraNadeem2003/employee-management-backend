const User = require("../models/User");
const { BadRequestError, UnauthenticatedError } = require("../errors");
const { StatusCodes } = require("http-status-codes");


const register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;
  
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
    
    const validRoles = ['admin', 'teacher', 'student'];
    if (role && !validRoles.includes(role)) {
      throw new BadRequestError("Invalid role. Must be admin, teacher, or student");
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
      role, 
    });
  
    const token = user.createJWT();
  
    res.status(StatusCodes.CREATED).json({
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(StatusCodes.BAD_REQUEST).json({ msg: 'Email already exists. Please use a different email address.' });
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
      throw new UnauthenticatedError("Wrong credentials");
    }
  
    const token = user.createJWT();
  
    res.status(StatusCodes.OK).json({
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
};