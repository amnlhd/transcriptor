'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Download, Trash2, FileAudio, CheckCircle, Loader2, AlertCircle, Key, Settings } from 'lucide-react';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

const CHUNK_SIZE = 24 * 1024 * 1024; // 24 MB

async function transcribeChunk(chunk: Blob, apiKey: string, language: string, index: number): Promise<string> {
  const formData = new FormData();
  formData.append('file', new File([chunk], `chunk_${index}.mp3`, { type: 'audio/mpeg' }));
  formData.append('model', 'whisper-1');
  if (language !== 'auto') formData.append('language', language);

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Erreur OpenAI');
  }

  const json = await res.json();
  return json.text;
}

export default function TranscriptionApp() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);

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
      language: 'ar',
    }));
    setJobs(prev => [...prev, ...newFiles]);
  };

  const updateJob = (id: string, updates: any) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j));
  };

  const processJob = async (job: any) => {
    try {
      updateJob(job.id, { status: 'transcribing', progress: 5 });

      const file: File = job.file;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const results: string[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const text = await transcribeChunk(chunk, apiKey, job.language, i);
        results.push(text);

        const progress = Math.round(((i + 1) / totalChunks) * 90) + 5;
        updateJob(job.id, { progress });
      }

      updateJob(job.id, { status: 'done', progress: 100, result: results.join(' ') });
    } catch (err: any) {
      updateJob(job.id, { status: 'error', error: err.message });
    }
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
        <header className="flex justify-between items-center mb-10 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Whisper Transcribe PRO
            </h1>
            <p className="text-slate-500 text-sm">Arabe, Darija, Français - Fichiers lourds supportés</p>
          </div>
          <button onClick={() => setShowKeyModal(true)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <Settings className="text-slate-600" />
          </button>
        </header>

        <div className="bg-white border-2 border-dashed border-blue-200 rounded-3xl p-10 text-center hover:border-blue-400 transition-all cursor-pointer mb-8 shadow-sm">
          <input type="file" multiple onChange={handleUpload} className="hidden" id="file-upload" accept="audio/*" />
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileAudio className="text-blue-600 w-8 h-8" />
            </div>
            <p className="text-lg font-semibold">Cliquez pour ajouter des audios</p>
            <p className="text-slate-400 text-sm">MP3, WAV, M4A - Taille illimitée</p>
          </label>
        </div>

        <div className="space-y-4">
          {jobs.map(job => (
            <div key={job.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${job.status === 'done' ? 'bg-green-50' : job.status === 'error' ? 'bg-red-50' : 'bg-slate-50'}`}>
                    {job.status === 'done' ? <CheckCircle className="text-green-500" /> :
                     job.status === 'error' ? <AlertCircle className="text-red-500" /> :
                     job.status === 'transcribing' ? <Loader2 className="text-blue-500 animate-spin" /> :
                     <FileAudio className="text-slate-400" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 truncate max-w-[200px] md:max-w-md">{job.file.name}</h3>
                    <p className="text-xs text-slate-400">
                      {(job.file.size / 1024 / 1024).toFixed(1)} MB •{' '}
                      {job.status === 'transcribing' ? `Transcription... ${job.progress}%` : job.status}
                    </p>
                    {job.status === 'error' && <p className="text-xs text-red-500 mt-1">{job.error}</p>}
                  </div>
                </div>

                <div className="flex gap-2 items-center">
                  {job.status === 'idle' && (
                    <>
                      <select
                        value={job.language}
                        onChange={(e) => updateJob(job.id, { language: e.target.value })}
                        className="text-sm border border-slate-200 rounded-lg px-2 py-1"
                      >
                        <option value="ar">Arabe / Darija</option>
                        <option value="fr">Français</option>
                        <option value="auto">Auto</option>
                      </select>
                      <button
                        onClick={() => processJob(job)}
                        className="bg-blue-600 text-white px-5 py-2 rounded-xl font-medium hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
                      >
                        Transcrire
                      </button>
                    </>
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

              {job.status === 'transcribing' && (
                <div className="mt-4">
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${job.progress}%` }} />
                  </div>
                </div>
              )}

              {job.status === 'done' && job.result && (
                <div className="mt-4 p-3 bg-slate-50 rounded-xl text-sm text-slate-700 max-h-40 overflow-y-auto">
                  {job.result}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {showKeyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-amber-100 p-2 rounded-lg"><Key className="text-amber-600" /></div>
              <h2 className="text-xl font-bold">Configuration OpenAI</h2>
            </div>
            <p className="text-slate-500 text-sm mb-6">
              Votre clé API est stockée uniquement dans votre navigateur. Elle est envoyée directement à OpenAI, jamais à un serveur intermédiaire.
            </p>
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