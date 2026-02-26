import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../services/socket';
import SimplePeer from 'simple-peer';
import { startListening, stopListening } from '../services/voice';
import axios from 'axios';
import ReportView from './ReportView';

const CLASS_STATE = { LECTURE: 'LECTURE', QUESTION_ACTIVE: 'QUESTION_ACTIVE', DISCUSSION: 'DISCUSSION' };

// ===================== FOCUS HEATMAP =====================
const FocusHeatmap = ({ students }) => {
    if (!students || students.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: '#4a5568' }}>
                <div style={{ fontSize: '2em', marginBottom: '8px' }}>👥</div>
                <div style={{ fontSize: '0.8em' }}>Waiting for students to join...</div>
            </div>
        );
    }
    const getColors = (score) => {
        if (score >= 80) return { bg: 'rgba(56,161,105,0.15)', border: '#2f855a', text: '#68d391' };
        if (score >= 50) return { bg: 'rgba(237,137,54,0.15)', border: '#c05621', text: '#f6ad55' };
        return { bg: 'rgba(229,62,62,0.15)', border: '#c53030', text: '#fc8181' };
    };
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(82px, 1fr))', gap: '7px' }}>
            {students.map(s => {
                const c = getColors(s.score);
                return (
                    <div key={s.studentId} style={{
                        background: c.bg, border: `1px solid ${c.border}`, borderRadius: '10px',
                        padding: '8px 5px', textAlign: 'center', transition: 'all 0.4s ease',
                        animation: s.score < 50 ? 'pulseAlert 1.5s infinite' : 'none'
                    }}>
                        <div style={{ fontSize: '1.2em', marginBottom: '3px' }}>
                            {s.score >= 80 ? '😊' : s.score >= 50 ? '😐' : '😴'}
                        </div>
                        <div style={{ fontSize: '0.68em', color: c.text, fontWeight: 700, lineHeight: 1.2, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '72px' }}>
                            {s.name.split(' ')[0]}
                        </div>
                        <div style={{ fontSize: '0.82em', color: c.text, fontWeight: 900 }}>{s.score}%</div>
                    </div>
                );
            })}
        </div>
    );
};

