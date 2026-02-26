// client/src/services/voice.js

const COMMANDS = {
    PUSH_QUESTION:   ['start question', 'push question', 'send question', 'ask question'],
    NEXT_QUESTION:   ['next question', 'next'],
    STOP_TIMER:      ['stop', 'stop timer', 'end question'],
    SET_10S:         ['ten seconds', '10 seconds'],
    SET_20S:         ['twenty seconds', '20 seconds'],
    SET_30S:         ['thirty seconds', '30 seconds'],

    // 🆕 "Topic finished" — teacher says any of these and the loaded question
    // is automatically pushed live to students
    TOPIC_FINISHED: [
        'topic finished',
        'topic is finished',
        'topic done',
        'topic is done',
        'that\'s the end',
        "that's the end",
        'end of topic',
        'end topic',
        'finished the topic',
        'done with this topic',
        'done with the topic',
        'moving on',
        'now for a question',
        'time for a question',
        'question time',
        'lets do a quiz',
        "let's do a quiz",
        'quiz time',
        'pop quiz',
        'test your knowledge',
    ]
};

export const isVoiceSupported = () =>
    'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

export const startListening = (onCommandMatch, onStatusChange) => {
    if (!isVoiceSupported()) return null;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous     = true;
    recognition.interimResults = false;
    recognition.lang           = 'en-US';

    recognition.onstart  = () => { if (onStatusChange) onStatusChange('LISTENING'); };
    recognition.onend    = () => { if (onStatusChange) onStatusChange('STOPPED'); };
    recognition.onerror  = (e) => { console.error('Voice Error:', e.error); if (onStatusChange) onStatusChange('ERROR'); };

    recognition.onresult = (event) => {
        const last       = event.results.length - 1;
        const transcript = event.results[last][0].transcript.trim().toLowerCase();
        const confidence = event.results[last][0].confidence;
        console.log('Voice Heard:', transcript, '| Confidence:', confidence);

        let matchedCommand = null;

        // Priority order — TOPIC_FINISHED checked first so "topic finished" beats "stop"
        if      (COMMANDS.TOPIC_FINISHED.some(c => transcript.includes(c))) matchedCommand = 'TOPIC_FINISHED';
        else if (COMMANDS.PUSH_QUESTION .some(c => transcript.includes(c))) matchedCommand = 'PUSH_QUESTION';
        else if (COMMANDS.NEXT_QUESTION .some(c => transcript.includes(c))) matchedCommand = 'NEXT_QUESTION';
        else if (COMMANDS.STOP_TIMER    .some(c => transcript.includes(c))) matchedCommand = 'STOP_TIMER';
        else if (COMMANDS.SET_10S       .some(c => transcript.includes(c))) matchedCommand = 'SET_10S';
        else if (COMMANDS.SET_20S       .some(c => transcript.includes(c))) matchedCommand = 'SET_20S';
        else if (COMMANDS.SET_30S       .some(c => transcript.includes(c))) matchedCommand = 'SET_30S';

        onCommandMatch({ command: matchedCommand || 'UNKNOWN', transcript, confidence });
    };

    recognition.start();
    return recognition;
};

export const stopListening = (recognition) => {
    if (recognition) recognition.stop();
};
