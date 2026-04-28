const express = require('express');
const mongoose = require('mongoose');
const Team = require('../../models/Team');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Update the Team schema to include members and description (kept here so the
// schema patch happens when the router is required, mirroring server.js
// historical behaviour).
const teamSchemaUpdate = Team.schema;
if (!teamSchemaUpdate.path('members')) {
    teamSchemaUpdate.add({
        members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
        description: { type: String, default: '' },
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    });
}

// Create a team
router.post('/api/teams/create', authenticateToken, async (req, res) => {
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
            created_by: studentId,
        });

        await team.save();

        res.json({
            message: 'Team created successfully',
            team: {
                id: team._id,
                name: team.name,
                description: team.description,
                share_token: team.share_token,
                created_at: team.created_at,
            },
        });
    } catch (error) {
        console.error('Error creating team:', error);
        res.status(500).json({ error: 'Failed to create team' });
    }
});

// Join a team using share token
router.post('/api/teams/join', authenticateToken, async (req, res) => {
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
                created_at: team.created_at,
            },
        });
    } catch (error) {
        console.error('Error joining team:', error);
        res.status(500).json({ error: 'Failed to join team' });
    }
});

// Get user's teams
router.get('/api/teams/my-teams', authenticateToken, async (req, res) => {
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
                email: team.created_by.email,
            } : null,
            members: team.members ? team.members.map(member => ({
                id: member._id.toString(),
                name: member.studentName,
                email: member.email,
                avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${member.studentName}`,
            })) : [],
            memberCount: team.members ? team.members.length : 0,
        }));

        res.json({ teams: formattedTeams });
    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).json({ error: 'Failed to fetch teams' });
    }
});

// Get team details
router.get('/api/teams/:teamId', authenticateToken, async (req, res) => {
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
                    email: team.created_by.email,
                } : null,
                members: team.members ? team.members.map(member => ({
                    id: member._id.toString(),
                    name: member.studentName,
                    email: member.email,
                    avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${member.studentName}`,
                })) : [],
            },
        });
    } catch (error) {
        console.error('Error fetching team details:', error);
        res.status(500).json({ error: 'Failed to fetch team details' });
    }
});

// Leave a team
router.post('/api/teams/:teamId/leave', authenticateToken, async (req, res) => {
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

module.exports = router;
