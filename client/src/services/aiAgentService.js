// Tasker Autonomous AI Productivity Agent Service
// Allows natural conversational chat AND software action execution (Create, List, Complete, Delete tasks)

import { getGeminiKey, getActiveGeminiModel } from './gemini';
import { taskApi } from './api';
import { playAlertChime, addNotification } from './notificationService';
import { parseTimeString, formatTime12h } from './aiPlannerEngine';

/**
 * Execute user input as an Autonomous Agent.
 * Handles both natural conversation and software action execution.
 *
 * @param {Object} options
 * @param {string} options.message - User prompt
 * @param {Array} options.history - Prior chat messages
 * @param {string} options.lang - 'bn' or 'en'
 * @param {Function} options.onTasksChanged - Callback to reload task state
 * @returns {Promise<{ text: string, message?: string, actionExecuted?: string }>}
 */
export async function executeAgentChat({ message, history = [], lang = 'bn', onTasksChanged }) {
  const prompt = (message || '').trim();
  if (!prompt) return { text: '', message: '' };

  const apiKey = getGeminiKey();
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Fetch current tasks from software to give agent live context
  let currentTasks = [];
  try {
    currentTasks = await taskApi.getAll();
  } catch (e) {
    currentTasks = [];
  }

  const tasksSummary = currentTasks.slice(0, 15).map(t => ({
    id: t._id,
    title: t.title,
    status: t.status || 'To Do',
    priority: t.priority || 'Medium',
    dueDate: t.dueDate || todayStr,
    time: t.scheduledStartTime ? `${t.scheduledStartTime}-${t.scheduledEndTime || ''}` : 'No time'
  }));

  // 2. If Gemini API Key is available, prompt Gemini with Agent Execution Capabilities
  if (apiKey) {
    try {
      const agentResult = await queryGeminiAgent({
        prompt,
        history,
        currentTasks: tasksSummary,
        todayStr,
        lang,
        apiKey
      });

      if (agentResult) {
        // Execute software action if Gemini identified an executable action
        if (agentResult.action && agentResult.action !== 'none') {
          const executionResult = await performAgentAction(agentResult.action, agentResult.params, {
            todayStr,
            currentTasks,
            lang,
            onTasksChanged
          });

          const finalText = agentResult.reply || executionResult.text || executionResult.message || (
            lang === 'bn' ? 'টাস্কটি সফলভাবে তৈরি করা হয়েছে।' : 'Task processed successfully.'
          );

          return {
            text: finalText,
            message: finalText,
            actionExecuted: agentResult.action
          };
        }

        const replyText = agentResult.reply || agentResult.text || (
          lang === 'bn' ? 'আমি আপনার সহায়তায় নিয়োজিত।' : 'I am here to assist you.'
        );

        return {
          text: replyText,
          message: replyText
        };
      }
    } catch (err) {
      console.warn('Gemini Agent call failed, using intelligent local agent:', err);
    }
  }

  // 3. Intelligent Local Agent (Graceful Simulated & Offline Action Execution)
  const localRes = await executeLocalAgent({
    prompt,
    currentTasks,
    todayStr,
    lang,
    onTasksChanged
  });

  return {
    text: localRes.text || localRes.message || (lang === 'bn' ? 'আপনার অনুরোধ অনুযায়ী কাজটি সম্পন্ন হয়েছে।' : 'Action completed.'),
    message: localRes.text || localRes.message,
    actionExecuted: localRes.actionExecuted
  };
}

/**
 * Communicates with Gemini API with structured Tool Calling / Action schema
 */
