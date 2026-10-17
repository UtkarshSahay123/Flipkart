import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRoadGuard } from '../../context/RoadGuardContext';
import { X, Send, Bot, Trash2, Sparkles, AlertCircle } from 'lucide-react';

export const ChittiAssistant = () => {
  const { issues, issuesLoaded, activeIssues, employees, tasks, resolvedIssuesList, auditLogs, notifications } = useRoadGuard();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: "Namaste! I am Chitti, your Road Guard Municipal Assistant. How can I assist you with traffic hazard analysis, employee assignments, or unresolved issues today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef(null);
  const seenIssueIds = useRef(null);
  const unattendedIssues = useMemo(() => activeIssues.filter(issue => {
    if (!issue.reportedAt) return false;
    const age = Date.now() - new Date(issue.reportedAt).getTime();
    return Number.isFinite(age) && age > 48 * 60 * 60 * 1000 && ['Unassigned', 'Reported', 'Pending'].includes(issue.status || 'Unassigned');
  }), [activeIssues]);

  useEffect(() => {
    if (!issuesLoaded) return;
    const currentIds = new Set(issues.map(issue => String(issue.id)));
    if (seenIssueIds.current === null) { seenIssueIds.current = currentIds; return; }
    const newlyReported = issues.filter(issue => !seenIssueIds.current.has(String(issue.id)));
    seenIssueIds.current = currentIds;
    if (!newlyReported.length) return;
    setMessages(prev => [...prev, {
      id: `new-issues-${Date.now()}`, sender: 'bot', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: `New report activity detected: ${newlyReported.map(issue => `${issue.category || issue.title} (${issue.id})`).join(', ')}. I’ve added it to my live issue context.`
    }]);
  }, [issues, issuesLoaded]);

  useEffect(() => {
    if (!unattendedIssues.length) return;
    const key = `chitti.overdue.alert.${unattendedIssues.map(issue => issue.id).sort().join(',')}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    setMessages(prev => [...prev, {
      id: key, sender: 'bot', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: `Proactive alert: ${unattendedIssues.length} issue(s) have been unattended for over 2 days: ${unattendedIssues.map(issue => `${issue.id} (${issue.category || issue.title})`).join(', ')}. Please review the admin notifications.`
    }]);
  }, [unattendedIssues]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen, isTyping]);

  const suggestedPrompts = [
    "Show me all high-priority pending issues",
    "Which issues have been unattended for more than two days?",
    "Which employees have overdue tasks?",
    "Show recent system activity",
    "Show unresolved issues by area",
    "Which issues were resolved this week?"
  ];

  // Live-data fallback for when the configured AI model is unavailable.
  const generateResponse = (query) => {
    const q = query.toLowerCase();

    if (q.includes('activity') || q.includes('audit') || q.includes('status change') || q.includes('task assignment') || q.includes('employee action')) {
      const events = [...auditLogs]
        .sort((a, b) => new Date(b.timestamp || b.changedAt || 0) - new Date(a.timestamp || a.changedAt || 0))
        .slice(0, 10);
      return events.length
        ? `Recent recorded system activity:\n\n${events.map(event => `• ${event.eventType || event.status || 'Activity'} — ${event.description || `${event.actor || 'User'} updated ${event.taskTitle || event.targetEntity || 'a record'}`} (${event.timestamp || event.changedAt || 'time unavailable'})`).join('\n')}`
        : 'No system activity events are recorded yet.';
    }

    if (q.includes('high') && (q.includes('issue') || q.includes('pending') || q.includes('priority') || q.includes('hazard'))) {
      const high = activeIssues.filter(issue => issue.priority === 'High' || issue.priority === 'Critical' || Number(issue.reportCount || 0) > 5);
      return high.length
        ? `High-priority pending issues (${high.length}):\n\n${high.map(issue => `• [${issue.id}] ${issue.category}: ${issue.title} — ${issue.status}, ${issue.reportCount || 1} report(s), ${issue.locationName}`).join('\n')}`
        : 'There are no high-priority pending issues right now.';
    }

    if (q.includes('assignment') || q.includes('assigned to') || q.includes('employee task')) {
      const assigned = tasks.filter(task => task.status !== 'Resolved');
      return assigned.length
        ? `Open employee assignments (${assigned.length}):\n\n${assigned.map(task => `• [${task.id}] ${task.title} — ${task.assignedEmployeeName || task.employeeName || 'Unassigned'} (${task.status})${task.issueId || task.linkedIssueId ? `, issue ${task.issueId || task.linkedIssueId}` : ''}`).join('\n')}`
        : 'There are no open employee task assignments.';
    }

    if (q.includes("critical") || q.includes("critical pending")) {
      const criticals = activeIssues.filter(i => i.priority === "Critical");
      if (criticals.length === 0) {
        return "Good news! There are currently no critical unresolved issues in the system.";
      }
      const listStr = criticals.map(c => `• [${c.id}] ${c.category}: ${c.title} (${c.locationName}) - Priority Score: ${c.priorityScore}`).join("\n");
      return `Found ${criticals.length} Critical unresolved issue(s):\n\n${listStr}\n\nWould you like me to take you to Issue Management?`;
    }

    if (q.includes("unattended") || q.includes("two days") || q.includes("2 days")) {
      if (!unattendedIssues.length) return "There are no active unassigned issues older than 2 days.";
      return `Unattended for more than 2 days (${unattendedIssues.length}):\n\n${unattendedIssues.map(issue => `• [${issue.id}] ${issue.category}: ${issue.title} (Reported: ${issue.reportedAt})`).join('\n')}`;

      const unattended = activeIssues.filter(i => i.status === "Unassigned");
      if (unattended.length === 0) {
        return "All reported issues have been assigned to field personnel!";
      }
      const listStr = unattended.map(u => `• [${u.id}] ${u.category}: ${u.title} (Reported: ${u.reportedDate})`).join("\n");
      return `Currently ${unattended.length} issue(s) remain Unassigned:\n\n${listStr}`;
    }

    if (q.includes("overdue") || q.includes("employees have overdue")) {
      const today = new Date().toISOString().split('T')[0];
      const overdueTasks = tasks.filter(t => t.status !== "Resolved" && t.dueDate < today);
      if (overdueTasks.length === 0) {
        return "All active tasks are currently within their scheduled completion windows.";
      }
      const listStr = overdueTasks.map(t => `• Task [${t.id}] '${t.title}' assigned to ${t.assignedEmployeeName} (Due: ${t.dueDate})`).join("\n");
      return `Found ${overdueTasks.length} overdue task(s):\n\n${listStr}`;
    }

    if (q.includes("summarise") || q.includes("common hazards") || q.includes("summary")) {
      const catCounts = {};
      issues.forEach(i => {
        catCounts[i.category] = (catCounts[i.category] || 0) + 1;
      });
      const sorted = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
      const summaryStr = sorted.map(([cat, count]) => `• ${cat}: ${count} reports`).join("\n");
      return `Hazard Category Distribution Summary from current data:\n\n${summaryStr || 'No reports are available.'}`;
    }

    if (q.includes("area") || q.includes("unresolved issues by area")) {
      const areaList = activeIssues.map(i => `• ${i.locationName}: ${i.category} [${i.priority}]`).join("\n");
      return `Unresolved Hazards across Amaravati Municipal Zones:\n\n${areaList}`;
    }

    if (q.includes("resolved") || q.includes("this week")) {
      if (resolvedIssuesList.length === 0) {
        return "No issues marked as resolved in the current timeframe.";
      }
      const resStr = resolvedIssuesList.map(r => `• [${r.id}] ${r.title} - Resolved by ${r.assignedEmployeeName || 'Team'} on ${r.resolutionDate || 'recent date'}`).join("\n");
      return `Recently Resolved Issues (${resolvedIssuesList.length} total):\n\n${resStr}`;
    }

    // Default Fallback Response
    return `Current organization snapshot:\n• Active issues: ${activeIssues.length}\n• Resolved issues: ${resolvedIssuesList.length}\n• Active employees: ${employees.filter(e => e.status === 'Active').length}\n• Open tasks: ${tasks.filter(task => task.status !== 'Resolved').length}\n• Unread alerts: ${notifications.filter(notification => !notification.read).length}\n\nAsk about high-priority pending issues, overdue work, employee assignments, or recent system activity.`;
  };

  const handleSendMessage = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    const asksNearby = /\b(near me|nearby|near my|around me|near here|close to me)\b/i.test(query);
    const userCoords = asksNearby && navigator.geolocation
      ? await new Promise(resolve => navigator.geolocation.getCurrentPosition(
          position => resolve([position.coords.latitude, position.coords.longitude]),
          () => resolve(null), { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }))
      : null;

    const operationalContext = {
      issues: issues.map(issue => ({
        id: issue.id, title: issue.title, category: issue.category, status: issue.status,
        priority: issue.priority, priorityScore: issue.priorityScore, reportCount: issue.reportCount,
        location: issue.locationName, reportedAt: issue.reportedAt,
        assignedEmployeeName: issue.assignedEmployeeName, resolutionDate: issue.resolutionDate
      })),
      tasks: tasks.slice(0, 200).map(task => ({ id: task.id, title: task.title, issueId: task.issueId || task.linkedIssueId,
        employeeName: task.assignedEmployeeName || task.employeeName, status: task.status, priority: task.priority, dueDate: task.dueDate })),
      employees: employees.map(employee => ({ id: employee.id, name: employee.name, designation: employee.designation, status: employee.status })),
      auditEvents: auditLogs.slice(0, 100),
      notifications: notifications.slice(0, 100),
      proactiveAlerts: unattendedIssues.map(issue => ({ issueId: issue.id, title: issue.title, reportedAt: issue.reportedAt }))
    };
    const conversation = messages.slice(-10).map(message => ({ role: message.sender === 'user' ? 'user' : 'assistant', text: message.text }));
    let replyText;
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query, location: 'Admin dashboard', user_coords: userCoords, context: operationalContext, history: conversation })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Chitti AI is not available.');
      replyText = result.reply;
    } catch {
      replyText = generateResponse(query);
    }
    {
      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Red Assistant Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 p-4 rounded-full bg-red-600 text-white shadow-xl hover:bg-red-700 transition-all transform hover:scale-105 flex items-center gap-2.5 border-2 border-white focus:outline-none"
        title="Open Chitti AI Assistant"
      >
        <div className="relative">
          <Bot className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-red-600 animate-pulse"></span>
          {unattendedIssues.length > 0 && <span className="absolute -top-3 -left-3 min-w-5 rounded-full bg-amber-300 px-1 text-center text-[10px] font-extrabold text-red-900">{unattendedIssues.length}</span>}
        </div>
        <span className="font-bold text-sm tracking-wide hidden sm:inline">CHITTI AI</span>
      </button>

      {/* Chat Drawer Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[92vw] sm:w-96 h-[550px] bg-white border border-[#D9E1EF] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
          {/* Assistant Header */}
          <div className="p-4 bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base tracking-tight">Chitti Assistant</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/20 text-white">
                    Live Data
                  </span>
                </div>
                <p className="text-xs text-red-100 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Municipal Operations Helper
                </p>
              </div>
            </div>

              {unattendedIssues.length > 0 && <span className="mr-auto ml-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold"><AlertCircle className="h-3 w-3" />{unattendedIssues.length} unattended</span>}
              <div className="flex items-center gap-1">
              <button
                onClick={() => setMessages([messages[0]])}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Clear conversation"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto bg-[#F7F9FD] space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-[#0755C9] text-white rounded-br-none shadow-sm'
                      : 'bg-white text-[#0A2342] rounded-bl-none border border-[#D9E1EF] shadow-xs'
                  }`}
                >
                  <p className="whitespace-pre-line">{String(m.text).split(/(https:\/\/www\.openstreetmap\.org\/[^\s]+)/g).map((part, index) => part.startsWith('https://www.openstreetmap.org/')
                    ? <a key={index} href={part} target="_blank" rel="noreferrer" className={m.sender === 'user' ? 'underline text-white' : 'underline text-blue-700'}>Open issue on map</a>
                    : part)}</p>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">{m.timestamp}</span>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 p-3 bg-white border border-[#D9E1EF] rounded-2xl rounded-bl-none w-24">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-red-600 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 rounded-full bg-red-600 animate-bounce [animation-delay:0.4s]"></span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Prompts Pills */}
          <div className="p-2.5 bg-white border-t border-slate-100 overflow-x-auto whitespace-nowrap scrollbar-none flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-red-600 shrink-0" />
            {suggestedPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt)}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-red-50 hover:text-red-700 text-[11px] font-medium text-[#52627A] border border-slate-200 transition-colors shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="p-3 bg-white border-t border-[#D9E1EF] flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask Chitti about hazards or staff..."
              className="flex-1 px-3 py-2 text-xs bg-[#F7F9FD] border border-[#D9E1EF] rounded-xl focus:outline-none focus:border-[#0755C9] text-[#0A2342]"
            />
            <button
              onClick={() => handleSendMessage()}
              className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
