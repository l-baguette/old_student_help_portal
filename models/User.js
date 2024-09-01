const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    studentId: { type: String, unique: true },
    password: String,
    role: { type: String, enum: ['student', 'teacher'], default: 'student' }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
