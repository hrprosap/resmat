import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your Mongo URI to .env.local');
}

const uri = process.env.MONGODB_URI;
const options = {
  useUnifiedTopology: true,
  useNewUrlParser: true,
};

let client;
let clientPromise;

// Handle MongoDB connection differently in development vs production
if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect().catch((error) => {
      console.error('Initial connection error:', error);
      throw new Error('Could not connect to database');
    });
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect().catch((error) => {
    console.error('Initial connection error:', error);
    throw new Error('Could not connect to database');
  });
}

// Function to connect to the database
export async function connectToDatabase() {
  try {
    const client = await clientPromise;
    console.log('Connected to the database successfully.');
    return client.db('resume-matcher');
  } catch (error) {
    console.error('Database connection error:', error);
    throw new Error('Could not connect to database');
  }
}

// Function to save tokens associated with a session ID
export async function saveTokenToDatabase(sessionId, tokens) {
  const db = await connectToDatabase();
  const collection = db.collection('tokens');

  try {
    const result = await collection.updateOne(
      { sessionId },
      { $set: { tokens, updatedAt: new Date() } },
      { upsert: true }
    );
    console.log(`Token saved/updated for sessionId: ${sessionId}`);
    if (result.modifiedCount === 0 && result.upsertedCount === 0) {
      console.warn(`No documents were modified or inserted for sessionId: ${sessionId}`);
      return false; // Indicate that no token was saved
    }
    return true; // Indicate success
  } catch (error) {
    console.error('Error saving token to database:', error);
    throw new Error('Error saving token');
  }
}

// Function to retrieve tokens using a session ID
export async function getTokenFromDatabase(sessionId) {
  const db = await connectToDatabase();
  const collection = db.collection('tokens');

  try {
    const result = await collection.findOne({ sessionId });
    console.log(`Token retrieved for sessionId: ${sessionId}`);
    return result ? result.tokens : null;
  } catch (error) {
    console.error('Error retrieving token from database:', error);
    throw new Error('Error retrieving token');
  }
}

// Function to update tokens associated with a session ID
export async function updateTokenInDatabase(sessionId, tokens) {
  const db = await connectToDatabase();
  const collection = db.collection('tokens');

  try {
    const result = await collection.updateOne(
      { sessionId },
      { $set: { tokens, updatedAt: new Date() } }
    );
    console.log(`Token updated for sessionId: ${sessionId}`);
    if (result.modifiedCount === 0) {
      console.warn(`No documents were modified for sessionId: ${sessionId}`);
    }
  } catch (error) {
    console.error('Error updating token in database:', error);
    throw new Error('Error updating token');
  }
}
