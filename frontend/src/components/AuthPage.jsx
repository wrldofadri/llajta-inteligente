import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2'; // <-- Importamos los nuevos modales
import fondoCristo from '../assets/cristo-fondo.jpg';
import logoMap from '../assets/Logo.png';

const AuthPage = () => {
    const [isLogin, setIsLogin] = useState(true);
    const navigate = useNavigate();
    
    const [correo, setCorreo] = useState('');
    const [contrasena, setContrasena] = useState('');
    const [nombre_completo, setNombre] = useState('');

    const togglePanel = () => setIsLogin(!isLogin);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const respuesta = await axios.post('http://localhost:3000/api/auth/login', { correo, contrasena });
            
            // Modal de Éxito Moderno
            Swal.fire({
                icon: 'success',
                title: '¡Bienvenido!',
                text: 'Hola ' + respuesta.data.usuario.nombre,
                timer: 2000,
                showConfirmButton: false
            });
            
            localStorage.setItem('token', respuesta.data.token);
            const rolUsuario = respuesta.data.usuario.rol;
            
            if (rolUsuario === 1) navigate('/ciudadano');
            else if (rolUsuario === 3) navigate('/admin');
            else navigate('/ciudadano');
            
        } catch (error) {
            // Modal de Error Moderno
            Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: error.response?.data?.error || 'Credenciales incorrectas',
                confirmButtonColor: '#38B6FF'
            });
        }
    };

    const handleRegistro = async (e) => {
        e.preventDefault();
        try {
            await axios.post('http://localhost:3000/api/auth/registro', { nombre_completo, correo, contrasena, id_rol: 1 });
            
            Swal.fire({
                icon: 'success',
                title: '¡Cuenta creada!',
                text: 'Ya puedes iniciar sesión.',
                timer: 2000,
                showConfirmButton: false
            });
            
            setNombre('');
            setIsLogin(true); 
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error al registrar',
                text: error.response?.data?.error || 'Error desconocido',
                confirmButtonColor: '#38B6FF'
            });
        }
    };

    return (
        <div className="login-page-container">
            <div className="background-blur" style={{ backgroundImage: `url(${fondoCristo})` }}></div>
            
            <div className={`auth-container ${isLogin ? '' : 'right-panel-active'}`}>
                
                {/* --- FORMULARIO DE REGISTRO --- */}
                <div className="form-container sign-up-container">
                    <form onSubmit={handleRegistro}>
                        <div className="app-logo">
                            <img src={logoMap} alt="Logo Cochabamba" className="logo-img" />
                            <span className="logo-text">Llajta Inteligente</span>
                        </div>
                        <h1>Crear Cuenta</h1>
                        <p className="subtitle">Llena los datos para registrarte como ciudadano</p>
                        
                        <div className="input-group">
                            <input type="text" placeholder="Nombre Completo" value={nombre_completo} onChange={(e) => setNombre(e.target.value)} required />
                        </div>
                        <div className="input-group">
                            <input type="email" placeholder="Correo Electrónico" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
                        </div>
                        <div className="input-group">
                            <input type="password" placeholder="Contraseña" value={contrasena} onChange={(e) => setContrasena(e.target.value)} required />
                        </div>
                        <button type="submit" className="btn-signin">Registrarse →</button>
                    </form>
                </div>

                {/* --- FORMULARIO DE LOGIN --- */}
                <div className="form-container sign-in-container">
                    <form onSubmit={handleLogin}>
                        <div className="app-logo">
                            <img src={logoMap} alt="Logo Cochabamba" className="logo-img" />
                            <span className="logo-text">Llajta Inteligente</span>
                        </div>
                        <h1>Bienvenido de nuevo</h1>
                        <p className="subtitle">Por favor, ingresa tus datos para continuar</p>
                        
                        <div className="input-group">
                            <input type="email" placeholder="Correo Electrónico" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
                        </div>
                        <div className="input-group">
                            <input type="password" placeholder="Contraseña" value={contrasena} onChange={(e) => setContrasena(e.target.value)} required />
                        </div>
                        <button type="submit" className="btn-signin">Iniciar Sesión →</button>
                    </form>
                </div>

                {/* --- PANEL DE LA IMAGEN DESLIZANTE --- */}
                <div className="overlay-container">
                    <div className="overlay" style={{ backgroundImage: `url(${fondoCristo})` }}>
                        <div className="overlay-panel overlay-left">
                            <h2>¡Hola de nuevo!</h2>
                            <p>Ingresa para reportar incidencias y ayudar a mejorar Cochabamba.</p>
                            <button className="btn-overlay-signup" onClick={togglePanel}>Iniciar Sesión</button>
                        </div>
                        <div className="overlay-panel overlay-right">
                            <h2>¡Únete a nosotros!</h2>
                            <p>Regístrate para empezar a reportar problemas en tu zona.</p>
                            <button className="btn-overlay-signup" onClick={togglePanel}>Registrarse</button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AuthPage;