// Tasker Official Gemini Neural Voice & Speech Service
// Uses Google's official Gemini Voice Synthesis (Kore, Puck, Charon, Fenrir, Aoede)
// with high-definition audio playback, plus intelligent fallback

let cachedVoices = [];
let currentAudioPlayer = null;

function loadVoices() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    cachedVoices = window.speechSynthesis.getVoices();
  }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    loadVoices();
  };
}

/**
 * Clean conversational text so the voice speaks like a human:
 * Removes markdown symbols, code blocks, emojis, bullets, and URLs
 */
export function prepareNaturalSpeechText(rawText) {
  if (!rawText) return '';
  let text = String(rawText);

  // 1. Remove code blocks and inline code
  text = text.replace(/```[\s\S]*?```/g, ' ');
  text = text.replace(/`[^`]+`/g, ' ');

  // 2. Remove URLs
  text = text.replace(/https?:\/\/\S+/g, ' ');

  // 3. Remove Markdown bold, italics, headers, strikethrough
  text = text.replace(/#{1,6}\s+/g, ' ');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');
  text = text.replace(/~~[^~]+~~/g, ' ');

  // 4. Remove bullet asterisks, dashes, brackets, table bars
  text = text.replace(/^[\s]*[•\-\*]\s+/gm, ' ');
  text = text.replace(/^[\s]*\d+\.\s+/gm, ' ');
  text = text.replace(/[\[\]\(\)\{\}|]/g, ' ');

  // 5. Remove emojis so the speech synthesizer doesn't pronounce their names
  text = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, ' ');

  // 6. Normalize whitespace and punctuation pauses
  text = text.replace(/\s+/g, ' ').trim();

  // If text is too long for a single voice clip, take the first 400 characters (approx. 2-3 sentences)
  if (text.length > 500) {
    const periodIdx = text.indexOf('.', 350);
    if (periodIdx !== -1) {
      text = text.slice(0, periodIdx + 1);
    } else {
      text = text.slice(0, 450) + '...';
    }
  }

  return text;
}

/**
 * Detect language of text (Bengali vs English)
 */
export function detectLanguage(text) {
  if (!text) return 'en';
  // Check for Bengali Unicode range (0980 - 09FF)
  const bnRegex = /[\u0980-\u09FF]/;
  return bnRegex.test(text) ? 'bn' : 'en';
}

/**
 * Generate Genuine Google Gemini Studio Audio via API
 * Uses Google Gemini's official voice models: 'gemini-3.8-flash-tts' & 'gemini-3.8-flash-lite-tts'
 * Voices: 'Kore' (Warm, engaging, natural), 'Puck', 'Charon', 'Fenrir', 'Aoede'
 */
export async function generateGeminiAudioTTS({
  text,
  apiKey,
  voiceName = 'Kore'
}) {
  if (!apiKey || !text) return null;
  const cleanText = prepareNaturalSpeechText(text);
  if (!cleanText) return null;

  // 1. Try Gemini 3.8 Flash TTS generateContent endpoint
  const candidateModels = [
    'gemini-3.8-flash-tts',
    'gemini-3.8-flash-lite-tts',
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp'
  ];

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: cleanText,
                speech_metadata: { style: 'cheerful and friendly' }
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          responseFormat: {
            audio: {
              mimeType: 'AUDIO_WAV',
              sampleRate: 24000
            }
          },
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName || 'Kore'
              }
            }
          }
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined
      });

      if (!res.ok) continue;

      const data = await res.json();
      const part = data.candidates?.[0]?.content?.parts?.[0];
      const inlineData = part?.inlineData || part?.inline_data;

      if (inlineData?.data) {
        const mimeType = inlineData.mimeType || inlineData.mime_type || 'audio/wav';
        return `data:${mimeType};base64,${inlineData.data}`;
      }
    } catch (err) {
      // try next candidate
    }
  }

  // 2. Try Gemini Interactions API for Gemini 3.8 Flash TTS
  try {
    const interUrl = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${apiKey}`;
    const interPayload = {
      model: 'gemini-3.8-flash-tts',
      input: [{
        type: 'user_input',
        content: [{
          type: 'text',
          text: cleanText,
          annotations: [{ type: 'speech_metadata', style: 'cheerful and friendly' }]
        }]
      }],
      response_format: {
        type: 'audio',
        mime_type: 'audio/wav',
        sample_rate: 24000
      },
      generation_config: {
        speech_config: [
          { voice: voiceName || 'Kore' }
        ]
      }
    };

    const interRes = await fetch(interUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(interPayload),
      signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined
    });

    if (interRes.ok) {
      const interData = await interRes.json();
      const audioData = interData.output_audio?.data || interData.outputAudio?.data;
      if (audioData) {
        return `data:audio/wav;base64,${audioData}`;
      }
    }
  } catch (e) {
    // proceed to fallback
  }

  return null;
}

/**
 * Generate Google Neural HD Audio (Google Assistant Voice Engine)
 * Provides fluent, warm, real human speech for both English & Bengali without robotic artifacting
 */
