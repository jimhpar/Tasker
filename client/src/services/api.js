// Tasker API Client with resilient Offline/Fallback Mock Support
const API_BASE = 'http://127.0.0.1:5000/api';

// Local storage keys
const TOKEN_KEY = 'tasker_auth_token';
const USER_KEY = 'tasker_auth_user';
const TASKS_CACHE_KEY = 'tasker_local_tasks';
const CLIENTS_CACHE_KEY = 'tasker_local_clients';
const TASK_TYPES_CACHE_KEY = 'tasker_local_task_types';
const TEAMS_CACHE_KEY = 'tasker_local_teams';
const TEAM_REQUESTS_CACHE_KEY = 'tasker_local_team_requests';
const ACTIVE_TEAM_KEY = 'tasker_active_team_id';
const PEOPLE_CACHE_KEY = 'tasker_connected_people';
const CONNECTION_REQUESTS_KEY = 'tasker_connection_requests_v1';

// Real-time Event & Tab/Window Synchronization Broadcaster
export const realtimeSyncChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('tasker_realtime_sync')
  : null;

export const notifyDataChanged = (type, detail = {}) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(`tasker_${type}_updated`, { detail }));
    try {
      realtimeSyncChannel?.postMessage({ type, detail });
    } catch {}
  }
};

if (realtimeSyncChannel) {
  realtimeSyncChannel.onmessage = (event) => {
    if (event.data?.type && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(`tasker_${event.data.type}_updated`, { detail: event.data.detail }));
    }
  };
}

// Auto-cleanup legacy mock and dummy data from previous sessions
(function cleanupLegacyMockData() {
  try {
    // Clean any malformed prompt tasks
    const rawTasks = localStorage.getItem(TASKS_CACHE_KEY);
    if (rawTasks) {
      try {
        const list = JSON.parse(rawTasks);
        const filtered = (list || []).filter(t =>
          !['task_1', 'task_2', 'task_3', 'task_4', 'task_5'].includes(t._id) &&
          !(t.title && t.title.toLowerCase().includes('kal dupure'))
        );
        localStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(filtered));
      } catch {
        localStorage.removeItem(TASKS_CACHE_KEY);
      }
    }

      // 3. Clean mock clients
      const rawClients = localStorage.getItem(CLIENTS_CACHE_KEY);
      if (rawClients) {
        try {
          const list = JSON.parse(rawClients);
          const filtered = (list || []).filter(c => !['client_1', 'client_2'].includes(c._id));
          localStorage.setItem(CLIENTS_CACHE_KEY, JSON.stringify(filtered));
        } catch {
          localStorage.removeItem(CLIENTS_CACHE_KEY);
        }
      }

      // 4. Clean mock teams (Alpha Squad, Green Field Operations)
      const rawTeams = localStorage.getItem(TEAMS_CACHE_KEY);
      if (rawTeams) {
        try {
          const list = JSON.parse(rawTeams);
          const filtered = (list || []).filter(t =>
            !['team_default', 'team_agro'].includes(t._id) &&
            t.name !== 'Alpha Squad' &&
            t.name !== 'Green Field Operations'
          );
          localStorage.setItem(TEAMS_CACHE_KEY, JSON.stringify(filtered));
        } catch {
          localStorage.removeItem(TEAMS_CACHE_KEY);
        }
      }

      // 5. Clean mock requests (req_1)
      const rawReqs = localStorage.getItem(TEAM_REQUESTS_CACHE_KEY);
      if (rawReqs) {
        try {
          const list = JSON.parse(rawReqs);
          const filtered = (list || []).filter(r => r.requestId !== 'req_1');
          localStorage.setItem(TEAM_REQUESTS_CACHE_KEY, JSON.stringify(filtered));
        } catch {
          localStorage.removeItem(TEAM_REQUESTS_CACHE_KEY);
        }
      }

      // 6. Reset active team if mock
      // 7. Clean mock admin users cache and stale admin flag
      localStorage.removeItem('tasker_admin_users');
      localStorage.removeItem('tasker_admin_users_cache');
      localStorage.removeItem('tasker_is_admin');

      localStorage.setItem('tasker_cleaned_dummy_v4', 'true');
  } catch (e) {
    console.error('Error cleaning legacy mock data:', e);
  }
})();

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getStoredUser = () => {
  const u = localStorage.getItem(USER_KEY);
  return u ? JSON.parse(u) : null;
};

export const setStoredUser = (user) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

// Generic fetch with auth header and resilient timeout for database operations
async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    // If backend is offline or network error, fallback to offline local store
    throw err;
  }
}


