import { useEffect, useMemo, useState } from 'react';
import './App.css';

const DIGITS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0'];
const OPERATIONS = ['+', '-', '*', '/', '%', '^'];

function App() {
  const [left, setLeft] = useState('0');
  const [right, setRight] = useState('');
  const [operation, setOperation] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState('');

  const expression = useMemo(() => {
    return [left, operation, right].filter(Boolean).join(' ');
  }, [left, operation, right]);

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const response = await fetch('/api/history');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Unable to load history.');
        }

        setHistory(data.history || []);
      } catch (requestError) {
        setError(requestError.message || 'Something went wrong.');
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchHistory();
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (DIGITS.includes(event.key)) {
        pushDigit(event.key);
        return;
      }

      if (event.key === '.') {
        pushDecimal();
        return;
      }

      if (OPERATIONS.includes(event.key)) {
        chooseOperation(event.key);
        return;
      }

      if (event.key === 'Enter' || event.key === '=') {
        event.preventDefault();
        void calculate();
        return;
      }

      if (event.key === 'Backspace') {
        popDigit();
        return;
      }

      if (event.key.toLowerCase() === 'c' || event.key === 'Escape') {
        clearAll();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const pushDigit = (digit) => {
    setError('');

    if (!operation) {
      setLeft((previous) => (previous === '0' ? digit : `${previous}${digit}`));
      return;
    }

    setRight((previous) => (previous === '0' ? digit : `${previous}${digit}`));
  };

  const pushDecimal = () => {
    setError('');

    if (!operation) {
      setLeft((previous) => {
        if (previous.includes('.')) return previous;
        return `${previous}.`;
      });
      return;
    }

    setRight((previous) => {
      if (previous.includes('.')) return previous;
      if (!previous) return '0.';
      return `${previous}.`;
    });
  };

  const chooseOperation = (nextOperation) => {
    setError('');

    if (!left) {
      return;
    }

    if (right) {
      void calculate(nextOperation);
      return;
    }

    setOperation(nextOperation);
  };

  const clearAll = () => {
    setLeft('0');
    setRight('');
    setOperation('');
    setResult(null);
    setError('');
  };

  const popDigit = () => {
    setError('');

    if (right) {
      setRight((previous) => previous.slice(0, -1));
      return;
    }

    if (operation) {
      setOperation('');
      return;
    }

    setLeft((previous) => {
      const sliced = previous.slice(0, -1);
      return sliced || '0';
    });
  };

  const calculate = async (chainedOperation = '') => {
    if (!operation || right === '') {
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          a: Number(left),
          b: Number(right),
          operation,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Calculation failed.');
      }

      const nextValue = String(data.result);
      setResult(data.result);
      setLeft(nextValue);
      setRight('');
      setOperation(chainedOperation);
      setHistory((previous) => [data.entry, ...previous]);
    } catch (requestError) {
      setError(requestError.message || 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearHistory = async () => {
    try {
      const response = await fetch('/api/history', {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to clear history.');
      }

      setHistory([]);
    } catch (requestError) {
      setError(requestError.message || 'Something went wrong.');
    }
  };

  return (
    <main className="app-shell">
      <div className="aurora" aria-hidden="true" />
      <section className="calculator-card">
        <header className="calculator-head">
          <h1>FluxCalc</h1>
          <p>Full-stack precision calculator</p>
        </header>

        <div className="display" role="status" aria-live="polite">
          <p className="display-expression">{expression || '0'}</p>
          <p className="display-result">{result !== null ? result : left}</p>
        </div>

        <div className="keypad" role="group" aria-label="Calculator keypad">
          <button onClick={clearAll} className="key action">C</button>
          <button onClick={popDigit} className="key action">DEL</button>
          <button onClick={() => chooseOperation('%')} className="key operator">%</button>
          <button onClick={() => chooseOperation('/')} className="key operator">/</button>

          {DIGITS.slice(0, 9).map((digit) => (
            <button key={digit} onClick={() => pushDigit(digit)} className="key">
              {digit}
            </button>
          ))}

          <button onClick={() => chooseOperation('*')} className="key operator">*</button>
          <button onClick={() => chooseOperation('-')} className="key operator">-</button>
          <button onClick={() => chooseOperation('+')} className="key operator">+</button>
          <button onClick={() => chooseOperation('^')} className="key operator">^</button>

          <button onClick={() => pushDigit('0')} className="key key-zero">0</button>
          <button onClick={pushDecimal} className="key">.</button>
          <button
            onClick={() => void calculate()}
            className="key equals"
            disabled={isSubmitting}
          >
            {isSubmitting ? '...' : '='}
          </button>
        </div>

        {error ? <p className="error-banner">{error}</p> : null}
      </section>

      <aside className="history-card">
        <div className="history-head">
          <h2>Recent Calculations</h2>
          <button onClick={clearHistory} className="clear-history">Clear</button>
        </div>

        {isLoadingHistory ? <p className="history-empty">Loading history...</p> : null}

        {!isLoadingHistory && history.length === 0 ? (
          <p className="history-empty">No calculations yet. Try: 16 ^ 2</p>
        ) : null}

        <ul className="history-list">
          {history.map((item) => (
            <li key={item.id}>
              <button
                className="history-item"
                onClick={() => {
                  setLeft(String(item.result));
                  setRight('');
                  setOperation('');
                  setResult(item.result);
                  setError('');
                }}
              >
                <span>{item.expression}</span>
                <strong>= {item.result}</strong>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}

export default App;