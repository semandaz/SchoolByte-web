const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    serialNumber: { type: Number, unique: true, sparse: true },
    isCompulsory: { type: Boolean, default: false },
    applicableLevels: {
        type: [String],
        enum: ['O_Level_Lower', 'O_Level_Middle', 'A_Level'],
        default: []
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// name unique index is defined on the field above
subjectSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Subject', subjectSchema);
