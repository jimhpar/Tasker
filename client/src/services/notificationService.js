import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Tasker Real-time Notification & Time Management Alert Service
// Features: Web Audio API sound chime, desktop alerts, Android lock screen & shade notifications, and automated task alarm scheduling

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

// Request permission for push/local notifications on device & register channels with public lock screen visibility
export async function requestNotificationPermission() {
  try {
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      const status = await LocalNotifications.checkPermissions();
      if (status.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
      try {
        // 1. Chat Messages Channel (High Importance, Public Lock Screen)
        await LocalNotifications.createChannel({
          id: 'tasker_messages',
          name: 'Tasker Messages',
          description: 'Direct and team chat notifications',
          importance: 5,
          visibility: 1, // NotificationCompat.VISIBILITY_PUBLIC (Shows on Lock Screen)
          vibration: true,
          lights: true,
          lightColor: '#3b82f6'
        });

        // 2. Task Reminders & Deadlines Channel
        await LocalNotifications.createChannel({
          id: 'tasker_tasks',
          name: 'Tasker Task Reminders',
          description: 'Task alerts, start time reminders, and deadline notifications',
          importance: 5,
          visibility: 1, // NotificationCompat.VISIBILITY_PUBLIC (Shows on Lock Screen)
          vibration: true,
          lights: true,
          lightColor: '#d946ef'
        });

        // 3. System & AI Alerts Channel
        await LocalNotifications.createChannel({
          id: 'tasker_alerts',
          name: 'Tasker System & AI Alerts',
          description: 'System announcements and AI time management alerts',
          importance: 5,
          visibility: 1,
          vibration: true,
          lights: true,
          lightColor: '#10b981'
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

// Helper: Convert string task ID to deterministic integer ID (32-bit positive integer)
export function getNotificationId(taskId, suffix = 0) {
  if (!taskId) return Math.floor(Math.random() * 100000) + 1;
  let hash = 0;
  const str = String(taskId) + '_' + String(suffix);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 2147483640) + 1;
}

// Show native phone notification on Android (lock screen, notification shade, banner and icon badge) & fallback on desktop
export async function showPhoneShadeNotification(title, body, options = {}) {
  const opts = (typeof options === 'object' && options !== null)
    ? options
    : { id: typeof options === 'number' ? options : undefined };

  const id = opts.id || (
    opts.messageId
      ? getNotificationId(opts.messageId)
      : (opts.tag ? getNotificationId(opts.tag) : Math.floor(Math.random() * 100000) + 1)
  );
  const channelId = opts.channelId || 'tasker_messages';
  const badge = typeof opts.badge === 'number' ? opts.badge : 1;

  try {
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      try {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== 'granted') {
          await LocalNotifications.requestPermissions();
        }
      } catch {}

      const payload = {
        title: title || 'Tasker',
        body: body || '',
        largeBody: body || '',
        summaryText: opts.channelId === 'tasker_messages' ? 'Message' : 'Tasker Alert',
        id: id,
        channelId: channelId,
        smallIcon: 'ic_stat_tasker',
        largeIcon: 'ic_launcher',
        iconColor: '#3b82f6',
        foreground: true,
        badge: badge,
        autoCancel: true
      };

      if (opts.schedule && opts.schedule.at) {
        payload.schedule = {
          at: new Date(opts.schedule.at),
          allowWhileIdle: true
        };
      }

      await LocalNotifications.schedule({
        notifications: [payload]
      });
      return;
    }
  } catch (e) {
    console.warn('Phone notification shade error:', e);
  }

  showDesktopNotification(title, body);
}

// Clear all delivered notifications from shade & reset badge
export async function clearDeliveredPhoneNotifications() {
  try {
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      await LocalNotifications.removeAllDeliveredNotifications();
    }
  } catch (e) {
    console.warn('Error clearing delivered notifications:', e);
  }
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

// Add a single notification with sound chime, lock screen display, and badge count
export function addNotification({ title, message, type = 'reminder', taskId = null, playSound = true, badge = null }) {
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
    type, // 'not_started' | 'in_progress_stuck' | 'overdue' | 'reminder' | 'ai_planner' | 'chat'
    taskId,
    read: false,
    timestamp: new Date().toISOString()
  };

  const updated = [item, ...current.slice(0, 49)];
  saveNotifications(updated);

  if (playSound) {
    playAlertChime();
  }

  const unreadCount = updated.filter(n => !n.read).length;
  const channelId = type === 'chat'
    ? 'tasker_messages'
    : (['not_started', 'in_progress_stuck', 'overdue', 'reminder'].includes(type) ? 'tasker_tasks' : 'tasker_alerts');

  showPhoneShadeNotification(title, message, {
    channelId,
    badge: badge !== null ? badge : (unreadCount || 1),
    type
  });

  return item;
}

// Mark single notification as read
export function markAsRead(notificationId) {
  const current = getStoredNotifications();
  const updated = current.map(n => n.id === notificationId ? { ...n, read: true } : n);
  saveNotifications(updated);
}

// Mark all notifications as read & clear shade
export function markAllAsRead() {
  const current = getStoredNotifications();
  const updated = current.map(n => ({ ...n, read: true }));
  saveNotifications(updated);
  clearDeliveredPhoneNotifications();
}

// Clear all notifications
export function clearAllNotifications() {
  saveNotifications([]);
  clearDeliveredPhoneNotifications();
}

// Pre-schedule future task alarms into Android OS AlarmManager (fires on Lock Screen, Banner, Shade & Badge)
export async function scheduleTaskAlarms(tasks) {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) return;
  if (!Array.isArray(tasks) || tasks.length === 0) return;

  try {
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
    } catch {}

    const notificationsToSchedule = [];
    const now = Date.now();

    for (const task of tasks) {
      if (task.status === 'Done' || task.isTrash) continue;

      const title = task.title || 'Upcoming Task';

      // 1. Scheduled Start Time Reminder
      if (task.status === 'To Do' && (task.scheduledStartTime || task.dueTime)) {
        const timeStr = task.scheduledStartTime || task.dueTime;
        const [h, m] = timeStr.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) {
          const taskDate = task.scheduledDate ? new Date(task.scheduledDate) : new Date();
          taskDate.setHours(h, m, 0, 0);

          if (taskDate.getTime() > now + 30000) { // More than 30s in the future
            notificationsToSchedule.push({
              id: getNotificationId(task._id, 1),
              title: task.engageAI ? '🤖 AI Alert: কাজ শুরু করার সময় হয়েছে' : '⏰ Task Reminder: কাজ শুরু করুন',
              body: `"${title}" নির্ধারিত সময় (${timeStr}) হয়ে গেছে। অবিলম্বে শুরু করুন।`,
              channelId: 'tasker_tasks',
              smallIcon: 'ic_stat_tasker',
              largeIcon: 'ic_launcher',
              iconColor: '#3b82f6',
              foreground: true,
              badge: 1,
              autoCancel: true,
              schedule: {
                at: taskDate,
                allowWhileIdle: true
              }
            });
          }
        }
      } else if (task.status === 'To Do' && task.scheduledDate) {
        // Morning Reminder for tasks without explicit time (9:00 AM on scheduled date)
        const schedDate = new Date(task.scheduledDate);
        schedDate.setHours(9, 0, 0, 0);
        if (schedDate.getTime() > now + 30000) {
          notificationsToSchedule.push({
            id: getNotificationId(task._id, 4),
            title: '📋 Scheduled Task: আজকের কাজ',
            body: `"${title}" কাজটির জন্য আজকের দিন নির্ধারিত রয়েছে।`,
            channelId: 'tasker_tasks',
            smallIcon: 'ic_stat_tasker',
            largeIcon: 'ic_launcher',
            iconColor: '#3b82f6',
            foreground: true,
            badge: 1,
            autoCancel: true,
            schedule: {
              at: schedDate,
              allowWhileIdle: true
            }
          });
        }
      }

      // 2. Scheduled End Time Alert
      if (task.scheduledEndTime) {
        const [h, m] = task.scheduledEndTime.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) {
          const taskDate = task.scheduledDate ? new Date(task.scheduledDate) : new Date();
          taskDate.setHours(h, m, 0, 0);

          if (taskDate.getTime() > now + 30000) {
            notificationsToSchedule.push({
              id: getNotificationId(task._id, 2),
              title: '⚠️ Task Alert: সময় সমাপ্তির নোটিফিকেশন',
              body: `"${title}" কাজটির নির্ধারিত শেষ সময় পার হয়েছে। সমাপ্তি স্ট্যাটাস চেক করুন।`,
              channelId: 'tasker_tasks',
              smallIcon: 'ic_stat_tasker',
              largeIcon: 'ic_launcher',
              iconColor: '#ef4444',
              foreground: true,
              badge: 1,
              autoCancel: true,
              schedule: {
                at: taskDate,
                allowWhileIdle: true
              }
            });
          }
        }
      }

      // 3. Due Date Evening Reminder (6:00 PM on due date)
      if (task.status !== 'Done' && task.dueDate) {
        const dueDateObj = new Date(task.dueDate);
        dueDateObj.setHours(18, 0, 0, 0);
        if (dueDateObj.getTime() > now + 30000) {
          notificationsToSchedule.push({
            id: getNotificationId(task._id, 3),
            title: task.engageAI ? '🤖 AI Alert: কাজ শেষ হয়নি!' : '📅 Daily Reminder: কাজ সম্পন্ন করুন',
            body: `"${title}" আজকের জন্য নির্ধারিত কাজ এখনো সম্পন্ন হয়নি। অনুগ্রহ করে সমাপ্ত করুন।`,
            channelId: 'tasker_tasks',
            smallIcon: 'ic_stat_tasker',
            largeIcon: 'ic_launcher',
            iconColor: '#f59e0b',
            foreground: true,
            badge: 1,
            autoCancel: true,
            schedule: {
              at: dueDateObj,
              allowWhileIdle: true
            }
          });
        }
      }
    }

    if (notificationsToSchedule.length > 0) {
      await LocalNotifications.schedule({
        notifications: notificationsToSchedule
      });
    }
  } catch (e) {
    console.warn('Error scheduling task alarms:', e);
  }
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
        // Skip done tasks or trashed tasks
        if (task.status === 'Done' || task.isTrash) return;

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

  // Run initial check after 3 seconds, then every 30 seconds
  setTimeout(checkTasks, 3000);
  monitorIntervalId = setInterval(checkTasks, 30000);
}

export function stopTaskTimeMonitoring() {
  if (monitorIntervalId) {
    clearInterval(monitorIntervalId);
    monitorIntervalId = null;
  }
}
