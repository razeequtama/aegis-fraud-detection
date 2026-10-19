import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// NOTE: In production banking systems, authentication tokens should reside in HttpOnly,
// Secure, SameSite=Lax cookies to prevent JavaScript access and mitigate XSS exfiltration.
// In this portfolio simulation playground, tokens are stored in sessionStorage (tab-scoped)
// with graceful fallback to localStorage to enable instant persona switching.
apiClient.interceptors.request.use(
  (config) => {
    try {
      const token =
        sessionStorage.getItem('aegis_demo_token') ||
        localStorage.getItem('aegis_demo_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Ignore storage access failures (e.g. strict sandbox)
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
        sessionStorage.removeItem('aegis_demo_token');
        localStorage.removeItem('aegis_demo_token');
      } catch {
        // Ignore
      }
    }
    return Promise.reject(error);
  }
);