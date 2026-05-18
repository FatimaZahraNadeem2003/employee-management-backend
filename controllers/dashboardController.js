const { Project, Assignment, Schedule, Employee, Manager } = require('../models');
const { StatusCodes } = require('http-status-codes');

const getDashboardStats = async (req, res) => {
  try {
    const role = req.user.role;
    let stats = {};

    if (role === 'admin') {
      const today = new Date();
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const todayDay = days[today.getDay()];
      
      const [totalEmployees, totalManagers, totalProjects, totalAssignments] = await Promise.all([
        Employee.countDocuments(),
        Manager.countDocuments(),
        Project.countDocuments(),
        Assignment.countDocuments()
      ]);

      stats = { totalEmployees, totalManagers, totalProjects, totalAssignments };
    } else if (role === 'manager') {
      const managerId = req.user.managerId;
      const projects = await Project.find({ managerId });
      const totalProjects = projects.length;
      let totalEmployees = 0;
      for (const project of projects) {
        const count = await Assignment.countDocuments({ projectId: project._id, status: 'active' });
        totalEmployees += count;
      }
      stats = { totalProjects, totalEmployees };
    } else if (role === 'employee') {
      const employeeId = req.user.employeeId;
      const assignments = await Assignment.find({ employeeId });
      stats = {
        totalProjects: assignments.length,
        completedProjects: assignments.filter(a => a.status === 'completed').length,
        activeProjects: assignments.filter(a => a.status === 'active').length
      };
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    throw error;
  }
};

const getRecentActivity = async (req, res) => {
  try {
    res.status(StatusCodes.OK).json({
      success: true,
      data: []
    });
  } catch (error) {
    console.error('Get recent activity error:', error);
    throw error;
  }
};

const getAnnouncements = async (req, res) => {
  try {
    res.status(StatusCodes.OK).json({
      success: true,
      data: []
    });
  } catch (error) {
    console.error('Get announcements error:', error);
    throw error;
  }
};

module.exports = {
  getDashboardStats,
  getRecentActivity,
  getAnnouncements
};