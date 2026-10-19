import React, { useState } from 'react';
import { Shield, ChevronDown, Check, RotateCcw, AlertCircle, Info, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface PersonaSwitcherProps {
  compact?: boolean;
}

export const PersonaSwitcher: React.FC<PersonaSwitcherProps> = ({ compact = false }) => {
  const { user, personas, currentPersonaKey, switchPersona, resetSandbox, isLoading } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetNotification, setResetNotification] = useState<{ text: string; isError: boolean } | null>(null);

  const handleSelect = async (key: string) => {
    setDropdownOpen(false);
    if (key !== currentPersonaKey) {
      await switchPersona(key);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    setResetNotification(null);
    try {
      const msg = await resetSandbox();
      setResetNotification({ text: msg, isError: false });
      setTimeout(() => setResetNotification(null), 4000);
    } catch (err: any) {
      setResetNotification({ text: err.message || 'Reset failed', isError: true });
      setTimeout(() => setResetNotification(null), 5000);
    } finally {
      setIsResetting(false);
    }
  };

  const getRoleBadgeClasses = (role?: string) => {
    switch (role) {
      case 'lead_analyst':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'compliance_officer':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'auditor':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    }
  };

  const activePersona = personas.find((p) => p.key === currentPersonaKey);

  if (compact) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-800/90 text-xs font-medium text-slate-200 hover:border-cyan-500/50 hover:bg-slate-800 transition-all active:scale-[0.98]"
          title="Switch Demo Persona"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-slate-100 max-w-[120px] truncate">{user?.name || 'Analyst'}</span>
          <ChevronDown size={14} className="text-slate-400" />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 border-b border-slate-800">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Demo Security Context</p>
                <p className="text-xs text-slate-400 mt-0.5">Switch personas to test Role-Based Access Control</p>
              </div>
              <div className="py-1 space-y-1">
                {personas.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handleSelect(p.key)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs flex items-start justify-between transition-all ${
                      p.key === currentPersonaKey
                        ? 'bg-cyan-500/10 border border-cyan-500/30 text-white'
                        : 'hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                        {p.name}
                        {p.key === currentPersonaKey && <Check size={12} className="text-cyan-400" />}
                      </div>
                      <div className="text-[11px] text-slate-400">{p.title}</div>
                    </div>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${getRoleBadgeClasses(p.role)}`}>
                      {p.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 border-t border-slate-800 bg-slate-900/40">
      <div className="relative">
        {/* Active Persona Header Box */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 shadow-inner">
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Shield size={13} className="text-cyan-400" />
              <span>RBAC Session</span>
            </span>
            <span
              className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${getRoleBadgeClasses(
                user?.role
              )}`}
            >
              {activePersona?.badge || user?.role || 'Active'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-sm font-bold text-slate-100 truncate">{user?.name || 'Sarah Jenkins'}</p>
              <p className="text-[11px] text-slate-400 truncate">{user?.title || 'Senior Fraud Specialist'}</p>
            </div>

            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              disabled={isLoading}
              className="shrink-0 p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50 active:scale-95 transition-all"
              title="Change Persona"
            >
              <ChevronDown
                size={16}
                className={`transition-transform duration-200 ${dropdownOpen ? 'rotate-180 text-cyan-400' : ''}`}
              />
            </button>
          </div>

          {/* Quick Notice about RBAC testing */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-start gap-1.5 text-[10px] text-slate-400">
            <Info size={12} className="text-cyan-400 shrink-0 mt-0.5" />
            <span>Switch to Auditor to test 403 Forbidden security enforcement.</span>
          </div>
        </div>

        {/* Persona Dropdown Menu */}
        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="absolute left-0 right-0 bottom-full mb-2 rounded-xl bg-slate-900 border border-slate-700/90 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="px-2.5 py-1.5 border-b border-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={12} className="text-cyan-400" />
                  Select Demo Persona
                </span>
              </div>

              <div className="py-1.5 space-y-1.5 max-h-60 overflow-y-auto">
                {personas.map((p) => {
                  const isSelected = p.key === currentPersonaKey;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => handleSelect(p.key)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-cyan-500/10 border-cyan-500/40 text-white shadow-sm'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-slate-100 flex items-center gap-1.5">
                          {p.name}
                          {isSelected && <Check size={13} className="text-cyan-400" />}
                        </span>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${getRoleBadgeClasses(p.role)}`}
                        >
                          {p.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-tight">{p.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Reset Demo Sandbox State Action */}
        <div className="mt-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={isResetting || !user?.permissions?.includes('reset_demo')}
            className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all active:scale-[0.98] ${
              user?.permissions?.includes('reset_demo')
                ? 'border-slate-700/80 bg-slate-950/40 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 hover:bg-slate-800/60'
                : 'border-slate-800 bg-slate-950/20 text-slate-500 cursor-not-allowed'
            }`}
            title={
              user?.permissions?.includes('reset_demo')
                ? 'Restore baseline simulation cases and clear jobs'
                : 'Only Senior Fraud Specialist has permission to reset the demo sandbox'
            }
          >
            <RotateCcw size={13} className={isResetting ? 'animate-spin text-cyan-400' : 'text-slate-400'} />
            <span>{isResetting ? 'Resetting Sandbox...' : 'Reset Demo Sandbox'}</span>
          </button>

          {resetNotification && (
            <div
              className={`mt-2 p-2 rounded-lg border text-[11px] flex items-start gap-1.5 animate-in fade-in ${
                resetNotification.isError
                  ? 'bg-rose-950/70 border-rose-500/40 text-rose-300'
                  : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              }`}
            >
              <AlertCircle
                size={14}
                className={`shrink-0 mt-0.5 ${resetNotification.isError ? 'text-rose-400' : 'text-emerald-400'}`}
              />
              <span>{resetNotification.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
