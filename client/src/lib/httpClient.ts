import axios, { AxiosError } from 'axios';

export const AUTH_TOKEN_KEY = 'spacex_vod_token';

export const httpClient = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

httpClient.interceptors.request.use((config) => {
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }
    if (error instanceof AxiosError) {
      const serverMessage = (
        error.response?.data as { error?: string } | undefined
      )?.error;
      const message =
        serverMessage ||
        error.message ||
        `HTTP Error ${error.response?.status ?? ''}`.trim();
      return Promise.reject(new Error(message));
    }
    return Promise.reject(
      error instanceof Error ? error : new Error('Unexpected network error')
    );
  }
);
