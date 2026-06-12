import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import DashboardCiudadano from './components/DashboardCiudadano';
import './App.css';

const DashboardAdmin = () => ( <div style={{ textAlign: 'center', marginTop: '50px' }}><h1>⚙️ Panel Admin</h1></div> );

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta principal ahora es el Landing Page */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Login y Dashboards */}
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/ciudadano" element={<DashboardCiudadano />} />
        <Route path="/admin" element={<DashboardAdmin />} />

        {/* Cualquier ruta inventada manda al inicio */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;