// Tasker Autonomous Agent Context Memory & Continuous Learning Service
// Stores short-term and long-term user preferences, work habits, rules, and behavioral telemetry

const MEMORY_STORAGE_PREFIX = 'tasker_agent_memory_';

/**
 * Default Initial Memory State
 */
const getDefaultMemory = () => ({
  userProfile: {
    primaryRole: 'Software Developer & UI/UX Designer',
    workStyle: 'High-focus deep work with dedicated client review blocks',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka'
  },
  preferences: {
    preferredWorkHours: { start: '10:00', end: '19:00' },
    lunchBreak: { start: '13:30', end: '14:30' },
    eveningFocus: { start: '19:30', end: '22:00' },
    meetingBufferMinutes: 15,
    autoPrioritizeUrgent: true,
    preferredTaskDurationMinutes: 90
  },
  learnedRules: [
    'Schedule creative UI/UX and design sprints in the afternoon or evening.',
    'Always preserve a lunch break around 1:30 PM to 2:30 PM.',
    'Keep client calls or meetings separated with at least a 15-minute buffer.',
    'Use clear, professional titles instead of casual conversational phrases.'
  ],
  userHabits: {
    peakProductivityHours: ['11:00-13:00', '15:00-18:00', '20:30-22:30'],
    avgTaskCompletionRate: '85%',
    frequentCategories: ['UI/UX Design', 'Development', 'Client Meetings', 'General']
  },
  recentActions: []
});

/**
 * Retrieve user memory from persistent localStorage
 */
export function getUserMemory(userKey = 'default') {
  try {
    const raw = localStorage.getItem(`${MEMORY_STORAGE_PREFIX}${userKey.toLowerCase()}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...getDefaultMemory(),
        ...parsed,
        userProfile: { ...getDefaultMemory().userProfile, ...(parsed.userProfile || {}) },
        preferences: { ...getDefaultMemory().preferences, ...(parsed.preferences || {}) },
        learnedRules: Array.isArray(parsed.learnedRules) && parsed.learnedRules.length > 0
          ? Array.from(new Set([...getDefaultMemory().learnedRules, ...parsed.learnedRules]))
          : getDefaultMemory().learnedRules
      };
    }
  } catch (err) {
    console.warn('Failed to parse agent memory:', err);
  }
  return getDefaultMemory();
}

/**
 * Save user memory to persistent storage
 */
export function saveUserMemory(memory, userKey = 'default') {
  try {
    localStorage.setItem(
      `${MEMORY_STORAGE_PREFIX}${userKey.toLowerCase()}`,
      JSON.stringify(memory)
    );
  } catch (err) {
    console.warn('Failed to save agent memory:', err);
  }
}

/**
 * Record a user action or software event to learn from their habits
 */
export function recordUserAction(actionType, actionData, userKey = 'default') {
  try {
    const mem = getUserMemory(userKey);
    const item = {
      timestamp: new Date().toISOString(),
      action: actionType,
      data: actionData
    };
    mem.recentActions = [item, ...(mem.recentActions || [])].slice(0, 30);
    saveUserMemory(mem, userKey);
  } catch {}
}

/**
 * Dynamically extract and store new rules/preferences from user prompts
 * e.g., "Don't schedule anything on Friday afternoon" or "Always make meeting tasks high priority"
 */
export function learnFromUserFeedback(prompt, userKey = 'default') {
  if (!prompt || typeof prompt !== 'string') return null;
  const lower = prompt.toLowerCase();
  const mem = getUserMemory(userKey);
  let learnedNewRule = null;

  // Rule 1: Meeting buffer or timing preferences
  if (/(never schedule|don't schedule|kono kaj dio na|kono task dio na|scheduling bondho)/i.test(lower)) {
    learnedNewRule = `User constraint: ${prompt.trim()}`;
  } else if (/(always make|shobshomoy|always prioritize|shob shomoy)/i.test(lower) && /(urgent|high|priority)/i.test(lower)) {
    learnedNewRule = `Priority preference: ${prompt.trim()}`;
  } else if (/(lunch|dupur er khabar|dupur).*?(1:|1\.30|2:|13:|14:)/i.test(lower)) {
    learnedNewRule = `Lunch preference: Respect lunch break around user specified time.`;
  }

  if (learnedNewRule && !mem.learnedRules.includes(learnedNewRule)) {
    mem.learnedRules.push(learnedNewRule);
    saveUserMemory(mem, userKey);
    return learnedNewRule;
  }
  return null;
}

/**
 * Build rich memory context to inject into Gemini 3.8 Flash system prompt
 */
export function getMemoryPromptContext(userKey = 'default') {
  const mem = getUserMemory(userKey);
  return `
AGENT LONG-TERM CONTEXT MEMORY & USER HABITS:
- User Primary Role: ${mem.userProfile.primaryRole}
- Working Hours: ${mem.preferences.preferredWorkHours.start} - ${mem.preferences.preferredWorkHours.end}
- Lunch / Break Window: ${mem.preferences.lunchBreak.start} - ${mem.preferences.lunchBreak.end} (Protected time, avoid scheduling heavy work)
- Meeting Buffer: ${mem.preferences.meetingBufferMinutes} minutes between consecutive meetings
- Learned User Rules:
${mem.learnedRules.map((rule, idx) => `  ${idx + 1}. ${rule}`).join('\n')}
- Peak Productivity Blocks: ${mem.userHabits.peakProductivityHours.join(', ')}
`;
}