// =================== AUTH API ===================
export const authApi = {
  async register(data) {
    try {
      const res = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      setToken(res.token);
      setStoredUser(res.user);
      return res;
    } catch {
      // Offline fallback registration
      const mockUser = {
        id: 'usr_' + Date.now(),
        username: data.username.toLowerCase(),
        email: data.email || '',
        profile: { fullName: data.fullName || data.username, avatar: '', bio: '', links: [] },
        settings: { theme: 'Light', taskCreationMode: 'Simple', localAttachmentDir: 'C:/TaskerFiles' }
      };
      const mockToken = 'mock_jwt_' + Date.now();
      setToken(mockToken);
      setStoredUser(mockUser);
      return { token: mockToken, user: mockUser };
    }
  },

  async login(identifier, password) {
    try {
      const res = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password })
      });
      setToken(res.token);
      setStoredUser(res.user);
      return res;
    } catch {
      // Offline fallback login
      const mockUser = {
        id: 'usr_demo_1',
        username: identifier.toLowerCase(),
        email: identifier.includes('@') ? identifier : `${identifier}@tasker.app`,
        profile: { fullName: identifier, avatar: '', bio: 'Productivity Power User', links: [] },
        settings: { theme: 'Light', taskCreationMode: 'Simple', localAttachmentDir: 'C:/TaskerFiles' }
      };
      const mockToken = 'mock_jwt_demo';
      setToken(mockToken);
      setStoredUser(mockUser);
      return { token: mockToken, user: mockUser };
    }
  },

  async getMe() {
    try {
      return await request('/auth/me');
    } catch {
      return getStoredUser();
    }
  },

  async checkUsername(username) {
    try {
      return await request(`/auth/check-username?username=${encodeURIComponent(username)}`);
    } catch {
      return { available: username.length >= 5 };
    }
  },

  async updateProfile(profileData) {
    const { username, email, phone, ...pureProfile } = profileData;
    let res = null;
    try {
      res = await request('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });
    } catch (err) {
      console.warn('updateProfile offline fallback:', err);
    }

    const currentUser = getStoredUser();
    if (currentUser) {
      currentUser.profile = {
        ...currentUser.profile,
        ...(res?.profile || pureProfile)
      };
      delete currentUser.profile.username;

      if (email !== undefined) currentUser.email = email;
      if (phone !== undefined) currentUser.phone = phone;

      const newU = res?.username || username;
      if (newU) {
        currentUser.username = newU;
        if (['zim', 'zim_founder', 'admin'].includes(newU.toLowerCase())) {
          currentUser.role = 'admin';
        } else if (currentUser.role === 'admin' && !['zim', 'zim_founder', 'admin'].includes(newU.toLowerCase())) {
          currentUser.role = 'user';
        }
      }
      localStorage.removeItem('tasker_is_admin');
      setStoredUser(currentUser);
      window.dispatchEvent(new Event('tasker_user_updated'));
    }

    // Keep Admin Users list in sync immediately
    try {
      getLocalAdminUsers();
    } catch {}

    return res || { profile: pureProfile, username, email, phone };
  },



  async updateSettings(settingsData) {
    try {
      const res = await request('/auth/settings', {
        method: 'PUT',
        body: JSON.stringify(settingsData)
      });
      const currentUser = getStoredUser();
      if (currentUser) {
        currentUser.settings = res.settings;
        if (res.username) currentUser.username = res.username;
        setStoredUser(currentUser);
      }
      return res;
    } catch {
      const currentUser = getStoredUser();
      if (currentUser) {
        currentUser.settings = { ...currentUser.settings, ...settingsData };
        if (settingsData.username) currentUser.username = settingsData.username;
        setStoredUser(currentUser);
      }
      return { settings: settingsData };
    }
  }
};

// =================== TASKS API ===================
const getLocalTasks = () => {
  const t = localStorage.getItem(TASKS_CACHE_KEY);
  if (t) {
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
};

const saveLocalTasks = (tasks) => {
  localStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(tasks));
};

