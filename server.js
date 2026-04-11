// server.js - SchoolByte Backend - Complete Quiz System Implementation

require('dotenv').config();

// --- Module Imports ---
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const helmet = require('helmet');
const morgan = require('morgan');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
// Removed Gemini AI - now using TinyLlama via Ollama for all AI features
const Groq = require('groq-sdk');
const crypto = require('crypto');
const http = require('http');
const { getDivision, getFixture, getQuizSerialNumber, getThreeQuartersCycle, CYCLE_SIZES, SLOT_CATEGORY, CLASS_ORDER } = require('./config/fatsAndBeef');
const { Server } = require('socket.io');


const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});


// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(helmet());
app.use(morgan('dev'));

// Start listening immediately so Replit detects the port before routes finish loading
const PORT = process.env.PORT || 3002;

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN MANAGEMENT: List, Create, Delete, Reset Password
// ═══════════════════════════════════════════════════════════════════════════

function generateRandomPassword(length = 10) {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const special = '!@#$%^&*';
    const all = upper + lower + digits + special;
    let pass = [
        upper[Math.floor(Math.random()*upper.length)],
        lower[Math.floor(Math.random()*lower.length)],
        digits[Math.floor(Math.random()*digits.length)],
        special[Math.floor(Math.random()*special.length)]
    ];
    for (let i = pass.length; i < length; i++) {
        pass.push(all[Math.floor(Math.random()*all.length)]);
    }
    return pass.sort(() => Math.random() - 0.5).join('');
}

// --- MongoDB Connection ---
const MONGODB_URI = process.env.MONGODB_URI;


if (!MONGODB_URI) {
    console.error('FATAL ERROR: MONGODB_URI is not defined. Please set it in Replit Secrets.');
    process.exit(1);
}


mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });


// --- JWT Secret ---
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined. Please set it in Replit Secrets.');
    process.exit(1);
}

// --- Models (schemas live in /models) ---
const VerificationCode = require('./models/VerificationCode');
const Subject = require('./models/Subject');
const Student = require('./models/Student');
const Teacher = require('./models/Teacher');
const QuizQuestion = require('./models/QuizQuestion');
const QuizSession = require('./models/QuizSession');
const CompletedQuizAttempt = require('./models/CompletedQuizAttempt');
const WorkFile = require('./models/WorkFile');
const Activity = require('./models/Activity');
const StudentActivitySubmission = require('./models/StudentActivitySubmission');
const Administrator = require('./models/Administrator');
const TeacherNotification = require('./models/TeacherNotification');
const PlayerLevel = require('./models/PlayerLevel');
const Achievement = require('./models/Achievement');
const StudentAchievement = require('./models/StudentAchievement');
const Notification = require('./models/Notification');
const PersonalMessage = require('./models/PersonalMessage');
const DiscussionGroup = require('./models/DiscussionGroup');
const Team = require('./models/Team');
const GroupMessage = require('./models/GroupMessage');
const DailyQuote = require('./models/DailyQuote');
const UnebProject = require('./models/UnebProject');

// --- Socket.io Chat Management ---
const authenticatedSockets = new Map();

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Authentication token required'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Ensure the token payload contains studentId, not just id
    const studentId = decoded.id || decoded.studentId; 
    if (!studentId) {
        return next(new Error('Invalid token payload: student ID missing'));
    }
    const student = await Student.findById(studentId);

    if (!student) {
      return next(new Error('Invalid authentication token: student not found'));
    }

    socket.userId = student._id.toString();
    socket.userEmail = student.email;
    socket.username = student.studentName;
    next();
  } catch (error) {
    console.error('Socket authentication error:', error.message);
    next(new Error('Invalid authentication token'));
  }
});

io.on('connection', (socket) => {
  console.log(`Student connected to chat: ${socket.userId} (${socket.username})`);
  authenticatedSockets.set(socket.userId, socket);

  // Broadcast to all users that this user is online
  io.emit('user_online', { userId: socket.userId, username: socket.username });

  // Send current online users list to newly connected user
  socket.on('get_online_users', () => {
    const onlineUsers = Array.from(authenticatedSockets.keys());
    socket.emit('online_users_list', onlineUsers);
  });

  socket.on('join_personal_room', ({ conversationId }) => {
    const userIds = conversationId.split('_');
    if (!userIds.includes(socket.userId)) {
      socket.emit('error', { message: 'Unauthorized to join this conversation' });
      return;
    }
    socket.join(`personal_${conversationId}`);
    console.log(`Student ${socket.userId} joined personal room: ${conversationId}`);
  });

  socket.on('send_personal_message', async (data) => {
    try {
      const { recipientId, content, tempId, replyTo, quoteProject } = data;

      // Deduct 0.2 bytes per personal message sent
      await Student.updateOne(
        { _id: socket.userId, bytes: { $gte: 0.2 } },
        { $inc: { bytes: -0.2 } }
      ).catch(() => {});

      const newMessage = new PersonalMessage({
        sender_id: socket.userId,
        recipient_id: recipientId,
        content: content,
        read: false,
        delivered: false,
        replyTo: replyTo || null,
        quoteProject: quoteProject || null
      });

      await newMessage.save();

      const messageWithSender = await PersonalMessage.findById(newMessage._id)
        .populate('sender_id', 'studentName email')
        .populate('recipient_id', 'studentName email')
        .lean();

      const formattedMessage = {
        _id: messageWithSender._id.toString(),
        id: messageWithSender._id.toString(),
        sender_id: messageWithSender.sender_id._id.toString(),
        recipient_id: messageWithSender.recipient_id._id.toString(),
        content: messageWithSender.content,
        read: messageWithSender.read,
        delivered: messageWithSender.delivered,
        created_at: messageWithSender.created_at,
        tempId: tempId,
        replyTo: messageWithSender.replyTo ? {
          id: messageWithSender.replyTo.id?.toString(),
          content: messageWithSender.replyTo.content,
          sender_id: messageWithSender.replyTo.sender_id?.toString()
        } : null,
        quoteProject: messageWithSender.quoteProject ? {
          id: messageWithSender.quoteProject.id?.toString(),
          photoUrl: messageWithSender.quoteProject.photoUrl,
          title: messageWithSender.quoteProject.title
        } : null,
        sender: {
          id: messageWithSender.sender_id._id.toString(),
          username: messageWithSender.sender_id.studentName,
          avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${messageWithSender.sender_id.studentName}`
        },
        recipient: {
          id: messageWithSender.recipient_id._id.toString(),
          username: messageWithSender.recipient_id.studentName,
          avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${messageWithSender.recipient_id.studentName}`
        }
      };

      const conversationId = [socket.userId, recipientId].sort().join('_');

      // Send confirmation to sender with the full message
      socket.emit('message_sent_confirmation', {
        tempId: tempId,
        messageId: formattedMessage._id,
        status: 'sent',
        message: formattedMessage
      });

      // Broadcast to conversation room (excluding sender to prevent duplication)
      socket.to(`personal_${conversationId}`).emit('new_personal_message', formattedMessage);

      // Always save persistent notification for the recipient (whether online or offline)
      createNotification(
          recipientId, 'new_chat_message',
          'New Message from ' + socket.username,
          socket.username + ' sent you a message on ByteNexus.',
          { senderId: socket.userId, senderName: socket.username, conversationId }
      ).catch(() => {});

      // Check if recipient is online
      const recipientSocket = authenticatedSockets.get(recipientId);
      if (recipientSocket) {
        // Mark as delivered since recipient is online
        await PersonalMessage.updateOne(
          { _id: formattedMessage._id },
          { delivered: true }
        );

        socket.emit('message_status_update', {
          messageId: formattedMessage._id,
          status: 'delivered'
        });

        recipientSocket.emit('new_message_notification', {
          type: 'personal',
          senderId: socket.userId,
          senderName: socket.username,
          conversationId: conversationId,
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

  socket.on('join_group_room', async (data) => {
    try {
      const { groupId } = data;

      // Verify user is a member of this group
      const group = await DiscussionGroup.findById(groupId);
      if (!group) {
        socket.emit('error', { message: 'Group not found' });
        return;
      }

      const isMember = group.members.some(memberId => memberId.toString() === socket.userId);
      if (!isMember) {
        socket.emit('error', { message: 'Not a member of this group' });
        return;
      }

      socket.join(`group_${groupId}`);
      console.log(`Student ${socket.userId} joined group room: ${groupId}`);
    } catch (error) {
      console.error('Error joining group room:', error);
      socket.emit('error', { message: 'Failed to join group room' });
    }
  });

  socket.on('send_group_message', async (data) => {
    try {
      const { groupId, content, replyTo } = data;

      // Verify membership
      const group = await DiscussionGroup.findById(groupId);
      if (!group) {
        socket.emit('message_error', { error: 'Group not found' });
        return;
      }

      const isMember = group.members.some(memberId => memberId.toString() === socket.userId);
      if (!isMember) {
        socket.emit('message_error', { error: 'Not a member of this group' });
        return;
      }

      const newMessage = new GroupMessage({
        group_id: groupId,
        sender_id: socket.userId,
        content: content,
        replyTo: replyTo || null
      });

      await newMessage.save();

      const messageWithSender = await GroupMessage.findById(newMessage._id)
        .populate('sender_id', 'studentName email')
        .lean();

      const formattedMessage = {
        id: messageWithSender._id.toString(),
        group_id: messageWithSender.group_id.toString(),
        sender_id: messageWithSender.sender_id._id.toString(),
        content: messageWithSender.content,
        created_at: messageWithSender.created_at,
        replyTo: messageWithSender.replyTo ? {
          id: messageWithSender.replyTo.id?.toString(),
          content: messageWithSender.replyTo.content,
          sender_id: messageWithSender.replyTo.sender_id?.toString()
        } : null,
        sender: {
          id: messageWithSender.sender_id._id.toString(),
          username: messageWithSender.sender_id.studentName,
          avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${messageWithSender.sender_id.studentName}`
        }
      };

      // Broadcast to all members in the group room
      io.to(`group_${groupId}`).emit('new_group_message', formattedMessage);

    } catch (error) {
      console.error('Error sending group message:', error);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Student disconnected from chat: ${socket.userId}`);
    authenticatedSockets.delete(socket.userId);

    // Broadcast to all users that this user is offline
    io.emit('user_offline', { userId: socket.userId, username: socket.username });
  });
});


// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        // Assuming the token payload contains 'id' which maps to student._id
        req.student = { id: decoded.id || decoded.studentId }; // Use decoded.id or decoded.studentId
        next();
    });
};


// ═══════════════════════════════════════════════════════════════════════════
// STUDENT BYTES REFUND
// ═══════════════════════════════════════════════════════════════════════════
app.post('/student/workfiles/:workFileId/refund', authenticateToken, async (req, res) => {
    try {
        const { workFileId } = req.params;
        const studentId = req.student.id;
        const workFile = await WorkFile.findById(workFileId).lean();
        if (!workFile) return res.status(404).json({ message: 'Work file not found.' });
        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ message: 'Student not found.' });
        const refundAmount = workFile.costBytes || 0;
        if (refundAmount === 0) return res.status(400).json({ message: 'No bytes to refund for this file.' });
        student.bytes += refundAmount;
        await student.save();
        await createNotification(
            studentId, 'bytes_refund', 'Bytes Refunded',
            `${refundAmount} bytes have been refunded because your download of "${workFile.title}" was unsuccessful.`,
            { workFileId, workFileTitle: workFile.title, refundAmount, newBalance: student.bytes }
        );
        res.json({ success: true, refundAmount, newBalance: student.bytes, message: `${refundAmount} bytes refunded successfully.` });
    } catch (err) {
        console.error('Bytes refund error:', err);
        res.status(500).json({ message: 'Failed to process refund', error: err.message });
    }
});

// Get group messages
app.get('/api/messages/group/:groupId', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const studentId = req.student.id;

    // Verify group exists and user is a member
    const group = await DiscussionGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const isMember = group.members.some(memberId => memberId.toString() === studentId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const messages = await GroupMessage.find({ group_id: groupId })
      .populate('sender_id', 'studentName email')
      .sort({ created_at: 1 })
      .lean();

    const formattedMessages = messages.map(msg => ({
      id: msg._id.toString(),
      group_id: msg.group_id.toString(),
      sender_id: msg.sender_id._id.toString(),
      content: msg.content,
      created_at: msg.created_at,
      sender: {
        id: msg.sender_id._id.toString(),
        username: msg.sender_id.studentName,
        avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${msg.sender_id.studentName}`
      }
    }));

    res.json(formattedMessages);

  } catch (error) {
    console.error('Error fetching group messages:', error);
    res.status(500).json({ error: 'Failed to fetch group messages' });
  }
});

// Get active chat conversations for ByteNexus
app.get('/api/messages/personal/conversations', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;

    // Find all conversations where the student has both sent and received messages
    const conversations = await PersonalMessage.aggregate([
      {
        $match: {
          $or: [
            { sender_id: new mongoose.Types.ObjectId(studentId) },
            { recipient_id: new mongoose.Types.ObjectId(studentId) }
          ]
        }
      },
      {
        $sort: { created_at: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender_id', new mongoose.Types.ObjectId(studentId)] },
              '$recipient_id',
              '$sender_id'
            ]
          },
          lastMessage: { $first: '$content' },
          lastMessageTime: { $first: '$created_at' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$recipient_id', new mongoose.Types.ObjectId(studentId)] },
                    { $eq: ['$read', false] }
                  ]
                },
                1,
                0
              ]
            }
          },
          messagesSent: {
            $sum: {
              $cond: [{ $eq: ['$sender_id', new mongoose.Types.ObjectId(studentId)] }, 1, 0]
            }
          },
          messagesReceived: {
            $sum: {
              $cond: [{ $eq: ['$recipient_id', new mongoose.Types.ObjectId(studentId)] }, 1, 0]
            }
          }
        }
      },
      {
        $match: {
          messagesSent: { $gt: 0 },
          messagesReceived: { $gt: 0 }
        }
      },
      {
        $lookup: {
          from: 'students',
          localField: '_id',
          foreignField: '_id',
          as: 'contactDetails'
        }
      },
      {
        $unwind: '$contactDetails'
      },
      {
        $project: {
          contactId: '$_id',
          contactName: '$contactDetails.studentName',
          contactEmail: '$contactDetails.email',
          contactClass: '$contactDetails.class',
          contactStream: '$contactDetails.stream',
          lastMessage: 1,
          lastMessageTime: 1,
          unreadCount: 1
        }
      }
    ]);

    const formattedConversations = conversations.map(conv => ({
      contact: {
        id: conv.contactId.toString(),
        studentName: conv.contactName,
        email: conv.contactEmail,
        class: conv.contactClass,
        stream: conv.contactStream,
        avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${conv.contactName}`,
        category: 'Active Chat'
      },
      contactName: conv.contactName,
      lastMessage: conv.lastMessage.substring(0, 50) + (conv.lastMessage.length > 50 ? '...' : ''),
      lastMessageTime: conv.lastMessageTime,
      unreadCount: conv.unreadCount
    }));

    res.json(formattedConversations);

  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get Work Files (Notes) by Subject ---
app.get('/api/workfiles/:subject', authenticateToken, async (req, res) => {
    try {
        const { subject } = req.params;
        const studentId = req.student.id;

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Case-insensitive subject search
        const workFiles = await WorkFile.find({ subject: { $regex: new RegExp(`^${subject}$`, 'i') } })
            .populate('activity')
            .sort({ createdAt: -1 });

        const studentClass = student.class;
        const sortedFiles = workFiles.sort((a, b) => {
            if (a.intendedClass === studentClass && b.intendedClass !== studentClass) return -1;
            if (b.intendedClass === studentClass && a.intendedClass !== studentClass) return 1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        res.json({
            workFiles: sortedFiles.map(file => ({
                _id: file._id,
                title: file.title,
                description: file.description,
                fileUrl: file.fileUrl,
                intendedClass: file.intendedClass,
                costBytes: file.costBytes,
                uploadedBy: file.uploadedBy,
                downloadCount: file.downloadCount,
                createdAt: file.createdAt,
                hasActivity: !!file.activity
            })),
            studentClass: studentClass
        });
    } catch (error) {
        console.error('Error fetching work files:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// --- Utility Functions ---


// Enhanced NLP grading function
async function gradeNLPAnswer(studentAnswer, quizQuestion) {
    if (!quizQuestion.keywordsForGrading || quizQuestion.keywordsForGrading.length === 0) {
        return 1; // If no keywords, assume correct
    }


    let matchedKeywords = 0;
    let negativeMatches = 0;
    const normalizedAnswer = studentAnswer.toLowerCase().trim();


    // Check positive keywords
    for (const keyword of quizQuestion.keywordsForGrading) {
        if (normalizedAnswer.includes(keyword.toLowerCase().trim())) {
            matchedKeywords++;
        }
    }


    // Check negative keywords
    if (quizQuestion.negativeKeywords && quizQuestion.negativeKeywords.length > 0) {
        for (const negKeyword of quizQuestion.negativeKeywords) {
            if (normalizedAnswer.includes(negKeyword.toLowerCase().trim())) {
                negativeMatches++;
            }
        }
    }


    // Calculate score with negative penalty
    let score = matchedKeywords / quizQuestion.keywordsForGrading.length;
    score = Math.max(0, score - (negativeMatches * 0.1)); // Deduct 0.1 per negative match


    return Math.min(1, score);
}


// Energy: refill 1 per hour, cap 25
function refillEnergy(student) {
    const now = Date.now();
    const last = (student.lastEnergyRefillAt && new Date(student.lastEnergyRefillAt).getTime()) || now;
    const hoursElapsed = Math.floor((now - last) / (60 * 60 * 1000));
    if (hoursElapsed <= 0) return;
    const added = Math.min(hoursElapsed, 25 - (student.energy || 0));
    if (added <= 0) return;
    student.energy = Math.min(25, (student.energy || 25) + hoursElapsed);
    student.lastEnergyRefillAt = new Date(last + hoursElapsed * 60 * 60 * 1000);
}

// Weekly reset checker for students
async function checkAndResetWeeklyCounters(student) {
    const now = new Date();
    const lastReset = new Date(student.lastQuizResetDate);
    const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());


    if (lastReset < startOfThisWeek) {
        student.quizzesCompletedThisWeek = 0;
        student.lastQuizResetDate = startOfThisWeek;
        await student.save();
    }
}


// Weekly reset checker for teachers
async function checkAndResetTeacherWeeklyCounters(teacher) {
    const now = new Date();
    const lastReset = new Date(teacher.lastUploadResetDate);
    const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());


    if (lastReset < startOfThisWeek) {
        teacher.quizzesUploadedThisWeek = 0;
        teacher.lastUploadResetDate = startOfThisWeek;
        await teacher.save();
    }
}


// Quiz generation: Fats and Beef schema with fixture tables (7 usual, 2 revision, 1 stretch)
async function generateQuizQuestions(student, requestedSubject = null, isRetry = false) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let quizSession = await QuizSession.findById(student.currentQuizSessionId).session(session);
        if (!quizSession) {
            quizSession = new QuizSession({
                userId: student._id,
                questionsCompletedCount: 0
            });
            await quizSession.save({ session });
            student.currentQuizSessionId = quizSession._id;
            await student.save({ session });
        }

        const division = getDivision(student.class);
        if (!division) {
            await session.abortTransaction();
            session.endSession();
            throw new Error('Invalid student class for quiz generation.');
        }

        // Upper school: only first 4 subjects (exclude General Paper / subject e)
        const enrolledSubjects = division === 'upper'
            ? (student.subjectsEnrolled || []).slice(0, 4)
            : (student.subjectsEnrolled || []);
        if (enrolledSubjects.length === 0) {
            await session.abortTransaction();
            session.endSession();
            throw new Error('No subjects enrolled.');
        }

        const fixture = getFixture(division);
        if (!fixture) {
            await session.abortTransaction();
            session.endSession();
            throw new Error('No fixture for division.');
        }

        const sn = getQuizSerialNumber(quizSession.questionsCompletedCount, division);
        const rowIndex = (sn - 1) % fixture.length;
        const fixtureRow = fixture[rowIndex];

        const studentClass = student.class;
        const classIndex = CLASS_ORDER.indexOf(studentClass);
        const ownClasses = [studentClass];
        const lowerClasses = classIndex > 0 ? CLASS_ORDER.slice(0, classIndex) : [];
        const upperClasses = classIndex < CLASS_ORDER.length - 1 ? CLASS_ORDER.slice(classIndex + 1) : [];

        function getAllowedClasses(category) {
            if (category === 'usual') return ownClasses;
            if (category === 'revision') return lowerClasses;
            if (category === 'stretch') return upperClasses;
            return [];
        }

        const selectedQuestions = [];
        const usedQuestionIds = new Set();
        const gaps = []; // slots with no matching DB question

        for (let slot = 1; slot <= 10; slot++) {
            const subjectIndex = fixtureRow[slot - 1] % enrolledSubjects.length;
            const subject = enrolledSubjects[subjectIndex];
            const category = SLOT_CATEGORY[slot];
            const allowedClasses = getAllowedClasses(category);

            if (allowedClasses.length === 0) {
                // e.g. revision slot for S.1 — no lower class exists
                gaps.push({ slot, subject, intendedClasses: allowedClasses, category });
                continue;
            }

            const excludeIds = [...(student.recentQuizIds || []), ...Array.from(usedQuestionIds)];
            const questions = await QuizQuestion.find({
                subject: subject,
                intendedClass: { $in: allowedClasses },
                isActive: true,
                _id: excludeIds.length ? { $nin: excludeIds } : { $exists: true }
            })
                .sort({ timesServedOverall: 1, lastServedTimestamp: 1 })
                .limit(20)
                .session(session)
                .lean();

            if (questions.length === 0) {
                // Targeted per-slot fallback: find the oldest recently-served question
                // for THIS specific subject/class before triggering global contingency.
                const usedIdsStr = new Set(Array.from(usedQuestionIds).map(id => id.toString()));
                const recentCandidateIds = (student.recentQuizIds || []).filter(
                    id => !usedIdsStr.has(id.toString())
                );
                const fallbackQs = recentCandidateIds.length
                    ? await QuizQuestion.find({
                        subject,
                        intendedClass: { $in: allowedClasses },
                        isActive: true,
                        _id: { $in: recentCandidateIds }
                    }).sort({ lastServedTimestamp: 1 }).limit(3).session(session).lean()
                    : [];

                if (fallbackQs.length > 0) {
                    const chosen = fallbackQs[Math.floor(Math.random() * fallbackQs.length)];
                    selectedQuestions.push({ question: chosen, slot });
                    usedQuestionIds.add(chosen._id);
                    continue;
                }

                if (!isRetry) {
                    // Targeted fallback exhausted — run global contingency then retry
                    await session.abortTransaction();
                    session.endSession();
                    const result = await runContingencyAndRetry(student, quizSession, division);
                    return result;
                }
                // Second pass (isRetry) — record gap and keep going; AI will fill it
                gaps.push({ slot, subject, intendedClasses: allowedClasses, category });
                continue;
            }

            const chosen = questions[Math.floor(Math.random() * questions.length)];
            selectedQuestions.push({ question: chosen, slot });
            usedQuestionIds.add(chosen._id);
        }

        shuffleArray(selectedQuestions);

        setImmediate(async () => {
            for (const { question } of selectedQuestions) {
                await QuizQuestion.updateOne(
                    { _id: question._id },
                    { $inc: { timesServedOverall: 1 }, $set: { lastServedTimestamp: new Date() } }
                );
            }
        });

        await session.commitTransaction();
        session.endSession();

        const foundQuestions = selectedQuestions.map(sq => sq.question);
        if (gaps.length === 0) {
            return foundQuestions; // fully satisfied from DB — backward compatible
        }
        // Return partial result so endpoint can fill gaps with AI
        return { questions: foundQuestions, gaps, division, studentClass };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

async function runContingencyAndRetry(student, quizSession, division) {
    const studentId = student._id;
    const currentSessionId = quizSession._id;
    const questionsInCycle = quizSession.questionsCompletedCount;
    const cycleSize = CYCLE_SIZES[division];
    const threeQuarters = getThreeQuartersCycle(division);

    const sessionsToUnflag = [];
    if ((student.contingencyRepeatCount || 0) >= 10) {
        const lastTwo = await QuizSession.find({ userId: studentId }).sort({ startedAt: -1 }).limit(2).lean();
        sessionsToUnflag.push(...lastTwo.map(s => s._id));
    } else if (questionsInCycle >= threeQuarters) {
        sessionsToUnflag.push(currentSessionId);
    } else {
        sessionsToUnflag.push(currentSessionId);
        const previous = await QuizSession.findOne({ userId: studentId, _id: { $ne: currentSessionId } }).sort({ startedAt: -1 }).lean();
        if (previous) sessionsToUnflag.push(previous._id);
    }

    const attempts = await CompletedQuizAttempt.find({ quizSessionId: { $in: sessionsToUnflag } }).select('quizId').lean();
    const idsToRestore = attempts.map(a => a.quizId);
    const recentIds = (student.recentQuizIds || []).filter(id => !idsToRestore.some(rid => rid.equals(id)));
    student.recentQuizIds = recentIds;
    student.contingencyRepeatCount = (student.contingencyRepeatCount || 0) + 1;
    await student.save();

    const updatedStudent = await Student.findById(studentId);
    return generateQuizQuestions(updatedStudent, null, true);
}


function findUnderrepresentedSlots(subjectProgress) {
    const underrepresented = {};
    const quotas = { ownClass: 5, lowerClass: 2, higherClass: 3 };


    for (const subject in subjectProgress) {
        underrepresented[subject] = {};
        for (const category in quotas) {
            const current = subjectProgress[subject][category] || 0;
            const needed = quotas[category] - current;
            if (needed > 0) {
                underrepresented[subject][category] = needed;
            }
        }
    }


    return underrepresented;
}


// --- Email Configuration ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});


if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('WARNING: EMAIL_USER or EMAIL_PASS not set. Email functionalities will not work.');
}


// --- Cloudinary Configuration ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.warn('WARNING: Cloudinary environment variables are not fully set. File uploads will not work.');
} else {
    console.log('Cloudinary configured successfully.');
}



// --- Authentication Middleware ---
// authenticateToken is defined above

const authenticateTeacherToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];


    if (!token) {
        console.error('No authentication token provided in teacher request');
        return res.status(401).json({ message: 'Access Denied: No authentication token provided.' });
    }


    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('JWT verification error (Teacher):', {
                error: err.message,
                token: token.substring(0, 20) + '...',
                headers: req.headers.authorization ? 'present' : 'missing'
            });
            return res.status(403).json({ message: 'Access Denied: Invalid or expired teacher token.' });
        }


        // Ensure the token is for a teacher
        if (decoded.role !== 'teacher') {
            console.error('Token role mismatch:', decoded.role);
            return res.status(403).json({ message: 'Access Denied: Teacher access required.' });
        }


        req.teacher = decoded;
        next();
    });
};


const authenticateAdminToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];


    if (!token) {
        return res.status(401).json({ message: 'Access Denied: No authentication token provided.' });
    }


    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('JWT verification error (Admin):', err.message);
            return res.status(403).json({ message: 'Access Denied: Invalid or expired admin token.' });
        }
        req.admin = decoded;
        next();
    });
};

// ─── Admin Management Routes ────────────────────────────────────────────────
// GET all admins (excluding deleted)
app.get('/admin/admins', authenticateAdminToken, async (req, res) => {
    try {
        const admins = await Administrator.find({ deletedAt: null }).select('-password').lean();
        res.json({ admins });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch admins', error: err.message });
    }
});

// POST create new admin — auto-generates password, emails it
app.post('/admin/admins', authenticateAdminToken, [
    body('adminName').notEmpty().trim().withMessage('Admin name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
        const { adminName, email } = req.body;
        const existing = await Administrator.findOne({ email: email.toLowerCase() });
        if (existing) return res.status(409).json({ message: 'An administrator with this email already exists.' });

        const rawPassword = generateRandomPassword(10);
        const hashed = await bcrypt.hash(rawPassword, 10);
        const creatorEmail = req.admin.email || 'system';

        const newAdmin = new Administrator({
            adminName: adminName.trim(),
            email: email.toLowerCase(),
            password: hashed,
            isPasswordSet: false,
            createdBy: creatorEmail
        });
        await newAdmin.save();

        const mailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f4f7f9;border-radius:12px;">
          <h2 style="color:#2c3e50;text-align:center;">Welcome to SchoolByte Admin Portal</h2>
          <p>Hello <strong>${adminName}</strong>,</p>
          <p>You have been added as an administrator of SchoolByte by <strong>${creatorEmail}</strong>.</p>
          <div style="background:#fff;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #3498db;">
            <p style="margin:0;font-size:13px;color:#666;">Your initial login credentials:</p>
            <p style="margin:8px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin:8px 0;"><strong>Temporary Password:</strong>
              <code style="background:#eef2ff;padding:4px 10px;border-radius:4px;font-size:16px;font-weight:bold;letter-spacing:2px;">${rawPassword}</code>
            </p>
          </div>
          <p style="color:#e74c3c;font-weight:bold;">You will be required to change this password on your first login.</p>
          <p>After logging in and completing 2FA, you will be directed to set your own permanent password.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
          <p style="font-size:12px;color:#999;text-align:center;">SchoolByte Administration System</p>
        </div>`;

        transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'SchoolByte Admin Account Created — Your Temporary Password',
            html: mailHtml
        }).catch(e => console.error('Admin welcome email failed:', e.message));

        res.status(201).json({ message: 'Administrator created. Login credentials emailed.', admin: { id: newAdmin._id, adminName: newAdmin.adminName, email: newAdmin.email } });
    } catch (err) {
        console.error('Create admin error:', err);
        res.status(500).json({ message: 'Failed to create administrator', error: err.message });
    }
});

// DELETE admin — requires reason, emails the deleted admin
app.delete('/admin/admins/:id', authenticateAdminToken, async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason || reason.trim().length < 5) return res.status(400).json({ message: 'A deletion reason of at least 5 characters is required.' });

        const targetAdmin = await Administrator.findOne({ _id: req.params.id, deletedAt: null });
        if (!targetAdmin) return res.status(404).json({ message: 'Administrator not found.' });
        if (targetAdmin._id.toString() === req.admin.id.toString()) return res.status(400).json({ message: 'You cannot delete your own admin account.' });

        const deleterEmail = req.admin.email;
        const deleterName = req.admin.adminName || 'An administrator';
        const now = new Date();

        await Administrator.updateOne({ _id: req.params.id }, {
            $set: { deletedAt: now, deletedBy: deleterName, deletedByEmail: deleterEmail, deletionReason: reason.trim() }
        });

        const mailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff4f4;border-radius:12px;">
          <h2 style="color:#e74c3c;text-align:center;">Your SchoolByte Admin Access Has Been Revoked</h2>
          <p>Hello <strong>${targetAdmin.adminName}</strong>,</p>
          <p>Your administrator account on SchoolByte has been <strong>deleted</strong>.</p>
          <div style="background:#fff;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #e74c3c;">
            <p style="margin:4px 0;"><strong>Deleted by:</strong> ${deleterName} (${deleterEmail})</p>
            <p style="margin:4px 0;"><strong>Date:</strong> ${now.toLocaleString()}</p>
            <p style="margin:4px 0;"><strong>Reason:</strong> ${reason.trim()}</p>
          </div>
          <p>If you believe this was done in error, please contact another system administrator.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
          <p style="font-size:12px;color:#999;text-align:center;">SchoolByte Administration System</p>
        </div>`;

        transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: targetAdmin.email,
            subject: 'SchoolByte: Your Admin Account Has Been Deleted',
            html: mailHtml
        }).catch(e => console.error('Admin deletion email failed:', e.message));

        // Notify all teachers of the admin removal
        const allTeachers = await Teacher.find({}).select('_id').lean().catch(() => []);
        const teacherNotifs = allTeachers.map(t => new TeacherNotification({
            teacher: t._id,
            type: 'admin_deleted',
            title: 'Admin Account Removed',
            message: `Administrator ${targetAdmin.adminName} (${targetAdmin.email}) has been removed from the system.`,
            data: { adminName: targetAdmin.adminName, adminEmail: targetAdmin.email, deletedBy: deleterName }
        }));
        if (teacherNotifs.length > 0) {
            TeacherNotification.insertMany(teacherNotifs).catch(() => {});
        }

        res.json({ message: `Administrator ${targetAdmin.adminName} deleted successfully.` });
    } catch (err) {
        console.error('Delete admin error:', err);
        res.status(500).json({ message: 'Failed to delete administrator', error: err.message });
    }
});

