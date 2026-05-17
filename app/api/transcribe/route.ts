import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';
export const maxDuration = 60;
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) return NextResponse.json({ error: 'Clé manquante' }, { status: 401 });
  const openai = new OpenAI({ apiKey });
  const transcription = await openai.audio.transcriptions.create({
    file: await toFile(file),
    model: 'whisper-1',
    prompt: "Transcription Arabe, Darija marocain et Français.",
  });
  return NextResponse.json({ text: transcription.text });
}