const mongoose = require('mongoose');

const discussionGroupSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    rules: { type: String, trim: true, default: '' },
    is_public: { type: Boolean, default: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    created_at: { type: Date, default: Date.now }
}, { timestamps: true });

discussionGroupSchema.index({ name: 'text', description: 'text' });
discussionGroupSchema.index({ is_public: 1 });

module.exports = mongoose.model('DiscussionGroup', discussionGroupSchema);
