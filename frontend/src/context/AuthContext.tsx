import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';

export interface PersonaInfo {
  key: string;
  name: string;
  title: string;
  badge: string;
  badge_color: string;
  role: string;
  avatar: string;
  permissions: string[];
  description: string;
}

export interface UserSession {
  user_id: string;
  username: string;
  name: string;
  title: string;
  role: string;
  persona_key: string;
  permissions: string[];
  badge?: string;
  badge_color?: string;
}

interface AuthContextType {
  user: UserSession | null;
  personas: PersonaInfo[];
  currentPersonaKey: string;
  isLoading: boolean;
  switchPersona: (personaKey: string) => Promise<void>;
  resetSandbox: () => Promise<string>;
  hasPermission: (permission: string) => boolean;
}

const DEFAULT_PERSONAS: PersonaInfo[] = [
  {
    key: 'senior_analyst',
    name: 'Sarah Jenkins',
    title: 'Senior Fraud Specialist',
    badge: 'Full Access (RBAC)',
    badge_color: 'emerald',
    role: 'lead_analyst',
    avatar: 'SJ',
    permissions: ['view', 'edit_case', 'label_feedback', 'run_replay', 'reset_demo'],
    description: 'Full authorization to review cases, submit ground truth feedback, trigger simulations, and reset demo state.',
  },
  {
    key: 'compliance_officer',
    name: 'Alex Chen',
    title: 'AML & Compliance Officer',
    badge: 'Review & Replay',
    badge_color: 'blue',
    role: 'compliance_officer',
    avatar: 'AC',
    permissions: ['view', 'edit_case', 'run_replay'],
    description: 'Authorized to review cases and trigger historical replay simulations. Cannot label ground truth feedback.',
  },
  {
    key: 'auditor_readonly',
    name: 'Guest Auditor',
    title: 'External Systems Auditor',
    badge: 'Read Only (Auditor)',
    badge_color: 'amber',
    role: 'auditor',
    avatar: 'GA',
    permissions: ['view'],
    description: 'Read-only visibility for security verification. Modifications return HTTP 403 Forbidden.',
  },
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [personas, setPersonas] = useState<PersonaInfo[]>(DEFAULT_PERSONAS);
  const [user, setUser] = useState<UserSession | null>(null);
  const [currentPersonaKey, setCurrentPersonaKey] = useState<string>('senior_analyst');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch list of personas from backend
  const loadPersonas = useCallback(async () => {
    try {
      const res = await apiClient.get<PersonaInfo[]>('/auth/personas');
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setPersonas(res.data);
      }
    } catch {
      // Use fallback default personas if backend is still starting
    }
  }, []);

  // Perform 1-click login for a selected persona
  const switchPersona = useCallback(async (personaKey: string) => {
    setIsLoading(true);
    try {
      const res = await apiClient.post<{
        access_token: string;
        token_type: string;
        user: UserSession;
      }>('/auth/demo-login', { persona: personaKey });

      const { access_token, user: sessionUser } = res.data;
      sessionStorage.setItem('aegis_demo_token', access_token);
      sessionStorage.setItem('aegis_active_persona', personaKey);
      localStorage.removeItem('aegis_demo_token'); // Clean up any persistent token
      localStorage.setItem('aegis_active_persona', personaKey);

      // Attach badge styling from personas list
      const matchedPersona = DEFAULT_PERSONAS.find((p) => p.key === personaKey);
      setUser({
        ...sessionUser,
        badge: matchedPersona?.badge,
        badge_color: matchedPersona?.badge_color,
      });
      setCurrentPersonaKey(personaKey);
    } catch (err) {
      console.error('Failed to switch persona:', err);
      // Fallback local mock user if offline
      const fallback = DEFAULT_PERSONAS.find((p) => p.key === personaKey) || DEFAULT_PERSONAS[0];
      setUser({
        user_id: `USR-${fallback.key.toUpperCase()}`,
        username: fallback.key,
        name: fallback.name,
        title: fallback.title,
        role: fallback.role,
        persona_key: fallback.key,
        permissions: fallback.permissions,
        badge: fallback.badge,
        badge_color: fallback.badge_color,
      });
      setCurrentPersonaKey(personaKey);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Trigger demo reset
  const resetSandbox = useCallback(async (): Promise<string> => {
    try {
      const res = await apiClient.post<{ message: string }>('/system/reset-demo');
      return res.data?.message || 'Demo state reset successfully.';
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || err?.message || 'Failed to reset demo state';
      throw new Error(errMsg);
    }
  }, []);

  // Permission check helper
  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      return user.permissions?.includes(permission) ?? false;
    },
    [user]
  );

  // Initial load: restore token or default auto-login to senior_analyst
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      await loadPersonas();

      const savedToken =
        sessionStorage.getItem('aegis_demo_token') ||
        localStorage.getItem('aegis_demo_token');
      const savedPersona =
        sessionStorage.getItem('aegis_active_persona') ||
        localStorage.getItem('aegis_active_persona') ||
        'senior_analyst';

      if (savedToken) {
        try {
          const res = await apiClient.get<{ user: UserSession }>('/auth/me');
          if (mounted && res.data?.user) {
            const u = res.data.user;
            const matchedPersona = DEFAULT_PERSONAS.find((p) => p.key === u.persona_key);
            setUser({
              ...u,
              badge: matchedPersona?.badge,
              badge_color: matchedPersona?.badge_color,
            });
            setCurrentPersonaKey(u.persona_key || savedPersona);
            setIsLoading(false);
            return;
          }
        } catch {
          // Token expired or invalid, auto-login below
          sessionStorage.removeItem('aegis_demo_token');
          localStorage.removeItem('aegis_demo_token');
        }
      }

      // Auto-login to senior_analyst for zero-friction visitor experience
      if (mounted) {
        await switchPersona(savedPersona);
      }
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, [loadPersonas, switchPersona]);

  return (
    <AuthContext.Provider
      value={{
        user,
        personas,
        currentPersonaKey,
        isLoading,
        switchPersona,
        resetSandbox,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

