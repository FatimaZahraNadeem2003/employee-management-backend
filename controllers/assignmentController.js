const { Assignment, Employee, Project, User } = require('../models');
const { BadRequestError, NotFoundError } = require('../errors');
const { StatusCodes } = require('http-status-codes');

const resolveEmployeeId = async (employeeIdentifier) => {
  if (!employeeIdentifier) return null;
  const isValidObjectId = employeeIdentifier.match(/^[0-9a-fA-F]{24}$/);
  if (isValidObjectId) {
    return employeeIdentifier;
  } else {
    const employee = await Employee.findOne({ 
      $or: [
        { employeeId: employeeIdentifier },
        { 'userId.email': employeeIdentifier }
      ]
    }).populate('userId').lean();
    return employee?._id;
  }
};

const resolveProjectId = async (projectIdentifier) => {
  if (!projectIdentifier) return null;
  const isValidObjectId = projectIdentifier.match(/^[0-9a-fA-F]{24}$/);
  if (isValidObjectId) {
    return projectIdentifier;
  } else {
    const project = await Project.findOne({ 
      $or: [
        { code: projectIdentifier },
        { name: { $regex: projectIdentifier, $options: 'i' } }
      ]
    }).lean();
    return project?._id;
  }
};

const createAssignment = async (req, res) => {
  try {
    const {
      employeeId,
      projectId,
      assignmentDate,
      status,
      role,
      completionPercentage,
      performanceRating,
      remarks
    } = req.body;

    if (!employeeId || !projectId) {
      throw new BadRequestError('Employee ID and Project ID are required');
    }

    const employee = await Employee.findById(employeeId).populate({
      path: 'userId',
      select: 'firstName lastName email'
    }).lean();
    
    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    const project = await Project.findById(projectId).lean();
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const existingAssignment = await Assignment.findOne({
      employeeId,
      projectId,
      status: { $in: ['active', 'completed'] }
    }).lean();

    if (existingAssignment) {
      throw new BadRequestError('Employee is already assigned to this project');
    }

    const assignedCount = await Assignment.countDocuments({
      projectId,
      status: 'active'
    });

    const assignment = await Assignment.create({
      employeeId,
      projectId,
      assignmentDate: assignmentDate || Date.now(),
      status: status || 'active',
      role: role || 'Team Member',
      completionPercentage: completionPercentage || 0,
      performanceRating,
      remarks
    });

    await assignment.populate([
      { 
        path: 'employeeId',
        populate: {
          path: 'userId',
          select: 'firstName lastName email'
        }
      },
      { path: 'projectId', select: 'name code department' }
    ]);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Employee assigned to project successfully',
      data: assignment
    });
  } catch (error) {
    console.error('Create assignment error:', error);
    throw error;
  }
};

