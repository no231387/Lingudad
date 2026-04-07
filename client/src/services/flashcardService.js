import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const TOKEN_STORAGE_KEY = 'linguacards_token';

const api = axios.create({
  baseURL: API_BASE_URL
});

export const getStoredToken = () => localStorage.getItem(TOKEN_STORAGE_KEY) || '';

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    delete api.defaults.headers.common.Authorization;
  }
};

export const clearAuthToken = () => {
  setAuthToken('');
};

const existingToken = getStoredToken();

if (existingToken) {
  setAuthToken(existingToken);
}

export const registerUser = (data) => api.post('/auth/register', data);
export const loginUser = (data) => api.post('/auth/login', data);
export const getCurrentUser = () => api.get('/auth/me');
export const getDecks = () => api.get('/decks');
export const getOfficialBeginnerDecks = () => api.get('/decks/official-beginner');
export const getOfficialBeginnerDeckFlashcards = (id) => api.get(`/decks/official-beginner/${id}/flashcards`);
export const createDeck = (data) => api.post('/decks', data);
export const updateDeck = (id, data) => api.put(`/decks/${id}`, data);
export const deleteDeck = (id) => api.delete(`/decks/${id}`);
export const addFlashcardsToDeck = (id, flashcardIds) => api.post(`/decks/${id}/flashcards`, { flashcardIds });
export const resetDeckProficiency = (id) => api.patch(`/decks/${id}/reset-proficiency`);
export const importDeckToOfficialBeginnerDeck = (id) => api.post(`/decks/${id}/import-to-official-beginner`);
export const createOfficialBeginnerDeck = (data) => api.post('/decks/official-beginner', data);
export const updateOfficialBeginnerDeck = (id, data) => api.put(`/decks/official-beginner/${id}`, data);
export const deleteOfficialBeginnerDeck = (id) => api.delete(`/decks/official-beginner/${id}`);
export const getTags = () => api.get('/tags');
export const createTag = (data) => api.post('/tags', data);
export const getStudySessions = () => api.get('/study-sessions');
export const createStudySession = (data) => api.post('/study-sessions', data);
export const deleteStudySession = (id) => api.delete(`/study-sessions/${id}`);
export const getFlashcards = (params = {}) => api.get('/flashcards', { params });
export const getCommunityFlashcards = (params = {}) => api.get('/flashcards/community', { params });
export const getDashboardStats = () => api.get('/flashcards/stats');
export const getFlashcard = (id) => api.get(`/flashcards/${id}`);
export const createFlashcard = (data) => api.post('/flashcards', data);
export const bulkImportFlashcards = (data) => api.post('/flashcards/import', data);
export const removeDuplicateWords = () => api.delete('/flashcards/duplicates/words');
export const updateFlashcard = (id, data) => api.put(`/flashcards/${id}`, data);
export const deleteFlashcard = (id) => api.delete(`/flashcards/${id}`);
export const updateProficiency = (id, rating) => api.patch(`/flashcards/${id}/proficiency`, { rating });
export const resetFlashcardProficiency = (id) => api.patch(`/flashcards/${id}/reset-proficiency`);
export const reviewFlashcard = (id, rating) => api.patch(`/flashcards/${id}/review`, { rating });
