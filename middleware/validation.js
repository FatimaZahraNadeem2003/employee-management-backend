const { body, validationResult } = require('express-validator');
const { BadRequestError } = require('../errors');

const validateProject = [
  body('name').notEmpty().withMessage('Project name is required'),
  body('code').notEmpty().withMessage('Project code is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('startDate').notEmpty().withMessage('Start date is required'),
  body('endDate').notEmpty().withMessage('End date is required'),
  body('department').notEmpty().withMessage('Department is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError(errors.array()[0].msg);
    }
    next();
  }
];

const validateProjectUpdate = [
  body('name').optional().isLength({ min: 3 }),
  body('code').optional().isLength({ min: 2 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError(errors.array()[0].msg);
    }
    next();
  }
];

const validateAssignManager = [
  body('managerId').notEmpty().withMessage('Manager ID is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError(errors.array()[0].msg);
    }
    next();
  }
];

module.exports = {
  validateProject,
  validateProjectUpdate,
  validateAssignManager
};