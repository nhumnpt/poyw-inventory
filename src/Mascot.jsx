import React, { useState, useEffect, useRef, useCallback } from 'react';

const REACTIONS = [
  { face: '😍', text: 'ชอบจัง!', color: '#ec4899' },
  { face: '🥰', text: 'รักนะ~', color: '#f43f5e' },
  { face: '😆', text: 'จั๊กจี้!', color: '#f59e0b' },
  { face: '🤩', text: 'ว้าว!', color: '#8b5cf6' },
  { face: '😜', text: 'เล่นอีก!', color: '#3b82f6' },
  { face: '🫣', text: 'อ๊ะ!', color: '#10b981' },
  { face: '😵‍💫', text: 'เวียนหัว~', color: '#6366f1' },
  { face: '🥺', text: 'อย่าหยุดนะ', color: '#ec4899' },
];

export default function Mascot() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [isClicked, setIsClicked] = useState(false);
  const [reaction, setReaction] = useState(null);
  const [clickCount, setClickCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: -1 }); // -1 means auto bottom
  const [blinking, setBlinking] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);
  const [lastInteraction, setLastInteraction] = useState(Date.now());
  const mascotRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Track mouse position
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      setLastInteraction(Date.now());
      if (isSleeping) setIsSleeping(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isSleeping]);

  // Calculate eye direction
  useEffect(() => {
    if (!mascotRef.current) return;
    const rect = mascotRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2 - 10;
    
    const dx = mousePos.x - centerX;
    const dy = mousePos.y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxOffset = 4;
    
    if (distance > 0) {
      setEyeOffset({
        x: (dx / distance) * Math.min(maxOffset, distance * 0.03),
        y: (dy / distance) * Math.min(maxOffset, distance * 0.03),
      });
    }
  }, [mousePos]);

  // Random blinking
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isClicked && !isSleeping) {
        setBlinking(true);
        setTimeout(() => setBlinking(false), 150);
      }
    }, 2500 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, [isClicked, isSleeping]);

  // Sleep after inactivity
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastInteraction > 15000 && !isDragging) {
        setIsSleeping(true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [lastInteraction, isDragging]);

  // Handle click
  const handleClick = useCallback(() => {
    if (isDragging) return;
    setIsClicked(true);
    setIsSleeping(false);
    setLastInteraction(Date.now());
    const newCount = clickCount + 1;
    setClickCount(newCount);
    
    const r = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
    setReaction(r);
    
    setTimeout(() => setIsClicked(false), 400);
    setTimeout(() => setReaction(null), 1500);
  }, [clickCount, isDragging]);

  // Drag handlers
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    const rect = mascotRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  useEffect(() => {
    if (!isDragging) return;
    
    const handleMove = (e) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };
    const handleUp = () => {
      setIsDragging(false);
      setLastInteraction(Date.now());
    };
    
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging]);

  const bottomPos = position.y === -1 ? { bottom: '20px', left: `${position.x}px` } : { top: `${position.y}px`, left: `${position.x}px` };

  return (
    <div
      ref={mascotRef}
      className="mascot-container"
      style={{
        position: 'fixed',
        ...bottomPos,
        zIndex: 9999,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        transition: isDragging ? 'none' : 'transform 0.3s ease',
        transform: isClicked ? 'scale(1.2) rotate(-10deg)' : isSleeping ? 'scale(0.95)' : 'scale(1)',
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {/* Speech Bubble */}
      {reaction && (
        <div
          style={{
            position: 'absolute',
            bottom: '105%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'white',
            borderRadius: '16px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 'bold',
            color: reaction.color,
            boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
            whiteSpace: 'nowrap',
            animation: 'mascotBubble 0.3s ease-out',
            border: `2px solid ${reaction.color}20`,
          }}
        >
          <span style={{ fontSize: '16px', marginRight: '4px' }}>{reaction.face}</span>
          {reaction.text}
          {/* Bubble arrow */}
          <div style={{
            position: 'absolute',
            bottom: '-8px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid white',
          }} />
        </div>
      )}

      {/* Click counter badge */}
      {clickCount > 0 && (
        <div style={{
          position: 'absolute',
          top: '-5px',
          right: '-5px',
          background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
          color: 'white',
          borderRadius: '50%',
          width: '22px',
          height: '22px',
          fontSize: '10px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(139,92,246,0.4)',
          border: '2px solid white',
        }}>
          {clickCount > 99 ? '99+' : clickCount}
        </div>
      )}

      {/* Main Body SVG */}
      <svg width="80" height="90" viewBox="0 0 80 90" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' }}>
        {/* Body */}
        <ellipse cx="40" cy="58" rx="28" ry="30" fill="url(#bodyGrad)" />
        
        {/* Belly */}
        <ellipse cx="40" cy="65" rx="18" ry="18" fill="url(#bellyGrad)" opacity="0.6" />
        
        {/* Head */}
        <circle cx="40" cy="30" r="22" fill="url(#headGrad)" />
        
        {/* Ears */}
        <ellipse cx="22" cy="14" rx="8" ry="10" fill="url(#bodyGrad)" transform="rotate(-15 22 14)" />
        <ellipse cx="22" cy="14" rx="5" ry="7" fill="#ffb3c6" transform="rotate(-15 22 14)" />
        <ellipse cx="58" cy="14" rx="8" ry="10" fill="url(#bodyGrad)" transform="rotate(15 58 14)" />
        <ellipse cx="58" cy="14" rx="5" ry="7" fill="#ffb3c6" transform="rotate(15 58 14)" />
        
        {/* Eyes */}
        {isSleeping ? (
          <>
            {/* Sleeping eyes (closed) */}
            <path d="M28 28 Q32 32 36 28" stroke="#6b4c5e" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M44 28 Q48 32 52 28" stroke="#6b4c5e" strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* Zzz */}
            <text x="58" y="18" fontSize="10" fill="#8b5cf6" fontWeight="bold" opacity="0.7"
              style={{ animation: 'mascotFloat 2s ease-in-out infinite' }}>
              Z
            </text>
            <text x="64" y="10" fontSize="8" fill="#8b5cf6" fontWeight="bold" opacity="0.5"
              style={{ animation: 'mascotFloat 2s ease-in-out infinite 0.5s' }}>
              z
            </text>
          </>
        ) : (
          <>
            {/* Eye whites */}
            <ellipse cx="32" cy="28" rx={blinking ? 5 : 5.5} ry={blinking ? 1 : 6} fill="white" 
              style={{ transition: 'ry 0.1s ease' }} />
            <ellipse cx="48" cy="28" rx={blinking ? 5 : 5.5} ry={blinking ? 1 : 6} fill="white"
              style={{ transition: 'ry 0.1s ease' }} />
            
            {/* Pupils (follow mouse) */}
            {!blinking && (
              <>
                <circle cx={32 + eyeOffset.x} cy={28 + eyeOffset.y} r="3" fill="#2d1b30" />
                <circle cx={48 + eyeOffset.x} cy={28 + eyeOffset.y} r="3" fill="#2d1b30" />
                {/* Eye shine */}
                <circle cx={33.5 + eyeOffset.x * 0.5} cy={26.5 + eyeOffset.y * 0.5} r="1.2" fill="white" />
                <circle cx={49.5 + eyeOffset.x * 0.5} cy={26.5 + eyeOffset.y * 0.5} r="1.2" fill="white" />
              </>
            )}
          </>
        )}
        
        {/* Mouth */}
        {isClicked ? (
          <ellipse cx="40" cy="38" rx="5" ry="4" fill="#e8457a" />
        ) : isSleeping ? (
          <ellipse cx="40" cy="37" rx="3" ry="1.5" fill="#d4a0b0" />
        ) : (
          <path d="M36 36 Q40 41 44 36" stroke="#e8457a" strokeWidth="2" fill="none" strokeLinecap="round" />
        )}
        
        {/* Cheeks */}
        <ellipse cx="24" cy="35" rx="5" ry="3.5" fill="#ffb3c6" opacity={isClicked ? "0.8" : "0.4"} />
        <ellipse cx="56" cy="35" rx="5" ry="3.5" fill="#ffb3c6" opacity={isClicked ? "0.8" : "0.4"} />
        
        {/* Arms */}
        <ellipse cx="13" cy="55" rx="7" ry="10" fill="url(#bodyGrad)" transform="rotate(15 13 55)" />
        <ellipse cx="67" cy="55" rx="7" ry="10" fill="url(#bodyGrad)" transform="rotate(-15 67 55)" />
        
        {/* Feet */}
        <ellipse cx="30" cy="85" rx="10" ry="5" fill="url(#bodyGrad)" />
        <ellipse cx="50" cy="85" rx="10" ry="5" fill="url(#bodyGrad)" />
        
        {/* Gradients */}
        <defs>
          <radialGradient id="bodyGrad" cx="40%" cy="30%">
            <stop offset="0%" stopColor="#ffd6e7" />
            <stop offset="100%" stopColor="#f0a0c0" />
          </radialGradient>
          <radialGradient id="headGrad" cx="40%" cy="30%">
            <stop offset="0%" stopColor="#ffe4f0" />
            <stop offset="100%" stopColor="#f5b8d4" />
          </radialGradient>
          <radialGradient id="bellyGrad" cx="50%" cy="40%">
            <stop offset="0%" stopColor="#fff0f5" />
            <stop offset="100%" stopColor="#ffd6e7" />
          </radialGradient>
        </defs>
      </svg>

      {/* Floating particles on click */}
      {isClicked && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {['❤️', '✨', '💕', '⭐'].map((emoji, i) => (
            <span key={i} style={{
              position: 'absolute',
              left: `${20 + Math.random() * 40}px`,
              top: `${10 + Math.random() * 30}px`,
              fontSize: '14px',
              animation: `mascotParticle 0.8s ease-out forwards`,
              animationDelay: `${i * 0.1}s`,
              opacity: 0,
            }}>
              {emoji}
            </span>
          ))}
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes mascotBubble {
          0% { transform: translateX(-50%) scale(0) translateY(10px); opacity: 0; }
          60% { transform: translateX(-50%) scale(1.1) translateY(-2px); }
          100% { transform: translateX(-50%) scale(1) translateY(0); opacity: 1; }
        }
        @keyframes mascotParticle {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-40px) scale(0.3); opacity: 0; }
        }
        @keyframes mascotFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .mascot-container:hover svg {
          filter: drop-shadow(0 6px 12px rgba(236,72,153,0.3)) !important;
        }
      `}</style>
    </div>
  );
}
