import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { Camera } from 'lucide-react';

export default function CustomCursor() {
  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);
  
  const springConfig = { damping: 25, stiffness: 250, mass: 0.5 };
  const springX = useSpring(cursorX, springConfig);
  const springY = useSpring(cursorY, springConfig);

  const [isHovering, setIsHovering] = useState(false);
  const [isInteractive, setIsInteractive] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      cursorX.set(e.clientX - (isHovering ? 24 : 16));
      cursorY.set(e.clientY - (isHovering ? 24 : 16));
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, a')) {
        setIsInteractive(true);
        setIsHovering(false);
      } else if (target.closest('.cursor-none, img, video')) {
        setIsHovering(true);
        setIsInteractive(false);
      } else {
        setIsHovering(false);
        setIsInteractive(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseover', handleMouseOver);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, [isHovering]);

  return (
    <motion.div
      className="fixed top-0 left-0 pointer-events-none z-[9999] hidden md:flex items-center justify-center border-[#1a1a1a] border rounded-full"
      style={{
        x: springX,
        y: springY,
        width: isHovering ? 48 : 32,
        height: isHovering ? 48 : 32,
        backgroundColor: isInteractive ? 'rgba(26, 26, 26, 0.1)' : 'transparent',
        border: isHovering ? 'none' : '1px solid #1a1a1a',
      }}
      animate={{
        scale: isInteractive ? 1.5 : 1,
      }}
      transition={{ type: 'spring', damping: 25, stiffness: 250, mass: 0.5 }}
    >
      {isHovering && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-lg"
        >
          <Camera size={16} className="text-ink" />
        </motion.div>
      )}
    </motion.div>
  );
}
