const { StatusCodes } = require('http-status-codes');

const getNotifications = async (req, res) => {
  try {
    res.status(StatusCodes.OK).json({
      success: true,
      data: []
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    throw error;
  }
};

const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    throw error;
  }
};

const clearAll = async (req, res) => {
  try {
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'All notifications cleared'
    });
  } catch (error) {
    console.error('Clear all error:', error);
    throw error;
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  clearAll
};