"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Package, Plus, Search, CheckCircle2, XCircle, MoreVertical, Edit2, Trash2, X, RefreshCw, Upload, Camera } from 'lucide-react';
import { ExportActions } from '@/components/ExportActions';
import { API_BASE_URL } from '@/config';
import { fetchWithCache } from '@/lib/cache';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from "@/context/LanguageContext";

interface Product {
  id: number;
  name: string;
  sku: string | null;
  description: string | null;
  category: string | null;
  photo_url: string | null;
  unit_price: number;
  currency: string;
  tax_rate: number;
  stock_quantity: number | null;
  is_active: boolean;
}

export default function ProductsPage() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<'MXN' | 'INR'>('MXN');
  const [showPhotoStep, setShowPhotoStep] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [tempPhotoUrl, setTempPhotoUrl] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    category: 'Other',
    photo_url: '',
    unit_price: 0,
    currency: 'USD',
    tax_rate: 0,
    is_active: true,
  });

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/products`);
      const data = await res.json();
      setProducts(data.products || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be under 10 MB');
      if (e.target) e.target.value = '';
      return;
    }
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE_URL}/upload-image`, { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.file_url) {
        setTempPhotoUrl(data.file_url);
      }
    } catch {
      // ignore network errors silently
    } finally {
      setUploadingPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  const proceedToForm = () => {
    setShowPhotoStep(false);
    setFormData(prev => ({ ...prev, photo_url: tempPhotoUrl }));
    setIsModalOpen(true);
  };

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return ['All', 'Software', 'Service', 'Hardware', 'Consulting', 'Marketing', 'Support', 'Other', ...Array.from(cats)].filter((v, i, a) => a.indexOf(v) === i);
  }, [products]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const stats = {
    total: products.length,
    active: products.filter(p => p.is_active).length,
    categories: new Set(products.map(p => p.category).filter(Boolean)).size,
    avgPrice: products.length ? (products.reduce((acc, p) => acc + p.unit_price, 0) / products.length).toFixed(2) : '0.00'
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingProduct ? `${API_BASE_URL}/products/${editingProduct.id}` : `${API_BASE_URL}/products`;
    const method = editingProduct ? 'PUT' : 'POST';
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchProducts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('products.confirm_delete'))) return;
    try {
      await fetch(`${API_BASE_URL}/products/${id}`, { method: 'DELETE' });
      fetchProducts();
    } catch (e) {
      console.error(e);
    }
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku || '',
        description: product.description || '',
        category: product.category || 'Other',
        photo_url: product.photo_url || '',
        unit_price: product.unit_price,
        currency: product.currency || 'USD',
        tax_rate: product.tax_rate || 0,
        is_active: product.is_active,
      });
      setIsModalOpen(true);
    } else {
      setEditingProduct(null);
      setTempPhotoUrl('');
      setShowPhotoStep(true);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-black p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('products.title')}</h1>
            <p className="text-slate-500 text-sm">{t('products.subtitle')}</p>
          </div>
        </div>
