const { Project, Manager, User, Employee, Assignment, Performance, Schedule, Remark } = require('../models');
const { BadRequestError, NotFoundError, UnauthorizedError } = require('../errors');
const { StatusCodes } = require('http-status-codes');
const mongoose = require('mongoose');

const getManagerDashboardStats = async (req, res) => {
  try {
    const managerId = req.user.managerId;

    const projects = await Project.find({ managerId, status: { $ne: 'completed' } }).lean();
    
    let totalEmployees = 0;
    for (const project of projects) {
      const count = await Assignment.countDocuments({
        projectId: project._id,
        status: 'active'
      });
      totalEmployees += count;
    }

    const today = new Date();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayDay = days[today.getDay()];
    
    const todayMeetings = await Schedule.countDocuments({
      managerId,
      dayOfWeek: todayDay,
      status: 'scheduled'
    });

    const pendingReviews = await Performance.countDocuments({
      reviewerId: managerId,
      $or: [
        { rating: { $in: [null, 'Not Reviewed'] } },
        { rating: { $exists: false } }
      ]
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        totalProjects: projects.length,
        totalEmployees,
        todayMeetings,
        pendingReviews
      }
    });
  } catch (error) {
    console.error('Get manager dashboard stats error:', error);
    throw error;
  }
};

const getManagerProjects = async (req, res) => {
  try {
    const managerId = req.user.managerId;

    const projects = await Project.find({ 
      managerId,
      status: { $ne: 'completed' }
    })
    .select('name code description department priority status startDate endDate budget')
    .sort({ createdAt: -1 })
    .lean();

    const projectsWithStats = await Promise.all(
      projects.map(async (project) => {
        const assignedCount = await Assignment.countDocuments({
          projectId: project._id,
          status: 'active'
        });

        const schedule = await Schedule.find({
          projectId: project._id,
          status: 'scheduled'
        }).select('dayOfWeek startTime endTime location meetingType').lean();

        return {
          ...project,
          assignedCount,
          schedule
        };
      })
    );

    res.status(StatusCodes.OK).json({
      success: true,
      count: projects.length,
      data: projectsWithStats
    });
  } catch (error) {
    console.error('Get manager projects error:', error);
    throw error;
  }
};

const getProjectDetails = async (req, res) => {
  try {
    const { projectId } = req.params;
    const managerId = req.user.managerId;

    const project = await Project.findOne({ _id: projectId, managerId })
      .populate({
        path: 'managerId',
        populate: {
          path: 'userId',
          select: 'firstName lastName email'
        }
      })
      .lean();

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const assignedCount = await Assignment.countDocuments({
      projectId,
      status: 'active'
    });

    const schedule = await Schedule.find({
      projectId,
      status: 'scheduled'
    }).sort({ dayOfWeek: 1, startTime: 1 }).lean();

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        ...project,
        assignedCount,
        schedule
      }
    });
  } catch (error) {
    console.error('Get project details error:', error);
    throw error;
  }
};

const getProjectEmployees = async (req, res) => {
  try {
    const { projectId } = req.params;
    const managerId = req.user.managerId;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw new BadRequestError('Invalid project ID format');
    }

    const project = await Project.findById(projectId).lean();
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (project.managerId && project.managerId.toString() !== managerId.toString()) {
      throw new UnauthorizedError('You are not authorized to view employees of this project');
    }

    const assignments = await Assignment.find({ 
      projectId,
      status: { $in: ['active', 'completed'] }
    })
    .populate({
      path: 'employeeId',
      populate: {
        path: 'userId',
        select: 'firstName lastName email'
      }
    })
    .sort({ createdAt: -1 })
    .lean();

    const employees = assignments.map(assignment => ({
      _id: assignment._id,
      assignmentId: assignment._id,
      employeeId: assignment.employeeId._id,
      name: `${assignment.employeeId.userId.firstName} ${assignment.employeeId.userId.lastName}`,
      email: assignment.employeeId.userId.email,
      employeeNumber: assignment.employeeId.employeeId,
      position: assignment.employeeId.position,
      department: assignment.employeeId.department,
      assignmentDate: assignment.assignmentDate,
      status: assignment.status,
      completionPercentage: assignment.completionPercentage,
      role: assignment.role
    }));

    res.status(StatusCodes.OK).json({
      success: true,
      count: employees.length,
      total: employees.length,
      data: employees
    });
  } catch (error) {
    console.error('Get project employees error:', error);
    throw error;
  }
};

