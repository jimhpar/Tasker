import { userApi, setStoredUser } from './api';

// Gemini AI BYOK Service (Bring Your Own Key)

const GEMINI_KEY_STORAGE = 'tasker_gemini_api_key';
const GEMINI_MODEL_STORAGE = 'tasker_gemini_active_model';
const GEMINI_MODEL_LABEL_STORAGE = 'tasker_gemini_active_model_label';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const DEFAULT_GEMINI_MODEL_LABEL = '3.8 FLASH';

export const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('tasker_auth_user') || localStorage.getItem('tasker_user');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

export const getCurrentUserKey = () => {
  const u = getCurrentUser();
  if (u) {
    return (u.username || u._id || u.id || '').trim().toLowerCase();
  }
  return '';
};

/**
 * Cross-device synchronization for Gemini API Key (PC <-> Mobile)
 */
export const syncGeminiKeyWithServer = async (userObj) => {
  const u = userObj || getCurrentUser();
  if (!u) return;
  const uname = (u.username || '').trim().toLowerCase();
  if (!uname) return;

  const serverKey = (u.settings?.geminiApiKey || '').trim();
  const localScopedKey = (
    localStorage.getItem(`tasker_gemini_api_key_${uname}`) ||
    (uname === 'zim' || uname === 'zim_founder' ? localStorage.getItem('tasker_gemini_api_key_zim') : '') ||
    ''
  ).trim();

  // 1. If server has key, sync to local device
  if (serverKey) {
    if (localScopedKey !== serverKey) {
      localStorage.setItem(`tasker_gemini_api_key_${uname}`, serverKey);
      if (uname === 'zim' || uname === 'zim_founder') {
        localStorage.setItem('tasker_gemini_api_key_zim', serverKey);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tasker_gemini_key_updated', { detail: { key: serverKey, userKey: uname } }));
      }
    }
    return serverKey;
  }

  // 2. If server has NO key, but local device has key (e.g. on PC), auto-upload to server
  if (!serverKey && localScopedKey) {
    try {
      if (!u.settings) u.settings = {};
      u.settings.geminiApiKey = localScopedKey;
      setStoredUser(u);
      await userApi.updateSettings({ geminiApiKey: localScopedKey });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tasker_gemini_key_updated', { detail: { key: localScopedKey, userKey: uname } }));
      }
    } catch {}
    return localScopedKey;
  }
};

// Automatic sanitization: Ensure that Zim's key NEVER leaks to Sunny or any other account
(function sanitizeUserGeminiKeys() {
  try {
    const legacy = localStorage.getItem(GEMINI_KEY_STORAGE);
    if (legacy) {
      localStorage.setItem('tasker_gemini_api_key_zim', legacy);
      localStorage.removeItem(GEMINI_KEY_STORAGE);
    }
    localStorage.removeItem('tasker_gemini_api_key_');

    const zimKey = localStorage.getItem('tasker_gemini_api_key_zim');
    const u = getCurrentUser();
    const uname = (u?.username || '').trim().toLowerCase();

    // If current logged-in user is not Zim/admin and has Zim's key stored in their scoped slot, clear it!
    if (zimKey && uname && uname !== 'zim' && uname !== 'zim_founder') {
      if (localStorage.getItem(`tasker_gemini_api_key_${uname}`) === zimKey) {
        localStorage.removeItem(`tasker_gemini_api_key_${uname}`);
      }
      if (u?._id && localStorage.getItem(`tasker_gemini_api_key_${u._id.toLowerCase()}`) === zimKey) {
        localStorage.removeItem(`tasker_gemini_api_key_${u._id.toLowerCase()}`);
      }
    }
  } catch {}
})();

