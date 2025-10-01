import { useEffect, useRef } from 'react';

// Create a custom hook to track the previous value of a variable.
export function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
};