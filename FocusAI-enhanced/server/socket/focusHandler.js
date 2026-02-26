// server/socket/focusHandler.js
const store = require('../store');
const { FocusLog } = require('../models/Schemas');
const ONE_MINUTE = 60 * 1000;

module.exports = (io, socket) => {
    socket.on('focus_update', async (data) => {
        let studentData = store.focusData.get(socket.id) || { history: [], lastScore: 100 };
        studentData.lastScore = data.score;
        studentData.history.push({ time: Date.now(), score: data.score });

        const tenMinsAgo = Date.now() - (10 * ONE_MINUTE);
        studentData.history = studentData.history.filter(h => h.time > tenMinsAgo);

        store.focusData.set(socket.id, studentData);

        // Determine distraction cause
        const cause = !data.isTabActive ? "Tab Switch" : (!data.isFaceDetected ? "No Face" : null);

        // Get student name from studentData store
        const studentInfo = store.studentData.get(socket.id);
        const studentName = studentInfo ? studentInfo.name : `Student ${socket.id.substr(0, 4)}`;

        if (data.score < 50) {
            io.emit('distracted_student', {
                studentId: socket.id,
                studentName: studentName,
                score: data.score,
                cause: cause || "Unknown"
            });
        }

        // Broadcast live class focus snapshot for heatmap (every update)
        const classFocusSnapshot = Array.from(store.studentData.entries()).map(([id, s]) => {
            const fd = store.focusData.get(id);
            return {
                studentId: id,
                name: s.name,
                score: fd ? fd.lastScore : 100,
                isTabActive: fd ? (fd.lastScore > 0) : true
            };
        });
        io.emit('class_focus_snapshot', classFocusSnapshot);

        // Persist to DB (Sampled or All?)
        // Writing every 5s per student is heavy for Mongo. 
        // In prototype, maybe write if status changes or periodically.
        // Let's write ALL for "Detailed Analytics" requirement.
        if (global.currentSessionId) {
            try {
                await FocusLog.create({
                    sessionId: global.currentSessionId,
                    studentId: socket.id,
                    score: data.score,
                    isTabActive: data.isTabActive,
                    isFaceDetected: data.isFaceDetected
                });
            } catch (err) {
                // console.error(err); // suppress spam
            }
        }
    });

    socket.on('disconnect', () => {
        store.focusData.delete(socket.id);
    });
};
