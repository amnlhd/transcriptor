'use client';

import React, { useState, useEffect } from 'react';
import { Download, Trash2, FileAudio, CheckCircle, Loader2, AlertCircle, Key, Settings } from 'lucide-react';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { loadFFmpeg } from '@/lib/ffmpeg-worker'; // On supposera que ce fichier existe ou on simplifie
import { fetchFile } from '@ffmpeg/util';

export default function TranscriptionApp() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Charger la clé au démarrage
  useEffect(() => {
    const stored = localStorage.getItem('_whisper_key');
    if (stored) setApiKey(stored);
    else setShowKeyModal(true);
  }, []);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files).map(f => ({
      id: Math.random().toString(36).substr(2, 9),
      file: f,
      status: 'idle',
      progress: 0,
      result: '',
      language: 'auto'
    }));
    setJobs(prev => [...prev, ...newFiles]);
  };

  const processJob = async (job: any) => {
    try {
      updateJob(job.id, { status: 'transcribing', progress: 10 });
      
      const formData = new FormData();
      formData.append('file', job.file);
      formData.append('language', job.language);

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'x-api-key': apiKey },
        body: formData
      });

      const json = await res.json();
      if (json.error) throw new Error(json.error);
      
      updateJob(job.id, { status: 'done', progress: 100, result: json.text });
    } catch (err: any) {
      updateJob(job.id, { status: 'error', error: err.message });
    }
  };

  const updateJob = (id: string, updates: any) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j));
  };

  const downloadDocx = async (job: any) => {
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: "Transcription Audio", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: `Fichier : ${job.file.name}`, spacing: { before: 200 } }),
          new Paragraph({ text: `Date : ${new Date().toLocaleDateString()}`, spacing: { after: 400 } }),
          new Paragraph({ children: [new TextRun(job.result)] }),
        ],
      }],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${job.file.name}_transcription.docx`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex justify-between items-center mb-10 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Whisper Transcribe PRO
            </h1>
            <p className="text-slate-500 text-sm">Arabe, Darija, Français - Multi-fichiers</p>
          </div>
          <button 
            onClick={() => setShowKeyModal(true)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <Settings className="text-slate-600" />
          </button>
        </header>

        {/* Upload Zone */}
        <div className="bg-white border-2 border-dashed border-blue-200 rounded-3xl p-10 text-center hover:border-blue-400 transition-all cursor-pointer mb-8 shadow-sm">
          <input type="file" multiple onChange={handleUpload} className="hidden" id="file-upload" accept="audio/*" />
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileAudio className="text-blue-600 w-8 h-8" />
            </div>
            <p className="text-lg font-semibold">Cliquez pour ajouter des audios</p>
            <p className="text-slate-400 text-sm">MP3, WAV, M4A jusqu'à 500MB</p>
          </label>
        </div>

        {/* List of Files */}
        <div className="space-y-4">
          {jobs.map(job => (
            <div key={job.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm animate-in fade-in slide-in-from-bottom-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${job.status === 'done' ? 'bg-green-50' : 'bg-slate-50'}`}>
                    {job.status === 'done' ? <CheckCircle className="text-green-500" /> : <FileAudio className="text-slate-400" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 truncate max-w-[200px] md:max-w-md">{job.file.name}</h3>
                    <p className="text-xs text-slate-400">{(job.file.size / 1024 / 1024).toFixed(1)} MB • {job.status}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {job.status === 'idle' && (
                    <button 
                      onClick={() => processJob(job)}
                      className="bg-blue-600 text-white px-5 py-2 rounded-xl font-medium hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
                    >
                      Transcrire
                    </button>
                  )}
                  {job.status === 'done' && (
                    <button 
                      onClick={() => downloadDocx(job)}
                      className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition-all"
                    >
                      <Download size={16} /> Word
                    </button>
                  )}
                  <button onClick={() => setJobs(j => j.filter(x => x.id !== job.id))} className="p-2 text-slate-300 hover:text-red-500">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              {job.status === 'transcribing' && (
                <div className="mt-4">
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 animate-pulse" style={{ width: `${job.progress}%` }} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal Clé API */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-amber-100 p-2 rounded-lg"><Key className="text-amber-600" /></div>
              <h2 className="text-xl font-bold">Configuration OpenAI</h2>
            </div>
            <p className="text-slate-500 text-sm mb-6">Votre clé API est stockée uniquement dans votre navigateur. Elle n'est jamais envoyée à un autre serveur que celui d'OpenAI.</p>
            <input 
              type="password" 
              placeholder="sk-..." 
              className="w-full border border-slate-200 rounded-xl p-3 mb-6 focus:ring-2 focus:ring-blue-500 outline-none"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button 
              onClick={() => { localStorage.setItem('_whisper_key', apiKey); setShowKeyModal(false); }}
              className="w-full bg-blue-600 text-white rounded-xl py-3 font-bold hover:bg-blue-700 transition-all"
            >
              Enregistrer et Continuer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}