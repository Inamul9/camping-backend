require('dotenv').config();
const express = require('express'); // Production Ready
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3002;
const SECRET_KEY = process.env.JWT_SECRET || 'super_secret_kamper_key_2024';

// ── Manual CORS Fix (Universal) ────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static uploads if you have any (optional)
if (fs.existsSync(path.join(__dirname, 'uploads'))) {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// Global Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Root API Message
app.get('/', (req, res) => {
  res.json({ 
    message: 'Kamper API Server', 
    status: 'Running',
    documentation: 'Use http://localhost:5173 to access the frontend'
  });
});

// ── Auth Middleware ───────────────────────────────────────────────────────────
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('❌ Auth failed: No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      console.log('❌ JWT Verification Error:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Rate limiter for auth endpoint
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many login attempts. Try again later.' }
});

// ── MongoDB Connection ─────────────────────────────────────────────────────────
// ── SEEDING ───────────────────────────────────────────────────────────────────
app.post('/api/seed-force', authenticateToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ error: 'DB not connected' });
    }
    
    // Clear existing
    await Camp.deleteMany({});
    await Blog.deleteMany({});
    await Category.deleteMany({});
    
    // Insert defaults
    await Camp.insertMany(defaultCamps);
    await Blog.insertMany(defaultBlogs);
    await Category.insertMany(defaultCategories);
    
    res.json({ message: 'Database forcefully seeded with 6 default camps and blogs! 🚀' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

let lastDbError = null;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    lastDbError = null;
  } catch (err) {
    lastDbError = err.message;
    console.error('❌ MongoDB connection failed:', err.message);
    console.log('⚠️  CRITICAL: Database not connected. Administrative updates will NOT be saved.');
  }
};
connectDB();

app.get('/api/db-status', (req, res) => {
  res.json({ 
    connected: mongoose.connection.readyState === 1,
    status: mongoose.connection.readyState,
    error: lastDbError
  });
});