// POST reset admin password
app.post('/admin/admins/:id/reset-password', authenticateAdminToken, async (req, res) => {
    try {
        const targetAdmin = await Administrator.findOne({ _id: req.params.id, deletedAt: null });
        if (!targetAdmin) return res.status(404).json({ message: 'Administrator not found.' });

        const rawPassword = generateRandomPassword(10);
        const hashed = await bcrypt.hash(rawPassword, 10);
        const requesterEmail = req.admin.email;
        const now = new Date();

        await Administrator.updateOne({ _id: req.params.id }, { $set: { password: hashed, isPasswordSet: false } });

        const mailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff8e1;border-radius:12px;">
          <h2 style="color:#f39c12;text-align:center;">SchoolByte Admin Password Reset</h2>
          <p>Hello <strong>${targetAdmin.adminName}</strong>,</p>
          <p>Your SchoolByte administrator password has been reset.</p>
          <div style="background:#fff;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #f39c12;">
            <p style="margin:4px 0;"><strong>Reset by:</strong> ${requesterEmail}</p>
            <p style="margin:4px 0;"><strong>Date &amp; Time:</strong> ${now.toLocaleString()}</p>
            <p style="margin:8px 0;"><strong>New temporary password:</strong><br>
              <code style="background:#eef2ff;padding:6px 14px;border-radius:4px;font-size:18px;font-weight:bold;letter-spacing:2px;display:inline-block;margin-top:6px;">${rawPassword}</code>
            </p>
          </div>
          <p style="color:#e74c3c;font-weight:bold;">You will be required to set a new password after your next login.</p>
          <p>If you did not request this reset, contact your system administrator immediately.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
          <p style="font-size:12px;color:#999;text-align:center;">SchoolByte Administration System</p>
        </div>`;

        transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: targetAdmin.email,
            subject: 'SchoolByte: Admin Password Reset',
            html: mailHtml
        }).catch(e => console.error('Password reset email failed:', e.message));

        res.json({ message: `Password reset for ${targetAdmin.adminName}. New credentials emailed.` });
    } catch (err) {
        console.error('Reset admin password error:', err);
        res.status(500).json({ message: 'Failed to reset password', error: err.message });
    }
});

// POST admin set-password (first login — isPasswordSet: false)
app.post('/admin/set-password', authenticateAdminToken, [
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    body('confirmPassword').notEmpty().withMessage('Please confirm password.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
        const { password, confirmPassword } = req.body;
        if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match.' });
        const admin = await Administrator.findById(req.admin.id);
        if (!admin) return res.status(404).json({ message: 'Admin not found.' });
        admin.password = await bcrypt.hash(password, 10);
        admin.isPasswordSet = true;
        await admin.save();
        res.json({ message: 'Password set successfully. You can now use the admin portal.' });
    } catch (err) {
        console.error('Admin set-password error:', err);
        res.status(500).json({ message: 'Failed to set password', error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// TEACHER NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

app.get('/teacher/notifications', authenticateTeacherToken, async (req, res) => {
    try {
        const notifications = await TeacherNotification.find({ teacher: req.teacher.id })
            .sort({ createdAt: -1 }).limit(50).lean();
        const unreadCount = notifications.filter(n => !n.read).length;
        res.json({ notifications, unreadCount });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch notifications', error: err.message });
    }
});

app.patch('/teacher/notifications/:id/read', authenticateTeacherToken, async (req, res) => {
    try {
        await TeacherNotification.updateOne({ _id: req.params.id, teacher: req.teacher.id }, { $set: { read: true } });
        res.json({ message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to mark notification as read' });
    }
});

app.post('/teacher/notifications/mark-all-read', authenticateTeacherToken, async (req, res) => {
    try {
        await TeacherNotification.updateMany({ teacher: req.teacher.id, read: false }, { $set: { read: true } });
        res.json({ message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to mark all read' });
    }
});

app.get('/teacher/notifications/unread-count', authenticateTeacherToken, async (req, res) => {
    try {
        const count = await TeacherNotification.countDocuments({ teacher: req.teacher.id, read: false });
        res.json({ count });
    } catch (err) {
        res.status(500).json({ count: 0 });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN → TEACHER MESSAGING (broadcast or targeted)
// ═══════════════════════════════════════════════════════════════════════════

app.post('/admin/message-teachers', authenticateAdminToken, [
    body('message').notEmpty().trim().withMessage('Message content is required.'),
    body('title').notEmpty().trim().withMessage('Message title is required.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
        const { title, message, teacherIds } = req.body;
        const senderName = req.admin.adminName || 'Administrator';
        const senderEmail = req.admin.email;

        let teachers;
        if (teacherIds && teacherIds.length > 0) {
            teachers = await Teacher.find({ _id: { $in: teacherIds } }).select('_id email teacherName').lean();
        } else {
            teachers = await Teacher.find({}).select('_id email teacherName').lean();
        }

        const notifDocs = teachers.map(t => ({
            teacher: t._id,
            type: 'admin_message',
            title: `Admin Message: ${title}`,
            message,
            data: { senderName, senderEmail }
        }));
        if (notifDocs.length > 0) await TeacherNotification.insertMany(notifDocs);

        // Email each teacher
        for (const teacher of teachers) {
            transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: teacher.email,
                subject: `SchoolByte Admin: ${title}`,
                html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                  <h2 style="color:#2c3e50;">Message from Administration</h2>
                  <p>Hello <strong>${teacher.teacherName}</strong>,</p>
                  <div style="background:#f4f7f9;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #3498db;">
                    <h3 style="margin:0 0 8px;">${title}</h3>
                    <p style="margin:0;white-space:pre-wrap;">${message}</p>
                  </div>
                  <p style="font-size:12px;color:#999;">From: ${senderName} &lt;${senderEmail}&gt; — SchoolByte Admin</p>
                </div>`
            }).catch(() => {});
        }

        res.json({ message: `Message sent to ${teachers.length} teacher(s).`, count: teachers.length });
    } catch (err) {
        console.error('Admin message-teachers error:', err);
        res.status(500).json({ message: 'Failed to send message', error: err.message });
    }
});




// --- AI Service Configuration ---
// Using TinyLlama via Ollama for all AI features
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

// Test Groq connection on startup
(async () => {
    if (!process.env.GROQ_API_KEY) {
        console.warn('\u26a0 GROQ_API_KEY not set. AI features will not work. Set GROQ_API_KEY in your environment.');
        return;
    }
    try {
        await groq.chat.completions.create({ model: GROQ_MODEL, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 });
        console.log('\u2713 Groq AI service connected successfully.');
    } catch (error) {
        console.warn('\u26a0 Groq AI service not available:', error.message);
    }
})();

// Helper function to extract JSON from AI response
function extractJSON(text) {
    try {
        // Remove markdown code fences if present
        let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        // Find JSON object boundaries
        const jsonStart = cleaned.indexOf('{');
        const jsonEnd = cleaned.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
        }
        
        return JSON.parse(cleaned);
    } catch (error) {
        throw new Error(`Failed to extract valid JSON from AI response: ${error.message}`);
    }
}

// Groq AI wrapper -- fast LLM inference
async function callGroqAI(userPrompt, systemPrompt, options) {
    systemPrompt = systemPrompt || '';
    options = options || {};
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured.');
    const maxRetries = options.retries !== undefined ? options.retries : 1;
    const maxTokens = options.max_tokens || options.num_predict || 350;
    const temperature = options.temperature !== undefined ? options.temperature : 0.7;
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userPrompt });
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await groq.chat.completions.create({
                model: GROQ_MODEL,
                messages,
                temperature,
                max_tokens: maxTokens
            });
            return response.choices[0] && response.choices[0].message && response.choices[0].message.content || '';
        } catch (error) {
            if (attempt === maxRetries) throw new Error('Groq AI error: ' + error.message);
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
        }
    }
}



// --- API Endpoints ---

// AI Study Buddy Chat Endpoint
app.post('/api/ai-buddy/chat', authenticateToken, async (req, res) => {
    const message = req.body.message;
    const context = req.body.context || null;
    if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'Message is required' });
    }
    if (!process.env.GROQ_API_KEY) {
        return res.status(503).json({ error: 'AI service not configured.' });
    }
    try {
        const student = await Student.findById(req.student.id);
        if (!student) return res.status(404).json({ error: 'Student not found' });
        let systemPrompt;
        if (context && context.type === 'counselling') {
            const topicLabels = { academic: 'academic stress, study challenges, and time management', emotional: 'emotional wellbeing, relationships, and personal challenges', crisis: 'urgent mental health and crisis support' };
            const topicDesc = topicLabels[context.topic] || context.topic || 'general support';
            systemPrompt = 'You are a caring, professional school counsellor for ' + student.studentName + '. Focus on: ' + topicDesc + '. Be warm, empathetic, and supportive. Ask follow-up questions when needed. Keep responses under 120 words. Never give medical diagnoses.';
        } else if (context && context.type === 'career') {
            const careerLabels = { stem: 'Science, Technology, Engineering & Mathematics', arts: 'Arts, Design & Creative fields', business: 'Business, Economics & Entrepreneurship', health: 'Healthcare, Medicine & Allied Health' };
            const careerDesc = careerLabels[context.topic] || context.topic || 'various careers';
            systemPrompt = 'You are an enthusiastic career advisor for ' + student.studentName + ', a ' + student.class + ' student. Focus specifically on: ' + careerDesc + '. Discuss qualifications, university options, skills, and career prospects. Be direct and practical. Under 150 words.';
        } else {
            systemPrompt = 'You are a helpful AI Study Buddy for ' + student.studentName + ', a ' + student.class + ' student studying: ' + student.subjectsEnrolled.join(', ') + '. Give accurate, clear, concise answers. No preamble. Under 150 words unless genuinely needed. Be encouraging.';
        }
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
        const stream = await groq.chat.completions.create({
            model: GROQ_MODEL,
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message.trim() }],
            stream: true,
            temperature: 0.7,
            max_tokens: 350
        });
        for await (const chunk of stream) {
            const token = (chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) || '';
            if (token) res.write('data: ' + JSON.stringify({ token }) + '\n\n');
        }
        res.write('data: ' + JSON.stringify({ done: true }) + '\n\n');
        res.end();
    } catch (error) {
        console.error('AI Study Buddy error:', error);
        try { res.write('data: ' + JSON.stringify({ error: 'AI service error. Please try again.' }) + '\n\n'); res.end(); } catch (e) {}
    }
});


// Initialize admin account on startup
async function initializeAdmin() {
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || process.env.ADMIN_PASSWORD;
        if (!adminEmail || !adminPassword) {
            console.warn('Admin init skipped: set ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD (or ADMIN_PASSWORD) in .env to create the initial admin.');
            return;
        }
        const existingAdmin = await Administrator.findOne({ email: adminEmail.toLowerCase() });
        if (!existingAdmin) {
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);
            const newAdmin = new Administrator({
                adminName: process.env.ADMIN_NAME || 'Administrator',
                email: adminEmail.toLowerCase().trim(),
                password: hashedPassword
            });
            await newAdmin.save();
            console.log('Initial administrator account created successfully.');
        } else {
            console.log('Administrator account already exists.');
        }
    } catch (error) {
        console.error('Error creating initial administrator:', error);
    }
}