const addPerformance = async (req, res) => {
  try {
    const {
      employeeId,
      projectId,
      reviewType,
      reviewName,
      maxScore,
      obtainedScore,
      comments
    } = req.body;

    const managerId = req.user.managerId;

    if (!employeeId || !projectId || !reviewType || !reviewName || !maxScore || obtainedScore === undefined) {
      throw new BadRequestError('Please provide all required fields');
    }

    const project = await Project.findOne({ _id: projectId, managerId }).lean();
    if (!project) {
      throw new UnauthorizedError('You are not authorized to review for this project');
    }

    const assignment = await Assignment.findOne({
      employeeId,
      projectId,
      status: 'active'
    }).lean();

    if (!assignment) {
      throw new BadRequestError('Employee is not assigned to this project');
    }

    const existingPerformance = await Performance.findOne({
      employeeId,
      projectId,
      reviewName
    });

    let performance;
    if (existingPerformance) {
      existingPerformance.reviewType = reviewType;
      existingPerformance.maxScore = maxScore;
      existingPerformance.obtainedScore = obtainedScore;
      existingPerformance.comments = comments;
      await existingPerformance.save();
      performance = existingPerformance;
    } else {
      performance = await Performance.create({
        employeeId,
        projectId,
        reviewerId: managerId,
        reviewType,
        reviewName,
        maxScore,
        obtainedScore,
        comments
      });
    }

    await performance.populate([
      {
        path: 'employeeId',
        populate: {
          path: 'userId',
          select: 'firstName lastName'
        }
      },
      { path: 'projectId', select: 'name code' }
    ]);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Performance review saved successfully',
      data: performance
    });
  } catch (error) {
    console.error('Add performance error:', error);
    throw error;
  }
};

const updatePerformance = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const managerId = req.user.managerId;

    const performance = await Performance.findById(id);
    if (!performance) {
      throw new NotFoundError('Performance review not found');
    }

    if (performance.reviewerId.toString() !== managerId) {
      throw new UnauthorizedError('You are not authorized to update this review');
    }

    const updatedPerformance = await Performance.findByIdAndUpdate(
      id,
      updateData,
      { returnDocument: 'after', runValidators: true }
    ).populate([
      {
        path: 'employeeId',
        populate: {
          path: 'userId',
          select: 'firstName lastName'
        }
      },
      { path: 'projectId', select: 'name code' }
    ]).lean();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Performance review updated successfully',
      data: updatedPerformance
    });
  } catch (error) {
    console.error('Update performance error:', error);
    throw error;
  }
};

const getProjectPerformances = async (req, res) => {
  try {
    const { projectId } = req.params;
    const managerId = req.user.managerId;

    const project = await Project.findOne({ _id: projectId, managerId }).lean();
    if (!project) {
      throw new UnauthorizedError('You are not authorized to view this project');
    }

    const performances = await Performance.find({ projectId })
      .populate({
        path: 'employeeId',
        populate: {
          path: 'userId',
          select: 'firstName lastName'
        }
      })
      .sort({ createdAt: -1 })
      .lean();

    const employeesMap = new Map();
    performances.forEach(performance => {
      const employeeId = performance.employeeId._id.toString();
      if (!employeesMap.has(employeeId)) {
        employeesMap.set(employeeId, {
          employee: {
            id: employeeId,
            name: `${performance.employeeId.userId.firstName} ${performance.employeeId.userId.lastName}`,
            employeeId: performance.employeeId.employeeId,
            position: performance.employeeId.position
          },
          reviews: []
        });
      }
      employeesMap.get(employeeId).reviews.push({
        id: performance._id,
        reviewType: performance.reviewType,
        reviewName: performance.reviewName,
        maxScore: performance.maxScore,
        obtainedScore: performance.obtainedScore,
        percentage: performance.percentage,
        rating: performance.rating,
        comments: performance.comments,
        reviewDate: performance.reviewDate
      });
    });

    const result = Array.from(employeesMap.values());

    res.status(StatusCodes.OK).json({
      success: true,
      project: {
        id: project._id,
        name: project.name,
        code: project.code
      },
      totalEmployees: result.length,
      data: result
    });
  } catch (error) {
    console.error('Get project performances error:', error);
    throw error;
  }
};

