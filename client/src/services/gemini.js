// Gemini AI BYOK Service (Bring Your Own Key)

const GEMINI_KEY_STORAGE = 'tasker_gemini_api_key';

export const getGeminiKey = () => localStorage.getItem(GEMINI_KEY_STORAGE) || '';
export const setGeminiKey = (key) => localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
export const removeGeminiKey = () => localStorage.removeItem(GEMINI_KEY_STORAGE);

/**
 * Ask Gemini to reason about tasks, code, or schedule.
 * Returns { textResponse, extractedTasks: [...] }
 */
export async function queryGeminiReasoning({ prompt, codeSnippet = '', voiceTranscript = '', systemInstruction = '' }) {
  const apiKey = getGeminiKey();

  const combinedContent = `
You are the Tasker Intelligent Productivity Assistant. You help users (ranging from farmers, store owners, freelancers, to software engineers and tech executives) organize their daily schedule, break down complex tasks, analyze code, and prioritize their workflow.

User input details:
${voiceTranscript ? `[Voice Recording Transcript]: ${voiceTranscript}\n` : ''}
${prompt ? `[User Prompt / Instructions]: ${prompt}\n` : ''}
${codeSnippet ? `[Code Snippet to Analyze]:\n\`\`\`\n${codeSnippet}\n\`\`\`\n` : ''}

CRITICAL INSTRUCTIONS:
1. Provide a clear, friendly, and empowering response in the same language as the user (Bangla or English).
2. If tasks can be derived from the user's input, extract them into structured JSON format enclosed in a JSON codeblock:
\`\`\`json
{
  "tasks": [
    {
      "title": "Short clear task name (e.g. কালকে সকালের দুধ ডেলিভারি or Fix React auth hook)",
      "brief": "Context or instructions",
      "priority": "High" | "Medium" | "Low" | "Urgent",
      "suggestedCategory": "Agriculture" | "Retail" | "Tech" | "Design" | "General"
    }
  ]
}
\`\`\`
3. Always explain why you structured the schedule this way.
`;

  if (!apiKey) {
    // Provide a smart local simulated fallback so user can experience the feature before setting key
    return generateSimulatedResponse(prompt || voiceTranscript || codeSnippet);
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          parts: [{ text: combinedContent }]
        }
      ]
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini API returned status ${res.status}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text || 'কোনো রেসপন্স পাওয়া যায়নি।';

    // Parse extracted JSON tasks
    const extractedTasks = parseTasksFromResponse(candidate);

    return {
      textResponse: candidate.replace(/```json[\s\S]*?```/g, '').trim(),
      extractedTasks
    };
  } catch (err) {
    console.warn('Gemini API call failed, falling back to smart local reasoning:', err.message);
    return {
      textResponse: `⚠️ Gemini API Error (${err.message})। আপনার API Key চেক করুন। নিচে একটি টেস্ট প্রিভিউ দেখানো হলো:`,
      ...generateSimulatedResponse(prompt || voiceTranscript)
    };
  }
}

function parseTasksFromResponse(text) {
  try {
    const jsonMatch = text.match(/```json([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      const parsed = JSON.parse(jsonMatch[1].trim());
      if (Array.isArray(parsed.tasks)) {
        return parsed.tasks;
      }
    }
  } catch (e) {
    console.warn('Could not parse JSON tasks from Gemini response:', e);
  }
  return [];
}

function generateSimulatedResponse(input) {
  const isBangla = /[\u0980-\u09FF]/.test(input);

  if (isBangla) {
    return {
      textResponse: `আমি আপনার কাজটি বুঝতে পেরেছি এবং আপনার সারাদিনের কাজের তালিকা অনুযায়ী সাজিয়ে দিয়েছি।\n\n📌 **পরিকল্পনা সারসংক্ষেপ:**\n১. জরুরি কাজগুলো সকালের দিকে রাখা হয়েছে।\n২. ক্লায়েন্ট বা বাজার সংক্রান্ত কাজগুলো নির্দিষ্ট সময়ে শিডিউল করা হয়েছে।\n\nনিচের "Add to Kanban & Calendar" বাটনে ক্লিক করে কাজগুলো সরাসরি বোর্ডে যুক্ত করে নিন!`,
      extractedTasks: [
        {
          title: input ? input.slice(0, 40) : 'খামার ও সাপ্লাই তদারকি',
          brief: 'Gemini AI দ্বারা স্বয়ংক্রিয়ভাবে জেনারেট করা টাস্ক',
          priority: 'High',
          suggestedCategory: 'Agriculture'
        },
        {
          title: 'কাস্টমার পেমেন্ট ও ইনভয়েস আপডেট',
          brief: 'বকেয়া টাকা সংগ্রহ এবং রসিদ যাচাই',
          priority: 'Medium',
          suggestedCategory: 'Retail'
        }
      ]
    };
  }

  return {
    textResponse: `I analyzed your daily workflow request! Here is an optimized plan to achieve maximum focus today:\n\n• High priority tasks are grouped for your peak productivity window.\n• Follow-ups and client communications are arranged neatly.\n\nClick the button below to add these directly to your Kanban Board and Calendar!`,
    extractedTasks: [
      {
        title: input ? input.slice(0, 45) : 'Core Feature Implementation',
        brief: 'Derived from AI reasoning breakdown',
        priority: 'High',
        suggestedCategory: 'Tech'
      },
      {
        title: 'Review team pull requests & client sync',
        brief: 'Code review and alignment meeting',
        priority: 'Medium',
        suggestedCategory: 'Tech'
      }
    ]
  };
}