<div className="flex items-center gap-4">
            <ExportActions
              downloadUrl={`${API_BASE_URL}/products/export-pdf`}
              emailUrl={`${API_BASE_URL}/products/export-pdf`}
              filename="product_catalog.pdf"
              label="Catalog"
            />
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button onClick={() => setDisplayCurrency('MXN')} className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${displayCurrency === 'MXN' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>MXN</button>
            <button onClick={() => setDisplayCurrency('INR')} className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${displayCurrency === 'INR' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>INR</button>
          </div>
          <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium shadow-sm transition-colors">
            <Plus className="w-4 h-4" /> {t('products.add_item')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: t('products.stat_total'), value: stats.total, color: 'text-emerald-500' },
          { label: t('products.stat_active'), value: stats.active, color: 'text-blue-500' },
          { label: t('products.stat_categories'), value: stats.categories, color: 'text-violet-500' },
          { label: t('products.stat_avg_price'), value: `$${stats.avgPrice}`, color: 'text-slate-900 dark:text-white' }
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <p className={`text-3xl font-black mb-1 ${s.color}`}>{s.value}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder={t('products.search_placeholder')} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar w-full md:w-auto">
          {categories.map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
            >
              {cat === 'All' ? t('products.filter_all') : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('products.col_item')}</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('products.col_category')}</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('products.col_price')}</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('products.col_tax')}</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('products.col_status')}</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" /> {t('products.loading')}</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500">{t('products.no_items')}</td></tr>
              ) : (
                filteredProducts.map(p => (
                  <tr key={p.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                          {p.photo_url ? (
                            <img src={p.photo_url.startsWith("/static") ? `${API_BASE_URL}${p.photo_url}` : p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-6 h-6 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900 dark:text-white text-sm">{p.name}</p>
                            {p.sku === 'Serphawk' && <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">Serphawk</span>}
                            {p.sku === 'DaPros' && <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400">DaPros</span>}
                          </div>
                          {p.sku && p.sku !== 'Serphawk' && p.sku !== 'DaPros' && <p className="text-xs font-mono text-slate-400 mt-0.5">{t('products.label_sku_prefix')} {p.sku}</p>}
                          {p.description && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{p.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm font-medium text-slate-600 dark:text-slate-300">{p.category || '—'}</td>
                    <td className="p-4 font-black text-slate-900 dark:text-white text-sm">
                      {displayCurrency} {(p.unit_price * (displayCurrency === 'INR' ? 4.4 : 1)).toFixed(2)}
                    </td>
                    <td className="p-4 text-sm text-slate-500">{p.tax_rate}%</td>
                    <td className="p-4">
                      {p.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 text-xs font-bold border border-emerald-200 dark:border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {t('products.status_active')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 dark:bg-slate-800 text-xs font-bold border border-slate-200 dark:border-slate-700">
                          <XCircle className="w-3.5 h-3.5" /> {t('products.status_inactive')}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openModal(p)} className="p-2 text-slate-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Photo Upload Step Modal */}
      <AnimatePresence>
        {showPhotoStep && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <Camera className="w-5 h-5 text-emerald-500" /> {t('products.photo_title')}
                </h3>
                <button onClick={() => setShowPhotoStep(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center">{t('products.photo_desc')}</p>
                
                <label htmlFor="catalogPhotoUpload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors bg-slate-50 dark:bg-slate-900">
                  {uploadingPhoto ? (
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                      <span className="text-sm font-medium text-slate-500">{t('products.uploading')}</span>
                    </div>
                  ) : tempPhotoUrl ? (
                    <div className="flex flex-col items-center gap-2">
                      <img src={tempPhotoUrl.startsWith("/static") ? `${API_BASE_URL}${tempPhotoUrl}` : tempPhotoUrl} alt="Preview" className="w-20 h-20 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                      <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{t('products.photo_done')}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-slate-400" />
                      <span className="text-sm font-medium text-slate-500">{t('products.click_upload')}</span>
                      <span className="text-xs text-slate-400">{t('products.formats')}</span>
                    </div>
                  )}
                </label>
                <input id="catalogPhotoUpload" type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />

                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => { setTempPhotoUrl(''); proceedToForm(); }} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">{t('products.btn_skip')}</button>
                  <button onClick={proceedToForm} className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm">{t('products.btn_continue')}</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  {editingProduct ? t('products.modal_edit') : t('products.modal_add')}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-5 space-y-4">
                {formData.photo_url && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                    <img src={formData.photo_url.startsWith("/static") ? `${API_BASE_URL}${formData.photo_url}` : formData.photo_url} alt="Item photo" className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-500 uppercase">{t('products.label_photo')}</p>
                      <label htmlFor="catalogPhotoChange" className="text-xs font-medium text-emerald-600 dark:text-emerald-400 cursor-pointer hover:underline">{t('products.change_photo')}</label>
                    </div>
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, photo_url: '' }))} className="text-slate-400 hover:text-red-500 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                    <input id="catalogPhotoChange" type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 10 * 1024 * 1024) { alert('Image must be under 10 MB'); if (e.target) e.target.value = ''; return; }
                      const fd = new FormData();
                      fd.append('file', file);
                      const res = await fetch(`${API_BASE_URL}/upload-image`, { method: 'POST', body: fd });
                      const data = await res.json();
                      if (res.ok && data.file_url) setFormData(prev => ({ ...prev, photo_url: data.file_url }));
                      if (e.target) e.target.value = '';
                    }} />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('products.label_name')}</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('products.label_category')}</label>
                    <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:outline-none focus:border-emerald-500">
                      {categories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('products.label_sku')}</label>
                    <input type="text" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:outline-none focus:border-emerald-500" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('products.label_currency')}</label>
                    <input type="text" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('products.label_price')}</label>
                    <input required type="number" step="0.01" value={formData.unit_price} onChange={e => setFormData({...formData, unit_price: parseFloat(e.target.value)})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('products.label_tax_rate')}</label>
                    <input type="number" step="0.1" value={formData.tax_rate} onChange={e => setFormData({...formData, tax_rate: parseFloat(e.target.value)})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:outline-none focus:border-emerald-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('products.label_description')}</label>
                  <textarea rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:outline-none focus:border-emerald-500"></textarea>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input type="checkbox" id="is_active" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="rounded text-emerald-500 focus:ring-emerald-500" />
                  <label htmlFor="is_active" className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('products.label_active')}</label>
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700 mt-6">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">{t('products.btn_cancel')}</button>
                  <button type="submit" className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm">{t('products.btn_save')}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
