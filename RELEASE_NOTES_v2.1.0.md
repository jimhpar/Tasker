# Tasker v2.1.0 — Autonomous Gemini 3.8 Flash & Next-Gen Productivity Suite 🚀

**Release Date:** October 07, 2026  
**Build Artifact:** `Tasker Setup 2.1.0.exe` (Windows x64 NSIS Installer)  
**Binary Size:** ~93.2 MB  

---

## 🌟 What's New in Version 2.1.0

### 🧠 1. Google Gemini 3.8 Flash Autonomous Agent
- **Chain-of-Thought (CoT) Visualizer**: Real-time thinking animation that displays step-by-step reasoning (Intent Analysis → Memory/Habit Check → Schedule Conflict Detection → Action Decision).
- **Direct Board Automation**: The assistant can now autonomously schedule, update, complete, and organize tasks directly on the live Tasker board without manual intervention.
- **Multilingual & Banglish Comprehension**: Communicates naturally in Bengali, English, and Banglish (e.g., *"aj bikale ghurte jabo task e add kore rakho"*).
- **Intelligent Intent Classifier**: Perfectly differentiates conversational questions, habit memory, task creation, and calendar viewing.

### 🎙️ 2. Natural Human-like Voice Engine
- Replaced robotic synthesizer with a rich, expressive human-like speech engine.
- Natural pitch, modulation, and fluid sentence transitions in both Bengali and English.
- Instant speech interruption, mute controls, and volume calibration.

### 🧩 3. Persistent Memory & Adaptive Learning
- **Context Awareness**: Remembers protected user routines (e.g., lunch breaks, deep work hours, morning meetings).
- **Conversational Corrections**: Automatically learns and adapts when corrected by the user and persists preferences across sessions.

### 👥 4. Smart Team vs. Personal Workspace Routing
- **Default Isolation**: Prompts default safely to your **Personal Workspace** unless a team is explicitly mentioned.
- **Auto Team Detection**: Mentions of teams or colleagues (e.g., *"Alpha Squad team e dao"*, *"Sunny ke assign koro"*) automatically route to the corresponding Team workspace and assign the designated member.

### 📅 5. Seamless Work Dashboard & Calendar Synchronization
- **Instant Today's Board Sync**: Today's tasks appear immediately in the **Work Dashboard's Kanban** columns (*To Do*, *In Progress*, *Done*).
- **Future Date Segregation**: Upcoming tasks for tomorrow and beyond cleanly populate the **Calendar View** to keep today's dashboard focused.
- **Quick "আগামীকাল" (Tomorrow) Shortcut**: Added a single-click button in the Calendar View to review tomorrow's planned activities instantly.
- **Resolved Task Disappearance Bug**: Fixed ownership filter mismatch between local session tokens and database IDs. Personal tasks now render reliably without dropping out.

### ⚡ 6. Offline-First & Hybrid Cloud Sync
- Full offline fallback support with automatic background cloud synchronization when connected.
- Robust Mongoose object sanitization preventing broken inserts.

---

## 📦 Installation Instructions

### 💻 Windows Desktop (NSIS Setup Wizard)
1. Download **`Tasker Setup 2.1.0.exe`** from the Assets below.
2. Run the installer to launch the Setup Wizard.
3. Choose your preferred installation directory.
4. Launch **Tasker** directly from your Desktop or Start Menu.

### 📱 7. Mobile Experience & Android App Enhancements
- **Official App Icon**: Custom brand launcher icon generated across all mipmap density buckets (mdpi to xxxhdpi) replacing the default template logo.
- **Harmful App / Play Protect Warning Resolution**: Signed with an official release keystore and configured `debuggable=false`, eliminating installation security warnings.
- **Compact Mobile Calendar View**: Calendar grid compacted vertically on mobile screens with selected date's full task list rendered underneath, eliminating horizontal scrolling.
- **Mobile Client Dictionary**: Selected Client details card pinned to the top; Client Roster list placed below it with live search bar, `+ Add Client` button, and in-row Edit popup modal and Delete.
- **Mobile Task Directory**: Workspace switchers optimized for small screens; Add Task Type card on top, Task Types list below with in-row Edit popup modal and Delete.
- **Task Modal Enhancements**: Removed visible scrollbars (`no-scrollbar`), replaced voice input button with a sleek circular microphone icon button (text removed), and fixed mobile touch/click audio recording events.
- **Universal Local File & Media Lightbox Viewer**: View attachments with zoom-in (+), zoom-out (-), reset, pan/drag for images; full video player with standard playback controls for videos; one-click local download for any attachment. 100% on-device local storage.
- **Global Community Chat Persistence**: Real-time 3-day history with 0ms optimistic message and voice note sending and local cache.
- **Collapsible Slide-over Drawer**: Sidebar converts to an intuitive hamburger slide-over menu on mobile screens that is closed by default, freeing up 100% of viewport width.
- **Mobile Kanban Tab Switcher**: Multi-column board shifts dynamically on mobile devices into a swipeable tab switcher (`To Do`, `In Progress`, `Submit for Review`, `Approved/Done`), rendering each column at 100% full width without horizontal scrolling.

---

## 📦 Installation Instructions

### 💻 Windows Desktop (NSIS Setup Wizard)
1. Download **`Tasker Setup 2.1.0.exe`** from the Assets below.
2. Run the installer to launch the Setup Wizard.
3. Choose your preferred installation directory.
4. Launch **Tasker** directly from your Desktop or Start Menu.

### 📱 Android Mobile (APK)
1. Download **`Tasker.apk`** from the Assets below.
2. Open the `.apk` on your Android device.
3. Tap **Install** and launch Tasker on your phone or tablet.

---

### SHA-256 Checksums
```text
File: Tasker Setup 2.1.0.exe
Target: Windows x64 (NSIS)
SHA-256: 62FF6766FED7EE3C7A3B406146648FA00AF89BD563E633EFDA036E1F09DDFC23

File: Tasker.apk / Tasker-v2.1.0.apk
Target: Android (Universal ARM64 / x86_64, Signed Release)
SHA-256: B6D3831751673CAE0610E4AE1E12F4F3488ECDF9BBD73A12D8630E508D9F2785
```
