const mongoose = require('mongoose')

const connectDB = async (mongoURI) => {
    try {
        await mongoose.connect(mongoURI || process.env.MONGO_URI)
        console.log('✅ MONGODB IS CONNECTED')
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message)
        process.exit(1);
    }
}

module.exports = connectDB
