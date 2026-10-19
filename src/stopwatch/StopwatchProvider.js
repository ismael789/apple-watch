/* eslint-disable react/prop-types */
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

const StopwatchContext = createContext(null);

export const StopwatchProvider = ({ children }) => {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState([]);
  const [view, setView] = useState('digital');
  const startedAt = useRef(0);
  const base = useRef(0);

  useEffect(() => {
    if (!running) return undefined;
    const update = () =>
      setElapsed(base.current + (Date.now() - startedAt.current) / 1000);
    update();
    const interval = setInterval(update, 50);
    return () => clearInterval(interval);
  }, [running]);

  const toggle = () => {
    if (running) base.current = elapsed;
    else startedAt.current = Date.now();
    setRunning(value => !value);
  };

  const lap = () => {
    if (!running) return;
    setLaps(value => [{ id: String(Date.now()), time: elapsed }, ...value]);
  };

  const reset = () => {
    setRunning(false);
    setElapsed(0);
    base.current = 0;
    setLaps([]);
  };

  return (
    <StopwatchContext.Provider
      value={{ elapsed, running, laps, view, setView, toggle, lap, reset }}
    >
      {children}
    </StopwatchContext.Provider>
  );
};

export const useStopwatch = () => {
  const value = useContext(StopwatchContext);
  if (!value) throw new Error('useStopwatch requiere StopwatchProvider');
  return value;
};
