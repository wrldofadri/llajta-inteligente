import { useNavigate } from 'react-router-dom';
import fondoCristo from '../assets/cristo-fondo.jpg';
import logoMap from '../assets/Logo.png';

const LandingPage = () => {
    const navigate = useNavigate();

    return (
        <div style={{ height: '100vh', width: '100vw', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {/* Imagen de fondo oscura */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: `url(${fondoCristo})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'brightness(0.4)', zIndex: -1 }}></div>
            
            <div style={{ textAlign: 'center', color: 'white', zIndex: 1, padding: '20px', maxWidth: '800px' }}>
                <img src={logoMap} alt="Logo" style={{ width: '100px', marginBottom: '20px', filter: 'brightness(0) invert(1)' }} />
                <h1 style={{ fontSize: '4rem', marginBottom: '10px', fontWeight: '800' }}>Llajta Inteligente</h1>
                <p style={{ fontSize: '1.5rem', marginBottom: '40px', opacity: 0.9 }}>
                    Tu voz construye una mejor Cochabamba. Reporta incidencias, baches y problemas en tu zona en tiempo real.
                </p>
                <button 
                    onClick={() => navigate('/auth')}
                    style={{ padding: '15px 40px', fontSize: '1.2rem', backgroundColor: '#38B6FF', color: 'white', border: 'none', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold', transition: 'transform 0.2s', boxShadow: '0 4px 15px rgba(56, 182, 255, 0.4)' }}
                    onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                >
                    Ingresar al Sistema →
                </button>
            </div>
        </div>
    );
};

export default LandingPage;