const { Schedule, Project, Manager } = require('../models');
const { BadRequestError, NotFoundError } = require('../errors');
const { StatusCodes } = require('http-status-codes');

const resolveManagerId = async (managerIdentifier) => {
  if (!managerIdentifier) return null;
  const isValidObjectId = managerIdentifier.match(/^[0-9a-fA-F]{24}$/);
  if (isValidObjectId) {
    return managerIdentifier;
  } else {
    const manager = await Manager.findOne({ 
      $or: [
        { employeeId: managerIdentifier },
        { 'userId.email': managerIdentifier }
      ]
    }).lean();
    return manager?._id;
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

const createSchedule = async (req, res) => {
  try {
    const {
      projectId,
      managerId,
      dayOfWeek,
      startTime,
      endTime,
      location,
      building,
      meetingType,
      semester,
      academicYear,
      isRecurring,
      status
    } = req.body;

    if (!projectId || !managerId || !dayOfWeek || !startTime || !endTime || !location || !semester || !academicYear) {
      throw new BadRequestError('Please provide all required fields');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const manager = await Manager.findById(managerId);
    if (!manager) {
      throw new NotFoundError('Manager not found');
    }

    const conflictingSchedule = await Schedule.findOne({
      dayOfWeek,
      location,
      $or: [
        {
          startTime: { $lt: endTime },
          endTime: { $gt: startTime }
        }
      ],
      status: { $ne: 'cancelled' }
    });

    if (conflictingSchedule) {
      throw new BadRequestError('Location already booked for this time slot');
    }

    const managerConflict = await Schedule.findOne({
      managerId,
      dayOfWeek,
      $or: [
        {
          startTime: { $lt: endTime },
          endTime: { $gt: startTime }
        }
      ],
      status: { $ne: 'cancelled' }
    });

    if (managerConflict) {
      throw new BadRequestError('Manager already has a meeting at this time');
    }

    const schedule = await Schedule.create({
      projectId,
      managerId,
      dayOfWeek,
      startTime,
      endTime,
      location,
      building,
      meetingType: meetingType || 'meeting',
      semester,
      academicYear,
      isRecurring: isRecurring !== undefined ? isRecurring : true,
      status: status || 'scheduled'
    });

    await schedule.populate([
      { path: 'projectId', select: 'name code' },
      { 
        path: 'managerId',
        populate: {
          path: 'userId',
          select: 'firstName lastName'
        }
      }
    ]);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Schedule created successfully',
      data: schedule
    });
  } catch (error) {
    console.error('Create schedule error:', error);
    throw error;
  }
};

const getAllSchedules = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search,
      dayOfWeek,
      projectId,
      managerId,
      semester,
      academicYear,
      status
    } = req.query;

    const query = {};
    
    if (dayOfWeek) query.dayOfWeek = dayOfWeek;
    if (semester) query.semester = { $regex: semester, $options: 'i' };
    if (academicYear) query.academicYear = { $regex: academicYear, $options: 'i' };
    if (status) query.status = status;

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

    if (search && search.trim() !== '') {
      const projects = await Project.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } },
          { department: { $regex: search, $options: 'i' } }
        ]
      }).select('_id').lean();
      
      const projectIds = projects.map(p => p._id);

      const managers = await Manager.find({
        $or: [
          { 'userId.firstName': { $regex: search, $options: 'i' } },
          { 'userId.lastName': { $regex: search, $options: 'i' } },
          { employeeId: { $regex: search, $options: 'i' } },
          { department: { $regex: search, $options: 'i' } }
        ]
      }).select('_id').lean();
      
      const managerIds = managers.map(m => m._id);

      query.$or = [
        { location: { $regex: search, $options: 'i' } },
        { building: { $regex: search, $options: 'i' } },
        { semester: { $regex: search, $options: 'i' } },
        { academicYear: { $regex: search, $options: 'i' } }
      ];

      if (projectIds.length > 0) {
        query.$or.push({ projectId: { $in: projectIds } });
      }

      if (managerIds.length > 0) {
        query.$or.push({ managerId: { $in: managerIds } });
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 100);

    const schedules = await Schedule.find(query)
      .populate([
        { 
          path: 'projectId', 
          select: 'name code department'
        },
        { 
          path: 'managerId',
          populate: {
            path: 'userId',
            select: 'firstName lastName email'
          }
        }
      ])
      .sort({ dayOfWeek: 1, startTime: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await Schedule.countDocuments(query);

    const groupedByDay = schedules.reduce((acc, schedule) => {
      const day = schedule.dayOfWeek;
      if (!acc[day]) acc[day] = [];
      acc[day].push(schedule);
      return acc;
    }, {});

    res.status(StatusCodes.OK).json({
      success: true,
      count: schedules.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limitNum),
      data: schedules,
      groupedByDay
    });
  } catch (error) {
    console.error('Get all schedules error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      msg: 'Failed to fetch schedules'
    });
  }
};

