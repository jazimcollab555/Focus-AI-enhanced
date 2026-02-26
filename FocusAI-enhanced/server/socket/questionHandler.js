// server/socket/questionHandler.js
const store = require('../store');
const { Question, Answer } = require('../models/Schemas');

module.exports = (io, socket) => {
    // Teacher pushes a question
    socket.on('push_question', async (data) => {
        console.log('Question Pushed:', data);

        const startTime = Date.now();
        const endTime = startTime + (data.timerDuration * 1000);

        // Persist Question
        // Assuming global.currentSessionId exists
        let dbQuestion = null;
        if (global.currentSessionId) {
            try {
                dbQuestion = await Question.create({
                    sessionId: global.currentSessionId,
                    text: data.questionText,
                    type: data.type,
                    timerDuration: data.timerDuration,
                    correctAnswer: data.correctAnswer
                });
            } catch (err) {
                console.error("DB Error saving question:", err);
            }
        }

        store.activeQuestion = {
            ...data,
            dbId: dbQuestion ? dbQuestion._id : null,
            startTime,
            endTime,
            answers: []
        };

        // Broadcast to all students
        io.emit('new_question', {
            ...data,
            startTime,
            endTime
        });
    });

    // Student submits answer
    socket.on('submit_answer', async (data) => {
        // data: { questionId, answer, submitTime }
        if (!store.activeQuestion) return;

        // 1. Accuracy (50%)
        const isCorrect = store.activeQuestion.correctAnswer
            ? data.answer.trim().toLowerCase() === store.activeQuestion.correctAnswer.trim().toLowerCase()
            : false;

        const accuracyScore = isCorrect ? 50 : 0;

        // 2. Speed (30%)
        // Linear decay: Max 30 points at 0s delay, 0 points at max duration
        const timeTaken = (data.submitTime - store.activeQuestion.startTime) / 1000;
        const duration = store.activeQuestion.timerDuration;
        const speedScore = isCorrect ? Math.max(0, 30 * (1 - (timeTaken / duration))) : 0;

        // 3. Focus (20%)
        // Get last known focus score (0-100) -> Converted to 0-20
        const focusEntry = store.focusData.get(socket.id);
        const currentFocus = focusEntry ? focusEntry.lastScore : 100; // Default to 100 if unknown
        const focusPoints = (currentFocus / 100) * 20;

        // Total
        const totalPoints = Math.round(accuracyScore + speedScore + focusPoints);

        const breakdown = { accuracy: accuracyScore, speed: speedScore, focus: focusPoints };

        // Persist Answer
        if (global.currentSessionId && store.activeQuestion.dbId) {
            try {
                Answer.create({
                    questionId: store.activeQuestion.dbId,
                    studentId: socket.id,
                    answer: data.answer,
                    isCorrect,
                    points: totalPoints,
                    stats: breakdown
                });
            } catch (err) {
                console.error("DB Error saving answer:", err);
            }
        }

        // Update Student Global Score
        let student = store.studentData.get(socket.id);
        if (!student) {
            student = { name: `Student ${socket.id.substr(0, 4)}`, totalScore: 0, answers: [] };
            store.studentData.set(socket.id, student);
        }
        student.totalScore += totalPoints;

        // Store Answer Record (In-Memory)
        store.activeQuestion.answers.push({
            studentId: socket.id,
            answer: data.answer,
            isCorrect,
            points: totalPoints,
            breakdown
        });

        // Ack to Student
        socket.emit('answer_result', {
            correct: isCorrect,
            points: totalPoints,
            message: isCorrect ? `Correct! +${totalPoints}` : `Wrong. +${Math.round(focusPoints)} (Focus)`,
            totalScore: student.totalScore
        });

        // Update Teacher Stats
        io.emit('teacher_update', {
            totalAnswers: store.activeQuestion.answers.length,
            lastAnswer: { studentId: socket.id, isCorrect, points: totalPoints }
        });

        // Broadcast Leaderboard (Top 5)
        const leaderboard = Array.from(store.studentData.entries())
            .map(([id, s]) => ({ id, name: s.name, score: Math.round(s.totalScore) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        io.emit('leaderboard_update', leaderboard);
    });
};
