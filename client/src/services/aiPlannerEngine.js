// Tasker Intelligent AI Planner Engine
// Handles: Daily schedule parsing, smart time slot assignment, conversational revision, and Gemini reasoning

import { getGeminiKey, getActiveGeminiModel } from './gemini';

// Helper to convert 12h/24h or Bengali time expressions into "HH:mm" 24h format
export function parseTimeString(raw) {
  if (!raw) return null;
  const str = raw.toLowerCase().trim();

  // Handle Bengali words
  let isPM = str.includes('বিকাল') || str.includes('দুপুর') || str.includes('সন্ধ্যা') || str.includes('রাত') || str.includes('pm');
  let isAM = str.includes('সকাল') || str.includes('ভোর') || str.includes('am');

  // Extract digits
  // Convert Bengali numerals to English
  const bnToEnMap = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
  const normalized = str.replace(/[০-৯]/g, d => bnToEnMap[d]);

  const match = normalized.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;

  if (isPM && hours < 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }

  // Sanity check: if hours <= 5 and no AM/PM specified, afternoon/evening is almost always intended (e.g. "4 tay meeting" = 16:00)
  if (!isAM && !isPM && hours >= 1 && hours <= 6) {
    hours += 12;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Format "HH:mm" to 12-hour AM/PM string
export function formatTime12h(time24) {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

// Generate intelligent default slots if user did not specify any time
const DEFAULT_DAY_SLOTS = [
  { start: '09:30', end: '11:00', priority: 'High', category: 'Focus Work' },
  { start: '11:30', end: '01:00', priority: 'Urgent', category: 'Meetings & Clients' },
  { start: '14:30', end: '16:00', priority: 'High', category: 'Development' },
  { start: '16:30', end: '18:00', priority: 'Medium', category: 'Operations' },
  { start: '19:00', end: '20:30', priority: 'Medium', category: 'Personal & Review' },
  { start: '21:00', end: '22:00', priority: 'Low', category: 'Wrap-up' }
];

// Offline Intelligent NLP Rule-based Schedule Generator
export function generateOfflinePlan(userPrompt, existingPlan = null) {
  const text = userPrompt.trim();

  // If there's an existing plan, check if user is asking for a revision
  if (existingPlan && existingPlan.length > 0) {
    const isRevision = /(ta|tay|time|change|shift|koro|dao|daw|pm|am|\d)/i.test(text);
    if (isRevision) {
      return applyConversationalRevision(existingPlan, text);
    }
  }

  // Split into candidate tasks
  // Handles newlines, numbering (1., 2.), and connectors like "and", "ar", "erpor", "tarpor", ","
  let rawItems = text
    .split(/\n|\r|\d+\.|\b(?:and|ar|erpor|tarpor|then)\b|,|;/i)
    .map(s => s.trim())
    .filter(s => s.length > 2);

  if (rawItems.length === 0) {
    rawItems = [text];
  }

  const plannedTasks = rawItems.map((item, idx) => {
    const detectedTime = parseTimeString(item);
    const slot = DEFAULT_DAY_SLOTS[idx % DEFAULT_DAY_SLOTS.length];

    let start = detectedTime || slot.start;
    // Calculate end time + 1h 30m by default
    const [sh, sm] = start.split(':').map(Number);
    let eh = sh + 1;
    let em = sm + 30;
    if (em >= 60) {
      eh += 1;
      em -= 60;
    }
    if (eh >= 24) eh = 23;
    const end = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;

    // Clean title from time references
    let cleanTitle = item
      .replace(/(\d{1,2}(?::\d{2})?\s*(?:am|pm|ta|tay|টায়)?)/gi, '')
      .replace(/^(সকাল|দুপুর|বিকাল|সন্ধ্যা|রাত)\s*/i, '')
      .trim();

    if (!cleanTitle) cleanTitle = item;

    // Detect priority
    let priority = slot.priority;
    if (/urgent|জরুরি|immediately|client|boss|meeting|deadline/i.test(item)) {
      priority = 'Urgent';
    } else if (/high|গুরুত্বপূর্ণ|review|deliver/i.test(item)) {
      priority = 'High';
    }

    return {
      id: 'plan_task_' + (idx + 1) + '_' + Date.now(),
      title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
      brief: `AI Planned Task scheduled for ${formatTime12h(start)} - ${formatTime12h(end)}`,
      startTime: start,
      endTime: end,
      priority,
      category: slot.category,
      engageAI: true,
      selected: true
    };
  });

  return plannedTasks.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

// Conversational Schedule Revision: Updates specific task time slot on user demand
export function applyConversationalRevision(existingPlan, revisionPrompt) {
  const text = revisionPrompt.toLowerCase();
  const requestedTime = parseTimeString(text);

  let updatedList = existingPlan.map(task => ({ ...task }));

  if (requestedTime) {
    // Find the task mentioned in the revision prompt
    let targetIndex = -1;
    let maxMatchScore = 0;

    updatedList.forEach((task, idx) => {
      const words = task.title.toLowerCase().split(/\s+/);
      let matchCount = 0;
      words.forEach(w => {
        if (w.length > 2 && text.includes(w)) matchCount++;
      });
      if (matchCount > maxMatchScore) {
        maxMatchScore = matchCount;
        targetIndex = idx;
      }
    });

    // If no specific match, default to first task or most relevant
    if (targetIndex === -1 && updatedList.length > 0) {
      targetIndex = 0;
    }

    if (targetIndex >= 0) {
      const target = updatedList[targetIndex];
      target.startTime = requestedTime;
      const [sh, sm] = requestedTime.split(':').map(Number);
      let eh = sh + 1;
      let em = sm + 30;
      if (em >= 60) { eh += 1; em -= 60; }
      if (eh >= 24) eh = 23;
      target.endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
      target.brief = `AI Rescheduled to ${formatTime12h(requestedTime)} per your request`;
    }
  }

  return updatedList.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

// Main Planner Function (uses Gemini API when key is configured, with seamless offline fallback)
export async function planDailyTasks(userPrompt, existingPlan = null) {
  const geminiKey = getGeminiKey();

  if (!geminiKey) {
    return generateOfflinePlan(userPrompt, existingPlan);
  }

  try {
    const systemPrompt = `You are Tasker AI Planner, a world-class productivity expert.
Your job is to take the user's daily notes, thoughts, or requests (which can be in English or Bengali), and output a structured JSON array of planned tasks.
Rules:
1. If the user didn't mention specific times, suggest realistic, chronologically ordered start and end times across the day (24h format "HH:mm").
2. Assign reasonable priorities ('Urgent', 'High', 'Medium', 'Low').
3. If this is a revision of an existing plan, update the requested task's time and maintain the rest.
4. Output ONLY valid JSON array with NO markdown fences, matching this schema:
[
  {
    "title": "Task title in clean language",
    "brief": "Short description with time details",
    "startTime": "09:30",
    "endTime": "11:00",
    "priority": "High",
    "category": "Development"
  }
]`;

    const contextMessage = existingPlan
      ? `Existing Plan: ${JSON.stringify(existingPlan)}\nUser Request: ${userPrompt}`
      : `User's Day Plan: ${userPrompt}`;

    const activeModel = getActiveGeminiModel();
    const candidateModels = Array.from(new Set([
      activeModel,
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ]));

    let parsed = null;
    for (const model of candidateModels) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              { role: 'user', parts: [{ text: `${systemPrompt}\n\n${contextMessage}` }] }
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 1000
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          let textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          textResponse = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
          parsed = JSON.parse(textResponse);
          if (Array.isArray(parsed) && parsed.length > 0) {
            break;
          }
        }
      } catch (e) {
        // try next model
      }
    }

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item, idx) => ({
        id: 'plan_task_' + (idx + 1) + '_' + Date.now(),
        title: item.title,
        brief: item.brief || `AI Scheduled for ${formatTime12h(item.startTime)}`,
        startTime: item.startTime,
        endTime: item.endTime,
        priority: item.priority || 'Medium',
        category: item.category || 'General',
        engageAI: true,
        selected: true
      })).sort((a, b) => a.startTime.localeCompare(b.startTime));
    }

    return generateOfflinePlan(userPrompt, existingPlan);
  } catch (err) {
    console.warn('Gemini AI Planner failed, using offline heuristic parser:', err);
    return generateOfflinePlan(userPrompt, existingPlan);
  }
}
