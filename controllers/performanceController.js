const { Performance, Employee, Project, Manager, User } = require('../models');
const { BadRequestError, NotFoundError, UnauthorizedError } = require('../errors');
const { StatusCodes } = require('http-status-codes');
const mongoose = require('mongoose');

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

const getMyPerformances = async (req, res) => {
  try {
    const employeeId = req.user.employeeId;

    const performances = await Performance.find({ employeeId })
      .populate([
        { path: 'projectId', select: 'name code priority' },
        {
          path: 'reviewerId',
          populate: {
            path: 'userId',
            select: 'firstName lastName'
          }
        }
      ])
      .sort({ createdAt: -1 })
      .lean();

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
        reviewer: `${performance.reviewerId.userId.firstName} ${performance.reviewerId.userId.lastName}`,
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
        overallPercentage: averagePercentage.toFixed(1),
        totalProjects: Object.keys(byProject).length,
        rating: (averagePercentage / 20).toFixed(1)
      },
      data: Object.values(byProject)
    });
  } catch (error) {
    console.error('Get my performances error:', error);
    throw error;
  }
};

const getProjectPerformanceStats = async (req, res) => {
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
      .lean();

    const ratingDistribution = {
      Outstanding: 0,
      Excellent: 0,
      Good: 0,
      Satisfactory: 0,
      'Needs Improvement': 0,
      Unsatisfactory: 0
    };

    performances.forEach(p => {
      if (p.rating) ratingDistribution[p.rating] = (ratingDistribution[p.rating] || 0) + 1;
    });

    const employeeAverages = new Map();
    performances.forEach(p => {
      const employeeId = p.employeeId._id.toString();
      if (!employeeAverages.has(employeeId)) {
        employeeAverages.set(employeeId, {
          employee: {
            id: employeeId,
            name: `${p.employeeId.userId.firstName} ${p.employeeId.userId.lastName}`,
            employeeId: p.employeeId.employeeId
          },
          totalScore: 0,
          reviewCount: 0
        });
      }
      const data = employeeAverages.get(employeeId);
      data.totalScore += p.percentage;
      data.reviewCount++;
    });

    const employeePerformance = Array.from(employeeAverages.values()).map(emp => ({
      ...emp,
      averagePercentage: (emp.totalScore / emp.reviewCount).toFixed(1)
    })).sort((a, b) => b.averagePercentage - a.averagePercentage);

    res.status(StatusCodes.OK).json({
      success: true,
      project: {
        id: project._id,
        name: project.name,
        code: project.code
      },
      statistics: {
        totalReviews: performances.length,
        totalEmployees: employeePerformance.length,
        ratingDistribution
      },
      employeePerformance: employeePerformance.slice(0, 10)
    });
  } catch (error) {
    console.error('Get project performance stats error:', error);
    throw error;
  }
};

module.exports = {
  addPerformance,
  updatePerformance,
  getProjectPerformances,
  getEmployeePerformances,
  getMyPerformances,
  getProjectPerformanceStats
};