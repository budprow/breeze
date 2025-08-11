import axios from 'axios';
import { auth } from './firebase';

// --- THIS IS THE FIX ---
// We remove the baseURL. All API calls in the components will now
// use the full path (e.g., '/api/generate-quiz'), which works reliably
// with Vite's proxy and the deployed functions URL.
const api = axios.create();

// This automatically adds the user's auth token to every request
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    // Force a refresh of the token to make sure it's not expired
    const token = await user.getIdToken(true);
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;
