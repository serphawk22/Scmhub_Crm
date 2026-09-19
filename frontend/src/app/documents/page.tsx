"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileText, Loader2, Check, User, Building, Phone, Mail, Globe, Save, Camera, X, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import PageGuide from '@/components/PageGuide';
import { useLanguage } from "@/context/LanguageContext";

export default function DocumentsPage() {
  const { t } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    mobile: '',
    email: '',
    website: ''
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setResult(null);
      setOcrError(null);
    }
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert(t("documents.upload_prompt"));
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          if (blob) {
            const capturedFile = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
            setFile(capturedFile);
            setPreview(URL.createObjectURL(capturedFile));
            setResult(null);
            stopCamera();
          }
        }, 'image/jpeg');
      }
    }
  };

  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const MAX_DIMENSION = 1500;
          if (width > height) {
            if (width > MAX_DIMENSION) {
              height *= MAX_DIMENSION / width;
              width = MAX_DIMENSION;
            }
          } else {
            if (height > MAX_DIMENSION) {
              width *= MAX_DIMENSION / height;
              height = MAX_DIMENSION;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            resolve(blob as Blob);
          }, 'image/jpeg', 0.8);
        };
      };
    });
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setAnalyzing(true);
    setOcrError(null);
    setResult(null);

    try {
      const compressedBlob = await compressImage(file);

      const formDataPayload = new FormData();
      formDataPayload.append('file', compressedBlob, "image.jpg");

      const res = await fetch(`${API_BASE_URL}/documents/ocr`, {
        method: 'POST',
        body: formDataPayload,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        setOcrError(errData.detail || `Server error: ${res.status}`);
        return;
      }

      const data = await res.json();

      if (data.error) {
        setOcrError(`OCR Error: ${data.error}`);
        return;
      }

      setResult(data);
      setFormData({
        name: data.name || '',
        company_name: data.company_name || '',
        mobile: data.mobile || '',
        email: data.email || '',
        website: data.website || ''
      });
      setSaved(false);
    } catch (err: any) {
      console.error(err);
      setOcrError(`Network error: ${err.message || 'Could not connect to server'}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveAsLead = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: formData.company_name || 'Individual',
          websiteUrl: formData.website || '',
          email: formData.email,
          projectName: `OCR Lead - ${formData.name}`,
          tagline: `Extracted from business card for ${formData.name}`
        }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 5000);
      } else {
        const error = await res.json();
        alert(`Error: ${error.detail || 'Failed to save lead'}`);
      }
    } catch (err) {
      console.error(err);
      alert(t("documents.save_as_lead"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-xl border shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-50 mb-2 flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600" /> {t("documents.title")}
        </h1>
        <p className="text-gray-500 dark:text-zinc-400 mb-8">{t("documents.subtitle")}</p>

        <PageGuide
          pageKey="documents"
          title={t("documents.guide_title")}
          description={t("documents.guide_desc")}
          steps={[
            { icon: '📷', text: t("documents.guide_s1") },
            { icon: '🤖', text: t("documents.guide_s2") },
            { icon: '✏️', text: t("documents.guide_s3") },
            { icon: '💾', text: t("documents.guide_s4") },
          ]}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="space-y-4">
            {!isCameraOpen ? (
              <>
                <div className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center transition-colors relative h-64 ${file ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}>
                  {preview ? (
                    <img src={preview} alt="Preview" className="max-h-full rounded-lg shadow-sm object-contain" />
                  ) : (
                    <div className="text-gray-400">
                      <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm">{t("documents.upload_hint")}</p>
                      <p className="text-xs mt-2">{t("documents.upload_format")}</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={analyzing}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={startCamera}
                    disabled={analyzing}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 dark:text-zinc-200 rounded-lg font-bold hover:bg-gray-50 dark:bg-zinc-950 flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" /> {t("documents.use_camera")}
                  </button>
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing || !file}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("documents.analyzing")}</> : t("documents.analyze")}
                  </button>
                </div>
                {ocrError && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
                    <span className="font-bold">{t("documents.error_label")}</span>
                    <span>{ocrError}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden bg-black h-64 flex items-center justify-center">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
                  <canvas ref={canvasRef} className="hidden"></canvas>
                  <button
                    onClick={stopCamera}
                    className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={capturePhoto}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" /> {t("documents.capture_photo")}
                </button>
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="space-y-4">
            {result ? (
              <div className="bg-gray-50 dark:bg-zinc-950 p-6 rounded-xl border space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="font-bold text-gray-900 dark:text-zinc-50 flex items-center gap-2 border-b pb-2">
                  <Check className="w-4 h-4 text-green-600" /> {t("documents.extracted_details")}
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase flex items-center gap-1 mb-1">
                      <User className="w-3 h-3" /> {t("documents.field_name")}
                    </label>
                    <input
                      className="w-full p-2 border rounded-lg bg-white dark:bg-zinc-900"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase flex items-center gap-1 mb-1">
                      <Building className="w-3 h-3" /> {t("documents.field_company")}
                    </label>
                    <input
                      className="w-full p-2 border rounded-lg bg-white dark:bg-zinc-900"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase flex items-center gap-1 mb-1">
                      <Phone className="w-3 h-3" /> {t("documents.field_mobile")}
                    </label>
                    <input
                      className="w-full p-2 border rounded-lg bg-white dark:bg-zinc-900"
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase flex items-center gap-1 mb-1">
                      <Mail className="w-3 h-3" /> {t("documents.field_email")}
                    </label>
                    <input
                      className="w-full p-2 border rounded-lg bg-white dark:bg-zinc-900"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase flex items-center gap-1 mb-1">
                      <Globe className="w-3 h-3" /> {t("documents.field_website")}
                    </label>
                    <input
                      className="w-full p-2 border rounded-lg bg-white dark:bg-zinc-900"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveAsLead}
                  disabled={saving || !formData.email}
                  className={`w-full py-2 rounded-lg font-bold mt-4 flex items-center justify-center gap-2 transition-colors ${saved ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-green-600 text-white hover:bg-green-700'}`}
                >
                  {saving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {t("documents.saving")}</>
                  ) : saved ? (
                    <><CheckCircle2 className="w-4 h-4" /> {t("documents.lead_saved")}</>
                  ) : (
                    <><Save className="w-4 h-4" /> {t("documents.save_as_lead")}</>
                  )}
                </button>
                {!formData.email && <p className="text-[10px] text-red-500 text-center mt-1">{t("documents.email_required")}</p>}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 dark:border-zinc-800 rounded-xl p-8 text-center bg-gray-50 dark:bg-zinc-950">
                {analyzing ? (
                  <div className="space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                    <p>{t("documents.extracting")}</p>
                  </div>
                ) : (
                  <p>{t("documents.upload_prompt")}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