// Initialize subjects on startup
async function initializeSubjects() {
    const subjects = [
        { name: "Mathematics", isCompulsory: true, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "English Language", isCompulsory: true, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Biology", isCompulsory: true, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Chemistry", isCompulsory: true, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Physics", isCompulsory: true, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "History", isCompulsory: true, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Geography", isCompulsory: true, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Computer Science", isCompulsory: false, applicableLevels: ["O_Level_Middle", "A_Level"] },
        { name: "Agriculture", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Literature in English", isCompulsory: false, applicableLevels: ["O_Level_Middle", "A_Level"] },
        { name: "French", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "German", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Kiswahili", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Luganda", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Fine Art", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Performing Arts", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Physical Education", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Technology and Design", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] }
    ];


    for (const subject of subjects) {
        await Subject.findOneAndUpdate(
            { name: subject.name },
            subject,
            { upsert: true, new: true }
        );
    }
}


// Initialize subjects and admin on startup
initializeSubjects().catch(console.error);
initializeAdmin().catch(console.error);


// Email verification endpoints (existing)
app.post('/send-verification-code', [
    body('email').isEmail().withMessage('Please provide a valid email address.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { email } = req.body;


    try {
        const student = await Student.findOne({ email });
        if (student && student.isEmailVerified) {
            return res.status(400).json({ message: 'This email is already verified.' });
        }


        const code = Math.floor(100000 + Math.random() * 900000).toString();


        await VerificationCode.findOneAndUpdate(
            { email },
            { code, createdAt: Date.now() },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );


        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'SchoolByte Email Verification Code',
            html: `<p>Your SchoolByte verification code is: <strong>${code}</strong></p><p>This code is valid for 10 minutes.</p>`
        };


        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Verification code sent to your email.' });


    } catch (error) {
        console.error('Error sending verification email:', error);
        res.status(500).json({ message: 'Failed to send verification code.', error: error.message });
    }
});


app.post('/verify-code', [
    body('email').isEmail().withMessage('Please provide a valid email address.'),
    body('code').notEmpty().withMessage('Verification code is required.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { email, code } = req.body;


    try {
        const storedCode = await VerificationCode.findOne({ email });


        if (!storedCode) {
            return res.status(400).json({ message: 'No verification code found for this email, or it has expired.', verified: false });
        }


        if (storedCode.code === code) {
            await Student.updateOne({ email }, { isEmailVerified: true });
            await VerificationCode.deleteOne({ email });
            return res.status(200).json({ message: 'Email verified successfully!', verified: true });
        } else {
            return res.status(400).json({ message: 'Invalid verification code.', verified: false });
        }
    } catch (error) {
        console.error('Error verifying code:', error);
        res.status(500).json({ message: 'Error verifying code.', error: error.message, verified: false });
    }
});


// Enhanced student registration with subject validation
app.post('/register-student', [
    body('studentName').notEmpty().withMessage('Student name is required.'),
    body('indexNumber').notEmpty().withMessage('Index number is required.').isAlphanumeric().withMessage('Index number must be alphanumeric.'),
    body('email').isEmail().withMessage('Please provide a valid email address.'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
    body('class').notEmpty().withMessage('Class is required.').isIn(['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6']).withMessage('Invalid class.'),
    body('stream').notEmpty().withMessage('Stream is required.'),
    body('classTeacher').notEmpty().withMessage('Class Teacher is required.'),
    body('subjectsEnrolled').isArray().withMessage('Subjects enrolled must be an array.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { studentName, indexNumber, email, password, class: studentClass, stream, classTeacher, subjectsEnrolled } = req.body;


    try {
        // Validate subject enrollment rules
        const compulsorySubjects = await Subject.find({ isCompulsory: true }).select('name');
        const compulsoryNames = compulsorySubjects.map(s => s.name);


        let expectedSubjectCount;
        let requiredCompulsory = true;


        if (['S.1', 'S.2'].includes(studentClass)) {
            expectedSubjectCount = 12; // 7 compulsory + 5 subsidiary
        } else if (['S.3', 'S.4'].includes(studentClass)) {
            expectedSubjectCount = 9; // 7 compulsory + 2 subsidiary
        } else if (['S.5', 'S.6'].includes(studentClass)) {
            expectedSubjectCount = 5; // Any 5 subjects
            requiredCompulsory = false;
        }


        if (subjectsEnrolled.length !== expectedSubjectCount) {
            return res.status(400).json({ 
                message: `Invalid number of subjects. ${studentClass} students must enroll in exactly ${expectedSubjectCount} subjects.` 
            });
        }


        if (requiredCompulsory) {
            const hasAllCompulsory = compulsoryNames.every(name => subjectsEnrolled.includes(name));
            if (!hasAllCompulsory) {
                return res.status(400).json({ 
                    message: `Missing required compulsory subjects: ${compulsoryNames.join(', ')}` 
                });
            }
        }


        const existingStudent = await Student.findOne({ $or: [{ email }, { indexNumber }] });
        if (existingStudent) {
            let message = 'Student with this ';
            if (existingStudent.email === email) {
                message += 'email';
            }
            if (existingStudent.indexNumber === indexNumber) {
                message += existingStudent.email === email ? ' and index number' : 'index number';
            }
            message += ' already exists.';
            return res.status(409).json({ message });
        }


        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);


        const newStudent = new Student({
            studentName,
            indexNumber,
            email,
            password: hashedPassword,
            isEmailVerified: false,
            bytes: 20,
            class: studentClass,
            stream,
            classTeacher,
            subjectsEnrolled,
            currentQuizSessionId: null // Will be set after quiz session creation
        });


        await newStudent.save();


        // Create initial quiz session with the student's ID
        const initialQuizSession = new QuizSession({
            userId: newStudent._id,
            questionsCompletedCount: 0
        });
        await initialQuizSession.save();


        // Update student with quiz session ID
        newStudent.currentQuizSessionId = initialQuizSession._id;
        await newStudent.save();

        // Create welcome notification
        const welcomeNotification = new Notification({
            student: newStudent._id,
            type: 'system',
            title: 'Welcome to SchoolByte! 🎉',
            message: 'Your learning journey starts here. Explore quizzes, download notes, and earn bytes!',
            read: false,
            data: {
                isWelcome: true
            }
        });
        await welcomeNotification.save();


        res.status(201).json({
            message: 'Student registered successfully! Please verify your email to log in.',
            student: {
                name: studentName,
                email: email,
                class: studentClass,
                stream: stream,
                bytes: newStudent.bytes,
                subjectsEnrolled: subjectsEnrolled
            }
        });


    } catch (error) {
        console.error('Error during student registration:', error);
        if (error.code === 11000) {
            let field = Object.keys(error.keyValue)[0];
            let value = error.keyValue[field];
            return res.status(409).json({ message: `A student with this ${field} '${value}' already exists.` });
        }
        res.status(500).json({ message: 'Server error during registration.', error: error.message });
    }
});


// Enhanced student login
app.post('/login-student', [
    body('email').isEmail().withMessage('Please provide a valid email address.'),
    body('password').notEmpty().withMessage('Password is required.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { email, password } = req.body;


    try {
        const student = await Student.findOne({ email });


        if (!student) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }


        const isMatch = await bcrypt.compare(password, student.password);


        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }


        // Check and reset weekly counters
        await checkAndResetWeeklyCounters(student);


        const token = jwt.sign(
            { 
                id: student._id, 
                email: student.email, 
                studentName: student.studentName, 
                indexNumber: student.indexNumber, 
                role: 'student' 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );


        res.status(200).json({
            message: 'Login successful!',
            token: token,
            student: {
                _id: student._id,
                studentName: student.studentName,
                email: student.email,
                class: student.class,
                stream: student.stream,
                bytes: student.bytes,
                isEmailVerified: student.isEmailVerified,
                subjectsEnrolled: student.subjectsEnrolled
            }
        });


    } catch (error) {
        console.error('Error during student login:', error);
        res.status(500).json({ message: 'Server error during login.', error: error.message });
    }
});


// Send password reset verification code
app.post('/student/send-password-reset-code', [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    try {
        // Check if student exists silently (don't reveal if email exists or not for security)
        const student = await Student.findOne({ email });

        // Only send email if student exists, but always return success message (prevents email enumeration)
        if (student) {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

            // Atomic rate limiting: only update if lastSentAt is old enough or doesn't exist
            // This prevents race conditions from concurrent requests
            const updated = await VerificationCode.findOneAndUpdate(
                { 
                    email,
                    $or: [
                        { lastSentAt: { $exists: false } },
                        { lastSentAt: { $lt: twoMinutesAgo } }
                    ]
                },
                { 
                    email, 
                    code, 
                    lastSentAt: new Date(),
                    createdAt: new Date()
                },
                { 
                    upsert: true, 
                    new: true,
                    setDefaultsOnInsert: true
                }
            );

            // If update failed, it means rate limit was hit
            if (!updated) {
                // Get the existing code to calculate retry time
                const existingCode = await VerificationCode.findOne({ email });
                if (existingCode && existingCode.lastSentAt) {
                    const timeSinceLastSent = Date.now() - existingCode.lastSentAt.getTime();
                    const secondsRemaining = Math.ceil((2 * 60 * 1000 - timeSinceLastSent) / 1000);
                    return res.status(429).json({ 
                        message: `Please wait ${secondsRemaining} seconds before requesting another code.`,
                        retryAfter: secondsRemaining
                    });
                }
            }

            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'SchoolByte - Password Reset Code',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #1a2a6c;">SchoolByte Password Reset</h2>
                        <p>Hello ${student.studentName},</p>
                        <p>You requested to reset your password. Use the code below to proceed:</p>
                        <div style="background: #f0f4f8; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1a2a6c; margin: 20px 0;">
                            ${code}
                        </div>
                        <p><strong>This code will expire in 10 minutes.</strong></p>
                        <p>If you didn't request this, please ignore this email.</p>
                        <p>Best regards,<br>SchoolByte Team</p>
                    </div>
                `
            };

            await transporter.sendMail(mailOptions);
        }

        // Always return success to prevent email enumeration attacks
        res.status(200).json({
            message: 'If a student account exists with this email, a password reset code has been sent.',
            email: email
        });

    } catch (error) {
        console.error('Error sending password reset code:', error);
        res.status(500).json({ message: 'Failed to send reset code. Please try again later.' });
    }
});


// Change password using old password (requires authentication)
app.post('/student/change-password', authenticateToken, [
    body('oldPassword').notEmpty().withMessage('Current password is required.'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { oldPassword, newPassword } = req.body;

    try {
        const student = await Student.findById(req.student.id);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const isMatch = await bcrypt.compare(oldPassword, student.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Current password is incorrect.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        student.password = hashedPassword;
        await student.save();

        res.status(200).json({
            message: 'Password changed successfully!',
            student: {
                studentName: student.studentName,
                email: student.email
            }
        });

    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ message: 'Failed to change password.', error: error.message });
    }
});


// Reset password using verification code (no authentication required)
app.post('/student/reset-password-with-code', [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address.'),
    body('code').notEmpty().withMessage('Verification code is required.'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, code, newPassword } = req.body;

    try {
        const storedCode = await VerificationCode.findOne({ email });
        if (!storedCode) {
            return res.status(400).json({ message: 'No verification code found or it has expired.' });
        }

        if (storedCode.code !== code) {
            return res.status(400).json({ message: 'Invalid verification code.' });
        }

        const student = await Student.findOne({ email });
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        student.password = hashedPassword;
        await student.save();

        await VerificationCode.deleteOne({ email });

        res.status(200).json({
            message: 'Password reset successfully! You can now log in with your new password.',
            student: {
                studentName: student.studentName,
                email: student.email
            }
        });

    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ message: 'Failed to reset password.', error: error.message });
    }
});


// Enhanced student dashboard
app.get('/student/dashboard', authenticateToken, async (req, res) => {
    try {
        // Use req.student.id from the authenticateToken middleware
        const studentData = await Student.findById(req.student.id).select('-password').populate('currentQuizSessionId');


        if (!studentData) {
            return res.status(404).json({ message: 'Student data not found.' });
        }


        await checkAndResetWeeklyCounters(studentData);
        refillEnergy(studentData);
        await studentData.save();

        const today = new Date(); today.setHours(0,0,0,0);
        if (!studentData.lastLoginDate || new Date(studentData.lastLoginDate) < today) {
            studentData.lastLoginDate = new Date();
        }
        const currentMonth = today.toISOString().slice(0,7);
        const monthStudy = (studentData.studyHours || []).find(h => h.month === currentMonth);
        res.status(200).json({
            message: `Welcome to your dashboard, ${studentData.studentName}!`,
            student: {
                _id: studentData._id,
                studentName: studentData.studentName,
                indexNumber: studentData.indexNumber,
                email: studentData.email,
                isEmailVerified: studentData.isEmailVerified,
                bytes: studentData.bytes || 0,
                peakBytes: studentData.peakBytes || 20,
                energy: studentData.energy != null ? studentData.energy : 25,
                lastEnergyRefillAt: studentData.lastEnergyRefillAt,
                class: studentData.class,
                stream: studentData.stream,
                classTeacher: studentData.classTeacher,
                subjectsEnrolled: studentData.subjectsEnrolled,
                firstNameDisplay: studentData.firstNameDisplay,
                preferredName: studentData.preferredName,
                preferences: studentData.preferences,
                quizzesCompletedThisWeek: studentData.quizzesCompletedThisWeek,
                quizSession: studentData.currentQuizSessionId,
                createdAt: studentData.createdAt,
                currentStreak: studentData.currentStreak || 0,
                longestStreak: studentData.longestStreak || 0,
                lastActivityDate: studentData.lastActivityDate,
                studyMinutesThisMonth: monthStudy ? monthStudy.minutes : 0
            }
        });


    } catch (error) {
        console.error('Error accessing student dashboard:', error);
        res.status(500).json({ message: 'Server error accessing dashboard.', error: error.message });
    }
});


// ─── Daily Quote System ────────────────────────────────────────────────────────
const SEED_QUOTES = [
    {
        text: "A leader is one who knows the way, goes the way, and shows the way.",
        author: "John C. Maxwell",
        category: "Leadership",
        context: "John C. Maxwell is one of the world's most influential leadership experts, having written over 80 books on the subject. This quote encapsulates his core philosophy: true leadership is not about position or title, but about example and service. A leader cannot simply point the direction — they must walk it themselves, demonstrating courage, commitment, and integrity in every step. For students, this is a powerful reminder that leadership begins in the classroom: the student who chooses to study when others choose comfort, who lifts a struggling peer, who speaks truth when it costs something — that student is already leading. Leadership is a daily practice, not a destination."
    },
    {
        text: "Education is the most powerful weapon which you can use to change the world.",
        author: "Nelson Mandela",
        category: "Education",
        context: "Nelson Mandela — the anti-apartheid revolutionary, political prisoner of 27 years, and first democratically elected President of South Africa — understood better than almost anyone that oppression thrives in ignorance and crumbles before knowledge. He experienced firsthand how systems of power sought to deny Black South Africans education precisely because the powerful feared what educated people could achieve. This quote is not merely inspirational — it is a strategic truth. Education sharpens critical thinking, unlocks economic opportunity, builds bridges across communities, and equips individuals to challenge injustice with facts and reason. Every lesson you master, every book you read, every concept you truly understand is adding to the most powerful arsenal the world has ever known."
    },
    {
        text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
        author: "Winston Churchill",
        category: "Perseverance",
        context: "Winston Churchill led Britain through its darkest hours during World War II, when defeat seemed not just possible but likely. His nation was bombed nightly, its allies were falling, and the odds were staggering. Yet Churchill refused to surrender — not because he was invincible, but because he understood that resilience is a choice made moment by moment. This quote carries a double truth: first, that even the greatest success does not secure your future (so never become complacent), and second, that even the most crushing failure does not end your story (so never give up). For students facing examinations, setbacks, and difficult chapters, the question is never whether you stumbled — it is whether you had the courage to rise again and keep moving."
    },
    {
        text: "The roots of education are bitter, but the fruit is sweet.",
        author: "Aristotle",
        category: "Education",
        context: "Aristotle, one of history's greatest philosophers and a student of Plato who himself taught Alexander the Great, spent his life pursuing and teaching knowledge across virtually every field of human inquiry — from biology to ethics to politics. He understood deeply that learning is rarely comfortable. The early morning study sessions, the concepts that refuse to make sense at first, the long hours before examinations — these are the bitter roots. But the fruit: the ability to think clearly, to speak with authority, to solve problems that others cannot, to earn a livelihood, to contribute something meaningful to the world — this fruit is incomparably sweet. Aristotle's wisdom reminds us that the discomfort of study is not a sign that something has gone wrong; it is the very proof that you are growing."
    },
    {
        text: "The secret of getting ahead is getting started.",
        author: "Mark Twain",
        category: "Initiative",
        context: "Samuel Langhorne Clemens, known to the world as Mark Twain, was not only America's greatest humorist and satirist but also one of its most practical observers of human nature. He watched people spend enormous energy worrying about tasks they had not yet begun, paralyzed by the gap between where they were and where they wanted to be. His insight is deceptively simple but psychologically profound: the most important step in any journey is the first one. Neuroscience supports this — once we begin a task, our brains activate what is called the Zeigarnik effect, a cognitive pull toward completing what we have started. Procrastination feeds on the gap between thinking about a task and doing it. The moment you open your book, pick up your pen, or write the first sentence, you have already defeated the hardest enemy: inertia."
    },
    {
        text: "It does not matter how slowly you go as long as you do not stop.",
        author: "Confucius",
        category: "Perseverance",
        context: "Confucius, the ancient Chinese philosopher whose teachings shaped East Asian civilization for over two millennia, was a man who faced repeated rejection and failure throughout his life. He traveled from state to state for years seeking a ruler who would implement his principles of moral governance, rarely finding one. Yet he continued to teach, to learn, and to refine his ideas. His insight about pace is liberating: in a world that glorifies speed and instant results, he reminds us that direction and persistence matter far more than velocity. A student who studies one hour every day without fail will surpass one who studies for twelve hours in a panic the night before an examination. Steady, consistent progress — no matter how humble — compounds over time into extraordinary results."
    },
    {
        text: "The beautiful thing about learning is that no one can take it away from you.",
        author: "B.B. King",
        category: "Education",
        context: "Riley B. King, known as B.B. King, was born into sharecropping poverty in rural Mississippi at a time when Black Americans faced violent and systematic oppression. He had limited formal education, yet through relentless self-teaching, he mastered the guitar and became the undisputed King of Blues, influencing virtually every rock and blues musician who came after him. His observation about learning carries a weight born from lived experience: possessions can be stolen, jobs can be lost, circumstances can change overnight — but the knowledge and skills embedded in your mind through genuine learning are yours forever. No flood, no fire, no political upheaval, no economic collapse can reach inside your mind and extract what you have genuinely understood and internalized. Education is the most durable form of wealth."
    },
    {
        text: "Try not to become a man of success but rather try to become a man of value.",
        author: "Albert Einstein",
        category: "Character",
        context: "Albert Einstein, whose name has become synonymous with genius itself, offered this profound distinction late in his life, having witnessed both the triumphs and the catastrophic failures of human civilization, including two world wars and the birth of nuclear weapons — technologies partly derived from his own equations. He understood that success, defined as fame, wealth, or achievement, is hollow without the substance of genuine contribution. A person of value asks: What do I give to the world? What problems do I help solve? Whom do I lift up? A person merely chasing success asks: What can I take? What recognition can I accumulate? For students building their futures, Einstein's challenge is to focus not just on getting high marks or landing prestigious positions, but on developing the character and capabilities that make your presence in the world genuinely better for those around you."
    },
    {
        text: "The mind is not a vessel to be filled but a fire to be kindled.",
        author: "Plutarch",
        category: "Education",
        context: "Plutarch, the Greek biographer and essayist of the first century, understood something that many educational systems have forgotten: learning is not the passive reception of information but the active ignition of curiosity, reasoning, and imagination. A vessel that is merely filled remains dependent on whoever fills it; but a fire, once kindled, generates its own heat and light, spreads to others, and transforms everything it touches. Education that merely transmits facts produces students who can answer questions they have already been asked. Education that kindles the fire of genuine inquiry produces students who can answer questions that have never yet been asked. The goal of your schooling is not to store information — it is to develop the burning desire to keep learning, questioning, and discovering long after your formal studies are complete."
    },
    {
        text: "In the middle of every difficulty lies opportunity.",
        author: "Albert Einstein",
        category: "Resilience",
        context: "Einstein was no stranger to difficulty. He failed his university entrance examination on the first attempt, was rejected for academic positions after graduating, and spent years working in a patent office largely overlooked by the scientific establishment — all while developing the theory of relativity in his spare time. His insight about difficulty and opportunity is not merely optimistic philosophy; it is an observation rooted in how human creativity and problem-solving actually function. Difficulty forces us to look harder, think differently, and question assumptions. The student who struggles with mathematics and refuses to give up often develops a depth of understanding that students who found it easy never achieve. Every hard problem you face is an invitation to become more capable than you were before. The opportunity is not in spite of the difficulty — it is embedded within it."
    },
    {
        text: "You have brains in your head. You have feet in your shoes. You can steer yourself any direction you choose.",
        author: "Dr. Seuss",
        category: "Self-Determination",
        context: "Theodor Seuss Geisel, writing under the pen name Dr. Seuss, created deceptively simple books that carried profoundly serious messages about individuality, courage, and the power of the human mind. This line from 'Oh, the Places You'll Go!' is both a celebration and a responsibility: you possess everything you need to navigate your own life. The 'brains in your head' represent your intellect, curiosity, and capacity to learn and reason — these are always with you. The 'feet in your shoes' represent your agency, your ability to take action, to move, to choose a different path when the current one is not working. The emphasis on steering is crucial: life will present crossroads constantly, and the quality of your choices determines the quality of your journey. Your circumstances, your neighborhood, your background — none of these remove your steering wheel."
    },
    {
        text: "What you get by achieving your goals is not as important as what you become by achieving your goals.",
        author: "Henry David Thoreau",
        category: "Character",
        context: "Henry David Thoreau, the nineteenth-century American philosopher who famously withdrew to Walden Pond to live deliberately and examine the essentials of human existence, was deeply concerned with authenticity — with the question of whether people were truly living their values or merely performing them. His observation about goals redirects our attention from the external reward (the certificate, the grade, the position) to the internal transformation (the discipline built, the resilience forged, the habits of mind developed). When a student pushes through a difficult course, they do not merely receive a qualification — they become someone who can push through difficulty. When a student sets a goal and refuses to abandon it through setbacks, they do not merely reach the goal — they become someone who finishes what they start. The person you are becoming through the pursuit matters infinitely more than the prize at the end."
    },
    {
        text: "Our greatest glory is not in never falling, but in rising every time we fall.",
        author: "Confucius",
        category: "Resilience",
        context: "This principle from Confucius strikes at the heart of what separates those who ultimately succeed from those who do not — and it is not talent, not intelligence, not circumstance. It is the capacity to recover. Confucius observed human nature across decades of teaching and public life, watching brilliant people give up at the first sign of real resistance and watching seemingly ordinary people accomplish extraordinary things through sheer refusal to stay down. Modern research in psychology vindicates this ancient wisdom: the concept of 'grit,' studied extensively by psychologist Angela Duckworth, shows that perseverance and passion for long-term goals predicts achievement far better than talent alone. Every examination you fail and retake, every concept that confuses you before it finally clicks, every goal that required multiple attempts — these are not marks of inadequacy. They are the making of your character."
    },
    {
        text: "The function of education is to teach one to think intensively and to think critically. Intelligence plus character — that is the goal of true education.",
        author: "Martin Luther King Jr.",
        category: "Education",
        context: "Dr. Martin Luther King Jr. delivered this vision of education early in his career, and it stands as one of the most complete and challenging definitions ever offered. He distinguished sharply between intelligence — the capacity to think, reason, and process information — and character — the moral compass that determines how that intelligence is used. History is full of highly intelligent people who used their gifts for destruction, manipulation, and oppression. What education must do, King argued, is not merely sharpen the mind but also cultivate the conscience: the deep sense of right and wrong, the commitment to justice, the empathy for those who suffer, the courage to speak and act truthfully even when silence would be more comfortable. A student who leaves school with top marks but no integrity has received only half an education."
    },
    {
        text: "I have not failed. I've just found 10,000 ways that won't work.",
        author: "Thomas Edison",
        category: "Perseverance",
        context: "Thomas Edison, who held more patents than virtually any inventor in history and whose work gave the world the practical electric light bulb, the phonograph, and hundreds of other transformative technologies, is one of history's most compelling examples of perseverance. The popular story is that he failed thousands of times before inventing the working light bulb — but Edison's own frame for this is what matters most: he did not experience these attempts as failures. Each one was data. Each one narrowed the field of remaining possibilities. Each one made the eventual solution more inevitable. This reframing of failure as information rather than verdict is one of the most powerful mental shifts available to a student. When a technique for solving a problem does not work, you have not failed — you have successfully identified something that does not work, and that is genuine progress."
    },
    {
        text: "The only way to do great work is to love what you do.",
        author: "Steve Jobs",
        category: "Excellence",
        context: "Steve Jobs, who co-founded Apple and presided over some of the most influential product designs in modern history — the Macintosh, the iPod, the iPhone — believed with fierce conviction that passion was not a luxury in the pursuit of excellence but an absolute requirement. His insight is not simply motivational; it is practical. The level of care, detail-orientation, creative problem-solving, and willingness to iterate relentlessly that great work demands is simply not sustainable without genuine love for the work. This does not mean every task in school will fill you with joy — it rarely does. But it does mean that finding the subjects, problems, and ideas that genuinely ignite your curiosity and then pursuing them with everything you have is not indulgence. It is the foundation of meaningful, excellent work. The quality of your attention is highest when your heart is engaged."
    },
    {
        text: "Knowledge is power.",
        author: "Sir Francis Bacon",
        category: "Education",
        context: "Sir Francis Bacon, the sixteenth-century English philosopher and statesman often called the father of empiricism and the scientific method, understood power not as military force or political authority but as the human capacity to understand and therefore shape the natural world. His famous phrase 'scientia potentia est' — knowledge is power — was a revolutionary declaration in an age when most people accepted the world as fixed, mysterious, and beyond human influence. Bacon's philosophy gave birth to the scientific revolution and, eventually, to everything from modern medicine to space exploration to the smartphone in your pocket. For students, his insight operates at both the personal and collective levels: the person who understands how things work has power over their circumstances that the ignorant person lacks. And the society that invests in knowledge production — in schools, in universities, in research — grows stronger, healthier, and more free."
    },
    {
        text: "Strive not to be a success, but rather to be of value.",
        author: "Albert Einstein",
        category: "Purpose",
        context: "Einstein returned to this theme repeatedly because he had watched firsthand how the pursuit of success for its own sake could corrupt both individuals and civilizations. He had seen brilliant scientists place their gifts in service of political ideologies that brought catastrophe to millions. His reminder to strive for value rather than success is a call to orient your life around contribution — around the fundamental question: What does the world need, and what can I offer it? This reorientation has a practical dimension as well: people who are genuinely useful tend to attract opportunities, earn respect, and build lasting careers, while those who chase success for its own sake often find it hollow even when they achieve it. Being of value means asking not 'How do I look?' but 'What do I solve?' — not 'Am I impressive?' but 'Am I helpful?'"
    },
    {
        text: "An investment in knowledge pays the best interest.",
        author: "Benjamin Franklin",
        category: "Education",
        context: "Benjamin Franklin — who was simultaneously a printer, author, inventor, scientist, diplomat, and Founding Father of the United States — was profoundly self-educated, having left formal school at age ten and taught himself almost everything he knew through voracious reading, deliberate practice, and relentless intellectual curiosity. His financial metaphor for education is precise: unlike money invested in stocks or property, which can be lost to market crashes, theft, or bad luck, knowledge invested in your mind compounds continuously and cannot be taken from you. Franklin's own life was the proof: his self-education in science led to the discovery of electricity's nature; his mastery of writing built his printing empire; his study of diplomacy made him the most effective American statesman of his era. Every hour you invest in genuine learning earns dividends across your entire lifetime."
    },
    {
        text: "The future belongs to those who believe in the beauty of their dreams.",
        author: "Eleanor Roosevelt",
        category: "Vision",
        context: "Eleanor Roosevelt, who transformed the role of First Lady from a ceremonial position into a platform for human rights advocacy, championed the Universal Declaration of Human Rights and spoke truth to power throughout her decades of public life, understood that social change begins with people who dare to imagine a world different from the one they inhabit. Her insight about dreams is not wishful thinking — it is a description of how all human progress begins: with the conviction that what does not yet exist can exist. Scientists dream of cures before they find them; architects dream of buildings before they design them; leaders dream of justice before they can deliver it. For students, believing in the beauty of your dreams means refusing to let limited circumstances set the ceiling of your ambitions. The future is genuinely open, and it is shaped by those with the courage and belief to envision it differently."
    },
    {
        text: "Hard work beats talent when talent doesn't work hard.",
        author: "Tim Notke",
        category: "Work Ethic",
        context: "Basketball coach Tim Notke coined this phrase, later popularized by NBA legend Kevin Durant, in the context of athletic competition — but its truth extends to virtually every domain of human endeavor. The research of psychologist K. Anders Ericsson into expert performance found that world-class mastery in any field — music, chess, sports, science — is achieved through approximately 10,000 hours of deliberate, focused practice. Talent provides an initial advantage in learning speed, but it is not self-sustaining. Without the discipline of sustained effort, even the most gifted individuals plateau and are eventually overtaken by those who outwork them. History is full of extraordinarily talented people who never reached their potential because they relied on natural ability rather than developing the habits of deliberate, consistent, focused work. Every student who lacks 'natural talent' but refuses to stop improving has a secret weapon: effort."
    },
    {
        text: "The more that you read, the more things you will know. The more that you learn, the more places you'll go.",
        author: "Dr. Seuss",
        category: "Learning",
        context: "Dr. Seuss distilled in a single couplet what cognitive scientists have spent decades documenting: reading is the single most powerful habit available to any learner. Each book you read expands your vocabulary, which sharpens your ability to think and communicate with precision. Each new subject you explore creates neural pathways that connect with existing knowledge, making future learning faster and richer. The 'places you'll go' are not only metaphorical — readers statistically earn more, rise to leadership more often, adapt to change more effectively, and report higher life satisfaction than non-readers. But the most profound benefit of reading is internal: it colonizes your imagination with other lives, other worlds, and other ways of thinking, making you more empathetic, more creative, and more capable of understanding complex situations. A student who reads widely for pleasure, not just for examinations, is building the greatest possible foundation for their future."
    },
    {
        text: "You must be the change you wish to see in the world.",
        author: "Mahatma Gandhi",
        category: "Leadership",
        context: "Mohandas Karamchand Gandhi, who led India's nonviolent independence movement against the British Empire through decades of personal sacrifice, imprisonment, fasting, and moral courage, understood that political and social transformation cannot be separated from personal transformation. This quote is often treated as a soft inspirational message, but in Gandhi's hands it was a radical political philosophy: systemic change requires individuals who embody the values they seek to institutionalize. A society cannot become more honest if its members will not be honest in small things. A community cannot become more just if its individuals will not treat those around them justly. For students, this means that the work of changing Uganda, of improving your community, of contributing to Africa's future, does not begin in parliament or boardrooms — it begins in how you treat the student sitting next to you, whether you choose integrity over convenience, and whether your daily actions reflect your stated values."
    },
    {
        text: "I am not afraid of storms, for I am learning how to sail my ship.",
        author: "Louisa May Alcott",
        category: "Resilience",
        context: "Louisa May Alcott, the nineteenth-century American author who wrote 'Little Women' while supporting her family financially through her writing, lived a life that demanded constant navigation of hardship — poverty, illness, the demands of caring for others while pursuing her own artistic ambitions. Her sailing metaphor is instructive: she does not say the storms are not real, or that they do not matter, or that she wishes them away. She says she is learning to sail through them. This distinction is everything. Resilience is not the absence of fear or difficulty; it is the gradual accumulation of skills, confidence, and experience in navigating difficulty. Every challenge you face in school — the subject that refuses to make sense, the examination that humbles you, the teacher whose standards feel impossibly high — is a storm through which you are developing your sailing ability. The difficulty is the training."
    },
    {
        text: "It always seems impossible until it's done.",
        author: "Nelson Mandela",
        category: "Determination",
        context: "Mandela spoke these words with the authority of someone who had pursued the end of apartheid for decades while imprisoned, watching his cause appear hopeless to the outside world. He spent 27 years on Robben Island — 27 years when the overthrow of apartheid must have seemed not just impossible but fantastical. Yet it was done. This quote is not an assertion that everything is achievable — it is an observation about human psychology and the nature of undertaking genuinely hard things. Before we begin, our imagination runs ahead to all the obstacles, the failures, the ways the task exceeds our current capabilities — and this preview of difficulty makes the goal seem impossible. But the person who begins anyway, who acts on the belief that it can be done even when the evidence is not yet available, is the person who eventually creates the evidence. Doing begins before certainty."
    },
    {
        text: "The expert in anything was once a beginner.",
        author: "Helen Hayes",
        category: "Growth",
        context: "Helen Hayes, known as the 'First Lady of American Theatre' and one of only a handful of entertainers ever to achieve the EGOT (Emmy, Grammy, Oscar, and Tony), began her career as a child performer making countless mistakes before an audience. Her reminder about expertise and beginnings is both humbling and liberating. Every person you admire for their mastery — your most brilliant teacher, the scientist whose discovery you are studying, the leader whose biography inspires you — was once exactly where you are now: uncertain, unskilled, making errors, feeling overwhelmed by how much there was to learn. The difference between them and someone who never achieved mastery is not initial talent but the willingness to endure the beginner stage without quitting. Expertise is accumulated through thousands of hours of being imperfect at something you care about enough to keep trying. You are not behind — you are in the process."
    },
    {
        text: "Live as if you were to die tomorrow. Learn as if you were to live forever.",
        author: "Mahatma Gandhi",
        category: "Learning",
        context: "Gandhi's dual imperative captures two equally important but seemingly contradictory orientations toward time. 'Live as if you were to die tomorrow' is a call to presence, urgency, and priority: do not postpone kindness, do not defer your values, do not wait until circumstances are perfect to begin living with intention. 'Learn as if you were to live forever' is an equally urgent call in the opposite direction: invest in knowledge and growth with the long-term vision of someone who understands that wisdom compounds over a lifetime. Together, these two imperatives create the posture of a fully engaged life: present in each day's choices and conversations, while simultaneously building the depth of understanding that will serve you across decades. For students, this means bringing full attention to today's studies while maintaining the long-term perspective that each lesson learned is a brick in the structure of your life's contribution."
    },
    {
        text: "In learning you will teach, and in teaching you will learn.",
        author: "Phil Collins",
        category: "Education",
        context: "Phil Collins, the legendary British musician, captured in this lyric a feedback loop that educators and cognitive scientists have studied extensively. Research on the 'Protégé Effect' demonstrates that people learn material significantly better when they know they will have to teach it to someone else — the anticipation of teaching forces deeper engagement, more complete organization of information, and the identification of gaps in understanding. Conversely, teachers consistently report that their own understanding of their subjects deepens through the act of explaining, answering student questions, and encountering the unexpected angles from which learners approach material. For students, this insight has immediate practical value: the most powerful study technique available is to take what you have learned and attempt to teach it — to a study group, to a younger sibling, to an imaginary student. Where your explanation falters, your understanding has faltered too. Fix the explanation, and you fix the understanding."
    },
    {
        text: "Courage is not the absence of fear, but the triumph over it.",
        author: "Nelson Mandela",
        category: "Courage",
        context: "Mandela's definition of courage corrects a widespread misunderstanding that creates unnecessary shame and self-doubt: many people assume that fear means they lack courage, and that the courageous person simply does not feel afraid. But Mandela — who was genuinely afraid during his years of resistance, imprisonment, and the constant threat of violence — understood that courage is not a feeling but a decision. It is the choice to act rightly, speak truthfully, or persevere faithfully in the presence of fear rather than in its absence. This reframes every difficult moment in a student's life: the fear before an important examination is not weakness — acting despite it is courage. The anxiety before speaking in public is not inadequacy — speaking anyway is courage. The uncertainty before attempting a difficult problem is not incompetence — beginning despite the uncertainty is courage. Fear confirms that what you are doing matters. Courage is what you do next."
    },
    {
        text: "Talent wins games, but teamwork and intelligence win championships.",
        author: "Michael Jordan",
        category: "Collaboration",
        context: "Michael Jordan, widely regarded as the greatest basketball player in history, delivered this insight after experiencing it directly. In his early career, Jordan was so transcendently talented that he could dominate individual games through sheer personal brilliance — yet his teams consistently fell short of championships. It was only when he learned to trust, elevate, and coordinate with his teammates that the Chicago Bulls built their dynasty of six NBA titles. The lesson scales far beyond sport: virtually every significant human achievement — scientific breakthroughs, great art, thriving communities, successful nations — is a product of coordinated human effort, not individual brilliance acting alone. The school environment is a training ground not just for knowledge but for the collaborative intelligence needed to solve problems too complex for any single mind. Learn to work with others, listen genuinely, contribute your strengths, and honor others' contributions."
    }
];

// Seed the quote pool if empty
async function seedQuotesIfEmpty() {
    try {
        const count = await DailyQuote.countDocuments();
        if (count === 0) {
            await DailyQuote.insertMany(SEED_QUOTES.map(q => ({ ...q, seenBy: [], aiGenerated: false })));
            console.log(`✓ Seeded ${SEED_QUOTES.length} daily quotes into the pool.`);
        }
    } catch (e) {
        console.warn('Quote seed error:', e.message);
    }
}
// Trigger seed after DB connects (mongoose emits 'connected')
mongoose.connection.once('open', seedQuotesIfEmpty);

// GET /student/daily-quote — return an unseen quote; AI-generate if pool exhausted
app.get('/student/daily-quote', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;

        // Find a random quote the student has NOT seen
        const unseen = await DailyQuote.aggregate([
            { $match: { seenBy: { $nin: [new mongoose.Types.ObjectId(studentId)] } } },
            { $sample: { size: 1 } }
        ]);

        if (unseen.length > 0) {
            const quote = unseen[0];
            // Mark as seen
            await DailyQuote.updateOne({ _id: quote._id }, { $addToSet: { seenBy: studentId } });
            return res.json({
                _id: quote._id,
                text: quote.text,
                author: quote.author,
                category: quote.category,
                context: quote.context
            });
        }

        // Pool exhausted for this student — generate a fresh one via Groq
        const systemPrompt = `You are a motivational quote curator for SchoolByte, an educational platform serving Ugandan secondary school students (ages 13-19, Senior 1 to Senior 6). Your task is to generate an original, deeply meaningful motivational or educational quote with rich context. The quote must be suitable for young African students navigating academic challenges, personal growth, and building their futures.`;

        const userPrompt = `Generate a unique motivational quote for a secondary school student. Return ONLY a valid JSON object (no markdown, no code fences) with exactly these fields:
{
  "text": "the quote text itself (original or attributed to a real person)",
  "author": "the person who said it (use a real historical or contemporary figure, or 'Unknown')",
  "category": "one of: Leadership, Education, Perseverance, Character, Resilience, Excellence, Wisdom, Courage, Vision, Growth, Determination",
  "context": "a deeply detailed, 5-8 sentence explanation of: who the author is and their background, what the quote means philosophically and practically, why it is particularly relevant to students, and how a student can apply this wisdom in their daily academic and personal life. Be rich, specific, and engaging."
}`;

        let raw = '';
        try {
            raw = await callGroqAI(userPrompt, systemPrompt, { max_tokens: 900, temperature: 0.85, retries: 2 });
            // Strip markdown fences if present
            raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(raw);
            if (!parsed.text || !parsed.author) throw new Error('Missing fields');

            const newQuote = await DailyQuote.create({
                text: parsed.text,
                author: parsed.author,
                category: parsed.category || 'Motivation',
                context: parsed.context || '',
                seenBy: [studentId],
                aiGenerated: true
            });

            return res.json({
                _id: newQuote._id,
                text: newQuote.text,
                author: newQuote.author,
                category: newQuote.category,
                context: newQuote.context
            });
        } catch (aiError) {
            console.error('AI quote generation failed:', aiError.message, '| raw:', raw.slice(0, 200));
            // Fallback: reset seen list for this student and return the first quote
            const fallback = await DailyQuote.findOne({}).sort({ createdAt: 1 });
            if (fallback) {
                await DailyQuote.updateOne({ _id: fallback._id }, { $addToSet: { seenBy: studentId } });
                return res.json({ _id: fallback._id, text: fallback.text, author: fallback.author, category: fallback.category, context: fallback.context });
            }
            return res.status(503).json({ message: 'Quote service temporarily unavailable.' });
        }

    } catch (error) {
        console.error('Daily quote error:', error);
        res.status(500).json({ message: 'Failed to fetch daily quote.' });
    }
});

// Enhanced Quiz Generation Endpoint
app.get('/student/quizzes/generate', authenticateToken, async (req, res) => {
    try {
        // Use req.student.id from the authenticateToken middleware
        const student = await Student.findById(req.student.id);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }


        await checkAndResetWeeklyCounters(student);
        refillEnergy(student);
        const weeklyLimit = 50;

        if (student.quizzesCompletedThisWeek >= weeklyLimit) {
            return res.status(429).json({
                message: 'You have reached your weekly quiz limit. Please try again next week!',
                limit: weeklyLimit,
                completed: student.quizzesCompletedThisWeek
            });
        }

        const energy = (student.energy != null ? student.energy : 25);
        if (energy < 1) {
            return res.status(402).json({
                message: 'Not enough energy. Energy refills 1 per hour (max 25).',
                energy: student.energy
            });
        }

        let schemaResult = await generateQuizQuestions(student, req.query.subject);

        // Normalise: generateQuizQuestions returns either a plain array (all DB) or
        // { questions, gaps, division, studentClass } when some slots had no DB match.
        let questions = [];
        let schemaGaps = [];
        let schemaDivision = getDivision(student.class);
        let schemaClass = student.class;

        if (Array.isArray(schemaResult)) {
            questions = schemaResult;
        } else {
            questions = schemaResult.questions || [];
            schemaGaps = schemaResult.gaps || [];
            schemaDivision = schemaResult.division || schemaDivision;
            schemaClass = schemaResult.studentClass || schemaClass;
        }

        // AI fill-in: invoked when the DB could not satisfy one or more slots
        if (schemaGaps.length > 0) {
            console.log(`Fats & Beef schema found ${questions.length} DB questions; AI filling ${schemaGaps.length} gap(s).`);

            try {
                // Describe the division/slot system to the AI
                const divisionDescriptions = {
                    lower: 'Lower School (S.1–S.2): 12 subjects, 120-question cycles',
                    middle: 'Middle School (S.3–S.4): 9 subjects, 90-question cycles',
                    upper: 'Upper School (S.5–S.6): 4 principal subjects, 40-question cycles'
                };
                const categoryDescriptions = {
                    usual: `"usual" — a standard question at the student's own class level (${schemaClass}). This is core curriculum content.`,
                    stretch: `"stretch" — a challenge question one class level ABOVE ${schemaClass}. It is intentionally harder to push the student beyond their current grade.`,
                    revision: `"revision" — a reinforcement question from a class level BELOW ${schemaClass}. It consolidates prior knowledge.`
                };

                // Build per-gap instructions
                const gapInstructions = schemaGaps.map((g, i) => {
                    const classTarget = g.intendedClasses && g.intendedClasses.length > 0
                        ? g.intendedClasses.join(' or ')
                        : schemaClass;
                    const catDesc = categoryDescriptions[g.category] || `category: ${g.category}`;
                    return `Gap ${i + 1} (quiz slot ${g.slot}):
  - Subject: ${g.subject}
  - Target class level: ${classTarget}
  - Slot category: ${catDesc}`;
                }).join('\n\n');

                const systemPrompt = `You are an expert educational quiz question generator for Ugandan secondary school students.
Your output must be a single, valid JSON object — nothing else. Do not add prose, markdown, or code fences.

QUIZ STRUCTURE (Fats & Beef Schema):
Every quiz has 10 slots designed for balanced, curriculum-aligned learning:
  - Slot 1       → STRETCH   (one class above the student — challenges growth)
  - Slots 2–8   → USUAL     (student's own class — core curriculum)
  - Slots 9–10  → REVISION  (one or more classes below — consolidates prior knowledge)

STUDENT PROFILE:
  - Current class: ${schemaClass}
  - Division: ${divisionDescriptions[schemaDivision] || schemaDivision}

EDUCATIONAL QUALITY STANDARDS:
  - Questions must test genuine understanding, critical thinking, and application — not just recall.
  - Use real-world contexts, examples, and scenarios relevant to Uganda where possible.
  - Stretch questions should require analysis or synthesis beyond the student's grade.
  - Revision questions should reinforce fundamental concepts from earlier classes.
  - Usual questions should cover core curriculum topics at the exact class level specified.
  - Every question must have a clear, unambiguous correct answer.
  - Hints should guide thinking without giving the answer away.
  - Explanations must be thorough and teach the concept, not just state the answer.
  - keywordsForGrading are the essential terms/phrases that must appear in a correct open-ended answer.

ALLOWED QUESTION TYPES (use the exact string values below):
  1. "multiple-choice-single"  — 4 options, exactly 1 correct. Requires: options[], correctAnswers[].
  2. "multiple-choice-multi"   — 4+ options, 2+ correct. Requires: options[], correctAnswers[].
  3. "true-false"              — exactly 2 options ("True"/"False"). Requires: options[], correctAnswers[].
  4. "fill-in-the-blank"       — sentence with a blank. Requires: correctAnswers[], keywordsForGrading[].
  5. "short-answer"            — open-ended written response. Requires: correctAnswers[], keywordsForGrading[].
  6. "matching"                — match column A to column B. Requires: matchingPairs[{itemA, itemB}].
  7. "ordering"                — arrange items in correct sequence. Requires: orderedItems[] (correct order).
  8. "problem-solving"         — multi-step problem (maths, science, logic). Requires: correctAnswers[], explanation.
  9. "numeric-entry"           — exact numeric answer. Requires: correctAnswers[] (numeric string).

Vary the question types across the gaps — do NOT default to only multiple-choice.`;

                const userPrompt = `Generate exactly ${schemaGaps.length} quiz question(s) to fill the following gap(s) left by the database.
Each question must strictly match the subject, class level, and slot category described.

${gapInstructions}

Return ONLY this JSON structure (no extra keys, no trailing text):
{
  "questions": [
    {
      "slot": <quiz slot number (integer)>,
      "subject": "<exact subject name>",
      "intendedClass": "<exact class string, e.g. S.2>",
      "category": "<stretch|usual|revision>",
      "type": "<one of the 9 allowed types>",
      "questionText": "<full, clear question>",
      "options": [
        {"text": "<option text>", "isCorrect": <true|false>}
      ],
      "correctAnswers": ["<answer 1>"],
      "matchingPairs": [{"itemA": "<left>", "itemB": "<right>"}],
      "orderedItems": ["<item in correct position 1>", "..."],
      "instructions": "<brief instructions if the question type needs them>",
      "hint": "<subtle hint that guides without revealing the answer>",
      "explanation": "<thorough explanation of why the answer is correct and what concept it teaches>",
      "topic": "<specific curriculum topic>",
      "subTopic": "<sub-topic within that topic>",
      "keywordsForGrading": ["<key term 1>", "<key term 2>"],
      "maxBytesRewardPerQuestion": 1
    }
  ]
}

Notes:
- Include "options" only for multiple-choice-single, multiple-choice-multi, and true-false.
- Include "matchingPairs" only for matching type.
- Include "orderedItems" only for ordering type.
- Include "correctAnswers" for all types except matching and ordering.
- "keywordsForGrading" is required for short-answer and fill-in-the-blank, optional but encouraged for others.
- Do not omit "hint" or "explanation" — they are essential for learning.
IMPORTANT: Respond ONLY with valid JSON. Start with { and end with }.`;

                const responseText = await callGroqAI(
                    userPrompt,
                    systemPrompt,
                    { temperature: 0.7, num_predict: 3000, timeout: 90000, retries: 2 }
                );

                const aiResponse = extractJSON(responseText);

                const aiQuestionDocs = (aiResponse.questions || []).map(q => ({
                    questionText: q.questionText,
                    subject: q.subject || (schemaGaps[0] && schemaGaps[0].subject) || student.subjectsEnrolled[0],
                    intendedClass: q.intendedClass || schemaClass,
                    type: q.type,
                    options: q.options || [],
                    correctAnswers: q.correctAnswers || [],
                    matchingPairs: q.matchingPairs || [],
                    orderedItems: q.orderedItems || [],
                    instructions: q.instructions || '',
                    hint: q.hint || '',
                    explanation: q.explanation || '',
                    topic: q.topic || '',
                    subTopic: q.subTopic || '',
                    keywordsForGrading: (q.keywordsForGrading || []).map(k => k.toLowerCase().trim()),
                    maxBytesRewardPerQuestion: q.maxBytesRewardPerQuestion || 1,
                    isActive: true,
                    uploadedBy: { teacherName: 'AI Generated' }
                }));

                // Save AI questions to DB so the submit endpoint can find and grade them
                let savedAiQuestions = [];
                try {
                    savedAiQuestions = await QuizQuestion.insertMany(aiQuestionDocs, { ordered: false });
                } catch (insertErr) {
                    // ordered:false — partial inserts are ok; use whatever was saved
                    savedAiQuestions = insertErr.insertedDocs || [];
                    console.warn('Some AI questions failed to save:', insertErr.message);
                }

                questions = [...questions, ...savedAiQuestions];
                console.log(`AI filled ${savedAiQuestions.length} gap(s); quiz now has ${questions.length} question(s).`);
            } catch (aiError) {
                console.error('AI gap-fill failed:', aiError);
                if (questions.length === 0) {
                    return res.status(404).json({
                        message: 'No suitable questions found. Please try again later.'
                    });
                }
                // Proceed with whatever DB questions we have
                console.log(`Proceeding with ${questions.length} DB question(s) after AI failure.`);
            }
        }

        await Student.updateOne({ _id: req.student.id }, { $inc: { energy: -1 } });

        // Return questions without correct answers
        const sanitizedQuestions = questions.map(q => ({
            _id: q._id,
            questionText: q.questionText,
            subject: q.subject,
            intendedClass: q.intendedClass,
            type: q.type,
            options: q.options ? q.options.map(opt => ({ text: opt.text })) : undefined,
            matchingPairs: q.matchingPairs,
            orderedItems: q.orderedItems,
            instructions: q.instructions,
            hint: q.hint,
            topic: q.topic,
            uploadedBy: { teacherName: q.uploadedBy.teacherName }
        }));


        res.status(200).json({
            message: 'Quiz questions generated successfully!',
            questions: sanitizedQuestions,
            totalQuestions: sanitizedQuestions.length,
            metadata: {
                studentClass: student.class,
                questionsThisWeek: student.quizzesCompletedThisWeek,
                weeklyLimit: weeklyLimit
            }
        });


    } catch (error) {
        console.error('Error generating quiz questions:', error);
        res.status(500).json({ message: 'Failed to generate quiz questions.', error: error.message });
    }
});



app.post('/student/quizzes/generate-ai', authenticateToken, [
    body('subject').notEmpty().withMessage('Subject is required.').trim(),
    body('topic').optional().trim(),
    body('questionType').optional().isIn([
        'short-answer', 'multiple-choice-single', 'multiple-choice-multi',
        'true-false', 'fill-in-the-blank', 'problem-solving', 'numeric-entry'
    ]),
    body('numberOfQuestions').optional().isInt({ min: 1, max: 5 }).withMessage('Number of questions must be between 1 and 5.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    if (!genAI) {
        return res.status(503).json({ 
            message: 'AI quiz generation is currently unavailable. Please use the regular quiz mode.' 
        });
    }

    try {
        const studentId = req.student.id;
        const student = await Student.findById(studentId);

        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        await checkAndResetWeeklyCounters(student);
        const weeklyLimit = 50;

        if (student.quizzesCompletedThisWeek >= weeklyLimit) {
            return res.status(429).json({ 
                message: 'You have reached your weekly quiz limit. Please try again next week!',
                limit: weeklyLimit,
                completed: student.quizzesCompletedThisWeek
            });
        }

        const { subject, topic, questionType, numberOfQuestions } = req.body;
        const intendedClass = student.class;
        const numQuestions = Math.min(numberOfQuestions || 3, 5);
        const qType = questionType || 'multiple-choice-single';

        const topicContext = topic ? `Topic: ${topic}` : 'Generate questions covering various relevant topics within the subject.';

        let optionsExample = '';
        let answersExample = '';

        if (qType === 'multiple-choice-single') {
            optionsExample = `"options": [
        {"text": "Option A text", "isCorrect": false},
        {"text": "Option B text", "isCorrect": true},
        {"text": "Option C text", "isCorrect": false},
        {"text": "Option D text", "isCorrect": false}
      ],`;
        } else if (qType === 'multiple-choice-multi') {
            optionsExample = `"options": [
        {"text": "Option A text", "isCorrect": true},
        {"text": "Option B text", "isCorrect": true},
        {"text": "Option C text", "isCorrect": false},
        {"text": "Option D text", "isCorrect": true}
      ],`;
        } else if (['short-answer', 'problem-solving', 'fill-in-the-blank'].includes(qType)) {
            answersExample = `"correctAnswers": ["primary answer", "alternative answer"],
      "keywordsForGrading": ["keyword1", "keyword2", "keyword3"],`;
        } else if (qType === 'true-false') {
            answersExample = `"correctAnswers": ["true"],`;
        } else if (qType === 'numeric-entry') {
            answersExample = `"correctAnswers": ["42"],`;
        }

        const prompt = `You are an expert teacher creating engaging quiz questions for a Ugandan secondary school student.

Generate ${numQuestions} high-quality, educational ${qType} question(s) for:
- Subject: ${subject}
- Class Level: ${intendedClass}
- ${topicContext}

Requirements:
1. Questions must be age-appropriate and aligned with ${intendedClass} curriculum
2. Questions should be challenging but fair for the student's level
3. Use clear, precise language
${qType === 'multiple-choice-single' ? '4. For multiple-choice-single questions, provide exactly 4 options with EXACTLY ONE option marked isCorrect: true' : ''}
${qType === 'multiple-choice-multi' ? '4. For multiple-choice-multi questions, provide 4 options with MULTIPLE options marked isCorrect: true (at least 2)' : ''}
${['short-answer', 'problem-solving'].includes(qType) ? '4. For short-answer/problem-solving questions, provide multiple acceptable answer variations and 5-8 keywords for grading' : ''}
${qType === 'true-false' ? '4. For true-false questions, correctAnswers must be EXACTLY ["true"] or EXACTLY ["false"] - no other format' : ''}
${qType === 'numeric-entry' ? '4. For numeric-entry questions, provide the numeric answer as a string' : ''}
5. Include helpful hints and detailed explanations to promote learning
6. Make questions engaging and relevant to students in Uganda

Output Format (strict JSON):
{
  "questions": [
    {
      "questionText": "Clear, specific question text",
      "type": "${qType}",
      ${optionsExample}
      ${answersExample}
      "hint": "Helpful hint that guides without giving away the answer",
      "explanation": "Detailed explanation of why the answer is correct and the concept behind it",
      "topic": "Specific topic name",
      "skillType": ["Skill category like Application, Analysis, etc."]
    }
  ]
}`;

        // Call TinyLlama via Ollama with robust error handling
        const responseText = await callGroqAI(
            prompt + "\n\nIMPORTANT: Respond ONLY with valid JSON. Start with { and end with }.",
            "You are an educational quiz question generator AI. Generate questions in valid JSON format only.",
            { temperature: 0.7, num_predict: 2500, timeout: 90000, retries: 2 }
        );

        const parsedResponse = extractJSON(responseText);

        if (!parsedResponse.questions || !Array.isArray(parsedResponse.questions)) {
            throw new Error('AI response did not match expected format.');
        }

        const validatedQuestions = [];
        for (const aiQuestion of parsedResponse.questions) {
            if (!aiQuestion.questionText || !aiQuestion.questionText.trim()) {
                console.warn('Invalid question: missing or empty questionText');
                continue;
            }

            if (qType === 'multiple-choice-single' || qType === 'multiple-choice-multi') {
                if (!Array.isArray(aiQuestion.options) || aiQuestion.options.length !== 4) {
                    console.warn(`Invalid multiple-choice question: has ${aiQuestion.options?.length || 0} options, expected exactly 4`);
                    continue;
                }

                let validOptions = true;
                const correctOptions = [];
                for (const opt of aiQuestion.options) {
                    if (!opt.text || typeof opt.text !== 'string' || !opt.text.trim()) {
                        console.warn('Invalid multiple-choice question: option missing text');
                        validOptions = false;
                        break;
                    }
                    if (typeof opt.isCorrect !== 'boolean') {
                        console.warn('Invalid multiple-choice question: option missing or invalid isCorrect boolean');
                        validOptions = false;
                        break;
                    }
                    if (opt.isCorrect === true) {
                        correctOptions.push(opt.text);
                    }
                }
                if (!validOptions) continue;

                const correctCount = correctOptions.length;

                if (qType === 'multiple-choice-single' && correctCount !== 1) {
                    console.warn(`Invalid multiple-choice-single question: has ${correctCount} correct answers, expected exactly 1`);
                    continue;
                }

                if (qType === 'multiple-choice-multi' && correctCount < 2) {
                    console.warn(`Invalid multiple-choice-multi question: has ${correctCount} correct answers, expected at least 2`);
                    continue;
                }

                if (!Array.isArray(aiQuestion.correctAnswers) || aiQuestion.correctAnswers.length !== correctCount) {
                    console.warn('Multiple-choice question: correctAnswers array missing or incorrect length, auto-generating from isCorrect flags');
                    aiQuestion.correctAnswers = correctOptions;
                } else {
                    const answersSet = new Set(aiQuestion.correctAnswers);
                    const correctSet = new Set(correctOptions);
                    const isMatch = answersSet.size === correctSet.size && 
                                   [...answersSet].every(ans => correctSet.has(ans));

                    if (!isMatch) {
                        console.warn('Multiple-choice question: correctAnswers array does not match isCorrect flags, overwriting with correct values');
                        aiQuestion.correctAnswers = correctOptions;
                    }
                }
            } else if (qType === 'true-false') {
                if (!Array.isArray(aiQuestion.correctAnswers) || aiQuestion.correctAnswers.length !== 1) {
                    console.warn(`Invalid true-false question: correctAnswers must be array with exactly 1 element, got ${aiQuestion.correctAnswers?.length || 0}`);
                    continue;
                }
                const answer = aiQuestion.correctAnswers[0];
                if (answer !== 'true' && answer !== 'false') {
                    console.warn(`Invalid true-false question: answer is "${answer}", expected exactly "true" or "false"`);
                    continue;
                }
            } else if (['short-answer', 'problem-solving', 'fill-in-the-blank'].includes(qType)) {
                if (!aiQuestion.keywordsForGrading || aiQuestion.keywordsForGrading.length < 2) {
                    console.warn(`Invalid ${qType} question: insufficient keywords for grading (has ${aiQuestion.keywordsForGrading?.length || 0}, expected at least 2)`);
                    continue;
                }
            }

            validatedQuestions.push(aiQuestion);
        }

        if (validatedQuestions.length === 0) {
            throw new Error('No valid questions generated by AI. Please try again.');
        }

        const sanitizedQuestions = validatedQuestions.map(q => ({
            questionText: q.questionText,
            subject: subject,
            intendedClass: intendedClass,
            type: qType,
            options: q.options ? q.options.map(opt => ({ text: opt.text })) : undefined,
            instructions: q.instructions || '',
            hint: q.hint || '',
            topic: q.topic || topic || '',
            aiGenerated: true,
            rawQuestion: q
        }));

        res.status(200).json({
            message: 'AI-powered quiz questions generated successfully!',
            questions: sanitizedQuestions,
            totalQuestions: sanitizedQuestions.length,
            metadata: {
                studentClass: student.class,
                questionsThisWeek: student.quizzesCompletedThisWeek,
                weeklyLimit: weeklyLimit,
                aiGenerated: true
            }
        });

    } catch (error) {
        console.error('Error generating AI quiz questions for student:', error);
        res.status(500).json({ 
            message: 'Failed to generate AI quiz questions. Please try the regular quiz mode.', 
            error: error.message 
        });
    }
});

// Enhanced Quiz Submission with full grading system
app.post('/student/quizzes/submit', authenticateToken, [
    body('quizSubmissions').isArray({ min: 1 }).withMessage('Quiz submissions array is required and must not be empty.'),
    body('quizSubmissions.*.questionId').isMongoId().withMessage('Invalid question ID.'),
    body('quizSubmissions.*.studentAnswer').exists().withMessage('Student answer field is required for each question.')
], async (req, res) => {
    const { quizSubmissions } = req.body;
    const studentId = req.student.id;

    // Retry logic for write conflicts
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const student = await Student.findById(studentId).session(session);
            if (!student) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({ message: 'Student not found.' });
            }

            const quizSession = await QuizSession.findById(student.currentQuizSessionId).session(session);
            if (!quizSession) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({ message: 'Quiz session not found.' });
            }


        let totalBytesEarned = 0;
        const gradedAnswers = [];
        const completedAttempts = [];


        // Grade each question
        for (const submission of quizSubmissions) {
            const questionId = submission.questionId;
            const studentAnswer = submission.studentAnswer;


            // Read quiz question outside the transaction — it is read-only for grading
            // and using the session here causes write conflicts with background serve-count updates
            const quizQuestion = await QuizQuestion.findById(questionId).lean();
            if (!quizQuestion) {
                console.warn(`Quiz question with ID ${questionId} not found. Skipping.`);
                continue;
            }

            // Skip unanswered questions (null, undefined, empty string, empty array)
            const isUnanswered = studentAnswer === null || studentAnswer === undefined ||
                studentAnswer === '' || (Array.isArray(studentAnswer) && studentAnswer.length === 0);
            if (isUnanswered) {
                gradedAnswers.push({
                    questionId, studentAnswer: null, isCorrect: false,
                    bytesEarned: 0, partialScore: 0,
                    subject: quizQuestion.subject, intendedClass: quizQuestion.intendedClass,
                    questionType: quizQuestion.type, skipped: true
                });
                continue;
            }

            let isCorrect = false;
            let questionBytes = 0;
            let partialScore = 0;


            // Enhanced grading based on question type
            switch (quizQuestion.type) {
                case 'short-answer':
                case 'problem-solving':
                    if (typeof studentAnswer === 'string') {
                        partialScore = await gradeNLPAnswer(studentAnswer, quizQuestion);
                        isCorrect = partialScore >= 0.7;
                        questionBytes = partialScore;
                    }
                    break;


                case 'fill-in-the-blank':
                    if (typeof studentAnswer === 'string') {
                        const normalizedStudentAnswer = studentAnswer.toLowerCase().trim();
                        isCorrect = quizQuestion.correctAnswers.some(correctAns =>
                            normalizedStudentAnswer === correctAns.toLowerCase().trim()
                        );
                        questionBytes = isCorrect ? 1 : 0;
                        partialScore = questionBytes;
                    }
                    break;


                case 'true-false':
                    if (typeof studentAnswer === 'boolean' || typeof studentAnswer === 'string') {
                        const normalizedStudentAnswer = String(studentAnswer).toLowerCase();
                        isCorrect = quizQuestion.correctAnswers.some(correctAns =>
                            normalizedStudentAnswer === correctAns.toLowerCase().trim()
                        );
                        questionBytes = isCorrect ? 1 : 0;
                        partialScore = questionBytes;
                    }
                    break;


                case 'multiple-choice-single':
                    if (typeof studentAnswer === 'string' && mongoose.Types.ObjectId.isValid(studentAnswer)) {
                        isCorrect = quizQuestion.options.some(option =>
                            option._id.toString() === studentAnswer && option.isCorrect
                        );
                        questionBytes = isCorrect ? 1 : 0;
                        partialScore = questionBytes;
                    }
                    break;


                case 'multiple-choice-multi':
                    if (Array.isArray(studentAnswer)) {
                        const correctOptionIds = quizQuestion.options
                            .filter(option => option.isCorrect)
                            .map(option => option._id.toString());
                        const chosenOptionIds = studentAnswer.map(id => id.toString());


                        const correctChoices = chosenOptionIds.filter(id => correctOptionIds.includes(id)).length;
                        const incorrectChoices = chosenOptionIds.filter(id => !correctOptionIds.includes(id)).length;


                        partialScore = Math.max(0, (correctChoices - incorrectChoices) / correctOptionIds.length);
                        isCorrect = partialScore >= 0.7;
                        questionBytes = partialScore;
                    }
                    break;


                case 'matching':
                    if (Array.isArray(studentAnswer)) {
                        const normalizedCorrectPairs = quizQuestion.matchingPairs
                            .map(pair => ({ itemA: pair.itemA.toLowerCase().trim(), itemB: pair.itemB.toLowerCase().trim() }));
                        const normalizedStudentPairs = studentAnswer
                            .map(pair => ({ itemA: pair.itemA.toLowerCase().trim(), itemB: pair.itemB.toLowerCase().trim() }));


                        let correctMatches = 0;
                        normalizedStudentPairs.forEach(studentPair => {
                            if (normalizedCorrectPairs.some(correctPair => 
                                correctPair.itemA === studentPair.itemA && correctPair.itemB === studentPair.itemB)) {
                                correctMatches++;
                            }
                        });


                        partialScore = correctMatches / normalizedCorrectPairs.length;
                        isCorrect = partialScore >= 0.7;
                        questionBytes = partialScore;
                    }
                    break;


                case 'ordering':
                    if (Array.isArray(studentAnswer)) {
                        const normalizedCorrectOrder = quizQuestion.orderedItems.map(item => item.toLowerCase().trim());
                        const normalizedStudentOrder = studentAnswer.map(item => item.toLowerCase().trim());


                        let correctPositions = 0;
                        normalizedStudentOrder.forEach((item, index) => {
                            if (normalizedCorrectOrder[index] === item) {
                                correctPositions++;
                            }
                        });


                        partialScore = correctPositions / normalizedCorrectOrder.length;
                        isCorrect = partialScore >= 0.7;
                        questionBytes = partialScore;
                    }
                    break;


                case 'numeric-entry':
                    if (typeof studentAnswer === 'string' || typeof studentAnswer === 'number') {
                        const numericAnswer = parseFloat(studentAnswer);
                        if (!isNaN(numericAnswer)) {
                            isCorrect = quizQuestion.correctAnswers.some(correctAns => {
                                const correctNum = parseFloat(correctAns);
                                return Math.abs(numericAnswer - correctNum) < 0.01;
                            });
                            questionBytes = isCorrect ? 1 : 0;
                            partialScore = questionBytes;
                        }
                    }
                    break;


                default:
                    console.warn(`Unknown quiz question type: ${quizQuestion.type} for question ID: ${questionId}`);
                    questionBytes = 0;
                    isCorrect = false;
                    partialScore = 0;
            }

            // Fats and beef: 1 byte per correct question, 0 for wrong (no partial bytes)
            questionBytes = isCorrect ? 1 : 0;

            totalBytesEarned += questionBytes;


            gradedAnswers.push({
                questionId: questionId,
                studentAnswer: studentAnswer,
                isCorrect: isCorrect,
                bytesEarned: questionBytes,
                partialScore: partialScore,
                subject: quizQuestion.subject,
                intendedClass: quizQuestion.intendedClass,
                questionType: quizQuestion.type
            });


            // Create completed attempt log
            completedAttempts.push({
                userId: studentId,
                quizId: questionId,
                studentClassAtAttempt: student.class,
                questionSubject: quizQuestion.subject,
                questionIntendedClass: quizQuestion.intendedClass,
                bytesAwarded: questionBytes,
                isSuccessful: isCorrect,
                attemptDate: new Date(),
                quizSessionId: quizSession._id,
                studentAnswer: studentAnswer,
                correctAnswer: quizQuestion.correctAnswers || quizQuestion.options?.filter(o => o.isCorrect),
                questionType: quizQuestion.type,
                partialScore: partialScore
            });


            // Update subject progress in quiz session
            const categoryType = determineQuestionCategory(student.class, quizQuestion.intendedClass);
            if (categoryType && quizSession.subjectProgress[quizQuestion.subject]) {
                quizSession.subjectProgress[quizQuestion.subject][categoryType]++;
            }
        }


        const finalBytesEarned = totalBytesEarned;

        // Update student data — all changes on the session-bound student object
        student.bytes += finalBytesEarned;
        student.quizzesCompletedThisWeek += 1;
        student.totalQuizzesCompleted = (student.totalQuizzesCompleted || 0) + 1;

        // Award achievements in-memory (modifies student.achievements / notifications)
        await checkAndAwardAchievements(student);

        // Update quiz session counters first so cycleComplete can be evaluated
        quizSession.questionsCompletedCount += quizSubmissions.length;
        quizSession.updatedAt = new Date();

        const division = getDivision(student.class);
        const cycleSize = division ? CYCLE_SIZES[division] : 120;
        const cycleComplete = cycleSize && quizSession.questionsCompletedCount >= cycleSize;

        if (cycleComplete) {
            // Cycle finished — clear the exclusion window so the new cycle draws from the full pool
            student.recentQuizIds = [];
        } else {
            // Update recent quiz IDs (sliding window — sized to one full cycle for this division)
            // This MUST be set before student.save() so the window is actually persisted.
            const newQuizIds = quizSubmissions.map(sub => new mongoose.Types.ObjectId(sub.questionId));
            const recentWindow = cycleSize;
            student.recentQuizIds = [...newQuizIds, ...(student.recentQuizIds || [])].slice(0, recentWindow);
        }

        // Single save captures bytes, achievements, and the updated recentQuizIds together
        await student.save({ session });

        if (cycleComplete) {
            quizSession.completedAt = new Date();
            const newQuizSession = new QuizSession({
                userId: studentId,
                questionsCompletedCount: 0
            });
            await newQuizSession.save({ session });
            student.currentQuizSessionId = newQuizSession._id;
            student.contingencyRepeatCount = 0;
            await student.save({ session });
        }

        await quizSession.save({ session });

        await CompletedQuizAttempt.insertMany(completedAttempts, { session });

            await session.commitTransaction();
            session.endSession();

            // Update streak AFTER the transaction commits — prevents write conflict
            updateStudentStreak(studentId).catch(e => console.warn('Streak update after quiz:', e));

            const scoreVal = gradedAnswers.length > 0
                ? Math.round((gradedAnswers.filter(a => a.isCorrect).length / gradedAnswers.length) * 100)
                : 0;
            createNotification(
                studentId, 'quiz_complete',
                'Quiz Completed',
                'You scored ' + scoreVal + '% and earned ' + finalBytesEarned + ' bytes. Total balance: ' + student.bytes + ' bytes.',
                { score: scoreVal, bytesEarned: finalBytesEarned, correct: gradedAnswers.filter(a => a.isCorrect).length, total: gradedAnswers.length }
            ).catch(() => {});

            return res.status(200).json({
                message: 'Quiz submitted and graded successfully!',
                totalCorrectQuestions: gradedAnswers.filter(a => a.isCorrect).length,
                totalAttemptedQuestions: gradedAnswers.length,
                score: scoreVal,
                bytesEarned: finalBytesEarned,
                studentCurrentBytes: student.bytes,
                gradedAnswers: gradedAnswers,
                cycleProgress: {
                    questionsCompleted: quizSession.questionsCompletedCount,
                    totalCycleQuestions: cycleSize || 180,
                    cycleComplete: !!quizSession.completedAt
                }
            });

        } catch (error) {
            await session.abortTransaction();
            session.endSession();

            // Check if it's a write conflict and retry
            if (error.code === 112 && attempt < maxRetries - 1) {
                attempt++;
                console.log(`Write conflict detected, retrying... (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt))); // Exponential backoff
                continue;
            }

            // On failure, DO NOT update student counters or recent quiz IDs
            // This ensures failed submissions don't count and questions return to pool
            console.error('Error submitting quiz:', error);
            createNotification(
                studentId, 'quiz_fail',
                'Quiz Submission Failed',
                'Your quiz submission failed. Your progress has not been counted. Please try again.',
                { error: error.message }
            ).catch(() => {});
            return res.status(500).json({ 
                message: 'Failed to submit quiz. Your progress has not been counted. Please try again.', 
                error: error.message,
                retry: true 
            });
        }
    }

    // If we get here, all retries failed - questions not marked as completed
    return res.status(500).json({ 
        message: 'Failed to submit quiz after multiple attempts. Your answers were not saved. Please try again.', 
        retry: true 
    });


});
// Helper function to determine question category
function determineQuestionCategory(studentClass, questionClass) {
    const classOrder = ['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6'];
    const studentIndex = classOrder.indexOf(studentClass);
    const questionIndex = classOrder.indexOf(questionClass);


    if (studentIndex === questionIndex) return 'ownClass';
    if (questionIndex < studentIndex) return 'lowerClass';
    if (questionIndex > studentIndex) return 'higherClass';
    return null;
}


// Enhanced teacher quiz question management
app.post('/teacher/quiz-questions', authenticateTeacherToken, [
    body('questionText').notEmpty().withMessage('Question text is required.').trim(),
    body('subject').notEmpty().withMessage('Subject is required.').trim(),
    body('intendedClass').notEmpty().withMessage('Intended class is required.').trim().isIn(['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6']).withMessage('Invalid intended class.'),
    body('type').notEmpty().withMessage('Question type is required.').isIn([
        'short-answer', 'multiple-choice-single', 'multiple-choice-multi',
        'true-false', 'fill-in-the-blank', 'matching', 'ordering', 'problem-solving', 'numeric-entry'
    ]).withMessage('Invalid question type.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const {
        questionText, subject, intendedClass, type, options, correctAnswers,
        matchingPairs, orderedItems, instructions, hint, explanation,
        maxBytesRewardPerQuestion, keywordsForGrading, negativeKeywords,
        topic, subTopic, skillType
    } = req.body;


    const teacherId = req.teacher.id;
    const teacherName = req.teacher.teacherName;


    const session = await mongoose.startSession();
    session.startTransaction();


    try {
        // Check for exact duplicates using hash
        const normalizedText = questionText.toLowerCase().trim().replace(/\s+/g, ' ');
        const questionHash = crypto.createHash('sha256').update(normalizedText).digest('hex');


        const existingQuestion = await QuizQuestion.findOne({ questionHash }).session(session);
        if (existingQuestion) {
            await session.abortTransaction();
            return res.status(409).json({ 
                message: 'This question appears to be an exact duplicate of an existing question. Please review and modify if you still wish to submit.',
                existingQuestion: {
                    id: existingQuestion._id,
                    text: existingQuestion.questionText,
                    uploadedBy: existingQuestion.uploadedBy.teacherName
                }
            });
        }


        // Validate type-specific fields
        if (['multiple-choice-single', 'multiple-choice-multi'].includes(type) && (!options || options.length === 0)) {
            return res.status(400).json({ message: 'Options are required for multiple-choice questions.' });
        }
        if (['short-answer', 'true-false', 'fill-in-the-blank', 'problem-solving', 'numeric-entry'].includes(type) && (!correctAnswers || correctAnswers.length === 0)) {
            return res.status(400).json({ message: 'Correct answers are required for this question type.' });
        }
        if (type === 'matching' && (!matchingPairs || matchingPairs.length === 0)) {
            return res.status(400).json({ message: 'Matching pairs are required for matching questions.' });
        }
        if (type === 'ordering' && (!orderedItems || orderedItems.length === 0)) {
            return res.status(400).json({ message: 'Ordered items are required for ordering questions.' });
        }


        const newQuizQuestion = new QuizQuestion({
            questionText,
            subject,
            intendedClass,
            type,
            options,
            correctAnswers,
            matchingPairs,
            orderedItems,
            instructions,
            hint,
            explanation,
            maxBytesRewardPerQuestion: maxBytesRewardPerQuestion || 1,
            keywordsForGrading,
            negativeKeywords,
            topic,
            subTopic,
            skillType,
            uploadedBy: {
                teacherId,
                teacherName
            },
            questionHash
        });


        await newQuizQuestion.save({ session });


        // Update teacher's weekly upload count
        const teacher = await Teacher.findById(teacherId).session(session);
        await checkAndResetTeacherWeeklyCounters(teacher);
        teacher.quizzesUploadedThisWeek += 1;
        await teacher.save({ session });


        await session.commitTransaction();


        res.status(201).json({
            message: 'Quiz question created successfully!',
            question: {
                id: newQuizQuestion._id,
                questionText: newQuizQuestion.questionText,
                subject: newQuizQuestion.subject,
                intendedClass: newQuizQuestion.intendedClass,
                type: newQuizQuestion.type,
                isActive: newQuizQuestion.isActive
            },
            weeklyStats: {
                uploaded: teacher.quizzesUploadedThisWeek,
                target: 10 // Configurable target
            }
        });


    } catch (error) {
        await session.abortTransaction();
        console.error('Error creating quiz question:', error);
        res.status(500).json({ message: 'Failed to create quiz question. Please try again.', error: error.message });
    } finally {
        session.endSession();
    }
});

app.post('/teacher/quiz-questions/generate-ai', authenticateTeacherToken, [
    body('subject').notEmpty().withMessage('Subject is required.').trim(),
    body('intendedClass').notEmpty().withMessage('Intended class is required.').trim().isIn(['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6']).withMessage('Invalid intended class.'),
    body('topic').optional().trim(),
    body('questionType').optional().isIn([
        'short-answer', 'multiple-choice-single', 'multiple-choice-multi',
        'true-false', 'fill-in-the-blank', 'problem-solving', 'numeric-entry'
    ]),
    body('numberOfQuestions').optional().isInt({ min: 1, max: 10 }).withMessage('Number of questions must be between 1 and 10.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { subject, intendedClass, topic, questionType, numberOfQuestions } = req.body;
        const teacherId = req.teacher.id;
        const teacherName = req.teacher.name;

        const numQuestions = numberOfQuestions || 1;
        const qType = questionType || 'multiple-choice-single';

        const topicContext = topic ? `Topic: ${topic}` : 'Generate questions covering various topics within the subject.';

        let optionsExample = '';
        let answersExample = '';

        if (qType === 'multiple-choice-single') {
            optionsExample = `"options": [
        {"text": "Option A", "isCorrect": false},
        {"text": "Option B", "isCorrect": true},
        {"text": "Option C", "isCorrect": false},
        {"text": "Option D", "isCorrect": false}
      ],`;
        } else if (qType === 'multiple-choice-multi') {
            optionsExample = `"options": [
        {"text": "Option A", "isCorrect": true},
        {"text": "Option B", "isCorrect": true},
        {"text": "Option C", "isCorrect": false},
        {"text": "Option D", "isCorrect": true}
      ],`;
        } else if (['short-answer', 'problem-solving', 'fill-in-the-blank'].includes(qType)) {
            answersExample = `"correctAnswers": ["answer1", "answer2"],
      "keywordsForGrading": ["keyword1", "keyword2", "keyword3"],`;
        } else if (qType === 'true-false') {
            answersExample = `"correctAnswers": ["true"],`;
        } else if (qType === 'numeric-entry') {
            answersExample = `"correctAnswers": ["42"],`;
        }

        const prompt = `You are an expert teacher creating quiz questions for a Ugandan secondary school.

Generate ${numQuestions} high-quality ${qType} question(s) for:
- Subject: ${subject}
- Class Level: ${intendedClass}
- ${topicContext}

Requirements:
1. Questions must be educationally appropriate for ${intendedClass} students
2. Questions should align with the Ugandan curriculum
3. Use clear, precise language
${qType === 'multiple-choice-single' ? '4. For multiple-choice-single questions, provide exactly 4 options with EXACTLY ONE option marked isCorrect: true' : ''}
${qType === 'multiple-choice-multi' ? '4. For multiple-choice-multi questions, provide 4 options with MULTIPLE options marked isCorrect: true (at least 2)' : ''}
${['short-answer', 'problem-solving'].includes(qType) ? '4. For short-answer/problem-solving questions, provide multiple acceptable answer variations and 5-8 keywords for grading' : ''}
${qType === 'true-false' ? '4. For true-false questions, correctAnswers must be EXACTLY ["true"] or EXACTLY ["false"] - no other format' : ''}
${qType === 'numeric-entry' ? '4. For numeric-entry questions, provide the numeric answer as a string' : ''}
5. Include helpful hints and detailed explanations to aid learning

Output Format (strict JSON):
{
  "questions": [
    {
      "questionText": "The question text",
      "type": "${qType}",
      ${optionsExample}
      ${answersExample}
      "hint": "A helpful hint",
      "explanation": "Detailed explanation of the answer",
      "topic": "Specific topic within ${subject}",
      "skillType": ["Application"]
    }
  ]
}`;

        // Call TinyLlama via Ollama with robust error handling
        const responseText = await callGroqAI(
            prompt + "\n\nIMPORTANT: Respond ONLY with valid JSON. Start with { and end with }.",
            "You are an educational quiz question generator AI. Generate questions in valid JSON format only.",
            { temperature: 0.7, num_predict: 2500, timeout: 90000, retries: 2 }
        );

        const parsedResponse = extractJSON(responseText);

        if (!parsedResponse.questions || !Array.isArray(parsedResponse.questions)) {
            throw new Error('AI response did not match expected format.');
        }

        const validatedQuestions = [];
        for (const aiQuestion of parsedResponse.questions) {
            if (!aiQuestion.questionText || !aiQuestion.questionText.trim()) {
                console.warn('Invalid question: missing or empty questionText');
                continue;
            }

            if (qType === 'multiple-choice-single' || qType === 'multiple-choice-multi') {
                if (!Array.isArray(aiQuestion.options) || aiQuestion.options.length !== 4) {
                    console.warn(`Invalid multiple-choice question: has ${aiQuestion.options?.length || 0} options, expected exactly 4`);
                    continue;
                }

                let validOptions = true;
                const correctOptions = [];
                for (const opt of aiQuestion.options) {
                    if (!opt.text || typeof opt.text !== 'string' || !opt.text.trim()) {
                        console.warn('Invalid multiple-choice question: option missing text');
                        validOptions = false;
                        break;
                    }
                    if (typeof opt.isCorrect !== 'boolean') {
                        console.warn('Invalid multiple-choice question: option missing or invalid isCorrect boolean');
                        validOptions = false;
                        break;
                    }
                    if (opt.isCorrect === true) {
                        correctOptions.push(opt.text);
                    }
                }
                if (!validOptions) continue;

                const correctCount = correctOptions.length;

                if (qType === 'multiple-choice-single' && correctCount !== 1) {
                    console.warn(`Invalid multiple-choice-single question: has ${correctCount} correct answers, expected exactly 1`);
                    continue;
                }

                if (qType === 'multiple-choice-multi' && correctCount < 2) {
                    console.warn(`Invalid multiple-choice-multi question: has ${correctCount} correct answers, expected at least 2`);
                    continue;
                }

                if (!Array.isArray(aiQuestion.correctAnswers) || aiQuestion.correctAnswers.length !== correctCount) {
                    console.warn('Multiple-choice question: correctAnswers array missing or incorrect length, auto-generating from isCorrect flags');
                    aiQuestion.correctAnswers = correctOptions;
                } else {
                    const answersSet = new Set(aiQuestion.correctAnswers);
                    const correctSet = new Set(correctOptions);
                    const isMatch = answersSet.size === correctSet.size && 
                                   [...answersSet].every(ans => correctSet.has(ans));

                    if (!isMatch) {
                        console.warn('Multiple-choice question: correctAnswers array does not match isCorrect flags, overwriting with correct values');
                        aiQuestion.correctAnswers = correctOptions;
                    }
                }
            } else if (qType === 'true-false') {
                if (!Array.isArray(aiQuestion.correctAnswers) || aiQuestion.correctAnswers.length !== 1) {
                    console.warn(`Invalid true-false question: correctAnswers must be array with exactly 1 element, got ${aiQuestion.correctAnswers?.length || 0}`);
                    continue;
                }
                const answer = aiQuestion.correctAnswers[0];
                if (answer !== 'true' && answer !== 'false') {
                    console.warn(`Invalid true-false question: answer is "${answer}", expected exactly "true" or "false"`);
                    continue;
                }
            } else if (['short-answer', 'problem-solving', 'fill-in-the-blank'].includes(qType)) {
                if (!aiQuestion.keywordsForGrading || aiQuestion.keywordsForGrading.length < 2) {
                    console.warn(`Invalid ${qType} question: insufficient keywords for grading (has ${aiQuestion.keywordsForGrading?.length || 0}, expected at least 2)`);
                    continue;
                }
            }

            validatedQuestions.push(aiQuestion);
        }

        if (validatedQuestions.length === 0) {
            throw new Error('No valid questions generated by AI. Please try again.');
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const savedQuestions = [];
            const teacher = await Teacher.findById(teacherId).session(session);
            await checkAndResetTeacherWeeklyCounters(teacher);

            for (const aiQuestion of validatedQuestions) {
                const normalizedText = aiQuestion.questionText.toLowerCase().trim().replace(/\s+/g, ' ');
                const questionHash = crypto.createHash('sha256').update(normalizedText).digest('hex');

                const existingQuestion = await QuizQuestion.findOne({ questionHash }).session(session);
                if (existingQuestion) {
                    console.log(`Duplicate question detected (AI-generated): "${aiQuestion.questionText.substring(0, 50)}..."`);
                    continue;
                }

                const newQuestion = new QuizQuestion({
                    questionText: aiQuestion.questionText,
                    subject,
                    intendedClass,
                    type: qType,
                    options: aiQuestion.options || [],
                    correctAnswers: aiQuestion.correctAnswers || [],
                    instructions: aiQuestion.instructions || '',
                    hint: aiQuestion.hint || '',
                    explanation: aiQuestion.explanation || '',
                    maxBytesRewardPerQuestion: 1,
                    keywordsForGrading: aiQuestion.keywordsForGrading || [],
                    topic: aiQuestion.topic || topic || '',
                    skillType: aiQuestion.skillType || ['Application'],
                    uploadedBy: {
                        teacherId,
                        teacherName
                    },
                    questionHash,
                    isActive: true
                });

                await newQuestion.save({ session });
                savedQuestions.push(newQuestion);
            }

            teacher.quizzesUploadedThisWeek += savedQuestions.length;
            await teacher.save({ session });

            await session.commitTransaction();

            res.status(201).json({
                message: `Successfully generated and saved ${savedQuestions.length} AI-powered quiz question(s)!`,
                questions: savedQuestions.map(q => ({
                    id: q._id,
                    questionText: q.questionText,
                    subject: q.subject,
                    intendedClass: q.intendedClass,
                    type: q.type,
                    topic: q.topic
                })),
                weeklyStats: {
                    uploaded: teacher.quizzesUploadedThisWeek,
                    target: 10
                }
            });

        } catch (dbError) {
            await session.abortTransaction();
            throw dbError;
        } finally {
            session.endSession();
        }

    } catch (error) {
        console.error('Error generating AI quiz questions:', error);
        res.status(500).json({ 
            message: 'Failed to generate quiz questions with AI. Please try again.', 
            error: error.message 
        });
    }
});

// Student endpoint to fetch work files by subject
app.get('/student/workfiles', authenticateToken, async (req, res) => {
    try {
        const { subject, intendedClass, search } = req.query;
        const studentId = req.student.id;

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        let query = {};
        // Case-insensitive subject search
        if (subject) query.subject = subject; // Keeping original behavior, adjust if case-insensitivity is needed broadly
        if (intendedClass) query.intendedClass = intendedClass;

        // Add search functionality
        if (search && search.trim()) {
            query.$or = [
                { title: { $regex: search.trim(), $options: 'i' } },
                { description: { $regex: search.trim(), $options: 'i' } }
            ];
        }

        const workFiles = await WorkFile.find(query)
            .populate('uploadedBy.teacherId', 'teacherName')
            .sort({ createdAt: -1 });

        // Sort files based on relevance to student's class
        const studentClass = student.class;
        const sortedFiles = workFiles.sort((a, b) => {
            if (a.intendedClass === studentClass && b.intendedClass !== studentClass) return -1;
            if (b.intendedClass === studentClass && a.intendedClass !== studentClass) return 1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        res.status(200).json({
            message: 'Work files fetched successfully.',
            studentClass: studentClass, // Include student's class for frontend filtering/display
            workFiles: sortedFiles.map(file => ({
                _id: file._id,
                title: file.title,
                description: file.description,
                fileUrl: file.fileUrl,
                subject: file.subject,
                intendedClass: file.intendedClass,
                costBytes: file.costBytes,
                uploadedBy: {
                    teacherName: file.uploadedBy.teacherName
                },
                downloadCount: file.downloadCount || 0,
                createdAt: file.createdAt,
                hasActivity: !!file.activity // Boolean indicating if an associated activity exists
            }))
        });
    } catch (error) {
        console.error('Error fetching work files:', error);
        res.status(500).json({ message: 'Failed to fetch work files.', error: error.message });
    }
});

// Student endpoint to preview a work file (free, no bytes deduction)
app.get('/api/workfiles/:workFileId/preview', authenticateToken, async (req, res) => {
    try {
        const { workFileId } = req.params;
        
        const workFile = await WorkFile.findById(workFileId);
        if (!workFile) {
            return res.status(404).json({ message: 'Work file not found.' });
        }

        res.json({
            success: true,
            previewUrl: workFile.fileUrl,
            title: workFile.title,
            description: workFile.description,
            subject: workFile.subject,
            intendedClass: workFile.intendedClass,
            costBytes: workFile.costBytes
        });
    } catch (error) {
        console.error('Error loading preview:', error);
        res.status(500).json({ message: 'Failed to load preview.', error: error.message });
    }
});

// Student endpoint to download a work file (with bytes deduction)
app.post('/student/download-workfile/:workFileId', authenticateToken, async (req, res) => {
    const { workFileId } = req.params;
    const studentId = req.student.id; // Use student ID from token

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const student = await Student.findById(studentId).session(session);
        if (!student) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Student not found.' });
        }

        const workFile = await WorkFile.findById(workFileId).session(session);
        if (!workFile) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Work file not found.' });
        }

        // Check if student has enough bytes
        if (student.bytes < workFile.costBytes) {
            await session.abortTransaction();
            return res.status(400).json({ 
                message: `Insufficient bytes. You need ${workFile.costBytes} bytes but only have ${student.bytes} bytes.`,
                requiredBytes: workFile.costBytes,
                currentBytes: student.bytes
            });
        }

        // Deduct bytes
        student.bytes -= workFile.costBytes;
        await student.save({ session });

        // Increment download count
        await WorkFile.updateOne(
            { _id: workFileId },
            { $inc: { downloadCount: 1 } }
        ).session(session);

        await session.commitTransaction();
        let finalUrl = workFile.fileUrl;
        const doublePathRegex = /(schoolbyte\/workfiles\/[^\/]+\/)schoolbyte\/workfiles\/[^\/]+\//;
        if (doublePathRegex.test(finalUrl)) {
            finalUrl = finalUrl.replace(doublePathRegex, '$1');
        }
        if (finalUrl.includes('/upload/') && !finalUrl.includes('/fl_attachment/')) {
            finalUrl = finalUrl.replace('/upload/', '/upload/fl_attachment/');
        }

        // Notify student of successful download
        createNotification(
            studentId, 'download_success',
            'Download Successful',
            'You downloaded "' + workFile.title + '" for ' + workFile.costBytes + ' bytes. Remaining balance: ' + student.bytes + ' bytes.',
            { workFileId, workFileTitle: workFile.title, bytesDeducted: workFile.costBytes, remainingBytes: student.bytes }
        ).catch(() => {});

        res.status(200).json({
            success: true,
            message: 'Download authorized successfully.',
            downloadUrl: finalUrl, // Use the fixed URL
            bytesDeducted: workFile.costBytes,
            remainingBytes: student.bytes
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error processing download:', error);
        createNotification(req.student.id, 'download_fail', 'Download Failed',
            'Your download attempt failed. If bytes were deducted, please use the refund option.',
            { workFileId: req.params.workFileId }
        ).catch(() => {});
        res.status(500).json({ message: 'Failed to process download.', error: error.message });
    } finally {
        session.endSession();
    }
});

// Alternative endpoint for frontend compatibility
app.post('/api/workfiles/:workFileId/download', authenticateToken, async (req, res) => {
    const { workFileId } = req.params;
    const studentId = req.student.id;
    const CLOUD_NAME = "dq5mdy0yq";

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const student = await Student.findById(studentId).session(session);
        if (!student) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Student not found.' });
        }

        const workFile = await WorkFile.findById(workFileId).session(session);
        if (!workFile) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Work file not found.' });
        }

        if (student.bytes < workFile.costBytes) {
            await session.abortTransaction();
            return res.status(400).json({ 
                message: `Insufficient bytes. You need ${workFile.costBytes} bytes but only have ${student.bytes} bytes.`,
                requiredBytes: workFile.costBytes,
                currentBytes: student.bytes
            });
        }

        // Custom Filename Generation
        const teacherID = workFile.uploadedBy; 
        const teacherName = `Teacher_${teacherID.toString().substring(0, 4)}`; 
        const downloadDate = new Date().toISOString().split('T')[0];
        const baseName = `${workFile.subject}_${workFile.title}_${teacherName}_${downloadDate}`;
        const sanitizedFilename = baseName.replace(/[^a-zA-Z0-9_\-]/g, '_'); 
        const finalFilename = `${sanitizedFilename}.pdf`;
        const encodedFilename = encodeURIComponent(finalFilename);

        // Deduct bytes
        student.bytes -= workFile.costBytes;
        await student.save({ session });

        // Increment download count
        await WorkFile.updateOne(
            { _id: workFileId },
            { $inc: { downloadCount: 1 } }
        ).session(session);

        await session.commitTransaction();

        // Final URL Construction (Custom Filename Fix)
        let publicIdPath = workFile.fileUrl.split('/upload/')[1]; 
        const publicIdWithoutVersion = publicIdPath.replace(/^v\d+\//, ''); 
        const publicIdWithExtension = publicIdWithoutVersion; 

        // We use fl_attachment:filename and the Public ID that still contains the .pdf extension.
        const downloadUrl = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/fl_attachment:${encodedFilename}/${publicIdWithExtension}`;

        console.log(`Final Custom Download URL: ${downloadUrl}`);

        // Notify student of successful download
        createNotification(
            studentId, 'download_success',
            'Download Successful',
            'You downloaded "' + workFile.title + '" for ' + workFile.costBytes + ' bytes. Remaining balance: ' + student.bytes + ' bytes.',
            { workFileId, workFileTitle: workFile.title, bytesDeducted: workFile.costBytes, remainingBytes: student.bytes }
        ).catch(() => {});

        // Send the URL back to the frontend
        res.status(200).json({
            success: true,
            message: 'File access granted. Redirecting for download.',
            downloadUrl: downloadUrl,
            bytesDeducted: workFile.costBytes,
            remainingBytes: student.bytes
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error processing download:', error);
        createNotification(req.student.id, 'download_fail', 'Download Failed',
            'Your download attempt failed. If bytes were deducted, please use the refund option.',
            { workFileId: req.params.workFileId }
        ).catch(() => {});
        res.status(500).json({ message: 'Failed to process download.', error: error.message });
    } finally {
        session.endSession();
    }
});
// Get teacher's quiz questions with enhanced filtering
app.get('/teacher/quiz-questions', authenticateTeacherToken, async (req, res) => {
    const teacherId = req.teacher.id;
    const { subject, intendedClass, type, isActive, page = 1, limit = 20 } = req.query;


    let query = { 'uploadedBy.teacherId': teacherId };
    if (subject) query.subject = subject;
    if (intendedClass) query.intendedClass = intendedClass;
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';


    try {
        const skip = (parseInt(page) - 1) * parseInt(limit);


        const [questions, total] = await Promise.all([
            QuizQuestion.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            QuizQuestion.countDocuments(query)
        ]);


        // Get teacher's weekly stats
        const teacher = await Teacher.findById(teacherId);
        await checkAndResetTeacherWeeklyCounters(teacher);


        res.status(200).json({
            message: 'Quiz questions fetched successfully.',
            questions: questions,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / parseInt(limit)),
                count: questions.length,
                totalQuestions: total
            },
            weeklyStats: {
                uploaded: teacher.quizzesUploadedThisWeek,
                target: 10 // Configurable target
            }
        });
    } catch (error) {
        console.error('Error fetching quiz questions:', error);
        res.status(500).json({ message: 'Failed to fetch quiz questions.', error: error.message });
    }
});


