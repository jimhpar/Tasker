import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  Calendar as CalendarIcon,
  Tag,
  Building,
  ExternalLink,
  Edit3
} from 'lucide-react';

export default function CalendarView({ tasks, onUpdateTask, onOpenNewTaskForDate, onEditTask }) {
  const { t, lang } = useLanguage();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const bnMonths = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ',
    'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর',
    'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];

  const enMonths = [
    'January', 'February', 'March',
    'April', 'May', 'June',
    'July', 'August', 'September',
    'October', 'November', 'December'
  ];

  const monthNames = lang === 'bn' ? bnMonths : enMonths;

  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const jumpToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const formatDateKey = (d) => {
    const dateObj = new Date(d);
    return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
  };

  const selectedDateKey = formatDateKey(selectedDate);
  const todayKey = formatDateKey(new Date());

  const { user } = useAuth();
  const myId = (user?._id || user?.id || '').toString().toLowerCase();
  const myUsername = (user?.username || '').toLowerCase();

  // Group tasks by date with personal ownership check
  const tasksByDate = {};
  tasks.forEach((taskItem) => {
    if (taskItem.workspaceType === 'Personal') {
      const ownerId = (taskItem.userId?._id || taskItem.userId || '').toString().toLowerCase();
      const ownerName = (taskItem.createdBy || '').toLowerCase();
      if (ownerId || ownerName) {
        const isMine = (myId && ownerId === myId) ||
                       (myUsername && ownerName === myUsername) ||
                       (myUsername && ownerId === myUsername);
        if (!isMine) return;
      } else if (myUsername !== 'zim' && myUsername !== 'zim_founder') {
        return;
      }
    }

    const key = formatDateKey(taskItem.scheduledDate || taskItem.createdAt);
    if (!tasksByDate[key]) tasksByDate[key] = [];
    tasksByDate[key].push(taskItem);
  });

  const selectedDateTasks = tasksByDate[selectedDateKey] || [];

  const handleToggleStatus = (taskItem) => {
    const newStatus = taskItem.status === 'Done' ? 'To Do' : 'Done';
    onUpdateTask(taskItem._id, { status: newStatus });
  };

  const isPast = (dateObj) => {
    const d = new Date(dateObj);
    d.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return d < now;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Calendar Header Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Month Selector */}
          <select
            value={month}
            onChange={(e) => setCurrentDate(new Date(year, parseInt(e.target.value, 10), 1))}
            style={{
              padding: '6px 12px',
              fontSize: '1.05rem',
              fontWeight: 800,
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-main)',
              cursor: 'pointer'
            }}
          >
            {monthNames.map((mName, idx) => (
              <option key={idx} value={idx}>
                {mName}
              </option>
            ))}
          </select>

          {/* Year Selector */}
          <select
            value={year}
            onChange={(e) => setCurrentDate(new Date(parseInt(e.target.value, 10), month, 1))}
            style={{
              padding: '6px 12px',
              fontSize: '1.05rem',
              fontWeight: 800,
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-main)',
              cursor: 'pointer'
            }}
          >
            {Array.from({ length: 16 }, (_, i) => 2022 + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            onClick={jumpToToday}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            {t.today}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prevMonth} className="btn btn-secondary" style={{ padding: '8px 12px' }} title="Previous Month">
            <ChevronLeft size={18} />
          </button>
          <button onClick={nextMonth} className="btn btn-secondary" style={{ padding: '8px 12px' }} title="Next Month">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Main Grid: Calendar on Left, Selected Date Details on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.8fr) minmax(280px, 1.2fr)', gap: 20, alignItems: 'start' }}>
        {/* Calendar Month Grid Card */}
        <div className="card" style={{ padding: 18 }}>
          {/* Day Names Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: 10, fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <div>{t.sun}</div>
            <div>{t.mon}</div>
            <div>{t.tue}</div>
            <div>{t.wed}</div>
            <div>{t.thu}</div>
            <div>{t.fri}</div>
            <div>{t.sat}</div>
          </div>

          {/* Days Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {Array.from({ length: firstDayIndex }).map((_, i) => {
              const dayNum = prevMonthDays - firstDayIndex + i + 1;
              return (
                <div
                  key={`prev-${i}`}
                  style={{
                    height: 72,
                    padding: 6,
                    borderRadius: 10,
                    opacity: 0.3,
                    background: 'var(--bg-input)',
                    fontSize: '0.8rem'
                  }}
                >
                  {dayNum}
                </div>
              );
            })}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateObj = new Date(year, month, dayNum);
              const dateKey = formatDateKey(dateObj);
              const dayTasks = tasksByDate[dateKey] || [];
              const isSelected = dateKey === selectedDateKey;
              const isToday = dateKey === todayKey;
              const doneCount = dayTasks.filter(item => item.status === 'Done').length;
              const pendingCount = dayTasks.length - doneCount;

              return (
                <div
                  key={`day-${dayNum}`}
                  onClick={() => setSelectedDate(dateObj)}
                  style={{
                    minHeight: 74,
                    padding: '8px 6px',
                    borderRadius: 12,
                    background: isSelected ? 'var(--primary-glow)' : 'var(--bg-input)',
                    border: isSelected ? '2px solid var(--primary)' : isToday ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        fontWeight: isToday || isSelected ? 800 : 600,
                        fontSize: '0.85rem',
                        color: isToday ? 'var(--primary)' : 'inherit'
                      }}
                    >
                      {dayNum}
                    </span>
                    {isToday && (
                      <span style={{ fontSize: '0.65rem', background: 'var(--primary)', color: 'var(--bg-app)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                        {t.todayBadge}
                      </span>
                    )}
                  </div>

                  {/* Task Status Indicators / Badges */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                    {dayTasks.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        {doneCount > 0 && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--success)', fontWeight: 700 }}>
                            ● {doneCount} {t.completedCount}
                          </span>
                        )}
                        {pendingCount > 0 && (
                          <span style={{ fontSize: '0.68rem', color: isPast(dateObj) ? 'var(--danger)' : 'var(--warning)', fontWeight: 700 }}>
                            ● {pendingCount} {t.pendingCount}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Date Details Panel (Previous History & Future Work) */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)', fontWeight: 700 }}>
                {isPast(selectedDate) && selectedDateKey !== todayKey ? t.pastHistoryTitle : selectedDateKey === todayKey ? t.todayTitle : t.futurePlanTitle}
              </span>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 2 }}>
                {selectedDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
              </h3>
            </div>
            <button
              onClick={() => onOpenNewTaskForDate(selectedDate)}
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              <Plus size={15} /> {t.addTaskOnDate}
            </button>
          </div>

          {/* List of Tasks for Selected Date */}
          {selectedDateTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
              <CalendarIcon size={36} color="var(--text-muted)" style={{ margin: '0 auto 10px', opacity: 0.6 }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t.noTasksOnDate}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 440, overflowY: 'auto' }}>
              {selectedDateTasks.map((taskItem) => {
                const isDone = taskItem.status === 'Done';
                return (
                  <div
                    key={taskItem._id}
                    style={{
                      background: 'var(--bg-input)',
                      border: isDone ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border-subtle)',
                      borderRadius: 12,
                      padding: 12,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      transition: 'all 0.2s'
                    }}
                  >
                    <button
                      onClick={() => handleToggleStatus(taskItem)}
                      style={{ marginTop: 2, color: isDone ? 'var(--success)' : 'var(--text-muted)' }}
                    >
                      {isDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                    </button>

                    <div
                      style={{ flex: 1, minWidth: 0, cursor: onEditTask ? 'pointer' : 'default' }}
                      onClick={() => onEditTask && onEditTask(taskItem)}
                      title="Click to view details & edit task"
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          textDecoration: isDone ? 'line-through' : 'none',
                          color: isDone ? 'var(--text-muted)' : 'var(--text-main)'
                        }}
                      >
                        {taskItem.title}
                      </div>

                      {taskItem.brief && (
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                          {taskItem.brief}
                        </p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                        {taskItem.priority && (
                          <span className={`badge ${taskItem.priority === 'Urgent' ? 'badge-urgent' : taskItem.priority === 'High' ? 'badge-progress' : 'badge-todo'}`} style={{ fontSize: '0.65rem' }}>
                            {taskItem.priority}
                          </span>
                        )}

                        {taskItem.clientId && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Building size={12} /> {taskItem.clientId.name || 'Client'}
                          </span>
                        )}

                        {taskItem.sourceLink && (
                          <a
                            href={taskItem.sourceLink}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ fontSize: '0.72rem', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}
                          >
                            <ExternalLink size={12} /> Link
                          </a>
                        )}

                        {taskItem.localFileAttachments?.length > 0 && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            📎 {taskItem.localFileAttachments.length} {lang === 'bn' ? 'ফাইল' : 'files'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Edit Task Button */}
                    <button
                      type="button"
                      onClick={() => onEditTask && onEditTask(taskItem)}
                      className="btn-ghost"
                      style={{ padding: 6, borderRadius: 6, color: 'var(--text-muted)', flexShrink: 0 }}
                      title="Edit task details, upload files, links"
                    >
                      <Edit3 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
