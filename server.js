require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const db = require('./database');
const auth = require('./auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'christmas-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
}));

// Make user available to all views
app.use((req, res, next) => {
    if (req.session.userId) {
        res.locals.user = auth.findUserById(req.session.userId);
    } else {
        res.locals.user = null;
    }
    next();
});

// Routes

// Home page
app.get('/', (req, res) => {
    if (req.session.userId) {
        res.redirect('/dashboard');
    } else {
        res.render('index');
    }
});

// Login page
app.get('/login', (req, res) => {
    if (req.session.userId) {
        res.redirect('/dashboard');
    } else {
        res.render('login', { error: null });
    }
});

// Login POST
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const user = await auth.loginUser(username, password);

    if (user) {
        req.session.userId = user.id;
        res.redirect('/dashboard');
    } else {
        res.render('login', { error: 'Invalid username or password' });
    }
});

// Signup page
app.get('/signup', (req, res) => {
    if (req.session.userId) {
        res.redirect('/dashboard');
    } else {
        res.render('signup', { error: null });
    }
});

// Signup POST
app.post('/signup', async (req, res) => {
    const { username, email, password, displayName } = req.body;

    try {
        const userId = await auth.createUser(username, email, password, displayName);
        req.session.userId = userId;
        res.redirect('/dashboard');
    } catch (error) {
        res.render('signup', { error: error.message });
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Dashboard (requires authentication)
app.get('/dashboard', auth.requireAuth, (req, res) => {
    // Get user's families
    const families = db.prepare(`
        SELECT f.*, COUNT(fm.user_id) as member_count
        FROM families f
        JOIN family_members fm ON f.id = fm.family_id
        WHERE fm.user_id = ?
        GROUP BY f.id
        ORDER BY f.created_at DESC
    `).all(req.session.userId);

    res.render('dashboard', { families });
});

// Create family page
app.get('/family/create', auth.requireAuth, (req, res) => {
    res.render('create-family', { error: null });
});

// Create family POST
app.post('/family/create', auth.requireAuth, async (req, res) => {
    const { familyName } = req.body;
    const inviteCode = uuidv4().substring(0, 8).toUpperCase();

    try {
        // Create family
        const familyStmt = db.prepare(`
            INSERT INTO families (name, invite_code, created_by)
            VALUES (?, ?, ?)
        `);
        const result = familyStmt.run(familyName, inviteCode, req.session.userId);
        const familyId = result.lastInsertRowid;

        // Add creator as member
        const memberStmt = db.prepare(`
            INSERT INTO family_members (family_id, user_id)
            VALUES (?, ?)
        `);
        memberStmt.run(familyId, req.session.userId);

        res.redirect(`/family/${familyId}`);
    } catch (error) {
        res.render('create-family', { error: error.message });
    }
});

// Join family page
app.get('/family/join', auth.requireAuth, (req, res) => {
    res.render('join-family', { error: null });
});

// Join family POST
app.post('/family/join', auth.requireAuth, (req, res) => {
    const { inviteCode } = req.body;

    try {
        // Find family by invite code
        const family = db.prepare('SELECT * FROM families WHERE invite_code = ?').get(inviteCode.toUpperCase());

        if (!family) {
            return res.render('join-family', { error: 'Invalid invite code' });
        }

        // Check if already a member
        const existing = db.prepare(`
            SELECT * FROM family_members WHERE family_id = ? AND user_id = ?
        `).get(family.id, req.session.userId);

        if (existing) {
            return res.redirect(`/family/${family.id}`);
        }

        // Add as member
        db.prepare(`
            INSERT INTO family_members (family_id, user_id)
            VALUES (?, ?)
        `).run(family.id, req.session.userId);

        res.redirect(`/family/${family.id}`);
    } catch (error) {
        res.render('join-family', { error: error.message });
    }
});

// Family view
app.get('/family/:id', auth.requireAuth, (req, res) => {
    const familyId = req.params.id;

    // Check if user is member
    const membership = db.prepare(`
        SELECT * FROM family_members WHERE family_id = ? AND user_id = ?
    `).get(familyId, req.session.userId);

    if (!membership) {
        return res.redirect('/dashboard');
    }

    // Get family info
    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);

    // Get family members
    const members = db.prepare(`
        SELECT u.id, u.display_name, u.username
        FROM users u
        JOIN family_members fm ON u.id = fm.user_id
        WHERE fm.family_id = ?
    `).all(familyId);

    res.render('family', { family, members });
});

// My wishlist
app.get('/family/:id/my-list', auth.requireAuth, (req, res) => {
    const familyId = req.params.id;

    // Check membership
    const membership = db.prepare(`
        SELECT * FROM family_members WHERE family_id = ? AND user_id = ?
    `).get(familyId, req.session.userId);

    if (!membership) {
        return res.redirect('/dashboard');
    }

    // Get family info
    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);

    // Get user's wishlist items
    const items = db.prepare(`
        SELECT * FROM wishlist_items
        WHERE family_id = ? AND user_id = ?
        ORDER BY created_at DESC
    `).all(familyId, req.session.userId);

    res.render('my-list', { family, items });
});

// Add wishlist item
app.post('/family/:id/my-list/add', auth.requireAuth, (req, res) => {
    const familyId = req.params.id;
    const { title, description, link, price } = req.body;

    db.prepare(`
        INSERT INTO wishlist_items (user_id, family_id, title, description, link, price)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.session.userId, familyId, title, description || null, link || null, price || null);

    res.redirect(`/family/${familyId}/my-list`);
});

// Delete wishlist item
app.post('/family/:id/my-list/delete/:itemId', auth.requireAuth, (req, res) => {
    const { id: familyId, itemId } = req.params;

    db.prepare(`
        DELETE FROM wishlist_items
        WHERE id = ? AND user_id = ? AND family_id = ?
    `).run(itemId, req.session.userId, familyId);

    res.redirect(`/family/${familyId}/my-list`);
});

// Shopping view (see others' lists)
app.get('/family/:id/shop', auth.requireAuth, (req, res) => {
    const familyId = req.params.id;

    // Check membership
    const membership = db.prepare(`
        SELECT * FROM family_members WHERE family_id = ? AND user_id = ?
    `).get(familyId, req.session.userId);

    if (!membership) {
        return res.redirect('/dashboard');
    }

    // Get family info
    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);

    // Get all wishlist items from other family members
    const items = db.prepare(`
        SELECT wi.*, u.display_name as owner_name, u.id as owner_id,
               p.id as purchase_id, p.purchased_by
        FROM wishlist_items wi
        JOIN users u ON wi.user_id = u.id
        LEFT JOIN purchases p ON wi.id = p.wishlist_item_id
        WHERE wi.family_id = ? AND wi.user_id != ?
        ORDER BY u.display_name, wi.created_at DESC
    `).all(familyId, req.session.userId);

    // Group items by user
    const itemsByUser = {};
    items.forEach(item => {
        if (!itemsByUser[item.owner_id]) {
            itemsByUser[item.owner_id] = {
                name: item.owner_name,
                items: []
            };
        }
        itemsByUser[item.owner_id].items.push(item);
    });

    res.render('shop', { family, itemsByUser });
});

// Mark item as purchased
app.post('/family/:id/shop/purchase/:itemId', auth.requireAuth, (req, res) => {
    const { id: familyId, itemId } = req.params;

    // Get the item to find owner
    const item = db.prepare('SELECT user_id FROM wishlist_items WHERE id = ?').get(itemId);

    if (!item) {
        return res.redirect(`/family/${familyId}/shop`);
    }

    // Check if already purchased
    const existing = db.prepare('SELECT * FROM purchases WHERE wishlist_item_id = ?').get(itemId);

    if (!existing) {
        // Create purchase record
        const purchaseStmt = db.prepare(`
            INSERT INTO purchases (wishlist_item_id, purchased_by, purchased_for, family_id)
            VALUES (?, ?, ?, ?)
        `);
        const result = purchaseStmt.run(itemId, req.session.userId, item.user_id, familyId);

        // Create tree present with random attributes
        const sizes = ['small', 'medium', 'large'];
        const colors = ['red', 'green', 'blue', 'gold', 'silver'];
        const randomSize = sizes[Math.floor(Math.random() * sizes.length)];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        db.prepare(`
            INSERT INTO tree_presents (purchase_id, user_id, family_id, size, color)
            VALUES (?, ?, ?, ?, ?)
        `).run(result.lastInsertRowid, item.user_id, familyId, randomSize, randomColor);
    }

    res.redirect(`/family/${familyId}/shop`);
});

// Christmas tree view
app.get('/family/:id/tree', auth.requireAuth, (req, res) => {
    const familyId = req.params.id;

    // Check membership
    const membership = db.prepare(`
        SELECT * FROM family_members WHERE family_id = ? AND user_id = ?
    `).get(familyId, req.session.userId);

    if (!membership) {
        return res.redirect('/dashboard');
    }

    // Get family info
    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);

    // Get user's presents
    const presents = db.prepare(`
        SELECT tp.*, p.unwrapped, p.unwrapped_at, wi.title, u.display_name as gifter_name
        FROM tree_presents tp
        JOIN purchases p ON tp.purchase_id = p.id
        JOIN wishlist_items wi ON p.wishlist_item_id = wi.id
        JOIN users u ON p.purchased_by = u.id
        WHERE tp.user_id = ? AND tp.family_id = ?
    `).all(req.session.userId, familyId);

    // Calculate days until Christmas
    const christmasDate = new Date(process.env.CHRISTMAS_DATE || '2025-12-25');
    const today = new Date();
    const daysUntilChristmas = Math.ceil((christmasDate - today) / (1000 * 60 * 60 * 24));
    const isChristmas = daysUntilChristmas <= 0;

    res.render('tree', { family, presents, daysUntilChristmas, isChristmas });
});

// Unwrap present (only after Christmas)
app.post('/family/:id/tree/unwrap/:presentId', auth.requireAuth, (req, res) => {
    const { id: familyId, presentId } = req.params;

    const christmasDate = new Date(process.env.CHRISTMAS_DATE || '2025-12-25');
    const today = new Date();

    if (today >= christmasDate) {
        // Get the present to find purchase_id
        const present = db.prepare('SELECT purchase_id FROM tree_presents WHERE id = ?').get(presentId);

        if (present) {
            db.prepare(`
                UPDATE purchases
                SET unwrapped = 1, unwrapped_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(present.purchase_id);
        }
    }

    res.redirect(`/family/${familyId}/tree`);
});

// Start server
app.listen(PORT, () => {
    console.log(`Christmas Wishlist app running at http://localhost:${PORT}`);
});