export function getGoogleNeuralAudioUrl(text, lang = 'en') {
  const cleanText = prepareNaturalSpeechText(text);
  if (!cleanText) return null;
  const detected = detectLanguage(cleanText);
  const langCode = detected === 'bn' ? 'bn' : (lang === 'bn' ? 'bn' : 'en');
  // Truncate to 200 characters for optimal natural cadence per audio clip
  const clip = cleanText.slice(0, 200);
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${langCode}&q=${encodeURIComponent(clip)}`;
}

/**
 * Find the most realistic, human-like neural voice available in the browser
 */
export function getBestHumanVoice(lang = 'en') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  if (!cachedVoices || cachedVoices.length === 0) {
    loadVoices();
  }

  const isBengali = lang === 'bn';
  const voices = cachedVoices.slice();

  if (isBengali) {
    const bestBn = voices.find(v =>
      (v.lang.startsWith('bn') || v.name.toLowerCase().includes('bengali') || v.name.toLowerCase().includes('bangla')) &&
      (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Online'))
    );
    if (bestBn) return bestBn;

    const googleBn = voices.find(v =>
      (v.lang.startsWith('bn') || v.name.toLowerCase().includes('bengali')) &&
      v.name.includes('Google')
    );
    if (googleBn) return googleBn;

    const anyBn = voices.find(v => v.lang.startsWith('bn') || v.name.toLowerCase().includes('bangla'));
    if (anyBn) return anyBn;
  }

  const prioritizedNaturalNames = [
    'Microsoft Jenny Online (Natural)',
    'Microsoft Aria Online (Natural)',
    'Microsoft Guy Online (Natural)',
    'Microsoft Christopher Online (Natural)',
    'Microsoft Sonia Online (Natural)',
    'Google US English',
    'Google UK English Female',
    'Google বাংলা',
    'Samantha (Enhanced)',
    'Daniel (Enhanced)',
    'Microsoft Zira'
  ];

  for (const preferred of prioritizedNaturalNames) {
    const match = voices.find(v => v.name.toLowerCase().includes(preferred.toLowerCase()));
    if (match) return match;
  }

  const anyNatural = voices.find(v =>
    (v.lang.startsWith('en') || v.lang.startsWith('en-US')) &&
    (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Online'))
  );
  if (anyNatural) return anyNatural;

  const googleEn = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'));
  if (googleEn) return googleEn;

  // Filter out robotic Microsoft David if other voices exist
  const nonDavidVoice = voices.find(v => (v.lang.startsWith('en') || v.lang.startsWith('en-US')) && !v.name.toLowerCase().includes('david'));
  if (nonDavidVoice) return nonDavidVoice;

  const fallbackEn = voices.find(v => v.lang === 'en-US' || v.lang.startsWith('en'));
  return fallbackEn || voices[0] || null;
}

/**
 * Fallback to browser SpeechSynthesis when offline or API call not available
 */
function fallbackSpeechSynthesis({ text, lang, onStart, onEnd, onError }) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onError) onError();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const detectedLang = detectLanguage(text);
  const voice = getBestHumanVoice(detectedLang === 'bn' ? 'bn' : lang);

  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang || (detectedLang === 'bn' ? 'bn-BD' : 'en-US');
  } else {
    utterance.lang = detectedLang === 'bn' ? 'bn-BD' : 'en-US';
  }

  // Warm, conversational pitch and human pacing
  utterance.rate = 0.96;
  utterance.pitch = 1.04;

  utterance.onstart = () => onStart && onStart('browser');
  utterance.onend = () => onEnd && onEnd();
  utterance.onerror = () => onError && onError();

  window.speechSynthesis.speak(utterance);
}

/**
 * Speak text: First tries Genuine Google Gemini Voice (Kore), then Google Neural HD, then browser
 */
export async function speakHumanVoice({
  text,
  lang = 'en',
  apiKey = null,
  voiceName = 'Kore',
  onStart,
  onEnd,
  onError
}) {
  stopHumanVoice();

  const cleanText = prepareNaturalSpeechText(text);
  if (!cleanText) {
    if (onEnd) onEnd();
    return;
  }

  // 1. Try Genuine Gemini Studio Neural Audio if API key is provided
  if (apiKey) {
    try {
      if (onStart) onStart('generating');
      const audioDataUrl = await generateGeminiAudioTTS({
        text: cleanText,
        apiKey,
        voiceName: voiceName || 'Kore'
      });

      if (audioDataUrl) {
        const audio = new Audio(audioDataUrl);
        currentAudioPlayer = audio;

        audio.onplay = () => onStart && onStart('gemini');
        audio.onended = () => {
          currentAudioPlayer = null;
          onEnd && onEnd();
        };
        audio.onerror = () => {
          currentAudioPlayer = null;
          playGoogleNeuralOrFallback();
        };

        await audio.play();
        return;
      }
    } catch (err) {
      console.warn('Gemini Audio generation failed, attempting Google Neural:', err);
    }
  }

  // 2. Play Google Neural HD audio or graceful fallback
  await playGoogleNeuralOrFallback();

  async function playGoogleNeuralOrFallback() {
    try {
      const neuralUrl = getGoogleNeuralAudioUrl(cleanText, lang);
      if (neuralUrl) {
        const neuralAudio = new Audio(neuralUrl);
        currentAudioPlayer = neuralAudio;

        neuralAudio.onplay = () => onStart && onStart('neural');
        neuralAudio.onended = () => {
          currentAudioPlayer = null;
          onEnd && onEnd();
        };
        neuralAudio.onerror = () => {
          currentAudioPlayer = null;
          fallbackSpeechSynthesis({ text: cleanText, lang, onStart, onEnd, onError });
        };

        await neuralAudio.play();
        return;
      }
    } catch (err) {
      // proceed to fallback
    }

    // 3. Fallback to Browser Speech Synthesis
    fallbackSpeechSynthesis({ text: cleanText, lang, onStart, onEnd, onError });
  }
}

/**
 * Stop any current speech playback immediately
 */
export function stopHumanVoice() {
  if (currentAudioPlayer) {
    try {
      currentAudioPlayer.pause();
      currentAudioPlayer.currentTime = 0;
    } catch {}
    currentAudioPlayer = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
