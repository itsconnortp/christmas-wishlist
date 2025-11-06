const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Use /data directory for persistent storage on Railway
const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
const dbPath = path.join(dataDir, 'christmas.db');

// Ensure directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

console.log(`Using database at: ${dbPath}`);
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
function initializeDatabase() {
    // Users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            display_name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Families table
    db.exec(`
        CREATE TABLE IF NOT EXISTS families (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            invite_code TEXT UNIQUE NOT NULL,
            created_by INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    `);

    // Family members table (join table)
    db.exec(`
        CREATE TABLE IF NOT EXISTS family_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            family_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(family_id, user_id)
        )
    `);

    // Wishlist items table
    db.exec(`
        CREATE TABLE IF NOT EXISTS wishlist_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            family_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            link TEXT,
            price TEXT,
            image_url TEXT,
            priority INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
        )
    `);

    // Purchased items table (who bought what for whom)
    db.exec(`
        CREATE TABLE IF NOT EXISTS purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wishlist_item_id INTEGER NOT NULL,
            purchased_by INTEGER NOT NULL,
            purchased_for INTEGER NOT NULL,
            family_id INTEGER NOT NULL,
            purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            unwrapped BOOLEAN DEFAULT 0,
            unwrapped_at DATETIME,
            thank_you_sent BOOLEAN DEFAULT 0,
            FOREIGN KEY (wishlist_item_id) REFERENCES wishlist_items(id) ON DELETE CASCADE,
            FOREIGN KEY (purchased_by) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (purchased_for) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
        )
    `);

    // Christmas tree presents (visual representation)
    db.exec(`
        CREATE TABLE IF NOT EXISTS tree_presents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            family_id INTEGER NOT NULL,
            size TEXT NOT NULL,
            color TEXT NOT NULL,
            position_x REAL,
            position_y REAL,
            FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
        )
    `);

    console.log('Database initialized successfully');
}

// Initialize the database
initializeDatabase();

module.exports = db;
