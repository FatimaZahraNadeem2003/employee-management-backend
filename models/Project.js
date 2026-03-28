const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide project name'],
        trim: true
    },
    code: {
        type: String,
        required: [true, 'Please provide project code'],
        unique: true,
        uppercase: true,
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Please provide project description']
    },
    managerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Manager'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    department: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['planning', 'active', 'on-hold', 'completed', 'cancelled'],
        default: 'planning'
    },
    budget: {
        type: Number,
        default: 0
    },
    resources: [{
        type: String
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Project', ProjectSchema);