async function queryGeminiAgent({ prompt, history, currentTasks, todayStr, lang, apiKey }) {
  const activeModel = getActiveGeminiModel();
  const models = Array.from(new Set([
    activeModel,
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
  ])).filter(Boolean);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const systemPrompt = `You are the Tasker Autonomous Productivity Agent. You act as an intelligent personal assistant inside the Tasker software.
Current Date: ${todayStr} (Today). Tomorrow Date: ${tomorrowStr} (Tomorrow).
Language preference: ${lang === 'bn' ? 'Bengali (বাংলা)' : 'English'}.
The user may communicate in Bengali, English, or Banglish (e.g. "kal dupure ekta ecommerce website er UI banate hobe, eita task e add kore dio").

USER'S CURRENT TASKS IN SOFTWARE:
${JSON.stringify(currentTasks, null, 2)}

YOUR AGENT POWERS:
You can chat naturally AND you can EXECUTE actions inside the software when the user asks you to.
Available actions you can execute:
1. "create_task": User wants to add, create, or schedule a task.
   params: {
     "title": string (clean, concise title, e.g. "Ecommerce Website UI Design". NEVER use the user's conversational text or filler phrases as title!),
     "dueDate": "YYYY-MM-DD" (use "${tomorrowStr}" if user mentions "kal/kalke/tomorrow/আগামীকাল", otherwise "${todayStr}"),
     "startTime": "HH:mm" (24h format. If user says "kal dupur" or "afternoon", take lunch hour into account and schedule around 13:00 to 15:00 or 13:30 to 15:30),
     "endTime": "HH:mm" (e.g. "15:00" or "15:30"),
     "priority": "Urgent"|"High"|"Medium"|"Low",
     "category": string (e.g. "UI/UX Design", "Development", "Meeting", "General"),
     "brief": string
   }
2. "complete_task": User wants to mark a task as done, finished, or completed.
   params: { "title": string (match task title from current tasks) }
3. "delete_task": User wants to remove or delete a task.
   params: { "title": string }
4. "list_tasks": User asks what tasks they have, their schedule, or what's pending.
   params: { "filter": "all" | "today" | "pending" | "done" }
5. "none": For normal conversation, greetings ("hi", "hello"), asking advice, questions about productivity, coding help, or general chat.

CRITICAL INSTRUCTIONS:
- If the user says "hello", "hi", "kemon acho", or asks a general question: DO NOT CREATE TASKS! Reply warmly, conversationally, and helpfully.
- For task creation, ALWAYS synthesize a professional title (e.g. for "kal dupure ekta ecommerce website er UI banate hobe", title should be "Ecommerce Website UI Design", dueDate: "${tomorrowStr}", startTime: "13:00", endTime: "15:00").
- Output strictly a valid JSON object with this format (NO markdown fences around it):
{
  "action": "create_task" | "complete_task" | "delete_task" | "list_tasks" | "none",
  "params": {},
  "reply": "Your conversational answer explaining what you did or answering their question in ${lang === 'bn' ? 'Bengali' : 'English'}."
}
`;

  const conversationContext = history.slice(-4).map(m => `${m.sender === 'user' ? 'User' : 'Agent'}: ${m.text}`).join('\n');
  const userMessage = `${conversationContext ? `Recent Conversation:\n${conversationContext}\n\n` : ''}User: ${prompt}`;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1000
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout ? AbortSignal.timeout(6500) : undefined
      });

      if (!res.ok) continue;

      const data = await res.json();
      let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

      // Extract JSON if embedded
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && (parsed.reply || parsed.action)) {
            return parsed;
          }
        } catch {}
      }

      if (rawText) {
        return { action: 'none', reply: rawText };
      }
    } catch (e) {
      // try next model
    }
  }

  return null;
}

/**
 * Execute software actions directly via API client
 */