// ── Schemas & Models ───────────────────────────────────────────────────────────
const ContentSchema = new mongoose.Schema({
    section: String,
    key: { type: String, unique: true },
    value: String,
    type: { type: String, default: 'text' }
  });

  const CampSchema = new mongoose.Schema({
    title: { type: String, required: true },
    slug: { type: String, unique: true },
    price: { type: Number, required: true },
    category: { type: String, default: 'classic-tent' },
    image: { type: String, default: '' },
    gallery: [String],
    description: { type: String, default: '' },
    shortDesc: { type: String, default: '' },
    services: [String],
    capacity: { type: Number, default: 2 },
    rating: { type: Number, default: 4.5 },
    reviews: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    available: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
  });

  const CategorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, unique: true },
    description: String,
    image: String,
    icon: String,
    order: { type: Number, default: 0 }
  });

  const BookingSchema = new mongoose.Schema({
    tentName: String,
    campId: String,
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    customerPhone: String,
    checkInDate: String,
    checkOutDate: String,
    guests: { type: Number, default: 1 },
    totalAmount: String,
    status: { type: String, default: 'Pending', enum: ['Pending', 'Confirmed', 'Cancelled', 'Completed'] },
    notes: String,
    createdAt: { type: Date, default: Date.now }
  });

  const BlogSchema = new mongoose.Schema({
    title: { type: String, required: true },
    slug: { type: String, unique: true },
    excerpt: String,
    content: String,
    coverImage: String,
    author: { type: String, default: 'Kamper Team' },
    category: { type: String, default: 'General' },
    tags: [String],
    published: { type: Boolean, default: true },
    views: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  });

  const ContactSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    subject: String,
    message: { type: String, required: true },
    status: { type: String, default: 'unread' },
    createdAt: { type: Date, default: Date.now }
  });

  const AdminSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String,
    role: { type: String, default: 'admin' }
  });

  const Content = mongoose.model('Content', ContentSchema);
  const Camp = mongoose.model('Camp', CampSchema);
  const Category = mongoose.model('Category', CategorySchema);
  const Booking = mongoose.model('Booking', BookingSchema);
  const Blog = mongoose.model('Blog', BlogSchema);
  const Contact = mongoose.model('Contact', ContactSchema);
  const Admin = mongoose.model('Admin', AdminSchema);

  // ── Seed default data ─────────────────────────────────────────────────────────
  const defaultCamps = [
    { _id: 'm1', title: 'Vango Kibale 350 Tent', slug: 'vango-kibale-350-tent', price: 150, category: 'classic-tent', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80', shortDesc: 'Perfect for festivals and weekend trips', description: 'The Vango Kibale 350 is an easy-to-use beginner tent, featuring a simple pop-up design that sets up in seconds. Perfect for festivals and weekend trips with friends or family.', services: ['bbq', 'camp-fire', 'free-coffee', 'safe-tent'], capacity: 3, rating: 4.3, reviews: 28, featured: true },
    { _id: 'm2', title: 'Vango Beta 450XL Tent', slug: 'vango-beta-450xl-tent', price: 80, category: 'classic-tent', image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800&q=80', shortDesc: 'Spacious 4-person tunnel tent', description: 'The Vango Beta 450XL is a 4-person tunnel tent with a large porch area, ideal for longer camping trips where extra space is needed.', services: ['bbq', 'camp-fire', 'free-coffee', 'safe-tent'], capacity: 4, rating: 4.5, reviews: 42, featured: true },
    { _id: 'm3', title: 'Coleman Dark Room Tent', slug: 'coleman-dark-room-tent', price: 200, category: 'luxury-tent', image: 'https://images.unsplash.com/photo-1537225228614-56cc3556d7ed?w=800&q=80', shortDesc: 'Blocks 90% of sunlight for premium sleep', description: 'Block 90% of sunlight so you can sleep in past sunrise. The Dark Room technology also reduces heat for a more comfortable night\'s sleep in ultimate luxury.', services: ['bbq', 'wifi', 'free-coffee', 'safe-tent'], capacity: 4, rating: 4.7, reviews: 65, featured: true },
    { _id: 'm4', title: 'Ozark Trail Hazel Creek', slug: 'ozark-trail-hazel-creek', price: 250, category: 'luxury-tent', image: 'https://images.unsplash.com/photo-1496080174650-637e3f22fa03?w=800&q=80', shortDesc: 'Massive 12-person cabin tent', description: 'A massive 12-person cabin tent that feels like a house. Perfect for large families or groups wanting maximum comfort in the outdoors.', services: ['bbq', 'camp-fire', 'wifi', 'private-shower'], capacity: 12, rating: 4.8, reviews: 91, featured: false },
    { _id: 'm5', title: 'MSR Hubba Hubba NX', slug: 'msr-hubba-hubba', price: 300, category: 'ultralight-tent', image: 'https://images.unsplash.com/photo-1567303716578-6e6e09d48e3b?w=800&q=80', shortDesc: 'Gold standard lightweight backpacking tent', description: 'The gold standard for lightweight backpacking. This 2-person tent offers maximum internal space and durability at a very low weight.', services: ['safe-tent', 'free-coffee'], capacity: 2, rating: 4.9, reviews: 113, featured: true },
    { _id: 'm6', title: 'Glamping Dome Suite', slug: 'glamping-dome-suite', price: 400, category: 'glamping', image: 'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=800&q=80', shortDesc: 'Luxury geodesic dome with full amenities', description: 'Experience the ultimate glamping adventure in our stunning geodesic dome. Features a king bed, en-suite bathroom, private deck, and panoramic forest views.', services: ['bbq', 'wifi', 'free-coffee', 'private-shower', 'camp-fire'], capacity: 2, rating: 5.0, reviews: 47, featured: true },
  ];

  const defaultCategories = [
    { _id: 'cat1', name: 'Classic Tent', slug: 'classic-tent', description: 'Traditional camping tents for the outdoor enthusiast', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80', icon: '⛺', order: 1 },
    { _id: 'cat2', name: 'Luxury Tent', slug: 'luxury-tent', description: 'Premium tents with top-tier amenities', image: 'https://images.unsplash.com/photo-1537225228614-56cc3556d7ed?w=800&q=80', icon: '🏕️', order: 2 },
    { _id: 'cat3', name: 'Ultralight Tent', slug: 'ultralight-tent', description: 'Lightweight tents for serious backpackers', image: 'https://images.unsplash.com/photo-1567303716578-6e6e09d48e3b?w=800&q=80', icon: '🎒', order: 3 },
    { _id: 'cat4', name: 'Glamping', slug: 'glamping', description: 'Glamorous camping with all the comforts of home', image: 'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=800&q=80', icon: '✨', order: 4 },
  ];

  const defaultContent = [
    { _id: 'c1', section: 'Hero', key: 'hero_title', value: 'Discover the World of Camping' },
    { _id: 'c2', section: 'Hero', key: 'hero_subtitle', value: 'Your next adventure starts here' },
    { _id: 'c3', section: 'About', key: 'about_title', value: 'About Camping Manali' },
  ];

  const defaultBlogs = [
    {
      _id: 'b1',
      title: 'Ultimate Camping Guide 2024',
      slug: 'ultimate-camping-guide-2024',
      excerpt: 'Everything you need to know about camping in the Himalayas.',
      content: 'Full content here...',
      coverImage: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80',
      author: 'Admin',
      category: 'Adventure',
      tags: ['camping', 'guide'],
      published: true,
      views: 120,
      createdAt: new Date().toISOString()
    }
  ];

  const defaultBookings = [
    {
      _id: 'bk1',
      customerName: 'Sample Traveler',
      customerEmail: 'sample@example.com',
      tentName: 'Classic Tent',
      checkInDate: '2024-06-01',
      checkOutDate: '2024-06-05',
      guests: 2,
      status: 'Confirmed',
      createdAt: new Date().toISOString()
    }
  ];

  const toSlug = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  mongoose.connection.once('open', async () => {
    try {
      // Seed admin ONLY if no admin exists
      const adminCount = await Admin.countDocuments();
      if (adminCount === 0) {
        const hashed = await bcrypt.hash('sinu', 10);
        await Admin.create({
          username: 'raja',
          password: hashed,
          role: 'admin'
        });
        console.log('✅ Default admin created: raja / sinu');
      } else {
        console.log('ℹ️  Admin already exists, skipping seed');
      }

      // Seed camps
      const campCount = await Camp.countDocuments();
      if (campCount === 0) {
        await Camp.insertMany(defaultCamps);
        console.log('✅ Default camps seeded');
      }

      // Seed categories
      const catCount = await Category.countDocuments();
      if (catCount === 0) {
        await Category.insertMany(defaultCategories);
        console.log('✅ Default categories seeded');
      }
    } catch (err) {
      console.error('Seed error:', err.message);
    }
  });

  // ── AUTH ──────────────────────────────────────────────────────────────────────
  app.post('/api/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  // EMERGENCY SAFETY LOGIN: Allow access if DB is down
  if (mongoose.connection.readyState !== 1) {
    if (username === 'raja' && password === 'sinu') {
      const token = jwt.sign({ username: 'raja', role: 'admin' }, SECRET_KEY, { expiresIn: '24h' });
      return res.json({ token, username: 'raja', db_status: 'disconnected' });
    }
    return res.status(503).json({ error: 'Database disconnected. Access limited.' });
  }

  try {
    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
    // Support both plain-text (legacy) and bcrypt
    let valid = false;
    if (admin.password.startsWith('$2')) {
      valid = await bcrypt.compare(password, admin.password);
    } else {
      valid = admin.password === password; // legacy fallback
      if (valid) {
        // Upgrade to bcrypt
        admin.password = await bcrypt.hash(password, 10);
        await admin.save();
      }
    }
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ username: admin.username, role: admin.role }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ token, username: admin.username });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

  // ── CONTENT ───────────────────────────────────────────────────────────────────
  app.get('/api/content', async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database disconnected' });
      const content = await Content.find();
      res.json(content);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/content', authenticateToken, async (req, res) => {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'Key is required' });
    try {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: 'Database not connected. Cannot save changes.' });
      }
      const updated = await Content.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── CAMPS ─────────────────────────────────────────────────────────────────────
  app.get('/api/camps', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database disconnected' });

    const { category, search, featured, sort, limit } = req.query;
    let query = { available: true };
    if (category && category !== 'all') query.category = category;
    if (featured === 'true') query.featured = true;
    if (search) query.title = { $regex: search, $options: 'i' };

    let sortObj = { createdAt: -1 };
    if (sort === 'price-asc') sortObj = { price: 1 };
    if (sort === 'price-desc') sortObj = { price: -1 };
    if (sort === 'rating') sortObj = { rating: -1 };

    let dbQuery = Camp.find(query).sort(sortObj);
    if (limit) dbQuery = dbQuery.limit(parseInt(limit));

    const camps = await dbQuery;
    res.json(camps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

  app.get('/api/camps/:slug', async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database disconnected' });
      const camp = await Camp.findOne({ slug: req.params.slug });
      if (!camp) return res.status(404).json({ error: 'Camp not found' });
      res.json(camp);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/camps', authenticateToken, async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database disconnected' });
      const slug = toSlug(req.body.title) + '-' + Date.now();
      const camp = new Camp({ ...req.body, slug });
      await camp.save();
      res.status(201).json(camp);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch('/api/camps/:id', authenticateToken, async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database disconnected' });
      const updated = await Camp.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!updated) return res.status(404).json({ error: 'Camp not found' });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/camps/:id', authenticateToken, async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database disconnected' });
      await Camp.findByIdAndDelete(req.params.id);
      res.json({ message: 'Camp deleted' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── CATEGORIES ────────────────────────────────────────────────────────────────
  app.get('/api/categories', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database disconnected' });
    const categories = await Category.find().sort({ order: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

  app.post('/api/categories', authenticateToken, async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database disconnected' });
      const slug = toSlug(req.body.name);
      const cat = new Category({ ...req.body, slug });
      await cat.save();
      res.status(201).json(cat);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch('/api/categories/:id', authenticateToken, async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database disconnected' });
      const updated = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database disconnected' });
      await Category.findByIdAndDelete(req.params.id);
      res.json({ message: 'Category deleted' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── BOOKINGS ──────────────────────────────────────────────────────────────────
  app.post('/api/bookings', async (req, res) => {
    const { customerName, customerEmail, tentName } = req.body;
    if (!customerName || !customerEmail || !tentName) {
      return res.status(400).json({ error: 'Name, email and tent are required' });
    }
    try {
      if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database disconnected' });
      const newBooking = new Booking(req.body);
      await newBooking.save();
      res.status(201).json({ message: 'Booking submitted successfully', id: newBooking._id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/bookings', authenticateToken, async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database disconnected' });
      const bookings = await Booking.find().sort({ createdAt: -1 });
      res.json(bookings);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/bookings/:id', authenticateToken, async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database disconnected' });
      const updated = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!updated) return res.status(404).json({ error: 'Booking not found' });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/bookings/:id', authenticateToken, async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database disconnected' });
      await Booking.findByIdAndDelete(req.params.id);
      res.json({ message: 'Deleted' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── BLOGS ─────────────────────────────────────────────────────────────────────
  app.get('/api/blogs', async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database disconnected' });
      const query = req.query.all === 'true' ? {} : { published: true };
      const blogs = await Blog.find(query).sort({ createdAt: -1 });
      res.json(blogs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/blogs/:slug', async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database disconnected' });
      const blog = await Blog.findOne({ slug: req.params.slug });
      if (!blog) return res.status(404).json({ error: 'Blog not found' });
      blog.views += 1;
      await blog.save();
      res.json(blog);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/blogs', authenticateToken, async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database disconnected' });
      const slug = toSlug(req.body.title) + '-' + Date.now();
      const blog = new Blog({ ...req.body, slug });
      await blog.save();
      res.status(201).json(blog);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch('/api/blogs/:id', authenticateToken, async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database disconnected' });
      const updated = await Blog.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/blogs/:id', authenticateToken, async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        return res.json({ message: 'Deleted (Mock Mode)' });
      }
      await Blog.findByIdAndDelete(req.params.id);
      res.json({ message: 'Deleted' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── CONTACT ───────────────────────────────────────────────────────────────────
  app.post('/api/contact', async (req, res) => {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email and message are required' });
    }
    try {
      if (mongoose.connection.readyState !== 1) {
        return res.status(201).json({ message: 'Message sent successfully! (Mock Mode)' });
      }
      const contact = new Contact(req.body);
      await contact.save();
      res.status(201).json({ message: 'Message sent successfully!' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/contact', authenticateToken, async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        return res.json([
          { _id: 'm1', name: 'John Doe', email: 'john@example.com', message: 'Hello from mock mode!', createdAt: new Date().toISOString() }
        ]);
      }
      const messages = await Contact.find().sort({ createdAt: -1 });
      res.json(messages);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Serve Frontend (Production) ──────────────────────────────────────────────
  const distPath = path.join(__dirname, '../dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      // If it's an API request that reached here, it's a 404 for the API
      if (req.url.startsWith('/api')) {
        return next();
      }
      // Otherwise, serve the frontend's index.html for React Router to handle
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // ── Error Handling ────────────────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  app.use((err, req, res, next) => {
    console.error('💥 Global Error:', err.stack);
    res.status(500).json({ error: 'Something went wrong on the server' });
  });

  // ── Start server ──────────────────────────────────────────────────────────────
  app.listen(PORT, () => {
    console.log(`🚀 Backend API running at http://localhost:${PORT}`);
    console.log(`🔗 Proxy this to: http://localhost:3002 (matching vite.config)`);
  });
