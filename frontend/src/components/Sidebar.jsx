import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Flag, 
  Search, 
  PenSquare, 
  ListFilter, 
  PlayCircle, 
  Terminal, 
  Settings,
  ShieldAlert,
  Bot,
  MessageSquareText,
  Mail
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const menuSections = [
    {
      title: 'TỔNG QUAN',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }
      ]
    },
    {
      title: 'CỘNG ĐỒNG & OUTREACH',
      items: [
        { id: 'comments', label: 'Trợ lý bình luận', icon: MessageSquareText },
        { id: 'email', label: 'Email Campaign', icon: Mail }
      ]
    },
    {
      title: 'FACEBOOK',
      items: [
        { id: 'groups', label: 'Nhóm (Groups)', icon: Users },
        { id: 'pages', label: 'Trang (Pages)', icon: Flag },
        { id: 'search', label: 'Tìm kiếm', icon: Search }
      ]
    },
    {
      title: 'NỘI DUNG',
      items: [
        { id: 'create-post', label: 'Soạn bài viết (AI)', icon: PenSquare },
        { id: 'posts', label: 'Danh sách bài', icon: ListFilter }
      ]
    },
    {
      title: 'TỰ ĐỘNG HÓA',
      items: [
        { id: 'queue', label: 'Hàng đợi (Queue)', icon: PlayCircle },
        { id: 'logs', label: 'Nhật ký (Logs)', icon: Terminal }
      ]
    },
    {
      title: 'HỆ THỐNG',
      items: [
        { id: 'settings', label: 'Cài đặt', icon: Settings }
      ]
    }
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-base text-white tracking-wide">FB Automation</h1>
          <p className="text-xs text-blue-400 font-medium">browser-use & Playwright</p>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {menuSections.map((section, idx) => (
          <div key={idx}>
            <div className="px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-2">
              {section.title}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Safety Notice Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-start space-x-2 text-xs text-slate-400">
          <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>Persistent Context & Checkpoint Safe Guard enabled.</span>
        </div>
      </div>
    </aside>
  );
}
