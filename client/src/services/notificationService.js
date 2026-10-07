import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Tasker Real-time Notification & Time Management Alert Service
// Features: Web Audio API sound chime, desktop alert notifications, Android shade notifications, and automated task monitoring

const NOTIFICATIONS_KEY = 'tasker_active_notifications_v1';
const SOUND_MUTED_KEY = 'tasker_sound_alerts_muted';

let audioCtx = null;

// Initialize or get Web Audio Context for pleasant synthesized alert chimes
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Play pleasant, elegant dual-tone chime (C5 -> E5) without external sound file dependencies
export function playAlertChime() {
  try {
    if (localStorage.getItem(SOUND_MUTED_KEY) === 'true') return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Tone 1: C5 (523.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2: E5 (659.25 Hz) slightly delayed for a modern bell feel
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.22, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.65);
  } catch (e) {
    console.warn('Audio chime error:', e);
  }
}

// Request permission for push/local notifications on device
export async function requestNotificationPermission() {
  try {
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      const status = await LocalNotifications.checkPermissions();
      if (status.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
      try {
        await LocalNotifications.createChannel({
          id: 'tasker_messages',
          name: 'Tasker Messages',
          description: 'Direct and team chat notifications',
          importance: 5,
          visibility: 1,
          vibration: true
        });
      } catch (ce) {
        console.warn('Channel creation error:', ce);
      }
    } else if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    }
  } catch (e) {
    console.warn('Request notification permission error:', e);
  }
}

// Show native phone notification shade on Android & fallback on desktop
export async function showPhoneShadeNotification(title, body, id = Math.floor(Math.random() * 100000) + 1) {
  try {
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: title,
            body: body,
            id: id,
            channelId: 'tasker_messages',
            schedule: { at: new Date(Date.now() + 100) },
            smallIcon: 'ic_launcher'
          }
        ]
      });
      return;
    }
  } catch (e) {
    console.warn('Phone notification shade error:', e);
  }

  showDesktopNotification(title, body);
}

// Show native desktop system notification
export function showDesktopNotification(title, body) {
  try {
    if (window.electronAPI?.showNotification) {
      window.electronAPI.showNotification(title, body);
      return;
    }
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') {
            new Notification(title, { body, icon: '/favicon.ico' });
          }
        });
      }
    }
  } catch (e) {
    console.warn('Desktop notification error:', e);
  }
}

// Load notifications from cache
export function getStoredNotifications() {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Save notifications to cache and broadcast
export function saveNotifications(notifications) {
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    window.dispatchEvent(new CustomEvent('tasker_notifications_updated', { detail: notifications }));
  } catch (e) {
    console.error('Error saving notifications:', e);
  }
}

// Add a single notification with sound chime
export function addNotification({ title, message, type = 'reminder', taskId = null, playSound = true }) {
  const current = getStoredNotifications();

  // Avoid duplicate identical notifications within 10 minutes
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  const isDuplicate = current.some(n =>
    n.taskId === taskId &&
    n.type === type &&
    new Date(n.timestamp).getTime() > tenMinutesAgo
  );

  if (isDuplicate) return null;

  const item = {
    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    title,
    message,
    type, // 'not_started' | 'in_progress_stuck' | 'overdue' | 'reminder' | 'ai_planner'
    taskId,
    read: false,
    timestamp: new Date().toISOString()
  };

  const updated = [item, ...current.slice(0, 49)];
  saveNotifications(updated);

  if (playSound) {
    playAlertChime();
  }
  showPhoneShadeNotification(title, message);

  return item;
}

// Mark single notification as read
export function markAsRead(notificationId) {
  const current = getStoredNotifications();
  const updated = current.map(n => n.id === notificationId ? { ...n, read: true } : n);
  saveNotifications(updated);
}

// Mark all notifications as read
export function markAllAsRead() {
  const current = getStoredNotifications();
  const updated = current.map(n => ({ ...n, read: true }));
  saveNotifications(updated);
}

