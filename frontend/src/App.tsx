import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Transactions } from './pages/Transactions';
import { Investigation } from './pages/Investigation';
import { Network } from './pages/Network';
import { RiskAssessment } from './pages/RiskAssessment';
import { ModelLab } from './pages/ModelLab';
import { SystemHealth } from './pages/SystemHealth';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="investigation" element={<Investigation />} />
          <Route path="investigation/:transactionId" element={<Investigation />} />
          <Route path="network" element={<Network />} />
          <Route path="assessment" element={<RiskAssessment />} />
          <Route path="model-lab" element={<ModelLab />} />
          <Route path="health" element={<SystemHealth />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;