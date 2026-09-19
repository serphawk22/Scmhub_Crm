'use client';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Zap, BarChart, Rocket, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import PageGuide from '@/components/PageGuide';
import { useLanguage } from "@/context/LanguageContext";

export default function PricingPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const packages = [
    {
      id: 'starter',
      name: t('pricing.plan_starter_name'),
      price: '$499',
      period: '/month',
      description: t('pricing.plan_starter_desc'),
      features: [
        t('pricing.plan_starter_f1'),
        t('pricing.plan_starter_f2'),
        t('pricing.plan_starter_f3'),
        t('pricing.plan_starter_f4'),
        t('pricing.plan_starter_f5')
      ],
      icon: <Zap className="w-8 h-8 text-blue-400" />,
      popular: false,
      color: 'blue'
    },
    {
      id: 'growth',
      name: t('pricing.plan_growth_name'),
      price: '$999',
      period: '/month',
      description: t('pricing.plan_growth_desc'),
      features: [
        t('pricing.plan_growth_f1'),
        t('pricing.plan_growth_f2'),
        t('pricing.plan_growth_f3'),
        t('pricing.plan_growth_f4'),
        t('pricing.plan_growth_f5'),
        t('pricing.plan_growth_f6')
      ],
      icon: <Rocket className="w-8 h-8 text-fuchsia-400" />,
      popular: true,
      color: 'fuchsia'
    },
    {
      id: 'enterprise',
      name: t('pricing.plan_enterprise_name'),
      price: '$2,499',
      period: '/month',
      description: t('pricing.plan_enterprise_desc'),
      features: [
        t('pricing.plan_enterprise_f1'),
        t('pricing.plan_enterprise_f2'),
        t('pricing.plan_enterprise_f3'),
        t('pricing.plan_enterprise_f4'),
        t('pricing.plan_enterprise_f5'),
        t('pricing.plan_enterprise_f6')
      ],
      icon: <BarChart className="w-8 h-8 text-emerald-400" />,
      popular: false,
      color: 'emerald'
    }
  ];

  const handlePurchase = (pkgId: string) => {
    setLoading(pkgId);
    setTimeout(() => {
      alert(`${t("pricing.payment_prefix")}${pkgId}${t("pricing.payment_suffix")}`);
      router.push('/login');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white py-20 px-4 md:px-8 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-fuchsia-600/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-zinc-900/5 border border-white/10 mb-6 backdrop-blur-sm"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-gray-300">{t("pricing.secure_payment")}</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold tracking-tight mb-6"
          >
            {t("pricing.heading")} <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-fuchsia-400">{t("pricing.heading_highlight")}</span>
          </motion.h1>
          <motion.p 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.2 }}
            className="text-lg text-gray-400 max-w-2xl mx-auto"
          >
            {t("pricing.subtitle")}
          </motion.p>
        </div>

        <div className="max-w-2xl mx-auto mb-12">
          <PageGuide
            pageKey="pricing"
            variant="dark"
            title={t("pricing.guide_title")}
            description={t("pricing.guide_desc")}
            steps={[
              { icon: '💰', text: t("pricing.guide_s1") },
              { icon: '⭐', text: t("pricing.guide_s2") },
              { icon: '🚀', text: t("pricing.guide_s3") },
              { icon: '📞', text: t("pricing.guide_s4") },
            ]}
          />
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-center">
          {packages.map((pkg, idx) => (
            <motion.div
              key={pkg.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * idx + 0.3 }}
              className={`relative rounded-3xl backdrop-blur-sm p-8 flex flex-col h-full bg-white dark:bg-zinc-900/5 border
                ${pkg.popular 
                  ? 'border-fuchsia-500/50 shadow-[0_0_30px_rgba(217,70,239,0.15)] md:scale-105 z-10' 
                  : 'border-white/10'}`}
            >
              {pkg.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white px-4 py-1 rounded-full text-xs font-bold tracking-wider uppercase shadow-lg">
                    {t("pricing.most_popular")}
                  </span>
                </div>
              )}

              <div className="mb-8">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl bg-${pkg.color}-500/20`}>
                    {pkg.icon}
                  </div>
                </div>
                <h3 className="text-2xl font-semibold mb-2">{pkg.name}</h3>
                <p className="text-gray-400 text-sm h-10">{pkg.description}</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline">
                  <span className="text-5xl font-bold tracking-tight">{pkg.price}</span>
                  <span className="text-gray-500 dark:text-zinc-400 ml-2">{pkg.period}</span>
                </div>
              </div>

              <div className="flex-grow">
                <ul className="space-y-4 mb-8">
                  {pkg.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className={`w-5 h-5 shrink-0 text-${pkg.color}-400 mt-0.5`} />
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handlePurchase(pkg.id)}
                disabled={loading !== null}
                className={`w-full py-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2
                  ${pkg.popular 
                    ? 'bg-white dark:bg-zinc-900 text-black dark:text-white hover:bg-gray-100 dark:bg-zinc-800 shadow-xl' 
                    : 'bg-white dark:bg-zinc-900/10 text-white hover:bg-white dark:bg-zinc-900/20'}`}
              >
                {loading === pkg.id ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-5 h-5 border-2 border-current border-t-transparent rounded-full"
                  />
                ) : (
                  t("pricing.get_started")
                )}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
