import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const BASE = Constants?.expoConfig?.extra?.apiUrl || process.env.API_URL || 'https://parko-api.onrender.com/api';

export const api = axios.create({ baseURL: BASE, timeout: 15000 });
api.interceptors.request.use(async (cfg) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
export const saveTokens = (a, r) => Promise.all([SecureStore.setItemAsync('accessToken', a), SecureStore.setItemAsync('refreshToken', r || '')]);
export const clearTokens = () => Promise.all([SecureStore.deleteItemAsync('accessToken'), SecureStore.deleteItemAsync('refreshToken')]);