// Analytics endpoint for quiz performance
app.get('/student/analytics/quiz-performance', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { timeframe = '30', subject } = req.query;


        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(timeframe));


        let matchCriteria = {
            userId: new mongoose.Types.ObjectId(studentId),
            attemptDate: { $gte: startDate }
        };


        if (subject) {
            matchCriteria.questionSubject = subject;
        }


        const analytics = await CompletedQuizAttempt.aggregate([
            { $match: matchCriteria },
            {
                $group: {
                    _id: {
                        subject: '$questionSubject',
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$attemptDate' } }
                    },
                    totalAttempts: { $sum: 1 },
                    successfulAttempts: { 
                        $sum: { $cond: ['$isSuccessful', 1, 0] } 
                    },
                    averageScore: { $avg: '$partialScore' },
                    totalBytes: { $sum: '$bytesAwarded' }
                }
            },
            {
                $group: {
                    _id: '$_id.subject',
                    attempts: { $sum: '$totalAttempts' },
                    correct: { $sum: '$successfulAttempts' },
                    accuracy: { 
                        $avg: { 
                            $divide: ['$successfulAttempts', '$totalAttempts'] 
                        } 
                    },
                    averageScore: { $avg: '$averageScore' },
                    totalBytes: { $sum: '$totalBytes' },
                    dailyData: {
                        $push: {
                            date: '$_id.date',
                            attempts: '$totalAttempts',
                            correct: '$successfulAttempts',
                            bytes: '$totalBytes'
                        }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);


        res.status(200).json({
            message: 'Quiz performance analytics fetched successfully.',
            timeframe: parseInt(timeframe),
            analytics: analytics
        });


    } catch (error) {
        console.error('Error fetching quiz analytics:', error);
        res.status(500).json({ message: 'Failed to fetch analytics.', error: error.message });
    }
});

// --- Multer Configuration for File Uploads ---
const storage = multer.memoryStorage(); // Use memory storage for Cloudinary upload
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDFs are allowed.'), false);
    }
};
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB file size limit
});

const imageFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type. Only JPEG, PNG, WebP allowed.'), false);
};
const uploadImage = multer({
    storage: multer.memoryStorage(),
    fileFilter: imageFilter,
    limits: { fileSize: 8 * 1024 * 1024 } // 8MB
});



// Byte games: 2 bytes to start, 7 if well performed (net +5)
const BYTE_GAME_NAMES = ['sudoku', 'geoquiz', 'geography quiz', 'geography'];
const GAME_COST_BYTES = 2;
const GAME_MAX_REWARD_BYTES = 7;

app.post('/api/games/start', authenticateToken, async (req, res) => {
    try {
        const { gameName } = req.body;
        const studentId = req.student.id;
        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ message: 'Student not found' });
        const cost = GAME_COST_BYTES;
        if ((student.bytes || 0) < cost) {
            return res.status(402).json({
                message: `Byte games cost ${cost} bytes to start. You need ${cost - (student.bytes || 0)} more bytes.`,
                bytesRequired: cost,
                currentBytes: student.bytes
            });
        }
        student.bytes = (student.bytes || 0) - cost;
        await student.save();
        res.status(200).json({
            message: 'Game started! Perform well to earn 7 bytes.',
            bytesDeducted: cost,
            totalBytes: student.bytes,
            gameName: gameName || 'game'
        });
    } catch (error) {
        console.error('Error starting game:', error);
        res.status(500).json({ message: 'Failed to start game', error: error.message });
    }
});

app.post('/api/games/award-bytes', authenticateToken, async (req, res) => {
    try {
        const { gameName, bytesEarned, ...gameData } = req.body;
        const studentId = req.student.id;

        if (!bytesEarned || bytesEarned <= 0) {
            return res.status(400).json({ message: 'Invalid bytes amount' });
        }

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        let amount = Math.round(bytesEarned);
        const isByteGame = gameName && BYTE_GAME_NAMES.some(n => String(gameName).toLowerCase().includes(n.toLowerCase()));
        if (isByteGame && amount > GAME_MAX_REWARD_BYTES) amount = GAME_MAX_REWARD_BYTES;

        student.bytes += amount;
        await student.save();

        res.status(200).json({
            message: 'Bytes awarded successfully!',
            bytesEarned: amount,
            totalBytes: student.bytes,
            gameName: gameName
        });

    } catch (error) {
        console.error('Error awarding game bytes:', error);
        res.status(500).json({ message: 'Failed to award bytes', error: error.message });
    }
});

