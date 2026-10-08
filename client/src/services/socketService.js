import { io } from 'socket.io-client';
import { getApiBase, getStoredUser } from './api';

let socketInstance = null;

// Initialize or get the global Socket.IO connection
export function getSocket() {
  if (typeof window === 'undefined') return null;

  if (!socketInstance) {
    const apiBase = getApiBase();
    // Convert https://tasker-backend-ifi9.onrender.com/api -> https://tasker-backend-ifi9.onrender.com
    const serverUrl = apiBase.replace(/\/api\/?$/, '');

    socketInstance = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      timeout: 10000
    });

    socketInstance.on('connect', () => {
      syncSocketUser();
    });

    socketInstance.on('new_channel_message', (msg) => {
      if (!msg) return;
      window.dispatchEvent(new CustomEvent('tasker_socket_channel_message', { detail: msg }));
    });

    socketInstance.on('new_inbox_message', (msg) => {
      if (!msg) return;
      window.dispatchEvent(new CustomEvent('tasker_socket_inbox_message', { detail: msg }));
    });

    socketInstance.on('new_community_message', (msg) => {
      if (!msg) return;
      window.dispatchEvent(new CustomEvent('tasker_socket_community_message', { detail: msg }));
    });
  }

  return socketInstance;
}

// Sync logged-in user with socket rooms for direct and team messaging
export function syncSocketUser(customUser = null) {
  const user = customUser || getStoredUser();
  if (!user || !socketInstance || !socketInstance.connected) return;

  const username = (user.username || '').toLowerCase();
  const userId = user._id || user.id;

  socketInstance.emit('user_online', { userId, username });
  socketInstance.emit('join_user', { username, userId });
}

// Explicit room joins for active teams
export function joinSocketTeam(teamId) {
  if (!teamId || !socketInstance || !socketInstance.connected) return;
  socketInstance.emit('join_team', { teamId: String(teamId) });
}