const getEmployeePerformances = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const managerId = req.user.managerId;

    const managerProjects = await Project.find({ managerId }).distinct('_id');

    const performances = await Performance.find({
      employeeId,
      projectId: { $in: managerProjects }
    })
    .populate([
      { path: 'projectId', select: 'name code priority' },
      {
        path: 'employeeId',
        populate: {
          path: 'userId',
          select: 'firstName lastName'
        }
      }
    ])
    .sort({ createdAt: -1 })
    .lean();

    if (performances.length === 0) {
      return res.status(StatusCodes.OK).json({
        success: true,
        employee: null,
        statistics: {
          totalReviews: 0,
          averagePercentage: 0,
          totalProjects: 0
        },
        data: []
      });
    }

    const totalReviews = performances.length;
    const averagePercentage = performances.reduce((acc, p) => acc + p.percentage, 0) / totalReviews || 0;

    const byProject = performances.reduce((acc, performance) => {
      const projectId = performance.projectId._id.toString();
      if (!acc[projectId]) {
        acc[projectId] = {
          project: {
            id: projectId,
            name: performance.projectId.name,
            code: performance.projectId.code
          },
          reviews: []
        };
      }
      acc[projectId].reviews.push({
        reviewType: performance.reviewType,
        reviewName: performance.reviewName,
        maxScore: performance.maxScore,
        obtainedScore: performance.obtainedScore,
        percentage: performance.percentage,
        rating: performance.rating,
        comments: performance.comments,
        reviewDate: performance.reviewDate
      });
      return acc;
    }, {});

    res.status(StatusCodes.OK).json({
      success: true,
      employee: {
        id: performances[0].employeeId._id,
        name: `${performances[0].employeeId.userId.firstName} ${performances[0].employeeId.userId.lastName}`,
        employeeId: performances[0].employeeId.employeeId,
        position: performances[0].employeeId.position
      },
      statistics: {
        totalReviews,
        averagePercentage: averagePercentage.toFixed(1),
        totalProjects: Object.keys(byProject).length,
        averageRating: (averagePercentage / 20).toFixed(1)
      },
      data: Object.values(byProject)
    });
  } catch (error) {
    console.error('Get employee performances error:', error);
    throw error;
  }
};

const getManagerSchedule = async (req, res) => {
  try {
    const managerId = req.user.managerId;

    const schedules = await Schedule.find({ managerId, status: 'scheduled' })
      .populate({
        path: 'projectId',
        select: 'name code'
      })
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean();

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const groupedSchedule = days.reduce((acc, day) => {
      acc[day] = schedules.filter(s => s.dayOfWeek === day);
      return acc;
    }, {});

    res.status(StatusCodes.OK).json({
      success: true,
      totalMeetings: schedules.length,
      data: groupedSchedule
    });
  } catch (error) {
    console.error('Get manager schedule error:', error);
    throw error;
  }
};

const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const managerId = req.user.managerId;

    const schedule = await Schedule.findById(id);
    if (!schedule) {
      throw new NotFoundError('Schedule not found');
    }

    if (schedule.managerId.toString() !== managerId) {
      throw new UnauthorizedError('You are not authorized to update this schedule');
    }

    const allowedUpdates = {
      status: updateData.status,
      location: updateData.location,
      meetingType: updateData.meetingType
    };

    const updatedSchedule = await Schedule.findByIdAndUpdate(
      id,
      allowedUpdates,
      { returnDocument: 'after', runValidators: true }
    ).populate({
      path: 'projectId',
      select: 'name code'
    }).lean();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Schedule updated successfully',
      data: updatedSchedule
    });
  } catch (error) {
    console.error('Update schedule error:', error);
    throw error;
  }
};

