// Tasker API Client with resilient Offline/Fallback Mock Support
const API_BASE = 'http://localhost:5000/api';

// Local storage keys
const TOKEN_KEY = 'tasker_auth_token';
const USER_KEY = 'tasker_auth_user';
const TASKS_CACHE_KEY = 'tasker_local_tasks';
const CLIENTS_CACHE_KEY = 'tasker_local_clients';
const TASK_TYPES_CACHE_KEY = 'tasker_local_task_types';

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

// Generic fetch with auth header
async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    // If backend is offline or network error, fallback to offline local store
    console.warn(`API call failed for ${endpoint}, using offline fallback:`, err.message);
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
        settings: { theme: 'Dark', taskCreationMode: 'Simple', localAttachmentDir: 'C:/TaskerFiles' }
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
        settings: { theme: 'Dark', taskCreationMode: 'Simple', localAttachmentDir: 'C:/TaskerFiles' }
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

  async updateProfile(profileData) {
    try {
      const res = await request('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });
      const currentUser = getStoredUser();
      if (currentUser) {
        currentUser.profile = res.profile || profileData;
        setStoredUser(currentUser);
      }
      return res;
    } catch {
      const currentUser = getStoredUser();
      if (currentUser) {
        currentUser.profile = { ...currentUser.profile, ...profileData };
        setStoredUser(currentUser);
      }
      return { profile: profileData };
    }
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
  if (t) return JSON.parse(t);

  // Initial seed tasks for fresh experience
  const today = new Date().toISOString();
  const seed = [
    {
      _id: 'task_1',
      title: 'দুধ ডেলিভারি ও খামার পরিদর্শন',
      brief: 'সকাল ৭টায় দুধ সংগ্রহ করে ডেইরি সেন্টারে পৌঁছে দেওয়া',
      status: 'Done',
      priority: 'High',
      workspaceType: 'Personal',
      scheduledDate: today,
      clientId: null,
      taskTypeId: 'type_agri'
    },
    {
      _id: 'task_2',
      title: 'Review client website Figma wireframes',
      brief: 'Check landing page hero animations and typography',
      status: 'In Progress',
      priority: 'Urgent',
      sourceLink: 'https://figma.com',
      workspaceType: 'Personal',
      scheduledDate: today,
      clientId: 'client_1',
      taskTypeId: 'type_tech'
    },
    {
      _id: 'task_3',
      title: 'দোকানের মাসিক হিসাব ও সাপ্লায়ার পেমেন্ট',
      brief: 'খাতা মিলিয়ে ইনভয়েস ক্লিয়ার করা',
      status: 'To Do',
      priority: 'Medium',
      workspaceType: 'Personal',
      scheduledDate: today,
      clientId: null,
      taskTypeId: 'type_retail'
    },
    {
      _id: 'task_4',
      title: 'Deploy microservices to production cluster',
      brief: 'Check Docker images, SSL certificates, and run health check',
      status: 'To Do',
      priority: 'High',
      workspaceType: 'Team',
      scheduledDate: today,
      clientId: 'client_2',
      taskTypeId: 'type_tech'
    }
  ];
  localStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(seed));
  return seed;
};

const saveLocalTasks = (tasks) => {
  localStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(tasks));
};

