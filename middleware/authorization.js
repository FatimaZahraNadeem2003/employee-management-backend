const { UnauthenticatedError, UnauthorizedError } = require("../errors");
const { Manager, Employee } = require('../models');

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new UnauthenticatedError("Authentication required");
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new UnauthorizedError(
        `Access denied. Required roles: ${allowedRoles.join(', ')}. Your role: ${req.user.role}`
      );
    }
    
    next();
  };
};

const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    throw new UnauthenticatedError("Authentication required");
  }

  if (req.user.role !== 'admin') {
    throw new UnauthorizedError("Access denied. Admin access required");
  }
  
  next();
};

const managerMiddleware = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new UnauthenticatedError("Authentication required");
    }

    if (!['admin', 'manager'].includes(req.user.role)) {
      throw new UnauthorizedError("Access denied. Manager access required");
    }

    if (req.user.role === 'manager') {
      const manager = await Manager.findOne({ userId: req.user.userId });
      if (!manager) {
        throw new UnauthorizedError("Manager profile not found");
      }
      req.user.managerId = manager._id.toString();
      req.user.manager = manager;
    }

    if (req.user.role === 'admin' && (req.query.managerId || req.body.managerId)) {
      req.user.managerId = req.query.managerId || req.body.managerId;
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

const employeeMiddleware = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new UnauthenticatedError("Authentication required");
    }

    if (!['admin', 'employee'].includes(req.user.role)) {
      throw new UnauthorizedError("Access denied. Employee access required");
    }

    if (req.user.role === 'employee') {
      const employee = await Employee.findOne({ userId: req.user.userId });
      if (!employee) {
        throw new UnauthorizedError("Employee profile not found");
      }
      req.user.employeeId = employee._id.toString();
      req.user.employee = employee;
    }

    if (req.user.role === 'admin' && (req.query.employeeId || req.body.employeeId)) {
      req.user.employeeId = req.query.employeeId || req.body.employeeId;
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

const managerAuth = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new UnauthenticatedError("Authentication required");
    }

    if (req.user.role === 'admin') {
      if (req.query.managerId || req.body.managerId) {
        req.user.managerId = req.query.managerId || req.body.managerId;
      }
      return next();
    }

    if (req.user.role === 'manager') {
      const manager = await Manager.findOne({ userId: req.user.userId });
      if (!manager) {
        throw new UnauthorizedError("Manager profile not found");
      }
      req.user.managerId = manager._id.toString();
      req.user.manager = manager;
      return next();
    }

    throw new UnauthorizedError("Access denied. Manager access required");
  } catch (error) {
    next(error);
  }
};

const employeeAuth = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new UnauthenticatedError("Authentication required");
    }

    if (req.user.role === 'admin') {
      if (req.query.employeeId || req.body.employeeId) {
        req.user.employeeId = req.query.employeeId || req.body.employeeId;
      }
      return next();
    }

    if (req.user.role === 'employee') {
      const employee = await Employee.findOne({ userId: req.user.userId });
      if (!employee) {
        throw new UnauthorizedError("Employee profile not found");
      }
      req.user.employeeId = employee._id.toString();
      req.user.employee = employee;
      return next();
    }

    throw new UnauthorizedError("Access denied. Employee access required");
  } catch (error) {
    next(error);
  }
};

const managerOrEmployeeAuth = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new UnauthenticatedError("Authentication required");
    }

    if (req.user.role === 'admin') {
      if (req.query.managerId || req.body.managerId) {
        req.user.managerId = req.query.managerId || req.body.managerId;
      }
      if (req.query.employeeId || req.body.employeeId) {
        req.user.employeeId = req.query.employeeId || req.body.employeeId;
      }
      return next();
    }

    if (req.user.role === 'manager') {
      const manager = await Manager.findOne({ userId: req.user.userId });
      if (!manager) {
        throw new UnauthorizedError("Manager profile not found");
      }
      req.user.managerId = manager._id.toString();
      req.user.manager = manager;
      return next();
    }

    if (req.user.role === 'employee') {
      const employee = await Employee.findOne({ userId: req.user.userId });
      if (!employee) {
        throw new UnauthorizedError("Employee profile not found");
      }
      req.user.employeeId = employee._id.toString();
      req.user.employee = employee;
      return next();
    }

    throw new UnauthorizedError("Access denied");
  } catch (error) {
    next(error);
  }
};

const managerCanViewEmployees = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new UnauthenticatedError("Authentication required");
    }

    if (req.user.role === 'admin') {
      return next();
    }

    if (req.user.role === 'manager') {
      if (req.method === 'GET') {
        const manager = await Manager.findOne({ userId: req.user.userId });
        if (!manager) {
          throw new UnauthorizedError("Manager profile not found");
        }
        req.user.managerId = manager._id.toString();
        return next();
      } else {
        throw new UnauthorizedError("Managers can only view employees, not modify them");
      }
    }

    throw new UnauthorizedError("Access denied");
  } catch (error) {
    next(error);
  }
};

const authorizeOwnerOrAdmin = (getResourceOwnerId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthenticatedError("Authentication required");
      }

      if (req.user.role === 'admin') {
        return next();
      }

      const ownerId = await getResourceOwnerId(req);
      
      if (req.user.role === 'manager' && req.user.managerId) {
        if (req.user.managerId !== ownerId.toString()) {
          throw new UnauthorizedError("Access denied. You don't own this resource");
        }
      } else if (req.user.role === 'employee' && req.user.employeeId) {
        if (req.user.employeeId !== ownerId.toString()) {
          throw new UnauthorizedError("Access denied. You don't own this resource");
        }
      } else if (req.user.userId !== ownerId.toString()) {
        throw new UnauthorizedError("Access denied. You don't own this resource");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  authorize,
  adminMiddleware,
  managerMiddleware,
  employeeMiddleware,
  managerAuth,
  employeeAuth,
  managerOrEmployeeAuth,
  managerCanViewEmployees,
  authorizeOwnerOrAdmin
};