app.post(
    '/teacher/upload-content',
    authenticateTeacherToken,
    upload.single('workFilePdf'),
    [
        // Validation chain to check all incoming data
        body('workFileTitle').notEmpty().withMessage('WorkFile title is required.').trim().isLength({ min: 3, max: 200 }),
        body('workFileDescription').optional().isString().withMessage('WorkFile description must be a string.').trim().isLength({ max: 500 }),
        body('workFileSubject').notEmpty().withMessage('WorkFile subject is required.').trim().isLength({ min: 2, max: 100 }),
        body('workFileIntendedClass').notEmpty().withMessage('WorkFile intended class is required.').trim().isIn(['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6']).withMessage('Invalid WorkFile intended class.'),
        body('workFileCostBytes').isInt({ min: 0 }).withMessage('WorkFile cost bytes must be a non-negative integer.').notEmpty(),

        // ✨ KEY FIX: Changed .isBoolean() to .toBoolean() to correctly handle form data.
        body('applyDownloadWatermark').optional().toBoolean(),

        body('activityJson').notEmpty().withMessage('Activity data is required and must be a JSON string.'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // This is where your request was failing before the fix.
            return res.status(400).json({ errors: errors.array() });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'WorkFile PDF is required.' });
        }

        let activityData;
        try {
            activityData = JSON.parse(req.body.activityJson);
        } catch (parseError) {
            console.error('Error parsing activity JSON:', parseError);
            return res.status(400).json({ message: 'Invalid activity data format. Must be a valid JSON string.' });
        }

        // Manual validation for the parsed activityData
        if (!activityData.title || typeof activityData.title !== 'string' || activityData.title.trim().length < 3 || activityData.title.trim().length > 200) {
            return res.status(400).json({ message: 'Activity title is required and must be between 3 and 200 characters.' });
        }
        if (activityData.description !== undefined && activityData.description !== null && activityData.description !== '' && (typeof activityData.description !== 'string' || activityData.description.trim().length > 500)) {
            return res.status(400).json({ message: 'Activity description must be a string and cannot exceed 500 characters.' });
        }
        if (!activityData.subject || typeof activityData.subject !== 'string' || activityData.subject.trim().length < 2 || activityData.subject.trim().length > 100) {
            return res.status(400).json({ message: 'Activity subject is required and must be between 2 and 100 characters.' });
        }
        const validClasses = ['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6'];
        if (!activityData.intendedClass || typeof activityData.intendedClass !== 'string' || !validClasses.includes(activityData.intendedClass.trim())) {
            return res.status(400).json({ message: 'Invalid Activity intended class.' });
        }
        if (!Array.isArray(activityData.questions) || activityData.questions.length === 0) {
            return res.status(400).json({ message: 'Activity must have at least one question.' });
        }
        for (const [qIndex, question] of activityData.questions.entries()) {
            if (!question.questionText || typeof question.questionText !== 'string' || question.questionText.trim().length < 10 || question.questionText.trim().length > 1000) {
                return res.status(400).json({ message: `Question ${qIndex + 1}: Question text is required and must be between 10 and 1000 characters.` });
            }
            if (!Array.isArray(question.keywordsForMarking) || question.keywordsForMarking.length === 0) {
                return res.status(400).json({ message: `Question ${qIndex + 1}: Each question must have at least one keyword for marking.` });
            }
            for (const [kIndex, keyword] of question.keywordsForMarking.entries()) {
                if (!keyword || typeof keyword !== 'string' || keyword.trim().length < 1 || keyword.trim().length > 100) {
                    return res.status(400).json({ message: `Question ${qIndex + 1}, Keyword ${kIndex + 1}: Keywords cannot be empty and must be between 1 and 100 characters.` });
                }
            }
            if (Array.isArray(question.negativeKeywords)) {
                for (const [kIndex, keyword] of question.negativeKeywords.entries()) {
                    if (keyword != null && typeof keyword !== 'string') {
                        return res.status(400).json({ message: `Question ${qIndex + 1}, Negative keyword ${kIndex + 1}: must be a string.` });
                    }
                    if (typeof keyword === 'string' && keyword.trim().length > 100) {
                        return res.status(400).json({ message: `Question ${qIndex + 1}, Negative keyword ${kIndex + 1}: cannot exceed 100 characters.` });
                    }
                }
            }
        }

        const {
            workFileTitle,
            workFileDescription,
            workFileSubject,
            workFileIntendedClass,
            workFileCostBytes,
            applyDownloadWatermark = true // Default value in case it's not provided
        } = req.body;
        const {
            title: activityTitle,
            description: activityDescription,
            subject: activitySubject,
            intendedClass: activityIntendedClass,
            questions
        } = activityData;
        const teacherId = req.teacher.id;
        const teacherName = req.teacher.teacherName;

        let uploadedFileUrl = null;
        let workFilePublicId = null;
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            workFilePublicId = `schoolbyte/workfiles/${teacherId}/workfile-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
            const cloudinaryUploadResult = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: 'raw',
                        public_id: workFilePublicId,
                        format: 'pdf',
                    },
                    (error, result) => {
                        if (error) {
                            return reject(new Error(`Cloudinary upload failed: ${error.message}`));
                        }
                        uploadedFileUrl = result.secure_url;
                        resolve(result);
                    }
                );
                uploadStream.end(req.file.buffer);
            });
            const newWorkFile = new WorkFile({
                title: workFileTitle,
                description: workFileDescription,
                fileUrl: uploadedFileUrl,
                subject: workFileSubject,
                intendedClass: workFileIntendedClass,
                costBytes: workFileCostBytes,
                uploadedBy: {
                    teacherId: teacherId,
                    teacherName: teacherName
                },
                applyDownloadWatermark: applyDownloadWatermark
            });
            await newWorkFile.save({ session });
            const newActivity = new Activity({
                title: activityTitle,
                description: activityDescription || '',
                subject: activitySubject,
                intendedClass: activityIntendedClass,
                maxBytesReward: 5,
                associatedWorkFile: newWorkFile._id,
                questions: questions,
                uploadedBy: {
                    teacherId: teacherId,
                    teacherName: teacherName
                }
            });
            await newActivity.save({ session });

            newWorkFile.activity = newActivity._id;
            await newWorkFile.save({ session });

            await session.commitTransaction();

            res.status(201).json({
                message: 'WorkFile and Activity uploaded successfully!',
                workFile: {
                    id: newWorkFile._id,
                    title: newWorkFile.title,
                    fileUrl: newWorkFile.fileUrl,
                    subject: newWorkFile.subject,
                    intendedClass: newWorkFile.intendedClass,
                    costBytes: newWorkFile.costBytes,
                    applyDownloadWatermark: newWorkFile.applyDownloadWatermark
                },
                activity: {
                    id: newActivity._id,
                    title: newActivity.title,
                    subject: newActivity.subject,
                    intendedClass: newActivity.intendedClass,
                    maxBytesReward: newActivity.maxBytesReward,
                    questionsCount: newActivity.questions.length
                }
            });
        } catch (error) {
            await session.abortTransaction();
            console.error('Error during WorkFile/Activity upload transaction:', error);
            if (uploadedFileUrl && workFilePublicId) {
                try {
                    await cloudinary.uploader.destroy(workFilePublicId, { resource_type: 'raw' });
                    console.log(`Successfully deleted orphaned Cloudinary file: ${workFilePublicId}`);
                } catch (cloudinaryError) {
                    console.error(`Failed to delete orphaned Cloudinary file ${workFilePublicId}:`, cloudinaryError);
                }
            }

            res.status(500).json({
                message: 'Failed to upload WorkFile and Activity. Please try again.',
                error: error.message
            });
        } finally {
            session.endSession();
        }
    }
);

// Health check endpoint for upload readiness
app.get('/teacher/upload-health-check', authenticateTeacherToken, async (req, res) => {
    try {
        const healthChecks = {
            database: 'unknown',
            cloudinary: 'unknown',
            server: 'ok'
        };

        try {
            await mongoose.connection.db.admin().ping();
            healthChecks.database = 'ok';
        } catch (dbError) {
            console.error('Database health check failed:', dbError);
            healthChecks.database = 'error';
        }

        try {
            if (cloudinary && cloudinary.config().cloud_name) {
                healthChecks.cloudinary = 'ok';
            } else {
                healthChecks.cloudinary = 'error';
            }
        } catch (cloudinaryError) {
            console.error('Cloudinary health check failed:', cloudinaryError);
            healthChecks.cloudinary = 'error';
        }

        const allHealthy = Object.values(healthChecks).every(status => status === 'ok');

        res.status(allHealthy ? 200 : 503).json({
            healthy: allHealthy,
            checks: healthChecks,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            healthy: false,
            error: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});

// Teacher login and dashboard endpoints (existing)
app.post('/login-teacher', [
    body('teacherName').notEmpty().withMessage('Teacher name is required.'),
    body('email').notEmpty().withMessage('Email is required.'),
    body('password').notEmpty().withMessage('Password is required.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    let { teacherName, email, password } = req.body;


    try {
        // Check if this is an admin login attempt
        const adminPrefix = 'admin: ';
        let isAdminLogin = false;


        if (email.toLowerCase().startsWith(adminPrefix.toLowerCase())) {
            isAdminLogin = true;
            // Remove the admin prefix to get the actual email
            email = email.substring(adminPrefix.length).trim();


            // Validate admin credentials
            if (teacherName.toLowerCase() !== 'administrator') {
                return res.status(401).json({ message: 'Invalid admin credentials.' });
            }
        }


        if (isAdminLogin) {
            // Handle admin login with 2FA
            const admin = await Administrator.findOne({ email });


            if (!admin) {
                return res.status(401).json({ message: 'Invalid admin credentials.' });
            }


            const isMatch = await bcrypt.compare(password, admin.password);


            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid admin credentials.' });
            }


            // Generate and send 2FA code
            const code = Math.floor(100000 + Math.random() * 900000).toString();


            await VerificationCode.findOneAndUpdate(
                { email },
                { code, createdAt: Date.now() },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );


            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'SchoolByte Admin 2FA Code',
                html: `<p>Your SchoolByte Administrator 2FA code is: <strong>${code}</strong></p><p>This code is valid for 10 minutes.</p>`
            };


            await transporter.sendMail(mailOptions);


            res.status(200).json({
                message: 'Admin 2FA code sent to your email.',
                requiresTwoFA: true,
                adminEmail: email
            });


        } else {
            // Handle regular teacher login
            const teacher = await Teacher.findOne({ email: email.toLowerCase().trim() });


            if (!teacher) {
                return res.status(401).json({ message: 'Invalid teacher credentials.' });
            }


            const isMatch = await bcrypt.compare(password, teacher.password);


            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid teacher credentials.' });
            }


            // Check and reset weekly counters
            await checkAndResetTeacherWeeklyCounters(teacher);


            const token = jwt.sign(
                { id: teacher._id, email: teacher.email, teacherName: teacher.teacherName, role: 'teacher' },
                JWT_SECRET,
                { expiresIn: '24h' }
            );


            res.status(200).json({
                message: 'Teacher login successful!',
                token: token,
                teacher: {
                    teacherName: teacher.teacherName,
                    email: teacher.email,
                    bytes: teacher.bytes,
                    isPasswordSet: teacher.isPasswordSet
                }
            });
        }


    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Server error during login.', error: error.message });
    }
});


app.get('/teacher/dashboard', authenticateTeacherToken, async (req, res) => {
    try {
        const teacherData = await Teacher.findById(req.teacher.id).select('-password');


        if (!teacherData) {
            return res.status(404).json({ message: 'Teacher data not found.' });
        }


        // Check and reset weekly counters
        await checkAndResetTeacherWeeklyCounters(teacherData);


        res.status(200).json({
            message: `Welcome to your teacher dashboard, ${teacherData.teacherName}!`,
            teacher: {
                teacherName: teacherData.teacherName,
                email: teacherData.email,
                bytes: teacherData.bytes,
                preferences: teacherData.preferences,
                createdAt: teacherData.createdAt,
                isPasswordSet: teacherData.isPasswordSet,
                gender: teacherData.gender,
                physicalDescription: teacherData.physicalDescription,
                quizzesUploadedThisWeek: teacherData.quizzesUploadedThisWeek
            }
        });


    } catch (error) {
        console.error('Error accessing teacher dashboard:', error);
        res.status(500).json({ message: 'Server error accessing teacher dashboard.', error: error.message });
    }
});



// Teacher change password (authenticated, requires old password)
app.post('/teacher/reset-password', authenticateTeacherToken, [
    body('oldPassword').notEmpty().withMessage('Current password is required.'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
    }
    const { oldPassword, newPassword } = req.body;
    try {
        const teacher = await Teacher.findById(req.teacher.id);
        if (!teacher) return res.status(404).json({ message: 'Teacher not found.' });
        const isMatch = await bcrypt.compare(oldPassword, teacher.password);
        if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect.' });
        teacher.password = await bcrypt.hash(newPassword, 12);
        teacher.isPasswordSet = true;
        await teacher.save();
        res.status(200).json({ message: 'Password changed successfully!' });
    } catch (error) {
        console.error('Error changing teacher password:', error);
        res.status(500).json({ message: 'Failed to change password.', error: error.message });
    }
});


// Teacher send password reset code (public)
app.post('/teacher/send-password-reset-code', [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    const { email } = req.body;
    try {
        const teacher = await Teacher.findOne({ email: email.toLowerCase().trim() });
        if (teacher) {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
            const updated = await VerificationCode.findOneAndUpdate(
                { email, $or: [{ lastSentAt: { $exists: false } }, { lastSentAt: { $lt: twoMinutesAgo } }] },
                { email, code, lastSentAt: new Date(), createdAt: new Date() },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            if (!updated) {
                const existingCode = await VerificationCode.findOne({ email });
                if (existingCode && existingCode.lastSentAt) {
                    const secs = Math.ceil((120000 - (Date.now() - existingCode.lastSentAt.getTime())) / 1000);
                    return res.status(429).json({ message: 'Please wait ' + secs + ' seconds before requesting another code.', retryAfter: secs });
                }
            }
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'SchoolByte - Teacher Password Reset Code',
                html: '<div style="font-family:Arial,sans-serif"><h2 style="color:#2c3e50">SchoolByte Teacher Password Reset</h2><p>Hello ' + teacher.teacherName + ',</p><p>Use the code below to reset your password:</p><div style="background:#f0f4f8;padding:20px;text-align:center;font-size:32px;font-weight:bold;letter-spacing:5px;color:#2c3e50;margin:20px 0">' + code + '</div><p><strong>This code expires in 10 minutes.</strong></p><p>If you did not request this, ignore this email.</p></div>'
            };
            await transporter.sendMail(mailOptions);
        }
        res.status(200).json({ message: 'If a teacher account exists with this email, a password reset code has been sent.' });
    } catch (error) {
        console.error('Error sending teacher reset code:', error);
        res.status(500).json({ message: 'Failed to send reset code.', error: error.message });
    }
});


// Teacher reset password using verification code (public)
app.post('/teacher/reset-password-with-code', [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address.'),
    body('code').notEmpty().withMessage('Verification code is required.'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    const { email, code, newPassword } = req.body;
    try {
        const teacher = await Teacher.findOne({ email: email.toLowerCase().trim() });
        if (!teacher) return res.status(400).json({ message: 'Invalid or expired verification code.' });
        const verificationRecord = await VerificationCode.findOne({ email });
        if (!verificationRecord) return res.status(400).json({ message: 'No verification code found. Please request a new code.' });
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        if (verificationRecord.createdAt < tenMinutesAgo) {
            await VerificationCode.deleteOne({ email });
            return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
        }
        if (verificationRecord.code !== code.trim()) return res.status(400).json({ message: 'Invalid verification code.' });
        teacher.password = await bcrypt.hash(newPassword, 12);
        teacher.isPasswordSet = true;
        await teacher.save();
        await VerificationCode.deleteOne({ email });
        res.status(200).json({ message: 'Password reset successfully! You can now log in with your new password.' });
    } catch (error) {
        console.error('Error resetting teacher password:', error);
        res.status(500).json({ message: 'Failed to reset password.', error: error.message });
    }
});


// Admin signup endpoint
app.post('/signup-admin', [
    body('adminName').notEmpty().trim().withMessage('Admin name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address.'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                message: 'Validation failed',
                errors: errors.array() 
            });
        }


        const { adminName, email, password } = req.body;


        // Check if admin already exists
        const existingAdmin = await Administrator.findOne({ email: email.toLowerCase() });
        if (existingAdmin) {
            return res.status(409).json({ message: 'An administrator with this email already exists.' });
        }


        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);


        // Create new admin
        const newAdmin = new Administrator({
            adminName: adminName.trim(),
            email: email.toLowerCase(),
            password: hashedPassword
        });


        await newAdmin.save();


        res.status(201).json({ 
            message: 'Administrator account created successfully.',
            admin: {
                id: newAdmin._id,
                adminName: newAdmin.adminName,
                email: newAdmin.email
            }
        });


    } catch (error) {
        console.error('Error during admin signup:', error);
        res.status(500).json({ 
            message: 'Server error during admin account creation.',
            error: error.message 
        });
    }
});


// Admin authentication and management endpoints (existing)
app.post('/login-admin', [
    body('email').notEmpty().withMessage('Email is required.'),
    body('password').notEmpty().withMessage('Password is required.')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }


        let { email, password } = req.body;


        // Check for the admin prefix and remove it
        const adminPrefix = 'admin: ';
        if (email.toLowerCase().startsWith(adminPrefix.toLowerCase())) {
            email = email.substring(adminPrefix.length).trim();
        }


        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Please provide a valid email address.' });
        }


        const admin = await Administrator.findOne({ email: email.toLowerCase() });


        if (!admin) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }


        const isMatch = await bcrypt.compare(password, admin.password);


        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }


        // Generate 2FA code
        const code = Math.floor(100000 + Math.random() * 900000).toString();


        await VerificationCode.findOneAndUpdate(
            { email: email.toLowerCase() },
            { code, createdAt: Date.now() },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );


        // Send email if configured
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'SchoolByte Admin 2FA Code',
                html: `<p>Your SchoolByte Administrator 2FA code is: <strong>${code}</strong></p><p>This code is valid for 10 minutes.</p>`
            };


            await transporter.sendMail(mailOptions);
        }


        res.status(200).json({
            message: 'Admin login successful. A 2FA code has been sent to your email.',
            requiresTwoFA: true
        });


    } catch (error) {
        console.error('Error during admin login:', error);
        res.status(500).json({ message: 'Server error during admin login.', error: error.message });
    }
});


app.post('/admin/verify-2fa', [
    body('email').isEmail().withMessage('Please provide a valid email address.'),
    body('code').notEmpty().withMessage('2FA code is required.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { email, code } = req.body;


    try {
        const storedCode = await VerificationCode.findOne({ email });


        if (!storedCode) {
            return res.status(400).json({ message: 'No 2FA code found for this email, or it has expired.' });
        }


        if (storedCode.code === code) {
            const admin = await Administrator.findOne({ email });
            if (!admin) {
                return res.status(404).json({ message: 'Administrator not found.' });
            }


            await VerificationCode.deleteOne({ email });


            const token = jwt.sign(
                { id: admin._id, email: admin.email, adminName: admin.adminName, role: 'admin' },
                JWT_SECRET,
                { expiresIn: '24h' }
            );


            res.status(200).json({
                message: 'Admin 2FA successful! You are now logged in.',
                token: token,
                isPasswordSet: admin.isPasswordSet !== false,
                admin: {
                    adminName: admin.adminName,
                    email: admin.email
                }
            });
        } else {
            return res.status(400).json({ message: 'Invalid 2FA code.' });
        }
    } catch (error) {
        console.error('Error during admin 2FA verification:', error);
        res.status(500).json({ message: 'Server error during 2FA verification.', error: error.message });
    }
});


app.post('/admin/create-admin', authenticateAdminToken, [
    body('adminName').notEmpty().trim().withMessage('Admin name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address.'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                message: 'Validation failed',
                errors: errors.array() 
            });
        }


        const { adminName, email, password } = req.body;


        // Check if admin already exists
        const existingAdmin = await Administrator.findOne({ email: email.toLowerCase() });
        if (existingAdmin) {
            return res.status(409).json({ message: 'An administrator with this email already exists.' });
        }


        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);


        // Create new admin
        const newAdmin = new Administrator({
            adminName: adminName.trim(),
            email: email.toLowerCase(),
            password: hashedPassword
        });


        await newAdmin.save();


        res.status(201).json({ 
            message: 'Administrator account created successfully.',
            admin: {
                id: newAdmin._id,
                name: newAdmin.adminName,
                email: newAdmin.email
            }
        });


    } catch (error) {
        console.error('Error during admin creation:', error);
        res.status(500).json({ 
            message: 'Server error during admin account creation.',
            error: error.message 
        });
    }
});


app.post('/admin/teachers', authenticateAdminToken, [
    body('teacherName').notEmpty().withMessage('Teacher name is required.'),
    body('teacherEmail').isEmail().withMessage('Please provide a valid email address.'),
    body('teacherPassword').isLength({ min: 6 }).withMessage('Initial password must be at least 6 characters long.'),
    body('teacherGender').optional().isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other.'),
    body('teacherPhysicalDescription').optional().isString().withMessage('Physical description must be a string.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { teacherName, teacherEmail, teacherPassword, teacherGender, teacherPhysicalDescription } = req.body;


    try {
        const existingTeacher = await Teacher.findOne({ email: teacherEmail });
        if (existingTeacher) {
            return res.status(409).json({ message: 'A teacher with this email already exists.' });
        }


        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(teacherPassword, saltRounds);


        const newTeacher = new Teacher({
            teacherName,
            email: teacherEmail,
            password: hashedPassword,
            bytes: 0,
            isPasswordSet: false,
            gender: teacherGender === 'male' ? 'Male' : teacherGender === 'female' ? 'Female' : 'Other',
            physicalDescription: teacherPhysicalDescription
        });


        await newTeacher.save();


        res.status(201).json({
            message: 'Teacher account created successfully by administrator! Teacher needs to set their password on first login.',
            teacher: {
                id: newTeacher._id,
                name: newTeacher.teacherName,
                email: newTeacher.email,
                isPasswordSet: newTeacher.isPasswordSet,
                gender: newTeacher.gender,
                physicalDescription: newTeacher.physicalDescription
            }
        });


    } catch (error) {
        console.error('Error creating teacher account by admin:', error);
        res.status(500).json({ message: 'Server error creating teacher account.', error: error.message });
    }
});


app.get('/admin/teachers', authenticateAdminToken, async (req, res) => {
    try {
        const teachers = await Teacher.find({}).select('-password');
        res.status(200).json(teachers);
    } catch (error) {
        console.error('Error fetching teachers by admin:', error);
        res.status(500).json({ message: 'Server error fetching teachers.', error: error.message });
    }
});


// Admin dashboard stats endpoint
app.get('/admin/dashboard-stats', authenticateAdminToken, async (req, res) => {
    try {
        const totalStudents = await Student.countDocuments();
        const totalTeachers = await Teacher.countDocuments();
        const totalQuizQuestions = await QuizQuestion.countDocuments();
        const totalWorkFiles = await WorkFile.countDocuments();


        res.status(200).json({
            message: 'Dashboard stats fetched successfully.',
            stats: {
                totalStudents,
                totalTeachers,
                totalQuizQuestions,
                totalWorkFiles
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ message: 'Failed to fetch dashboard statistics.', error: error.message });
    }
});


app.delete('/admin/teachers/:id', authenticateAdminToken, async (req, res) => {
    const teacherIdToDelete = req.params.id;


    try {
        const teacher = await Teacher.findById(teacherIdToDelete);
        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found.' });
        }


        await WorkFile.updateMany(
            { 'uploadedBy.teacherId': teacherIdToDelete },
            { $set: { 'uploadedBy.teacherId': null } }
        );
        await Activity.updateMany(
            { 'uploadedBy.teacherId': teacherIdToDelete },
            { $set: { 'uploadedBy.teacherId': null } }
        );
        await QuizQuestion.updateMany(
            { 'uploadedBy.teacherId': teacherIdToDelete },
            { $set: { 'uploadedBy.teacherId': null } }
        );


        await Teacher.deleteOne({ _id: teacherIdToDelete });

        // Notify all remaining teachers that a teacher account was deleted
        const remainingTeachers = await Teacher.find({}).select('_id').lean().catch(() => []);
        const delNotifs = remainingTeachers.map(t => ({
            teacher: t._id,
            type: 'account_deleted',
            title: 'Teacher Account Removed',
            message: 'Teacher ' + teacher.teacherName + ' (' + teacher.email + ') has been removed from the system by an administrator.',
            data: { teacherName: teacher.teacherName, teacherEmail: teacher.email }
        }));
        if (delNotifs.length > 0) TeacherNotification.insertMany(delNotifs).catch(() => {});

        res.status(200).json({
            message: `Teacher ${teacher.teacherName} and their associated content references updated/deleted successfully. Content remains attributed by name.`
        });


    } catch (error) {
        console.error('Error deleting teacher account by admin:', error);
        res.status(500).json({ message: 'Server error deleting teacher account.', error: error.message });
    }
});


app.post('/admin/trigger-yearly-upgrade', authenticateAdminToken, async (req, res) => {
    try {
        const students = await Student.find({});


        let upgradedCount = 0;
        let deletedCount = 0;


        for (const student of students) {
            const currentClass = student.class.toUpperCase();


            if (currentClass === 'S.6' || currentClass === 'SENIOR 6') {
                await Student.deleteOne({ _id: student._id });
                deletedCount++;
                console.log(`Deleted S.6 student: ${student.studentName} (Email: ${student.email})`);
            } else {
                let newClass;
                const classNumber = parseInt(currentClass.replace('S.', '').replace('SENIOR ', ''));


                if (!isNaN(classNumber) && classNumber >= 1 && classNumber <= 5) {
                    newClass = `S.${classNumber + 1}`;
                    await Student.updateOne({ _id: student._id }, { class: newClass });
                    upgradedCount++;
                    console.log(`Upgraded student ${student.studentName} from ${currentClass} to ${newClass}`);
                } else {
                    console.warn(`Skipping student ${student.studentName} with unrecognized class format: ${student.class}`);
                }
            }
        }


        res.status(200).json({
            message: 'Yearly student upgrade and deletion process completed.',
            upgradedStudents: upgradedCount,
            deletedStudents: deletedCount
        });


    } catch (error) {
        console.error('Error during yearly student upgrade/deletion:', error);
        res.status(500).json({ message: 'Server error during yearly upgrade process.', error: error.message });
    }
});


// Leaderboard: single handler, mounted on both paths to avoid duplicate logic
async function getLeaderboardHandler(req, res) {
    try {
        const { limit = 200 } = req.query;
        const currentStudentId = req.student.id;

        const students = await Student.find({ isEmailVerified: true })
            .sort({ bytes: -1 })
            .select('preferredName studentName bytes xp currentTier')
            .limit(Math.min(parseInt(limit, 10) || 200, 500))
            .lean();

        const leaderboard = students.map((student, index) => {
            const rank = index + 1;
            const isCurrentUser = student._id.toString() === currentStudentId;
            const displayName = student.preferredName || student.studentName;

            return {
                rank,
                displayName,
                bytes: rank <= 200 || isCurrentUser ? student.bytes : undefined,
                xp: student.xp,
                tier: student.currentTier || 1,
                isCurrentUser
            };
        });

        res.status(200).json({
            message: 'Leaderboard fetched successfully!',
            leaderboard,
            totalPlayers: leaderboard.length
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ message: 'Server error fetching leaderboard.', error: error.message });
    }
}
app.get('/leaderboard', authenticateToken, getLeaderboardHandler);
app.get('/api/leaderboard', authenticateToken, getLeaderboardHandler);

app.get('/teacher/leaderboard', async (req, res) => {
    try {
        const teachers = await Teacher.find({})
            .sort({ bytes: -1 })
            .select('teacherName bytes')
            .lean();


        const teacherLeaderboard = teachers.map(teacher => ({
            name: teacher.teacherName,
            bytes: teacher.bytes
        }));


        res.status(200).json({
            message: 'Teacher Leaderboard fetched successfully!',
            leaderboard: teacherLeaderboard
        });


    } catch (error) {
        console.error('Error fetching teacher leaderboard:', error);
        res.status(500).json({ message: 'Server error fetching teacher leaderboard.', error: error.message });
    }
});



// Route for the teacher's initial password setup page
app.get('/teacher-set-password.html', (req, res) => {
    // Assuming HTML files are in a 'public' folder
    res.sendFile(path.join(__dirname, 'public', 'teacher-set-password.html'));
});


// Teacher initial password setting endpoint
app.put('/teacher/set-initial-password', authenticateTeacherToken, [
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { newPassword } = req.body;
    const teacherId = req.teacher.id;


    try {
        const teacher = await Teacher.findById(teacherId);
        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found.' });
        }


        // Check if password is already set
        if (teacher.isPasswordSet) {
            return res.status(400).json({ message: 'Password has already been set. Use the profile settings to change it.' });
        }


        // Hash the new password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);


        // Update teacher password and set flag
        teacher.password = hashedPassword;
        teacher.isPasswordSet = true;
        await teacher.save();


        res.status(200).json({
            message: 'Password set successfully!',
            teacher: {
                teacherName: teacher.teacherName,
                email: teacher.email,
                isPasswordSet: teacher.isPasswordSet
            }
        });


    } catch (error) {
        console.error('Error setting initial password:', error);
        res.status(500).json({ message: 'Failed to set password. Please try again.', error: error.message });
    }
});


app.get('/teacher/profile', authenticateTeacherToken, async (req, res) => {
    try {
        const teacherData = await Teacher.findById(req.teacher.id).select('-password');


        if (!teacherData) {
            return res.status(404).json({ message: 'Teacher not found.' });
        }


        res.status(200).json({
            message: 'Teacher profile fetched successfully.',
            teacher: {
                teacherName: teacherData.teacherName,
                email: teacherData.email,
                isPasswordSet: teacherData.isPasswordSet,
                bytes: teacherData.bytes,
                gender: teacherData.gender,
                physicalDescription: teacherData.physicalDescription,
                createdAt: teacherData.createdAt
            }
        });
    } catch (error) {
        console.error('Error fetching teacher profile:', error);
        res.status(500).json({ message: 'Server error fetching profile.', error: error.message });
    }
});


// ==================== ACHIEVEMENT AND XP SYSTEM API ENDPOINTS ====================

// Helper Functions for Achievement System
async function awardAchievement(studentId, achievementId, progress = 1, target = 1) {
    try {
        const student = await Student.findById(studentId);
        if (!student) {
            console.error('Student not found for achievement award:', studentId);
            return null;
        }

        const achievement = await Achievement.findOne({ achievementId });
        if (!achievement) {
            console.error('Achievement not found:', achievementId);
            return null;
        }

        let studentAchievement = await StudentAchievement.findOne({
            student: studentId,
            achievementId: achievementId
        });

        if (!studentAchievement) {
            studentAchievement = new StudentAchievement({
                student: studentId,
                achievementId: achievementId,
                achievement: achievement._id,
                progress: 0,
                target: target,
                unlocked: false
            });
        }

        if (studentAchievement.unlocked) {
            return null;
        }

        studentAchievement.progress = Math.min(studentAchievement.progress + progress, target);

        if (studentAchievement.progress >= target && !studentAchievement.unlocked) {
            studentAchievement.unlocked = true;
            studentAchievement.unlockedAt = new Date();

            student.bytes += achievement.byteReward;
            student.xp += achievement.xpReward;
            await student.save();

            await checkAndUpdateTier(studentId);

            await createNotification(
                studentId,
                'achievement',
                `Achievement Unlocked: ${achievement.name}!`,
                `You've earned ${achievement.byteReward} bytes and ${achievement.xpReward} XP!`,
                { 
                    achievementId: achievement.achievementId,
                    icon: achievement.icon,
                    tier: achievement.tier
                }
            );

            await studentAchievement.save();
            return { achievement, newlyUnlocked: true };
        }

        await studentAchievement.save();
        return { achievement, newlyUnlocked: false, progress: studentAchievement.progress, target: studentAchievement.target };

    } catch (error) {
        console.error('Error awarding achievement:', error);
        return null;
    }
}

async function createNotification(studentId, type, title, message, metadata = {}) {
    try {
        const notification = new Notification({
            student: studentId,
            type,
            title,
            message,
            data: metadata,
            read: false
        });
        await notification.save();
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
}

async function checkAndUpdateTier(studentId) {
    try {
        const student = await Student.findById(studentId);
        if (!student) return null;

        const nextTier = await PlayerLevel.findOne({ tier: student.currentTier + 1 });

        if (nextTier && student.xp >= nextTier.totalXPRequired) {
            const oldTier = student.currentTier;
            student.currentTier = nextTier.tier;
            student.bytes += nextTier.levelUpByteReward;
            await student.save();

            await createNotification(
                studentId,
                'level_up',
                `Tier Up! You're now ${nextTier.name}!`,
                `Congratulations! You've earned ${nextTier.levelUpByteReward} bonus bytes for reaching Tier ${nextTier.tier}.`,
                { 
                    oldTier: oldTier,
                    newTier: nextTier.tier,
                    tierName: nextTier.name,
                    byteReward: nextTier.levelUpByteReward
                }
            );

            return nextTier;
        }
        return null;
    } catch (error) {
        console.error('Error checking tier update:', error);
        return null;
    }
}

// Initialize Player Levels and Achievements (One-time seed - Admin only)
app.post('/api/admin/initialize-achievements', async (req, res) => {
    try {
        // Initialize Player Levels
        const playerLevels = [
            { tier: 1, name: 'New User', totalXPRequired: 20, levelUpByteReward: 20 },
            { tier: 2, name: 'Novice', totalXPRequired: 100, levelUpByteReward: 50 },
            { tier: 3, name: 'Apprentice', totalXPRequired: 250, levelUpByteReward: 100 },
            { tier: 4, name: 'Adept', totalXPRequired: 500, levelUpByteReward: 150 },
            { tier: 5, name: 'Specialist', totalXPRequired: 800, levelUpByteReward: 200 },
            { tier: 6, name: 'Expert', totalXPRequired: 1200, levelUpByteReward: 250 },
            { tier: 7, name: 'Master', totalXPRequired: 1700, levelUpByteReward: 300 },
            { tier: 8, name: 'Grandmaster', totalXPRequired: 2300, levelUpByteReward: 400 },
            { tier: 9, name: 'Virtuoso', totalXPRequired: 3000, levelUpByteReward: 500 },
            { tier: 10, name: 'Legend', totalXPRequired: 4000, levelUpByteReward: 1000 }
        ];

        for (const level of playerLevels) {
            await PlayerLevel.findOneAndUpdate(
                { tier: level.tier },
                level,
                { upsert: true, new: true }
            );
        }

        // Initialize GeoQuiz Achievements
        const geoQuizAchievements = [
            { achievementId: 'geo_first_steps', name: 'First Steps', description: 'Correctly identify your first country.', tier: 'Bronze', category: 'GeoQuiz', byteReward: 10, xpReward: 10, icon: 'fa-flag' },
            { achievementId: 'geo_alias_user', name: 'Alias User', description: 'Answer correctly using a country\'s alias (e.g., "DRC" or "Cote d\'Ivoire").', tier: 'Bronze', category: 'GeoQuiz', byteReward: 15, xpReward: 15, icon: 'fa-tag' },
            { achievementId: 'geo_the_speller', name: 'The Speller', description: 'Get 5 answers in a row with a perfect nearness score (spelled 100% correctly).', tier: 'Silver', category: 'GeoQuiz', byteReward: 35, xpReward: 35, icon: 'fa-spell-check' },
            { achievementId: 'geo_high_scorer', name: 'High Scorer', description: 'Achieve a final score of 150 or more on a single continent.', tier: 'Silver', category: 'GeoQuiz', byteReward: 50, xpReward: 50, icon: 'fa-star' },
            { achievementId: 'geo_african_explorer', name: 'African Explorer', description: 'Successfully identify all countries in the Africa quiz.', tier: 'Silver', category: 'GeoQuiz', byteReward: 50, xpReward: 50, icon: 'fa-globe-africa' },
            { achievementId: 'geo_south_american_voyager', name: 'S. American Voyager', description: 'Successfully identify all countries in the South America quiz.', tier: 'Silver', category: 'GeoQuiz', byteReward: 40, xpReward: 40, icon: 'fa-globe-americas' },
            { achievementId: 'geo_geography_adept', name: 'Geography Adept', description: 'Correctly identify 100 countries total (across all games played).', tier: 'Gold', category: 'GeoQuiz', byteReward: 75, xpReward: 75, icon: 'fa-globe' },
            { achievementId: 'geo_human_gps', name: 'Human GPS', description: 'Finish a continent with a final accuracy of 90% or higher.', tier: 'Gold', category: 'GeoQuiz', byteReward: 100, xpReward: 100, icon: 'fa-location-dot' },
            { achievementId: 'geo_world_class', name: 'World-Class', description: 'Complete both the Africa and South America quizzes at least once.', tier: 'Gold', category: 'GeoQuiz', byteReward: 100, xpReward: 100, icon: 'fa-earth-americas' },
            { achievementId: 'geo_flawless_cartographer', name: 'Flawless Cartographer', description: 'Finish a continent with 100% accuracy (no incorrect guesses).', tier: 'Platinum', category: 'GeoQuiz', byteReward: 200, xpReward: 200, icon: 'fa-map' },
            { achievementId: 'geo_globe_trotter', name: 'Globe Trotter', description: 'Correctly identify 500 countries total (across all games played).', tier: 'Diamond', category: 'GeoQuiz', byteReward: 300, xpReward: 300, icon: 'fa-plane' }
        ];

        // Initialize Byte-Sudoku Achievements
        const sudokuAchievements = [
            { achievementId: 'sudoku_first_digit', name: 'First Digit', description: 'Place your first correct number.', tier: 'Bronze', category: 'ByteSudoku', byteReward: 10, xpReward: 10, icon: 'fa-1' },
            { achievementId: 'sudoku_just_a_nudge', name: 'Just a Nudge', description: 'Use one of your free hints.', tier: 'Bronze', category: 'ByteSudoku', byteReward: 10, xpReward: 10, icon: 'fa-lightbulb' },
            { achievementId: 'sudoku_novice', name: 'Sudoku Novice', description: 'Complete an \'Easy\' puzzle.', tier: 'Bronze', category: 'ByteSudoku', byteReward: 20, xpReward: 20, icon: 'fa-check' },
            { achievementId: 'sudoku_on_a_roll', name: 'On a Roll!', description: 'Get 5 consecutive correct answers and earn a bonus chance.', tier: 'Bronze', category: 'ByteSudoku', byteReward: 20, xpReward: 20, icon: 'fa-fire' },
            { achievementId: 'sudoku_cost_of_knowledge', name: 'Cost of Knowledge', description: 'Pay for a hint using your earned bytes (after free hints are gone).', tier: 'Silver', category: 'ByteSudoku', byteReward: 25, xpReward: 25, icon: 'fa-coins' },
            { achievementId: 'sudoku_close_shave', name: 'Close Shave', description: 'Successfully complete a puzzle with 0 chances remaining.', tier: 'Silver', category: 'ByteSudoku', byteReward: 40, xpReward: 40, icon: 'fa-heart-crack' },
            { achievementId: 'sudoku_adept', name: 'Sudoku Adept', description: 'Complete a \'Hard\' puzzle.', tier: 'Silver', category: 'ByteSudoku', byteReward: 50, xpReward: 50, icon: 'fa-chart-simple' },
            { achievementId: 'sudoku_self_sufficient', name: 'Self-Sufficient', description: 'Complete a \'Hard\' or harder puzzle without using any hints.', tier: 'Gold', category: 'ByteSudoku', byteReward: 100, xpReward: 100, icon: 'fa-user-ninja' },
            { achievementId: 'sudoku_valedictorian', name: 'Valedictorian', description: 'Get a final grade of 100% on any puzzle.', tier: 'Gold', category: 'ByteSudoku', byteReward: 120, xpReward: 120, icon: 'fa-graduation-cap' },
            { achievementId: 'sudoku_grandmaster', name: 'Sudoku Grandmaster', description: 'Complete a \'Brutal\' puzzle.', tier: 'Gold', category: 'ByteSudoku', byteReward: 150, xpReward: 150, icon: 'fa-crown' },
            { achievementId: 'sudoku_perfect_game', name: 'Perfect Game', description: 'Complete any puzzle and earn the "Perfect Game Bonus" (no mistakes, no hints).', tier: 'Platinum', category: 'ByteSudoku', byteReward: 250, xpReward: 250, icon: 'fa-gem' },
            { achievementId: 'sudoku_full_grid', name: 'Full Grid', description: 'Complete one puzzle of each difficulty level (Easy, Medium, Hard, Impossible, Insane, Brutal).', tier: 'Diamond', category: 'ByteSudoku', byteReward: 500, xpReward: 500, icon: 'fa-trophy' }
        ];

        const allAchievements = [...geoQuizAchievements, ...sudokuAchievements];

        for (const achievement of allAchievements) {
            await Achievement.findOneAndUpdate(
                { achievementId: achievement.achievementId },
                achievement,
                { upsert: true, new: true }
            );
        }

        res.status(200).json({ 
            message: 'Player levels and achievements initialized successfully!',
            playerLevelsCount: playerLevels.length,
            achievementsCount: allAchievements.length
        });

    } catch (error) {
        console.error('Error initializing achievements:', error);
        res.status(500).json({ message: 'Failed to initialize achievements', error: error.message });
    }
});

// Get Student Achievements and Progress
app.get('/api/student/achievements', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        // Get all achievements
        const allAchievements = await Achievement.find({}).sort({ tier: 1, xpReward: 1 });

        // Get student's progress on achievements
        const studentAchievements = await StudentAchievement.find({ student: studentId })
            .populate('achievement');

        // Get current tier info
        const currentTierInfo = await PlayerLevel.findOne({ tier: student.currentTier });
        const nextTierInfo = await PlayerLevel.findOne({ tier: student.currentTier + 1 });

        // Map achievements with student's progress
        const achievementsWithProgress = allAchievements.map(achievement => {
            const progress = studentAchievements.find(sa => sa.achievementId === achievement.achievementId);
            return {
                ...achievement.toObject(),
                unlocked: progress?.unlocked || false,
                unlockedAt: progress?.unlockedAt || null,
                progress: progress?.progress || 0,
                target: progress?.target || 1
            };
        });

        res.status(200).json({
            student: {
                xp: student.xp,
                currentTier: student.currentTier,
                bytes: student.bytes
            },
            currentTierInfo,
            nextTierInfo,
            achievements: achievementsWithProgress,
            stats: {
                totalCountriesIdentified: student.totalCountriesIdentified,
                totalSudokuPuzzlesCompleted: student.totalSudokuPuzzlesCompleted,
                geoQuizStats: student.geoQuizStats,
                sudokuStats: student.sudokuStats
            }
        });

    } catch (error) {
        console.error('Error fetching student achievements:', error);
        res.status(500).json({ message: 'Failed to fetch achievements', error: error.message });
    }
});

// Convert XP to Bytes
app.post('/api/student/convert-xp-to-bytes', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { xpAmount } = req.body;

        if (!xpAmount || xpAmount <= 0) {
            return res.status(400).json({ message: 'Invalid XP amount. Must be greater than 0.' });
        }

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        if (student.xp < xpAmount) {
            return res.status(400).json({ 
                message: 'Insufficient XP.',
                availableXP: student.xp,
                requestedXP: xpAmount
            });
        }

        // Conversion rate: 1 XP = 0.3 bytes
        const bytesEarned = xpAmount * 0.3;
        const wholeBytes = Math.floor(bytesEarned);
        const decimalBytes = (bytesEarned - wholeBytes).toFixed(1);

        // Deduct XP and add bytes (whole number only)
        student.xp -= xpAmount;
        student.bytes += wholeBytes;
        await student.save();

        res.status(200).json({
            message: 'XP converted to bytes successfully!',
            xpConverted: xpAmount,
            bytesEarned: wholeBytes,
            decimalBytes: decimalBytes,
            totalBytesEarned: bytesEarned.toFixed(1),
            remainingXP: student.xp,
            totalBytes: student.bytes
        });

    } catch (error) {
        console.error('Error converting XP to bytes:', error);
        res.status(500).json({ message: 'Failed to convert XP', error: error.message });
    }
});

// Get Student Notifications
app.get('/api/student/notifications', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { limit = 50, unreadOnly = false } = req.query;

        const query = { student: studentId };
        if (unreadOnly === 'true') {
            query.read = false;
        }

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        const unreadCount = await Notification.countDocuments({ 
            student: studentId, 
            read: false 
        });

        res.status(200).json({
            notifications,
            unreadCount
        });

    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Failed to fetch notifications', error: error.message });
    }
});

// Mark Notification as Read
app.patch('/api/student/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { id } = req.params;

        const notification = await Notification.findOneAndUpdate(
            { _id: id, student: studentId },
            { read: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found.' });
        }

        res.status(200).json({ message: 'Notification marked as read.', notification });

    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Failed to update notification', error: error.message });
    }
});

