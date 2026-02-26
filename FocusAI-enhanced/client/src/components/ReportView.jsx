import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ReportView = ({ sessionId, onClose }) => {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [aiResult, setAiResult] = useState(null);

    useEffect(() => {
        const fetchReport = async () => {
            try {
                // 1. Get Stats (Module 2)
                const res = await axios.get(`http://localhost:3000/api/session/${sessionId}/report`);
                setReport(res.data);

                // 2. Trigger AI Analysis (Module 4)
                const aiRes = await axios.post(`http://localhost:3000/api/session/${sessionId}/ai-report`);
                setAiResult(aiRes.data.analysis);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, [sessionId]);

    if (loading) return <div style={{ padding: '20px' }}>🧠 FocusAI Neural Engine is analyzing session data...</div>;
    if (!report) return <div>Error loading report.</div>;

    const { stats, session } = report;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'white', padding: '40px', overflowY: 'auto', zIndex: 1000 }}>
            <button onClick={onClose} style={{ float: 'right', padding: '10px' }}>Close Report</button>

            <h1 style={{ color: '#2d3748' }}>📝 Session Intelligence Report</h1>
            <p style={{ color: '#718096' }}>ID: {sessionId} • {new Date(session.startTime).toLocaleString()}</p>

            {/* MODULE 2 SUMMARY */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
                <div style={{ background: '#ebf8ff', padding: '20px', borderRadius: '10px', flex: 1, textAlign: 'center' }}>
                    <h3>Accuracy</h3>
                    <div style={{ fontSize: '2em', color: '#3182ce' }}>{stats.avgAccuracy}%</div>
                </div>
                <div style={{ background: '#f0fff4', padding: '20px', borderRadius: '10px', flex: 1, textAlign: 'center' }}>
                    <h3>Avg Focus</h3>
                    <div style={{ fontSize: '2em', color: '#38a169' }}>{stats.avgFocus}%</div>
                </div>
                <div style={{ background: '#fff5f5', padding: '20px', borderRadius: '10px', flex: 1, textAlign: 'center' }}>
                    <h3>Engagement</h3>
                    <div style={{ fontSize: '2em', color: '#e53e3e' }}>{stats.totalAnswers} Ans</div>
                </div>
            </div>

            {/* MODULE 4 AI INSIGHTS */}
            {aiResult && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>

                    {/* 4.1 LECTURE SUMMARY */}
                    <div style={{ background: '#f7fafc', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ marginTop: 0, borderBottom: '2px solid #cbd5e0', paddingBottom: '10px' }}>🤖 AI Executive Summary</h3>
                        <p style={{ lineHeight: '1.6', fontSize: '1.1em' }}>{aiResult.summary}</p>

                        <h4 style={{ marginBottom: '10px', marginTop: '20px' }}>💡 Teacher Recommendations</h4>
                        <ul style={{ paddingLeft: '20px' }}>
                            {aiResult.recommendations.map((rec, i) => (
                                <li key={i} style={{ marginBottom: '8px' }}>{rec}</li>
                            ))}
                        </ul>
                    </div>

                    {/* 4.2 GAP ANALYSIS & 4.3 REVISION */}
                    <div>
                        <div style={{ background: '#fffaf0', padding: '25px', borderRadius: '12px', border: '1px solid #ed8936', marginBottom: '20px' }}>
                            <h3 style={{ marginTop: 0, color: '#c05621' }}>⚠️ Knowledge Gaps</h3>
                            {aiResult.gaps.length === 0 ? <p>No significant gaps detected!</p> : (
                                <ul style={{ paddingLeft: '20px' }}>
                                    {aiResult.gaps.map((gap, i) => (
                                        <li key={i} style={{ marginBottom: '10px' }}>
                                            <strong>{gap.topic}</strong> <span style={{ color: 'red' }}>({gap.accuracy})</span>
                                            <br /><small>{gap.insight}</small>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div style={{ background: '#f0fff4', padding: '25px', borderRadius: '12px', border: '1px solid #48bb78' }}>
                            <h3 style={{ marginTop: 0, color: '#276749' }}>📚 Revision Notes (Auto-Generated)</h3>
                            <ul style={{ paddingLeft: '20px' }}>
                                {aiResult.revision_notes.map((note, i) => (
                                    <li key={i} style={{ marginBottom: '8px', fontStyle: 'italic' }}>{note}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ marginTop: '50px', textAlign: 'center', color: '#cbd5e0' }}>
                Generated by FocusAI Cortex (Module 4)
            </div>
        </div>
    );
};

export default ReportView;
