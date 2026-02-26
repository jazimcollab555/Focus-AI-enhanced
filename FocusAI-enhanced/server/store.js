// server/store.js

// Global In-Memory Store for FocusAI Demo
// In production, this would be Redis/DB

module.exports = {
    // Map<socketId, { history: [], lastScore: number }>
    focusData: new Map(),

    // Map<socketId, { name: string, totalScore: number, answers: [] }>
    studentData: new Map(),

    // Current active question
    activeQuestion: null
};
