# 🚀 Tasker: Universal AI-Powered Productivity Suite

A modern, high-performance, cross-platform productivity software designed for everyone—from farmers and retail store owners to tech entrepreneurs and software engineers.

---

## 🌟 Key Features

1. **Flexible Authentication**:
   - Log in or Sign up with **Username only** or **Email + Password**.
   - All tasks, clients, and settings are strictly scoped to the user ID.

2. **Work Dashboard (Current Workspace)**:
   - **Personal** and **Team** workspace tabs. Move tasks between Personal <-> Team with 1 click.
   - **Kanban Board** (To Do > In Progress > Done).
   - **List View** with quick status checkboxes and filters.
   - **Interactive Calendar View** (Date-to-date tracking, view previous completed history and future scheduled plans).

3. **Universal Task Creation (3 Tiers)**:
   - 🎙️ **Voice Mode**: Speak in Bangla or English to create tasks and schedules without typing.
   - ⚡ **Quick Mode**: 1-line task creation with presets for farming, retail, IT, and design.
   - 💼 **Pro Business Mode**: Detailed brief, client tagging, source link (Figma/GitHub), task directory categories, and local file attachments.

4. **Zero Cloud Storage Cost ($0 Hosting)**:
   - Files and task attachments are stored directly in your PC's configured directory (e.g., `C:/TaskerFiles`).
   - Community and Team chat media are transferred directly **P2P (WebRTC DataChannel / WhatsApp style)** without expensive cloud hosting.

5. **Google Gemini AI Assistant (BYOK)**:
   - Bring Your Own Gemini API Key (stored encrypted on your device).
   - Voice, text, and code snippet input.
   - Reasoning assistant breaks down tasks and schedule with 1-click **"Add to Kanban & Calendar"**.

6. **My Team & Community**:
   - Search users by username, send team invites, manage incoming team requests.
   - Global community chat for all Tasker users.
   - Bottom-right floating team/personal chat drawer.

7. **Client Dictionary & Task Directory**:
   - Manage clients and inspect all tasks associated with each client.
   - Customize profession-specific task categories and badges.

8. **Design System & 3 Themes**:
   - Instant switching between **Dark Mode**, **Gray (Slate) Mode**, and **Light Mode**.

---

## 🛠️ How to Run Locally

### 1. Start the Client (Frontend)
```bash
cd client
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 2. Start the Server (Backend)
```bash
cd server
npm install
npm run dev
```
*Note: The frontend includes intelligent local fallback mode so you can test all features and UI even before connecting MongoDB!*

### 3. Desktop / Mobile Packaging (Tauri v2)
To compile as a native Windows `.exe`, Android `.apk`, or iOS app:
```bash
npx @tauri-apps/cli init
npx @tauri-apps/cli build
```