const addRemark = async (req, res) => {
  try {
    const { employeeId, projectId, remark } = req.body;
    const managerId = req.user.managerId;

    const employee = await Employee.findById(employeeId).lean();
    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    if (projectId) {
      const project = await Project.findOne({ _id: projectId, managerId }).lean();
      if (!project) {
        throw new UnauthorizedError('You are not authorized to add remark for this project');
      }
    }

    const newRemark = await Remark.create({
      employeeId,
      managerId,
      projectId,
      remark,
      createdBy: req.user.userId
    });

    await newRemark.populate([
      {
        path: 'employeeId',
        populate: {
          path: 'userId',
          select: 'firstName lastName'
        }
      },
      {
        path: 'managerId',
        populate: {
          path: 'userId',
          select: 'firstName lastName'
        }
      },
      { path: 'projectId', select: 'name code' }
    ]);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Remark added successfully',
      data: newRemark
    });
  } catch (error) {
    console.error('Add remark error:', error);
    throw error;
  }
};

const getEmployeeRemarks = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const managerId = req.user.managerId;

    const remarks = await Remark.find({ employeeId })
      .populate([
        {
          path: 'managerId',
          populate: {
            path: 'userId',
            select: 'firstName lastName'
          }
        },
        { path: 'projectId', select: 'name code' }
      ])
      .sort({ createdAt: -1 })
      .lean();

    const employee = await Employee.findById(employeeId).populate({
      path: 'userId',
      select: 'firstName lastName'
    }).lean();

    res.status(StatusCodes.OK).json({
      success: true,
      employee: employee ? {
        id: employee._id,
        name: `${employee.userId.firstName} ${employee.userId.lastName}`,
        employeeId: employee.employeeId,
        position: employee.position,
        department: employee.department
      } : null,
      count: remarks.length,
      data: remarks
    });
  } catch (error) {
    console.error('Get employee remarks error:', error);
    throw error;
  }
};

const getManagerProfile = async (req, res) => {
  try {
    const managerId = req.user.managerId;
    
    const manager = await Manager.findById(managerId)
      .populate({
        path: 'userId',
        select: '-password'
      })
      .lean();

    if (!manager) {
      throw new NotFoundError('Manager not found');
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: manager
    });
  } catch (error) {
    console.error('Get manager profile error:', error);
    throw error;
  }
};

const updateManagerProfile = async (req, res) => {
  try {
    const managerId = req.user.managerId;
    const updateData = req.body;

    const allowedUpdates = {
      contactNumber: updateData.contactNumber,
      emergencyContact: updateData.emergencyContact,
      dateOfBirth: updateData.dateOfBirth,
      gender: updateData.gender,
      address: updateData.address,
      bio: updateData.bio
    };

    Object.keys(allowedUpdates).forEach(key => 
      allowedUpdates[key] === undefined && delete allowedUpdates[key]
    );

    const updatedManager = await Manager.findByIdAndUpdate(
      managerId,
      allowedUpdates,
      { returnDocument: 'after', runValidators: true }
    ).populate({
      path: 'userId',
      select: '-password'
    }).lean();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedManager
    });
  } catch (error) {
    console.error('Update manager profile error:', error);
    throw error;
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    if (!currentPassword || !newPassword) {
      throw new BadRequestError('Please provide current and new password');
    }

    if (newPassword.length < 6) {
      throw new BadRequestError('Password must be at least 6 characters long');
    }

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

module.exports = {
  getManagerDashboardStats,
  getManagerProjects,
  getProjectDetails,
  getProjectEmployees,
  addPerformance,
  updatePerformance,
  getProjectPerformances,
  getEmployeePerformances,
  getManagerSchedule,
  updateSchedule,
  addRemark,
  getEmployeeRemarks,
  getManagerProfile,
  updateManagerProfile,
  changePassword
};