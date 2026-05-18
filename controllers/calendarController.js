const { Schedule, Assignment } = require('../models');
const { StatusCodes } = require('http-status-codes');

const getMySchedule = async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;

    let schedules = [];
    
    if (role === 'manager') {
      const managerId = req.user.managerId;
      schedules = await Schedule.find({ managerId, status: 'scheduled' })
        .populate('projectId', 'name code')
        .sort({ dayOfWeek: 1, startTime: 1 });
    } else if (role === 'employee') {
      const employeeId = req.user.employeeId;
      const assignments = await Assignment.find({ employeeId, status: 'active' }).select('projectId');
      const projectIds = assignments.map(a => a.projectId);
      
      schedules = await Schedule.find({ 
        projectId: { $in: projectIds },
        status: 'scheduled'
      })
      .populate('projectId', 'name code')
      .populate({
        path: 'managerId',
        populate: {
          path: 'userId',
          select: 'firstName lastName'
        }
      })
      .sort({ dayOfWeek: 1, startTime: 1 });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: schedules
    });
  } catch (error) {
    console.error('Get my schedule error:', error);
    throw error;
  }
};

const getUpcomingEvents = async (req, res) => {
  try {
    res.status(StatusCodes.OK).json({
      success: true,
      data: []
    });
  } catch (error) {
    console.error('Get upcoming events error:', error);
    throw error;
  }
};

const markAttendance = async (req, res) => {
  try {
    const { scheduleId, status } = req.body;

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Attendance marked successfully'
    });
  } catch (error) {
    console.error('Mark attendance error:', error);
    throw error;
  }
};

module.exports = {
  getMySchedule,
  getUpcomingEvents,
  markAttendance
};