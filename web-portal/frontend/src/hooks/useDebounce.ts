/**
 * @fileoverview React hook for debouncing values to prevent excessive API calls
 * @lastmodified 2025-08-28T10:30:00Z
 * 
 * Features: Value debouncing with configurable delay, cleanup on unmount
 * Main APIs: useDebounce hook
 * Constraints: None
 * Patterns: setTimeout/clearTimeout with dependency array
 */

import { useState, useEffect } from 'react';

/**
 * Debounce a value to prevent excessive updates/API calls
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300)
 * @returns The debounced value
 */
export const useDebounce = <T>(value: T, delay: number = 300): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set debounced value after delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup timeout if value changes before delay completes
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};