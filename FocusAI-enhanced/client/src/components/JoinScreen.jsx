import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../services/socket';

const JoinScreen = () => {
    const navigate = useNavigate();
    const [role, setRole] = useState(null); // null, 'STUDENT', 'TEACHER'
    const [name, setName] = useState('');
    const [roomCode, setRoomCode] = useState('101'); // Default for demo
    const [isConnecting, setIsConnecting] = useState(false);

    const handleJoin = async () => {
        if (!name.trim()) return alert("Please enter your name.");
        setIsConnecting(true);

        try {
            // 1. Connect if needed
            if (!socket.connected) socket.connect();

            // 2. Wait for connection helper
            const waitForConnect = new Promise((resolve, reject) => {
                if (socket.connected) return resolve();
                const timeout = setTimeout(() => reject("Connection Timeout"), 5000);
                socket.once('connect', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });

            await waitForConnect;

            // 3. Emit Join
            socket.emit('join_class', { name, role: role, roomCode }); // roomCode is extra metadata for now

            // 4. Navigate
            if (role === 'TEACHER') navigate('/teacher');
            else navigate('/student');

        } catch (err) {
            alert("Failed to connect: " + err);
            setIsConnecting(false);
        }
    };

    // --- RENDER HELPERS ---
    const containerStyle = {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1A365D 0%, #2D3748 100%)',
        fontFamily: "'Inter', sans-serif",
        color: 'white',
        padding: '20px'
    };

    const cardStyle = {
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '24px',
        padding: '40px',
        width: '100%',
        maxWidth: '480px',
        textAlign: 'center',
        boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
    };

    const inputStyle = {
        width: '100%',
        padding: '16px',
        borderRadius: '12px',
        border: 'none',
        background: 'rgba(255,255,255,0.9)',
        marginBottom: '15px',
        fontSize: '1em',
        outline: 'none'
    };

    const btnStyle = {
        width: '100%',
        padding: '16px',
        borderRadius: '12px',
        border: 'none',
        fontSize: '1.1em',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'transform 0.1s'
    };

    // --- VIEW: ROLE SELECTION ---
    if (!role) {
        return (
            <div style={containerStyle}>
                <h1 style={{ fontSize: '3em', marginBottom: '10px', fontWeight: 800, background: 'linear-gradient(to right, #63b3ed, #4299e1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>FocusAI</h1>
                <p style={{ marginBottom: '40px', fontSize: '1.2em', opacity: 0.8 }}>Intelligent Classroom Experience</p>

                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: '800px' }}>
                    {/* STUDENT BUTTON */}
                    <div onClick={() => setRole('STUDENT')} style={{ ...cardStyle, flex: 1, cursor: 'pointer', minWidth: '280px', transition: 'transform 0.2s', ':hover': { transform: 'scale(1.05)' } }}>
                        <div style={{ fontSize: '4em', marginBottom: '20px' }}>🎓</div>
                        <h2>I am a Student</h2>
                        <p style={{ opacity: 0.7 }}>Join a session, answer questions, and track your focus.</p>
                    </div>

                    {/* TEACHER BUTTON */}
                    <div onClick={() => setRole('TEACHER')} style={{ ...cardStyle, flex: 1, cursor: 'pointer', minWidth: '280px', border: '1px solid rgba(255,215,0,0.3)' }}>
                        <div style={{ fontSize: '4em', marginBottom: '20px' }}>👨‍🏫</div>
                        <h2>I am a Teacher</h2>
                        <p style={{ opacity: 0.7 }}>Host a class, manage questions, and view AI analytics.</p>
                    </div>
                </div>
            </div>
        );
    }

    // --- VIEW: FORM ---
    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <button onClick={() => setRole(null)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2em' }}>← Back</button>
                    <div style={{ fontWeight: 'bold', color: role === 'TEACHER' ? '#FBD38D' : '#90CDF4' }}>{role} MODE</div>
                </div>

                <h2 style={{ marginBottom: '30px' }}>
                    {role === 'TEACHER' ? 'Host New Session' : 'Enter Classroom'}
                </h2>

                <div>
                    <input
                        placeholder={role === 'TEACHER' ? "Enter Your Name (e.g. Prof. Smith)" : "Enter Your Name (e.g. Alex)"}
                        value={name}
                        onChange={e => setName(e.target.value)}
                        style={inputStyle}
                        autoFocus
                    />

                    {role === 'STUDENT' && (
                        <input
                            placeholder="Room Code (Default: 101)"
                            value={roomCode}
                            onChange={e => setRoomCode(e.target.value)}
                            style={inputStyle}
                        />
                    )}

                    <button
                        onClick={handleJoin}
                        disabled={isConnecting}
                        style={{
                            ...btnStyle,
                            background: role === 'TEACHER' ? 'linear-gradient(to right, #D69E2E, #ECC94B)' : 'linear-gradient(to right, #3182CE, #63B3ED)',
                            color: role === 'TEACHER' ? '#1A202C' : 'white',
                            marginTop: '10px',
                            opacity: isConnecting ? 0.7 : 1
                        }}
                    >
                        {isConnecting ? 'Connecting...' : (role === 'TEACHER' ? 'Start Class 🚀' : 'Join Class 🚀')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JoinScreen;