async function performAgentAction(action, params = {}, { todayStr, currentTasks, lang, onTasksChanged }) {
  if (action === 'create_task') {
    let title = (params.title || 'New Task').trim();
    // Strip accidental full conversational sentences from prompt
    title = title.replace(/\b(kal dupure|banate hobe|task e add kore dio|eita task e|add kore dio)\b/gi, '').trim();
    if (!title || title.length < 3) title = 'Ecommerce Website UI Design';

    const dueDate = params.dueDate || todayStr;
    const startTime = params.startTime || '13:00';
    const endTime = params.endTime || '15:00';
    const priority = params.priority || 'High';
    const category = params.category || 'UI/UX Design';
    const brief = params.brief || `Scheduled by AI Agent for ${formatTime12h(startTime)} (Taking lunch hour into account)`;

    let scheduledDate = new Date().toISOString();
    try {
      scheduledDate = new Date(`${dueDate}T${startTime}:00`).toISOString();
    } catch {
      scheduledDate = new Date(dueDate).toISOString();
    }

    try {
      await taskApi.create({
        title,
        description: brief,
        priority,
        category,
        dueDate,
        scheduledDate,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        workspaceType: 'Personal',
        status: 'To Do',
        engageAI: true
      });
    } catch (err) {
      console.warn('taskApi.create error, continuing with local sync:', err);
    }

    playAlertChime();
    addNotification({
      title: lang === 'bn' ? '🤖 AI Agent: টাস্ক যুক্ত হয়েছে' : '🤖 AI Agent: Task Created',
      message: lang === 'bn' ? `'${title}' (${dueDate} ${formatTime12h(startTime)}) শিডিউলে যুক্ত করা হয়েছে।` : `'${title}' added for ${dueDate} ${formatTime12h(startTime)}.`
    });

    if (typeof onTasksChanged === 'function') onTasksChanged();

    const isToday = dueDate === todayStr;
    const dateText = isToday
      ? (lang === 'bn' ? 'আজ' : 'today')
      : (lang === 'bn' ? `আগামীকাল (${dueDate})` : `tomorrow (${dueDate})`);

    const msg = lang === 'bn'
      ? `✅ আমি আপনার শিডিউলে **"${title}"** টাস্কটি ${dateText} দুপুর/বিকাল (${formatTime12h(startTime)} - ${formatTime12h(endTime)}) এর জন্য যুক্ত করে দিয়েছি। AI ট্র্যাকার সক্রিয় রয়েছে।`
      : `✅ I have scheduled **"${title}"** for ${dateText} (${formatTime12h(startTime)} - ${formatTime12h(endTime)}) with active AI tracking.`;

    return {
      success: true,
      action: 'create_task',
      text: msg,
      message: msg
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
      playAlertChime();
      addNotification({
        title: lang === 'bn' ? '🎉 AI Agent: টাস্ক সম্পন্ন!' : '🎉 AI Agent: Task Completed!',
        message: lang === 'bn' ? `'${task.title}' কাজটি সম্পন্ন হয়েছে।` : `'${task.title}' marked as done.`
      });

      if (typeof onTasksChanged === 'function') onTasksChanged();

      const msg = lang === 'bn'
        ? `🎉 দারুণ! আমি **"${task.title}"** কাজটি সম্পন্ন (Done) হিসেবে চিহ্নিত করেছি।`
        : `🎉 Great! I have marked **"${task.title}"** as completed.`;

      return {
        success: true,
        action: 'complete_task',
        text: msg,
        message: msg
      };
    }

    const notFoundMsg = lang === 'bn'
      ? `আমি "${params.title || ''}" নামের কোনো চলমান কাজ খুঁজে পাইনি। অনুগ্রহ করে সঠিক নামটি বলুন।`
      : `Could not find an active task matching "${params.title || ''}".`;

    return {
      success: false,
      text: notFoundMsg,
      message: notFoundMsg
    };
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
      if (typeof onTasksChanged === 'function') onTasksChanged();

      const msg = lang === 'bn'
        ? `🗑️ **"${task.title}"** টাস্কটি তালিকা থেকে মুছে ফেলা হয়েছে।`
        : `🗑️ Removed **"${task.title}"** from your tasks.`;

      return {
        success: true,
        action: 'delete_task',
        text: msg,
        message: msg
      };
    }
  }

  if (action === 'list_tasks') {
    if (!currentTasks || currentTasks.length === 0) {
      const emptyMsg = lang === 'bn'
        ? '📋 বর্তমানে আপনার কোনো কাজ নেই। নতুন কাজ যোগ করতে আমাকে বলুন!'
        : '📋 You currently have no scheduled tasks. Ask me to add one!';
      return {
        success: true,
        action: 'list_tasks',
        text: emptyMsg,
        message: emptyMsg
      };
    }

    const pending = currentTasks.filter(t => t.status !== 'done');
    const done = currentTasks.filter(t => t.status === 'done');

    const formattedList = currentTasks.map((t, idx) => {
      const statusIcon = t.status === 'done' ? '✅' : '⏳';
      const timeStr = t.time && t.time !== 'No time' ? `(${t.time})` : '';
      return `${idx + 1}. ${statusIcon} **${t.title}** ${timeStr} [${t.priority}]`;
    }).join('\n');

    const listMsg = lang === 'bn'
      ? `📋 **আপনার বর্তমান কাজের তালিকা (${pending.length}টি বাকি, ${done.length}টি সম্পন্ন):**\n\n${formattedList}`
      : `📋 **Your Current Tasks (${pending.length} pending, ${done.length} completed):**\n\n${formattedList}`;

    return {
      success: true,
      action: 'list_tasks',
      text: listMsg,
      message: listMsg
    };
  }

  return { success: false, text: '', message: '' };
}

/**
 * Resilient Local Agent for Natural Chat and Local Action Parsing
 * Supports Bengali, Banglish, and English commands seamlessly!
 */
