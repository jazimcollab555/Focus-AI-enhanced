const mongoose = require('mongoose');

// 1. Session Collection
const SessionSchema = new mongoose.Schema({
    teacherId: { type: String, default: 'default_teacher' },
    startTime: { type: Date, default: Date.now },
    endTime: Date,
    plannedDuration: Number,
    actualDuration: Number, // in seconds
    totalStudentsJoined: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    attendanceLog: [{
        studentId: String,
        name: String,
        action: String, // 'JOIN', 'LEAVE'
        timestamp: { type: Date, default: Date.now }
    }]
});

// 2. Student Collection (Persistent)
const StudentSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, // Simple unique ID for demo
    joinedSessions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Session' }],
    totalActiveTime: { type: Number, default: 0 }, // seconds
    averageFocusScore: { type: Number, default: 100 }
});

// 3. Question Collection
const QuestionSchema = new mongoose.Schema({
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
    text: String,
    mode: { type: String, enum: ['MCQ', 'MANUAL'], default: 'MANUAL' },
    options: [String],
    correctAnswer: String,
    timerDuration: Number,
    sentAt: { type: Date, default: Date.now }
});

// 4. Answer Collection
const AnswerSchema = new mongoose.Schema({
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    studentId: String, // Socket ID or Name? Let's use Name for persistence if possible, but Socket ID is used in live logic. Sticking to SocketID for session link, but we might want to link to Student Model.
    studentName: String,
    answer: String,
    isCorrect: Boolean,
    points: Number,
    responseTime: Number, // seconds
    submittedAt: { type: Date, default: Date.now },
    stats: {
        accuracy: Number,
        speed: Number,
        focus: Number
    }
});

// 5. Focus Log Collection
const FocusLogSchema = new mongoose.Schema({
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
    studentId: String,
    studentName: String,
    timestamp: { type: Date, default: Date.now },
    score: Number,
    isTabActive: Boolean,
    isFaceDetected: Boolean,
    distractionEvent: String // Description of event if score dropped
});

module.exports = {
    Session: mongoose.model('Session', SessionSchema),
    Student: mongoose.model('Student', StudentSchema),
    Question: mongoose.model('Question', QuestionSchema),
    Answer: mongoose.model('Answer', AnswerSchema),
    FocusLog: mongoose.model('FocusLog', FocusLogSchema)
};
