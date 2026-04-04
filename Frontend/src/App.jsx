import { useEffect, useState } from 'react';

function App() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch('/api/history');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load history.');
        }

        setHistory(data.history || []);
      } catch (requestError) {
        setError(requestError.message || 'Something went wrong.');
      }
    };

    loadHistory();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          a: Number(a),
          b: Number(b),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process addition.');
      }

      setResult(data.result);
      setHistory((previous) => [data.entry, ...previous]);
    } catch (requestError) {
      setError(requestError.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl border border-gray-800 bg-gray-900 p-6 space-y-6">
        <h1 className="text-2xl font-bold">Addition Calculator !</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="number"
              step="any"
              required
              value={a}
              onChange={(event) => setA(event.target.value)}
              placeholder="First number"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              step="any"
              required
              value={b}
              onChange={(event) => setB(event.target.value)}
              placeholder="Second number"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="rounded-lg bg-blue-600 px-4 py-2 font-semibold hover:bg-blue-500 disabled:opacity-60"
          >
            {isLoading ? 'Adding...' : 'Add'}
          </button>
        </form>

        {result !== null && (
          <p className="text-lg">
            Result: <span className="font-bold">{result}</span>
          </p>
        )}

        {error && <p className="text-red-400">{error}</p>}

        <div>
          <h2 className="text-lg font-semibold mb-2">History</h2>
          {history.length === 0 ? (
            <p className="text-gray-400">No history yet.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((item) => (
                <li key={item.id} className="rounded-lg bg-gray-800 px-3 py-2">
                  {item.a} + {item.b} = {item.result}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;