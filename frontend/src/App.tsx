import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';

// Route-based code splitting for minimal initial bundle size
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Transactions = lazy(() => import('./pages/Transactions').then((m) => ({ default: m.Transactions })));
const Investigation = lazy(() => import('./pages/Investigation').then((m) => ({ default: m.Investigation })));
const Network = lazy(() => import('./pages/Network').then((m) => ({ default: m.Network })));
const RiskAssessment = lazy(() => import('./pages/RiskAssessment').then((m) => ({ default: m.RiskAssessment })));
const ModelLab = lazy(() => import('./pages/ModelLab').then((m) => ({ default: m.ModelLab })));
const SystemHealth = lazy(() => import('./pages/SystemHealth').then((m) => ({ default: m.SystemHealth })));

function PageLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
      <div className="w-8 h-8 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
      <span className="text-xs uppercase tracking-widest text-slate-500 font-mono">Loading module...</span>
    </div>
  );
}

export function App() {
  return (
    <LanguageProvider defaultLanguage="en">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route
                index
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <Dashboard />
                  </Suspense>
                }
              />
              <Route
                path="transactions"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <Transactions />
                  </Suspense>
                }
              />
              <Route
                path="investigation"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <Investigation />
                  </Suspense>
                }
              />
              <Route
                path="investigation/:transactionId"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <Investigation />
                  </Suspense>
                }
              />
              <Route
                path="network"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <Network />
                  </Suspense>
                }
              />
              <Route
                path="network/:entityType/:entityId"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <Network />
                  </Suspense>
                }
              />
              <Route
                path="assessment"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <RiskAssessment />
                  </Suspense>
                }
              />
              <Route
                path="model-lab"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <ModelLab />
                  </Suspense>
                }
              />
              <Route
                path="health"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <SystemHealth />
                  </Suspense>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
