const mongoose = require('mongoose');

const AssignmentSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    assignmentDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['active', 'completed', 'removed', 'pending'],
        default: 'active'
    },
    role: {
        type: String,
        default: 'Team Member'
    },
    completionPercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    completionDate: {
        type: Date
    },
    performanceRating: {
        type: Number,
        min: 1,
        max: 5
    },
    remarks: {
        type: String
    }
}, {
    timestamps: true
});

AssignmentSchema.index({ employeeId: 1, projectId: 1 }, { unique: true });

module.exports = mongoose.model('Assignment', AssignmentSchema);