import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getApiBaseUrl } from './client';

describe('getApiBaseUrl', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns default /api/v1 when no env vars are defined', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('VITE_BACKEND_URL', '');
    expect(getApiBaseUrl()).toBe('/api/v1');
  });

  it('prioritizes VITE_API_BASE_URL if set', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com/api/v1');
    vi.stubEnv('VITE_BACKEND_URL', 'http://localhost:8000');
    expect(getApiBaseUrl()).toBe('https://api.example.com/api/v1');
  });

  it('formats VITE_BACKEND_URL by appending /api/v1 when not present', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('VITE_BACKEND_URL', 'http://localhost:8000');
    expect(getApiBaseUrl()).toBe('http://localhost:8000/api/v1');
  });

  it('preserves /api/v1 suffix in VITE_BACKEND_URL if already present', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('VITE_BACKEND_URL', 'http://localhost:8000/api/v1/');
    expect(getApiBaseUrl()).toBe('http://localhost:8000/api/v1');
  });
});

