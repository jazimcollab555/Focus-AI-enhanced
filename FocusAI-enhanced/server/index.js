const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// DB Connection
const connectDB = require('./db');
connectDB();
const { Session, Student } = require('./models/Schemas');

// Routes
app.use('/api', require('./routes/api'));

// Globals
let currentSessionId = null;

// Initialize Session
const startServerSession = async () => {
    try {
        const sess = await Session.create({
            teacherId: 'default_teacher',
            startTime: new Date()
        });
        currentSessionId = sess._id;
        global.currentSessionId = sess._id;
        console.log('✅ New Session Started:', sess._id);
    } catch (e) { console.error("Session Init Error", e); }
};
startServerSession();

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const questionHandler = require('./socket/questionHandler');
const focusHandler = require('./socket/focusHandler');
const store = require('./store');

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Initialize handlers
    questionHandler(io, socket);
    focusHandler(io, socket);

    // Initial Count
    io.emit('user_count', store.studentData.size > 0 ? store.studentData.size : io.engine.clientsCount);
    socket.broadcast.emit('user_connected', socket.id);

    // --- MODULE 2.2: EVENT PIPELINE (JOIN) ---
    socket.on('join_class', async (data) => {
        // data: { name, role }
        console.log(`User Joined: ${data.name} (${data.role})`);

        if (data.role === 'STUDENT') {
            // 1. In-Memory Store (Live)
            store.studentData.set(socket.id, {
                name: data.name,
                totalScore: 0,
                answers: []
            });
            store.focusData.set(socket.id, { history: [], lastScore: 100 });

            // 2. Persistence (Module 2)
            if (currentSessionId) {
                try {
                    // Update/Create Persistent Student Profile
                    // Finding by name for demo purposes
                    let student = await Student.findOne({ name: data.name });
                    if (!student) {
                        student = await Student.create({ name: data.name });
                    }
                    if (!student.joinedSessions.includes(currentSessionId)) {
                        student.joinedSessions.push(currentSessionId);
                        await student.save();
                    }

                    // Log Attendance in Session
                    await Session.findByIdAndUpdate(currentSessionId, {
                        $inc: { totalStudentsJoined: 1 },
                        $push: {
                            attendanceLog: {
                                studentId: socket.id,
                                name: data.name,
                                action: 'JOIN'
                            }
                        }
                    });

                } catch (e) { console.error("Persistence Error (Join):", e); }
            }
        }

        io.emit('user_count', store.studentData.size);
    });

    // --- MODULE 2.2: EVENT PIPELINE (DISCONNECT) ---
    socket.on('disconnect', async () => {
        const student = store.studentData.get(socket.id);
        if (student && currentSessionId) {
            try {
                // Log Leave
                await Session.findByIdAndUpdate(currentSessionId, {
                    $push: {
                        attendanceLog: {
                            studentId: socket.id,
                            name: student.name,
                            action: 'LEAVE'
                        }
                    }
                });
            } catch (e) { console.error("Persistence Error (Leave):", e); }
        }

        console.log('User disconnected:', socket.id);
        store.studentData.delete(socket.id);
        store.focusData.delete(socket.id);

        io.emit('user_count', store.studentData.size > 0 ? store.studentData.size : io.engine.clientsCount);
        socket.broadcast.emit('user_disconnected', socket.id);
    });

    socket.on('signal', (data) => {
        io.to(data.target).emit('signal', {
            sender: socket.id,
            signal: data.signal
        });
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});
