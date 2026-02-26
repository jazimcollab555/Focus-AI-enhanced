const mongoose = require('mongoose');

// Default to local if no env var
const URI = process.env.MONGO_URI || 'mongodb://localhost:27017/focusai';

const connectDB = async () => {
    try {
        await mongoose.connect(URI);
        console.log('✅ MongoDB Connected');
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err);
        // Don't exit process, just log. 
        // In production, might want to retry.
    }
};

module.exports = connectDB;
