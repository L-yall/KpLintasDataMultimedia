import React, { Suspense } from 'react';
import Spline from '@splinetool/react-spline';

function HeroSplineScene({ scene = "https://prod.spline.design/oh9QGSrrXyqUjitX/scene.splinecode", logoCoverColor = "#ffffff" }) {
  const handleLoad = (splineApp) => {
    if (splineApp && typeof splineApp.setBackgroundColor === 'function') {
      try {
        splineApp.setBackgroundColor('transparent');
      } catch (e) {
        console.warn('Could not set Spline background to transparent:', e);
      }
    }
  };

  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      position: 'relative', 
      background: 'transparent',
      overflow: 'visible',
      pointerEvents: 'none'
    }}>
      <style>{`
        spline-viewer {
          background: transparent !important;
        }
      `}</style>
      <Suspense fallback={
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          color: 'var(--md-primary)',
          fontFamily: "'Open Sans', sans-serif"
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(0, 104, 118, 0.1)',
            borderTopColor: 'var(--md-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '12px'
          }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--md-on-surface-variant)', letterSpacing: '1px' }}>
            MEMUAT SCENE 3D...
          </span>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      }>
        <div style={{
          width: '100%',
          height: '100%',
          transform: 'scale(1.1) translateY(-15px)',
          transformOrigin: 'center center',
          pointerEvents: 'none'
        }}>
          <Spline scene={scene} onLoad={handleLoad} style={{ pointerEvents: 'none' }} />
        </div>
      </Suspense>

      {/* Cover panel to hide Spline logo — matches hero gradient */}
      <div style={{
        position: 'absolute',
        bottom: '-10px',
        right: '-10px',
        width: '300px',
        height: '80px',
        background: logoCoverColor,
        zIndex: 10,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px'
      }}>
        <img src={process.env.PUBLIC_URL + '/logo_ldm.png'} alt="Logo LDM" style={{ height: '32px' }} />
        <span style={{
          fontFamily: "'Open Sans', sans-serif",
          fontWeight: 700,
          color: 'var(--md-primary)',
          fontSize: '1.20rem'
        }}>
          PT. Lintas Data Multimedia
        </span>
      </div>
    </div>
  );
}

export default HeroSplineScene;
