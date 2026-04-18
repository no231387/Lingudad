import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const TOKEN_STORAGE_KEY = 'linguacards_token';

const readStorage = (key) => {
  try {
    return localStorage.getItem(key) || '';
  } catch (error) {
    console.warn(`Unable to read "${key}" from localStorage:`, error);
    return '';
  }
};

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Unable to write "${key}" to localStorage:`, error);
  }
};

const removeStorage = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Unable to remove "${key}" from localStorage:`, error);
  }
};

const api = axios.create({
  baseURL: API_BASE_URL
});

let dashboardOverviewCache = null;
let dashboardOverviewCacheAt = 0;
let dashboardOverviewRequest = null;
const DASHBOARD_OVERVIEW_TTL_MS = 30_000;

export const getStoredToken = () => readStorage(TOKEN_STORAGE_KEY);

export const setAuthToken = (token) => {
  if (token) {
    writeStorage(TOKEN_STORAGE_KEY, token);
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    removeStorage(TOKEN_STORAGE_KEY);
    delete api.defaults.headers.common.Authorization;
  }
};

export const clearAuthToken = () => {
  setAuthToken('');
  dashboardOverviewCache = null;
  dashboardOverviewCacheAt = 0;
  dashboardOverviewRequest = null;
};

const existingToken = getStoredToken();

if (existingToken) {
  setAuthToken(existingToken);
}

export const registerUser = (data) => api.post('/auth/register', data);
export const loginUser = (data) => api.post('/auth/login', data);
export const getCurrentUser = () => api.get('/auth/me');
export const updateCurrentUser = (data) => api.patch('/auth/me', data);
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
export const recordContentStudyFeedback = (data) => api.post('/study-sessions/content-feedback', data);
export const clearDashboardOverviewCache = () => {
  dashboardOverviewCache = null;
  dashboardOverviewCacheAt = 0;
  dashboardOverviewRequest = null;
};

export const getDashboardOverview = async ({ force = false } = {}) => {
  const now = Date.now();

  if (!force && dashboardOverviewCache && now - dashboardOverviewCacheAt < DASHBOARD_OVERVIEW_TTL_MS) {
    return { data: dashboardOverviewCache };
  }

  if (!force && dashboardOverviewRequest) {
    return dashboardOverviewRequest;
  }

  dashboardOverviewRequest = api.get('/dashboard/overview').then((response) => {
    dashboardOverviewCache = response.data;
    dashboardOverviewCacheAt = Date.now();
    dashboardOverviewRequest = null;
    return response;
  });

  return dashboardOverviewRequest.catch((error) => {
    dashboardOverviewRequest = null;
    throw error;
  });
};
export const getLearningContent = (params = {}) => api.get('/content', { params });
export const getLearningContentById = (id) => api.get(`/content/${id}`);
export const getRecommendedLearningContent = (params = {}) => api.get('/content/recommended', { params });
export const getContentTranscriptSegments = (id) => api.get(`/content/${id}/transcript-segments`);
export const getContentStudyPack = (id) => api.get(`/content/${id}/study-pack`);
export const startContentStudySession = (id) => api.post(`/content/${id}/start-study`);
export const createLearningContent = (data) => api.post('/content', data);
export const createWorkspaceCopyFromContent = (id) => api.post(`/content/${id}/workspace-copy`);
export const saveContentTranscriptSegments = (id, data) => api.post(`/content/${id}/transcript-segments`, data);
export const generateFlashcardsFromContent = (id, data = {}) => api.post(`/content/${id}/generate-flashcards`, data);
export const saveLearningContent = (id) => api.post(`/content/${id}/save`);
export const unsaveLearningContent = (id) => api.delete(`/content/${id}/save`);
export const searchVocabulary = (params = {}) => api.get('/vocabulary/search', { params });
export const getVocabulary = (id) => api.get(`/vocabulary/${id}`);
export const getRecommendedVocabulary = (params = {}) => api.get('/vocabulary/recommended', { params });
export const getLearningPresets = (params = {}) => api.get('/presets', { params });
export const getRecommendedLearningPresets = (params = {}) => api.get('/presets/recommended', { params });
export const searchSentences = (params = {}) => api.get('/sentences/search', { params });
export const getSentence = (id) => api.get(`/sentences/${id}`);
export const getRecommendedSentences = (params = {}) => api.get('/sentences/recommended', { params });
export const getFlashcards = (params = {}) => api.get('/flashcards', { params });
export const shapeStudySessionFlashcards = (data) => api.post('/flashcards/study-shape', data);
export const getCommunityFlashcards = (params = {}) => api.get('/flashcards/community', { params });
export const getDashboardStats = () => api.get('/flashcards/stats');
export const getFlashcard = (id) => api.get(`/flashcards/${id}`);
export const createFlashcard = (data) => api.post('/flashcards', data);
export const createFlashcardFromVocabulary = (id) => api.post(`/flashcards/from-vocabulary/${id}`);
export const createFlashcardFromSentence = (id) => api.post(`/flashcards/from-sentence/${id}`);
export const bulkImportFlashcards = (data) => api.post('/flashcards/import', data);
export const removeDuplicateWords = () => api.delete('/flashcards/duplicates/words');
export const updateFlashcard = (id, data) => api.put(`/flashcards/${id}`, data);
export const deleteFlashcard = (id) => api.delete(`/flashcards/${id}`);
export const updateProficiency = (id, rating) => api.patch(`/flashcards/${id}/proficiency`, { rating });
export const resetFlashcardProficiency = (id) => api.patch(`/flashcards/${id}/reset-proficiency`);
export const reviewFlashcard = (id, rating, meta = {}) => api.patch(`/flashcards/${id}/review`, { rating, ...meta });
export const recordFlashcardStudyFeedback = (id, data) => api.patch(`/flashcards/${id}/study-feedback`, data);
export const createQuizFromVocabulary = (id) => api.post(`/quizzes/from-vocabulary/${id}`);
export const createQuizFromSentence = (id) => api.post(`/quizzes/from-sentence/${id}`);
export const getPlayableQuizItems = (params = {}) => api.get('/quizzes/items', { params });
export const getRecentQuizSessions = (params = {}) => api.get('/quizzes/sessions', { params });
export const launchQuizSession = (data = {}) => api.post('/quizzes/launch', data);
export const getQuizSession = (id) => api.get(`/quizzes/sessions/${id}`);
export const submitQuizAnswer = (id, data) => api.post(`/quizzes/sessions/${id}/answers`, data);
export const completeQuizSession = (id) => api.post(`/quizzes/sessions/${id}/complete`);
