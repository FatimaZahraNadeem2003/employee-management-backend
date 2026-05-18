const { Project, Manager, User } = require('../models');
const { BadRequestError, NotFoundError } = require('../errors');
const { StatusCodes } = require('http-status-codes');

const resolveManagerId = async (managerIdentifier) => {
  if (!managerIdentifier) return null;
  const isValidObjectId = managerIdentifier.match(/^[0-9a-fA-F]{24}$/);
  if (isValidObjectId) {
    return managerIdentifier;
  } else {
    try {
      const manager = await Manager.findOne({ 
        $or: [
          { employeeId: managerIdentifier },
          { 'userId.email': managerIdentifier }
        ]
      }).lean().maxTimeMS(5000);
      return manager?._id;
    } catch (error) {
      console.error('Error resolving manager ID:', error.message);
      return null;
    }
  }
};

const addProject = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      managerId,
      priority,
      startDate,
      endDate,
      department,
      status,
      budget,
      resources
    } = req.body;

    if (!name || !code || !description || !startDate || !endDate || !department) {
      throw new BadRequestError('Please provide all required fields');
    }

    const existingProject = await Project.findOne({ code }).lean().maxTimeMS(5000);
    if (existingProject) {
      throw new BadRequestError('Project code already exists');
    }

    let resolvedManagerId = null;
    if (managerId) {
      resolvedManagerId = await resolveManagerId(managerId);
      if (!resolvedManagerId) {
        throw new NotFoundError('Manager not found');
      }
    }

    const projectData = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim(),
      priority: priority || 'medium',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      department: department.trim(),
      status: status || 'planning',
      budget: parseInt(budget) || 0,
      resources: resources || []
    };

    if (resolvedManagerId) {
      projectData.managerId = resolvedManagerId;
    }

    const project = await Project.create(projectData);

    const populatedProject = await Project.findById(project._id)
      .populate({
        path: 'managerId',
        populate: {
          path: 'userId',
          select: 'firstName lastName email'
        }
      })
      .lean()
      .maxTimeMS(5000);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Project added successfully',
      data: populatedProject
    });
  } catch (error) {
    console.error('Add project error:', error.message);
    if (error.code === 11000) {
      throw new BadRequestError('Project code already exists');
    }
    throw error;
  }
};

const getAllProjects = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      department, 
      priority, 
      status,
      managerId 
    } = req.query;

    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (priority) query.priority = priority;
    if (department) query.department = { $regex: department, $options: 'i' };

    if (managerId) {
      const resolvedManagerId = await resolveManagerId(managerId);
      if (resolvedManagerId) {
        query.managerId = resolvedManagerId;
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

    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { code: { $regex: search.trim(), $options: 'i' } },
        { department: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 100);

    const projects = await Project.find(query)
      .populate({
        path: 'managerId',
        populate: {
          path: 'userId',
          select: 'firstName lastName email'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()
      .maxTimeMS(5000);

    const Assignment = require('../models/Assignment');
    const projectsWithCounts = await Promise.all(
      projects.map(async (project) => {
        try {
          const assignedCount = await Assignment.countDocuments({ 
            projectId: project._id,
            status: 'active'
          }).maxTimeMS(5000);
          return {
            ...project,
            assignedCount
          };
        } catch (error) {
          console.error('Error counting assignments:', error.message);
          return {
            ...project,
            assignedCount: 0
          };
        }
      })
    );

    const total = await Project.countDocuments(query).maxTimeMS(5000);

    res.status(StatusCodes.OK).json({
      success: true,
      count: projects.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limitNum),
      data: projectsWithCounts
    });
  } catch (error) {
    console.error('Get all projects error:', error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      msg: 'Failed to fetch projects'
    });
  }
};

const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestError('Invalid project ID format');
    }

    const project = await Project.findById(id)
      .populate({
        path: 'managerId',
        populate: {
          path: 'userId',
          select: 'firstName lastName email'
        }
      })
      .lean()
      .maxTimeMS(5000);

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const Assignment = require('../models/Assignment');
    const assignedCount = await Assignment.countDocuments({ 
      projectId: id,
      status: 'active'
    }).maxTimeMS(5000);

    const assignedEmployees = await Assignment.find({ 
      projectId: id,
      status: 'active'
    })
      .populate({
        path: 'employeeId',
        populate: {
          path: 'userId',
          select: 'firstName lastName email'
        }
      })
      .lean()
      .maxTimeMS(5000);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        ...project,
        assignedCount,
        assignedEmployees
      }
    });
  } catch (error) {
    console.error('Get project by id error:', error.message);
    
    if (error.name === 'CastError') {
      throw new BadRequestError('Invalid project ID format');
    }
    
    throw error;
  }
};

