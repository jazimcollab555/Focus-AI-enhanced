import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../services/socket';
import SimplePeer from 'simple-peer';
import { startFocusTracking, stopFocusTracking, updateFaceDetectionStatus } from '../services/focus';

const StudentView = () => {
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [timer, setTimer] = useState(0);
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState(null);
    const [myScore, setMyScore] = useState(0);
    const [answerText, setAnswerText] = useState('');
    const [leaderboard, setLeaderboard] = useState([]);
    const [myRank, setMyRank] = useState(null);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [prevScores, setPrevScores] = useState({});
    const [myName, setMyName] = useState('');
    const [animatingPoints, setAnimatingPoints] = useState(null);

    const teacherVideoRef = useRef();
    const myVideoRef = useRef();
    const activePeer = useRef(null);

    useEffect(() => {
        // Inject styles
        const style = document.createElement('style');
        style.id = 'focusai-student-styles';
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,700;0,9..40,900&family=Space+Mono:wght@700&display=swap');
            body { font-family: 'DM Sans', sans-serif !important; margin: 0; }
            @keyframes slideUp { from { opacity:0; transform:translate(-50%, 30px); } to { opacity:1; transform:translate(-50%, 0); } }
            @keyframes slideInFeedback { from { opacity:0; transform:translate(-50%, -20px); } to { opacity:1; transform:translate(-50%, 0); } }
            @keyframes leaderboardIn { from { opacity:0; transform:translateX(100%); } to { opacity:1; transform:translateX(0); } }
            @keyframes pointsPop { 0% { opacity:0; transform:translateY(0) scale(0.5); } 50% { opacity:1; transform:translateY(-30px) scale(1.3); } 100% { opacity:0; transform:translateY(-60px) scale(1); } }
            @keyframes rankBounce { 0%,100% { transform:scale(1); } 40% { transform:scale(1.25); } 70% { transform:scale(0.95); } }
            @keyframes rowFadeIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
            @keyframes timerPulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.05); } }
            @keyframes correctFlash { 0%,100% { box-shadow:0 0 0 0 rgba(72,187,120,0); } 50% { box-shadow:0 0 30px 10px rgba(72,187,120,0.3); } }
            ::-webkit-scrollbar { width:3px; } ::-webkit-scrollbar-thumb { background:#2d3748; border-radius:2px; }
            .mcq-btn:hover { border-color: #667eea !important; background: rgba(102,126,234,0.1) !important; transform: translateY(-2px); }
            .mcq-btn:active { transform: scale(0.97); }
        `;
        if (!document.getElementById('focusai-student-styles')) document.head.appendChild(style);

        // Try to recover name from sessionStorage
        const storedName = sessionStorage.getItem('focusai_name') || '';
        setMyName(storedName);

        if (!socket.connected) socket.connect();
        startFocusTracking();

        socket.on('new_question', (data) => {
            setCurrentQuestion(data);
            setSubmitted(false);
            setResult(null);
            setAnswerText('');
            setShowLeaderboard(false);
            const remaining = Math.ceil((data.endTime - Date.now()) / 1000);
            setTimer(remaining > 0 ? remaining : 0);
        });

        socket.on('answer_result', (data) => {
            setResult(data);
            if (data.totalScore !== undefined) {
                setMyScore(data.totalScore);
                if (data.points > 0) {
                    setAnimatingPoints(data.points);
                    setTimeout(() => setAnimatingPoints(null), 1500);
                }
            }
            // Show leaderboard after answering
            setTimeout(() => setShowLeaderboard(true), 800);
        });

        socket.on('leaderboard_update', (lb) => {
            // Track score changes for animations
            const newPrev = {};
            lb.forEach(s => { newPrev[s.id] = s.score; });
            setPrevScores(newPrev);
            setLeaderboard(lb);

            // Find my rank
            const mySocketId = socket.id;
            const myEntry = lb.find(s => s.id === mySocketId);
            if (myEntry) setMyRank(lb.indexOf(myEntry) + 1);
        });

        socket.on('signal', (data) => {
            if (!activePeer.current) {
                const peer = new SimplePeer({ initiator: false, trickle: false });
                peer.on('signal', signal => socket.emit('signal', { target: data.sender, signal }));
                peer.on('stream', stream => { if (teacherVideoRef.current) teacherVideoRef.current.srcObject = stream; });
                activePeer.current = peer;
            }
            activePeer.current.signal(data.signal);
        });

        navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(stream => {
            if (myVideoRef.current) myVideoRef.current.srcObject = stream;
            const interval = setInterval(() => updateFaceDetectionStatus(true), 1000);
            return () => clearInterval(interval);
        }).catch(err => console.warn("Cam Error:", err));

        return () => {
            stopFocusTracking();
            ['new_question','answer_result','leaderboard_update','signal'].forEach(e => socket.off(e));
            if (activePeer.current) activePeer.current.destroy();
            const el = document.getElementById('focusai-student-styles');
            if (el) el.remove();
        };
    }, []);

    useEffect(() => {
        if (timer > 0) {
            const i = setInterval(() => setTimer(t => t - 1), 1000);
            return () => clearInterval(i);
        }
    }, [timer]);

    const handleSubmit = (val) => {
        if (submitted || timer <= 0) return;
        const finalAns = val || answerText;
        if (!finalAns) return;
        socket.emit('submit_answer', { questionId: currentQuestion.timestamp, answer: finalAns, submitTime: Date.now() });
        setAnswerText(finalAns);
        setSubmitted(true);
    };

    const getRankEmoji = (rank) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `#${rank}`;
    };

    const timerPercent = currentQuestion ? (timer / currentQuestion.timerDuration) * 100 : 100;
    const timerColor = timer < 5 ? '#fc8181' : timer < 10 ? '#f6ad55' : '#63b3ed';

    return (
        <div style={{ height: '100vh', background: '#0d0f15', color: 'white', display: 'flex', overflow: 'hidden', fontFamily: "'DM Sans', sans-serif" }}>

            {/* ====== MAIN VIDEO AREA ====== */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080a0f' }}>
                <video ref={teacherVideoRef} autoPlay playsInline style={{ maxHeight: '100%', maxWidth: '100%', width: '100%', height: '100%', objectFit: 'contain' }} />
                {!activePeer.current && (
                    <div style={{ position: 'absolute', color: '#2d3748', textAlign: 'center' }}>
                        <div style={{ fontSize: '3em', marginBottom: '10px' }}>📡</div>
                        <div style={{ fontSize: '0.9em' }}>Waiting for teacher's video feed...</div>
                    </div>
                )}

                {/* ===== QUESTION POPUP ===== */}
                {currentQuestion && timer > 0 && !submitted && (
                    <div style={{
                        position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
                        background: 'rgba(15, 17, 23, 0.97)', backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '28px 32px', borderRadius: '22px', width: '90%', maxWidth: '580px',
                        boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
                        animation: 'slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        animation: timer === currentQuestion.timerDuration ? 'correctFlash 0.5s ease' : undefined
                    }}>
                        {/* Timer bar */}
                        <div style={{ height: '3px', background: '#1e2533', borderRadius: '3px', marginBottom: '18px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: `linear-gradient(90deg, ${timerColor}, ${timerColor}cc)`, width: `${timerPercent}%`, transition: 'width 1s linear, background 0.5s', borderRadius: '3px' }} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', gap: '16px' }}>
                            <div>
                                <div style={{ fontSize: '0.68em', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#4a5568', marginBottom: '6px', fontWeight: 700 }}>Pop Quiz</div>
                                <h2 style={{ margin: 0, fontSize: '1.25em', color: '#f7fafc', fontWeight: 700, lineHeight: 1.3 }}>{currentQuestion.questionText}</h2>
                            </div>
                            {/* Timer circle */}
                            <div style={{
                                width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0,
                                background: `conic-gradient(${timerColor} ${timerPercent * 3.6}deg, #1e2533 0deg)`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                animation: timer <= 5 ? 'timerPulse 0.5s infinite' : 'none'
                            }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#0d0f15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: '1em', fontWeight: 900, color: timerColor, fontFamily: "'Space Mono', monospace" }}>{timer}</span>
                                </div>
                            </div>
                        </div>

                        {currentQuestion.type === 'MCQ' ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                {currentQuestion.options.map((opt, i) => (
                                    <button key={i} onClick={() => handleSubmit(opt)} className="mcq-btn" style={{
                                        padding: '14px 16px', border: '1.5px solid #2d3748', borderRadius: '12px',
                                        background: 'rgba(255,255,255,0.03)', color: '#e2e8f0',
                                        fontSize: '1em', cursor: 'pointer', transition: 'all 0.2s',
                                        fontWeight: 600, textAlign: 'left', fontFamily: "'DM Sans', sans-serif"
                                    }}>
                                        <span style={{ color: '#4a5568', marginRight: '8px', fontSize: '0.85em' }}>
                                            {String.fromCharCode(65 + i)}.
                                        </span>
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input autoFocus placeholder="Type your answer..."
                                    value={answerText} onChange={e => setAnswerText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                                    style={{ flex: 1, padding: '14px 16px', borderRadius: '12px', border: '1.5px solid #2d3748', background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: '1em', outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
                                <button onClick={() => handleSubmit()} style={{
                                    padding: '0 24px', background: 'linear-gradient(135deg, #2b6cb0, #3182ce)', color: 'white',
                                    border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif"
                                }}>Submit</button>
                            </div>
                        )}
                    </div>
                )}

                {/* ===== FEEDBACK BANNER ===== */}
                {(result || (submitted && !result)) && (
                    <div style={{
                        position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
                        padding: '13px 26px', borderRadius: '50px',
                        background: result ? (result.correct ? 'linear-gradient(135deg,#276749,#38a169)' : 'linear-gradient(135deg,#9b2c2c,#c53030)') : 'linear-gradient(135deg,#744210,#c05621)',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.4)', fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: '10px',
                        animation: 'slideInFeedback 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        whiteSpace: 'nowrap'
                    }}>
                        {result ? (
                            <>
                                <span style={{ fontSize: '1.4em' }}>{result.correct ? '🎉' : '❌'}</span>
                                <div>
                                    <div style={{ fontSize: '0.95em' }}>{result.message}</div>
                                    <div style={{ fontSize: '0.72em', opacity: 0.85 }}>Total: {myScore} pts{myRank ? ` · Rank ${getRankEmoji(myRank)}` : ''}</div>
                                </div>
                            </>
                        ) : (
                            <><span>⏳</span><span style={{ fontSize: '0.9em' }}>Submitted! Waiting for results...</span></>
                        )}
                    </div>
                )}

                {/* Points pop animation */}
                {animatingPoints && (
                    <div style={{
                        position: 'absolute', top: '80px', left: '50%', transform: 'translateX(-50%)',
                        color: '#68d391', fontWeight: 900, fontSize: '1.8em',
                        animation: 'pointsPop 1.5s ease-out forwards',
                        pointerEvents: 'none', fontFamily: "'Space Mono', monospace",
                        textShadow: '0 0 20px rgba(104,211,145,0.6)'
                    }}>
                        +{animatingPoints}
                    </div>
                )}
            </div>

            {/* ====== RIGHT SIDEBAR ====== */}
            <div style={{ width: '270px', background: '#111318', borderLeft: '1px solid #1e2533', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Score */}
                <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid #1e2533' }}>
                    <div style={{ fontSize: '0.65em', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, marginBottom: '4px' }}>Your Score</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{ fontSize: '2.2em', fontWeight: 900, color: '#f7fafc', fontFamily: "'Space Mono', monospace", lineHeight: 1 }}>{myScore}</span>
                        <span style={{ fontSize: '0.75em', color: '#63b3ed', fontWeight: 700 }}>PTS</span>
                        {myRank && (
                            <span style={{ marginLeft: 'auto', fontSize: '1.2em', animation: 'rankBounce 0.5s ease' }}>{getRankEmoji(myRank)}</span>
                        )}
                    </div>
                </div>

                {/* Focus cam */}
                <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e2533' }}>
                    <div style={{ fontSize: '0.65em', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Focus Analyzer</span>
                        <span style={{ color: '#68d391' }}>● Active</span>
                    </div>
                    <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', aspectRatio: '4/3', background: '#0d0f15', border: '1px solid #1e2533' }}>
                        <video ref={myVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }} />
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '5px 8px', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', fontSize: '0.65em', color: '#718096', textAlign: 'center' }}>
                            👁 Tracking focus...
                        </div>
                    </div>
                    <div style={{ fontSize: '0.68em', color: '#4a5568', marginTop: '7px', lineHeight: 1.5 }}>
                        Stay in frame & keep this tab active for max focus score.
                    </div>
                </div>

                {/* Leaderboard */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 14px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.65em', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>🏆 Leaderboard</div>
                        {leaderboard.length > 0 && (
                            <div style={{ fontSize: '0.65em', color: '#718096' }}>{leaderboard.length} players</div>
                        )}
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 12px' }}>
                        {leaderboard.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#4a5568', fontSize: '0.78em', padding: '20px 10px' }}>
                                No scores yet. Answer a question to appear!
                            </div>
                        ) : leaderboard.map((s, i) => {
                            const isMe = s.id === socket.id;
                            const rankColors = ['#d69e2e', '#718096', '#b7791f'];
                            return (
                                <div key={s.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '9px 10px', borderRadius: '10px', marginBottom: '5px',
                                    background: isMe
                                        ? 'rgba(99,179,237,0.12)'
                                        : i === 0 ? 'rgba(237,189,0,0.07)' : '#1a1e2a',
                                    border: `1px solid ${isMe ? 'rgba(99,179,237,0.35)' : i === 0 ? 'rgba(237,189,0,0.25)' : '#1e2533'}`,
                                    animation: `rowFadeIn 0.3s ease-out ${i * 0.05}s both`,
                                    transition: 'all 0.3s ease'
                                }}>
                                    <div style={{
                                        width: '24px', height: '24px', borderRadius: '50%',
                                        background: i < 3 ? rankColors[i] : '#1e2533',
                                        color: i < 3 ? 'white' : '#4a5568',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.72em', fontWeight: 900, flexShrink: 0
                                    }}>{i + 1}</div>
                                    <div style={{ flex: 1, fontSize: '0.82em', fontWeight: isMe ? 700 : 500, color: isMe ? '#90cdf4' : '#cbd5e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {s.name}{isMe ? ' (you)' : ''}
                                    </div>
                                    <div style={{ fontSize: '0.82em', fontWeight: 900, color: i === 0 ? '#f6e05e' : isMe ? '#63b3ed' : '#718096', fontFamily: "'Space Mono', monospace", flexShrink: 0 }}>
                                        {s.score}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentView;
