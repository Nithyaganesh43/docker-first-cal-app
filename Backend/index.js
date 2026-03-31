const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const app = express();
app.use(express.json());

const PORT =  5000;
const MONGODB_URI = process.env.MONGO_URI || 'mongodb://mongo:27017';
const DB_NAME = process.env.DB_NAME || 'calculator';
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'addition_history';

let historyCollection;

corsOptions = {
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
};
app.use(cors(corsOptions));

/* -------------------- ROUTES -------------------- */

app.post('/add', async (req, res) => {
  try {
    const { a, b } = req.body || {};
    const first = Number(a);
    const second = Number(b);

    if (!Number.isFinite(first) || !Number.isFinite(second)) {
      return res.status(400).json({
        error: 'Both a and b must be valid numbers.',
      });
    }

    const result = first + second;

    const entry = {
      a: first,
      b: second,
      result,
      createdAt: new Date(),
    };

    const insertResult = await historyCollection.insertOne(entry);

    return res.status(200).json({
      result,
      entry: {
        id: insertResult.insertedId.toString(),
        ...entry,
      },
    });
  } catch {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/history', async (_req, res) => {
  try {
    const entries = await historyCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      history: entries.map((item) => ({
        id: item._id.toString(),
        a: item.a,
        b: item.b,
        result: item.result,
        createdAt: item.createdAt,
      })),
    });
  } catch {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found.',
  });
});

/* -------------------- DB CONNECTION -------------------- */

async function connectWithRetry() {
  const client = new MongoClient(MONGODB_URI);

  while (true) {
    try {
      await client.connect();

      const db = client.db(DB_NAME);
      historyCollection = db.collection(COLLECTION_NAME);
      await historyCollection.createIndex({ createdAt: -1 });

      console.log('MongoDB connected');
      return client;

    } catch {
      // Silent retry (no spam)
      await new Promise((res) => setTimeout(res, 5000));
    }
  }
}

/* -------------------- START SERVER -------------------- */

async function startServer() {
  await connectWithRetry();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(() => {
  console.error('Startup failed');
  process.exit(1);
});