const getAllAssignments = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      employeeId,
      projectId,
      status,
      search
    } = req.query;

    const query = {};
    
    if (status) query.status = status;

    if (employeeId) {
      const resolvedEmployeeId = await resolveEmployeeId(employeeId);
      if (resolvedEmployeeId) {
        query.employeeId = resolvedEmployeeId;
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

    if (projectId) {
      const resolvedProjectId = await resolveProjectId(projectId);
      if (resolvedProjectId) {
        query.projectId = resolvedProjectId;
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

    if (search && search.trim() !== '') {
      const searchTerm = search.trim();
      
      const users = await User.find({
        role: 'employee',
        $or: [
          { firstName: { $regex: searchTerm, $options: 'i' } },
          { lastName: { $regex: searchTerm, $options: 'i' } },
          { email: { $regex: searchTerm, $options: 'i' } }
        ]
      }).select('_id').lean();
      
      const userIds = users.map(u => u._id);

      const employees = await Employee.find({
        $or: [
          { userId: { $in: userIds } },
          { employeeId: { $regex: searchTerm, $options: 'i' } },
          { position: { $regex: searchTerm, $options: 'i' } }
        ]
      }).select('_id').lean();
      
      const employeeIds = employees.map(e => e._id);

      const projects = await Project.find({
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { code: { $regex: searchTerm, $options: 'i' } },
          { department: { $regex: searchTerm, $options: 'i' } }
        ]
      }).select('_id').lean();
      
      const projectIds = projects.map(p => p._id);

      query.$or = [];

      if (employeeIds.length > 0) {
        query.$or.push({ employeeId: { $in: employeeIds } });
      }

      if (projectIds.length > 0) {
        query.$or.push({ projectId: { $in: projectIds } });
      }

      if (employeeIds.length === 0 && projectIds.length === 0) {
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

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 100);

    const assignments = await Assignment.find(query)
      .populate([
        { 
          path: 'employeeId',
          populate: {
            path: 'userId',
            select: 'firstName lastName email'
          }
        },
        { path: 'projectId', select: 'name code department priority' }
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await Assignment.countDocuments(query);

    res.status(StatusCodes.OK).json({
      success: true,
      count: assignments.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limitNum),
      data: assignments
    });
  } catch (error) {
    console.error('Get all assignments error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      msg: 'Failed to fetch assignments'
    });
  }
};

const getAssignmentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestError('Invalid assignment ID format');
    }

    const assignment = await Assignment.findById(id)
      .populate([
        { 
          path: 'employeeId',
          populate: {
            path: 'userId',
            select: 'firstName lastName email'
          }
        },
        { 
          path: 'projectId',
          populate: {
            path: 'managerId',
            populate: {
              path: 'userId',
              select: 'firstName lastName'
            }
          }
        }
      ])
      .lean();

    if (!assignment) {
      throw new NotFoundError('Assignment not found');
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: assignment
    });
  } catch (error) {
    console.error('Get assignment by id error:', error);
    throw error;
  }
};

const updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestError('Invalid assignment ID format');
    }

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      throw new NotFoundError('Assignment not found');
    }

    if (updateData.status === 'completed' && assignment.status !== 'completed') {
      updateData.completionDate = Date.now();
    }

    const updatedAssignment = await Assignment.findByIdAndUpdate(
      id,
      updateData,
      { returnDocument: 'after', runValidators: true }
    ).populate([
      { 
        path: 'employeeId',
        populate: {
          path: 'userId',
          select: 'firstName lastName email'
        }
      },
      { path: 'projectId', select: 'name code' }
    ]).lean();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Assignment updated successfully',
      data: updatedAssignment
    });
  } catch (error) {
    console.error('Update assignment error:', error);
    throw error;
  }
};

const deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestError('Invalid assignment ID format');
    }

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      throw new NotFoundError('Assignment not found');
    }

    await Assignment.findByIdAndDelete(id);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Assignment removed successfully'
    });
  } catch (error) {
    console.error('Delete assignment error:', error);
    throw error;
  }
};

const getEmployeeProjects = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { status } = req.query;

    const resolvedEmployeeId = await resolveEmployeeId(employeeId);
    if (!resolvedEmployeeId) {
      throw new NotFoundError('Employee not found');
    }

    const employee = await Employee.findById(resolvedEmployeeId).lean();
    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    const query = { employeeId: resolvedEmployeeId };
    if (status) query.status = status;

    const assignments = await Assignment.find(query)
      .populate([
        { 
          path: 'projectId',
          populate: {
            path: 'managerId',
            populate: {
              path: 'userId',
              select: 'firstName lastName'
            }
          }
        }
      ])
      .sort({ createdAt: -1 })
      .lean();

    const totalProjects = assignments.length;
    const completedProjects = assignments.filter(a => a.status === 'completed').length;
    const activeProjects = assignments.filter(a => a.status === 'active').length;
    
    const avgCompletion = assignments.reduce((acc, a) => acc + (a.completionPercentage || 0), 0) / totalProjects || 0;

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        employee: {
          id: employee._id,
          name: employee.fullName,
          employeeId: employee.employeeId,
          position: employee.position,
          department: employee.department
        },
        statistics: {
          totalProjects,
          completedProjects,
          activeProjects,
          averageCompletion: Math.round(avgCompletion)
        },
        projects: assignments
      }
    });
  } catch (error) {
    console.error('Get employee projects error:', error);
    throw error;
  }
};

