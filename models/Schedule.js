const mongoose = require('mongoose');

const ScheduleSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    managerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Manager',
        required: true
    },
    dayOfWeek: {
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        required: true
    },
    startTime: {
        type: String,
        required: true
    },
    endTime: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    building: {
        type: String
    },
    meetingType: {
        type: String,
        enum: ['meeting', 'workshop', 'presentation', 'review', 'training'],
        default: 'meeting'
    },
    semester: {
        type: String,
        required: true
    },
    academicYear: {
        type: String,
        required: true
    },
    isRecurring: {
        type: Boolean,
        default: true
    },
    status: {
        type: String,
        enum: ['scheduled', 'cancelled', 'completed'],
        default: 'scheduled'
    }
}, {
    timestamps: true
});

ScheduleSchema.index(
    { dayOfWeek: 1, startTime: 1, endTime: 1, location: 1 },
    { unique: true }
);

module.exports = mongoose.model('Schedule', ScheduleSchema);