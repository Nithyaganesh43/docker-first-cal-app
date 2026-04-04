const request = require('supertest');
const { createApp } = require('../index');

function createInMemoryCollection() {
  let counter = 0;
  let rows = [];

  return {
    async insertOne(entry) {
      counter += 1;
      const saved = { ...entry, _id: String(counter) };
      rows.push(saved);
      return { insertedId: saved._id };
    },
    find() {
      return {
        sort() {
          return {
            async toArray() {
              return [...rows].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              );
            },
          };
        },
      };
    },
    async deleteMany() {
      const deletedCount = rows.length;
      rows = [];
      return { deletedCount };
    },
  };
}

describe('Calculator API', () => {
  let collection;
  let app;

  beforeEach(() => {
    collection = createInMemoryCollection();
    app = createApp({ historyCollectionProvider: () => collection });
  });

  test('POST /add stores and returns a sum', async () => {
    const response = await request(app).post('/add').send({ a: 4, b: 5 });

    expect(response.status).toBe(200);
    expect(response.body.result).toBe(9);
    expect(response.body.entry).toMatchObject({
      a: 4,
      b: 5,
      operation: '+',
      expression: '4 + 5',
      result: 9,
    });
    expect(response.body.entry.id).toBeDefined();
  });

  test('POST /add validates invalid numbers', async () => {
    const response = await request(app).post('/add').send({ a: 'foo', b: 2 });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/must be a valid number/i);
  });

  test.each([
    ['+', 7, 3, 10],
    ['-', 7, 3, 4],
    ['*', 7, 3, 21],
    ['/', 7, 2, 3.5],
    ['%', 7, 3, 1],
    ['^', 2, 3, 8],
  ])('POST /calculate handles %s', async (operation, a, b, expected) => {
    const response = await request(app).post('/calculate').send({ a, b, operation });

    expect(response.status).toBe(200);
    expect(response.body.result).toBe(expected);
    expect(response.body.entry).toMatchObject({
      a,
      b,
      operation,
      expression: `${a} ${operation} ${b}`,
      result: expected,
    });
  });

  test('POST /calculate rejects unsupported operation', async () => {
    const response = await request(app)
      .post('/calculate')
      .send({ a: 4, b: 2, operation: 'x' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Operation must be one of +, -, *, /, %, ^.');
  });

  test('POST /calculate rejects divide by zero', async () => {
    const response = await request(app)
      .post('/calculate')
      .send({ a: 10, b: 0, operation: '/' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Cannot divide by zero.');
  });

  test('POST /calculate rejects modulo by zero', async () => {
    const response = await request(app)
      .post('/calculate')
      .send({ a: 10, b: 0, operation: '%' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Cannot use modulo with zero.');
  });

  test('GET /history returns persisted entries in newest-first order', async () => {
    await request(app).post('/calculate').send({ a: 2, b: 5, operation: '+' });
    await request(app).post('/calculate').send({ a: 9, b: 3, operation: '-' });

    const response = await request(app).get('/history');

    expect(response.status).toBe(200);
    expect(response.body.history).toHaveLength(2);
    expect(response.body.history[0]).toMatchObject({ expression: '9 - 3', result: 6 });
    expect(response.body.history[1]).toMatchObject({ expression: '2 + 5', result: 7 });
  });

  test('DELETE /history clears all rows', async () => {
    await request(app).post('/add').send({ a: 1, b: 1 });
    await request(app).post('/calculate').send({ a: 3, b: 2, operation: '*' });

    const deleteResponse = await request(app).delete('/history');
    const historyResponse = await request(app).get('/history');

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.deletedCount).toBe(2);
    expect(historyResponse.body.history).toHaveLength(0);
  });

  test('returns 404 for unknown routes', async () => {
    const response = await request(app).get('/unknown-endpoint');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Endpoint not found.');
  });
});
