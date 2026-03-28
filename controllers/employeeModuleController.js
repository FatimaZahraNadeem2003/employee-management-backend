const { Employee, User, Project, Assignment, Performance, Schedule } = require('../models');
const { BadRequestError, NotFoundError } = require('../errors');
const { StatusCodes } = require('http-status-codes');

const getEmployeeProfile = async (req, res) => {
  try {
    const employeeId = req.user.employeeId;

    const employee = await Employee.findById(employeeId)
      .populate({
        path: 'userId',
        select: '-password'
      });

    if (!employee) {
      throw new NotFoundError('Employee profile not found');
    }

    const assignments = await Assignment.find({ 
      employeeId,
      status: { $in: ['active', 'completed'] }
    });

    const completedProjects = assignments.filter(a => a.status === 'completed').length;
    const activeProjects = assignments.filter(a => a.status === 'active').length;

    const avgCompletion = assignments.reduce((acc, a) => acc + (a.completionPercentage || 0), 0) / assignments.length || 0;

    const recentPerformances = await Performance.find({ employeeId })
      .populate('projectId', 'name code')
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        profile: {
          id: employee._id,
          firstName: employee.userId.firstName,
          lastName: employee.userId.lastName,
          email: employee.userId.email,
          employeeId: employee.employeeId,
          position: employee.position,
          department: employee.department,
          dateOfBirth: employee.dateOfBirth,
          gender: employee.gender,
          contactNumber: employee.contactNumber,
          address: employee.address,
          emergencyContact: employee.emergencyContact,
          joiningDate: employee.joiningDate,
          status: employee.status,
          salary: employee.salary
        },
        statistics: {
          totalProjects: assignments.length,
          completedProjects,
          activeProjects,
          averageCompletion: Math.round(avgCompletion)
        },
        recentPerformances
      }
    });
  } catch (error) {
    console.error('Get employee profile error:', error);
    throw error;
  }
};

const updateEmployeeProfile = async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const updateData = req.body;

    const allowedUpdates = {
      contactNumber: updateData.contactNumber,
      address: updateData.address,
      dateOfBirth: updateData.dateOfBirth,
      gender: updateData.gender,
      emergencyContact: updateData.emergencyContact
    };

    Object.keys(allowedUpdates).forEach(key => 
      allowedUpdates[key] === undefined && delete allowedUpdates[key]
    );

    const updatedEmployee = await Employee.findByIdAndUpdate(
      employeeId,
      allowedUpdates,
      { returnDocument: 'after', runValidators: true }
    ).populate({
      path: 'userId',
      select: '-password'
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updatedEmployee._id,
        firstName: updatedEmployee.userId.firstName,
        lastName: updatedEmployee.userId.lastName,
        email: updatedEmployee.userId.email,
        ...updatedEmployee.toObject()
      }
    });
  } catch (error) {
    console.error('Update employee profile error:', error);
    throw error;
  }
};