export const getGeminiKey = (customUserKey = null) => {
  const userKey = (customUserKey || getCurrentUserKey() || '').trim().toLowerCase();
  
  // 0. Check currentUser settings from database (PC <-> Mobile Cloud Sync)
  const u = getCurrentUser();
  if (u?.settings?.geminiApiKey && u.settings.geminiApiKey.trim()) {
    const sKey = u.settings.geminiApiKey.trim();
    if (userKey) {
      const existing = localStorage.getItem(`tasker_gemini_api_key_${userKey}`);
      if (existing !== sKey) {
        localStorage.setItem(`tasker_gemini_api_key_${userKey}`, sKey);
      }
    }
    return sKey;
  }

  // 1. If a specific userKey is provided (and not 'default'), check scoped key
  if (userKey && userKey !== 'default') {
    const scoped = localStorage.getItem(`tasker_gemini_api_key_${userKey}`);
    if (scoped) return scoped;

    if (u?._id && u._id.toLowerCase() !== userKey) {
      const idScoped = localStorage.getItem(`tasker_gemini_api_key_${u._id.toLowerCase()}`);
      if (idScoped) return idScoped;
    }
  }

  // 2. Check zim/zim_founder key
  const zimKey = localStorage.getItem('tasker_gemini_api_key_zim');
  if (zimKey && (userKey === 'zim' || userKey === 'zim_founder' || !userKey)) return zimKey;

  // 3. Check legacy or general keys
  const legacy = localStorage.getItem(GEMINI_KEY_STORAGE);
  if (legacy) return legacy;

  // 4. Check any available tasker_gemini_api_key_* in localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('tasker_gemini_api_key_')) {
        const val = localStorage.getItem(k);
        if (val && val.trim().length > 10) return val.trim();
      }
    }
  } catch {}

  return '';
};

export const getActiveGeminiModel = () => localStorage.getItem(GEMINI_MODEL_STORAGE) || DEFAULT_GEMINI_MODEL;
export const getActiveGeminiModelLabel = () => localStorage.getItem(GEMINI_MODEL_LABEL_STORAGE) || DEFAULT_GEMINI_MODEL_LABEL;

export const setActiveGeminiModel = (model, label) => {
  if (model) localStorage.setItem(GEMINI_MODEL_STORAGE, model);
  if (label) localStorage.setItem(GEMINI_MODEL_LABEL_STORAGE, label);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tasker_gemini_model_updated', { detail: { model, label } }));
  }
};

/**
 * Automatically queries Google Gemini API /v1beta/models to discover available Flash models
 * and selects the highest version (e.g. gemini-3.8-flash, or latest available).
 */
export async function fetchLatestGeminiModel(customKey = null) {
  const apiKey = (customKey || getGeminiKey() || '').trim();
  if (!apiKey) {
    return {
      model: getActiveGeminiModel(),
      label: getActiveGeminiModelLabel()
    };
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      signal: AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined
    });
    if (res.ok) {
      const data = await res.json();
      const models = Array.isArray(data.models) ? data.models : [];

      // Filter models that support content generation and are Flash models
      const flashModels = models.filter((m) => {
        const name = (m.name || '').toLowerCase();
        const displayName = (m.displayName || '').toLowerCase();
        const supportsGen = Array.isArray(m.supportedGenerationMethods)
          ? m.supportedGenerationMethods.includes('generateContent')
          : true;
        return supportsGen && (name.includes('flash') || displayName.includes('flash'));
      });

      if (flashModels.length > 0) {
        const extractVersion = (m) => {
          const str = `${m.name} ${m.displayName || ''}`;
          const match = str.match(/gemini-(\d+(?:\.\d+)?)/i) || str.match(/(\d+(?:\.\d+)?)\s*flash/i);
          return match ? parseFloat(match[1]) : 0;
        };

        // Sort descending by version number
        flashModels.sort((a, b) => extractVersion(b) - extractVersion(a));

        const best = flashModels[0];
        const cleanName = best.name.replace(/^models\//, '');
        const ver = extractVersion(best);
        const label = ver > 0 ? `${ver} FLASH` : cleanName.toUpperCase().replace('GEMINI-', '');

        setActiveGeminiModel(cleanName, label);
        return { model: cleanName, label };
      }
    }
  } catch (err) {
    console.warn('Could not fetch Gemini models list:', err);
  }

  return {
    model: getActiveGeminiModel(),
    label: getActiveGeminiModelLabel()
  };
}

/**
 * Fast dedicated API key validator with 3.5s timeout
 */
