<<<<<<< HEAD
require('dotenv').config();
=======
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
>>>>>>> 7ca294292ab2b6f10d38a78c832f17346135d29d
const express = require('express');
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

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Global Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Rate limiter for auth endpoint
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many login attempts. Try again later.' }
});

// ── MongoDB Connection ─────────────────────────────────────────────────────────
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    console.log('⚠️  Running in local-data mode (MongoDB unavailable)');
  }
};
connectDB();

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
  published: { type: Boolean, default: false },
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

const Content   = mongoose.model('Content', ContentSchema);
const Camp      = mongoose.model('Camp', CampSchema);
const Category  = mongoose.model('Category', CategorySchema);
const Booking   = mongoose.model('Booking', BookingSchema);
const Blog      = mongoose.model('Blog', BlogSchema);
const Contact   = mongoose.model('Contact', ContactSchema);
const Admin     = mongoose.model('Admin', AdminSchema);

// ── Seed default data ─────────────────────────────────────────────────────────
const defaultCamps = [
  { title: 'Vango Kibale 350 Tent', slug: 'vango-kibale-350-tent', price: 150, category: 'classic-tent', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80', shortDesc: 'Perfect for festivals and weekend trips', description: 'The Vango Kibale 350 is an easy-to-use beginner tent, featuring a simple pop-up design that sets up in seconds. Perfect for festivals and weekend trips with friends or family.', services: ['bbq', 'camp-fire', 'free-coffee', 'safe-tent'], capacity: 3, rating: 4.3, reviews: 28, featured: true },
  { title: 'Vango Beta 450XL Tent', slug: 'vango-beta-450xl-tent', price: 80, category: 'classic-tent', image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800&q=80', shortDesc: 'Spacious 4-person tunnel tent', description: 'The Vango Beta 450XL is a 4-person tunnel tent with a large porch area, ideal for longer camping trips where extra space is needed.', services: ['bbq', 'camp-fire', 'free-coffee', 'safe-tent'], capacity: 4, rating: 4.5, reviews: 42, featured: true },
  { title: 'Coleman Dark Room Tent', slug: 'coleman-dark-room-tent', price: 200, category: 'luxury-tent', image: 'https://images.unsplash.com/photo-1537225228614-56cc3556d7ed?w=800&q=80', shortDesc: 'Blocks 90% of sunlight for premium sleep', description: 'Block 90% of sunlight so you can sleep in past sunrise. The Dark Room technology also reduces heat for a more comfortable night\'s sleep in ultimate luxury.', services: ['bbq', 'wifi', 'free-coffee', 'safe-tent'], capacity: 4, rating: 4.7, reviews: 65, featured: true },
  { title: 'Ozark Trail Hazel Creek', slug: 'ozark-trail-hazel-creek', price: 250, category: 'luxury-tent', image: 'https://images.unsplash.com/photo-1496080174650-637e3f22fa03?w=800&q=80', shortDesc: 'Massive 12-person cabin tent', description: 'A massive 12-person cabin tent that feels like a house. Perfect for large families or groups wanting maximum comfort in the outdoors.', services: ['bbq', 'camp-fire', 'wifi', 'private-shower'], capacity: 12, rating: 4.8, reviews: 91, featured: false },
  { title: 'MSR Hubba Hubba NX', slug: 'msr-hubba-hubba', price: 300, category: 'ultralight-tent', image: 'https://images.unsplash.com/photo-1567303716578-6e6e09d48e3b?w=800&q=80', shortDesc: 'Gold standard lightweight backpacking tent', description: 'The gold standard for lightweight backpacking. This 2-person tent offers maximum internal space and durability at a very low weight.', services: ['safe-tent', 'free-coffee'], capacity: 2, rating: 4.9, reviews: 113, featured: true },
  { title: 'Glamping Dome Suite', slug: 'glamping-dome-suite', price: 400, category: 'glamping', image: 'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=800&q=80', shortDesc: 'Luxury geodesic dome with full amenities', description: 'Experience the ultimate glamping adventure in our stunning geodesic dome. Features a king bed, en-suite bathroom, private deck, and panoramic forest views.', services: ['bbq', 'wifi', 'free-coffee', 'private-shower', 'camp-fire'], capacity: 2, rating: 5.0, reviews: 47, featured: true },
];

const defaultCategories = [
  { name: 'Classic Tent', slug: 'classic-tent', description: 'Traditional camping tents for the outdoor enthusiast', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80', icon: '⛺', order: 1 },
  { name: 'Luxury Tent', slug: 'luxury-tent', description: 'Premium tents with top-tier amenities', image: 'https://images.unsplash.com/photo-1537225228614-56cc3556d7ed?w=600&q=80', icon: '🏕️', order: 2 },
  { name: 'Ultralight Tent', slug: 'ultralight-tent', description: 'Lightweight tents for serious backpackers', image: 'https://images.unsplash.com/photo-1567303716578-6e6e09d48e3b?w=600&q=80', icon: '🎒', order: 3 },
  { name: 'Glamping', slug: 'glamping', description: 'Glamorous camping with all the comforts of home', image: 'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=600&q=80', icon: '✨', order: 4 },
];

const toSlug = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

mongoose.connection.once('open', async () => {
  try {
    // Force Seed/Reset admin to raja / sinu
    await Admin.deleteMany({}); // Clear all admins first to be 100% sure
    const hashed = await bcrypt.hash('sinu', 10);
    await Admin.create({ username: 'raja', password: hashed });
    console.log('✅ Admin credentials strictly set to raja / sinu');

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
      console.log('Using SECRET_KEY starting with:', SECRET_KEY.substring(0, 5) + '...');
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ── AUTH ──────────────────────────────────────────────────────────────────────
app.post('/api/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
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
    const updated = await Content.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CAMPS ─────────────────────────────────────────────────────────────────────
app.get('/api/camps', async (req, res) => {
  try {
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
    const camp = await Camp.findOne({ slug: req.params.slug });
    if (!camp) return res.status(404).json({ error: 'Camp not found' });
    res.json(camp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/camps', authenticateToken, async (req, res) => {
  try {
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
    const updated = await Camp.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ error: 'Camp not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/camps/:id', authenticateToken, async (req, res) => {
  try {
    await Camp.findByIdAndDelete(req.params.id);
    res.json({ message: 'Camp deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CATEGORIES ────────────────────────────────────────────────────────────────
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Category.find().sort({ order: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', authenticateToken, async (req, res) => {
  try {
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
    const updated = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
  try {
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
    const newBooking = new Booking(req.body);
    await newBooking.save();
    res.status(201).json({ message: 'Booking submitted successfully', id: newBooking._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/bookings/:id', authenticateToken, async (req, res) => {
  try {
    const updated = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Booking not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/bookings/:id', authenticateToken, async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── BLOGS ─────────────────────────────────────────────────────────────────────
app.get('/api/blogs', async (req, res) => {
  try {
    const query = req.query.all === 'true' ? {} : { published: true };
    const blogs = await Blog.find(query).sort({ createdAt: -1 });
    res.json(blogs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/blogs/:slug', async (req, res) => {
  try {
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
    const updated = await Blog.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/blogs/:id', authenticateToken, async (req, res) => {
  try {
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
    const contact = new Contact(req.body);
    await contact.save();
    res.status(201).json({ message: 'Message sent successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/contact', authenticateToken, async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Backend API running at http://localhost:${PORT}`);
});
