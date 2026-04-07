import { createContext, useContext, useEffect, useState } from 'react';
import {
  clearAuthToken,
  getCurrentUser,
  getStoredToken,
  loginUser,
  registerUser,
  setAuthToken
} from '../services/flashcardService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(getStoredToken());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        setAuthToken(token);
        const { data } = await getCurrentUser();
        setUser(data.user);
      } catch (error) {
        console.error('Failed to restore session:', error);
        clearAuthToken();
        setTokenState('');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, [token]);

  const handleAuthSuccess = ({ token: nextToken, user: nextUser }) => {
    setAuthToken(nextToken);
    setTokenState(nextToken);
    setUser(nextUser);
  };

  const login = async (credentials) => {
    const { data } = await loginUser(credentials);
    handleAuthSuccess(data);
    return data.user;
  };

  const register = async (credentials) => {
    const { data } = await registerUser(credentials);
    handleAuthSuccess(data);
    return data.user;
  };

  const logout = () => {
    clearAuthToken();
    setTokenState('');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: Boolean(user),
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
