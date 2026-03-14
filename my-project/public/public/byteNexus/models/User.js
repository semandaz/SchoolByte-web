
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  username: {
    type: String,
    required: true,
    trim: true
  },
  avatar_url: {
    type: String,
    default: function() {
      return `https://api.dicebear.com/7.x/initials/svg?seed=${this.username}`;
    }
  },
  bytes: {
    type: Number,
    default: 100,
    min: 0
  },
  // SchoolByte integration fields
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    sparse: true
  },
  class: {
    type: String,
    trim: true
  },
  stream: {
    type: String,
    trim: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toPublicJSON = function() {
  return {
    id: this._id.toString(),
    email: this.email,
    username: this.username,
    avatar_url: this.avatar_url,
    bytes: this.bytes,
    class: this.class,
    stream: this.stream,
    created_at: this.created_at
  };
};

const User = mongoose.model('User', userSchema);

export default User;
