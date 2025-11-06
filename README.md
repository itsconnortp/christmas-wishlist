# 🎄 Christmas Wishlist Tracker

A family Christmas wishlist app that keeps gift-giving a surprise! Track what everyone wants, see who bought what (without spoiling your own gifts), and watch presents appear under your virtual Christmas tree.

## Features

### 👨‍👩‍👧‍👦 Family Groups
- Create or join family groups with unique invite codes
- Manage multiple family groups (extended family, friends, etc.)

### 📝 Personal Wishlists
- Add items with titles, descriptions, prices, and links
- Paste Amazon links or custom items
- Edit and delete your own items anytime

### 🛍️ Secret Shopping
- See what everyone else wants (but not your own list!)
- Mark items as "purchased" to claim them
- Items you've purchased are hidden from others to prevent double-buying
- You can't see who bought what for YOU - keeps it a surprise!

### 🎄 Christmas Tree Visualization
- Watch presents appear under your tree as people buy gifts for you
- Random-sized, colorful presents add excitement
- Countdown timer to Christmas Day
- After Christmas: Unwrap presents digitally to see who gave you what
- Perfect for writing thank you cards!

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   - Copy `.env.example` to `.env`
   - Update `CHRISTMAS_DATE` if needed
   - Change `SESSION_SECRET` for production

3. **Run the app:**
   ```bash
   npm start
   ```

4. **Access:**
   Open http://localhost:3001 in your browser

## How It Works

1. **Sign up** for an account
2. **Create a family** or join one with an invite code
3. **Add items** to your wishlist
4. **Shop** for others in your family
5. **Watch your tree** fill up with presents
6. **Wait until Christmas** to unwrap and see who got you what!

## Technology Stack

- **Backend:** Node.js, Express
- **Database:** SQLite (better-sqlite3)
- **Authentication:** bcryptjs, express-session
- **Views:** EJS templates
- **Styling:** Custom CSS with festive Christmas theme

## Database Schema

- **Users:** Account information
- **Families:** Christmas groups
- **Family Members:** Join table for users and families
- **Wishlist Items:** Things people want
- **Purchases:** Who bought what for whom
- **Tree Presents:** Visual representation of gifts

## Security Features

- Password hashing with bcrypt
- Session-based authentication
- SQL injection protection with prepared statements
- Gift privacy - you can't see who bought your gifts until Christmas!

## Future Enhancements

- Email notifications
- Budget tracking
- Photo uploads for wishlist items
- Mobile app
- Amazon wishlist import
- Thank you card tracking

Enjoy your Christmas planning! 🎅🎁