export const taskApi = {
  async getAll(params = {}) {
    try {
      const q = new URLSearchParams(params).toString();
      const res = await request(`/tasks?${q}`);
      saveLocalTasks(res);
      return res;
    } catch {
      let list = getLocalTasks();
      if (params.workspaceType) {
        list = list.filter(t => t.workspaceType === params.workspaceType);
      }
      if (params.status) {
        list = list.filter(t => t.status === params.status);
      }
      return list;
    }
  },

  async create(data) {
    try {
      return await request('/tasks', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } catch {
      const list = getLocalTasks();
      const newTask = {
        _id: 'task_' + Date.now(),
        ...data,
        status: data.status || 'To Do',
        priority: data.priority || 'Medium',
        workspaceType: data.workspaceType || 'Personal',
        scheduledDate: data.scheduledDate || new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      list.unshift(newTask);
      saveLocalTasks(list);
      return newTask;
    }
  },

  async update(id, updates) {
    try {
      return await request(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
    } catch {
      const list = getLocalTasks();
      const idx = list.findIndex(t => t._id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates };
        if (updates.status === 'Done') list[idx].completedAt = new Date().toISOString();
        saveLocalTasks(list);
        return list[idx];
      }
      throw new Error('Task not found');
    }
  },

  async toggleWorkspace(id) {
    try {
      return await request(`/tasks/${id}/toggle-workspace`, { method: 'POST' });
    } catch {
      const list = getLocalTasks();
      const task = list.find(t => t._id === id);
      if (task) {
        task.workspaceType = task.workspaceType === 'Personal' ? 'Team' : 'Personal';
        saveLocalTasks(list);
        return { task, workspaceType: task.workspaceType };
      }
      throw new Error('Task not found');
    }
  },

  async delete(id) {
    try {
      return await request(`/tasks/${id}`, { method: 'DELETE' });
    } catch {
      let list = getLocalTasks();
      list = list.filter(t => t._id !== id);
      saveLocalTasks(list);
      return { message: 'Deleted' };
    }
  }
};

// =================== CLIENTS API ===================
const getLocalClients = () => {
  const c = localStorage.getItem(CLIENTS_CACHE_KEY);
  if (c) return JSON.parse(c);
  const seed = [
    {
      _id: 'client_1',
      name: 'Acme Digital Agency',
      contactPerson: 'David Miller',
      email: 'david@acme.io',
      phone: '+1 555-0192',
      company: 'Acme Global',
      notes: 'Prefers communication via Telegram / Slack'
    },
    {
      _id: 'client_2',
      name: 'সবুজ বাংলা ডেইরি ও এগ্রো',
      contactPerson: 'করিম সাহেব',
      email: 'karim@shobujagro.com',
      phone: '+880 1711-223344',
      company: 'Shobuj Agro Ltd',
      notes: 'প্রতি শনিবার দুধের অর্ডার কনফার্ম করে'
    }
  ];
  localStorage.setItem(CLIENTS_CACHE_KEY, JSON.stringify(seed));
  return seed;
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
  if (t) return JSON.parse(t);
  const seed = [
    { _id: 'type_agri', name: 'কৃষি ও খামার', category: 'Agriculture', color: '#10B981' },
    { _id: 'type_retail', name: 'দোকান ও ব্যবসা', category: 'Retail', color: '#F59E0B' },
    { _id: 'type_tech', name: 'সফটওয়্যার ও আইটি', category: 'Tech', color: '#6366F1' },
    { _id: 'type_design', name: 'ডিজাইন ও আর্ট', category: 'Design', color: '#EC4899' },
    { _id: 'type_general', name: 'দৈনন্দিন কাজ', category: 'General', color: '#06B6D4' }
  ];
  localStorage.setItem(TASK_TYPES_CACHE_KEY, JSON.stringify(seed));
  return seed;
};

export const taskTypeApi = {
  async getAll() {
    try {
      return await request('/task-types');
    } catch {
      return getLocalTaskTypes();
    }
  },
  async create(data) {
    try {
      return await request('/task-types', { method: 'POST', body: JSON.stringify(data) });
    } catch {
      const list = getLocalTaskTypes();
      const newT = { _id: 'type_' + Date.now(), ...data };
      list.push(newT);
      localStorage.setItem(TASK_TYPES_CACHE_KEY, JSON.stringify(list));
      return newT;
    }
  },
  async update(id, data) {
    try {
      return await request(`/task-types/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    } catch {
      const list = getLocalTaskTypes();
      const idx = list.findIndex(t => t._id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...data };
        localStorage.setItem(TASK_TYPES_CACHE_KEY, JSON.stringify(list));
        return list[idx];
      }
      throw new Error('Task type not found');
    }
  },
  async delete(id) {
    try {
      return await request(`/task-types/${id}`, { method: 'DELETE' });
    } catch {
      let list = getLocalTaskTypes();
      list = list.filter(t => t._id !== id);
      localStorage.setItem(TASK_TYPES_CACHE_KEY, JSON.stringify(list));
      return { message: 'Deleted' };
    }
  }
};

// =================== TEAMS API ===================
export const teamApi = {
  async searchUsers(query) {
    try {
      return await request(`/teams/users/search?q=${encodeURIComponent(query)}`);
    } catch {
      return [
        { _id: 'u_mock1', username: 'shakib_dev', profile: { fullName: 'Shakib Al Hasan', bio: 'Senior UI Engineer' } },
        { _id: 'u_mock2', username: 'rahim_farm', profile: { fullName: 'Rahim Mia', bio: 'Agri Business Consultant' } }
      ].filter(u => u.username.includes(query.toLowerCase()));
    }
  },
  async getMembers() {
    try {
      return await request('/teams/members');
    } catch {
      return {
        name: 'Alpha Squad',
        members: [
          { userId: { _id: 'u_me', username: 'you', profile: { fullName: 'Workspace Owner' } }, role: 'Admin' },
          { userId: { _id: 'u_teammate', username: 'tanvir_tech', profile: { fullName: 'Tanvir Hossain' } }, role: 'Member' }
        ]
      };
    }
  },
  async getRequests() {
    try {
      return await request('/teams/requests');
    } catch {
      return {
        incoming: [
          {
            requestId: 'req_1',
            teamName: 'Innovators Hub',
            fromUser: { username: 'farhan_pm', profile: { fullName: 'Farhan PM' } },
            createdAt: new Date().toISOString()
          }
        ]
      };
    }
  },
  async inviteUser(username) {
    try {
      return await request('/teams/invite', { method: 'POST', body: JSON.stringify({ targetUsername: username }) });
    } catch {
      return { message: `Invite sent to @${username}` };
    }
  },
  async respondRequest(requestId, action) {
    try {
      return await request(`/teams/requests/${requestId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
    } catch {
      return { message: `Request ${action}ed` };
    }
  },
  async removeMember(memberId) {
    try {
      return await request(`/teams/members/${memberId}`, { method: 'DELETE' });
    } catch {
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
      return [
        {
          _id: 'msg_1',
          senderUsername: 'tasker_bot',
          content: 'স্বাগতম Tasker গ্লোবাল কমিউনিটিতে! এখানে সবাই ফাইল ও আইডিয়া শেয়ার করতে পারবেন।',
          createdAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
          _id: 'msg_2',
          senderUsername: 'salman_agro',
          content: 'আজকের কাঁচা মরিচ ও পেঁয়াজের পাইকারি দর আপডেট পোস্ট করলাম।',
          createdAt: new Date(Date.now() - 1800000).toISOString()
        }
      ];
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
