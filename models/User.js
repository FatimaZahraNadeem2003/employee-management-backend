const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const UserSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'Please provide first name'],
    },
    lastName: {
        type: String,
        required: [true, 'Please provide last name'],
    },
    email: {
        type: String,
        required: [true, 'Please provide email'],
        unique: true
    },
    password: {
        type: String,
        required: [true, 'Please provide password']
    },
    role: {
        type: String,
        enum: ['admin', 'teacher', 'student'],
        default: 'student'
    },
}, {
    timestamps: true
})

UserSchema.pre("save", async function () {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt)
})

UserSchema.methods.createJWT = function () {
    return jwt.sign(
        {
            userId: this._id,
            firstName: this.firstName,
            lastName: this.lastName,
            role: this.role,
            email: this.email,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_LIFETIME }
    )
}

UserSchema.methods.isAdmin = function () {
    return this.role === 'admin';
};

UserSchema.methods.isTeacher = function () {
    return this.role === 'teacher';
};

UserSchema.methods.isStudent = function () {
    return this.role === 'student';
};

UserSchema.methods.comparePassword = async function (candidatePassword) {
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    return isMatch;
}

module.exports = mongoose.model('User', UserSchema)