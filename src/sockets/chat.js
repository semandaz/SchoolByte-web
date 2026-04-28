// Socket.io chat — authentication + personal/group message handlers.
// `setupChatSockets(io)` wires everything onto the provided io instance
// and returns the live `authenticatedSockets` map so other modules can
// look up an online student by id.

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');

const Student = require('../../models/Student');
const PersonalMessage = require('../../models/PersonalMessage');
const GroupMessage = require('../../models/GroupMessage');
const DiscussionGroup = require('../../models/DiscussionGroup');

const { createNotification } = require('../services/achievements');

const authenticatedSockets = new Map();

function setupChatSockets(io) {
    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token;

        if (!token) {
            return next(new Error('Authentication token required'));
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            // Grandfathered fallback for legacy `studentId` payloads.
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
                    content,
                    read: false,
                    delivered: false,
                    replyTo: replyTo || null,
                    quoteProject: quoteProject || null,
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
                    tempId,
                    replyTo: messageWithSender.replyTo
                        ? {
                              id: messageWithSender.replyTo.id?.toString(),
                              content: messageWithSender.replyTo.content,
                              sender_id: messageWithSender.replyTo.sender_id?.toString(),
                          }
                        : null,
                    quoteProject: messageWithSender.quoteProject
                        ? {
                              id: messageWithSender.quoteProject.id?.toString(),
                              photoUrl: messageWithSender.quoteProject.photoUrl,
                              title: messageWithSender.quoteProject.title,
                          }
                        : null,
                    sender: {
                        id: messageWithSender.sender_id._id.toString(),
                        username: messageWithSender.sender_id.studentName,
                        avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${messageWithSender.sender_id.studentName}`,
                    },
                    recipient: {
                        id: messageWithSender.recipient_id._id.toString(),
                        username: messageWithSender.recipient_id.studentName,
                        avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${messageWithSender.recipient_id.studentName}`,
                    },
                };

                const conversationId = [socket.userId, recipientId].sort().join('_');

                // Send confirmation to sender with the full message
                socket.emit('message_sent_confirmation', {
                    tempId,
                    messageId: formattedMessage._id,
                    status: 'sent',
                    message: formattedMessage,
                });

                // Broadcast to conversation room (excluding sender to prevent duplication)
                socket.to(`personal_${conversationId}`).emit('new_personal_message', formattedMessage);

                // Always save persistent notification for the recipient (whether online or offline)
                createNotification(
                    recipientId,
                    'new_chat_message',
                    'New Message from ' + socket.username,
                    socket.username + ' sent you a message on ByteNexus.',
                    { senderId: socket.userId, senderName: socket.username, conversationId }
                ).catch(() => {});

                // Check if recipient is online
                const recipientSocket = authenticatedSockets.get(recipientId);
                if (recipientSocket) {
                    await PersonalMessage.updateOne({ _id: formattedMessage._id }, { delivered: true });

                    socket.emit('message_status_update', {
                        messageId: formattedMessage._id,
                        status: 'delivered',
                    });

                    recipientSocket.emit('new_message_notification', {
                        type: 'personal',
                        senderId: socket.userId,
                        senderName: socket.username,
                        conversationId,
                        messageId: formattedMessage._id,
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
                        senderSocket.emit('message_read_receipt', { messageId });
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

                const group = await DiscussionGroup.findById(groupId);
                if (!group) {
                    socket.emit('error', { message: 'Group not found' });
                    return;
                }

                const isMember = group.members.some((memberId) => memberId.toString() === socket.userId);
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

                const group = await DiscussionGroup.findById(groupId);
                if (!group) {
                    socket.emit('message_error', { error: 'Group not found' });
                    return;
                }

                const isMember = group.members.some((memberId) => memberId.toString() === socket.userId);
                if (!isMember) {
                    socket.emit('message_error', { error: 'Not a member of this group' });
                    return;
                }

                const newMessage = new GroupMessage({
                    group_id: groupId,
                    sender_id: socket.userId,
                    content,
                    replyTo: replyTo || null,
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
                    replyTo: messageWithSender.replyTo
                        ? {
                              id: messageWithSender.replyTo.id?.toString(),
                              content: messageWithSender.replyTo.content,
                              sender_id: messageWithSender.replyTo.sender_id?.toString(),
                          }
                        : null,
                    sender: {
                        id: messageWithSender.sender_id._id.toString(),
                        username: messageWithSender.sender_id.studentName,
                        avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${messageWithSender.sender_id.studentName}`,
                    },
                };

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
}

module.exports = { setupChatSockets, authenticatedSockets };
