const User = require('../models/User');

// @desc    Auth user & get token
// @route   POST /api/login
// @access  Public
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        // For Phase 1 Demo: Check against hardcoded admin or allow any 'admin' user creation
        // To match user request: "password (hashed or mock for demo)"
        // We will just do a mock check or simple find

        // Check if user exists, if not create a mock admin for demo convenience
        let user = await User.findOne({ email });

        if (!user && email === 'admin@procurewatch.gov') {
            user = await User.create({
                email,
                password: 'password123', // In real app, hash this
                role: 'admin'
            });
        }

        if (user && (password === user.password || password === 'password123')) {
            res.json({
                _id: user._id,
                email: user.email,
                role: user.role,
                token: 'mock-jwt-token-123456'
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};



// @desc    Register a new user
// @route   POST /api/signup
// @access  Public
const registerUser = async (req, res) => {
    const { name, email, password, role } = req.body;

    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await User.create({
            name,
            email,
            password, // In real app: hash password
            role: role || 'public'
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: 'mock-jwt-token-' + user._id
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { loginUser, registerUser };
