const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
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
    position: {
        type: String,
        required: true
    },
    department: {
        type: String,
        required: true
    },
    dateOfBirth: {
        type: Date
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'other']
    },
    contactNumber: {
        type: String
    },
    address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String
    },
    emergencyContact: {
        name: String,
        phone: String,
        relationship: String
    },
    joiningDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['active', 'on-leave', 'terminated', 'probation'],
        default: 'active'
    },
    salary: {
        type: Number,
        default: 0
    },
    profilePicture: {
        type: String
    }
}, {
    timestamps: true
});

EmployeeSchema.virtual('fullName').get(function () {
    return this.userId ? `${this.userId.firstName} ${this.userId.lastName}` : '';
});

module.exports = mongoose.model('Employee', EmployeeSchema);