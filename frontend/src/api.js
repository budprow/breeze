import axios from 'axios';
import { auth } from './firebase';

const isLocal = window.location.hostname === 'localhost';

const api = axios.create({
  baseURL: isLocal
    ? 'http://127.0.0.1:5001/breeze-9c703/us-central1/api' // Your local emulator URL
    : 'https://us-central1-breeze-9c703.cloudfunctions.net/api', // Your live production URL
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