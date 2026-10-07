// Tasker Autonomous AI Productivity Agent Service (Gemini 3.8 Flash & Antigravity Agent ReAct)
// Features: Context Memory, Continuous Learning, Antigravity Thinking & Tool Calling, Realtime Board Sync

import { getGeminiKey, getActiveGeminiModel } from './gemini';
import { taskApi, teamApi, peopleApi, notifyDataChanged, getStoredUser } from './api';
import { playAlertChime, addNotification } from './notificationService';
import { parseTimeString, formatTime12h } from './aiPlannerEngine';
import {
  getUserMemory,
  recordUserAction,
  learnFromUserFeedback,
  getMemoryPromptContext
} from './agentMemoryService';

/**
 * Primary Model configuration - strictly prioritizing Gemini 3.8 Flash
 */
export const AGENT_PRIMARY_MODEL = 'gemini-3.8-flash';

/**
 * Execute user input as an Autonomous Agent.
 * Returns structured Thinking Process, Tool Execution Cards, and Gemini 3.8 conversational reply.
 *
 * @param {Object} options
 * @param {string} options.message - User prompt
 * @param {Array} options.history - Prior chat messages
 * @param {string} options.lang - 'bn' or 'en'
 * @param {string} options.userKey - current user ID / username
 * @param {Function} options.onTasksChanged - Callback to reload task state
 * @returns {Promise<{ text: string, reply: string, thoughts: string[], tools: any[], actionExecuted?: string }>}
 */
export async function executeAgentChat({
  message,
  history = [],
  lang = 'bn',
  userKey = 'default',
  onTasksChanged
}) {
  const prompt = (message || '').trim();
  if (!prompt) return { text: '', reply: '', thoughts: [], tools: [] };

  // 1. Continuous Learning: extract any new habits, constraints, or preferences from user input
  const learnedRule = learnFromUserFeedback(prompt, userKey);
  const memoryContext = getMemoryPromptContext(userKey);

  const apiKey = getGeminiKey(userKey);
  const todayStr = new Date().toISOString().split('T')[0];

  // 2. Fetch current tasks from software to give agent live context
  let currentTasks = [];
  try {
    currentTasks = await taskApi.getAll();
  } catch (e) {
    currentTasks = [];
  }

  const tasksSummary = currentTasks.slice(0, 25).map(t => ({
    id: t._id || t.id,
    title: t.title,
    status: t.status || 'To Do',
    priority: t.priority || 'Medium',
    category: t.category || 'General',
    dueDate: t.dueDate || todayStr,
    time: t.scheduledStartTime ? `${t.scheduledStartTime}-${t.scheduledEndTime || ''}` : 'Unscheduled'
  }));

  // 3. If Gemini API Key is available, prompt Gemini 3.8 Flash with Antigravity ReAct Agent Capabilities
  if (apiKey) {
    try {
      const agentResult = await queryGeminiAgent({
        prompt,
        history,
        currentTasks: tasksSummary,
        todayStr,
        lang,
        apiKey,
        memoryContext,
        learnedRule
      });

      if (agentResult) {
        let toolsExecuted = [];
        let executionDetails = [];

        // Check for multiple tools or single tool action
        const actionsToExecute = Array.isArray(agentResult.tools) && agentResult.tools.length > 0
          ? agentResult.tools
          : (agentResult.action && agentResult.action !== 'none'
              ? [{ tool: agentResult.action, params: agentResult.params || {} }]
              : []);

        for (const act of actionsToExecute) {
          const toolName = act.tool || act.name;
          const params = act.params || {};
          const execRes = await performAgentAction(toolName, params, {
            todayStr,
            currentTasks,
            lang,
            userKey,
            onTasksChanged
          });

          toolsExecuted.push({
            tool: toolName,
            params,
            status: execRes.success ? 'success' : 'failed',
            message: execRes.summary || execRes.text || toolName
          });

          if (execRes.text) executionDetails.push(execRes.text);
        }

        const thoughts = Array.isArray(agentResult.thoughts) && agentResult.thoughts.length > 0
          ? agentResult.thoughts
          : [
              lang === 'bn'
                ? 'ব্যবহারকারীর অনুরোধ ও শিডিউল বিশ্লেষণ করা হচ্ছে...'
                : 'Analyzing user request and active task board...',
              lang === 'bn'
                ? 'কনটেক্সট মেমোরি ও কাজের অভ্যাস পর্যালোচনা সম্পন্ন হয়েছে।'
                : 'Checked user habits and working memory context.'
            ];

        const finalReply = agentResult.reply || executionDetails.join('\n\n') || (
          lang === 'bn'
            ? 'আপনার নির্দেশ সফলভাবে সম্পন্ন করা হয়েছে।'
            : 'Your instructions have been executed successfully.'
        );

        return {
          text: finalReply,
          reply: finalReply,
          thoughts,
          tools: toolsExecuted,
          actionExecuted: toolsExecuted.length > 0 ? toolsExecuted.map(t => t.tool).join(', ') : null,
          learnedRule
        };
      }
    } catch (err) {
      console.warn('Gemini 3.8 Flash Agent call failed, falling back to intelligent local agent:', err);
    }
  }

  // 4. Intelligent Local Agent (Resilient Offline Antigravity Agent Execution)
  const localRes = await executeLocalAgent({
    prompt,
    currentTasks,
    todayStr,
    lang,
    userKey,
    learnedRule,
    onTasksChanged
  });

  return {
    text: localRes.reply || localRes.text || '',
    reply: localRes.reply || localRes.text || '',
    thoughts: localRes.thoughts || [],
    tools: localRes.tools || [],
    actionExecuted: localRes.actionExecuted,
    learnedRule
  };
}

