import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ roles, children }) => {
  const token = localStorage.getItem('token');
  const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');

  if (!token || !usuario) return <Navigate to="/auth" replace />;
  if (roles && !roles.includes(Number(usuario.rol))) return <Navigate to="/auth" replace />;
  return children;
};

export default ProtectedRoute;
