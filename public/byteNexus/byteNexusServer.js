
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import {
  User,
  PersonalMessage,
  GroupMessage,
  DiscussionGroup,
  GroupMember,
  Team
} from './models/index.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bytenexus';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is not set!');
  console.error('Please set a secure JWT_SECRET in your environment variables.');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

mongoose.connection.on('error', err => {
  console.error('MongoDB error:', err);
});

app.use(cors());
app.use(express.json());

const authenticatedSockets = new Map();

async function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).lean();

    if (!user) {
      return null;
    }

    return {
      id: user._id.toString(),
      email: user.email,
      username: user.username,
      avatar_url: user.avatar_url,
      bytes: user.bytes
    };
  } catch (error) {
    console.error('JWT Token verification error:', error.message);
    return null;
  }
}

async function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.substring(7);
  const user = await verifyToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }

  req.userId = user.id;
  req.user = user;
  next();
}

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Authentication token required'));
  }

  const user = await verifyToken(token);

  if (!user) {
    return next(new Error('Invalid authentication token'));
  }

  socket.userId = user.id;
  socket.userEmail = user.email;
  socket.username = user.username;
  socket.userBytes = user.bytes;
  next();
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId} (${socket.username})`);
  authenticatedSockets.set(socket.userId, socket);

  socket.on('join_personal_room', ({ conversationId }) => {
    const userIds = conversationId.split('_');
    if (!userIds.includes(socket.userId)) {
      socket.emit('error', { message: 'Unauthorized to join this conversation' });
      return;
    }
    socket.join(`personal_${conversationId}`);
    console.log(`User ${socket.userId} joined personal room: ${conversationId}`);
  });

  socket.on('join_group_room', async ({ groupId }) => {
    try {
      const membership = await GroupMember.findOne({
        group_id: groupId,
        user_id: socket.userId
      });

      if (!membership) {
        socket.emit('error', { message: 'Not a member of this group' });
        return;
      }

      socket.join(`group_${groupId}`);
      console.log(`User ${socket.userId} joined group room: ${groupId}`);
    } catch (error) {
      console.error('Error joining group room:', error);
      socket.emit('error', { message: 'Failed to join group' });
    }
  });

  socket.on('send_personal_message', async (data) => {
    try {
      const { recipientId, content, tempId } = data;

      const newMessage = new PersonalMessage({
        sender_id: socket.userId,
        recipient_id: recipientId,
        content: content,
        read: false
      });

      await newMessage.save();

      const messageWithSender = await PersonalMessage.findById(newMessage._id)
        .populate('sender_id', 'username avatar_url')
        .populate('recipient_id', 'username avatar_url')
        .lean();

      const formattedMessage = {
        _id: messageWithSender._id.toString(),
        id: messageWithSender._id.toString(),
        sender_id: messageWithSender.sender_id._id.toString(),
        recipient_id: messageWithSender.recipient_id._id.toString(),
        content: messageWithSender.content,
        read: messageWithSender.read,
        created_at: messageWithSender.created_at,
        tempId: tempId,
        sender: {
          id: messageWithSender.sender_id._id.toString(),
          username: messageWithSender.sender_id.username,
          avatar_url: messageWithSender.sender_id.avatar_url
        },
        recipient: {
          id: messageWithSender.recipient_id._id.toString(),
          username: messageWithSender.recipient_id.username,
          avatar_url: messageWithSender.recipient_id.avatar_url
        }
      };

      const conversationId = [socket.userId, recipientId].sort().join('_');
      
      // Send confirmation to sender
      socket.emit('message_sent_confirmation', {
        tempId: tempId,
        messageId: formattedMessage._id,
        status: 'sent'
      });

      // Broadcast to conversation room
      io.to(`personal_${conversationId}`).emit('new_personal_message', formattedMessage);

      // Check if recipient is online
      const recipientSocket = authenticatedSockets.get(recipientId);
      if (recipientSocket) {
        // Recipient is online - mark as delivered
        socket.emit('message_status_update', {
          messageId: formattedMessage._id,
          status: 'delivered'
        });

        recipientSocket.emit('new_message_notification', {
          type: 'personal',
          senderId: socket.userId,
          conversationId: conversationId,
          content: content,
          messageId: formattedMessage._id
        });
      }
    } catch (error) {
      console.error('Error sending personal message:', error);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });

  socket.on('mark_message_read', async (data) => {
    try {
      const { messageId } = data;

      await PersonalMessage.updateOne(
        { _id: messageId, recipient_id: socket.userId },
        { read: true }
      );

      // Find the sender and notify them
      const message = await PersonalMessage.findById(messageId).lean();
      if (message) {
        const senderSocket = authenticatedSockets.get(message.sender_id.toString());
        if (senderSocket) {
          senderSocket.emit('message_read_receipt', {
            messageId: messageId
          });
        }
      }

      socket.emit('message_marked_read', { messageId });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  });

  socket.on('send_group_message', async (data) => {
    try {
      const { groupId, content, hasLatex, isBoosted, byteCost } = data;

      const membership = await GroupMember.findOne({
        group_id: groupId,
        user_id: socket.userId
      });

      if (!membership) {
        socket.emit('message_error', { error: 'Not a member of this group' });
        return;
      }

      if (isBoosted && byteCost > 0) {
        const updatedUser = await User.findOneAndUpdate(
          { 
            _id: socket.userId,
            bytes: { $gte: byteCost }
          },
          { $inc: { bytes: -byteCost } },
          { new: true }
        );

        if (!updatedUser) {
          const currentUser = await User.findById(socket.userId).select('bytes').lean();
          const currentBalance = currentUser ? currentUser.bytes : 0;
          socket.emit('message_error', { 
            error: `Insufficient bytes. Requires ${byteCost} bytes, but you only have ${currentBalance}.` 
          });
          return;
        }

        socket.userBytes = updatedUser.bytes;

        socket.emit('bytes_updated', { 
          newBalance: updatedUser.bytes,
          deducted: byteCost
        });

        console.log(`[BYTE BOOST] User ${socket.username} spent ${byteCost} bytes on a boosted message in group ${groupId}`);
      }

      const newMessage = new GroupMessage({
        group_id: groupId,
        sender_id: socket.userId,
        content: content,
        has_latex: hasLatex || false,
        is_flagged: false,
        is_boosted: isBoosted || false,
        boost_cost: byteCost || 0
      });

      await newMessage.save();

      const messageWithSender = await GroupMessage.findById(newMessage._id)
        .populate('sender_id', 'username avatar_url')
        .lean();

      const formattedMessage = {
        id: messageWithSender._id.toString(),
        group_id: messageWithSender.group_id.toString(),
        sender_id: messageWithSender.sender_id._id.toString(),
        content: messageWithSender.content,
        has_latex: messageWithSender.has_latex,
        is_flagged: messageWithSender.is_flagged,
        is_boosted: messageWithSender.is_boosted,
        boost_cost: messageWithSender.boost_cost,
        created_at: messageWithSender.created_at,
        sender: {
          id: messageWithSender.sender_id._id.toString(),
          username: messageWithSender.sender_id.username,
          avatar_url: messageWithSender.sender_id.avatar_url
        }
      };

      io.to(`group_${groupId}`).emit('new_group_message', formattedMessage);
    } catch (error) {
      console.error('Error sending group message:', error);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });

  socket.on('mark_message_read', async (data) => {
    try {
      const { messageId } = data;

      await PersonalMessage.updateOne(
        { _id: messageId, recipient_id: socket.userId },
        { read: true }
      );

      socket.emit('message_marked_read', { messageId });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  });

  socket.on('typing_start', ({ conversationId, groupId }) => {
    if (conversationId) {
      socket.to(`personal_${conversationId}`).emit('user_typing', { userId: socket.userId, conversationId });
    } else if (groupId) {
      socket.to(`group_${groupId}`).emit('user_typing', { userId: socket.userId, groupId });
    }
  });

  socket.on('typing_stop', ({ conversationId, groupId }) => {
    if (conversationId) {
      socket.to(`personal_${conversationId}`).emit('user_stopped_typing', { userId: socket.userId, conversationId });
    } else if (groupId) {
      socket.to(`group_${groupId}`).emit('user_stopped_typing', { userId: socket.userId, groupId });
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`);
    authenticatedSockets.delete(socket.userId);
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, username, class: userClass, stream } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Email, password, and username are required' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const newUser = new User({
      email: email.toLowerCase(),
      password,
      username,
      class: userClass,
      stream: stream,
      bytes: 100
    });

    await newUser.save();

    const token = jwt.sign(
      { userId: newUser._id.toString(), email: newUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: newUser.toPublicJSON()
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// SchoolByte student auto-sync endpoint
app.post('/api/auth/sync-schoolbyte', async (req, res) => {
  try {
    const { email, studentName, class: studentClass, stream } = req.body;

    if (!email || !studentName) {
      return res.status(400).json({ error: 'Email and student name are required' });
    }

    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Create ByteNexus user from SchoolByte student
      const tempPassword = Math.random().toString(36).slice(-8);
      user = new User({
        email: email.toLowerCase(),
        password: tempPassword,
        username: studentName,
        class: studentClass,
        stream: stream,
        bytes: 100
      });
      await user.save();
    } else {
      // Update existing user with SchoolByte data
      user.username = studentName;
      user.class = studentClass;
      user.stream = stream;
      await user.save();
    }

    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('SchoolByte sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Sign in failed' });
  }
});