export const taskApi = {
  async getAll(params = {}) {
    let list = [];
    try {
      const q = new URLSearchParams(params).toString();
      const res = await request(`/tasks?${q}`);
      saveLocalTasks(res);
      list = res;
    } catch {
      list = getLocalTasks();
      if (params.workspaceType) {
        list = list.filter(t => t.workspaceType === params.workspaceType);
      }
      if (params.teamId) {
        list = list.filter(t => !t.teamId || t.teamId === params.teamId || t.teamId?._id === params.teamId);
      }
      if (params.status) {
        list = list.filter(t => t.status === params.status);
      }
    }

    // Filter personal tasks strictly by user ownership so Elias Sunny doesn't see Zim's personal tasks!
    const currentUser = getStoredUser();
    const myId = (currentUser?._id || currentUser?.id || '').toString().toLowerCase();
    const myUsername = (currentUser?.username || '').toLowerCase();

    return list.filter(t => {
      if (t.workspaceType === 'Personal') {
        const ownerId = (t.userId?._id || t.userId || '').toString().toLowerCase();
        const ownerName = (t.createdBy || '').toLowerCase();
        if (ownerId || ownerName) {
          const isMine = (myId && ownerId === myId) ||
                         (myUsername && ownerName === myUsername) ||
                         (myUsername && ownerId === myUsername);
          return isMine;
        }
        // Legacy tasks without owner: only Zim sees them
        return myUsername === 'zim' || myUsername === 'zim_founder';
      }
      return true;
    });
  },

  async create(data) {
    const currentUser = getStoredUser();
    const myId = currentUser?._id || currentUser?.id || currentUser?.username;
    const myUsername = currentUser?.username || 'user';
    const enrichedData = {
      ...data,
      userId: data.userId || myId,
      createdBy: data.createdBy || myUsername
    };

    let newTask;
    try {
      newTask = await request('/tasks', {
        method: 'POST',
        body: JSON.stringify(enrichedData)
      });
      // sync local
      const list = getLocalTasks();
      const existingIdx = list.findIndex(t => t._id === newTask._id);
      if (existingIdx !== -1) list[existingIdx] = newTask;
      else list.unshift(newTask);
      saveLocalTasks(list);
    } catch {
      const list = getLocalTasks();
      newTask = {
        _id: 'task_' + Date.now(),
        ...enrichedData,
        teamId: enrichedData.teamId || null,
        status: enrichedData.status || 'To Do',
        priority: enrichedData.priority || 'Medium',
        workspaceType: enrichedData.workspaceType || 'Personal',
        scheduledDate: enrichedData.scheduledDate || (enrichedData.dueDate ? new Date(enrichedData.dueDate).toISOString() : new Date().toISOString()),
        createdAt: new Date().toISOString()
      };
      list.unshift(newTask);
      saveLocalTasks(list);
    }
    notifyDataChanged('tasks', { action: 'create', task: newTask });
    return newTask;
  },

  async update(id, updates) {
    let updated;
    try {
      updated = await request(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
      const list = getLocalTasks();
      const idx = list.findIndex(t => t._id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updated };
        saveLocalTasks(list);
      }
    } catch {
      const list = getLocalTasks();
      const idx = list.findIndex(t => t._id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates };
        if (updates.status === 'Done') list[idx].completedAt = new Date().toISOString();
        saveLocalTasks(list);
        updated = list[idx];
      } else {
        throw new Error('Task not found');
      }
    }
    notifyDataChanged('tasks', { action: 'update', id, updates });
    return updated;
  },

  async toggleWorkspace(id) {
    let res;
    try {
      res = await request(`/tasks/${id}/toggle-workspace`, { method: 'POST' });
    } catch {
      const list = getLocalTasks();
      const task = list.find(t => t._id === id);
      if (task) {
        task.workspaceType = task.workspaceType === 'Personal' ? 'Team' : 'Personal';
        saveLocalTasks(list);
        res = { task, workspaceType: task.workspaceType };
      } else {
        throw new Error('Task not found');
      }
    }
    notifyDataChanged('tasks', { action: 'toggle', id });
    return res;
  },

  async delete(id) {
    try {
      await request(`/tasks/${id}`, { method: 'DELETE' });
    } catch {}
    let list = getLocalTasks();
    list = list.filter(t => t._id !== id);
    saveLocalTasks(list);
    notifyDataChanged('tasks', { action: 'delete', id });
    return { message: 'Deleted' };
  }
};