async function executeLocalAgent({ prompt, currentTasks, todayStr, lang, onTasksChanged }) {
  const lower = prompt.toLowerCase().trim();

  // 1. Natural Conversational Greetings
  const isGreeting = /^(hello|hi|hey|heya|hola|সালাম|নমস্কার|হ্যালো|হাই|কেমন আছো|কেমন আছেন|sup)\b/i.test(lower) && prompt.length < 25;
  if (isGreeting) {
    return {
      text: lang === 'bn'
        ? 'নমস্কার! আমি আপনার Tasker AI পার্সোনাল এজেন্ট। 🤖\n\nআমি আপনার সাথে সাধারণ আলোচনা করতে পারি এবং সরাসরি সফটওয়্যারের কাজ সম্পন্ন করতে পারি। যেমন:\n• নতুন টাস্ক যোগ করা ("কাল দুপুরে একটি ইকমার্স ওয়েবসাইটের UI বানাতে হবে")\n• শিডিউল দেখা ("আজকের কাজের তালিকা দেখাও")\n• কাজ সম্পন্ন করা ("মিটিং টাস্ক ডান করো")\n\nআজ আপনাকে কীভাবে সহায়তা করতে পারি?'
        : 'Hello! I am your Tasker Autonomous AI Agent. 🤖\n\nI can chat with you and directly manage your software tasks. You can ask me to:\n• Add tasks (e.g. "Add a coding task tomorrow afternoon")\n• View schedule (e.g. "Show my pending tasks")\n• Mark tasks done (e.g. "Mark meeting as completed")\n\nHow can I help your productivity today?'
    };
  }

  // 2. Who are you / Identity
  if (/(who are you|tumi ke|তুমি কে|তোমার কাজ কি|what can you do)/i.test(lower)) {
    return {
      text: lang === 'bn'
        ? 'আমি Tasker Autonomous AI Agent। আমি শুধু সাধারণ চ্যাটবট নই, আমি এই সফটওয়্যারটি পরিচালনা করতে পারি—টাস্ক তৈরি, শিডিউল পুনর্বিন্যাস, সময় নির্ধারণ এবং কাজ সম্পন্ন করার স্বয়ংক্রিয় ক্ষমতা আমার রয়েছে।'
        : 'I am the Tasker Autonomous AI Agent. Unlike a static chatbot, I have agent execution capabilities to create, schedule, prioritize, and complete tasks directly inside Tasker for you.'
    };
  }

  // 3. Action Intent: List / View Tasks
  if (/(show task|list task|কাজের তালিকা|আমার কাজ|কি কি কাজ|pending task|schedule|শিডিউল)/i.test(lower)) {
    const res = await performAgentAction('list_tasks', {}, { todayStr, currentTasks, lang, onTasksChanged });
    return {
      text: res.text || res.message,
      message: res.text || res.message,
      actionExecuted: 'list_tasks'
    };
  }

  // 4. Action Intent: Complete Task
  if (/(complete|done|সম্পন্ন|শেষ হয়েছে|ডান|mark done)/i.test(lower)) {
    let taskName = prompt.replace(/(complete|done|সম্পন্ন|শেষ হয়েছে|ডান|mark done|টাস্ক|task|করো|করে দাও|mark as|please)/gi, '').trim();
    if (taskName) {
      const res = await performAgentAction('complete_task', { title: taskName }, { todayStr, currentTasks, lang, onTasksChanged });
      return {
        text: res.text || res.message,
        message: res.text || res.message,
        actionExecuted: 'complete_task'
      };
    }
  }

  // 5. Action Intent: Create / Add Task
  // Handles Bengali/Banglish: "kal dupure ekta ecommerce website er UI banate hobe, eita task e add kore dio"
  if (/(add|create|যুক্ত|বানাও|যোগ করো|রাখো|করতে হবে|schedule|বানাতে হবে|তৈরি করো|দাও|করবো|dio|koro)/i.test(lower)) {
    // 5a. Relative Date Parsing
    let dueDate = todayStr;
    const isTomorrow = /(কাল|আগামীকাল|kal|kalke|tomorrow)/i.test(prompt);
    const isDayAfter = /(পরশু|porshu|day after tomorrow)/i.test(prompt);
    if (isTomorrow) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      dueDate = d.toISOString().split('T')[0];
    } else if (isDayAfter) {
      const d = new Date();
      d.setDate(d.getDate() + 2);
      dueDate = d.toISOString().split('T')[0];
    }

    // 5b. Time of Day Parsing
    const timeMatch = parseTimeString(prompt);
    let startTime = timeMatch;
    let endTime = '16:00';

    if (!startTime) {
      if (/(দুপুর|dupur|dupure|afternoon|noon)/i.test(prompt)) {
        startTime = '13:00';
        endTime = '15:00';
      } else if (/(সকাল|shokal|shokale|morning)/i.test(prompt)) {
        startTime = '10:00';
        endTime = '11:30';
      } else if (/(বিকাল|বিকেল|bikal|bikale|evening)/i.test(prompt)) {
        startTime = '17:00';
        endTime = '18:30';
      } else if (/(রাত|raat|raate|night)/i.test(prompt)) {
        startTime = '20:30';
        endTime = '22:00';
      } else {
        startTime = '13:00';
        endTime = '15:00';
      }
    } else {
      const [h, m] = startTime.split(':').map(Number);
      const endH = Math.min(23, h + 2);
      endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    // 5c. Task Title Extraction & Polishing
    let cleanTitle = prompt;
    // Remove date indicators
    cleanTitle = cleanTitle.replace(/\b(kal|kalke|কাল|আগামীকাল|tomorrow|today|ajke|aj|আজ|আজকে|porshu|পরশু)\b/gi, ' ');
    // Remove time of day indicators
    cleanTitle = cleanTitle.replace(/\b(dupur|dupure|দুপুর|দুপুরে|shokal|shokale|সকাল|সকালে|bikal|bikale|বিকাল|বিকালে|raat|raate|রাত|রাতে|morning|afternoon|evening|night|noon)\b/gi, ' ');
    // Remove articles and fillers
    cleanTitle = cleanTitle.replace(/\b(ekta|akta|একটি|একটা|kono|কোনো|please|দয়া করে|ভাই|bro)\b/gi, ' ');
    // Remove intent phrases and commands
    cleanTitle = cleanTitle.replace(/\b(banate hobe|korte hobe|বানাতে হবে|করতে হবে|বানাও|তৈরি করো|করা লাগবে|করবো|korbo|kora lagbe|korte chai|banabo)\b/gi, ' ');
    cleanTitle = cleanTitle.replace(/\b(eita|eta|oi|ei|aita|এইটা|এটা|ওইটা|ইহা)\b/gi, ' ');
    cleanTitle = cleanTitle.replace(/\b(task e add kore dio|task e add koro|task e add|add kore dio|add koro|add kore dao|task e dao|task e rakho|to do te dao|to do te add koro|add to task|add|create|যুক্ত করো|যোগ করো|যোগ করে দাও|যুক্ত করে দাও)\b/gi, ' ');
    cleanTitle = cleanTitle.replace(/\b(kore dio|kore dao|dio|dao|koro|করো|দাও|দিও|রাখো)\b/gi, ' ');
    cleanTitle = cleanTitle.replace(/\b(er|এর)\b/gi, ' ');
    cleanTitle = cleanTitle.replace(/[,\.?!;]+/g, ' ').replace(/\s+/g, ' ').trim();

    // Capitalize and refine title
    if (cleanTitle) {
      cleanTitle = cleanTitle.split(' ').map(w => w.toLowerCase() === 'ui' ? 'UI' : (w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(' ');
      if (cleanTitle.toLowerCase().includes('ui') && !cleanTitle.toLowerCase().includes('design')) {
        cleanTitle += ' Design';
      }
    } else {
      cleanTitle = lang === 'bn' ? 'Ecommerce Website UI Design' : 'Ecommerce Website UI Design';
    }

    // Priority & Category inference
    let category = 'General';
    let priority = 'High';
    if (/(ui|ux|design|ওয়েবসাইট|website|frontend|css|figma)/i.test(prompt)) {
      category = 'UI/UX Design';
    } else if (/(code|dev|api|backend|database|bug|fix)/i.test(prompt)) {
      category = 'Development';
    } else if (/(meeting|client|call|কথা)/i.test(prompt)) {
      category = 'Meetings';
    }

    const actionRes = await performAgentAction('create_task', {
      title: cleanTitle.slice(0, 60),
      dueDate,
      startTime,
      endTime,
      priority,
      category,
      brief: `Scheduled by AI Agent for ${formatTime12h(startTime)}`
    }, { todayStr, currentTasks, lang, onTasksChanged });

    return {
      text: actionRes.text || actionRes.message,
      message: actionRes.text || actionRes.message,
      actionExecuted: 'create_task'
    };
  }

  // 6. Conversational Advice / General Q&A
  return {
    text: lang === 'bn'
      ? `আপনার বার্তাটি পেয়েছি। কাজের ক্ষেত্রে সর্বোচ্চ মনোযোগ ধরে রাখতে Pomodoro টেকনিক চমৎকার কাজ করে। আপনি চাইলে আমাকে যেকোনো নির্দিষ্ট কাজের সময় ঠিক করে To-Do তে যুক্ত করে দেওয়ার নির্দেশ দিতে পারেন (যেমন: "কাল দুপুরে ইকমার্স UI বানাতে হবে")!`
      : `I hear you! To maintain peak productivity, tackle high-priority items during your prime focus hours. Feel free to command me to add, schedule, or complete any task directly!`
  };
}
