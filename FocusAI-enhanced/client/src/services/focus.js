// d:\FocusAI\client\src\services\focus.js
import { socket } from './socket';

let focusInterval = null;
let focusState = {
    isTabActive: true,
    isFaceDetected: true, // specific face logic to be hooked in
    focusScore: 100
};

export const startFocusTracking = () => {
    // 1. Tab Visibility
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 2. Report Loop (every 5 seconds)
    focusInterval = setInterval(() => {
        reportFocus();
    }, 5000);
};

export const stopFocusTracking = () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    if (focusInterval) clearInterval(focusInterval);
};

export const updateFaceDetectionStatus = (detected) => {
    focusState.isFaceDetected = detected;
    // Immediate penalty or just aggregate?
    // For now, simple aggregation in the interval
};

const handleVisibilityChange = () => {
    focusState.isTabActive = !document.hidden;
    console.log("Visibility changed:", focusState.isTabActive);
    // Could send immediate alert if strict
};

const reportFocus = () => {
    // Calculate simple score
    // If tab is hidden, 0% focus. If face missing, 50% focus penalty.
    let score = 100;
    if (!focusState.isTabActive) score = 0;
    else if (!focusState.isFaceDetected) score = 50;

    focusState.focusScore = score;

    socket.emit('focus_update', {
        timestamp: Date.now(),
        isTabActive: focusState.isTabActive,
        isFaceDetected: focusState.isFaceDetected,
        score: score
    });
};
