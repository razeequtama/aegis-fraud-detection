import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically attach Bearer token from localStorage to every outbound request
apiClient.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem('aegis_demo_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Ignore localStorage access failures (e.g. strict sandbox)
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle auth events
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      try {
        localStorage.removeItem('aegis_demo_token');
      } catch {
        // Ignore
      }
    }
    return Promise.reject(error);
  }
);