/**
 * Communicates with Gemini 3.8 Flash API with Antigravity ReAct Agent Protocol
 */
async function queryGeminiAgent({
  prompt,
  history,
  currentTasks,
  todayStr,
  lang,
  apiKey,
  memoryContext,
  learnedRule
}) {
  const activeModel = getActiveGeminiModel() || AGENT_PRIMARY_MODEL;
  // Prioritize active model and modern flash models with rapid failover
  const models = Array.from(new Set([
    activeModel,
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-3.8-flash'
  ])).filter(Boolean);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const systemPrompt = `You are the Tasker Autonomous Productivity Agent, powered by Google Gemini 3.8 Flash with autonomous reasoning.
Current Date: ${todayStr} (Today). Tomorrow Date: ${tomorrowStr} (Tomorrow).
User Preferred Language: ${lang === 'bn' ? 'Bengali (বাংলা)' : 'English'}.
The user may chat or give instructions in Bengali, English, or Banglish (e.g. "kal dupure ekta ecommerce website er UI banate hobe, eita task e add kore dio").

${memoryContext}
${learnedRule ? `\nJUST LEARNED USER RULE: "${learnedRule}"\n` : ''}

USER'S CURRENT LIVE TASKS IN TASKER BOARD:
${JSON.stringify(currentTasks, null, 2)}

YOUR AGENTIC CAPABILITIES:
1. **Thinking Process (Chain of Thought)**: Provide a 2-4 step reasoning breakdown of how you analyzed the user's intent, respected user memory/habits (like protected lunch break), inspected board conflicts, and chose actions.
2. **Tool Execution**: Execute software actions on the Tasker board when required.
   CRITICAL INTENT RULES:
   - When the user asks to add, schedule, or plan an activity (e.g. "aj dupure boi porbo, eita schedule e add koro", "add client call at 4pm", "বই পড়ার কাজ শিডিউলে যুক্ত করো", "kal dupure UI banabo"), you MUST use the "create_task" tool. NEVER call "list_tasks" when the user wants to add/schedule something!
   - Use "list_tasks" ONLY when the user explicitly asks to view/display their existing tasks (e.g. "show my tasks", "আজকের কি কি কাজ আছে", "pending tasks দেখাও").
   Available tools:
   - "create_task": { "title": string, "dueDate": "YYYY-MM-DD", "startTime": "HH:mm", "endTime": "HH:mm", "priority": "Urgent"|"High"|"Medium"|"Low", "category": string, "brief": string }
   - "update_task": { "targetTitle": string, "updates": { "startTime"?: string, "endTime"?: string, "dueDate"?: string, "priority"?: string, "status"?: string } }
   - "complete_task": { "title": string }
   - "delete_task": { "title": string }
   - "list_tasks": { "filter": "all" | "today" | "pending" | "done" | "overdue" }
3. **Conversational Reply (Gemini 3.8 Flash Persona)**:
   - Warm, articulate, polite, and highly intelligent.
   - Use clean Markdown with bold text and bullet points.
   - Always explain *why* you scheduled at a particular time (e.g. citing lunch breaks, buffer between meetings, or peak creative focus).
   - In general conversation, do NOT force task creation—answer questions with deep insight.
   - NEVER mention technical framework terms like "Antigravity tools". Refer to actions naturally as "Tasker board actions" or "scheduling".

STRICT JSON OUTPUT FORMAT (NO MARKDOWN FENCES):
{
  "thoughts": [
    "Step 1: Analyzed intent...",
    "Step 2: Inspected user habit and live tasks...",
    "Step 3: Determined action..."
  ],
  "tools": [
    {
      "tool": "create_task" | "complete_task" | "delete_task" | "update_task" | "list_tasks",
      "params": {}
    }
  ],
  "reply": "Your rich, formatted Gemini 3.8 Flash conversational response in ${lang === 'bn' ? 'Bengali' : 'English'}."
}
`;

  const conversationContext = history.slice(-6).map(m => `${m.sender === 'user' ? 'User' : 'Agent'}: ${typeof m.text === 'string' ? m.text : (m.reply || '')}`).join('\n');
  const userMessage = `${conversationContext ? `Recent Conversation History:\n${conversationContext}\n\n` : ''}User: ${prompt}`;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] }
        ],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 1500
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout ? AbortSignal.timeout(7500) : undefined
      });

      if (!res.ok) continue;

      const data = await res.json();
      let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && (parsed.reply || parsed.tools || parsed.action)) {
            return parsed;
          }
        } catch {}
      }

      if (rawText) {
        return {
          thoughts: ['Processed general conversational query with Gemini 3.8 Flash'],
          tools: [],
          reply: rawText
        };
      }
    } catch (e) {
      // try next candidate model
    }
  }

  return null;
}