// GeoQuiz Game Progress Tracking Endpoint
app.post('/api/games/geoquiz/submit-answer', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { countryName, isCorrect, isAlias, nearnessScore, continent, finalScore, accuracy } = req.body;

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const achievementsUnlocked = [];

        if (isCorrect) {
            student.totalCountriesIdentified = (student.totalCountriesIdentified || 0) + 1;

            if (!student.geoQuizStats) {
                student.geoQuizStats = {
                    totalCountriesIdentified: 0,
                    perfectSpellings: 0,
                    aliasesUsed: 0,
                    continentsCompleted: [],
                    highestScore: 0,
                    totalGamesPlayed: 0
                };
            }

            student.geoQuizStats.totalCountriesIdentified++;

            // First Steps Achievement
            if (student.totalCountriesIdentified === 1) {
                const result = await awardAchievement(studentId, 'geo_first_steps');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }

            // Alias User Achievement
            if (isAlias) {
                student.geoQuizStats.aliasesUsed++;
                const result = await awardAchievement(studentId, 'geo_alias_user');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }

            // The Speller Achievement (5 perfect spellings in a row tracked client-side)
            if (nearnessScore === 100) {
                student.geoQuizStats.perfectSpellings++;
            }

            // Geography Adept (100 countries total)
            if (student.totalCountriesIdentified === 100) {
                const result = await awardAchievement(studentId, 'geo_geography_adept');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }

            // Globe Trotter (500 countries total)
            if (student.totalCountriesIdentified === 500) {
                const result = await awardAchievement(studentId, 'geo_globe_trotter');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }
        }

        // Track continent-specific achievements
        if (finalScore && continent) {
            // High Scorer Achievement (150+ score)
            if (finalScore >= 150) {
                const result = await awardAchievement(studentId, 'geo_high_scorer');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }

            // Update highest score
            if (finalScore > (student.geoQuizStats?.highestScore || 0)) {
                student.geoQuizStats.highestScore = finalScore;
            }

            // Track continent completion
            if (!student.geoQuizStats.continentsCompleted.includes(continent)) {
                student.geoQuizStats.continentsCompleted.push(continent);

                // African Explorer
                if (continent === 'Africa') {
                    const result = await awardAchievement(studentId, 'geo_african_explorer');
                    if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
                }

                // South American Voyager
                if (continent === 'South America') {
                    const result = await awardAchievement(studentId, 'geo_south_american_voyager');
                    if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
                }
            }

            // Human GPS (90%+ accuracy)
            if (accuracy && accuracy >= 90) {
                const result = await awardAchievement(studentId, 'geo_human_gps');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }

            // Flawless Cartographer (100% accuracy)
            if (accuracy === 100) {
                const result = await awardAchievement(studentId, 'geo_flawless_cartographer');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }

            // World-Class (completed both Africa and South America)
            if (student.geoQuizStats.continentsCompleted.includes('Africa') && 
                student.geoQuizStats.continentsCompleted.includes('South America')) {
                const result = await awardAchievement(studentId, 'geo_world_class');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }
        }

        await student.save();

        res.status(200).json({
            message: 'GeoQuiz progress tracked successfully!',
            achievementsUnlocked,
            stats: {
                totalCountries: student.totalCountriesIdentified,
                geoQuizStats: student.geoQuizStats
            }
        });

    } catch (error) {
        console.error('Error tracking GeoQuiz progress:', error);
        res.status(500).json({ message: 'Failed to track progress', error: error.message });
    }
});

// Byte-Sudoku Game Progress Tracking Endpoint
app.post('/api/games/sudoku/submit-result', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { difficulty, completed, hintsUsed, paidHintsUsed, chancesRemaining, grade, isPerfectGame } = req.body;

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const achievementsUnlocked = [];

        if (!student.sudokuStats) {
            student.sudokuStats = {
                totalPuzzlesCompleted: 0,
                easyCompleted: 0,
                mediumCompleted: 0,
                hardCompleted: 0,
                impossibleCompleted: 0,
                insaneCompleted: 0,
                brutalCompleted: 0,
                perfectGames: 0,
                hintsUsed: 0,
                paidHintsUsed: 0
            };
        }

        // First Digit Achievement (tracked client-side on first correct number)

        // Just a Nudge Achievement (first hint used)
        if (hintsUsed > 0 && student.sudokuStats.hintsUsed === 0) {
            const result = await awardAchievement(studentId, 'sudoku_just_a_nudge');
            if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
        }

        if (completed) {
            student.totalSudokuPuzzlesCompleted = (student.totalSudokuPuzzlesCompleted || 0) + 1;
            student.sudokuStats.totalPuzzlesCompleted++;

            // Track difficulty-specific completions
            if (difficulty === 'Easy') {
                student.sudokuStats.easyCompleted++;
                const result = await awardAchievement(studentId, 'sudoku_novice');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            } else if (difficulty === 'Hard') {
                student.sudokuStats.hardCompleted++;
                const result = await awardAchievement(studentId, 'sudoku_adept');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            } else if (difficulty === 'Brutal') {
                student.sudokuStats.brutalCompleted++;
                const result = await awardAchievement(studentId, 'sudoku_grandmaster');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }

            // Close Shave (0 chances remaining)
            if (chancesRemaining === 0) {
                const result = await awardAchievement(studentId, 'sudoku_close_shave');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }

            // Self-Sufficient (Hard or harder with no hints)
            if ((difficulty === 'Hard' || difficulty === 'Impossible' || difficulty === 'Insane' || difficulty === 'Brutal') && 
                hintsUsed === 0 && paidHintsUsed === 0) {
                const result = await awardAchievement(studentId, 'sudoku_self_sufficient');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }

            // Valedictorian (100% grade)
            if (grade === 100) {
                const result = await awardAchievement(studentId, 'sudoku_valedictorian');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }

            // Perfect Game
            if (isPerfectGame) {
                student.sudokuStats.perfectGames++;
                const result = await awardAchievement(studentId, 'sudoku_perfect_game');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }

            // Full Grid (one of each difficulty)
            if (student.sudokuStats.easyCompleted >= 1 && 
                student.sudokuStats.mediumCompleted >= 1 &&
                student.sudokuStats.hardCompleted >= 1 &&
                student.sudokuStats.impossibleCompleted >= 1 &&
                student.sudokuStats.insaneCompleted >= 1 &&
                student.sudokuStats.brutalCompleted >= 1) {
                const result = await awardAchievement(studentId, 'sudoku_full_grid');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }
        }

        // Cost of Knowledge (paid for a hint)
        if (paidHintsUsed > 0 && student.sudokuStats.paidHintsUsed === 0) {
            const result = await awardAchievement(studentId, 'sudoku_cost_of_knowledge');
            if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
        }

        student.sudokuStats.hintsUsed += hintsUsed || 0;
        student.sudokuStats.paidHintsUsed += paidHintsUsed || 0;

        await student.save();

        res.status(200).json({
            message: 'Sudoku progress tracked successfully!',
            achievementsUnlocked,
            stats: {
                totalPuzzles: student.totalSudokuPuzzlesCompleted,
                sudokuStats: student.sudokuStats
            }
        });

    } catch (error) {
        console.error('Error tracking Sudoku progress:', error);
        res.status(500).json({ message: 'Failed to track progress', error: error.message });
    }
});

// Career Guidance AI Endpoint using TinyLlama
app.post('/api/career-guidance/chat', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { message, chatHistory } = req.body;

        if (!message) {
            return res.status(400).json({ message: 'Message is required.' });
        }

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const studentContext = `
Student Profile:
- Name: ${student.preferredName || student.studentName}
- Current Tier: Level ${student.currentTier} (out of 10)
- Total XP Earned: ${student.xp}
- Bytes (Virtual Currency): ${student.bytes}
- Total Countries Identified (Geography): ${student.totalCountriesIdentified || 0}
- Total Sudoku Puzzles Completed: ${student.totalSudokuPuzzlesCompleted || 0}
- Geography Quiz Stats: ${JSON.stringify(student.geoQuizStats || {})}
- Sudoku Stats: ${JSON.stringify(student.sudokuStats || {})}

You are a professional career guidance counselor AI for SchoolByte, an educational platform in Uganda. Based on the student's academic performance, interests, and skills demonstrated through their gameplay and quiz results, provide personalized career advice, study tips, and motivational guidance.

Be encouraging, specific, and culturally relevant to Uganda and East Africa. Suggest careers that match their demonstrated skills (e.g., geography knowledge → cartography, tourism, geology; logical thinking from Sudoku → engineering, computer science, data analysis).

Keep responses concise (2-4 paragraphs), friendly, and actionable. Use their performance data to give specific feedback.
`;

        const fullPrompt = chatHistory && chatHistory.length > 0 
            ? `${studentContext}\n\nConversation history:\n${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}\n\nStudent: ${message}\n\nCareer Counselor:`
            : `${studentContext}\n\nStudent: ${message}\n\nCareer Counselor:`;

        // Call TinyLlama via Ollama with robust error handling
        const aiReply = await callGroqAI(
            fullPrompt,
            "You are a professional career guidance counselor AI. Provide personalized, culturally relevant career advice for students in Uganda.",
            { temperature: 0.8, num_predict: 800, timeout: 60000, retries: 2 }
        );

        res.status(200).json({
            message: 'Career guidance response generated successfully.',
            reply: aiReply,
            studentStats: {
                tier: student.currentTier,
                xp: student.xp,
                bytes: student.bytes
            }
        });

    } catch (error) {
        console.error('Error in career guidance chat:', error);
        res.status(500).json({ 
            message: 'Failed to generate career guidance response.', 
            error: error.message 
        });
    }
});

// AI Buddy Endpoint - General study assistance using TinyLlama
app.post('/api/ai-buddy/chat', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { message, chatHistory } = req.body;

        if (!message) {
            return res.status(400).json({ message: 'Message is required.' });
        }

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        // Simplified, focused system prompt
        const systemPrompt = `You are AI Buddy, a helpful study assistant for students in Uganda. Answer questions clearly and accurately. Focus on the specific question asked. Keep responses under 100 words unless explaining a complex concept. Be factual and educational.`;

        // Build conversation context (limit to recent messages)
        let conversationContext = '';
        if (chatHistory && chatHistory.length > 0) {
            const recentHistory = chatHistory.slice(-4); // Last 2 exchanges
            conversationContext = recentHistory.map(msg => {
                const role = msg.role === 'user' ? 'Student' : 'AI Buddy';
                return `${role}: ${msg.content}`;
            }).join('\n');
            conversationContext += '\n\n';
        }

        const fullPrompt = `${conversationContext}Student: ${message}\n\nAI Buddy:`;

        // Call TinyLlama with optimized settings
        const aiReply = await callGroqAI(
            fullPrompt,
            systemPrompt,
            { temperature: 0.5, num_predict: 350, timeout: 40000, retries: 1 }
        );

        res.status(200).json({
            message: 'AI Buddy response generated successfully.',
            reply: aiReply.trim()
        });

    } catch (error) {
        console.error('Error in AI Buddy chat:', error);
        res.status(500).json({ 
            message: 'Failed to generate AI Buddy response.', 
            error: error.message 
        });
    }
});

// ByteNexus Support Team Endpoint - SchoolByte platform help using TinyLlama
app.post('/api/bytenexus-support/chat', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { message, chatHistory } = req.body;

        if (!message) {
            return res.status(400).json({ message: 'Message is required.' });
        }

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const platformContext = `
You are ByteNexus Support Team, the official technical support AI for SchoolByte educational platform. Your role is to:
- Answer questions about SchoolByte features and how to use them
- Help students navigate the platform (quizzes, career guidance, chat, notes, activities, etc.)
- Explain the XP system, Bytes currency, tier progression, and rewards
- Troubleshoot common issues students face on the platform
- Provide tips for getting the most out of SchoolByte features

SchoolByte Features:
- Quiz System: Subject-based quizzes with multiple question types
- Notes & Activities: Educational content upload/download with byte-based costs
- Career Guidance: AI-powered career counseling and advice
- AI Buddy: General study assistance (that's a different AI, not you)
- Chat System: Personal messaging and discussion groups with teachers/students
- XP & Tiers: Students earn XP by completing quizzes and activities, advancing through 10 tiers
- Bytes: Virtual currency earned through activities, used to download notes and access content

Be professional, helpful, and specific. Reference actual SchoolByte features accurately. Keep responses concise (2-3 paragraphs).`;

        const fullPrompt = chatHistory && chatHistory.length > 0 
            ? `${platformContext}\n\nConversation history:\n${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}\n\nStudent (${student.preferredName || student.studentName}): ${message}\n\nByteNexus Support:`
            : `${platformContext}\n\nStudent (${student.preferredName || student.studentName}): ${message}\n\nByteNexus Support:`;

        // Call TinyLlama via Ollama
        const aiReply = await callGroqAI(
            fullPrompt,
            "You are ByteNexus Support Team, the official technical support AI for SchoolByte. Help students understand and use platform features effectively.",
            { temperature: 0.6, num_predict: 600, timeout: 60000, retries: 2 }
        );

        res.status(200).json({
            message: 'ByteNexus Support response generated successfully.',
            reply: aiReply
        });

    } catch (error) {
        console.error('Error in ByteNexus Support chat:', error);
        res.status(500).json({ 
            message: 'Failed to generate ByteNexus Support response.', 
            error: error.message 
        });
    }
});

// Counselling and Guidance Endpoint - Emotional and academic support using TinyLlama
app.post('/api/counselling/chat', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { message, chatHistory, counsellingType } = req.body;

        if (!message) {
            return res.status(400).json({ message: 'Message is required.' });
        }

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const typeContexts = {
            academic: 'You are providing academic counselling, helping with study stress, time management, exam anxiety, and academic challenges. Be supportive and provide practical study strategies.',
            emotional: 'You are providing emotional support counselling, helping students navigate feelings, relationships, peer pressure, and personal challenges. Be empathetic, non-judgmental, and encouraging.',
            crisis: 'You are providing crisis support counselling for urgent situations. Be calm, compassionate, and direct. Encourage professional help when needed. Focus on immediate coping strategies and safety.'
        };

        const counsellingContext = typeContexts[counsellingType] || typeContexts.academic;

        const systemPrompt = `You are a professional school counsellor in Uganda providing supportive guidance to students. ${counsellingContext} Keep responses caring, culturally sensitive, and under 120 words unless explaining important coping strategies. Be warm and encouraging.`;

        let conversationContext = '';
        if (chatHistory && chatHistory.length > 0) {
            const recentHistory = chatHistory.slice(-4);
            conversationContext = recentHistory.map(msg => {
                const role = msg.role === 'user' ? 'Student' : 'Counsellor';
                return `${role}: ${msg.content}`;
            }).join('\n');
            conversationContext += '\n\n';
        }

        const fullPrompt = `${conversationContext}Student: ${message}\n\nCounsellor:`;

        const aiReply = await callGroqAI(
            fullPrompt,
            systemPrompt,
            { temperature: 0.7, num_predict: 500, timeout: 50000, retries: 2 }
        );

        res.status(200).json({
            message: 'Counselling response generated successfully.',
            reply: aiReply.trim()
        });

    } catch (error) {
        console.error('Error in counselling chat:', error);
        res.status(500).json({ 
            message: 'Failed to generate counselling response.', 
            error: error.message 
        });
    }
});

// Serve admin login page
app.get('/admin-login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'adminlogin.html'));
});


// --- ByteNexus Chat API Endpoints ---

// Create Discussion Group
app.post('/api/groups/create', authenticateToken, [
  body('name').notEmpty().trim().withMessage('Group name is required.'),
  body('description').optional().trim(),
  body('rules').optional().trim(),
  body('is_public').optional().isBoolean(),
  body('invited_members').optional().isArray()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description, rules, is_public, invited_members } = req.body;
  const studentId = req.student.id;

  try {
    const creator = await Student.findById(studentId);
    if (!creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    // Create and save the group to database
    const newGroup = new DiscussionGroup({
      name: name.trim(),
      description: description ? description.trim() : '',
      rules: rules ? rules.trim() : '',
      is_public: is_public !== false,
      created_by: studentId,
      members: [studentId] // Creator is automatically a member
    });

    await newGroup.save();
    const groupId = newGroup._id.toString();

    // Generate invitation token
    const invitationToken = Buffer.from(JSON.stringify({
      groupId: groupId,
      groupName: name,
      invitedBy: studentId,
      timestamp: Date.now()
    })).toString('base64');

    // Create invitation link
    const invitationLink = `${req.protocol}://${req.get('host')}/bytenexus-chat.html?invite=${invitationToken}`;

    // Send invitation messages to each invited member
    if (invited_members && invited_members.length > 0) {
      const currentStudent = await Student.findById(studentId); // Fetch current student for name

      for (const memberId of invited_members) {
        const invitedUser = await Student.findById(memberId);
        if (invitedUser) {
          // Create invitation message with clickable HTML link
          const invitationMessage = new PersonalMessage({
            sender_id: studentId,
            recipient_id: memberId,
            content: `🎉 You've been invited to join "${name}"!\n\n📋 ${description || 'Discussion group'}\n\n<a href="${invitationLink}">Click here to join</a>\n\nInvited by: ${currentStudent.studentName}`,
            read: false,
            delivered: false
          });

          await invitationMessage.save();

          // Send real-time notification if user is online
          const recipientSocket = authenticatedSockets.get(memberId);
          if (recipientSocket) {
            const messageWithSender = await PersonalMessage.findById(invitationMessage._id)
              .populate('sender_id', 'studentName email')
              .populate('recipient_id', 'studentName email')
              .lean();

            const formattedMessage = {
              _id: messageWithSender._id.toString(),
              id: messageWithSender._id.toString(),
              sender_id: messageWithSender.sender_id._id.toString(),
              recipient_id: messageWithSender.recipient_id._id.toString(),
              content: messageWithSender.content,
              read: messageWithSender.read,
              delivered: true,
              created_at: messageWithSender.created_at,
              sender: {
                id: messageWithSender.sender_id._id.toString(),
                username: messageWithSender.sender_id.studentName,
                avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${messageWithSender.sender_id.studentName}`
              },
              recipient: {
                id: messageWithSender.recipient_id._id.toString(),
                username: messageWithSender.recipient_id.studentName,
                avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${messageWithSender.recipient_id.studentName}`
              }
            };

            await PersonalMessage.updateOne(
              { _id: invitationMessage._id },
              { delivered: true }
            );

            recipientSocket.emit('new_personal_message', formattedMessage);
            recipientSocket.emit('group_invitation', {
              groupId: groupId,
              groupName: name,
              invitedBy: currentStudent.studentName,
              invitationToken: invitationToken,
              message: `${currentStudent.studentName} has invited you to join "${name}" discussion group.`
            });
          }

          console.log(`Invitation sent to ${invitedUser.studentName} for group ${name}`);
        }
      }
    }

    res.status(201).json({
      success: true,
      group: {
        id: groupId,
        name: name,
        description: description || '',
        rules: rules || '',
        is_public: is_public !== false,
        created_by: studentId,
        member_count: 1,
        created_at: newGroup.created_at
      },
      message: `Group "${name}" created successfully. ${invited_members?.length || 0} invitation(s) sent.`
    });

  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group', message: error.message });
  }
});

