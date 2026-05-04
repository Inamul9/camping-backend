require('dotenv').config();
const mongoose = require('mongoose');

const ContentSchema = new mongoose.Schema({
    section: String,
    key: { type: String, unique: true },
    value: String,
    type: { type: String, default: 'text' }
});

const Content = mongoose.model('Content', ContentSchema);

const initialContent = [
    { section: 'Hero', key: 'hero_title', value: 'Discover the World of Camping' },
    { section: 'Welcome', key: 'welcome_subtitle', value: 'Welcome to Kamper' },
    { section: 'Welcome', key: 'welcome_title', value: 'Let’s Explore and Experience a Camping Vacation Here' },
    { section: 'Welcome', key: 'welcome_description', value: 'The cost of camping really does depend on the location, time of year and the facilities on offer which can vary greatly.' },
];

async function seed() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    for (const item of initialContent) {
        await Content.findOneAndUpdate({ key: item.key }, item, { upsert: true });
    }
    
    console.log('Database seeded!');
    process.exit();
}

seed();