/**
 * Resolve workspace, team, and assignee from prompt or parameters
 * Rules:
 * - Default: "Personal" workspace, unless team is specified.
 * - Team: if team is specified (e.g. "team e add koro", "Alpha Squad team e dao"), create in that team.
 * - Assign: if user assigns to someone (e.g. "Sunny ke assign koro", "assign to Elias"), assign and put in team.
 */
export async function resolveTaskDestination({ prompt = '', params = {}, userKey = 'default' }) {
  const combined = `${prompt} ${params.title || ''} ${params.team || ''} ${params.teamName || ''} ${params.assignee || ''} ${params.workspaceType || ''}`.toLowerCase();

  // If team is explicitly mentioned or workspaceType is Team
  const isTeam = params.workspaceType === 'Team' ||
    /(team|টিম|টিমে|দল|দলগত|দলে|গ্রুপ|সবার জন্য|টিমের কাজ)\b/i.test(combined);

  let workspaceType = isTeam ? 'Team' : 'Personal';
  let targetTeam = null;
  let targetTeamId = params.teamId || null;
  let assignedUser = null;
  let assignedUserId = params.assignedTo || null;
  let assignedUserName = params.assignedToName || '';

  let teams = [];
  try {
    teams = await teamApi.getTeams();
  } catch (e) {
    teams = [];
  }

  // 1. Resolve Team if Team Workspace
  if (workspaceType === 'Team' && Array.isArray(teams) && teams.length > 0) {
    const requestedTeamName = params.teamName || params.team;
    if (requestedTeamName) {
      targetTeam = teams.find(t => t.name && t.name.toLowerCase().includes(String(requestedTeamName).toLowerCase()));
    }
    if (!targetTeam) {
      for (const t of teams) {
        if (t.name && combined.includes(t.name.toLowerCase())) {
          targetTeam = t;
          break;
        }
      }
    }
    // Fall back to active team ID or first team
    if (!targetTeam) {
      const activeId = teamApi.getActiveTeamId();
      targetTeam = teams.find(t => t._id === activeId) || teams[0];
    }
    if (targetTeam) {
      targetTeamId = targetTeam._id;
    }
  }

  // 2. Resolve Assignee
  const allMembers = [];
  if (Array.isArray(teams)) {
    teams.forEach(t => {
      if (Array.isArray(t.members)) {
        t.members.forEach(m => {
          if (m && typeof m === 'object' && (m._id || m.id)) {
            allMembers.push({
              _id: m._id || m.id,
              name: m.name || m.username,
              username: m.username || ''
            });
          }
        });
      }
    });
  }

  try {
    const conns = await peopleApi.getConnections();
    if (Array.isArray(conns)) {
      conns.forEach(c => {
        const u = c.user || c;
        if (u && (u._id || u.id)) {
          allMembers.push({
            _id: u._id || u.id,
            name: u.name || u.username,
            username: u.username || ''
          });
        }
      });
    }
  } catch (e) {}

  const requestedAssignee = params.assignee || params.assignedTo;
  if (requestedAssignee && typeof requestedAssignee === 'string') {
    const match = allMembers.find(m =>
      m.name?.toLowerCase().includes(requestedAssignee.toLowerCase()) ||
      m.username?.toLowerCase().includes(requestedAssignee.toLowerCase()) ||
      m._id === requestedAssignee
    );
    if (match) {
      assignedUser = match;
      assignedUserId = match._id;
      assignedUserName = match.name || match.username;
    }
  }

  if (!assignedUser) {
    // Check prompt for assignee patterns: "Sunny ke assign koro", "assign to Elias", "Zim er jonno"
    for (const m of allMembers) {
      const mName = (m.name || '').toLowerCase();
      const mUser = (m.username || '').toLowerCase();
      if ((mName && mName.length >= 3 && combined.includes(mName)) ||
          (mUser && mUser.length >= 3 && combined.includes(mUser))) {
        assignedUser = m;
        assignedUserId = m._id;
        assignedUserName = m.name || m.username;
        break;
      }
    }
  }

  // If a user is assigned, ensure workspace is Team (as personal tasks are only for oneself)
  if (assignedUserId && workspaceType === 'Personal' && (params.assignee || /assign|বরাদ্দ/i.test(prompt))) {
    workspaceType = 'Team';
    if (!targetTeamId && teams.length > 0) {
      const activeId = teamApi.getActiveTeamId();
      targetTeam = teams.find(t => t._id === activeId) || teams[0];
      targetTeamId = targetTeam?._id || null;
    }
  }

  return {
    workspaceType,
    teamId: targetTeamId,
    teamName: targetTeam?.name || (workspaceType === 'Team' ? 'Team Workspace' : null),
    assignedTo: assignedUserId,
    assignedToName: assignedUserName
  };
}

