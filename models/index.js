const mongoose = require('mongoose');
const User = require('./User');
const Employee = require('./Employee');
const Manager = require('./Manager');
const Project = require('./Project');
const Schedule = require('./Schedule');
const Assignment = require('./Assignment');
const Performance = require('./Performance');
const Remark = require('./Remark');

module.exports = {
    User,
    Employee,
    Manager,
    Project,
    Schedule,
    Assignment,
    Performance,
    Remark
};