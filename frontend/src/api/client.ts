import axios from 'axios';

/**
 * Resolves the backend API base URL supporting both documented variable conventions:
 * 1. VITE_API_BASE_URL (explicit full/relative base endpoint, e.g. 'http://localhost:8000/api/v1' or '/api/v1')
 * 2. VITE_BACKEND_URL (host-level URL documented in .env.example, e.g. 'http://backend:8000') -> appends '/api/v1'
 * 3. Default relative proxy path '/api/v1' (works with both Vite dev server proxy and Nginx reverse proxy)
 */
export const getApiBaseUrl = (): string => {
  const customApiUrl = import.meta.env.VITE_API_BASE_URL;
  if (customApiUrl && typeof customApiUrl === 'string' && customApiUrl.trim()) {
    return customApiUrl.trim();
  }

  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  if (backendUrl && typeof backendUrl === 'string' && backendUrl.trim()) {
    const trimmed = backendUrl.trim().replace(/\/+$/, '');
    return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
  }

  return '/api/v1';
};

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
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