const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestError('Invalid project ID format');
    }

    const project = await Project.findById(id).maxTimeMS(5000);
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (updateData.code && updateData.code !== project.code) {
      const existingProject = await Project.findOne({ 
        code: updateData.code.trim().toUpperCase(),
        _id: { $ne: id }
      }).lean().maxTimeMS(5000);
      if (existingProject) {
        throw new BadRequestError('Project code already exists');
      }
    }

    const updateFields = { ...updateData };
    
    if (updateFields.code) {
      updateFields.code = updateFields.code.trim().toUpperCase();
    }
    
    if (updateFields.budget) {
      updateFields.budget = parseInt(updateFields.budget);
    }
    
    if (updateFields.startDate) {
      updateFields.startDate = new Date(updateFields.startDate);
    }
    
    if (updateFields.endDate) {
      updateFields.endDate = new Date(updateFields.endDate);
    }

    if (updateFields.managerId) {
      const resolvedManagerId = await resolveManagerId(updateFields.managerId);
      if (!resolvedManagerId) {
        throw new NotFoundError('Manager not found');
      }
      updateFields.managerId = resolvedManagerId;
    }

    const updatedProject = await Project.findByIdAndUpdate(
      id,
      updateFields,
      { new: true, runValidators: true }
    )
      .populate({
        path: 'managerId',
        populate: {
          path: 'userId',
          select: 'firstName lastName email'
        }
      })
      .lean()
      .maxTimeMS(5000);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Project updated successfully',
      data: updatedProject
    });
  } catch (error) {
    console.error('Update project error:', error.message);
    if (error.code === 11000) {
      throw new BadRequestError('Project code already exists');
    }
    throw error;
  }
};

const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestError('Invalid project ID format');
    }

    const project = await Project.findById(id).maxTimeMS(5000);
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const Assignment = require('../models/Assignment');
    const assignedEmployees = await Assignment.countDocuments({ 
      projectId: id,
      status: { $in: ['active', 'completed'] }
    }).maxTimeMS(5000);

    if (assignedEmployees > 0) {
      throw new BadRequestError('Cannot delete project with assigned employees. Please remove employees first.');
    }

    await Assignment.deleteMany({ projectId: id }).maxTimeMS(5000);

    const Performance = require('../models/Performance');
    await Performance.deleteMany({ projectId: id }).maxTimeMS(5000);

    await Project.findByIdAndDelete(id).maxTimeMS(5000);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Delete project error:', error.message);
    throw error;
  }
};

const assignManager = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { managerId } = req.body;

    if (!projectId || !projectId.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestError('Invalid project ID format');
    }

    if (!managerId) {
      throw new BadRequestError('Manager ID is required');
    }

    const resolvedManagerId = await resolveManagerId(managerId);
    if (!resolvedManagerId) {
      throw new NotFoundError('Manager not found');
    }

    const project = await Project.findById(projectId).maxTimeMS(5000);
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const manager = await Manager.findById(resolvedManagerId)
      .populate({
        path: 'userId',
        select: 'firstName lastName email'
      })
      .lean()
      .maxTimeMS(5000);
    
    if (!manager) {
      throw new NotFoundError('Manager not found');
    }

    project.managerId = resolvedManagerId;
    await project.save();

    const updatedProject = await Project.findById(projectId)
      .populate({
        path: 'managerId',
        populate: {
          path: 'userId',
          select: 'firstName lastName email'
        }
      })
      .lean()
      .maxTimeMS(5000);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Manager assigned to project successfully',
      data: {
        project: updatedProject,
        manager: {
          id: manager._id,
          name: `${manager.userId.firstName} ${manager.userId.lastName}`,
          employeeId: manager.employeeId,
          department: manager.department
        }
      }
    });
  } catch (error) {
    console.error('Assign manager error:', error.message);
    throw error;
  }
};

const getProjectStats = async (req, res) => {
  try {
    const totalProjects = await Project.countDocuments().maxTimeMS(5000);
    const activeProjects = await Project.countDocuments({ status: 'active' }).maxTimeMS(5000);
    const planningProjects = await Project.countDocuments({ status: 'planning' }).maxTimeMS(5000);
    const completedProjects = await Project.countDocuments({ status: 'completed' }).maxTimeMS(5000);

    const byDepartment = await Project.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).maxTimeMS(5000);

    const byPriority = await Project.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).maxTimeMS(5000);

    const Assignment = require('../models/Assignment');
    const topProjects = await Assignment.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$projectId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: {
          from: 'projects',
          localField: '_id',
          foreignField: '_id',
          as: 'project'
        }
      },
      { $unwind: '$project' },
      { $project: {
          'project.name': 1,
          'project.code': 1,
          count: 1
        }
      }
    ]).maxTimeMS(5000);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        total: totalProjects,
        active: activeProjects,
        planning: planningProjects,
        completed: completedProjects,
        byDepartment,
        byPriority,
        topProjects
      }
    });
  } catch (error) {
    console.error('Get project stats error:', error.message);
    throw error;
  }
};

module.exports = {
  addProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
  assignManager,
  getProjectStats
};