const getScheduleById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestError('Invalid schedule ID format');
    }

    const schedule = await Schedule.findById(id)
      .populate([
        { 
          path: 'projectId', 
          select: 'name code description'
        },
        { 
          path: 'managerId',
          populate: {
            path: 'userId',
            select: 'firstName lastName email'
          }
        }
      ])
      .lean();

    if (!schedule) {
      throw new NotFoundError('Schedule not found');
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    console.error('Get schedule by id error:', error);
    throw error;
  }
};

const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestError('Invalid schedule ID format');
    }

    const schedule = await Schedule.findById(id);
    if (!schedule) {
      throw new NotFoundError('Schedule not found');
    }

    if (updateData.dayOfWeek || updateData.startTime || updateData.endTime || 
        updateData.location || updateData.managerId) {
      
      const conflictQuery = {
        _id: { $ne: id },
        dayOfWeek: updateData.dayOfWeek || schedule.dayOfWeek,
        status: { $ne: 'cancelled' },
        $or: [
          {
            startTime: { $lt: updateData.endTime || schedule.endTime },
            endTime: { $gt: updateData.startTime || schedule.startTime }
          }
        ]
      };

      if (updateData.location || schedule.location) {
        const locationConflict = await Schedule.findOne({
          ...conflictQuery,
          location: updateData.location || schedule.location
        });
        if (locationConflict) {
          throw new BadRequestError('Location already booked for this time slot');
        }
      }

      if (updateData.managerId || schedule.managerId) {
        const managerConflict = await Schedule.findOne({
          ...conflictQuery,
          managerId: updateData.managerId || schedule.managerId
        });
        if (managerConflict) {
          throw new BadRequestError('Manager already has a meeting at this time');
        }
      }
    }

    const updatedSchedule = await Schedule.findByIdAndUpdate(
      id,
      updateData,
      { returnDocument: 'after', runValidators: true }
    ).populate([
      { path: 'projectId', select: 'name code' },
      { 
        path: 'managerId',
        populate: {
          path: 'userId',
          select: 'firstName lastName'
        }
      }
    ]).lean();

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

const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestError('Invalid schedule ID format');
    }

    const schedule = await Schedule.findById(id);
    if (!schedule) {
      throw new NotFoundError('Schedule not found');
    }

    await Schedule.findByIdAndDelete(id);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    console.error('Delete schedule error:', error);
    throw error;
  }
};

const getWeeklySchedule = async (req, res) => {
  try {
    const { weekStart, semester, academicYear, managerId, projectId } = req.query;

    const query = {};
    if (semester) query.semester = semester;
    if (academicYear) query.academicYear = academicYear;

    if (managerId) {
      const resolvedManagerId = await resolveManagerId(managerId);
      if (resolvedManagerId) {
        query.managerId = resolvedManagerId;
      }
    }

    if (projectId) {
      const resolvedProjectId = await resolveProjectId(projectId);
      if (resolvedProjectId) {
        query.projectId = resolvedProjectId;
      }
    }

    const schedules = await Schedule.find(query)
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
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean();

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const weeklySchedule = days.reduce((acc, day) => {
      acc[day] = schedules.filter(s => s.dayOfWeek === day);
      return acc;
    }, {});

    res.status(StatusCodes.OK).json({
      success: true,
      data: weeklySchedule
    });
  } catch (error) {
    console.error('Get weekly schedule error:', error);
    throw error;
  }
};

module.exports = {
  createSchedule,
  getAllSchedules,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
  getWeeklySchedule
};