// =================== CLIENTS API ===================
const getLocalClients = () => {
  const c = localStorage.getItem(CLIENTS_CACHE_KEY);
  if (c) {
    try {
      const parsed = JSON.parse(c);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
};

export const clientApi = {
  async getAll() {
    try {
      return await request('/clients');
    } catch {
      return getLocalClients();
    }
  },
  async create(data) {
    try {
      return await request('/clients', { method: 'POST', body: JSON.stringify(data) });
    } catch {
      const list = getLocalClients();
      const newC = { _id: 'client_' + Date.now(), ...data };
      list.push(newC);
      localStorage.setItem(CLIENTS_CACHE_KEY, JSON.stringify(list));
      return newC;
    }
  },
  async update(id, data) {
    try {
      return await request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    } catch {
      const list = getLocalClients();
      const idx = list.findIndex(c => c._id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...data };
        localStorage.setItem(CLIENTS_CACHE_KEY, JSON.stringify(list));
        return list[idx];
      }
    }
  },
  async delete(id) {
    try {
      return await request(`/clients/${id}`, { method: 'DELETE' });
    } catch {
      let list = getLocalClients();
      list = list.filter(c => c._id !== id);
      localStorage.setItem(CLIENTS_CACHE_KEY, JSON.stringify(list));
      return { message: 'Deleted' };
    }
  }
};

// =================== TASK TYPES API ===================
const getLocalTaskTypes = () => {
  const t = localStorage.getItem(TASK_TYPES_CACHE_KEY);
  if (t) {
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
};

export const taskTypeApi = {
  async getAll(params = {}) {
    try {
      const q = new URLSearchParams(params).toString();
      const res = await request(`/task-types${q ? '?' + q : ''}`);
      return res;
    } catch {
      let list = getLocalTaskTypes();
      if (params.workspaceType) {
        list = list.filter(t => !t.workspaceType || t.workspaceType === params.workspaceType);
      }
      if (params.teamId) {
        list = list.filter(t => !t.teamId || t.teamId === params.teamId || t.teamId?._id === params.teamId);
      }
      return list;
    }
  },
  async create(data) {
    const list = getLocalTaskTypes();
    const newT = {
      _id: 'type_' + Date.now(),
      workspaceType: data.workspaceType || 'Personal',
      teamId: data.workspaceType === 'Team' ? (data.teamId || null) : null,
      ...data
    };
    list.push(newT);
    localStorage.setItem(TASK_TYPES_CACHE_KEY, JSON.stringify(list));

    try {
      const serverRes = await request('/task-types', { method: 'POST', body: JSON.stringify(data) });
      if (serverRes && serverRes._id) {
        const idx = list.findIndex(t => t._id === newT._id);
        if (idx !== -1) {
          list[idx] = serverRes;
          localStorage.setItem(TASK_TYPES_CACHE_KEY, JSON.stringify(list));
        }
        notifyDataChanged('task_types', { action: 'create', type: serverRes });
        return serverRes;
      }
      notifyDataChanged('task_types', { action: 'create', type: newT });
      return newT;
    } catch {
      notifyDataChanged('task_types', { action: 'create', type: newT });
      return newT;
    }
  },
  async update(id, data) {
    const list = getLocalTaskTypes();
    const idx = list.findIndex(t => t._id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...data };
      localStorage.setItem(TASK_TYPES_CACHE_KEY, JSON.stringify(list));
    }

    try {
      const serverRes = await request(`/task-types/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      notifyDataChanged('task_types', { action: 'update', id, data });
      return serverRes || list[idx];
    } catch {
      notifyDataChanged('task_types', { action: 'update', id, data });
      return list[idx];
    }
  },
  async delete(id) {
    let list = getLocalTaskTypes();
    list = list.filter(t => t._id !== id);
    localStorage.setItem(TASK_TYPES_CACHE_KEY, JSON.stringify(list));

    try {
      await request(`/task-types/${id}`, { method: 'DELETE' });
    } catch {}
    notifyDataChanged('task_types', { action: 'delete', id });
    return { message: 'Deleted' };
  }
};

// =================== TEAMS API ===================
const getLocalTeams = () => {
  const cached = localStorage.getItem(TEAMS_CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
};

const setLocalTeams = (teams) => {
  localStorage.setItem(TEAMS_CACHE_KEY, JSON.stringify(teams));
};

const getLocalRequests = () => {
  const cached = localStorage.getItem(TEAM_REQUESTS_CACHE_KEY);
  if (cached !== null) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
};

const setLocalRequests = (reqs) => {
  localStorage.setItem(TEAM_REQUESTS_CACHE_KEY, JSON.stringify(reqs));
};

export const teamApi = {
  getActiveTeamId() {
    const active = localStorage.getItem(ACTIVE_TEAM_KEY);
    if (active) return active;
    const teams = getLocalTeams();
    const fallbackId = teams[0]?._id || null;
    if (fallbackId) localStorage.setItem(ACTIVE_TEAM_KEY, fallbackId);
    return fallbackId;
  },

  setActiveTeamId(id) {
    localStorage.setItem(ACTIVE_TEAM_KEY, id);
  },

  async searchUsers(query) {
    try {
      return await request(`/teams/users/search?q=${encodeURIComponent(query)}`);
    } catch {
      return [];
    }
  },

  async getTeams() {
    try {
      const teams = await request('/teams');
      if (Array.isArray(teams) && teams.length > 0) {
        setLocalTeams(teams);
        return teams;
      }
      return getLocalTeams();
    } catch {
      return getLocalTeams();
    }
  },

  async createTeam(data) {
    try {
      const created = await request('/teams', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      const local = getLocalTeams();
      local.unshift(created);
      setLocalTeams(local);
      this.setActiveTeamId(created._id);
      return created;
    } catch {
      const u = getStoredUser() || { username: 'you', id: 'u_me' };
      const newTeam = {
        _id: 'team_' + Date.now(),
        name: data.name.trim(),
        ownerId: u.id || 'u_me',
        members: [
          {
            _id: 'm_' + Date.now(),
            userId: { _id: u.id || 'u_me', username: u.username, profile: u.profile || { fullName: u.username } },
            role: 'Admin'
          }
        ]
      };
      const local = getLocalTeams();
      local.unshift(newTeam);
      setLocalTeams(local);
      this.setActiveTeamId(newTeam._id);
      return newTeam;
    }
  },

  async updateTeam(teamId, data) {
    try {
      const updated = await request(`/teams/${teamId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      const local = getLocalTeams().map(t => t._id === teamId ? { ...t, ...updated } : t);
      setLocalTeams(local);
      return updated;
    } catch {
      const local = getLocalTeams().map(t => t._id === teamId ? { ...t, name: data.name } : t);
      setLocalTeams(local);
      return { _id: teamId, name: data.name };
    }
  },

  async deleteTeam(teamId) {
    try {
      await request(`/teams/${teamId}`, { method: 'DELETE' });
    } catch {}
    const local = getLocalTeams().filter(t => t._id !== teamId);
    setLocalTeams(local);
    if (this.getActiveTeamId() === teamId) {
      this.setActiveTeamId(local[0]?._id || '');
    }
    return { success: true, deletedTeamId: teamId };
  },

  async getMembers(teamId) {
    const activeId = teamId || this.getActiveTeamId();
    try {
      const url = activeId ? `/teams/${activeId}/members` : '/teams/members';
      return await request(url);
    } catch {
      const teams = getLocalTeams();
      const current = teams.find(t => t._id === activeId) || teams[0];
      return current || {
        _id: 'team_default',
        name: 'Workspace Team',
        members: []
      };
    }
  },

  async getRequests() {
    try {
      const res = await request('/teams/requests');
      if (res && Array.isArray(res.incoming)) {
        setLocalRequests(res.incoming);
        return res;
      }
      return { incoming: getLocalRequests() };
    } catch {
      return { incoming: getLocalRequests() };
    }
  },

  async inviteUser(username, teamId) {
    const activeId = teamId || this.getActiveTeamId();
    try {
      return await request('/teams/invite', {
        method: 'POST',
        body: JSON.stringify({ targetUsername: username, teamId: activeId })
      });
    } catch {
      return { message: `Invite sent to @${username}` };
    }
  },

  async respondRequest(requestId, action) {
    // 1. Always update local storage requests immediately
    const currentReqs = getLocalRequests();
    const reqItem = currentReqs.find(r => r.requestId === requestId);
    const updatedReqs = currentReqs.filter(r => r.requestId !== requestId);
    setLocalRequests(updatedReqs);

    // If accepted, add team to local teams
    if (action === 'accept' && reqItem) {
      const teams = getLocalTeams();
      const isAlready = teams.some(t => t.name === reqItem.teamName);
      if (!isAlready) {
        teams.push({
          _id: reqItem.teamId || ('team_' + Date.now()),
          name: reqItem.teamName || 'New Team',
          ownerId: reqItem.fromUser?.username || 'other',
          members: [
            {
              _id: 'm_' + Date.now(),
              userId: {
                _id: 'u_owner',
                username: reqItem.fromUser?.username || 'owner',
                profile: reqItem.fromUser?.profile || { fullName: reqItem.fromUser?.username }
              },
              role: 'Admin'
            },
            {
              _id: 'm_me_' + Date.now(),
              userId: { _id: 'u_me', username: 'you', profile: { fullName: 'Workspace Member' } },
              role: 'Member'
            }
          ]
        });
        setLocalTeams(teams);
      }
    }

    // 2. Try network call if server is available
    try {
      return await request(`/teams/requests/${requestId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
    } catch {
      return {
        message: action === 'reject' ? 'Team request rejected' : 'Team request accepted',
        action
      };
    }
  },

  async removeMember(memberId, teamId) {
    const activeId = teamId || this.getActiveTeamId();
    try {
      return await request(`/teams/${activeId}/members/${memberId}`, { method: 'DELETE' });
    } catch {
      const teams = getLocalTeams();
      const targetTeam = teams.find(t => t._id === activeId);
      if (targetTeam) {
        targetTeam.members = targetTeam.members.filter(
          m => m._id !== memberId && m.userId?._id !== memberId && m.userId !== memberId
        );
        setLocalTeams(teams);
      }
      return { message: 'Member removed from team' };
    }
  }
};

// =================== COMMUNITY API ===================
export const communityApi = {
  async getMessages() {
    try {
      return await request('/community/messages');
    } catch {
      return [];
    }
  },
  async sendMessage(data) {
    try {
      return await request('/community/messages', { method: 'POST', body: JSON.stringify(data) });
    } catch {
      const user = getStoredUser() || { username: 'anonymous' };
      return {
        _id: 'msg_' + Date.now(),
        senderUsername: user.username,
        content: data.content,
        isMediaP2P: data.isMediaP2P,
        mediaMetadata: data.mediaMetadata,
        createdAt: new Date().toISOString()
      };
    }
  }
};

// =================== PEOPLE & CONNECTED NETWORK API ===================
const getPeopleCacheKey = () => {
  const u = getStoredUser();
  const k = (u?._id || u?.id || u?.username || 'global').toString().toLowerCase();
  return `tasker_connected_people_${k}`;
};

const getLocalPeople = () => {
  const currentUser = getStoredUser();
  const myUsername = (currentUser?.username || '').toLowerCase();
  const userKey = getPeopleCacheKey();
  let list = [];

  const cached = localStorage.getItem(userKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) list = parsed;
    } catch {}
  }

  // Fallback: If empty, migrate from legacy or populate partner
  if (list.length === 0) {
    const legacy = localStorage.getItem(PEOPLE_CACHE_KEY);
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed)) {
          list = parsed.filter(p => (p.username || '').toLowerCase() !== myUsername);
        }
      } catch {}
    }

    // Default connections between Zim Founder and Elias Sunny
    if (list.length === 0) {
      if (myUsername === 'sunny') {
        list = [
          {
            _id: 'p_zim',
            username: 'zim',
            fullName: 'Zim Founder',
            bio: 'Founder & Workspace Owner',
            email: 'zim@tasker.app',
            connectedAt: new Date().toISOString(),
            teams: ['Default Workspace Team'],
            clientTag: ''
          }
        ];
        localStorage.setItem(userKey, JSON.stringify(list));
      } else if (myUsername === 'zim' || myUsername === 'zim_founder') {
        list = [
          {
            _id: 'p_sunny',
            username: 'sunny',
            fullName: 'Elias Sunny',
            bio: 'Connected Collaborator',
            email: 'sunny@tasker.app',
            connectedAt: new Date().toISOString(),
            teams: ['Default Workspace Team'],
            clientTag: ''
          }
        ];
        localStorage.setItem(userKey, JSON.stringify(list));
      }
    }
  }

  // Check any accepted connection requests
  const rawReqs = localStorage.getItem(CONNECTION_REQUESTS_KEY);
  if (rawReqs) {
    try {
      const reqList = JSON.parse(rawReqs) || [];
      reqList.forEach(r => {
        if (r.status === 'accepted') {
          const fromU = (r.fromUsername || '').toLowerCase();
          const toU = (r.toUsername || '').toLowerCase();
          if (toU === myUsername && fromU !== myUsername) {
            if (!list.some(p => (p.username || '').toLowerCase() === fromU)) {
              list.push({
                _id: 'p_' + fromU,
                username: fromU,
                fullName: r.fromFullName || fromU,
                bio: r.fromBio || 'Collaborator',
                email: r.fromEmail || `${fromU}@tasker.app`,
                connectedAt: r.createdAt || new Date().toISOString(),
                teams: [],
                clientTag: ''
              });
            }
          } else if (fromU === myUsername && toU !== myUsername) {
            if (!list.some(p => (p.username || '').toLowerCase() === toU)) {
              list.push({
                _id: 'p_' + toU,
                username: toU,
                fullName: r.toFullName || toU,
                bio: 'Collaborator',
                email: `${toU}@tasker.app`,
                connectedAt: r.createdAt || new Date().toISOString(),
                teams: [],
                clientTag: ''
              });
            }
          }
        }
      });
    } catch {}
  }

  // CRITICAL: A user must NEVER see themselves in their own connected list!
  return list.filter(p => (p.username || '').toLowerCase() !== myUsername);
};

const setLocalPeople = (list) => {
  const currentUser = getStoredUser();
  const myUsername = (currentUser?.username || '').toLowerCase();
  const cleanList = (list || []).filter(p => (p.username || '').toLowerCase() !== myUsername);
  localStorage.setItem(getPeopleCacheKey(), JSON.stringify(cleanList));
};

export const peopleApi = {
  async getPeople() {
    return getLocalPeople();
  },

  async addPerson(userData) {
    const list = getLocalPeople();
    const existing = list.find(p => p.username.toLowerCase() === userData.username.toLowerCase());
    if (existing) {
      return existing;
    }
    const newPerson = {
      _id: 'p_' + Date.now(),
      username: userData.username.toLowerCase(),
      fullName: userData.fullName || userData.profile?.fullName || userData.username,
      bio: userData.bio || userData.profile?.bio || 'Collaborator',
      email: userData.email || `${userData.username.toLowerCase()}@tasker.app`,
      connectedAt: new Date().toISOString(),
      teams: userData.teamName ? [userData.teamName] : [],
      clientTag: ''
    };
    list.unshift(newPerson);
    setLocalPeople(list);
    return newPerson;
  },

  async removePerson(personId) {
    const list = getLocalPeople().filter(p => p._id !== personId && p.username !== personId);
    setLocalPeople(list);
    return { success: true };
  },

  async assignToTeam(personId, teamName) {
    const list = getLocalPeople();
    const person = list.find(p => p._id === personId || p.username === personId);
    if (person) {
      if (!person.teams) person.teams = [];
      if (!person.teams.includes(teamName)) {
        person.teams.push(teamName);
      }
      setLocalPeople(list);
    }
    return person;
  },

  async tagToClient(personId, clientName) {
    const list = getLocalPeople();
    const person = list.find(p => p._id === personId || p.username === personId);
    if (person) {
      person.clientTag = clientName;
      setLocalPeople(list);
    }
    return person;
  },

  // Connection Requests Management
  getConnectionRequests() {
    const raw = localStorage.getItem(CONNECTION_REQUESTS_KEY);
    if (!raw) return [];
    try {
      const all = JSON.parse(raw);
      return Array.isArray(all) ? all.filter(r => r.status === 'pending') : [];
    } catch {
      return [];
    }
  },

  async sendConnectionRequest(fromUser, targetUser) {
    const raw = localStorage.getItem(CONNECTION_REQUESTS_KEY);
    let list = [];
    try { list = JSON.parse(raw) || []; } catch {}

    const fromU = fromUser?.username || 'You';
    const toU = targetUser?.username || 'User';

    // Check if already in connected people list
    const peopleList = getLocalPeople();
    if (peopleList.some(p => p.username?.toLowerCase() === toU.toLowerCase())) {
      return { status: 'already_connected' };
    }

    // Check if duplicate request already pending
    const existing = list.find(r =>
      r.status === 'pending' &&
      r.fromUsername?.toLowerCase() === fromU.toLowerCase() &&
      r.toUsername?.toLowerCase() === toU.toLowerCase()
    );
    if (existing) {
      return { status: 'already_sent', request: existing };
    }

    const newReq = {
      _id: 'creq_' + Date.now(),
      fromUserId: fromUser._id || fromUser.id || fromU,
      fromUsername: fromU,
      fromFullName: fromUser.profile?.fullName || fromUser.fullName || fromU,
      fromBio: fromUser.profile?.bio || fromUser.bio || 'Collaborator',
      fromEmail: fromUser.email || `${fromU.toLowerCase()}@tasker.app`,
      toUsername: toU,
      toFullName: targetUser.profile?.fullName || targetUser.fullName || toU,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    list.unshift(newReq);
    localStorage.setItem(CONNECTION_REQUESTS_KEY, JSON.stringify(list));
    notifyDataChanged('connection_requests', { action: 'sent', request: newReq });
    return { status: 'sent', request: newReq };
  },

  async acceptConnectionRequest(requestId) {
    const raw = localStorage.getItem(CONNECTION_REQUESTS_KEY);
    let list = [];
    try { list = JSON.parse(raw) || []; } catch {}
    const req = list.find(r => r._id === requestId);
    if (req) {
      req.status = 'accepted';
      localStorage.setItem(CONNECTION_REQUESTS_KEY, JSON.stringify(list));

      // Add sender to receiver's list
      await peopleApi.addPerson({
        username: req.fromUsername,
        fullName: req.fromFullName,
        bio: req.fromBio,
        email: req.fromEmail
      });

      // Also ensure receiver is added to sender's list
      const senderKey = `tasker_connected_people_${(req.fromUsername || '').toLowerCase()}`;
      try {
        let senderPeople = JSON.parse(localStorage.getItem(senderKey) || '[]');
        if (!senderPeople.some(p => (p.username || '').toLowerCase() === (req.toUsername || '').toLowerCase())) {
          senderPeople.push({
            _id: 'p_' + req.toUsername,
            username: req.toUsername.toLowerCase(),
            fullName: req.toFullName,
            bio: 'Collaborator',
            email: `${req.toUsername.toLowerCase()}@tasker.app`,
            connectedAt: new Date().toISOString(),
            teams: [],
            clientTag: ''
          });
          localStorage.setItem(senderKey, JSON.stringify(senderPeople));
        }
      } catch {}

      notifyDataChanged('connection_requests', { action: 'accepted', requestId });
      notifyDataChanged('people', { action: 'connected' });
      return { success: true, person: req };
    }
    return { success: false };
  },

  async declineConnectionRequest(requestId) {
    const raw = localStorage.getItem(CONNECTION_REQUESTS_KEY);
    let list = [];
    try { list = JSON.parse(raw) || []; } catch {}
    const req = list.find(r => r._id === requestId);
    if (req) {
      req.status = 'declined';
      localStorage.setItem(CONNECTION_REQUESTS_KEY, JSON.stringify(list));
      notifyDataChanged('connection_requests', { action: 'declined', requestId });
      return { success: true };
    }
    return { success: false };
  }
};

// Admin Management API with offline cache and instant profile synchronization
const ADMIN_USERS_KEY = 'tasker_admin_users_v2';
const ADMIN_PLANS_KEY = 'tasker_admin_plans_v2';

export const getLocalAdminUsers = () => {
  try {
    const raw = localStorage.getItem(ADMIN_USERS_KEY);
    let list = raw ? JSON.parse(raw) : [];

    // Always ensure the active logged-in user is in the list with exact matching profile data
    const currentUser = getStoredUser();
    if (currentUser) {
      const uId = currentUser.id || currentUser._id || 'u_admin';
      const uName = currentUser.username || 'zim';
      const existingIdx = list.findIndex(u =>
        u._id === uId ||
        u.username?.toLowerCase() === uName.toLowerCase() ||
        ['zim', 'zim_founder', 'admin'].includes(u.username?.toLowerCase())
      );

      const userEntry = {
        _id: uId,
        username: uName,
        email: currentUser.email || 'zim@tasker.com',
        phone: currentUser.phone || '+880 1700 000000',
        role: currentUser.role || 'admin',
        plan: currentUser.plan || 'enterprise',
        profile: {
          fullName: currentUser.profile?.fullName || currentUser.username || 'zim',
          avatar: currentUser.profile?.avatar || '',
          bio: currentUser.profile?.bio || '',
          links: currentUser.profile?.links || []
        },
        createdAt: currentUser.createdAt || new Date().toISOString()
      };

      if (existingIdx >= 0) {
        list[existingIdx] = { ...list[existingIdx], ...userEntry };
      } else {
        list.unshift(userEntry);
      }
      localStorage.setItem(ADMIN_USERS_KEY, JSON.stringify(list));
    }
    return list;
  } catch {
    return [];
  }
};

export const setLocalAdminUsers = (users) => {
  try {
    localStorage.setItem(ADMIN_USERS_KEY, JSON.stringify(users));
  } catch {}
};

export const adminApi = {
  async getUsers() {
    try {
      const data = await request('/admin/users');
      if (Array.isArray(data) && data.length > 0) {
        setLocalAdminUsers(data);
        return data;
      }
      return getLocalAdminUsers();
    } catch {
      return getLocalAdminUsers();
    }
  },

  async createUser(userData) {
    try {
      const data = await request('/admin/users', {
        method: 'POST',
        body: JSON.stringify(userData)
      });
      const list = getLocalAdminUsers();
      list.unshift(data);
      setLocalAdminUsers(list);
      return data;
    } catch (err) {
      console.warn('Admin createUser API fallback to local store:', err);
      const created = {
        _id: 'u_' + Date.now(),
        username: userData.username,
        email: userData.email || '',
        phone: userData.phone || '',
        role: userData.role || 'user',
        plan: userData.plan || 'free',
        profile: { fullName: userData.fullName || userData.username },
        createdAt: new Date().toISOString()
      };
      const list = getLocalAdminUsers();
      list.unshift(created);
      setLocalAdminUsers(list);
      return created;
    }
  },

  async updateUser(userId, userData) {
    let updated = null;
    try {
      updated = await request(`/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(userData)
      });
    } catch (err) {
      console.warn('Admin updateUser API fallback to local store:', err);
      updated = {
        _id: userId,
        ...userData,
        profile: { fullName: userData.fullName }
      };
    }

    // 1. Update in local admin users list
    try {
      let list = getLocalAdminUsers();
      list = list.map(u => {
        if (u._id === userId || (updated && u.username === updated.username)) {
          return {
            ...u,
            ...updated,
            profile: {
              ...(u.profile || {}),
              fullName: userData.fullName !== undefined ? userData.fullName : (u.profile?.fullName || '')
            }
          };
        }
        return u;
      });
      setLocalAdminUsers(list);
    } catch {}

    // 2. ALWAYS sync with current logged-in user if editing self
    const currentUser = getStoredUser();
    if (currentUser) {
      const isSelf =
        currentUser.id === userId ||
        currentUser._id === userId ||
        (updated && currentUser.username?.toLowerCase() === updated.username?.toLowerCase()) ||
        ['zim', 'zim_founder', 'admin'].includes(currentUser.username?.toLowerCase());

      if (isSelf) {
        if (userData.fullName !== undefined) {
          currentUser.profile = currentUser.profile || {};
          currentUser.profile.fullName = userData.fullName;
        }
        if (userData.email !== undefined) currentUser.email = userData.email;
        if (userData.phone !== undefined) currentUser.phone = userData.phone;
        if (userData.role !== undefined) currentUser.role = userData.role;
        if (userData.plan !== undefined) currentUser.plan = userData.plan;
        setStoredUser(currentUser);
        window.dispatchEvent(new Event('tasker_user_updated'));
      }
    }

    return updated;
  },

  async deleteUser(userId) {
    try {
      await request(`/admin/users/${userId}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn('Admin deleteUser API fallback to local store:', err);
    }
    const list = getLocalAdminUsers().filter(u => u._id !== userId);
    setLocalAdminUsers(list);
    return { success: true, id: userId };
  },

  async getPlans() {
    try {
      const data = await request('/admin/plans');
      if (Array.isArray(data) && data.length > 0) {
        localStorage.setItem(ADMIN_PLANS_KEY, JSON.stringify(data));
        return data;
      }
      const cached = localStorage.getItem(ADMIN_PLANS_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      const cached = localStorage.getItem(ADMIN_PLANS_KEY);
      return cached ? JSON.parse(cached) : [];
    }
  },

  async updatePlans(plans) {
    try {
      const data = await request('/admin/plans', {
        method: 'PUT',
        body: JSON.stringify({ plans })
      });
      localStorage.setItem(ADMIN_PLANS_KEY, JSON.stringify(plans));
      return data;
    } catch (err) {
      localStorage.setItem(ADMIN_PLANS_KEY, JSON.stringify(plans));
      return { message: 'Plans updated locally', plans };
    }
  }
};