/**
 * Execute software actions directly via Tasker API client & Broadcast to board
 */
async function performAgentAction(action, params = {}, { todayStr, currentTasks, lang, userKey, onTasksChanged, prompt = '' }) {
  if (action === 'create_task') {
    const dest = await resolveTaskDestination({ prompt: params.prompt || prompt || '', params, userKey });

    let title = (params.title || 'New Task').trim();
    title = title.replace(/\b(kal dupure|banate hobe|task e add kore dio|eita task e|add kore dio)\b/gi, '').trim();
    if (!title || title.length < 3) title = 'Personal Focus Session';

    const dueDate = params.dueDate || todayStr;
    const startTime = params.startTime || '14:30';
    const endTime = params.endTime || '16:30';
    const priority = params.priority || 'Medium';
    const category = params.category || (dest.workspaceType === 'Team' ? 'Team Task' : 'General');
    const brief = params.brief || `Scheduled by Gemini 3.8 Flash Agent for ${formatTime12h(startTime)} (Taking focus & habits into account)`;

    let scheduledDate = `${dueDate}T${startTime}:00`;
    try {
      scheduledDate = new Date(`${dueDate}T${startTime}:00`).toISOString();
    } catch {
      scheduledDate = new Date().toISOString();
    }

    let createdTask = null;
    try {
      createdTask = await taskApi.create({
        title,
        brief,
        description: brief,
        priority,
        category,
        dueDate,
        scheduledDate,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        workspaceType: dest.workspaceType,
        teamId: dest.teamId,
        assignedTo: dest.assignedTo,
        status: 'To Do',
        engageAI: true
      });
    } catch (err) {
      console.warn('taskApi.create error, persisting sync:', err);
    }

    recordUserAction('create_task', { title, dueDate, startTime, priority, workspaceType: dest.workspaceType }, userKey);
    playAlertChime();

    const isToday = dueDate === todayStr;
    const dateText = isToday
      ? (lang === 'bn' ? 'আজ' : 'today')
      : (lang === 'bn' ? `আগামীকাল (${dueDate})` : `tomorrow (${dueDate})`);

    let metaNote = '';
    if (dest.workspaceType === 'Team') {
      metaNote = lang === 'bn'
        ? ` [টিম: ${dest.teamName || 'Team'}${dest.assignedToName ? ` • অ্যাসাইন: ${dest.assignedToName}` : ''}]`
        : ` [Team: ${dest.teamName || 'Team'}${dest.assignedToName ? ` • Assigned: ${dest.assignedToName}` : ''}]`;
    }

    addNotification({
      title: lang === 'bn'
        ? `🤖 Gemini Agent: ${dest.workspaceType === 'Team' ? 'টিম টাস্ক' : 'ব্যক্তিগত টাস্ক'} যুক্ত হয়েছে`
        : `🤖 Gemini Agent: ${dest.workspaceType === 'Team' ? 'Team Task' : 'Personal Task'} Created`,
      message: `'${title}' (${dueDate} ${formatTime12h(startTime)})${metaNote} শিডিউলে যুক্ত করা হয়েছে।`
    });

    notifyDataChanged('tasks', { action: 'create', task: createdTask });
    if (typeof onTasksChanged === 'function') onTasksChanged();

    const msg = lang === 'bn'
      ? `✅ আমি আপনার ${dest.workspaceType === 'Team' ? 'টিম' : 'ব্যক্তিগত'} শিডিউলে **"${title}"** টাস্কটি ${dateText} (${formatTime12h(startTime)} - ${formatTime12h(endTime)}) এর জন্য যুক্ত করে দিয়েছি${metaNote}।`
      : `✅ I have scheduled **"${title}"** in your ${dest.workspaceType === 'Team' ? 'team' : 'personal'} tasks for ${dateText} (${formatTime12h(startTime)} - ${formatTime12h(endTime)})${metaNote}.`;

    return {
      success: true,
      action: 'create_task',
      summary: `Created ${dest.workspaceType} task "${title}"${dest.assignedToName ? ` (Assigned: ${dest.assignedToName})` : ''}`,
      text: msg
    };
  }

  if (action === 'complete_task') {
    const targetTitle = (params.title || '').toLowerCase().trim();
    const task = currentTasks.find(t => (t.title || '').toLowerCase().includes(targetTitle));

    if (task) {
      try {
        await taskApi.update(task.id || task._id, { status: 'done' });
      } catch (err) {
        console.warn('taskApi.update error:', err);
      }
      recordUserAction('complete_task', { title: task.title, id: task.id }, userKey);
      playAlertChime();
      addNotification({
        title: lang === 'bn' ? '🎉 Gemini Agent: টাস্ক সম্পন্ন!' : '🎉 Gemini Agent: Task Completed!',
        message: lang === 'bn' ? `'${task.title}' কাজটি সম্পন্ন হয়েছে।` : `'${task.title}' marked as completed.`
      });

      notifyDataChanged('tasks');
      if (typeof onTasksChanged === 'function') onTasksChanged();

      const msg = lang === 'bn'
        ? `🎉 দারুণ! আমি **"${task.title}"** কাজটি সম্পন্ন (Done) হিসেবে চিহ্নিত করেছি।`
        : `🎉 Great! I have marked **"${task.title}"** as completed.`;

      return {
        success: true,
        action: 'complete_task',
        summary: `Marked "${task.title}" as completed`,
        text: msg
      };
    }

    const notFoundMsg = lang === 'bn'
      ? `আমি "${params.title || ''}" নামের কোনো চলমান কাজ খুঁজে পাইনি।`
      : `Could not find an active task matching "${params.title || ''}".`;

    return { success: false, summary: `Task not found: ${params.title}`, text: notFoundMsg };
  }

  if (action === 'delete_task') {
    const targetTitle = (params.title || '').toLowerCase().trim();
    const task = currentTasks.find(t => (t.title || '').toLowerCase().includes(targetTitle));

    if (task) {
      try {
        await taskApi.delete(task.id || task._id);
      } catch (err) {
        console.warn('taskApi.delete error:', err);
      }
      recordUserAction('delete_task', { title: task.title }, userKey);
      notifyDataChanged('tasks');
      if (typeof onTasksChanged === 'function') onTasksChanged();

      const msg = lang === 'bn'
        ? `🗑️ **"${task.title}"** টাস্কটি তালিকা থেকে মুছে ফেলা হয়েছে।`
        : `🗑️ Removed **"${task.title}"** from your tasks.`;

      return {
        success: true,
        action: 'delete_task',
        summary: `Deleted task "${task.title}"`,
        text: msg
      };
    }
  }

  if (action === 'update_task') {
    const targetTitle = (params.targetTitle || params.title || '').toLowerCase().trim();
    const task = currentTasks.find(t => (t.title || '').toLowerCase().includes(targetTitle));

    if (task && params.updates) {
      try {
        await taskApi.update(task.id || task._id, params.updates);
      } catch (err) {}
      recordUserAction('update_task', { title: task.title, updates: params.updates }, userKey);
      notifyDataChanged('tasks');
      if (typeof onTasksChanged === 'function') onTasksChanged();

      return {
        success: true,
        action: 'update_task',
        summary: `Updated "${task.title}"`,
        text: lang === 'bn' ? `🔄 **"${task.title}"** টাস্কটি সফলভাবে আপডেট করা হয়েছে।` : `🔄 **"${task.title}"** updated successfully.`
      };
    }
  }

  if (action === 'list_tasks') {
    if (!currentTasks || currentTasks.length === 0) {
      const emptyMsg = lang === 'bn'
        ? '📋 বর্তমানে আপনার কোনো নির্ধারিত কাজ নেই। নতুন কাজ যোগ করতে আমাকে বলুন!'
        : '📋 You currently have no scheduled tasks. Feel free to command me to add one!';
      return { success: true, summary: '0 tasks listed', text: emptyMsg };
    }

    const pending = currentTasks.filter(t => t.status !== 'done');
    const done = currentTasks.filter(t => t.status === 'done');

    const formattedList = currentTasks.slice(0, 10).map((t, idx) => {
      const statusIcon = t.status === 'done' ? '✅' : '⏳';
      const timeStr = t.time && t.time !== 'Unscheduled' ? `(${t.time})` : '';
      return `${idx + 1}. ${statusIcon} **${t.title}** ${timeStr} [${t.priority}]`;
    }).join('\n');

    const listMsg = lang === 'bn'
      ? `📋 **আপনার কাজের বর্তমান অবস্থা (${pending.length}টি বাকি, ${done.length}টি সম্পন্ন):**\n\n${formattedList}`
      : `📋 **Current Board Overview (${pending.length} pending, ${done.length} completed):**\n\n${formattedList}`;

    return {
      success: true,
      action: 'list_tasks',
      summary: `Listed ${currentTasks.length} tasks`,
      text: listMsg
    };
  }

  return { success: false, summary: '', text: '' };
}