// Search groups
app.get('/api/search/groups', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;

    let query = { is_public: true };

    // If search query provided, add search conditions
    if (q && q.trim().length >= 1) {
      query.$or = [
        { name: { $regex: q.trim(), $options: 'i' } },
        { description: { $regex: q.trim(), $options: 'i' } }
      ];
    }

    const groups = await DiscussionGroup.find(query)
      .sort({ created_at: -1 })
      .limit(50)
      .lean();

    res.json(groups.map(group => ({
        id: group._id.toString(),
        name: group.name,
        description: group.description,
        is_public: group.is_public,
        member_count: group.members.length || 0 // Assuming 'members' is an array field
    })));

  } catch (error) {
    console.error('Error searching groups:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Join group via invitation
app.post('/api/groups/join-by-invite', authenticateToken, async (req, res) => {
  try {
    const { invitationToken } = req.body;
    const studentId = req.student.id;

    if (!invitationToken) {
      return res.status(400).json({ error: 'Invitation token is required' });
    }

    let invitationData;
    try {
      const decoded = Buffer.from(invitationToken, 'base64').toString('utf-8');
      invitationData = JSON.parse(decoded);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid invitation token' });
    }

    const { groupId, groupName, timestamp } = invitationData;

    // Check if invitation is not too old (7 days)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    if (timestamp < sevenDaysAgo) {
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Find the group and add the student as a member
    const group = await DiscussionGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if already a member
    if (group.members.includes(studentId)) {
      return res.json({
        success: true,
        group: {
          id: groupId,
          name: groupName
        },
        message: `You are already a member of "${groupName}"`
      });
    }

    // Add student to group members
    group.members.push(studentId);
    await group.save();

    res.json({
      success: true,
      group: {
        id: groupId,
        name: groupName,
        member_count: group.members.length
      },
      message: `Successfully joined "${groupName}"`
    });

  } catch (error) {
    console.error('Error joining group by invitation:', error);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// Get contact suggestions for chat
app.get('/api/students/suggestions', authenticateToken, async (req, res) => {
  try {
    // Ensure studentId is correctly extracted from the token payload
    const currentStudentId = req.student.id; 
    const currentStudent = await Student.findById(currentStudentId).lean();

    if (!currentStudent) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const allStudents = await Student.find({
      _id: { $ne: currentStudentId }
    })
      .select('studentName email class stream')
      .lean();

    // Categorize students by relevance
    const sameStreamAndClass = [];
    const sameStream = [];
    const sameClass = [];
    const others = [];

    allStudents.forEach(student => {
      if (currentStudent.stream && currentStudent.class) {
        if (student.stream === currentStudent.stream && student.class === currentStudent.class) {
          sameStreamAndClass.push(student);
        } else if (student.stream === currentStudent.stream) {
          sameStream.push(student);
        } else if (student.class === currentStudent.class) {
          sameClass.push(student);
        } else {
          others.push(student);
        }
      } else if (currentStudent.stream && student.stream === currentStudent.stream) {
        sameStream.push(student);
      } else if (currentStudent.class && student.class === currentStudent.class) {
        sameClass.push(student);
      } else {
        others.push(student);
      }
    });

    const formatStudent = (student, category) => ({
      id: student._id.toString(),
      studentName: student.studentName,
      email: student.email,
      avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${student.studentName}`,
      class: student.class,
      stream: student.stream,
      category: category
    });

    const suggestions = [
      ...sameStreamAndClass.map(s => formatStudent(s, 'Same Stream & Class')),
      ...sameStream.map(s => formatStudent(s, 'Same Stream')),
      ...sameClass.map(s => formatStudent(s, 'Same Class')),
      ...others.slice(0, 30).map(s => formatStudent(s, 'Other Students'))
    ];

    res.json({
      currentStudent: {
        class: currentStudent.class,
        stream: currentStudent.stream
      },
      suggestions: suggestions
    });
  } catch (error) {
    console.error('Contact suggestions error:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// E2E Chat: Save current user's public key
app.post('/api/students/me/chat-public-key', authenticateToken, async (req, res) => {
  try {
    const { publicKey } = req.body;
    if (!publicKey || typeof publicKey !== 'string') {
      return res.status(400).json({ error: 'publicKey (base64) is required' });
    }
    await Student.findByIdAndUpdate(req.student.id, { chatPublicKey: publicKey.trim() });
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving chat public key:', error);
    res.status(500).json({ error: 'Failed to save public key' });
  }
});

// E2E Chat: Save current user's private key backup (stored on server for cross-device access)
app.post('/api/students/me/chat-private-key-backup', authenticateToken, async (req, res) => {
  try {
    const { privateKeyBackup } = req.body;
    if (!privateKeyBackup || typeof privateKeyBackup !== 'string') {
      return res.status(400).json({ error: 'privateKeyBackup is required' });
    }
    await Student.findByIdAndUpdate(req.student.id, { chatPrivateKeyBackup: privateKeyBackup.trim() });
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving chat private key backup:', error);
    res.status(500).json({ error: 'Failed to save private key backup' });
  }
});

// E2E Chat: Get current user's private key backup
app.get('/api/students/me/chat-private-key-backup', authenticateToken, async (req, res) => {
  try {
    const student = await Student.findById(req.student.id).select('chatPrivateKeyBackup').lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({ privateKeyBackup: student.chatPrivateKeyBackup || null });
  } catch (error) {
    console.error('Error fetching chat private key backup:', error);
    res.status(500).json({ error: 'Failed to fetch private key backup' });
  }
});

// E2E Chat: Get another user's public key
app.get('/api/students/:id/chat-public-key', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const student = await Student.findById(id).select('chatPublicKey').lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({ publicKey: student.chatPublicKey || null });
  } catch (error) {
    console.error('Error fetching chat public key:', error);
    res.status(500).json({ error: 'Failed to fetch public key' });
  }
});

// Search students for chat
app.get('/api/students/search', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;
    const currentStudentId = req.student.id; // Assuming authenticateToken sets req.student.id

    if (!query || query.length < 2) {
      return res.json({ students: [] });
    }

    const students = await Student.find({
      $or: [
        { studentName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ],
      _id: { $ne: currentStudentId } // Exclude the current student
    })
      .select('studentName email class stream')
      .limit(20)
      .lean();

    const formattedStudents = students.map(student => ({
      id: student._id.toString(),
      studentName: student.studentName,
      email: student.email,
      avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${student.studentName}`,
      class: student.class,
      stream: student.stream
    }));

    res.json({ students: formattedStudents });
  } catch (error) {
    console.error('Student search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get personal messages for a conversation
app.get('/api/messages/personal/:conversationId', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { before, limit = 50 } = req.query;
    const currentStudentId = req.student.id;

    const [userId1, userId2] = conversationId.split('_');

    // Check if the current student is part of this conversation
    if (!userId1 || !userId2 || (userId1 !== currentStudentId && userId2 !== currentStudentId)) {
      return res.status(403).json({ error: 'Unauthorized to access this conversation' });
    }

    let query = PersonalMessage.find({
      $or: [
        { sender_id: userId1, recipient_id: userId2 },
        { sender_id: userId2, recipient_id: userId1 }
      ]
    })
      .populate('sender_id', 'studentName email')
      .populate('recipient_id', 'studentName email')
      .sort({ created_at: -1 }) // Fetch newest messages first
      .limit(parseInt(limit));

    // If 'before' is provided, fetch messages created before that timestamp
    if (before) {
      query = query.where('created_at').lt(new Date(before));
    }

    const messages = await query.lean();

    // Reverse messages to display them in chronological order (oldest first)
    const formattedMessages = messages.map(msg => {
      const fm = {
        id: msg._id.toString(),
        _id: msg._id.toString(),
        sender_id: msg.sender_id._id.toString(),
        recipient_id: msg.recipient_id._id.toString(),
        content: msg.content,
        read: msg.read,
        delivered: msg.delivered,
        created_at: msg.created_at,
        replyTo: msg.replyTo ? { id: msg.replyTo.id?.toString(), content: msg.replyTo.content, sender_id: msg.replyTo.sender_id?.toString() } : null,
        quoteProject: msg.quoteProject ? { id: msg.quoteProject.id?.toString(), photoUrl: msg.quoteProject.photoUrl, title: msg.quoteProject.title } : null,
        sender: { id: msg.sender_id._id.toString(), username: msg.sender_id.studentName, avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${msg.sender_id.studentName}` },
        recipient: { id: msg.recipient_id._id.toString(), username: msg.recipient_id.studentName, avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${msg.recipient_id.studentName}` }
      };
      return fm;
    }).reverse();

    res.json(formattedMessages);
  } catch (error) {
    console.error('Failed to load personal messages:', error);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// ============= UNEB PROJECT GALLERY =============

app.post('/api/uneb-projects', authenticateToken, uploadImage.single('photo'), [
  body('title').notEmpty().trim().withMessage('Project title is required'),
  body('subject').notEmpty().trim().withMessage('Subject is required'),
  body('year').notEmpty().trim().withMessage('Year is required'),
  body('category').notEmpty().trim().withMessage('Category is required'),
  body('methodology').notEmpty().trim().withMessage('Methodology is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  if (!req.file) return res.status(400).json({ error: 'Project photo is required (student with report)' });

  try {
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { resource_type: 'image', folder: 'schoolbyte/uneb-projects' },
        (err, result) => err ? reject(err) : resolve(result)
      ).end(req.file.buffer);
    });

    const student = await Student.findById(req.student.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const project = new UnebProject({
      student_id: req.student.id,
      photoUrl: result.secure_url,
      photoPublicId: result.public_id,
      title: req.body.title.trim(),
      subject: req.body.subject.trim(),
      year: req.body.year.trim(),
      category: req.body.category.trim(),
      methodology: req.body.methodology.trim(),
      abstract: (req.body.abstract || '').trim(),
      findings: (req.body.findings || '').trim(),
      conclusion: (req.body.conclusion || '').trim(),
      keywords: (req.body.keywords || '').split(',').map(k => k.trim()).filter(Boolean)
    });
    await project.save();
    const populated = await UnebProject.findById(project._id).populate('student_id', 'studentName class stream');
    res.status(201).json({
      message: 'Project published successfully!',
      project: formatUnebProject(populated, req.student.id)
    });
  } catch (err) {
    console.error('UNEB project upload error:', err);
    res.status(500).json({ error: 'Failed to upload project', detail: err.message });
  }
});

function formatUnebProject(p, currentUserId) {
  const doc = p.toObject ? p.toObject() : p;
  const student = doc.student_id;
  return {
    id: doc._id.toString(),
    _id: doc._id.toString(),
    photoUrl: doc.photoUrl,
    title: doc.title,
    subject: doc.subject,
    year: doc.year,
    category: doc.category,
    methodology: doc.methodology,
    abstract: doc.abstract,
    findings: doc.findings,
    conclusion: doc.conclusion,
    keywords: doc.keywords || [],
    likesCount: (doc.likes || []).length,
    likedByMe: (doc.likes || []).some(id => id.toString() === currentUserId),
    helpfulCount: (doc.helpfulVotes || []).filter(v => v.helpful).length,
    notHelpfulCount: (doc.helpfulVotes || []).filter(v => !v.helpful).length,
    myHelpfulVote: (doc.helpfulVotes || []).find(v => v.studentId.toString() === currentUserId)?.helpful ?? null,
    student: student ? { id: student._id.toString(), studentName: student.studentName, class: student.class, stream: student.stream } : null,
    createdAt: doc.createdAt
  };
}

app.get('/api/uneb-projects', authenticateToken, async (req, res) => {
  try {
    const { sort = 'likes', subject, year, category, q, limit = 20, skip = 0 } = req.query;
    const query = { deletedAt: null, isPublished: true };
    if (subject) query.subject = new RegExp(subject, 'i');
    if (year) query.year = year;
    if (category) query.category = new RegExp(category, 'i');
    if (q && q.trim()) {
      const re = new RegExp(q.trim(), 'i');
      query.$or = [
        { title: re },
        { methodology: re },
        { abstract: re },
        { keywords: re }
      ];
    }

    let projects = await UnebProject.find(query).populate('student_id', 'studentName class stream').lean();

    if (sort === 'recent') projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    else if (sort === 'likes') projects.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0) || new Date(b.createdAt) - new Date(a.createdAt));
    else if (sort === 'helpful') projects.sort((a, b) => {
      const hA = (a.helpfulVotes || []).filter(v => v.helpful).length;
      const hB = (b.helpfulVotes || []).filter(v => v.helpful).length;
      return hB - hA || new Date(b.createdAt) - new Date(a.createdAt);
    });
    else projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const skipN = parseInt(skip) || 0;
    const limitN = parseInt(limit) || 20;
    projects = projects.slice(skipN, skipN + limitN);

    const formatted = projects.map(p => formatUnebProjectLean(p, req.student.id));
    res.json({ projects: formatted });
  } catch (err) {
    console.error('UNEB projects list error:', err);
    res.status(500).json({ error: 'Failed to fetch projects', detail: err.message });
  }
});

function formatUnebProjectLean(doc, currentUserId) {
  const student = doc.student_id;
  return {
    id: doc._id.toString(),
    _id: doc._id.toString(),
    photoUrl: doc.photoUrl,
    title: doc.title,
    subject: doc.subject,
    year: doc.year,
    category: doc.category,
    methodology: doc.methodology,
    abstract: doc.abstract,
    findings: doc.findings,
    conclusion: doc.conclusion,
    keywords: doc.keywords || [],
    likesCount: (doc.likes || []).length,
    likedByMe: (doc.likes || []).some(id => id.toString() === currentUserId),
    helpfulCount: (doc.helpfulVotes || []).filter(v => v.helpful).length,
    notHelpfulCount: (doc.helpfulVotes || []).filter(v => !v.helpful).length,
    myHelpfulVote: (doc.helpfulVotes || []).find(v => v.studentId.toString() === currentUserId)?.helpful ?? null,
    student: student ? { id: student._id.toString(), studentName: student.studentName, class: student.class, stream: student.stream } : null,
    createdAt: doc.createdAt
  };
}

app.get('/api/uneb-projects/:id', authenticateToken, async (req, res) => {
  try {
    const project = await UnebProject.findOne({ _id: req.params.id, deletedAt: null }).populate('student_id', 'studentName email class stream');
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(formatUnebProjectLean(project.toObject ? project.toObject() : project, req.student.id));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

app.post('/api/uneb-projects/:id/like', authenticateToken, async (req, res) => {
  try {
    const project = await UnebProject.findOne({ _id: req.params.id, deletedAt: null });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const idx = (project.likes || []).findIndex(id => id.toString() === req.student.id);
    if (idx >= 0) project.likes.splice(idx, 1);
    else project.likes.push(req.student.id);
    await project.save();
    res.json({ likedByMe: idx < 0, likesCount: project.likes.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update like' });
  }
});

app.post('/api/uneb-projects/:id/helpful', authenticateToken, async (req, res) => {
  try {
    const { helpful } = req.body;
    if (typeof helpful !== 'boolean') return res.status(400).json({ error: 'helpful (boolean) required' });
    const project = await UnebProject.findOne({ _id: req.params.id, deletedAt: null });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    project.helpfulVotes = project.helpfulVotes || [];
    const existing = project.helpfulVotes.findIndex(v => v.studentId.toString() === req.student.id);
    if (existing >= 0) project.helpfulVotes[existing].helpful = helpful;
    else project.helpfulVotes.push({ studentId: req.student.id, helpful });
    await project.save();
    const hCount = project.helpfulVotes.filter(v => v.helpful).length;
    const nCount = project.helpfulVotes.filter(v => !v.helpful).length;
    res.json({ myHelpfulVote: helpful, helpfulCount: hCount, notHelpfulCount: nCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update helpful vote' });
  }
});

app.delete('/api/uneb-projects/:id', authenticateToken, async (req, res) => {
  try {
    const project = await UnebProject.findOne({ _id: req.params.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.student_id.toString() !== req.student.id) return res.status(403).json({ error: 'You can only delete your own projects' });
    project.deletedAt = new Date();
    project.isPublished = false;
    await project.save();
    if (project.photoPublicId) {
      try { await cloudinary.uploader.destroy(project.photoPublicId); } catch (e) { console.warn('Cloudinary delete failed:', e); }
    }
    res.json({ message: 'Project removed from gallery' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});


// ===== ADMIN: UNEB Project Gallery Management =====
app.get('/admin/uneb-projects', authenticateAdminToken, async (req, res) => {
  try {
    const projects = await UnebProject.find({ deletedAt: null })
      .populate('student_id', 'studentName class stream indexNumber')
      .lean();
    // Sort by most "not helpful" votes (highest unhelpful count first)
    projects.sort((a, b) => {
      const aUnhelpful = (a.helpfulVotes || []).filter(v => !v.helpful).length;
      const bUnhelpful = (b.helpfulVotes || []).filter(v => !v.helpful).length;
      return bUnhelpful - aUnhelpful || new Date(b.createdAt) - new Date(a.createdAt);
    });
    const formatted = projects.map(p => ({
      _id: p._id,
      title: p.title,
      subject: p.subject,
      year: p.year,
      photoUrl: p.photoUrl,
      methodology: p.methodology,
      abstract: p.abstract || '',
      category: p.category,
      studentName: p.student_id ? p.student_id.studentName : 'Unknown',
      studentClass: p.student_id ? p.student_id.class : '',
      likesCount: (p.likes || []).length,
      helpfulCount: (p.helpfulVotes || []).filter(v => v.helpful).length,
      notHelpfulCount: (p.helpfulVotes || []).filter(v => !v.helpful).length,
      createdAt: p.createdAt
    }));
    res.json({ projects: formatted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects', detail: err.message });
  }
});

app.delete('/admin/uneb-projects/:id', authenticateAdminToken, async (req, res) => {
  try {
    const project = await UnebProject.findById(req.params.id).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    // Hard delete from DB (admin has authority to fully remove)
    await UnebProject.deleteOne({ _id: req.params.id });
    // Attempt Cloudinary photo removal — non-blocking
    if (project.photoPublicId) {
      cloudinary.uploader.destroy(project.photoPublicId).catch(e => console.warn('Cloudinary delete skipped:', e.message));
    } else if (project.photoUrl && project.photoUrl.includes('cloudinary')) {
      // Extract public_id from URL as fallback
      const urlParts = project.photoUrl.split('/');
      const fileWithExt = urlParts[urlParts.length - 1];
      const publicId = 'schoolbyte/uneb-projects/' + fileWithExt.replace(/\.\w+$/, '');
      cloudinary.uploader.destroy(publicId).catch(e => console.warn('Cloudinary fallback delete skipped:', e.message));
    }
    // Notify the student whose project was deleted
    if (project.student_id) {
      createNotification(
        project.student_id,
        'system',
        'Project Removed',
        `Your project ${project.title} has been removed from the gallery by an administrator.`,
        { projectId: project._id }
      ).catch(() => {});
    }
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Admin UNEB project delete error:', err);
    res.status(500).json({ error: 'Failed to delete project', detail: err.message });
  }
});

// Student: update preferences (font, theme, etc.)
app.put('/student/preferences', authenticateToken, async (req, res) => {
  try {
    const { preferences } = req.body;
    if (!preferences || typeof preferences !== 'object') return res.status(400).json({ message: 'Invalid preferences' });
    const student = await Student.findById(req.student.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    student.preferences = { ...(student.preferences || {}), ...preferences };
    student.markModified('preferences');
    await student.save();
    res.json({ message: 'Preferences saved', preferences: student.preferences });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Student: update preferred name
app.put('/student/preferred-name', authenticateToken, async (req, res) => {
  try {
    const { preferredName } = req.body;
    const student = await Student.findById(req.student.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    student.preferredName = (preferredName || '').trim();
    await student.save();
    res.json({ message: 'Preferred name updated', preferredName: student.preferredName });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Public health check (no auth)
app.get('/api/health', async (req, res) => {
  const status = { api: 'ok', database: 'unknown', timestamp: new Date().toISOString() };
  try {
    await Student.findOne().select('_id').lean();
    status.database = 'ok';
  } catch (e) { status.database = 'error'; }
  res.json(status);
});

// Admin: list all workfiles (notes)
app.get('/admin/workfiles', authenticateAdminToken, async (req, res) => {
  try {
    const files = await WorkFile.find({}).sort({ createdAt: -1 }).lean();
    res.json({ workfiles: files });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: delete a workfile
app.delete('/admin/workfiles/:id', authenticateAdminToken, async (req, res) => {
  try {
    const wf = await WorkFile.findById(req.params.id);
    if (!wf) return res.status(404).json({ error: 'Not found' });
    if (wf.cloudinaryPublicId) {
      try { await cloudinary.uploader.destroy(wf.cloudinaryPublicId, { resource_type: 'raw' }); } catch(e) {}
    }
    await WorkFile.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: list all activities
app.get('/admin/activities', authenticateAdminToken, async (req, res) => {
  try {
    const acts = await Activity.find({}).sort({ createdAt: -1 }).lean();
    res.json({ activities: acts });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: delete an activity
app.delete('/admin/activities/:id', authenticateAdminToken, async (req, res) => {
  try {
    const act = await Activity.findByIdAndDelete(req.params.id);
    if (!act) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: list students (for notification targeting)
app.get('/admin/students', authenticateAdminToken, async (req, res) => {
  try {
    const students = await Student.find({}, '_id studentName class indexNumber').lean();
    res.json({ students });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Admin: send notification to all or specific student
app.post('/admin/send-notification', authenticateAdminToken, async (req, res) => {
  try {
    const { title, message, type, targetMode, targetValue } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'Title and message are required' });
    const notifType = ['achievement','message','system','team','quiz'].includes(type) ? type : 'system';
    let query = {};
    if (targetMode === 'class' && targetValue) query = { class: targetValue };
    else if (targetMode === 'stream' && targetValue) query = { stream: targetValue };
    else if (targetMode === 'student' && targetValue) query = { _id: targetValue };
    const students = await Student.find(query);
    if (!students || !students.length) return res.status(404).json({ error: 'No students found for the selected target' });
    for (const student of students) {
      student.notifications.push({ type: notifType, title, message, isRead: false, createdAt: new Date() });
      await student.save();
    }
    res.json({ success: true, sentTo: students.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Admin: list all quiz questions with teacher info
app.get('/admin/quiz-questions', authenticateAdminToken, async (req, res) => {
  try {
    const questions = await QuizQuestion.find({})
      .select('questionText subject intendedClass type keywordsForGrading uploadedBy createdAt isActive')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ questions });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: edit a quiz question (text + keywords)
app.put('/admin/quiz-questions/:id', authenticateAdminToken, async (req, res) => {
  try {
    const { questionText, keywordsForGrading } = req.body;
    const update = {};
    if (questionText !== undefined) update.questionText = questionText;
    if (keywordsForGrading !== undefined) update.keywordsForGrading = keywordsForGrading;
    const question = await QuizQuestion.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!question) return res.status(404).json({ error: 'Question not found' });
    res.json({ question });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: delete a quiz question
app.delete('/admin/quiz-questions/:id', authenticateAdminToken, async (req, res) => {
  try {
    const q = await QuizQuestion.findByIdAndDelete(req.params.id);
    if (!q) return res.status(404).json({ error: 'Question not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: analytics - student/teacher growth over time + active students
app.get('/admin/analytics', authenticateAdminToken, async (req, res) => {
  try {
    const now = new Date();
    const last30Days = new Date(now);
    last30Days.setDate(last30Days.getDate() - 29);
    last30Days.setHours(0, 0, 0, 0);
    const last12MonthsDate = new Date(now);
    last12MonthsDate.setMonth(last12MonthsDate.getMonth() - 11);
    last12MonthsDate.setDate(1);
    last12MonthsDate.setHours(0, 0, 0, 0);
    const [studentsByDay, teachersByDay, studentsByMonth, teachersByMonth, studentsByYear, teachersByYear] = await Promise.all([
      Student.aggregate([{$match:{createdAt:{$gte:last30Days}}},{$group:{_id:{y:{$year:'$createdAt'},m:{$month:'$createdAt'},d:{$dayOfMonth:'$createdAt'}},count:{$sum:1}}},{$sort:{'_id.y':1,'_id.m':1,'_id.d':1}}]),
      Teacher.aggregate([{$match:{createdAt:{$gte:last30Days}}},{$group:{_id:{y:{$year:'$createdAt'},m:{$month:'$createdAt'},d:{$dayOfMonth:'$createdAt'}},count:{$sum:1}}},{$sort:{'_id.y':1,'_id.m':1,'_id.d':1}}]),
      Student.aggregate([{$match:{createdAt:{$gte:last12MonthsDate}}},{$group:{_id:{y:{$year:'$createdAt'},m:{$month:'$createdAt'}},count:{$sum:1}}},{$sort:{'_id.y':1,'_id.m':1}}]),
      Teacher.aggregate([{$match:{createdAt:{$gte:last12MonthsDate}}},{$group:{_id:{y:{$year:'$createdAt'},m:{$month:'$createdAt'}},count:{$sum:1}}},{$sort:{'_id.y':1,'_id.m':1}}]),
      Student.aggregate([{$group:{_id:{y:{$year:'$createdAt'}},count:{$sum:1}}},{$sort:{'_id.y':1}}]),
      Teacher.aggregate([{$group:{_id:{y:{$year:'$createdAt'}},count:{$sum:1}}},{$sort:{'_id.y':1}}])
    ]);
    const activeStudentIds = Array.from(authenticatedSockets.keys());
    let activeStudents = [];
    if (activeStudentIds.length > 0) {
      activeStudents = await Student.find({ _id: { $in: activeStudentIds } }, 'studentName class').lean();
    }
    res.json({ studentsByDay, teachersByDay, studentsByMonth, teachersByMonth, studentsByYear, teachersByYear, activeStudents, activeCount: activeStudentIds.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/student/energy', authenticateToken, async (req, res) => {
  try {
    const student = await Student.findById(req.student.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    refillEnergy(student);
    await student.save();
    const msPerHour = 60 * 60 * 1000;
    const last = student.lastEnergyRefillAt ? new Date(student.lastEnergyRefillAt).getTime() : Date.now();
    const nextRefillMs = student.energy >= 25 ? null : (last + msPerHour - Date.now());
    res.json({ energy: student.energy, maxEnergy: 25, nextRefillMs: nextRefillMs > 0 ? nextRefillMs : 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch energy' });
  }
});
// ============= ACHIEVEMENTS & NOTIFICATIONS SYSTEM =============

// Helper function to check and award achievements
async function checkAndAwardAchievements(student) {
  const newAchievements = [];
  const now = new Date();
  
  // Quiz Master - Complete 25 quizzes
  if (student.totalQuizzesCompleted >= 25 && !student.achievements.some(a => a.type === 'quiz_master')) {
    const achievement = {
      type: 'quiz_master',
      name: 'Quiz Master',
      description: 'Completed 25 quizzes',
      earnedAt: now,
      badgeIcon: '🎯',
      progress: 100
    };
    student.achievements.push(achievement);
    newAchievements.push(achievement);
  }

  // Streak Champion - 7 day study streak
  if (student.currentStreak >= 7 && !student.achievements.some(a => a.type === 'streak_champion')) {
    const achievement = {
      type: 'streak_champion',
      name: 'Streak Champion',
      description: '7-day study streak',
      earnedAt: now,
      badgeIcon: '🔥',
      progress: 100
    };
    student.achievements.push(achievement);
    newAchievements.push(achievement);
  }

  // Byte Collector - Earned 1000 bytes
  if (student.bytes >= 1000 && !student.achievements.some(a => a.type === 'byte_collector')) {
    const achievement = {
      type: 'byte_collector',
      name: 'Byte Collector',
      description: 'Earned 1000 bytes',
      earnedAt: now,
      badgeIcon: '💰',
      progress: 100
    };
    student.achievements.push(achievement);
    newAchievements.push(achievement);
  }

  // Add notifications for new achievements
  for (const achievement of newAchievements) {
    student.notifications.push({
      type: 'achievement',
      title: `Achievement Unlocked: ${achievement.name}`,
      message: achievement.description,
      isRead: false,
      createdAt: now,
      data: { achievementType: achievement.type, badgeIcon: achievement.badgeIcon }
    });
  }

  // Clean up old achievements (remove ones older than 7 days from recent view)
  // Keep all achievements in the array, but we'll filter in the API

  return newAchievements;
}

// Log study time for current student
app.post('/api/student/log-study-time', authenticateToken, async (req, res) => {
  try {
    const { minutes } = req.body;
    if (!minutes || minutes <= 0) return res.json({ ok: true });
    const student = await Student.findById(req.student.id);
    if (!student) return res.status(404).json({ error: 'Not found' });
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    const today = now.toISOString().slice(0, 10);
    const roundedMinutes = Math.round(minutes);

    // Update monthly hours
    const idx = (student.studyHours || []).findIndex(h => h.month === month);
    if (idx >= 0) {
      student.studyHours[idx].minutes += roundedMinutes;
    } else {
      if (!student.studyHours) student.studyHours = [];
      student.studyHours.push({ month, minutes: roundedMinutes });
    }

    // Update daily activity
    if (!student.dailyActivity) student.dailyActivity = [];
    const dayIdx = student.dailyActivity.findIndex(d => d.date === today);
    if (dayIdx >= 0) {
      student.dailyActivity[dayIdx].minutes += roundedMinutes;
    } else {
      student.dailyActivity.push({ date: today, minutes: roundedMinutes });
    }
    // Keep only last 400 days of data to limit array size
    if (student.dailyActivity.length > 400) {
      student.dailyActivity.sort((a, b) => a.date.localeCompare(b.date));
      student.dailyActivity = student.dailyActivity.slice(-400);
    }

    student.markModified('studyHours');
    student.markModified('dailyActivity');
    await student.save();
    const updated = student.studyHours.find(h => h.month === month);
    res.json({ ok: true, month, minutes: updated ? updated.minutes : 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// STUDENT ACTIVITY ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/student/activity-stats', authenticateToken, async (req, res) => {
  try {
    const student = await Student.findById(req.student.id).select('dailyActivity studentName').lean();
    if (!student) return res.status(404).json({ error: 'Not found' });

    const { range = '7days' } = req.query;
    const now = new Date();
    let startDate;

    if (range === '7days') {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 6);
    } else if (range === 'month') {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 29);
    } else if (range === 'year') {
      startDate = new Date(now);
      startDate.setFullYear(startDate.getFullYear() - 1);
      startDate.setDate(startDate.getDate() + 1);
    } else if (range.match(/^d{4}$/)) {
      // specific year like '2024'
      startDate = new Date(parseInt(range), 0, 1);
      const endDate = new Date(parseInt(range), 11, 31);
      // filter to that year
      const yearData = (student.dailyActivity || []).filter(d => d.date.startsWith(range));
      const peakEntry = yearData.reduce((max, d) => d.minutes > (max ? max.minutes : 0) ? d : max, null);
      return res.json({
        range,
        data: yearData,
        peak: peakEntry ? { date: peakEntry.date, minutes: peakEntry.minutes } : null
      });
    } else {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 6);
    }

    const startStr = startDate.toISOString().slice(0, 10);
    const filtered = (student.dailyActivity || []).filter(d => d.date >= startStr);
    const peakEntry = filtered.reduce((max, d) => d.minutes > (max ? max.minutes : 0) ? d : max, null);

    res.json({
      range,
      data: filtered,
      peak: peakEntry ? { date: peakEntry.date, minutes: peakEntry.minutes } : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper function to update streak
async function updateStudentStreak(studentId) {
  const student = await Student.findById(studentId);
  if (!student) return;

  const now = new Date();
  const lastActivity = new Date(student.lastActivityDate);
  const hoursSinceLastActivity = (now - lastActivity) / (1000 * 60 * 60);

  if (hoursSinceLastActivity <= 24) {
    // Same day activity, don't increment
    const daysSame = Math.floor(hoursSinceLastActivity / 24);
    if (daysSame === 0) {
      // Update last activity but don't change streak
      student.lastActivityDate = now;
    }
  } else if (hoursSinceLastActivity <= 48) {
    // Next day activity, increment streak
    student.currentStreak += 1;
    if (student.currentStreak > student.longestStreak) {
      student.longestStreak = student.currentStreak;
    }
    student.lastActivityDate = now;
  } else {
    // Streak broken, reset
    student.currentStreak = 1;
    student.lastActivityDate = now;
  }

  await checkAndAwardAchievements(student);
  await student.save();
}

// Get student achievements (only recent ones from past week)
app.get('/api/achievements', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;
    const student = await Student.findById(studentId);
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Filter achievements from the past week
    const recentAchievements = student.achievements.filter(achievement => 
      new Date(achievement.earnedAt) >= oneWeekAgo
    ).sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt));

    res.json({
      recentAchievements,
      totalAchievements: student.achievements.length,
      currentStreak: student.currentStreak,
      longestStreak: student.longestStreak,
      totalQuizzes: student.totalQuizzesCompleted,
      bytes: student.bytes
    });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Get all achievements (for profile page)
app.get('/api/achievements/all', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;
    const student = await Student.findById(studentId);
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({
      achievements: student.achievements.sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt)),
      totalAchievements: student.achievements.length,
      currentStreak: student.currentStreak,
      longestStreak: student.longestStreak,
      totalQuizzes: student.totalQuizzesCompleted,
      bytes: student.bytes
    });
  } catch (error) {
    console.error('Error fetching all achievements:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Get notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;
    const student = await Student.findById(studentId);
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Sort notifications by most recent first
    const sortedNotifications = student.notifications.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    const unreadCount = student.notifications.filter(n => !n.isRead).length;

    res.json({
      notifications: sortedNotifications.slice(0, 50),
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
app.patch('/api/notifications/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;
    const { notificationId } = req.params;
    
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const notification = student.notifications.id(notificationId);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    notification.isRead = true;
    await student.save();

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// Mark all notifications as read
app.post('/api/notifications/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;
    const student = await Student.findById(studentId);
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    student.notifications.forEach(notification => {
      notification.isRead = true;
    });

    await student.save();

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// Get unread notification count
app.get('/api/notifications/unread-count', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;
    const student = await Student.findById(studentId);
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const unreadCount = student.notifications.filter(n => !n.isRead).length;

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// ============= TEAMS SYSTEM =============

// Create a team
app.post('/api/teams/create', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const team = new Team({
      name: name.trim(),
      user_id: studentId,
      description: description || '',
      members: [studentId],
      created_by: studentId
    });

    await team.save();

    res.json({
      message: 'Team created successfully',
      team: {
        id: team._id,
        name: team.name,
        description: team.description,
        share_token: team.share_token,
        created_at: team.created_at
      }
    });
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Join a team using share token
app.post('/api/teams/join', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;
    const { share_token } = req.body;

    if (!share_token) {
      return res.status(400).json({ error: 'Share token is required' });
    }

    const team = await Team.findOne({ share_token });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (team.members && team.members.includes(studentId)) {
      return res.status(400).json({ error: 'You are already a member of this team' });
    }

    if (!team.members) {
      team.members = [];
    }
    team.members.push(studentId);
    await team.save();

    res.json({
      message: 'Successfully joined team',
      team: {
        id: team._id,
        name: team.name,
        description: team.description,
        created_at: team.created_at
      }
    });
  } catch (error) {
    console.error('Error joining team:', error);
    res.status(500).json({ error: 'Failed to join team' });
  }
});

// Get user's teams
app.get('/api/teams/my-teams', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;

    const teams = await Team.find({ members: studentId })
      .populate('created_by', 'studentName email')
      .populate('members', 'studentName email')
      .sort({ created_at: -1 });

    const formattedTeams = teams.map(team => ({
      id: team._id.toString(),
      name: team.name,
      description: team.description || '',
      share_token: team.share_token,
      created_at: team.created_at,
      created_by: team.created_by ? {
        id: team.created_by._id.toString(),
        name: team.created_by.studentName,
        email: team.created_by.email
      } : null,
      members: team.members ? team.members.map(member => ({
        id: member._id.toString(),
        name: member.studentName,
        email: member.email,
        avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${member.studentName}`
      })) : [],
      memberCount: team.members ? team.members.length : 0
    }));

    res.json({ teams: formattedTeams });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get team details
app.get('/api/teams/:teamId', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;
    const { teamId } = req.params;

    const team = await Team.findById(teamId)
      .populate('created_by', 'studentName email')
      .populate('members', 'studentName email');

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (!team.members || !team.members.some(m => m._id.toString() === studentId)) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    res.json({
      team: {
        id: team._id.toString(),
        name: team.name,
        description: team.description || '',
        share_token: team.share_token,
        created_at: team.created_at,
        created_by: team.created_by ? {
          id: team.created_by._id.toString(),
          name: team.created_by.studentName,
          email: team.created_by.email
        } : null,
        members: team.members ? team.members.map(member => ({
          id: member._id.toString(),
          name: member.studentName,
          email: member.email,
          avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${member.studentName}`
        })) : []
      }
    });
  } catch (error) {
    console.error('Error fetching team details:', error);
    res.status(500).json({ error: 'Failed to fetch team details' });
  }
});

// Leave a team
app.post('/api/teams/:teamId/leave', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;
    const { teamId } = req.params;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (!team.members || !team.members.includes(studentId)) {
      return res.status(400).json({ error: 'You are not a member of this team' });
    }

    team.members = team.members.filter(memberId => memberId.toString() !== studentId);
    
    // If no members left, delete the team
    if (team.members.length === 0) {
      await Team.findByIdAndDelete(teamId);
      return res.json({ message: 'Team deleted as last member left' });
    }

    await team.save();
    res.json({ message: 'Successfully left team' });
  } catch (error) {
    console.error('Error leaving team:', error);
    res.status(500).json({ error: 'Failed to leave team' });
  }
});

// Update the Team schema to include members and description
const teamSchemaUpdate = Team.schema;
if (!teamSchemaUpdate.path('members')) {
  teamSchemaUpdate.add({
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    description: { type: String, default: '' },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' }
  });
}

// Student endpoint to fetch activities by subject and class
app.get('/student/activities', authenticateToken, async (req, res) => {
    try {
        const { subject, intendedClass, search } = req.query;
        const studentId = req.student.id;

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        let query = {};
        // Case-insensitive subject search
        if (subject) query.subject = { $regex: new RegExp(`^${subject}$`, 'i') };
        if (intendedClass) query.intendedClass = intendedClass;

        // Add search functionality
        if (search && search.trim()) {
            query.$or = [
                { title: { $regex: search.trim(), $options: 'i' } },
                { description: { $regex: search.trim(), $options: 'i' } }
            ];
        }

        const activities = await Activity.find(query)
            .populate('associatedWorkFile', 'title fileUrl costBytes')
            .populate('uploadedBy.teacherId', 'teacherName')
            .populate('attemptCount')
            .sort({ createdAt: -1 });

        // Sort activities by relevance to student's class
        const studentClass = student.class;
        const sortedActivities = activities.sort((a, b) => {
            if (a.intendedClass === studentClass && b.intendedClass !== studentClass) return -1;
            if (b.intendedClass === studentClass && a.intendedClass !== studentClass) return 1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        // Get attempt counts for all activities
        const activityIds = sortedActivities.map(a => a._id);
        const attemptCounts = await StudentActivitySubmission.aggregate([
            { $match: { activity: { $in: activityIds } } },
            { $group: { _id: '$activity', count: { $sum: 1 } } }
        ]);

        const attemptCountMap = {};
        attemptCounts.forEach(ac => {
            attemptCountMap[ac._id.toString()] = ac.count;
        });

        res.status(200).json({
            message: 'Activities fetched successfully.',
            studentClass: studentClass,
            activities: sortedActivities.map(activity => ({
                _id: activity._id,
                title: activity.title,
                description: activity.description,
                subject: activity.subject,
                intendedClass: activity.intendedClass,
                maxBytesReward: activity.maxBytesReward,
                questions: activity.questions,
                uploadedBy: {
                    teacherId: activity.uploadedBy.teacherId?._id,
                    teacherName: activity.uploadedBy.teacherName
                },
                attemptCount: attemptCountMap[activity._id.toString()] || 0,
                associatedWorkFile: activity.associatedWorkFile,
                createdAt: activity.createdAt
            }))
        });
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ message: 'Failed to fetch activities.', error: error.message });
    }
});


// Student endpoint to fetch a specific activity with all questions
app.get('/student/activities/:activityId', authenticateToken, async (req, res) => {
    try {
        const { activityId } = req.params;


        const activity = await Activity.findById(activityId)
            .populate('associatedWorkFile', 'title fileUrl costBytes');


        if (!activity) {
            return res.status(404).json({ message: 'Activity not found.' });
        }


        res.status(200).json({
            message: 'Activity fetched successfully.',
            activity: {
                _id: activity._id,
                title: activity.title,
                description: activity.description,
                subject: activity.subject,
                intendedClass: activity.intendedClass,
                maxBytesReward: activity.maxBytesReward,
                questions: activity.questions,
                uploadedBy: activity.uploadedBy,
                associatedWorkFile: activity.associatedWorkFile,
                createdAt: activity.createdAt
            }
        });
    } catch (error) {
        console.error('Error fetching activity:', error);
        res.status(500).json({ message: 'Failed to fetch activity.', error: error.message });
    }
});


// Student endpoint to submit activity answers with NLP grading
app.post('/student/activities/submit', authenticateToken, [
    body('activityId').isMongoId().withMessage('Valid activity ID is required.'),
    body('answers').isArray({ min: 1 }).withMessage('Answers array is required.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { activityId, answers } = req.body;
    const studentId = req.student.id;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const student = await Student.findById(studentId).session(session);
        if (!student) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Student not found.' });
        }

        const activity = await Activity.findById(activityId).session(session);
        if (!activity) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Activity not found.' });
        }

        refillEnergy(student);
        const energy = (student.energy != null ? student.energy : 25);
        if (energy < 1) {
            await session.abortTransaction();
            session.endSession();
            return res.status(402).json({
                message: 'Not enough energy. Energy refills 1 per hour (max 25).',
                energy: student.energy
            });
        }
        student.energy = Math.max(0, energy - 1);
        await student.save({ session });

        // Activity grading: (min(w,30)/30)*5 + (p/P)*10 - (n/N)*5 per question; min 30 words recommended
        let totalScore = 0;
        const gradedAnswers = [];

        for (let i = 0; i < activity.questions.length; i++) {
            const question = activity.questions[i];
            const studentAnswer = (answers[i]?.answer || '').trim();
            const P = (question.keywordsForMarking || []).length;
            const N = (question.negativeKeywords || []).length;

            if (!studentAnswer) {
                gradedAnswers.push({ questionIndex: i, score: 0, feedback: 'No answer provided.' });
                totalScore += 0;
                continue;
            }

            const normalizedAnswer = studentAnswer.toLowerCase();
            const words = studentAnswer.split(/\s+/).filter(Boolean);
            const w = words.length;
            const wCap = Math.min(w, 30);

            let p = 0;
            for (const kw of (question.keywordsForMarking || [])) {
                if (normalizedAnswer.includes(kw.toLowerCase().trim())) p++;
            }
            let n = 0;
            for (const kw of (question.negativeKeywords || [])) {
                if (normalizedAnswer.includes(kw.toLowerCase().trim())) n++;
            }

            const wordTerm = (wCap / 30) * 5;
            const posTerm = P > 0 ? (p / P) * 10 : 0;
            const negTerm = N > 0 ? (n / N) * 5 : 0;
            const questionScore = Math.max(0, wordTerm + posTerm - negTerm);
            totalScore += questionScore;

            gradedAnswers.push({
                questionIndex: i,
                score: questionScore,
                wordCount: w,
                matchedPositive: p,
                totalPositive: P,
                matchedNegative: n,
                totalNegative: N,
                feedback: questionScore >= 0.7 ? 'Good answer!' : questionScore >= 0.4 ? 'Partial credit.' : 'Needs improvement.'
            });
        }

        const scorePercentage = activity.questions.length > 0 ? totalScore / activity.questions.length : 0;
        const bytesEarned = Math.round(activity.maxBytesReward * Math.min(1, scorePercentage));

        // Award bytes to student
        student.bytes += bytesEarned;
        await student.save({ session });

        // Save submission record
        const submission = new StudentActivitySubmission({
            student: studentId,
            activity: activityId,
            answers: answers,
            score: scorePercentage,
            bytesEarned: bytesEarned,
            submittedAt: new Date(),
            isGraded: true
        });
        await submission.save({ session });

        await session.commitTransaction();

        createNotification(
            studentId, 'activity_complete',
            'Activity Completed',
            'You completed the activity and scored ' + Math.round(scorePercentage * 100) + '%. You earned ' + bytesEarned + ' bytes.',
            { bytesEarned, scorePercentage: Math.round(scorePercentage * 100), activityId }
        ).catch(() => {});

        res.status(200).json({
            message: 'Activity submitted and graded successfully!',
            bytesEarned: bytesEarned,
            studentCurrentBytes: student.bytes,
            scorePercentage: Math.round(scorePercentage * 100),
            gradedAnswers: gradedAnswers
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error submitting activity:', error);
        createNotification(
            studentId, 'activity_fail',
            'Activity Submission Failed',
            'Your activity submission failed. Please try again.',
            { error: error.message }
        ).catch(() => {});
        res.status(500).json({ message: 'Failed to submit activity.', error: error.message });
    } finally {
        session.endSession();
    }
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('SchoolByte server running on port ' + PORT);
  console.log('Server accessible at: http://0.0.0.0:' + PORT);
  console.log('Socket.io chat server ready');
});