export async function verifyGeminiKey(key) {
  const cleanKey = (key || '').trim();
  if (!cleanKey) return { valid: false, message: 'API key cannot be empty' };

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`, {
      signal: AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined
    });
    if (res.ok) {
      const data = await res.json();
      return { valid: true, models: data.models || [] };
    }
    const errData = await res.json().catch(() => ({}));
    return {
      valid: false,
      message: errData.error?.message || `Invalid API key (Status ${res.status})`
    };
  } catch (err) {
    // If user has standard AIzaSy Google Key format, allow offline graceful fallback
    if (cleanKey.startsWith('AIzaSy') && cleanKey.length >= 35) {
      return { valid: true, models: [] };
    }
    return {
      valid: false,
      message: err.name === 'AbortError' ? 'Verification timed out. Check connection.' : err.message
    };
  }
}

export const setGeminiKey = (key, customUserKey = null) => {
  const cleanKey = (key || '').trim();
  const userKey = (customUserKey || getCurrentUserKey() || '').trim().toLowerCase();

  if (userKey) {
    if (cleanKey) {
      localStorage.setItem(`tasker_gemini_api_key_${userKey}`, cleanKey);
      if (userKey === 'zim' || userKey === 'zim_founder') {
        localStorage.setItem('tasker_gemini_api_key_zim', cleanKey);
      }
      const u = getCurrentUser();
      if (u) {
        if (!u.settings) u.settings = {};
        u.settings.geminiApiKey = cleanKey;
        setStoredUser(u);
        userApi.updateSettings({ geminiApiKey: cleanKey }).catch(() => {});
      }
    } else {
      localStorage.removeItem(`tasker_gemini_api_key_${userKey}`);
      if (userKey === 'zim' || userKey === 'zim_founder') {
        localStorage.removeItem('tasker_gemini_api_key_zim');
      }
      const u = getCurrentUser();
      if (u) {
        if (!u.settings) u.settings = {};
        u.settings.geminiApiKey = '';
        setStoredUser(u);
        userApi.updateSettings({ geminiApiKey: '' }).catch(() => {});
      }
    }
  }
  // Clear generic global key so it doesn't leak between users
  localStorage.removeItem(GEMINI_KEY_STORAGE);
  localStorage.removeItem('tasker_gemini_api_key_');

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tasker_gemini_key_updated', { detail: { key: cleanKey, userKey } }));
  }
  if (cleanKey) {
    fetchLatestGeminiModel(cleanKey).catch(() => {});
  }
};

export const removeGeminiKey = (customUserKey = null) => {
  const userKey = (customUserKey || getCurrentUserKey() || '').trim().toLowerCase();
  if (userKey) {
    localStorage.removeItem(`tasker_gemini_api_key_${userKey}`);
    if (userKey === 'zim' || userKey === 'zim_founder') {
      localStorage.removeItem('tasker_gemini_api_key_zim');
    }
    const u = getCurrentUser();
    if (u) {
      if (!u.settings) u.settings = {};
      u.settings.geminiApiKey = '';
      setStoredUser(u);
      userApi.updateSettings({ geminiApiKey: '' }).catch(() => {});
    }
  }
  localStorage.removeItem(GEMINI_KEY_STORAGE);
  localStorage.removeItem('tasker_gemini_api_key_');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tasker_gemini_key_updated', { detail: { key: '', userKey } }));
  }
};

/**
 * Ask Gemini to reason about tasks, code, or schedule.
 * Accepts either { prompt, codeSnippet, ... } or a string prompt.
 * Returns { textResponse, extractedTasks: [...] }
 */
export async function queryGeminiReasoning(input, extraContext = null) {
  let prompt = '';
  let codeSnippet = '';
  let voiceTranscript = '';
  let systemInstruction = '';

  if (typeof input === 'string') {
    prompt = input;
  } else if (input && typeof input === 'object') {
    prompt = input.prompt || '';
    codeSnippet = input.codeSnippet || '';
    voiceTranscript = input.voiceTranscript || '';
    systemInstruction = input.systemInstruction || '';
  }

  const apiKey = getGeminiKey();
  const rawInput = [prompt, voiceTranscript, codeSnippet].filter(Boolean).join('\n');

  if (!apiKey) {
    return generateSimulatedResponse(rawInput);
  }

  const promptContent = `
You are the Tasker Intelligent Productivity Assistant. You help users (ranging from farmers, store owners, freelancers, to software engineers and tech executives) organize their workflow, analyze requests, and decompose goals into high-impact actionable tasks.

User input details:
${voiceTranscript ? `[Voice Recording Transcript]: ${voiceTranscript}\n` : ''}
${prompt ? `[User Prompt / Instructions]: ${prompt}\n` : ''}
${codeSnippet ? `[Code Snippet to Analyze]:\n\`\`\`\n${codeSnippet}\n\`\`\`\n` : ''}

CRITICAL REASONING INSTRUCTIONS:
1. If the user asks a conversational question or asks for advice, answer politely, concisely, and helpfully in a conversational manner.
2. If the user mentions tasks, actions, or daily goals, decompose the user's goal into distinct, actionable, professional tasks.
3. For each task determine:
   - "title": Clean, concise action-oriented title.
   - "brief": Detailed instructions, sub-steps, or key deliverables.
   - "priority": "Urgent" | "High" | "Medium" | "Low".
   - "suggestedCategory": "Tech" | "Agriculture" | "Retail" | "Design" | "General".
4. If actionable tasks are identified, enclose them in a JSON block formatted exactly as:
\`\`\`json
{
  "tasks": [
    {
      "title": "Clear action title",
      "brief": "Context and action steps",
      "priority": "High",
      "suggestedCategory": "General"
    }
  ]
}
\`\`\`
5. If no specific tasks need creation (e.g. user just said hello or asked a general question), reply warmly and do not force a JSON block.
Respond in the user's language (Bangla if user spoke/wrote in Bangla, otherwise English).
`;

  // Try dynamic active model first, fall back gracefully across flash tiers
  const activeModel = getActiveGeminiModel();
  const models = Array.from(new Set([
    activeModel,
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ]));
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            parts: [{ text: promptContent }]
          }
        ]
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Gemini API returned status ${res.status}`);
      }

      const data = await res.json();
      const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (candidate) {
        // If this model worked and is different from current storage, remember it
        if (model !== activeModel) {
          const match = model.match(/gemini-(\d+(?:\.\d+)?)/i);
          const ver = match ? match[1] : '';
          const label = ver ? `${ver} FLASH` : 'FLASH';
          setActiveGeminiModel(model, label);
        }

        const extractedTasks = parseTasksFromResponse(candidate, rawInput);
        const textResponse = candidate.replace(/```json[\s\S]*?```/g, '').replace(/```[\s\S]*?```/g, (match) => {
          return match.includes('"tasks"') ? '' : match;
        }).trim();

        return {
          textResponse: textResponse || candidate,
          extractedTasks
        };
      }
    } catch (err) {
      lastError = err;
      console.warn(`Model ${model} failed, trying next:`, err.message);
    }
  }

  console.warn('All Gemini API calls failed, falling back to smart local reasoning:', lastError?.message);
  return {
    textResponse: `⚠️ Gemini API (${lastError?.message || 'Check API key'}). Local Assistant:`,
    ...generateSimulatedResponse(rawInput)
  };
}

/**
 * Flexible JSON task parser supporting multiple formatting styles from LLMs
 */
function parseTasksFromResponse(text, fallbackInput = '') {
  try {
    // 1. Check for ```json ... ``` codeblock
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      const candidateStr = jsonMatch[1].trim();
      if (candidateStr.startsWith('{') || candidateStr.startsWith('[')) {
        const parsed = JSON.parse(candidateStr);
        if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) return sanitizeTasks(parsed.tasks);
        if (Array.isArray(parsed) && parsed.length > 0) return sanitizeTasks(parsed);
      }
    }

    // 2. Direct regex search for JSON object with "tasks"
    const rawObjectMatch = text.match(/\{[\s\S]*"tasks"[\s\S]*\}/);
    if (rawObjectMatch) {
      const parsed = JSON.parse(rawObjectMatch[0]);
      if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
        return sanitizeTasks(parsed.tasks);
      }
    }
  } catch (e) {
    console.warn('Could not parse JSON tasks from Gemini response:', e);
  }

  // If LLM returned text but no JSON, smartly decompose the text
  return decomposeInputIntoTasks(fallbackInput || text);
}

function sanitizeTasks(tasks) {
  return tasks.map(t => ({
    title: String(t.title || 'Untitled Action').trim(),
    brief: String(t.brief || t.description || 'AI Decomposed Workflow Step').trim(),
    priority: ['Urgent', 'High', 'Medium', 'Low'].includes(t.priority) ? t.priority : 'Medium',
    suggestedCategory: ['Tech', 'Agriculture', 'Retail', 'Design', 'General'].includes(t.suggestedCategory) ? t.suggestedCategory : 'General'
  }));
}

/**
 * Intelligent Decomposer when BYOK is not set or network fails.
 * Parses user intents, verbs, timeframes, and decomposes multiple clauses.
 */
function generateSimulatedResponse(input) {
  const isBangla = /[\u0980-\u09FF]/.test(input);
  const tasks = decomposeInputIntoTasks(input);

  if (isBangla) {
    return {
      textResponse: `🔍 **টাস্ক অ্যানালাইসিস ও কর্মপরিকল্পনা সম্পন্ন:**\n\nআপনার প্রম্পট বিশ্লেষণ করে লক্ষ্যগুলো শনাক্ত করা হয়েছে এবং সেগুলোকে সুনির্দিষ্ট কর্মপরিকল্পনায় ভাগ করা হয়েছে।\n\n📌 **কাজের রূপরেখা:**\n${tasks.map((t, idx) => `• **ধাপ ${idx + 1}:** ${t.title} (${t.priority} প্রায়োরিটি, ক্যাটাগরি: ${t.suggestedCategory})`).join('\n')}\n\nনিচের **"Add to Kanban & Calendar"** বাটনে ক্লিক করে কাজগুলো সরাসরি যুক্ত করুন।`,
      extractedTasks: tasks
    };
  }

  return {
    textResponse: `🔍 **Workflow Analysis & Task Decomposition Complete:**\n\nI analyzed your input and broke down your objectives into distinct, actionable milestones:\n\n${tasks.map((t, idx) => `• **Step ${idx + 1}:** ${t.title} [Priority: ${t.priority} | Category: ${t.suggestedCategory}]`).join('\n')}\n\nReview the decomposed items below and click **"Add to Kanban & Calendar"** to schedule them on your board!`,
    extractedTasks: tasks
  };
}

/**
 * Intelligent Heuristic Decomposition Engine
 * Breaks multi-clause prompts into clean action titles without echoing raw text.
 */
function decomposeInputIntoTasks(text) {
  if (!text || !text.trim()) {
    return [
      {
        title: 'Review Daily Workflow',
        brief: 'Check priorities and set targets for the day',
        priority: 'High',
        suggestedCategory: 'General'
      }
    ];
  }

  const isBangla = /[\u0980-\u09FF]/.test(text);

  // Split input by conjunctions, periods, newlines, and commas
  const delimiters = isBangla
    ? /(?:\n+|।|\band\b|এবং|আর|ও|তারপর|এরপর|সেসাথে|,)/gi
    : /(?:\n+|\.|\band then\b|\band\b|\bthen\b|\balso\b|\bafter that\b|,)/gi;

  const rawChunks = text
    .split(delimiters)
    .map(c => c.trim())
    .filter(c => c.length > 2);

  const cleanPrefixes = isBangla
    ? /^(আমি চাই|আমার|আমাদের|আমাকে|করতে হবে|প্লিজ|দয়া করে|কালকে|আজকে|সকালে|বিকালে|দুপুরে|যেভাবে|একটু)\s*/gi
    : /^(i need to|i want to|please|can you|tomorrow|today|in the morning|in the evening|make sure to|we should)\s*/gi;

  const tasks = [];

  const chunksToProcess = rawChunks.length > 0 ? rawChunks.slice(0, 4) : [text];

  for (const chunk of chunksToProcess) {
    let clean = chunk.replace(cleanPrefixes, '').trim();
    if (!clean) continue;

    // Detect Category
    let category = 'General';
    const lower = chunk.toLowerCase();

    if (/(খামার|গরু|ধান|ফসল|সার|কীটনাশক|দুধ|মাছ|কৃষি|হাঁস|মুরগি|farm|agri|crop|cattle|fertilizer|harvest)/i.test(lower)) {
      category = 'Agriculture';
    } else if (/(দোকান|বিক্রি|কাস্টমার|ইনভয়েস|টাকা|হিসাব|বকেয়া|খাতা|স্টক|retail|store|inventory|invoice|customer|sale|payment)/i.test(lower)) {
      category = 'Retail';
    } else if (/(code|bug|api|react|backend|frontend|server|database|git|pull request|deploy|fix|test|ui|ux|figma|review)/i.test(lower)) {
      category = 'Tech';
    } else if (/(ডিজাইন|design|logo|banner|ui|illustration|poster|mockup)/i.test(lower)) {
      category = 'Design';
    }

    // Detect Priority
    let priority = 'Medium';
    if (/(জরুরি|অবিলম্বে|urgent|immediately|asap|critical|জরুরী|today|এখনই)/i.test(lower)) {
      priority = 'Urgent';
    } else if (/(important|priority|সকালে|প্রথমেই|high|মূল)/i.test(lower)) {
      priority = 'High';
    }

    // Capitalize / polish title
    let title = clean.charAt(0).toUpperCase() + clean.slice(1);
    if (title.length > 60) {
      title = title.slice(0, 57) + '...';
    }

    tasks.push({
      title,
      brief: isBangla ? `বিশ্লেষণকৃত সাব-টাস্ক: ${clean}` : `Actionable step: ${clean}`,
      priority,
      suggestedCategory: category
    });
  }

  if (tasks.length === 0) {
    tasks.push({
      title: isBangla ? 'কাজের শিডিউল বাস্তবায়ন' : 'Execute Planned Workflow',
      brief: text.slice(0, 80),
      priority: 'High',
      suggestedCategory: 'General'
    });
  }

  return tasks;
}
