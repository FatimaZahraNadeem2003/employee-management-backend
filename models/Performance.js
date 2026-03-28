const mongoose = require('mongoose');

const PerformanceSchema = new mongoose.Schema({
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
    reviewerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Manager',
        required: true
    },
    reviewType: {
        type: String,
        enum: ['quarterly', 'annual', 'project', 'probation'],
        required: true
    },
    reviewName: {
        type: String,
        required: true
    },
    maxScore: {
        type: Number,
        required: true,
        min: 1
    },
    obtainedScore: {
        type: Number,
        required: true,
        min: 0
    },
    percentage: {
        type: Number,
        default: function() {
            return (this.obtainedScore / this.maxScore) * 100;
        }
    },
    rating: {
        type: String,
        enum: ['Outstanding', 'Excellent', 'Good', 'Satisfactory', 'Needs Improvement', 'Unsatisfactory'],
        default: function() {
            const percentage = (this.obtainedScore / this.maxScore) * 100;
            if (percentage >= 95) return 'Outstanding';
            if (percentage >= 85) return 'Excellent';
            if (percentage >= 75) return 'Good';
            if (percentage >= 60) return 'Satisfactory';
            if (percentage >= 50) return 'Needs Improvement';
            return 'Unsatisfactory';
        }
    },
    comments: {
        type: String
    },
    reviewDate: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Performance', PerformanceSchema);