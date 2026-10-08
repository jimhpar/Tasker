// Service to track and manage unread chat notifications for Teams and Direct Contacts

const READ_TIMES_KEY = 'tasker_chat_read_times_v1';
const UNREAD_TARGETS_KEY = 'tasker_chat_unread_targets_v1';

export function getChatReadTimes() {
  try {
    const raw = localStorage.getItem(READ_TIMES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveChatReadTimes(times) {
  try {
    localStorage.setItem(READ_TIMES_KEY, JSON.stringify(times));
  } catch {}
}

export function getUnreadChatTargets() {
  try {
    const raw = localStorage.getItem(UNREAD_TARGETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveUnreadChatTargets(targets) {
  try {
    localStorage.setItem(UNREAD_TARGETS_KEY, JSON.stringify(targets));
  } catch {}
}

export function markTargetAsRead(target) {
  if (!target) return [];
  const readTimes = getChatReadTimes();
  const now = Date.now();

  const keysToRemove = [];
  if (target.id) keysToRemove.push(String(target.id).toLowerCase());
  if (target._id) keysToRemove.push(String(target._id).toLowerCase());
  if (target.username) keysToRemove.push(String(target.username).toLowerCase());
  if (target.name) keysToRemove.push(String(target.name).toLowerCase());

  keysToRemove.forEach(k => {
    readTimes[k] = now;
  });
  saveChatReadTimes(readTimes);

  const currentUnread = getUnreadChatTargets();
  const updatedUnread = currentUnread.filter(k => !keysToRemove.includes(k.toLowerCase()));
  saveUnreadChatTargets(updatedUnread);

  window.dispatchEvent(new CustomEvent('tasker_chat_unread_changed', {
    detail: { unreadTargets: updatedUnread, hasUnread: updatedUnread.length > 0 }
  }));

  return updatedUnread;
}

export function processInboxForUnread(inboxMessages, currentUsername, activeTarget = null) {
  if (!Array.isArray(inboxMessages) || inboxMessages.length === 0) {
    return getUnreadChatTargets();
  }

  const myU = (currentUsername || '').toLowerCase();
  const readTimes = getChatReadTimes();
  const currentUnread = new Set(getUnreadChatTargets());

  const activeKeys = [];
  if (activeTarget) {
    if (activeTarget.id) activeKeys.push(String(activeTarget.id).toLowerCase());
    if (activeTarget._id) activeKeys.push(String(activeTarget._id).toLowerCase());
    if (activeTarget.username) activeKeys.push(String(activeTarget.username).toLowerCase());
    if (activeTarget.name) activeKeys.push(String(activeTarget.name).toLowerCase());
  }

  for (const msg of inboxMessages) {
    const senderU = (msg.senderUsername || '').toLowerCase();
    if (!senderU || senderU === myU) continue;

    const msgTime = new Date(msg.createdAt).getTime();

    if (msg.channelType === 'Direct') {
      const targetKey = senderU;
      // If user is currently actively chatting with this person, keep as read
      if (activeKeys.includes(targetKey)) {
        readTimes[targetKey] = Date.now();
        continue;
      }
      const lastRead = readTimes[targetKey] || 0;
      if (msgTime > lastRead) {
        currentUnread.add(targetKey);
      }
    } else if (msg.channelType === 'Team') {
      const channelId = String(msg.channelId || '').toLowerCase();
      if (!channelId) continue;
      // If user is currently actively chatting in this team, keep as read
      if (activeKeys.includes(channelId)) {
        readTimes[channelId] = Date.now();
        continue;
      }
      const lastRead = readTimes[channelId] || 0;
      if (msgTime > lastRead) {
        currentUnread.add(channelId);
      }
    }
  }

  saveChatReadTimes(readTimes);
  const updatedList = Array.from(currentUnread);
  saveUnreadChatTargets(updatedList);

  window.dispatchEvent(new CustomEvent('tasker_chat_unread_changed', {
    detail: { unreadTargets: updatedList, hasUnread: updatedList.length > 0 }
  }));

  return updatedList;
}

export function clearAllChatUnread() {
  saveUnreadChatTargets([]);
  window.dispatchEvent(new CustomEvent('tasker_chat_unread_changed', {
    detail: { unreadTargets: [], hasUnread: false }
  }));
}

export function pruneStaleUnreadTargets(validPeople = [], validTeams = []) {
  const currentUnread = getUnreadChatTargets();
  if (currentUnread.length === 0) return [];

  const validKeys = new Set();
  (validPeople || []).forEach(p => {
    if (p.username) validKeys.add(String(p.username).toLowerCase());
    if (p._id) validKeys.add(String(p._id).toLowerCase());
    if (p.id) validKeys.add(String(p.id).toLowerCase());
  });
  (validTeams || []).forEach(t => {
    if (t._id) validKeys.add(String(t._id).toLowerCase());
    if (t.id) validKeys.add(String(t.id).toLowerCase());
    if (t.name) validKeys.add(String(t.name).toLowerCase());
  });

  const cleaned = currentUnread.filter(k => validKeys.has(k.toLowerCase()));
  if (cleaned.length !== currentUnread.length) {
    saveUnreadChatTargets(cleaned);
    window.dispatchEvent(new CustomEvent('tasker_chat_unread_changed', {
      detail: { unreadTargets: cleaned, hasUnread: cleaned.length > 0 }
    }));
  }
  return cleaned;
}
