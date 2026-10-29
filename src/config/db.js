// Connects the app to MongoDB using the connection string stored in .env
const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  // 1. Make sure the student actually created a .env file and filled it in.
  if (!uri || uri.includes('YOUR_MONGODB_CONNECTION_STRING_HERE')) {
    console.error('\n[DATABASE ERROR] MONGODB_URI is not set.');
    console.error('  1. Copy .env.example to a new file named .env');
    console.error('  2. Replace YOUR_MONGODB_CONNECTION_STRING_HERE with your MongoDB Atlas connection string');
    console.error('  3. Run the project again\n');
    process.exit(1);
  }

  // 2. Try to connect. If Atlas cannot be reached we fail fast with a clear message.
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

    const { host, name } = mongoose.connection;
    console.log(`MongoDB connected -> host: ${host} | database: ${name}`);

    if (name === 'test') {
      console.warn(
        'Warning: your connection string has no database name, so MongoDB is using "test".\n' +
          '         Add /studenthub before the "?" in the URI to use a database called studenthub.'
      );
    }
  } catch (err) {
    console.error('\n[DATABASE ERROR] Could not connect to MongoDB.');
    console.error('Common reasons:');
    console.error('  - Wrong username or password in MONGODB_URI (special characters must be URL-encoded)');
    console.error('  - Your IP address is not allowed in Atlas -> Network Access');
    console.error('  - No internet connection');
    console.error(`Details: ${err.message}\n`);
    process.exit(1);
  }

  // Helpful logs if the connection drops later while the server is running.
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected.'));
  mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected.'));
}

module.exports = connectDB;
