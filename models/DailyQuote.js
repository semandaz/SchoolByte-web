const mongoose = require('mongoose');

const dailyQuoteSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true,
        trim: true
    },
    author: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        default: 'Motivation',
        trim: true
    },
    context: {
        type: String,
        default: '',
        trim: true
    },
    seenBy: {
        type: [mongoose.Schema.Types.ObjectId],
        default: [],
        ref: 'Student'
    },
    likedBy: {
        type: [mongoose.Schema.Types.ObjectId],
        default: [],
        ref: 'Student'
    },
    aiGenerated: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

dailyQuoteSchema.index({ seenBy: 1 });

module.exports = mongoose.model('DailyQuote', dailyQuoteSchema);