const bulkAssign = async (req, res) => {
  try {
    const { projectId, employeeIds } = req.body;

    if (!projectId || !employeeIds || !Array.isArray(employeeIds)) {
      throw new BadRequestError('Project ID and employee IDs array are required');
    }

    const resolvedProjectId = await resolveProjectId(projectId);
    if (!resolvedProjectId) {
      throw new NotFoundError('Project not found');
    }

    const project = await Project.findById(resolvedProjectId).lean();
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const results = {
      successful: [],
      failed: []
    };

    for (const employeeIdentifier of employeeIds) {
      try {
        const resolvedEmployeeId = await resolveEmployeeId(employeeIdentifier);
        if (!resolvedEmployeeId) {
          results.failed.push({
            employeeId: employeeIdentifier,
            reason: 'Employee not found'
          });
          continue;
        }

        const existing = await Assignment.findOne({
          employeeId: resolvedEmployeeId,
          projectId: resolvedProjectId,
          status: { $in: ['active', 'completed'] }
        }).lean();

        if (existing) {
          results.failed.push({
            employeeId: employeeIdentifier,
            reason: 'Already assigned'
          });
          continue;
        }

        const assignment = await Assignment.create({
          employeeId: resolvedEmployeeId,
          projectId: resolvedProjectId,
          status: 'active'
        });

        results.successful.push({
          employeeId: employeeIdentifier,
          assignmentId: assignment._id
        });
      } catch (error) {
        results.failed.push({
          employeeId: employeeIdentifier,
          reason: error.message
        });
      }
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Bulk assignment completed: ${results.successful.length} successful, ${results.failed.length} failed`,
      data: results
    });
  } catch (error) {
    console.error('Bulk assign error:', error);
    throw error;
  }
};

const selfAssign = async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const { projectId } = req.body;

    if (!projectId) {
      throw new BadRequestError('Project ID is required');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (project.status !== 'active') {
      throw new BadRequestError('This project is not available for assignment');
    }

    const existingAssignment = await Assignment.findOne({
      employeeId,
      projectId,
      status: { $in: ['active', 'completed'] }
    });

    if (existingAssignment) {
      throw new BadRequestError('You are already assigned to this project');
    }

    const assignment = await Assignment.create({
      employeeId,
      projectId,
      assignmentDate: Date.now(),
      status: 'active',
      completionPercentage: 0
    });

    await assignment.populate([
      { 
        path: 'employeeId',
        populate: {
          path: 'userId',
          select: 'firstName lastName email'
        }
      },
      { path: 'projectId', select: 'name code department' }
    ]);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Successfully assigned to project',
      data: assignment
    });
  } catch (error) {
    console.error('Self assignment error:', error);
    throw error;
  }
};

const getEmployeeAssignments = async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const { status } = req.query;

    const query = { employeeId };
    if (status) query.status = status;

    const assignments = await Assignment.find(query)
      .populate([
        { path: 'projectId', select: 'name code department priority' },
        { 
          path: 'projectId',
          populate: {
            path: 'managerId',
            populate: {
              path: 'userId',
              select: 'firstName lastName'
            }
          }
        }
      ])
      .sort({ createdAt: -1 })
      .lean();

    const totalProjects = assignments.length;
    const completedProjects = assignments.filter(a => a.status === 'completed').length;
    const activeProjects = assignments.filter(a => a.status === 'active').length;
    
    const avgCompletion = assignments.reduce((acc, a) => acc + (a.completionPercentage || 0), 0) / totalProjects || 0;

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        statistics: {
          totalProjects,
          completedProjects,
          activeProjects,
          averageCompletion: Math.round(avgCompletion)
        },
        assignments
      }
    });
  } catch (error) {
    console.error('Get employee assignments error:', error);
    throw error;
  }
};

module.exports = {
  createAssignment,
  getAllAssignments,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  getEmployeeProjects,
  bulkAssign,
  selfAssign,
  getEmployeeAssignments
};