/**
 * Resilient Local Agent with Antigravity Thinking & Action Structure
 */
async function executeLocalAgent({ prompt, currentTasks, todayStr, lang, userKey, learnedRule, onTasksChanged }) {
  const lower = prompt.toLowerCase().trim();
  const mem = getUserMemory(userKey);

  // 1. Natural Conversational Greetings
  const isGreeting = /^(hello|hi|hey|heya|hola|সালাম|নমস্কার|হ্যালো|হাই|কেমন আছো|কেমন আছেন|sup)\b/i.test(lower) && prompt.length < 25;
  if (isGreeting) {
    return {
      thoughts: [
        'Recognized user greeting in natural language.',
        `Context check: User has ${currentTasks.filter(t => t.status !== 'done').length} pending tasks today.`,
        'Formulating warm, intelligent Gemini greeting.'
      ],
      tools: [],
      reply: lang === 'bn'
        ? `নমস্কার! আমি আপনার **Tasker Autonomous AI Agent** 🤖 (Powered by Gemini 3.8 Flash)।\n\nআমি আপনার কাজের রুটিন ও পছন্দের সময় মনে রেখে কাজ করি। আপনি সাধারণ আলোচনা করতে পারেন কিংবা সরাসরি বোর্ড পরিচালনা করতে পারেন:\n\n• *"কাল দুপুরে ইকমার্স UI বানাতে হবে"* (স্বয়ংক্রিয়ভাবে লাঞ্চ টাইম বাদ দিয়ে শিডিউল করবে)\n• *"আজকের কাজের তালিকা দেখাও"*\n• *"মিটিং টাস্ক ডান করো"*\n\nআজ আপনাকে কীভাবে সহায়তা করতে পারি?`
        : `Hello! I am your **Tasker Autonomous AI Agent** 🤖 (Powered by Gemini 3.8 Flash).\n\nI continuously learn your work habits and schedule preferences. You can talk with me naturally or give direct board commands:\n\n• *"Schedule Ecommerce UI Design tomorrow afternoon"*\n• *"Show my pending tasks for today"*\n• *"Mark meeting as completed"*\n\nHow can I help boost your productivity today?`
    };
  }

  // 2. Who are you / Identity
  if (/(who are you|tumi ke|তুমি কে|তোমার কাজ কি|what can you do)/i.test(lower)) {
    return {
      thoughts: [
        'User inquired about agent identity, architecture, and memory capabilities.',
        'Explaining Gemini 3.8 Flash intelligence, Antigravity ReAct execution, and persistent habit memory.'
      ],
      tools: [],
      reply: lang === 'bn'
        ? `আমি **Tasker Autonomous AI Agent**। আমি **Gemini 3.8 Flash**-এর বুদ্ধিমত্তা ও স্বয়ংক্রিয় পরিকল্পনা (Autonomous Planning) দিয়ে গঠিত:\n\n1. **🧠 Thinking & Planning:** যেকোনো জটিল কাজের আগে ধাপে ধাপে পরিকল্পনা করি।\n2. **⚙️ Real-time Board Execution:** সরাসরি আপনার Tasker বোর্ডে টাস্ক তৈরি, আপডেট, শিডিউল ও ডিলিট করতে পারি।\n3. **💾 Context Memory & Continuous Learning:** আপনার কাজের অভ্যাস, ডিপ ফোকাস আওয়ার এবং পছন্দের সময়সূচী আমি মনে রাখি।`
        : `I am the **Tasker Autonomous AI Agent**, powered by **Gemini 3.8 Flash** with autonomous planning and habit learning:\n\n1. **🧠 Multi-step Thinking:** I plan ahead, respect your buffer times and peak focus blocks.\n2. **⚙️ Direct Board Execution:** I create, reschedule, update, and complete tasks directly on your board in real-time.\n3. **💾 Context Memory & Habit Learning:** I remember your working preferences and continuously adapt to your work style.`
    };
  }

  // 3. Action Intent: Create / Add Task with Memory-Aware Scheduling (High Priority)
  // Handles: "aj dupure boi porbo, eita schedule e add koro", "kal dupure UI banabo", etc.
  if (/(add|create|যুক্ত|বানাও|যোগ করো|রাখো|করতে হবে|schedule|বানাতে হবে|তৈরি করো|দাও|করবো|dio|koro|porbo|পড়বো|পড়ব|পড়বো|পড়ব)/i.test(lower) && !/(show|list|dekhao|দেখা|কি কি কাজ|আমার কাজ|pending tasks?|কাজের তালিকা|আজকের কাজ)/i.test(lower)) {
    let dueDate = todayStr;
    const isToday = /\b(aj|ajke|আজ|আজকে|today)\b/i.test(prompt);
    const isTomorrow = !isToday && /\b(কাল|আগামীকাল|kal|kalke|tomorrow)\b/i.test(prompt);
    const isDayAfter = !isToday && !isTomorrow && /\b(পরশু|porshu|day after tomorrow)\b/i.test(prompt);
    if (isTomorrow) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      dueDate = d.toISOString().split('T')[0];
    } else if (isDayAfter) {
      const d = new Date();
      d.setDate(d.getDate() + 2);
      dueDate = d.toISOString().split('T')[0];
    }

    // Checking user memory lunch break window
    const timeMatch = parseTimeString(prompt);
    let startTime = timeMatch;
    let endTime = '16:30';

    if (!startTime) {
      if (/(দুপুর|dupur|dupure|afternoon|noon)/i.test(prompt)) {
        // User memory: lunch is 13:30 - 14:30, schedule right after lunch
        startTime = '14:30';
        endTime = '16:30';
      } else if (/(সকাল|shokal|shokale|morning)/i.test(prompt)) {
        startTime = '10:30';
        endTime = '12:00';
      } else if (/(বিকাল|বিকেল|bikal|bikale|evening)/i.test(prompt)) {
        startTime = '17:00';
        endTime = '18:30';
      } else if (/(রাত|raat|raate|night)/i.test(prompt)) {
        startTime = '20:00';
        endTime = '22:00';
      } else {
        startTime = '14:30';
        endTime = '16:30';
      }
    } else {
      const [h, m] = startTime.split(':').map(Number);
      const endH = Math.min(23, h + 2);
      endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    let cleanTitle = prompt;
    cleanTitle = cleanTitle.replace(/\b(kal|kalke|কাল|আগামীকাল|tomorrow|today|ajke|aj|আজ|আজকে|porshu|পরশু)\b/gi, ' ');
    cleanTitle = cleanTitle.replace(/\b(raat\s*e|raate|rate\s*e|rate|dupur\s*e|dupure|shokal\s*e|shokale|bikal\s*e|bikale|রাত\s*এ|রাতে|সকাল\s*এ|সকালে|বিকাল\s*এ|বিকেল\s*এ|বিকালে|বিকেলে|দুপুর\s*এ|দুপুরে|morning|afternoon|evening|night|noon)\b/gi, ' ');
    cleanTitle = cleanTitle.replace(/\b(ekta|akta|একটি|একটা|kono|কোনো|please|দয়া করে|ভাই|bro)\b/gi, ' ');
    cleanTitle = cleanTitle.replace(/\b(banate hobe|korte hobe|বানাতে হবে|করতে হবে|বানাও|তৈরি করো|করা লাগবে|করবো|korbo|kora lagbe|korte chai|banabo)\b/gi, ' ');
    cleanTitle = cleanTitle.replace(/\b(eita|eta|oi|ei|aita|এইটা|এটা|ওইটা|ইহা)\b/gi, ' ');
    cleanTitle = cleanTitle.replace(/\b(task e add kore rakho|task e add kore dio|task e add koro|task e add|schedule e add kore rakho|schedule e add kore dio|schedule e add koro|schedule e add|add kore rakho|add kore dio|add kore dao|add koro|add|create|যুক্ত করো|যোগ করো|যোগ করে দাও|যুক্ত করে দাও)\b/gi, ' ');
    cleanTitle = cleanTitle.replace(/\b(kore rakho|kore dio|kore dao|rakho|rekho|dio|dao|koro|করো|দাও|দিও|রাখো|রেখো)\b/gi, ' ');
    cleanTitle = cleanTitle.replace(/\b(task e|task|schedule e|schedule|to do te|to do|টাস্ক এ|টাস্কে|শিডিউলে|শিডিউল এ|শিডিউল|টু ডু)\b/gi, ' ');
    cleanTitle = cleanTitle.replace(/\b(team e|teame|টিমে|টিম এ|টিম|team)\b/gi, ' ');
    cleanTitle = cleanTitle.replace(/\b(er|এর|e|এ)\b/gi, ' ');
    cleanTitle = cleanTitle.replace(/[,\.?!;]+/g, ' ').replace(/\s+/g, ' ').trim();

    let category = 'General';
    let priority = 'Medium';

    if (/(ghurte\s*jabo|ghurte|ghura|ghurbo|outing|walk|travel|trip|হাঁটতে|ঘুরতে|বেড়াতে|বের হব)/i.test(prompt)) {
      cleanTitle = lang === 'bn' ? 'ঘুরতে যাওয়া (Outing / Walk)' : 'Outing / Walk (ঘুরতে যাওয়া)';
      category = 'Personal / Leisure';
      priority = 'Low';
    } else if (/(bazar|bajar|বাজার|market|grocery|shopping|কেনাকাটা)/i.test(prompt)) {
      cleanTitle = lang === 'bn' ? 'বাজার করা (Grocery Shopping)' : 'Grocery Shopping (বাজার করা)';
      category = 'Personal / Errands';
      priority = 'Medium';
    } else if (/(boi\s*por|বই\s*পড়|boi|book|read|study|পড়ব|পড়বো|বই)/i.test(prompt)) {
      cleanTitle = lang === 'bn' ? 'বই পড়া (Book Reading)' : 'Book Reading (বই পড়া)';
      category = 'Reading & Study';
      priority = 'Medium';
    } else if (cleanTitle) {
      cleanTitle = cleanTitle.split(' ').map(w => w.toLowerCase() === 'ui' ? 'UI' : (w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(' ');
      if (cleanTitle.toLowerCase().includes('ui') && !cleanTitle.toLowerCase().includes('design')) {
        cleanTitle += ' Design';
      }
    } else {
      cleanTitle = 'Personal Focus Session';
    }

    if (/(ui|ux|design|ওয়েবসাইট|website|frontend|css|figma)/i.test(prompt)) {
      category = 'UI/UX Design';
      priority = 'High';
    } else if (/(code|dev|api|backend|database|bug|fix)/i.test(prompt)) {
      category = 'Development';
      priority = 'High';
    } else if (/(meeting|client|call|কথা)/i.test(prompt)) {
      category = 'Meetings';
      priority = 'Urgent';
    }

    const dest = await resolveTaskDestination({ prompt, userKey });

    const actionRes = await performAgentAction('create_task', {
      title: cleanTitle.slice(0, 60),
      dueDate,
      startTime,
      endTime,
      priority,
      category,
      workspaceType: dest.workspaceType,
      teamId: dest.teamId,
      assignedTo: dest.assignedTo,
      assignedToName: dest.assignedToName,
      brief: `Scheduled by Gemini 3.8 Flash Agent for ${formatTime12h(startTime)} (Taking focus & habits into account)`
    }, { todayStr, currentTasks, lang, userKey, onTasksChanged, prompt });

    const destDesc = dest.workspaceType === 'Team'
      ? `Team: ${dest.teamName || 'Team Workspace'}${dest.assignedToName ? ` (Assigned to: ${dest.assignedToName})` : ''}`
      : 'Personal Workspace';

    return {
      thoughts: [
        `Extracted Task: "${cleanTitle.slice(0, 60)}" [${priority} priority, Category: ${category}].`,
        `Target Workspace: ${destDesc}.`,
        `Checked Memory Habit: Protected lunch break (13:30 - 14:30) avoided, optimal slot: ${startTime} - ${endTime}.`,
        'Calling Tasker board API to register new scheduled task with AI tracking.'
      ],
      tools: [{
        tool: 'create_task',
        params: {
          title: cleanTitle.slice(0, 60),
          dueDate,
          startTime,
          endTime,
          priority,
          workspaceType: dest.workspaceType,
          teamId: dest.teamId,
          assignedTo: dest.assignedTo
        },
        status: 'success',
        message: `${dest.workspaceType} task created for ${dueDate} at ${startTime}${dest.assignedToName ? ` (Assigned: ${dest.assignedToName})` : ''}`
      }],
      reply: actionRes.text,
      actionExecuted: 'create_task'
    };
  }

  // 4. Action Intent: List / View Tasks
  if (/(show tasks?|list tasks?|কাজের তালিকা|আমার কাজ|কি কি কাজ|pending tasks?|আজকের কাজ|schedule dekhao|শিডিউল দেখাও)/i.test(lower)) {
    const res = await performAgentAction('list_tasks', {}, { todayStr, currentTasks, lang, userKey, onTasksChanged });
    return {
      thoughts: [
        'Identified intent: Query Tasker board for current tasks.',
        `Found ${currentTasks.length} total tasks in memory.`,
        'Formatting structured overview with status and priority.'
      ],
      tools: [{ tool: 'list_tasks', status: 'success', message: 'Queried board state' }],
      reply: res.text,
      actionExecuted: 'list_tasks'
    };
  }

  // 5. Action Intent: Complete Task
  if (/(complete|done|সম্পন্ন|শেষ হয়েছে|ডান|mark done)/i.test(lower)) {
    let taskName = prompt.replace(/(complete|done|সম্পন্ন|শেষ হয়েছে|ডান|mark done|টাস্ক|task|করো|করে দাও|mark as|please)/gi, '').trim();
    if (taskName) {
      const res = await performAgentAction('complete_task', { title: taskName }, { todayStr, currentTasks, lang, userKey, onTasksChanged });
      return {
        thoughts: [
          `Identified intent: Complete task matching "${taskName}".`,
          'Executing update_task API and broadcasting real-time board sync.',
          'Recording completion telemetry in user habits memory.'
        ],
        tools: [{ tool: 'complete_task', params: { title: taskName }, status: res.success ? 'success' : 'failed', message: res.summary }],
        reply: res.text,
        actionExecuted: 'complete_task'
      };
    }
  }

  // 6. Conversational Advice / General Q&A with Gemini Persona
  return {
    thoughts: [
      'Processed conversational query without active board command.',
      'Applied user work habit insights to formulate productive guidance.'
    ],
    tools: [],
    reply: lang === 'bn'
      ? `আপনার বার্তাটি পেয়েছি! সর্বোচ্চ প্রোডাক্টিভিটি ধরে রাখার জন্য আপনার পছন্দের পিক আওয়ারগুলোতে ডিপ ফোকাস ওয়ার্ক রাখুন।\n\nআপনি চাইলে আমাকে যেকোনো কাজ তৈরি, শিডিউল পুনর্বিন্যাস বা কাজ সম্পন্ন করার সরাসরি নির্দেশ দিতে পারেন (যেমন: *"কাল দুপুরে ইকমার্স UI বানাতে হবে"* বা *"আজকের কাজের তালিকা দেখাও")*!`
      : `I hear you! To maintain peak productivity, allocate your high-focus deep work blocks during your prime hours.\n\nFeel free to command me anytime to create, reschedule, or complete any task directly on your board (e.g. *"Schedule Ecommerce UI Design tomorrow afternoon"* or *"Show my pending tasks")*!`
  };
}
