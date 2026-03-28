const mongoose = require('mongoose');

const ManagerSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    employeeId: {
        type: String,
        required: true,
        unique: true
    },
    department: {
        type: String,
        required: true
    },
    qualification: {
        type: String,
        required: true
    },
    experience: {
        type: Number,
        default: 0
    },
    dateOfBirth: {
        type: Date
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'other']
    },
    contactNumber: {
        type: String,
        required: true
    },
    emergencyContact: {
        type: String
    },
    address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String
    },
    joiningDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'on-leave', 'resigned'],
        default: 'active'
    },
    profilePicture: {
        type: String
    },
    bio: {
        type: String
    }
}, {
    timestamps: true
});

ManagerSchema.virtual('fullName').get(function() {
    return this.userId ? `${this.userId.firstName} ${this.userId.lastName}` : '';
});

module.exports = mongoose.model('Manager', ManagerSchema);