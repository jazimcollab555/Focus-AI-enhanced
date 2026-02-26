const { GoogleGenerativeAI } = require("@google/generative-ai");

// Module 4.6: AI PROMPT ENGINEERING & CONTROL
// Strictly structured inputs, deterministic output request.

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "YOUR_API_KEY");

const model = genAI.getGenerativeModel({ model: "gemini-pro" });

async function generateSessionAnalysis(sessionData) {
    // sessionData: { questions: [], answers: [], focusStats: {}, duration: number }

    // 1. Construct Structured Context (Module 4.1 Input)
    const context = {
        meta: {
            durationMinutes: Math.round(sessionData.duration / 60),
            totalQuestions: sessionData.questions.length,
            participationRate: sessionData.stats.avgAccuracy + "% (proxy for active)",
            averageFocus: sessionData.stats.avgFocus + "%"
        },
        topicPerformance: sessionData.questions.map(q => {
            const qAnswers = sessionData.answers.filter(a => a.questionId.toString() === q._id.toString());
            const correctCount = qAnswers.filter(a => a.isCorrect).length;
            const accuracy = qAnswers.length ? Math.round((correctCount / qAnswers.length) * 100) : 0;
            return {
                topic: q.text, // Assuming question text implies topic for now
                type: q.mode,
                accuracy: accuracy + "%",
                avgResponseTime: "N/A" // Simplified
            };
        })
    };

    // 2. The Prompt (Module 4.1 - 4.5)
    // We request JSON strictly.
    const prompt = `
    You are FocusAI, an advanced educational analytics engine. 
    Analyze the following classroom session data and provide a structured JSON report.
    
    DATA CONTEXT:
    ${JSON.stringify(context, null, 2)}

    REQUIREMENTS:
    1. **Lecture Summary (Module 4.1)**: 2-3 sentences summarizing the session performance and engagement.
    2. **Knowledge Gaps (Module 4.2)**: Identify topics (questions) with low accuracy (< 50%) and explain potential misconceptions.
    3. **Revision Notes (Module 4.3)**: Generate 3 bullet points of key facts based on the questions asked.
    4. **Recommendations (Module 4.5)**: Suggest 2 actionable steps for the teacher based on the data (e.g., "Review topic X", "Take a break").

    OUTPUT FORMAT (JSON ONLY):
    {
        "summary": "string",
        "gaps": [ { "topic": "string", "accuracy": "string", "insight": "string" } ],
        "revision_notes": [ "string" ],
        "recommendations": [ "string" ]
    }
    Do not include markdown filtering like \`\`\`json. Just the raw JSON string.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim(); // Clean cleanup
        return JSON.parse(text);
    } catch (error) {
        console.error("Gemini Error:", error);
        return {
            summary: "AI Analysis failed or timed out.",
            gaps: [],
            revision_notes: ["Check server logs."],
            recommendations: ["Review raw data manually."]
        };
    }
}

module.exports = { generateSessionAnalysis };