// Clear all notifications
export function clearAllNotifications() {
  saveNotifications([]);
}

// Background Monitor Interval
let monitorIntervalId = null;

export function startTaskTimeMonitoring(getTasksCallback) {
  if (monitorIntervalId) return;

  const checkTasks = () => {
    try {
      const tasks = typeof getTasksCallback === 'function' ? getTasksCallback() : [];
      if (!Array.isArray(tasks) || tasks.length === 0) return;

      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTimeInMins = currentHours * 60 + currentMinutes;

      tasks.forEach((task) => {
        // Skip done tasks
        if (task.status === 'Done') return;

        const isAIEngaged = task.engageAI === true;
        const taskTitle = task.title || 'Untitled Task';

        // 1. Check Not Started Alert ("কাজ শুরু করা হয়নি")
        if (task.status === 'To Do' && (task.scheduledStartTime || task.dueTime)) {
          const timeStr = task.scheduledStartTime || task.dueTime;
          const [hStr, mStr] = timeStr.split(':');
          if (hStr !== undefined && mStr !== undefined) {
            const taskStartMins = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
            // If current time is past start time (by 0 to 45 mins)
            if (currentTimeInMins >= taskStartMins && currentTimeInMins <= taskStartMins + 45) {
              addNotification({
                title: isAIEngaged ? `🤖 AI Alert: কাজ শুরু করা হয়নি!` : `⏰ Task Reminder: কাজ শুরু করুন`,
                message: `"${taskTitle}" নির্ধারিত সময় (${timeStr}) হয়ে গেছে, কিন্তু কাজ শুরু করা হয়নি। অবিলম্বে শুরু করুন।`,
                type: 'not_started',
                taskId: task._id
              });
            }
          }
        }

        // 2. Check Processing Stuck Alert ("প্রসেসিং-এ পড়ে আছে")
        if (task.status === 'In Progress') {
          if (task.scheduledEndTime) {
            const [hStr, mStr] = task.scheduledEndTime.split(':');
            if (hStr !== undefined && mStr !== undefined) {
              const taskEndMins = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
              if (currentTimeInMins >= taskEndMins) {
                addNotification({
                  title: isAIEngaged ? `🤖 AI Alert: প্রসেসিং-এ আটকে আছে!` : `⚠️ Task Alert: শেষ হওয়ার সময় পার হয়েছে`,
                  message: `"${taskTitle}" অনেকক্ষণ ধরে In Progress-এ রয়েছে। কাজ শেষ হয়েছে কিনা চেক করুন।`,
                  type: 'in_progress_stuck',
                  taskId: task._id
                });
              }
            }
          }
        }

        // 3. Check Approaching Deadline / Overdue Alert ("কাজ শেষ হয়নি")
        if (task.status !== 'Done' && task.dueDate) {
          const dueDateObj = new Date(task.dueDate);
          const isToday = dueDateObj.toDateString() === now.toDateString();
          if (isToday && currentTimeInMins >= 18 * 60) {
            // After 6:00 PM today if task is still not done
            addNotification({
              title: isAIEngaged ? `🤖 AI Alert: কাজ শেষ হয়নি!` : `📅 Daily Reminder: কাজ সম্পন্ন করুন`,
              message: `আজকের কাজ "${taskTitle}" এখনো সম্পন্ন হয়নি। অনুগ্রহ করে সমাপ্ত করুন।`,
              type: 'overdue',
              taskId: task._id
            });
          }
        }
      });
    } catch (e) {
      console.warn('Task time monitoring error:', e);
    }
  };

  // Run initial check after 3 seconds, then every 40 seconds
  setTimeout(checkTasks, 3000);
  monitorIntervalId = setInterval(checkTasks, 40000);
}

export function stopTaskTimeMonitoring() {
  if (monitorIntervalId) {
    clearInterval(monitorIntervalId);
    monitorIntervalId = null;
  }
}
