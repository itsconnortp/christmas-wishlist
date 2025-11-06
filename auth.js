const bcrypt = require('bcryptjs');
const db = require('./database');

// Hash password
async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

// Verify password
async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

// Create new user
async function createUser(username, email, password, displayName) {
    const passwordHash = await hashPassword(password);

    try {
        const stmt = db.prepare(`
            INSERT INTO users (username, email, password_hash, display_name)
            VALUES (?, ?, ?, ?)
        `);

        const result = stmt.run(username, email, passwordHash, displayName);
        return result.lastInsertRowid;
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            throw new Error('Username or email already exists');
        }
        throw error;
    }
}

// Find user by username
function findUserByUsername(username) {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
}

// Find user by ID
function findUserById(id) {
    const stmt = db.prepare('SELECT id, username, email, display_name FROM users WHERE id = ?');
    return stmt.get(id);
}

// Login user
async function loginUser(username, password) {
    const user = findUserByUsername(username);

    if (!user) {
        return null;
    }

    const valid = await verifyPassword(password, user.password_hash);

    if (!valid) {
        return null;
    }

    // Return user without password hash
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
}

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

module.exports = {
    createUser,
    findUserByUsername,
    findUserById,
    loginUser,
    requireAuth
};
