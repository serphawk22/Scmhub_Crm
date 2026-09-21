'use client';

import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, FileImage, Film, Archive, File, Download, Trash2, Plus } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { useLanguage } from '@/context/LanguageContext';

interface FilesTabProps {
  clientId: string | string[];
  files: any[];
  onRefresh: () => void;
}

function getFileIcon(mime: string) {
  if (!mime) return File;
  if (mime.startsWith('image')) return FileImage;
  if (mime.startsWith('video')) return Film;
  if (mime.includes('pdf') || mime.includes('word') || mime.includes('doc')) return FileText;
  if (mime.includes('zip') || mime.includes('archive')) return Archive;
  return File;
}

function formatBytes(bytes: number) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DOC_TYPES: Record<string, { bg: string; text: string; label: string }> = {
  'application/pdf':  { bg: 'bg-red-100 dark:bg-red-900/20',    text: 'text-red-600 dark:text-red-400',    label: 'PDF'   },
  'image/png':        { bg: 'bg-sky-100 dark:bg-sky-900/20',    text: 'text-sky-600 dark:text-sky-400',    label: 'PNG'   },
  'image/jpeg':       { bg: 'bg-sky-100 dark:bg-sky-900/20',    text: 'text-sky-600 dark:text-sky-400',    label: 'JPEG'  },
  'application/msword': { bg: 'bg-blue-100 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', label: 'DOC'  },
};

function getTypeCfg(mime: string) {
  return DOC_TYPES[mime] || { bg: 'bg-slate-100 dark:bg-zinc-800 dark:bg-slate-800', text: 'text-slate-600 dark:text-zinc-300 dark:text-slate-400', label: mime?.split('/')[1]?.toUpperCase() || 'FILE' };
}

export default function FilesTab({ clientId, files, onRefresh }: FilesTabProps) {
  const { language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [description, setDescription] = useState('');

  const handleUpload = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('client_id', String(clientId));
    formData.append('description', description);
    formData.append('uploaded_by', '1'); // Admin user ID placeholder

    try {
      const res = await fetch(`${API_BASE_URL}/upload-file`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        setDescription('');
        onRefresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  return (
    <div className="space-y-5">
      {/* Upload Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative rounded-2xl border-2 border-dashed transition-all p-8 text-center cursor-pointer
          ${dragOver
            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/20'
            : 'border-slate-200 dark:border-zinc-700 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-zinc-900 dark:bg-slate-900'
          }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-colors
          ${dragOver ? 'bg-indigo-600 text-white' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'}`}>
          {uploading ? (
            <div className="w-5 h-5 border-2 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload size={24} />
          )}
        </div>
        <p className="text-sm font-bold text-slate-700 dark:text-zinc-200 dark:text-slate-300">
          {uploading ? (language === 'es' ? 'Subiendo…' : 'Uploading…') : (language === 'es' ? 'Arrastre archivos aquí o haga clic para subir' : 'Drop files here or click to upload')}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-zinc-400 mt-1">
          {language === 'es' ? 'Propuestas, Contratos, Facturas, Presentaciones, Documentos de Reunión' : 'Proposals, Contracts, Invoices, Presentations, Meeting Documents'}
        </p>
        {/* Description input */}
        <div className="mt-4" onClick={e => e.stopPropagation()}>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={language === 'es' ? 'Descripción del archivo (opcional)...' : 'File description (optional)...'}
            className="w-full max-w-xs px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700
                       bg-white dark:bg-zinc-900 dark:bg-slate-800 text-slate-800 dark:text-zinc-100 dark:text-slate-200
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 mx-auto block"
          />
        </div>
      </div>

      {/* Files Grid */}
      {files.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-700 dark:border-slate-700">
          <FileText size={32} className="mx-auto text-slate-300 dark:text-slate-600 dark:text-zinc-300 mb-3" />
          <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 dark:text-zinc-400">{language === 'es' ? 'Aún no hay archivos subidos' : 'No files uploaded yet'}</p>
          <p className="text-xs text-slate-300 dark:text-slate-600 dark:text-zinc-300 mt-1">{language === 'es' ? 'Sube propuestas, contratos y documentos' : 'Upload proposals, contracts, and documents'}</p>
        </div>
      ) : (
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-zinc-400 mb-3">
            {files.length} {language === 'es' ? `Documento${files.length !== 1 ? 's' : ''}` : `Document${files.length !== 1 ? 's' : ''}`}
          </p>
          <div className="space-y-2">
            {files.map((file: any, i: number) => {
              const Icon = getFileIcon(file.mime_type || '');
              const typeCfg = getTypeCfg(file.mime_type || '');
              return (
                <motion.div
                  key={file.id || i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-zinc-700 dark:border-slate-700/60
                             bg-white dark:bg-zinc-900 dark:bg-slate-900 hover:shadow-sm transition-shadow group"
                >
                  <div className={`p-2.5 rounded-xl ${typeCfg.bg} flex-shrink-0`}>
                    <Icon size={18} className={typeCfg.text} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100 dark:text-slate-200 truncate">
                      {file.filename || file.fileName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${typeCfg.bg} ${typeCfg.text}`}>
                        {typeCfg.label}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 dark:text-zinc-400">{formatBytes(file.file_size)}</span>
                      {file.created_at && (
                        <span className="text-xs text-slate-400 dark:text-slate-500 dark:text-zinc-400">
                          {new Date(file.created_at).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                    {file.description && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-zinc-400 mt-0.5 truncate">{file.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {(file.file_url || file.fileUrl) && (
                      <a
                        href={file.file_url || file.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        <Download size={14} />
                      </a>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
