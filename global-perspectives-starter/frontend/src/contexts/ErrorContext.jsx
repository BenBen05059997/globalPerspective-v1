import { createContext, useContext, useState } from 'react';

const ErrorContext = createContext({
  error: null,
  showError: () => {},
  clearError: () => {},
});

export function ErrorProvider({ children }) {
  const [error, setError] = useState(null);

  const showError = (message, title = null) => {
    setError({ message, title });
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <ErrorContext.Provider value={{ error, showError, clearError }}>
      {children}
    </ErrorContext.Provider>
  );
}

export function useError() {
  return useContext(ErrorContext);
}