const getEmployeeProjects = async (req, res) => {
  try {
    const employeeId = req.user.employeeId;

    const assignments = await Assignment.find({ 
      employeeId,
      status: { $in: ['active', 'completed'] }
    })
    .populate({
      path: 'projectId',
      populate: {
        path: 'managerId',
        populate: {
          path: 'userId',
          select: 'firstName lastName'
        }
      }
    })
    .sort({ createdAt: -1 })
    .lean();

    const projects = assignments.map(assignment => ({
      _id: assignment.projectId?._id,
      assignmentId: assignment._id,
      name: assignment.projectId?.name,
      code: assignment.projectId?.code,
      description: assignment.projectId?.description,
      department: assignment.projectId?.department,
      priority: assignment.projectId?.priority,
      startDate: assignment.projectId?.startDate,
      endDate: assignment.projectId?.endDate,
      manager: assignment.projectId?.managerId ? {
        name: `${assignment.projectId.managerId.userId?.firstName} ${assignment.projectId.managerId.userId?.lastName}`,
        department: assignment.projectId.managerId.department
      } : null,
      completionPercentage: assignment.completionPercentage,
      role: assignment.role,
      status: assignment.status,
      assignmentDate: assignment.assignmentDate
    }));

    res.status(StatusCodes.OK).json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (error) {
    console.error('Get employee projects error:', error);
    throw error;
  }
};

const getEmployeeProjectDetails = async (req, res) => {
  try {
    const { projectId } = req.params;
    const employeeId = req.user.employeeId;

    const assignment = await Assignment.findOne({
      employeeId,
      projectId,
      status: { $in: ['active', 'completed'] }
    });

    if (!assignment) {
      throw new BadRequestError('You are not assigned to this project');
    }

    const project = await Project.findById(projectId)
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

    const performances = await Performance.find({ employeeId, projectId })
      .sort({ createdAt: -1 })
      .lean();

    const schedules = await Schedule.find({
      projectId,
      status: 'scheduled'
    }).sort({ dayOfWeek: 1, startTime: 1 }).lean();

    const totalScore = performances.reduce((acc, p) => acc + p.obtainedScore, 0);
    const totalMaxScore = performances.reduce((acc, p) => acc + p.maxScore, 0);
    const overallPercentage = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;

    const responseData = {
      _id: project._id,
      name: project.name,
      code: project.code,
      description: project.description,
      department: project.department,
      priority: project.priority,
      startDate: project.startDate,
      endDate: project.endDate,
      status: project.status,
      manager: project.managerId ? {
        name: `${project.managerId.userId?.firstName || ''} ${project.managerId.userId?.lastName || ''}`.trim(),
        email: project.managerId.userId?.email || '',
        department: project.managerId.department || ''
      } : null,
      assignment: {
        status: assignment.status,
        completionPercentage: assignment.completionPercentage || 0,
        role: assignment.role || 'Team Member',
        assignmentDate: assignment.assignmentDate
      },
      performance: {
        reviews: performances.map(p => ({
          _id: p._id,
          reviewType: p.reviewType,
          reviewName: p.reviewName,
          maxScore: p.maxScore,
          obtainedScore: p.obtainedScore,
          percentage: p.percentage,
          rating: p.rating,
          comments: p.comments,
          reviewDate: p.reviewDate
        })),
        statistics: {
          totalReviews: performances.length,
          overallPercentage: overallPercentage.toFixed(1),
          averageRating: performances.length > 0 
            ? (performances.reduce((acc, p) => acc + (p.percentage || 0), 0) / performances.length).toFixed(1)
            : '0'
        }
      },
      schedule: schedules.map(s => ({
        _id: s._id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        location: s.location,
        building: s.building,
        meetingType: s.meetingType
      }))
    };

    res.status(StatusCodes.OK).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Get employee project details error:', error);
    throw error;
  }
};

const getEmployeeSchedule = async (req, res) => {
  try {
    const employeeId = req.user.employeeId;

    const assignments = await Assignment.find({
      employeeId,
      status: 'active'
    }).select('projectId');

    const projectIds = assignments.map(a => a.projectId);

    const schedules = await Schedule.find({
      projectId: { $in: projectIds },
      status: 'scheduled'
    })
    .populate({
      path: 'projectId',
      select: 'name code'
    })
    .populate({
      path: 'managerId',
      populate: {
        path: 'userId',
        select: 'firstName lastName'
      }
    })
    .sort({ dayOfWeek: 1, startTime: 1 });

    const today = new Date();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayDay = days[today.getDay()];
    const currentTime = today.toTimeString().slice(0, 5);

    const todayMeetings = schedules
      .filter(s => s.dayOfWeek === todayDay)
      .map(s => ({
        ...s.toObject(),
        status: s.startTime <= currentTime && s.endTime >= currentTime ? 'ongoing' :
                s.endTime < currentTime ? 'completed' : 'upcoming'
      }));

    const weeklySchedule = days.reduce((acc, day) => {
      acc[day] = schedules.filter(s => s.dayOfWeek === day);
      return acc;
    }, {});

    res.status(StatusCodes.OK).json({
      success: true,
      today: {
        day: todayDay,
        date: today.toDateString(),
        meetings: todayMeetings
      },
      weekly: weeklySchedule
    });
  } catch (error) {
    console.error('Get employee schedule error:', error);
    throw error;
  }
};

const getAllEmployeePerformances = async (req, res) => {
  try {
    const employeeId = req.user.employeeId;

    const performances = await Performance.find({ employeeId })
      .populate('projectId', 'name code')
      .sort({ createdAt: -1 });

    const totalReviews = performances.length;
    const totalScore = performances.reduce((acc, p) => acc + p.obtainedScore, 0);
    const totalMaxScore = performances.reduce((acc, p) => acc + p.maxScore, 0);
    const overallPercentage = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;

    const byProject = performances.reduce((acc, performance) => {
      const projectId = performance.projectId._id.toString();
      if (!acc[projectId]) {
        acc[projectId] = {
          project: {
            id: projectId,
            name: performance.projectId.name,
            code: performance.projectId.code
          },
          reviews: [],
          averagePercentage: 0
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

    Object.values(byProject).forEach(project => {
      const total = project.reviews.reduce((acc, r) => acc + r.percentage, 0);
      project.averagePercentage = (total / project.reviews.length).toFixed(1);
    });

    res.status(StatusCodes.OK).json({
      success: true,
      statistics: {
        totalReviews,
        overallPercentage: overallPercentage.toFixed(1),
        totalProjects: Object.keys(byProject).length,
        rating: (overallPercentage / 20).toFixed(1)
      },
      data: Object.values(byProject)
    });
  } catch (error) {
    console.error('Get all employee performances error:', error);
    throw error;
  }
};

const getProjectPerformance = async (req, res) => {
  try {
    const { projectId } = req.params;
    const employeeId = req.user.employeeId;

    const assignment = await Assignment.findOne({
      employeeId,
      projectId,
      status: { $in: ['active', 'completed'] }
    });

    if (!assignment) {
      throw new BadRequestError('You are not assigned to this project');
    }

    const project = await Project.findById(projectId).select('name code');
    
    const performances = await Performance.find({ employeeId, projectId })
      .sort({ createdAt: -1 });

    const totalScore = performances.reduce((acc, p) => acc + p.obtainedScore, 0);
    const totalMaxScore = performances.reduce((acc, p) => acc + p.maxScore, 0);
    const averagePercentage = performances.reduce((acc, p) => acc + p.percentage, 0) / performances.length || 0;

    const byType = performances.reduce((acc, performance) => {
      if (!acc[performance.reviewType]) {
        acc[performance.reviewType] = [];
      }
      acc[performance.reviewType].push(performance);
      return acc;
    }, {});

    res.status(StatusCodes.OK).json({
      success: true,
      project: {
        id: project._id,
        name: project.name,
        code: project.code
      },
      assignment: {
        status: assignment.status,
        completionPercentage: assignment.completionPercentage,
        role: assignment.role
      },
      statistics: {
        totalReviews: performances.length,
        totalScore,
        totalMaxScore,
        averagePercentage: averagePercentage.toFixed(1),
        rating: averagePercentage >= 95 ? 'Outstanding' :
                averagePercentage >= 85 ? 'Excellent' :
                averagePercentage >= 75 ? 'Good' :
                averagePercentage >= 60 ? 'Satisfactory' :
                averagePercentage >= 50 ? 'Needs Improvement' : 'Unsatisfactory'
      },
      byReviewType: byType,
      allReviews: performances
    });
  } catch (error) {
    console.error('Get project performance error:', error);
    throw error;
  }
};

const getEmployeeProgress = async (req, res) => {
  try {
    const employeeId = req.user.employeeId;

    const assignments = await Assignment.find({ employeeId })
      .populate('projectId', 'name code priority')
      .sort({ createdAt: -1 });

    const totalProgress = assignments.reduce((acc, a) => acc + (a.completionPercentage || 0), 0);
    const averageProgress = assignments.length > 0 ? totalProgress / assignments.length : 0;

    const performances = await Performance.find({ employeeId })
      .populate('projectId', 'name code');

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentPerformances = performances.filter(p => p.createdAt >= sixMonthsAgo);
    const monthlyTrend = [];

    for (let i = 0; i < 6; i++) {
      const month = new Date();
      month.setMonth(month.getMonth() - i);
      const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

      const monthPerformances = recentPerformances.filter(p => 
        p.createdAt >= monthStart && p.createdAt <= monthEnd
      );

      const avgPercentage = monthPerformances.length > 0
        ? monthPerformances.reduce((acc, p) => acc + p.percentage, 0) / monthPerformances.length
        : 0;

      monthlyTrend.unshift({
        month: month.toLocaleString('default', { month: 'short' }),
        average: avgPercentage.toFixed(1)
      });
    }

    const projectProgress = assignments.map(a => ({
      project: {
        id: a.projectId._id,
        name: a.projectId.name,
        code: a.projectId.code,
        priority: a.projectId.priority
      },
      completionPercentage: a.completionPercentage,
      status: a.status,
      role: a.role,
      assignmentDate: a.assignmentDate
    }));

    const completedProjects = assignments.filter(a => a.status === 'completed').length;
    const completionRate = assignments.length > 0 
      ? (completedProjects / assignments.length) * 100 
      : 0;

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        overview: {
          totalProjects: assignments.length,
          completedProjects,
          activeProjects: assignments.filter(a => a.status === 'active').length,
          averageCompletion: Math.round(averageProgress),
          completionRate: completionRate.toFixed(1)
        },
        performance: {
          monthlyTrend,
          recentPerformances: performances.slice(0, 5)
        },
        projects: projectProgress,
        upcomingDeadlines: []
      }
    });
  } catch (error) {
    console.error('Get employee progress error:', error);
    throw error;
  }
};

const getAvailableProjects = async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    
    const allProjects = await Project.find({ 
      status: 'active' 
    })
    .populate({
      path: 'managerId',
      populate: {
        path: 'userId',
        select: 'firstName lastName'
      }
    })
    .select('name code description department priority startDate endDate status managerId')
    .lean();

    const assignments = await Assignment.find({ 
      employeeId,
      status: { $in: ['active', 'completed'] }
    }).select('projectId').lean();

    const assignedProjectIds = assignments.map(a => a.projectId.toString());

    const availableProjects = allProjects.filter(
      project => !assignedProjectIds.includes(project._id.toString())
    );

    const projectsWithCounts = await Promise.all(
      availableProjects.map(async (project) => {
        const assignedCount = await Assignment.countDocuments({
          projectId: project._id,
          status: 'active'
        });
        
        return {
          ...project,
          assignedCount
        };
      })
    );

    res.status(StatusCodes.OK).json({
      success: true,
      count: projectsWithCounts.length,
      data: projectsWithCounts
    });
  } catch (error) {
    console.error('Get available projects error:', error);
    throw error;
  }
};

const assignToProject = async (req, res) => {
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
    console.error('Assign to project error:', error);
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
  getEmployeeProfile,
  updateEmployeeProfile,
  getEmployeeProjects,
  getEmployeeProjectDetails,
  getEmployeeSchedule,
  getAllEmployeePerformances,
  getProjectPerformance,
  getEmployeeProgress,
  getAvailableProjects,
  assignToProject,
  changePassword
};