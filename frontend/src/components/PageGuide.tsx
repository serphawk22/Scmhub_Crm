'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, HelpCircle, X, Sparkles } from 'lucide-react';

interface GuideStep {
  icon: string | React.ReactNode;
  text: string;
}

interface PageGuideProps {
  pageKey: string;
  title: string;
  description: string;
  steps: GuideStep[];
  variant?: 'light' | 'dark';
  buttonClassName?: string;
  iconClassName?: string;
}

export default function PageGuide({ pageKey, title, description, steps, buttonClassName, iconClassName }: PageGuideProps) {
  const storageKey = `tour_v2_${pageKey}`;
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const totalSteps = steps.length + 1;

  useEffect(() => {
    if (!localStorage.getItem(storageKey)) setIsOpen(true);
  }, [storageKey]);

  const finish = useCallback(() => {
    localStorage.setItem(storageKey, 'true');
    setIsOpen(false);
  }, [storageKey]);

  const handleNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setDirection(1);
      setCurrentStep(p => p + 1);
    } else {
      finish();
    }
  }, [currentStep, totalSteps, finish]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep(p => p - 1);
    }
  }, [currentStep]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext();
      else if (e.key === 'ArrowLeft') handleBack();
      else if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, handleNext, handleBack, finish]);

  const jumpTo = (i: number) => {
    setDirection(i > currentStep ? 1 : -1);
    setCurrentStep(i);
  };

  const restart = () => { setCurrentStep(0); setDirection(1); setIsOpen(true); };

  const slide = {
    enter: (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <>
      {/* Floating help button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            onClick={restart}
            className={buttonClassName || "fixed bottom-24 right-5 z-[90] group"}
            aria-label="Restart page tour"
          >
            <span className={iconClassName || "flex items-center justify-center w-11 h-11 rounded-full bg-black text-white shadow-lg shadow-black/25 transition-transform group-hover:scale-110"}>
              <HelpCircle className="w-5 h-5" />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Tour overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="tour-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={finish} />

            {/* Card */}
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className="relative w-full max-w-[420px] bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden"
            >
              {/* Progress bar */}
              <div className="h-1 bg-gray-100 dark:bg-zinc-800">
                <motion.div
                  className="h-full bg-black"
                  animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>

              {/* Close */}
              <button
                onClick={finish}
                className="absolute top-3.5 right-3.5 p-1.5 rounded-xl text-gray-300 hover:text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:bg-zinc-800 transition-colors z-10"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Step label */}
              <div className="px-7 pt-6">
                <span className="text-[11px] font-bold text-black dark:text-white uppercase tracking-widest">
                  Step {currentStep + 1} of {totalSteps}
                </span>
              </div>

              {/* Animated step content */}
              <div className="px-7 pt-4 pb-2 min-h-[200px] flex items-center justify-center">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={currentStep}
                    custom={direction}
                    variants={slide}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="w-full text-center"
                  >
                    {currentStep === 0 ? (
                      <>
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 dark:bg-zinc-800 mb-4">
                          <Sparkles className="w-8 h-8 text-black dark:text-white" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-50 mb-2">{title}</h2>
                        <p className="text-[13px] text-gray-500 dark:text-zinc-400 leading-relaxed max-w-xs mx-auto">{description}</p>
                      </>
                    ) : (
                      <>
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 dark:bg-zinc-800 mb-4 text-black dark:text-white">
                          {typeof steps[currentStep - 1].icon === 'string' ? (
                            <span className="text-4xl">{steps[currentStep - 1].icon}</span>
                          ) : (
                            <div className="w-8 h-8 [&>svg]:w-full [&>svg]:h-full">
                              {steps[currentStep - 1].icon}
                            </div>
                          )}
                        </div>
                        <p className="text-[13px] text-gray-700 dark:text-zinc-200 leading-relaxed max-w-xs mx-auto font-medium">{steps[currentStep - 1].text}</p>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="px-7 pb-6 pt-2 flex items-center justify-between">
                {/* Dots */}
                <div className="flex gap-1.5">
                  {Array.from({ length: totalSteps }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => jumpTo(i)}
                      aria-label={`Go to step ${i + 1}`}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        i === currentStep
                          ? 'w-7 bg-black'
                          : i < currentStep
                            ? 'w-2 bg-gray-400 hover:bg-gray-50 dark:bg-zinc-9500'
                            : 'w-2 bg-gray-200 hover:bg-gray-300'
                      }`}
                    />
                  ))}
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-1.5">
                  {currentStep === 0 ? (
                    <button
                      onClick={finish}
                      className="px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-600 dark:text-zinc-300 rounded-xl transition-colors"
                    >
                      Skip tour
                    </button>
                  ) : (
                    <button
                      onClick={handleBack}
                      className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:bg-zinc-800 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    className="px-5 py-2.5 text-xs font-bold bg-black text-white rounded-xl hover:bg-gray-800 transition-all flex items-center gap-1 shadow-md shadow-black/20"
                  >
                    {currentStep === totalSteps - 1 ? 'Get Started' : 'Next'}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
