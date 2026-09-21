'use client';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, Link as LinkIcon, Lock, CheckCircle2, ChevronRight, AlertCircle, Share2, Search, Youtube, Facebook, Instagram, Linkedin, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { useRole } from '@/context/RoleContext';
import PageGuide from '@/components/PageGuide';
import { useLanguage } from "@/context/LanguageContext";

export default function SetupPage() {
  const { t } = useLanguage();
  const { user, email } = useRole();
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [verifyingDomain, setVerifyingDomain] = useState(false);
  const [domainStatus, setDomainStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [sitemapData, setSitemapData] = useState<{ url: string; cms: string } | null>(null);

  const [connectedSocials, setConnectedSocials] = useState<string[]>([]);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwChanging, setPwChanging] = useState(false);
  const [pwStatus, setPwStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [pwError, setPwError] = useState('');

  const handleVerifyDomain = async () => {
    if (!websiteUrl) return;
    setVerifyingDomain(true);
    setDomainStatus('idle');

    try {
      const res = await fetch(`${API_BASE_URL}/setup/verify-domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, websiteUrl })
      });
      const data = await res.json();
      if (data.success) {
        setDomainStatus('success');
        setSitemapData({ url: data.sitemap_url, cms: data.cms_type });
      } else {
        setDomainStatus('error');
      }
    } catch (e) {
      setDomainStatus('error');
    } finally {
      setVerifyingDomain(false);
    }
  };

  const connectSocial = (platform: string) => {
    setTimeout(() => {
      setConnectedSocials(prev => [...prev, platform]);
    }, 1000);
  };

  const handlePasswordChange = async () => {
    setPwStatus('idle');
    setPwError('');
    if (!currentPassword || !newPassword) { setPwError(t('setup.error_fill_all')); setPwStatus('error'); return; }
    if (newPassword.length < 6) { setPwError(t('setup.error_pw_min_length')); setPwStatus('error'); return; }
    if (newPassword !== confirmPassword) { setPwError(t('setup.error_pw_mismatch')); setPwStatus('error'); return; }

    setPwChanging(true);
    try {
      const res = await fetch(`${API_BASE_URL}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id, current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setPwError(data.detail || t('setup.error_pw_change_failed')); setPwStatus('error'); return; }
      setPwStatus('success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setPwError(t('setup.error_network'));
      setPwStatus('error');
    } finally {
      setPwChanging(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-black text-slate-900 dark:text-zinc-50 tracking-tight">{t("setup.title")}</h1>
        <p className="text-slate-500 dark:text-zinc-400 font-medium">{t("setup.subtitle")}</p>
      </div>

      <PageGuide
        pageKey="setup"
        title={t("setup.guide_title")}
        description={t("setup.guide_desc")}
        steps={[
          { icon: '🌐', text: t("setup.guide_s1") },
          { icon: '🔗', text: t("setup.guide_s2") },
          { icon: '📍', text: t("setup.guide_s3") },
          { icon: '✅', text: t("setup.guide_s4") },
        ]}
      />

      <div className="grid md:grid-cols-2 gap-8">
        {/* Domain Verification */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-slate-200 dark:border-zinc-700 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100">{t("setup.add_website")}</h2>
              <p className="text-sm text-slate-500 dark:text-zinc-400">{t("setup.verify_domain")}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1 block">{t("setup.website_url")}</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  onClick={handleVerifyDomain}
                  disabled={verifyingDomain}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {verifyingDomain ? t("setup.verifying") : t("setup.verify")}
                </button>
              </div>
            </div>

            {domainStatus === 'success' && sitemapData && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl mt-4"
              >
                <div className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                  <div>
                    <h3 className="text-emerald-900 font-bold mb-1">{t("setup.domain_verified")}</h3>
                    <ul className="text-sm text-emerald-700 space-y-1">
                      <li>{t("setup.sitemap_detected")} <span className="font-semibold">{sitemapData.url}</span></li>
                      <li>{t("setup.cms_flags")} <span className="font-semibold">{sitemapData.cms}</span></li>
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}

            {domainStatus === 'error' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                className="bg-rose-50 border border-rose-100 p-4 rounded-xl mt-4"
              >
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5" />
                  <div>
                    <h3 className="text-rose-900 font-bold mb-1">{t("setup.verification_failed")}</h3>
                    <p className="text-sm text-rose-700">{t("setup.url_invalid")}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Social Media Connections */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-slate-200 dark:border-zinc-700 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-fuchsia-50 text-fuchsia-600 rounded-xl">
              <Share2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100">{t("setup.add_social_media")}</h2>
              <p className="text-sm text-slate-500 dark:text-zinc-400">{t("setup.cross_channel")}</p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { id: 'facebook', name: 'Facebook / Instagram', icon: Facebook, color: 'text-blue-600', bg: 'bg-blue-50' },
              { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: 'text-sky-600', bg: 'bg-sky-50' },
              { id: 'youtube', name: 'YouTube Channel', icon: Youtube, color: 'text-red-500', bg: 'bg-red-50' },
            ].map(social => {
              const connected = connectedSocials.includes(social.id);
              return (
                <div key={social.id} className="flex items-center justify-between p-4 border border-slate-100 dark:border-zinc-800 rounded-xl hover:bg-slate-50 dark:bg-zinc-950 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${social.bg} ${social.color}`}>
                      <social.icon className="w-5 h-5" />
                    </div>
                    <span className="font-semibold text-slate-700 dark:text-zinc-200">{social.name}</span>
                  </div>
                  <button
                    onClick={() => connectSocial(social.id)}
                    disabled={connected || !websiteUrl}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all
                      ${connected 
                        ? 'bg-emerald-100 text-emerald-700 pointer-events-none' 
                        : !websiteUrl 
                          ? 'bg-slate-100 dark:bg-zinc-800 text-slate-400 opacity-50 cursor-not-allowed'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:bg-zinc-700'}`}
                  >
                    {connected ? t("setup.social_connected") : t("setup.social_connect")}
                  </button>
                </div>
              );
            })}
          </div>
          
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-zinc-800">
             <button 
                disabled={domainStatus !== 'success'}
                className="w-full py-4 bg-gradient-to-r from-slate-800 to-slate-900 text-white font-bold rounded-xl flex justify-center items-center gap-2 hover:shadow-lg disabled:opacity-50 disabled:hover:shadow-none transition-all"
             >
                {t("setup.trigger_audit")} <Search className="w-5 h-5" />
             </button>
          </div>
        </motion.div>
      </div>

      {/* Password Change Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-slate-200 dark:border-zinc-700 shadow-sm"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100">{t("setup.change_password")}</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">{t("setup.update_password_desc")}</p>
          </div>
        </div>

        {pwStatus === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl"
          >
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-800">{t("setup.password_updated")}</p>
              <p className="text-xs text-emerald-600 mt-0.5">{t("setup.password_new_used")}</p>
            </div>
          </motion.div>
        )}

        {pwStatus === 'error' && pwError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl"
          >
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <p className="text-sm font-bold text-red-700">{pwError}</p>
          </motion.div>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          {/* Current Password */}
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5 block">{t("setup.field_current_password")}</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder={t("setup.ph_current_password")}
                className="w-full px-4 py-3 pr-11 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm font-medium"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-zinc-300 transition-colors"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5 block">{t("setup.field_new_password")}</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder={t("setup.ph_new_password")}
                className="w-full px-4 py-3 pr-11 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm font-medium"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-zinc-300 transition-colors"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5 block">{t("setup.field_confirm_password")}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder={t("setup.ph_confirm_password")}
              className={`w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm font-medium ${
                confirmPassword && confirmPassword !== newPassword
                  ? 'border-red-300 bg-red-50/30'
                  : confirmPassword && confirmPassword === newPassword
                    ? 'border-emerald-300 bg-emerald-50/30'
                    : 'border-slate-200 dark:border-zinc-700'
              }`}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-slate-400 font-medium">
            <Lock className="w-3.5 h-3.5 inline mr-1" />
            {t("setup.password_encrypted")}
          </p>
          <button
            onClick={handlePasswordChange}
            disabled={pwChanging || !currentPassword || !newPassword || !confirmPassword}
            className="px-6 py-3 bg-gradient-to-r from-slate-800 to-slate-900 text-white font-bold rounded-xl flex items-center gap-2 hover:shadow-lg disabled:opacity-50 disabled:hover:shadow-none transition-all"
          >
            {pwChanging ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t("setup.updating")}
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                {t("setup.update_password_btn")}
              </>
            )}
          </button>
        </div>
      </motion.div>

    </div>
  );
}
