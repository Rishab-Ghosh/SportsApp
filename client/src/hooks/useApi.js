import { useState, useEffect, useRef } from 'react';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

export function useApi(path, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [slow, setSlow] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setSlow(false);

    const slowTimer = setTimeout(() => setSlow(true), 2000);

    fetch(`${BASE}${path}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { clearTimeout(slowTimer); setSlow(false); setData(d); setLoading(false); })
      .catch(e => {
        clearTimeout(slowTimer);
        if (e.name !== 'AbortError') { setError(e.message); setLoading(false); }
      });

    return () => { clearTimeout(slowTimer); controller.abort(); };
  }, deps); // eslint-disable-line

  return { data, loading, error, slow };
}
