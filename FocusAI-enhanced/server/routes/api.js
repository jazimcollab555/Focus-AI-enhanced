const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const { Session, Question, Answer, FocusLog, Student } = require('../models/Schemas');
const { generateSessionAnalysis } = require('../services/gemini');

const router = express.Router();

// -------------------------------------------------------------------------
// ROUTES (Merged directly for simplicity in index check, or using router file properly)
// -------------------------------------------------------------------------
router.get('/session/current', (req, res) => {
    if (global.currentSessionId) res.json({ sessionId: global.currentSessionId });
    else res.status(404).json({ error: "No active session" });
});

router.get('/session/:sessionId/report', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await Session.findById(sessionId);
        if (!session) return res.status(404).json({ error: "Session not found" });

        const questions = await Question.find({ sessionId });
        const answers = await Answer.find({ questionId: { $in: questions.map(q => q._id) } });
        const focusLogs = await FocusLog.find({ sessionId });

        const totalQuestions = questions.length;
        const totalAnswers = answers.length;
        const correctAnswers = answers.filter(a => a.isCorrect).length;
        const avgAccuracy = totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0;
        const avgFocus = focusLogs.length > 0 ? focusLogs.reduce((sum, log) => sum + log.score, 0) / focusLogs.length : 0;

        const studentScores = {};
        answers.forEach(a => {
            if (!studentScores[a.studentName]) studentScores[a.studentName] = 0;
            studentScores[a.studentName] += a.points;
        });
        const sortedStudents = Object.entries(studentScores).sort(([, a], [, b]) => b - a);
        const topStudent = sortedStudents.length > 0 ? sortedStudents[0] : null;

        res.json({
            session: { ...session.toObject(), actualDuration: 0 }, // Calc duration properly if needed
            stats: {
                totalQuestions, totalAnswers, avgAccuracy: Math.round(avgAccuracy), avgFocus: Math.round(avgFocus),
                topStudent: topStudent ? { name: topStudent[0], score: topStudent[1] } : "None"
            },
            attendance: session.attendanceLog,
            rankings: sortedStudents.map(s => ({ name: s[0], score: s[1] }))
        });
    } catch (err) { console.error(err); res.status(500).json({ error: "Server Error" }); }
});

router.post('/session/:sessionId/ai-report', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await Session.findById(sessionId);
        const questions = await Question.find({ sessionId });
        const answers = await Answer.find({ questionId: { $in: questions.map(q => q._id) } });
        const focusLogs = await FocusLog.find({ sessionId });

        const sessionData = {
            duration: 3600, // Placeholder
            questions,
            answers,
            stats: { avgAccuracy: 75, avgFocus: 80 } // Simplified for demo
        };

        const analysis = await generateSessionAnalysis(sessionData);
        res.json({ success: true, analysis });

    } catch (err) { console.error(err); res.status(500).json({ error: "Analysis Failed" }); }
});

module.exports = router;