// ===================== DISTRACTION ALERTS =====================
const DistractionAlerts = ({ alerts }) => (
    <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '270px', pointerEvents: 'none' }}>
        {alerts.map(a => (
            <div key={a.id} style={{
                background: '#1a0a0a', border: '1px solid #e53e3e', borderLeft: '4px solid #e53e3e',
                borderRadius: '10px', padding: '12px 14px',
                boxShadow: '0 4px 20px rgba(229,62,62,0.25)',
                animation: 'slideInRight 0.3s ease-out'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
                    <span>⚠️</span>
                    <strong style={{ color: '#fc8181', fontSize: '0.88em' }}>{a.studentName}</strong>
                </div>
                <div style={{ color: '#feb2b2', fontSize: '0.75em' }}>
                    Focus: <strong>{a.score}%</strong> · {a.cause}
                </div>
            </div>
        ))}
    </div>
);

// ===================== QUEUE BUILDER (Drag & Drop) =====================
const QueueBuilder = ({ queue, setQueue, onLoadAndPush }) => {
    const [dragIdx, setDragIdx] = useState(null);
    const [addMode, setAddMode] = useState(false);
    const [newQ, setNewQ] = useState({ text: '', mode: 'MCQ', options: ['', '', '', ''], correct: '', duration: 10 });

    const handleDragStart = i => setDragIdx(i);
    const handleDragOver = (e, i) => {
        e.preventDefault();
        if (dragIdx === null || dragIdx === i) return;
        const arr = [...queue];
        const [item] = arr.splice(dragIdx, 1);
        arr.splice(i, 0, item);
        setQueue(arr);
        setDragIdx(i);
    };

    const addQuestion = () => {
        if (!newQ.text.trim() || !newQ.correct.trim()) return alert('Please fill question text and correct answer.');
        setQueue(p => [...p, { ...newQ }]);
        setNewQ({ text: '', mode: 'MCQ', options: ['', '', '', ''], correct: '', duration: 10 });
        setAddMode(false);
    };

    const iStyle = { width: '100%', padding: '7px 9px', borderRadius: '6px', border: '1px solid #2d3748', background: '#0f1117', color: '#e2e8f0', fontSize: '0.83em', marginBottom: '5px', boxSizing: 'border-box', outline: 'none' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ fontSize: '0.72em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#718096' }}>
                    Question Queue <span style={{ background: '#2d3748', borderRadius: '8px', padding: '2px 7px', fontWeight: 900, color: '#a0aec0' }}>{queue.length}</span>
                </div>
                <button onClick={() => setAddMode(!addMode)} style={{
                    background: addMode ? '#742a2a' : '#1a365d', color: addMode ? '#fc8181' : '#90cdf4',
                    border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '0.75em', fontWeight: 700, cursor: 'pointer'
                }}>{addMode ? '✕ Cancel' : '＋ Add'}</button>
            </div>

            {addMode && (
                <div style={{ background: '#0f1117', border: '1px solid #2d3748', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
                    <textarea placeholder="Question text..." value={newQ.text} onChange={e => setNewQ(p => ({ ...p, text: e.target.value }))}
                        style={{ ...iStyle, height: '55px', resize: 'none' }} />
                    <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                        <select value={newQ.mode} onChange={e => setNewQ(p => ({ ...p, mode: e.target.value }))} style={{ ...iStyle, width: 'auto', marginBottom: 0, flex: 1 }}>
                            <option value="MCQ">MCQ</option>
                            <option value="MANUAL">Manual</option>
                        </select>
                        <select value={newQ.duration} onChange={e => setNewQ(p => ({ ...p, duration: Number(e.target.value) }))} style={{ ...iStyle, width: '60px', marginBottom: 0 }}>
                            <option value={10}>10s</option><option value={20}>20s</option><option value={30}>30s</option>
                        </select>
                    </div>
                    {newQ.mode === 'MCQ' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '5px' }}>
                            {newQ.options.map((o, i) => (
                                <input key={i} placeholder={`Option ${i+1}`} value={o}
                                    onChange={e => { const arr=[...newQ.options]; arr[i]=e.target.value; setNewQ(p=>({...p,options:arr})); }}
                                    style={{ ...iStyle, marginBottom: 0 }} />
                            ))}
                        </div>
                    )}
                    <input placeholder="✓ Correct answer" value={newQ.correct} onChange={e => setNewQ(p => ({...p, correct: e.target.value}))}
                        style={{ ...iStyle, borderColor: '#2f855a', background: 'rgba(56,161,105,0.05)', color: '#68d391' }} />
                    <button onClick={addQuestion} style={{ width: '100%', padding: '7px', background: '#276749', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.83em' }}>
                        ✓ Add to Queue
                    </button>
                </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {queue.length === 0 && !addMode && (
                    <div style={{ textAlign: 'center', color: '#4a5568', fontSize: '0.78em', padding: '24px 10px' }}>
                        <div style={{ fontSize: '1.5em', marginBottom: '5px' }}>📭</div>
                        Queue is empty. Use ＋ Add above.
                    </div>
                )}
                {queue.map((q, i) => (
                    <div key={i} draggable onDragStart={() => handleDragStart(i)} onDragOver={e => handleDragOver(e, i)} onDragEnd={() => setDragIdx(null)}
                        style={{
                            background: dragIdx === i ? '#2a3a4a' : '#1a202c',
                            border: '1px solid #2d3748', borderRadius: '8px', padding: '9px 10px',
                            cursor: 'grab', opacity: dragIdx === i ? 0.6 : 1, transition: 'all 0.15s',
                            display: 'flex', gap: '8px', alignItems: 'flex-start'
                        }}
                    >
                        <span style={{ color: '#4a5568', fontSize: '0.9em', paddingTop: '2px', userSelect: 'none' }}>⠿</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.62em', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#1a365d', color: '#90cdf4' }}>{q.mode}</span>
                                <span style={{ fontSize: '0.62em', color: '#718096', padding: '2px 0' }}>{q.duration}s</span>
                            </div>
                            <div style={{ fontSize: '0.78em', color: '#cbd5e0', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                {q.text}
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flexShrink: 0 }}>
                            <button onClick={() => onLoadAndPush(q, i)} title="Load & Push" style={{ background: '#1a365d', color: '#63b3ed', border: 'none', borderRadius: '5px', padding: '3px 8px', fontSize: '0.7em', cursor: 'pointer', fontWeight: 700 }}>▶</button>
                            <button onClick={() => setQueue(p => p.filter((_, j) => j !== i))} title="Remove" style={{ background: '#2d1515', color: '#fc8181', border: 'none', borderRadius: '5px', padding: '3px 8px', fontSize: '0.7em', cursor: 'pointer' }}>✕</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ===================== LEADERBOARD =====================
const Leaderboard = ({ leaderboard }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {leaderboard.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#4a5568', fontSize: '0.8em', padding: '20px' }}>
                <div style={{ fontSize: '1.5em', marginBottom: '5px' }}>🏆</div>
                No scores yet...
            </div>
        ) : leaderboard.map((s, i) => (
            <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                borderRadius: '10px', border: `1px solid ${i === 0 ? 'rgba(237,189,0,0.35)' : '#2d3748'}`,
                background: i === 0 ? 'rgba(237,189,0,0.07)' : '#1a202c',
                animation: 'fadeInUp 0.3s ease-out'
            }}>
                <div style={{
                    width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, fontSize: '0.78em', flexShrink: 0,
                    background: i === 0 ? '#d69e2e' : i === 1 ? '#718096' : i === 2 ? '#b7791f' : '#2d3748',
                    color: i < 3 ? 'white' : '#718096'
                }}>{i + 1}</div>
                <div style={{ flex: 1, fontSize: '0.85em', fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                <div style={{ fontWeight: 900, fontSize: '0.9em', color: i === 0 ? '#f6e05e' : '#63b3ed', fontVariantNumeric: 'tabular-nums' }}>{s.score}</div>
            </div>
        ))}
    </div>
);

// ===================== MAIN TEACHER PANEL =====================
const TeacherPanel = () => {
    const [classState, setClassState] = useState(CLASS_STATE.LECTURE);
    const [queue, setQueue] = useState([
        { text: "What is the capital of France?", mode: "MCQ", options: ["Paris", "London", "Berlin", "Rome"], correct: "Paris", duration: 10 },
        { text: "Define 'Polymorphism' in one word.", mode: "MANUAL", correct: "Shape-shifting", duration: 20 },
        { text: "Which data structure uses LIFO order?", mode: "MCQ", options: ["Queue", "Stack", "Array", "Heap"], correct: "Stack", duration: 15 },
    ]);
    const [questionText, setQuestionText] = useState('');
    const [answerMode, setAnswerMode] = useState('MCQ');
    const [options, setOptions] = useState(['', '', '', '']);
    const [correctAnswer, setCorrectAnswer] = useState('');
    const [timerDuration, setTimerDuration] = useState(10);
    const [liveStats, setLiveStats] = useState(null);
    const [userCount, setUserCount] = useState(0);
    const [distractionAlerts, setDistractionAlerts] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [classFocus, setClassFocus] = useState([]);
    const [isVoiceActive, setIsVoiceActive] = useState(false);
    const [lastVoiceCmd, setLastVoiceCmd] = useState(null);
    const [topicFinishedToast, setTopicFinishedToast] = useState(null); // { transcript, questionText }
    const [showReport, setShowReport] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [rightTab, setRightTab] = useState('heatmap');

    const userVideoRef = useRef();
    const peersRef = useRef([]);
    const recognitionRef = useRef(null);
    // Refs to always read latest state inside voice callback (closure-safe)
    const questionTextRef = useRef('');
    const timerDurationRef = useRef(10);
    const answerModeRef = useRef('MCQ');
    const optionsRef = useRef(['', '', '', '']);
    const correctAnswerRef = useRef('');

    useEffect(() => {
        // Inject styles
        const style = document.createElement('style');
        style.id = 'focusai-teacher-styles';
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;0,9..40,900&family=Space+Mono:wght@700&display=swap');
            body { font-family: 'DM Sans', sans-serif !important; }
            @keyframes slideInRight { from { opacity:0; transform:translateX(50px); } to { opacity:1; transform:translateX(0); } }
            @keyframes pulseAlert { 0%,100% { box-shadow:0 0 0 0 rgba(229,62,62,0.4); } 50% { box-shadow:0 0 0 8px rgba(229,62,62,0); } }
            @keyframes fadeInUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
            @keyframes glow { 0%,100% { box-shadow:0 0 8px rgba(104,211,145,0.4); } 50% { box-shadow:0 0 20px rgba(104,211,145,0.7); } }
            @keyframes voiceArmed { 0%,100% { box-shadow:0 0 0 0 rgba(246,173,85,0); } 50% { box-shadow:0 0 0 6px rgba(246,173,85,0.25); } }
            @keyframes topicToastIn { from { opacity:0; transform:translateY(-20px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
            @keyframes topicToastOut { from { opacity:1; transform:translateY(0) scale(1); } to { opacity:0; transform:translateY(-10px) scale(0.97); } }
            @keyframes micBreath { 0%,100% { transform:scale(1); } 50% { transform:scale(1.08); } }
            ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #2d3748; border-radius: 2px; }
        `;
        if (!document.getElementById('focusai-teacher-styles')) document.head.appendChild(style);
        return () => { const el = document.getElementById('focusai-teacher-styles'); if(el) el.remove(); };
    }, []);

    useEffect(() => {
        axios.get('http://localhost:3000/api/session/current')
            .then(res => setActiveSessionId(res.data.sessionId))
            .catch(() => {});

        socket.on('user_count', setUserCount);
        socket.on('teacher_live_status', setLiveStats);
        socket.on('teacher_update', setLiveStats);
        socket.on('leaderboard_update', setLeaderboard);
        socket.on('class_focus_snapshot', setClassFocus);

        socket.on('distracted_student', (d) => {
            const id = `${d.studentId}-${Date.now()}`;
            setDistractionAlerts(prev => [{ ...d, id }, ...prev].slice(0, 4));
            setTimeout(() => setDistractionAlerts(prev => prev.filter(a => a.id !== id)), 5000);
        });

        socket.on('user_connected', (id) => {
            if (userVideoRef.current?.srcObject) callUser(id, userVideoRef.current.srcObject);
        });
        socket.on('signal', d => {
            const p = peersRef.current.find(x => x.peerID === d.sender);
            if (p) p.peer.signal(d.signal);
        });

        return () => {
            ['user_count','teacher_live_status','teacher_update','leaderboard_update','class_focus_snapshot','distracted_student','user_connected','signal'].forEach(e => socket.off(e));
            if (recognitionRef.current) stopListening(recognitionRef.current);
        };
    }, []);

    const toggleVoice = () => {
        if (isVoiceActive) { stopListening(recognitionRef.current); setIsVoiceActive(false); setLastVoiceCmd(null); }
        else {
            recognitionRef.current = startListening(data => handleVoiceCommand(data), s => { if(s==='ERROR') setIsVoiceActive(false); });
            setIsVoiceActive(true);
        }
    };

    // Keep refs in sync so voice callback always reads latest values
    useEffect(() => { questionTextRef.current = questionText; }, [questionText]);
    useEffect(() => { timerDurationRef.current = timerDuration; }, [timerDuration]);
    useEffect(() => { answerModeRef.current = answerMode; }, [answerMode]);
    useEffect(() => { optionsRef.current = options; }, [options]);
    useEffect(() => { correctAnswerRef.current = correctAnswer; }, [correctAnswer]);

    const handleVoiceCommand = ({ command, transcript }) => {
        if (command === 'UNKNOWN') { setLastVoiceCmd({ transcript: `?? "${transcript}"`, status: 'UNKNOWN' }); return; }

        // 🆕 TOPIC_FINISHED: auto-push the loaded question to students
        if (command === 'TOPIC_FINISHED') {
            const currentQ = questionTextRef.current;
            if (!currentQ) {
                setLastVoiceCmd({ transcript: '⚠️ No question loaded!', status: 'WARN' });
                return;
            }
            // Push the question using ref values (closure-safe)
            const payload = {
                questionText: currentQ,
                mode: answerModeRef.current,
                options: answerModeRef.current === 'MCQ' ? optionsRef.current : [],
                correctAnswer: correctAnswerRef.current,
                timerDuration: timerDurationRef.current
            };
            socket.emit('push_question', payload);
            setClassState(CLASS_STATE.QUESTION_ACTIVE);
            setTimeout(() => setClassState(CLASS_STATE.DISCUSSION), payload.timerDuration * 1000 + 1000);

            // Show the special "topic finished" toast
            const toastId = Date.now();
            setTopicFinishedToast({ id: toastId, transcript, questionText: currentQ });
            setTimeout(() => setTopicFinishedToast(t => t?.id === toastId ? null : t), 5000);

            setLastVoiceCmd({ transcript: `🎯 TOPIC FINISHED → Question pushed!`, status: 'MATCH' });
            return;
        }

        setLastVoiceCmd({ transcript: `✅ ${command}`, status: 'MATCH' });
        if (command === 'PUSH_QUESTION') handlePushQuestion();
        else if (command === 'NEXT_QUESTION') loadNextFromQueue();
        else if (command === 'STOP_TIMER') setClassState(CLASS_STATE.DISCUSSION);
        else if (command === 'SET_10S') setTimerDuration(10);
        else if (command === 'SET_20S') setTimerDuration(20);
        else if (command === 'SET_30S') setTimerDuration(30);
    };

    const loadQuestion = (q) => {
        setQuestionText(q.text); setAnswerMode(q.mode);
        if (q.mode === 'MCQ') setOptions(q.options || ['','','','']);
        setCorrectAnswer(q.correct); setTimerDuration(q.duration || 10);
    };

    const loadNextFromQueue = () => {
        if (queue.length === 0) return alert("Queue Empty!");
        const [next, ...rest] = queue;
        setQueue(rest); loadQuestion(next); handlePushQuestion(next);
    };

    const handleLoadAndPush = (q, i) => {
        loadQuestion(q);
        setQueue(p => p.filter((_, j) => j !== i));
        handlePushQuestion(q);
    };

    const startBroadcasting = () => {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(s => { if (userVideoRef.current) userVideoRef.current.srcObject = s; });
    };

    const callUser = (id, s) => {
        const p = new SimplePeer({ initiator: true, trickle: false, stream: s });
        p.on('signal', sig => socket.emit('signal', { target: id, signal: sig }));
        peersRef.current.push({ peerID: id, peer: p });
    };

    const handlePushQuestion = (fd = null) => {
        const qText = fd ? fd.text : questionText;
        if (!qText) return alert("No question text!");
        const payload = {
            questionText: qText,
            mode: fd ? fd.mode : answerMode,
            options: fd?.mode === 'MCQ' ? fd.options : (answerMode === 'MCQ' ? options : []),
            correctAnswer: fd ? fd.correct : correctAnswer,
            timerDuration: fd ? fd.duration : timerDuration
        };
        socket.emit('push_question', payload);
        setClassState(CLASS_STATE.QUESTION_ACTIVE);
        setTimeout(() => setClassState(CLASS_STATE.DISCUSSION), payload.timerDuration * 1000 + 1000);
    };

    const handleEndSession = () => { if (confirm("End class and generate AI report?")) setShowReport(true); };

    if (showReport && activeSessionId) return <ReportView sessionId={activeSessionId} onClose={() => setShowReport(false)} />;

    const isActive = classState === CLASS_STATE.QUESTION_ACTIVE;
    const avgFocus = classFocus.length > 0 ? Math.round(classFocus.reduce((a, s) => a + s.score, 0) / classFocus.length) : null;
    const distracted = classFocus.filter(s => s.score < 50).length;

    const inputBase = { padding: '11px 14px', borderRadius: '9px', border: '1px solid #2d3748', background: '#0f1117', color: '#e2e8f0', fontSize: '0.9em', outline: 'none', boxSizing: 'border-box' };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr 290px', height: '100vh', background: '#0d0f15', color: '#e2e8f0', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden' }}>
            <DistractionAlerts alerts={distractionAlerts} />

            {/* ====== LEFT: QUEUE + STATS ====== */}
            <div style={{ background: '#111318', borderRight: '1px solid #1e2533', display: 'flex', flexDirection: 'column', padding: '16px', gap: '10px', overflow: 'hidden' }}>
                {/* Logo */}
                <div style={{ marginBottom: '4px' }}>
                    <div style={{ fontSize: '0.6em', fontWeight: 700, letterSpacing: '0.2em', color: '#4a5568', textTransform: 'uppercase' }}>FocusAI</div>
                    <div style={{ fontSize: '1.05em', fontWeight: 700, color: '#e2e8f0' }}>Teacher Console</div>
                </div>

                {/* Quick Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px' }}>
                    {[
                        { label: 'Students', value: userCount, color: '#63b3ed' },
                        { label: 'Avg Focus', value: avgFocus !== null ? avgFocus + '%' : '–', color: avgFocus >= 70 ? '#68d391' : avgFocus >= 50 ? '#f6ad55' : '#fc8181' },
                    ].map(stat => (
                        <div key={stat.label} style={{ background: '#1a1e2a', borderRadius: '8px', padding: '10px', textAlign: 'center', border: '1px solid #1e2533' }}>
                            <div style={{ fontSize: '1.4em', fontWeight: 900, color: stat.color, fontFamily: "'Space Mono', monospace" }}>{stat.value}</div>
                            <div style={{ fontSize: '0.65em', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stat.label}</div>
                        </div>
                    ))}
                </div>
                {distracted > 0 && (
                    <div style={{ background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.4)', borderRadius: '8px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', animation: 'pulseAlert 2s infinite' }}>
                        <span style={{ fontSize: '1.1em' }}>⚠️</span>
                        <div>
                            <div style={{ fontSize: '0.8em', fontWeight: 700, color: '#fc8181' }}>{distracted} student{distracted > 1 ? 's' : ''} distracted</div>
                            <div style={{ fontSize: '0.68em', color: '#c53030' }}>Check focus heatmap →</div>
                        </div>
                    </div>
                )}

                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <QueueBuilder queue={queue} setQueue={setQueue} onLoadAndPush={handleLoadAndPush} />
                </div>
            </div>

            {/* ====== CENTER: QUESTION + CONTROLS ====== */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: '#111318', borderBottom: '1px solid #1e2533', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '9px', height: '9px', borderRadius: '50%',
                            background: isActive ? '#68d391' : '#4a5568',
                            boxShadow: isActive ? '0 0 10px #68d391' : 'none',
                            animation: isActive ? 'glow 1.5s infinite' : 'none'
                        }} />
                        <span style={{ fontSize: '0.82em', color: '#718096', fontWeight: 500 }}>
                            {isActive ? '🟢 Question Live' : classState === CLASS_STATE.DISCUSSION ? '💬 Discussion' : '📖 Lecture'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>

                        {/* 🆕 Topic Finished Toast — shown when voice triggers auto-push */}
                        {topicFinishedToast && (
                            <div style={{
                                position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)',
                                zIndex: 9998,
                                background: 'linear-gradient(135deg, #1a3a1a, #2f6e2f)',
                                border: '1px solid #38a169', borderRadius: '14px',
                                padding: '14px 22px',
                                boxShadow: '0 8px 30px rgba(56,161,105,0.35)',
                                animation: 'topicToastIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
                                display: 'flex', alignItems: 'center', gap: '12px',
                                maxWidth: '480px'
                            }}>
                                <span style={{ fontSize: '1.8em' }}>🎯</span>
                                <div>
                                    <div style={{ fontWeight: 700, color: '#68d391', fontSize: '0.92em', marginBottom: '2px' }}>
                                        Topic finished detected — question pushed live!
                                    </div>
                                    <div style={{ fontSize: '0.75em', color: '#9ae6b4', opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '340px' }}>
                                        "{topicFinishedToast.questionText}"
                                    </div>
                                </div>
                                <button onClick={() => setTopicFinishedToast(null)}
                                    style={{ background: 'transparent', border: 'none', color: '#68d391', cursor: 'pointer', fontSize: '1em', marginLeft: '4px', opacity: 0.6 }}>✕</button>
                            </div>
                        )}

                        {/* Last voice command badge */}
                        {lastVoiceCmd && (
                            <div style={{ padding: '5px 11px', borderRadius: '20px', fontSize: '0.78em', fontWeight: 700,
                                background: lastVoiceCmd.status === 'MATCH' ? 'rgba(72,187,120,0.15)' : lastVoiceCmd.status === 'WARN' ? 'rgba(246,173,85,0.15)' : 'rgba(245,101,101,0.15)',
                                color: lastVoiceCmd.status === 'MATCH' ? '#68d391' : lastVoiceCmd.status === 'WARN' ? '#f6ad55' : '#fc8181',
                                border: `1px solid ${lastVoiceCmd.status === 'MATCH' ? '#2f855a' : lastVoiceCmd.status === 'WARN' ? '#c05621' : '#c53030'}`
                            }}>{lastVoiceCmd.transcript}</div>
                        )}

                        {/* 🆕 Voice button with "armed" state label */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <button onClick={toggleVoice} style={{
                                background: isVoiceActive ? '#c53030' : '#1e2533', color: 'white', border: 'none',
                                padding: '7px', borderRadius: '50%', width: '34px', height: '34px', cursor: 'pointer',
                                boxShadow: isVoiceActive ? '0 0 14px rgba(229,62,62,0.6)' : 'none',
                                animation: isVoiceActive ? 'micBreath 2s infinite' : 'none',
                                transition: 'all 0.2s', fontSize: '0.9em'
                            }}>🎤</button>
                            {isVoiceActive && (
                                <div style={{ fontSize: '0.58em', color: '#f6ad55', fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.04em', animation: 'voiceArmed 2s infinite' }}>
                                    ARMED
                                </div>
                            )}
                        </div>

                        <button onClick={handleEndSession} style={{ background: 'linear-gradient(135deg, #9b2c2c, #c53030)', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82em' }}>
                            🛑 End &amp; Report
                        </button>
                    </div>
                </div>

                {/* Question Builder */}
                <div style={{ margin: '14px', background: '#111318', borderRadius: '14px', border: '1px solid #1e2533', padding: '18px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ fontSize: '0.7em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4a5568' }}>✏️ Active Question</div>
                        {/* 🆕 Voice commands hint — always visible when mic is active */}
                        {isVoiceActive && (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                {[
                                    { phrase: '"topic finished"', desc: 'push question', color: '#f6ad55', bg: 'rgba(246,173,85,0.12)', border: 'rgba(246,173,85,0.35)' },
                                    { phrase: '"push question"', desc: 'manual push', color: '#63b3ed', bg: 'rgba(99,179,237,0.1)', border: 'rgba(99,179,237,0.3)' },
                                    { phrase: '"next question"', desc: 'load from queue', color: '#9f7aea', bg: 'rgba(159,122,234,0.1)', border: 'rgba(159,122,234,0.3)' },
                                ].map(v => (
                                    <div key={v.phrase} style={{ padding: '3px 9px', borderRadius: '8px', background: v.bg, border: `1px solid ${v.border}`, fontSize: '0.68em', color: v.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                        {v.phrase} <span style={{ opacity: 0.6 }}>→ {v.desc}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                        <input style={{ ...inputBase, flex: 1 }} value={questionText} onChange={e => setQuestionText(e.target.value)} placeholder="Type or load a question..." />
                        <select value={answerMode} onChange={e => setAnswerMode(e.target.value)} style={{ ...inputBase, cursor: 'pointer' }}>
                            <option value="MCQ">MCQ</option>
                            <option value="MANUAL">Manual</option>
                        </select>
                        <select value={timerDuration} onChange={e => setTimerDuration(Number(e.target.value))} style={{ ...inputBase, width: '70px', cursor: 'pointer' }}>
                            <option value={10}>10s</option><option value={20}>20s</option><option value={30}>30s</option>
                        </select>
                    </div>

                    {answerMode === 'MCQ' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px', marginBottom: '10px' }}>
                            {options.map((o, i) => (
                                <input key={i} placeholder={`Option ${i+1}`} value={o}
                                    onChange={e => { const arr=[...options]; arr[i]=e.target.value; setOptions(arr); }}
                                    style={{ ...inputBase, fontSize: '0.83em', padding: '9px 12px' }} />
                            ))}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input placeholder="Correct answer..." value={correctAnswer} onChange={e => setCorrectAnswer(e.target.value)}
                            style={{ ...inputBase, flex: 1, borderColor: '#276749', background: 'rgba(56,161,105,0.07)', color: '#68d391' }} />
                        <button onClick={() => handlePushQuestion()} style={{
                            background: 'linear-gradient(135deg, #1a4b8c, #2b6cb0)', color: 'white', border: 'none',
                            padding: '0 22px', borderRadius: '9px', fontWeight: 700, fontSize: '0.9em', cursor: 'pointer', transition: 'all 0.2s'
                        }}>🚀 Push Live</button>
                        <button onClick={loadNextFromQueue} style={{ ...inputBase, background: '#1a1e2a', color: '#718096', cursor: 'pointer', fontWeight: 700, fontSize: '0.83em', border: '1px solid #2d3748' }}>⏭ Next</button>
                    </div>
                </div>

                {/* Live Stats */}
                {liveStats && (
                    <div style={{ margin: '0 14px', background: '#111318', borderRadius: '12px', border: '1px solid #1e2533', padding: '14px' }}>
                        <div style={{ fontSize: '0.7em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4a5568', marginBottom: '10px' }}>📊 Live Results</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                            <div>
                                <span style={{ fontSize: '1.5em', fontWeight: 900, color: '#63b3ed', fontFamily: "'Space Mono', monospace" }}>
                                    {liveStats.totalAnswers || liveStats.answeredCount || 0}
                                </span>
                                <span style={{ color: '#4a5568', fontSize: '0.85em' }}> / {userCount} answered</span>
                            </div>
                            {liveStats.lastAnswer && (
                                <div style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '0.8em', fontWeight: 700,
                                    background: liveStats.lastAnswer.isCorrect ? 'rgba(56,161,105,0.15)' : 'rgba(229,62,62,0.15)',
                                    color: liveStats.lastAnswer.isCorrect ? '#68d391' : '#fc8181',
                                    border: `1px solid ${liveStats.lastAnswer.isCorrect ? '#2f855a' : '#c53030'}`
                                }}>
                                    {liveStats.lastAnswer.isCorrect ? '✓' : '✗'} Last: +{liveStats.lastAnswer.points} pts
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ====== RIGHT: HEATMAP + LEADERBOARD ====== */}
            <div style={{ background: '#111318', borderLeft: '1px solid #1e2533', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Camera */}
                <div style={{ position: 'relative', background: '#080a0f', margin: '12px 12px 8px', borderRadius: '12px', overflow: 'hidden', aspectRatio: '16/9', flexShrink: 0, border: '1px solid #1e2533' }}>
                    <video ref={userVideoRef} autoPlay muted style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {!userVideoRef.current?.srcObject && <div style={{ color: '#2d3748', fontSize: '0.8em' }}>No camera feed</div>}
                    </div>
                    <button onClick={startBroadcasting} style={{ position: 'absolute', bottom: '7px', right: '7px', background: 'rgba(0,0,0,0.65)', color: '#a0aec0', border: '1px solid #2d3748', borderRadius: '6px', padding: '3px 9px', fontSize: '0.68em', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
                        📹 Start Cam
                    </button>
                </div>

                {/* Tab buttons */}
                <div style={{ display: 'flex', gap: '3px', margin: '0 12px 8px', background: '#0d0f15', borderRadius: '8px', padding: '3px' }}>
                    {[['heatmap', '🌡 Focus Map'], ['leaderboard', '🏆 Rankings']].map(([key, label]) => (
                        <button key={key} onClick={() => setRightTab(key)} style={{
                            flex: 1, padding: '7px 4px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                            fontWeight: 700, fontSize: '0.75em', transition: 'all 0.2s', fontFamily: "'DM Sans', sans-serif",
                            background: rightTab === key ? '#1e2533' : 'transparent',
                            color: rightTab === key ? '#e2e8f0' : '#4a5568'
                        }}>{label}</button>
                    ))}
                </div>

                {/* Tab content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
                    {rightTab === 'heatmap' ? <FocusHeatmap students={classFocus} /> : <Leaderboard leaderboard={leaderboard} />}
                </div>
            </div>
        </div>
    );
};

export default TeacherPanel;
