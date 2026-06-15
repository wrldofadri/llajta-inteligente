import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import DashboardCiudadano from './components/DashboardCiudadano';
import DashboardGestion from './components/DashboardGestion';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/ciudadano" element={<ProtectedRoute roles={[1]}><DashboardCiudadano /></ProtectedRoute>} />
        <Route path="/operador" element={<ProtectedRoute roles={[2]}><DashboardGestion /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute roles={[3]}><DashboardGestion /></ProtectedRoute>} />
        <Route path="/supervisor" element={<ProtectedRoute roles={[4]}><DashboardGestion /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
