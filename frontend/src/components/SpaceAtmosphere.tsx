"use client";

import { useTheme } from "@/context/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, memo } from "react";

// Pre-generate random star positions so they don't jump on re-renders
const generateStars = (count: number) => {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    size: Math.random() * 2 + 1,
    duration: Math.random() * 3 + 2,
    delay: Math.random() * 2,
  }));
};

const darkStars = generateStars(120);
const lightParticles = generateStars(30);

const SpaceAtmosphere = memo(() => {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="fixed inset-0 z-[-1] bg-black" />;

  return (
    <div 
      className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none transition-colors duration-700 ease-in-out"
      style={{ background: theme === "dark" ? "#000000" : "#FFFFFF" }}
    >
      <AnimatePresence mode="popLayout">
        {theme === "dark" ? (
          <motion.div
            key="dark-space"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0"
          >
            {/* Twinkling Stars */}
            {darkStars.map((star) => (
              <motion.div
                key={`dark-star-${star.id}`}
                className="absolute rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.5)]"
                style={{
                  left: star.left,
                  top: star.top,
                  width: star.size * 0.8,
                  height: star.size * 0.8,
                }}
                animate={{
                  opacity: [0.1, 0.8, 0.1],
                  scale: [0.8, 1.1, 0.8]
                }}
                transition={{
                  duration: star.duration,
                  delay: star.delay,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="light-space"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0"
          >
            {/* Sky Cloud Glows */}
            <div className="absolute top-0 left-[-10%] w-[60%] h-[60%] rounded-full opacity-[0.25] blur-[120px] bg-sky-300" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full opacity-[0.15] blur-[100px] bg-blue-400" />
            <div className="absolute top-[30%] left-[70%] w-[40%] h-[40%] rounded-full opacity-[0.1] blur-[100px] bg-indigo-200" />
            
            {/* Distant Atmospheric Particles (very subtle) */}
            {lightParticles.map((p) => (
              <motion.div
                key={`light-particle-${p.id}`}
                className="absolute rounded-full bg-slate-400 opacity-20 blur-[1px]"
                style={{
                  left: p.left,
                  top: p.top,
                  width: p.size * 2,
                  height: p.size * 2,
                }}
                animate={{
                  y: [0, -40, 0],
                  x: [0, Math.random() * 20 - 10, 0],
                  opacity: [0.1, 0.4, 0.1]
                }}
                transition={{
                  duration: p.duration * 3,
                  delay: p.delay,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

SpaceAtmosphere.displayName = "SpaceAtmosphere";
export default SpaceAtmosphere;
