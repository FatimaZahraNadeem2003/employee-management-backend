const { Employee, Manager, Project, Assignment, Schedule } = require('../models');
const { StatusCodes } = require('http-status-codes');

const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayDay = days[today.getDay()];

    const [
      totalEmployees,
      totalManagers,
      totalProjects,
      activeProjects,
      totalAssignments,
      activeAssignments,
      todayMeetings
    ] = await Promise.all([
      Employee.countDocuments(),
      Manager.countDocuments(),
      Project.countDocuments(),
      Project.countDocuments({ status: 'active' }),
      Assignment.countDocuments(),
      Assignment.countDocuments({ status: 'active' }),
      Schedule.find({ 
        dayOfWeek: todayDay,
        status: 'scheduled'
      })
      .populate([
        { path: 'projectId', select: 'name code' },
        { 
          path: 'managerId',
          populate: {
            path: 'userId',
            select: 'firstName lastName'
          }
        }
      ])
      .sort({ startTime: 1 })
    ]);

    const completedAssignments = await Assignment.countDocuments({ status: 'completed' });
    const completionRate = totalAssignments > 0 ? ((completedAssignments / totalAssignments) * 100).toFixed(1) : 0;
    const avgEmployeesPerProject = totalProjects > 0 ? (totalAssignments / totalProjects).toFixed(1) : 0;

    const recentAssignments = await Assignment.find({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    })
    .populate([
      { 
        path: 'employeeId',
        populate: {
          path: 'userId',
          select: 'firstName lastName'
        }
      },
      { path: 'projectId', select: 'name code' }
    ])
    .sort({ createdAt: -1 })
    .limit(10);

    const popularProjects = await Assignment.aggregate([
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
          'project.department': 1,
          count: 1
        }
      }
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        overview: {
          totalEmployees,
          totalManagers,
          totalProjects,
          totalAssignments,
          activeProjects,
          activeAssignments,
          completionRate: parseFloat(completionRate),
          avgEmployeesPerProject: parseFloat(avgEmployeesPerProject)
        },
        todayMeetings: {
          count: todayMeetings.length,
          meetings: todayMeetings
        },
        popularProjects,
        recentActivity: {
          assignments: recentAssignments
        }
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    throw error;
  }
};

const getEmployeesCount = async (req, res) => {
  try {
    const total = await Employee.countDocuments();
    const active = await Employee.countDocuments({ status: 'active' });
    const onLeave = await Employee.countDocuments({ status: 'on-leave' });
    const terminated = await Employee.countDocuments({ status: 'terminated' });
    const probation = await Employee.countDocuments({ status: 'probation' });

    res.status(StatusCodes.OK).json({
      success: true,
      data: { total, active, onLeave, terminated, probation }
    });
  } catch (error) {
    console.error('Get employees count error:', error);
    throw error;
  }
};

const getProjectsCount = async (req, res) => {
  try {
    const total = await Project.countDocuments();
    const active = await Project.countDocuments({ status: 'active' });
    const planning = await Project.countDocuments({ status: 'planning' });
    const completed = await Project.countDocuments({ status: 'completed' });
    const onHold = await Project.countDocuments({ status: 'on-hold' });
    const cancelled = await Project.countDocuments({ status: 'cancelled' });

    res.status(StatusCodes.OK).json({
      success: true,
      data: { total, active, planning, completed, onHold, cancelled }
    });
  } catch (error) {
    console.error('Get projects count error:', error);
    throw error;
  }
};

const getTodayMeetings = async (req, res) => {
  try {
    const today = new Date();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayDay = days[today.getDay()];

    const meetings = await Schedule.find({ 
      dayOfWeek: todayDay,
      status: 'scheduled'
    })
    .populate([
      { path: 'projectId', select: 'name code' },
      { 
        path: 'managerId',
        populate: {
          path: 'userId',
          select: 'firstName lastName'
        }
      }
    ])
    .sort({ startTime: 1 });

    res.status(StatusCodes.OK).json({
      success: true,
      data: meetings
    });
  } catch (error) {
    console.error('Get today meetings error:', error);
    throw error;
  }
};

const getManagerWorkload = async (req, res) => {
  try {
    const managers = await Manager.find({ status: 'active' })
      .populate({
        path: 'userId',
        select: 'firstName lastName email'
      });

    const workloadData = await Promise.all(
      managers.map(async (manager) => {
        const assignedProjects = await Project.countDocuments({ managerId: manager._id, status: 'active' });
        const todayMeetings = await Schedule.countDocuments({
          managerId: manager._id,
          dayOfWeek: days[today.getDay()],
          status: 'scheduled'
        });
        const weeklyMeetings = await Schedule.countDocuments({
          managerId: manager._id,
          status: 'scheduled'
        });
        const totalEmployees = await Assignment.distinct('employeeId', {
          projectId: { $in: await Project.find({ managerId: manager._id }).distinct('_id') },
          status: 'active'
        }).then(employees => employees.length);

        return {
          manager: {
            id: manager._id,
            name: `${manager.userId.firstName} ${manager.userId.lastName}`,
            employeeId: manager.employeeId,
            department: manager.department
          },
          workload: {
            assignedProjects,
            todayMeetings,
            weeklyMeetings,
            totalEmployees
          }
        };
      })
    );

    res.status(StatusCodes.OK).json({
      success: true,
      data: workloadData
    });
  } catch (error) {
    console.error('Get manager workload error:', error);
    throw error;
  }
};

module.exports = {
  getDashboardStats,
  getEmployeesCount,
  getProjectsCount,
  getTodayMeetings,
  getManagerWorkload
};