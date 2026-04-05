const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const PORT =  5000;
const MONGODB_URI = process.env.MONGO_URI
const DB_NAME = process.env.DB_NAME ;
const COLLECTION_NAME = process.env.COLLECTION_NAME ;

const checkEnvVars = () => {
  const requiredVars = ['MONGO_URI', 'DB_NAME', 'COLLECTION_NAME'];
  const missingVars = requiredVars.filter((varName) => !process.env[varName]);  
  if (missingVars.length > 0) {
    console.error(`Error: Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
  }
};


let historyCollection;

const ALLOWED_OPERATIONS = new Set(['+', '-', '*', '/', '%', '^']);

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type'],
};

function mapHistoryItem(item) {
  return {
    id: item._id.toString(),
    a: item.a,
    b: item.b,
    operation: item.operation,
    expression: item.expression,
    result: item.result,
    createdAt: item.createdAt,
  };
}

function validateNumber(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return {
      error: `${fieldName} must be a valid number.`,
    };
  }

  return { value: parsed };
}

function compute(a, b, operation) {
  switch (operation) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      if (b === 0) {
        return { error: 'Cannot divide by zero.' };
      }
      return a / b;
    case '%':
      if (b === 0) {
        return { error: 'Cannot use modulo with zero.' };
      }
      return a % b;
    case '^':
      return a ** b;
    default:
      return { error: `Unsupported operation: ${operation}` };
  }
}

async function persistCalculation(collection, a, b, operation, result) {
  const entry = {
    a,
    b,
    operation,
    expression: `${a} ${operation} ${b}`,
    result,
    createdAt: new Date(),
  };

  const insertResult = await collection.insertOne(entry);

  return {
    id: insertResult.insertedId.toString(),
    ...entry,
  };
}

/* -------------------- ROUTES -------------------- */

function createApp({ historyCollectionProvider } = {}) {
  const app = express();
  app.use(express.json());
  app.use(cors(corsOptions));

  const getCollection = historyCollectionProvider || (() => historyCollection);

  function requireCollection() {
    const collection = getCollection();

    if (!collection) {
      throw new Error('History collection is not initialized.');
    }

    return collection;
  }

  app.post('/add', async (req, res) => {
    try {
      const { a, b } = req.body || {};
      const firstParsed = validateNumber(a, 'a');
      const secondParsed = validateNumber(b, 'b');

      if (firstParsed.error || secondParsed.error) {
        return res.status(400).json({
          error: firstParsed.error || secondParsed.error,
        });
      }

      const first = firstParsed.value;
      const second = secondParsed.value;
      const result = compute(first, second, '+');
      const collection = requireCollection();
      const entry = await persistCalculation(collection, first, second, '+', result);

      return res.status(200).json({
        result,
        entry,
      });
    } catch {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/calculate', async (req, res) => {
    try {
      const { a, b, operation } = req.body || {};
      const firstParsed = validateNumber(a, 'a');
      const secondParsed = validateNumber(b, 'b');

      if (firstParsed.error || secondParsed.error) {
        return res.status(400).json({
          error: firstParsed.error || secondParsed.error,
        });
      }

      if (!ALLOWED_OPERATIONS.has(operation)) {
        return res.status(400).json({
          error: 'Operation must be one of +, -, *, /, %, ^.',
        });
      }

      const first = firstParsed.value;
      const second = secondParsed.value;
      const result = compute(first, second, operation);

      if (typeof result === 'object' && result.error) {
        return res.status(400).json(result);
      }

      const collection = requireCollection();
      const entry = await persistCalculation(collection, first, second, operation, result);

      return res.status(200).json({
        result,
        entry,
      });
    } catch {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/history', async (_req, res) => {
    try {
      const collection = requireCollection();
      const entries = await collection
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      return res.status(200).json({
        history: entries.map(mapHistoryItem),
      });
    } catch {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.delete('/history', async (_req, res) => {
    try {
      const collection = requireCollection();
      const deleteResult = await collection.deleteMany({});

      return res.status(200).json({
        deletedCount: deleteResult.deletedCount,
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

  return app;
}

const app = createApp();

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
  checkEnvVars();
  await connectWithRetry();

  app.listen(PORT,"0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (require.main === module) {
  startServer().catch(() => {
    console.error('Startup failed');
    process.exit(1);
  });
}

module.exports = {
  createApp,
  startServer,
  connectWithRetry,
  compute,
  validateNumber,
  mapHistoryItem,
  ALLOWED_OPERATIONS,
};