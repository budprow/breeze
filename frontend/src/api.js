import axios from 'axios';
import { auth } from './firebase';

const isLocal = window.location.hostname === 'localhost';

const api = axios.create({
  // --- THIS IS THE FIX ---
  // When running locally, we now use a relative path. The Vite proxy in
  // vite.config.js will catch this and forward it to http://localhost:3001.
  // When deployed, it will correctly call the production URL.
  baseURL: isLocal
    ? '/api' 
    : 'https://us-central1-breeze-9c703.cloudfunctions.net/api',
});

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