app.get('/api/auth/me', authenticateRequest, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user.toPublicJSON());
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

app.get('/api/search/users', authenticateRequest, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json([]);
    }

    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ],
      _id: { $ne: req.userId }
    })
      .select('username email avatar_url class stream')
      .limit(20)
      .lean();

    const formattedUsers = users.map(user => ({
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      avatar_url: user.avatar_url,
      class: user.class,
      stream: user.stream
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/api/contacts/suggestions', authenticateRequest, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId).lean();
    
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const allUsers = await User.find({
      _id: { $ne: req.userId }
    })
      .select('username email avatar_url class stream')
      .lean();

    // Categorize users by relevance
    const sameStreamAndClass = [];
    const sameStream = [];
    const sameClass = [];
    const others = [];

    allUsers.forEach(user => {
      if (currentUser.stream && currentUser.class) {
        if (user.stream === currentUser.stream && user.class === currentUser.class) {
          sameStreamAndClass.push(user);
        } else if (user.stream === currentUser.stream) {
          sameStream.push(user);
        } else if (user.class === currentUser.class) {
          sameClass.push(user);
        } else {
          others.push(user);
        }
      } else if (currentUser.stream && user.stream === currentUser.stream) {
        sameStream.push(user);
      } else if (currentUser.class && user.class === currentUser.class) {
        sameClass.push(user);
      } else {
        others.push(user);
      }
    });

    const formatUser = (user, category) => ({
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      avatar_url: user.avatar_url,
      class: user.class,
      stream: user.stream,
      category: category
    });

    const suggestions = [
      ...sameStreamAndClass.map(u => formatUser(u, 'Same Stream & Class')),
      ...sameStream.map(u => formatUser(u, 'Same Stream')),
      ...sameClass.map(u => formatUser(u, 'Same Class')),
      ...others.slice(0, 30).map(u => formatUser(u, 'Other Students'))
    ];

    res.json({
      currentUser: {
        class: currentUser.class,
        stream: currentUser.stream
      },
      suggestions: suggestions
    });
  } catch (error) {
    console.error('Contact suggestions error:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

app.get('/api/search/groups', authenticateRequest, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json([]);
    }

    const groups = await DiscussionGroup.find({
      is_public: true,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ]
    })
      .limit(10)
      .lean();

    const formattedGroups = groups.map(group => ({
      id: group._id.toString(),
      name: group.name,
      description: group.description,
      rules: group.rules,
      is_public: group.is_public,
      created_by: group.created_by.toString(),
      created_at: group.created_at
    }));

    res.json(formattedGroups);
  } catch (error) {
    console.error('Group search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/api/messages/personal/:conversationId', authenticateRequest, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { before, limit = 50 } = req.query;

    const [userId1, userId2] = conversationId.split('_');

    if (!userId1 || !userId2 || (userId1 !== req.userId && userId2 !== req.userId)) {
      return res.status(403).json({ error: 'Unauthorized to access this conversation' });
    }

    let query = PersonalMessage.find({
      $or: [
        { sender_id: userId1, recipient_id: userId2 },
        { sender_id: userId2, recipient_id: userId1 }
      ]
    })
      .populate('sender_id', 'username avatar_url')
      .populate('recipient_id', 'username avatar_url')
      .sort({ created_at: -1 })
      .limit(parseInt(limit));

    if (before) {
      query = query.where('created_at').lt(new Date(before));
    }

    const messages = await query.lean();

    const formattedMessages = messages.map(msg => ({
      id: msg._id.toString(),
      sender_id: msg.sender_id._id.toString(),
      recipient_id: msg.recipient_id._id.toString(),
      content: msg.content,
      read: msg.read,
      created_at: msg.created_at,
      sender: {
        id: msg.sender_id._id.toString(),
        username: msg.sender_id.username,
        avatar_url: msg.sender_id.avatar_url
      },
      recipient: {
        id: msg.recipient_id._id.toString(),
        username: msg.recipient_id.username,
        avatar_url: msg.recipient_id.avatar_url
      }
    })).reverse();

    res.json(formattedMessages);
  } catch (error) {
    console.error('Failed to load personal messages:', error);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

app.get('/api/messages/group/:groupId', authenticateRequest, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { before, limit = 50 } = req.query;

    const membership = await GroupMember.findOne({
      group_id: groupId,
      user_id: req.userId
    });

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    let query = GroupMessage.find({ group_id: groupId })
      .populate('sender_id', 'username avatar_url')
      .sort({ created_at: -1 })
      .limit(parseInt(limit));

    if (before) {
      query = query.where('created_at').lt(new Date(before));
    }

    const messages = await query.lean();

    const formattedMessages = messages.map(msg => ({
      id: msg._id.toString(),
      group_id: msg.group_id.toString(),
      sender_id: msg.sender_id._id.toString(),
      content: msg.content,
      has_latex: msg.has_latex,
      is_flagged: msg.is_flagged,
      is_boosted: msg.is_boosted,
      boost_cost: msg.boost_cost,
      created_at: msg.created_at,
      sender: {
        id: msg.sender_id._id.toString(),
        username: msg.sender_id.username,
        avatar_url: msg.sender_id.avatar_url
      }
    })).reverse();

    res.json(formattedMessages);
  } catch (error) {
    console.error('Failed to load group messages:', error);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

app.get('/api/messages/personal/recent', authenticateRequest, async (req, res) => {
  try {
    const messages = await PersonalMessage.find({
      $or: [
        { sender_id: req.userId },
        { recipient_id: req.userId }
      ]
    })
      .populate('sender_id', 'username avatar_url')
      .populate('recipient_id', 'username avatar_url')
      .sort({ created_at: -1 })
      .limit(100)
      .lean();

    const formattedMessages = messages.map(msg => ({
      id: msg._id.toString(),
      sender_id: msg.sender_id._id.toString(),
      recipient_id: msg.recipient_id._id.toString(),
      content: msg.content,
      read: msg.read,
      created_at: msg.created_at,
      sender: {
        id: msg.sender_id._id.toString(),
        username: msg.sender_id.username,
        avatar_url: msg.sender_id.avatar_url
      },
      recipient: {
        id: msg.recipient_id._id.toString(),
        username: msg.recipient_id.username,
        avatar_url: msg.recipient_id.avatar_url
      }
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error('Failed to load recent messages:', error);
    res.status(500).json({ error: 'Failed to load recent messages' });
  }
});

app.use(express.static(path.join(__dirname, 'dist')));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ByteNexus Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`🔐 JWT Authentication enabled`);
  console.log(`💾 MongoDB connection: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Connecting...'}`);
  console.log(`🌐 Frontend served from: ${path.join(__dirname, 'dist')}`);
});
