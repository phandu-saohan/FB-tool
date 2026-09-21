import React, { useState, useEffect } from 'react';
import {
  MessageSquareText,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Plus,
  Sliders,
  BarChart3,
  Calendar,
  Layers,
  FileText,
  Check,
  Edit3,
  Trash2,
  ExternalLink,
  Sparkles,
  Info,
  Radio,
  Tag
} from 'lucide-react';
import {
  getCommentDashboard,
  getMonitoringRules,
  createMonitoringRule,
  deleteMonitoringRule,
  triggerPostDiscovery,
  getDiscoveredPosts,
  getCommentSuggestions,
  approveSuggestion,
  rejectSuggestion,
  editSuggestion,
  bulkActionSuggestions,
  scheduleComment,
  getScheduledComments,
  publishCommentNow,
  emergencyStopComments,
  getCommentCampaigns,
  createCommentCampaign,
  getCommentAnalytics,
  getCommentLogs,
  getCommentSettings,
  updateCommentSettings
} from '../api';
import Pagination, { usePagination } from '../components/Pagination';

export default function CommentsView() {
  const [activeTab, setActiveTab] = useState('approval'); // approval, discovery, schedule, campaigns, analytics, settings
  const [loading, setLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState('');

  // Dashboard Metrics
  const [stats, setStats] = useState({
    posts_found: 0,
    relevant_posts: 0,
    comments_pending: 0,
    approved: 0,
    scheduled: 0,
    published: 0,
    failed: 0,
    automation_enabled: true,
    daily_limit: 30,
    daily_used: 0
  });

  // Approval Queue State
  const [suggestions, setSuggestions] = useState([]);
  const [filterType, setFilterType] = useState('pending');
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [schedulingItem, setSchedulingItem] = useState(null);
  const [scheduleTime, setScheduleTime] = useState('');

  // Discovery State
  const [rules, setRules] = useState([]);
  const [discoveredPosts, setDiscoveredPosts] = useState([]);
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [discoveryConference, setDiscoveryConference] = useState('Hội Nghị Khoa Học Thẩm Mỹ Quốc Tế 2026');
  const [discoveryUrl, setDiscoveryUrl] = useState('https://aesthetichub.vn/hoi-nghi-2026');
  const [newRule, setNewRule] = useState({
    name: '',
    keywords: '',
    excluded_keywords: '',
    topics: '',
    locations: '',
    target_groups: ''
  });
  const [showNewRuleModal, setShowNewRuleModal] = useState(false);

  // Schedules State
  const [schedules, setSchedules] = useState([]);

  // Campaigns State
  const [campaigns, setCampaigns] = useState([]);
  const [showNewCampModal, setShowNewCampModal] = useState(false);
  const [newCamp, setNewCamp] = useState({
    name: '',
    conference_name: 'Hội Nghị Khoa Học Thẩm Mỹ Quốc Tế 2026',
    registration_url: 'https://aesthetichub.vn/hoi-nghi-2026',
    monitoring_topics: 'RF, Exosome, Trẻ hóa da, Spa, Clinic',
    target_groups: 'Cộng đồng Thẩm mỹ viện Việt Nam',
    comment_guidelines: 'Thông tin học thuật chuẩn CME',
    daily_limit: 20
  });

  // Analytics State
  const [analytics, setAnalytics] = useState(null);

  // Settings & Logs State
  const [settings, setSettings] = useState(null);
  const [logs, setLogs] = useState([]);

  // Pagination Hooks
  const paginatedSuggestions = usePagination(suggestions, 8);
  const paginatedDiscovered = usePagination(discoveredPosts, 8);
  const paginatedSchedules = usePagination(schedules, 10);
  const paginatedCampaigns = usePagination(campaigns, 8);
  const paginatedLogs = usePagination(logs, 15);

  // Load dashboard stats
  const loadStats = async () => {
    try {
      const res = await getCommentDashboard();
      setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Load Approval Queue
  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const res = await getCommentSuggestions(filterType);
      setSuggestions(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Load Discovery Data
  const loadDiscoveryData = async () => {
    try {
      const [rRes, pRes] = await Promise.all([
        getMonitoringRules(),
        getDiscoveredPosts()
      ]);
      setRules(rRes.data);
      setDiscoveredPosts(pRes.data);
      if (rRes.data.length > 0 && !selectedRuleId) {
        setSelectedRuleId(rRes.data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Load Schedules
  const loadSchedules = async () => {
    try {
      const res = await getScheduledComments();
      setSchedules(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Load Campaigns
  const loadCampaigns = async () => {
    try {
      const res = await getCommentCampaigns();
      setCampaigns(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Load Analytics
  const loadAnalytics = async () => {
    try {
      const res = await getCommentAnalytics();
      setAnalytics(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Load Settings & Logs
  const loadSettingsAndLogs = async () => {
    try {
      const [sRes, lRes] = await Promise.all([
        getCommentSettings(),
        getCommentLogs(50)
      ]);
      setSettings(sRes.data);
      setLogs(lRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadStats();
    if (activeTab === 'approval') loadSuggestions();
    else if (activeTab === 'discovery') loadDiscoveryData();
    else if (activeTab === 'schedule') loadSchedules();
    else if (activeTab === 'campaigns') loadCampaigns();
    else if (activeTab === 'analytics') loadAnalytics();
    else if (activeTab === 'settings') loadSettingsAndLogs();
  }, [activeTab, filterType]);

  // Handle Emergency Stop
  const handleEmergencyStop = async () => {
    if (!confirm('CẢNH BÁO NGUY HIỂM: Bạn có chắc chắn muốn DỪNG KHẨN CẤP toàn bộ hệ thống tự động hóa bình luận? Mọi lịch bình luận đang chờ sẽ bị hủy ngay lập tức.')) {
      return;
    }
    try {
      const res = await emergencyStopComments();
      alert(res.data.message);
      await loadStats();
      if (activeTab === 'approval') await loadSuggestions();
      if (activeTab === 'schedule') await loadSchedules();
      if (activeTab === 'settings') await loadSettingsAndLogs();
    } catch (err) {
      alert('Lỗi dừng khẩn cấp: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Trigger Discovery
  const handleTriggerDiscovery = async () => {
    setLoading(true);
    setStatusNotice('Đang kết nối Mock Provider để quét bài viết và phân tích Relevance Score...');
    try {
      const res = await triggerPostDiscovery({
        rule_id: selectedRuleId || undefined,
        conference_name: discoveryConference,
        registration_url: discoveryUrl,
        limit: 10
      });
      alert(res.data.message);
      setStatusNotice('');
      await loadStats();
      await loadDiscoveryData();
      await loadSuggestions();
    } catch (err) {
      alert('Lỗi khám phá bài viết: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Approval actions
  const handleApprove = async (id, commentText) => {
    try {
      await approveSuggestion(id, { comment_text: commentText });
      await loadStats();
      await loadSuggestions();
    } catch (err) {
      alert('Lỗi duyệt: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Nhập lý do từ chối (tùy chọn):', 'Nội dung chưa phù hợp tiêu chuẩn');
    if (reason === null) return;
    try {
      await rejectSuggestion(id, { reason });
      await loadStats();
      await loadSuggestions();
    } catch (err) {
      alert('Lỗi từ chối: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    try {
      await editSuggestion(editingItem.id, {
        selected_comment: editingItem.selected_comment,
        disclosure_mode: editingItem.disclosure_mode,
        tags: editingItem.tags
      });
      setEditingItem(null);
      await loadSuggestions();
    } catch (err) {
      alert('Lỗi lưu: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleScheduleSubmit = async () => {
    if (!schedulingItem || !scheduleTime) {
      alert('Vui lòng chọn thời gian lên lịch');
      return;
    }
    try {
      await scheduleComment({
        suggestion_id: schedulingItem.id,
        scheduled_at: new Date(scheduleTime).toISOString(),
        comment_text: schedulingItem.selected_comment
      });
      alert('Đã lên lịch bình luận thành công!');
      setSchedulingItem(null);
      setScheduleTime('');
      await loadStats();
      await loadSuggestions();
    } catch (err) {
      alert('Lỗi lên lịch: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handlePublishNow = async (scheduleId) => {
    if (!confirm('Xuất bản bình luận này ngay qua Provider?')) return;
    try {
      const res = await publishCommentNow(scheduleId);
      alert('Đã xuất bản: ' + res.data.result.message);
      await loadStats();
      await loadSchedules();
    } catch (err) {
      alert('Lỗi xuất bản: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedIds.length === 0) {
      alert('Vui lòng chọn ít nhất một đề xuất.');
      return;
    }
    try {
      const res = await bulkActionSuggestions({
        suggestion_ids: selectedIds,
        action: action
      });
      alert(res.data.message);
      setSelectedIds([]);
      await loadStats();
      await loadSuggestions();
    } catch (err) {
      alert('Lỗi thao tác hàng loạt: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    try {
      await createMonitoringRule(newRule);
      setShowNewRuleModal(false);
      setNewRule({ name: '', keywords: '', excluded_keywords: '', topics: '', locations: '', target_groups: '' });
      await loadDiscoveryData();
    } catch (err) {
      alert('Lỗi tạo quy tắc: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    try {
      await createCommentCampaign(newCamp);
      setShowNewCampModal(false);
      await loadCampaigns();
    } catch (err) {
      alert('Lỗi tạo chiến dịch: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleToggleAutomation = async (enabled) => {
    try {
      await updateCommentSettings({ automation_enabled: enabled });
      await loadStats();
      await loadSettingsAndLogs();
    } catch (err) {
      alert('Lỗi cập nhật: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <MessageSquareText className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-white">Comment Assistant — Trợ lý bình luận</h1>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                stats.automation_enabled 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                {stats.automation_enabled ? '● TỰ ĐỘNG HÓA BẬT' : '○ TỰ ĐỘNG HÓA TẮT'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Truyền thông hội nghị thẩm mỹ chuẩn y khoa • Phân tích AI • Bắt buộc người dùng duyệt trước khi đăng (Human Review)
            </p>
          </div>
        </div>

        {/* Emergency Stop Button */}
        <div className="flex items-center space-x-3">
          <button
            onClick={loadStats}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
            title="Tải lại thống kê"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleEmergencyStop}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-rose-600/30 border border-rose-500 active:scale-95"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Dừng khẩn cấp tự động hóa</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium">Bài phát hiện</div>
          <div className="text-2xl font-bold text-white mt-1">{stats.posts_found}</div>
          <div className="text-[11px] text-blue-400 mt-1">Posts Found</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium">Bài phù hợp</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.relevant_posts}</div>
          <div className="text-[11px] text-emerald-500 mt-1">Relevant Posts</div>
        </div>
        <div className="bg-slate-900 border border-purple-900/40 p-4 rounded-xl bg-purple-950/10">
          <div className="text-xs text-purple-300 font-medium">Chờ duyệt</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">{stats.comments_pending}</div>
          <div className="text-[11px] text-purple-300 mt-1">Pending Review</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium">Đã duyệt</div>
          <div className="text-2xl font-bold text-blue-400 mt-1">{stats.approved}</div>
          <div className="text-[11px] text-slate-500 mt-1">Approved</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium">Đã lên lịch</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{stats.scheduled}</div>
          <div className="text-[11px] text-amber-500 mt-1">Scheduled</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium">Đã xuất bản</div>
          <div className="text-2xl font-bold text-teal-400 mt-1">{stats.published}</div>
          <div className="text-[11px] text-teal-500 mt-1">Published</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium">Hạn ngạch ngày</div>
          <div className="text-2xl font-bold text-slate-200 mt-1">{stats.daily_used}/{stats.daily_limit}</div>
          <div className="text-[11px] text-slate-400 mt-1">Daily Limit</div>
        </div>
      </div>

      {statusNotice && (
        <div className="bg-purple-950/40 border border-purple-500/40 text-purple-300 px-4 py-3 rounded-xl text-xs flex items-center space-x-2 animate-pulse">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-800 space-x-2 overflow-x-auto pb-1">
        {[
          { id: 'approval', label: 'Hàng đợi phê duyệt (Approval Queue)', icon: CheckCircle2, badge: stats.comments_pending },
          { id: 'discovery', label: 'Khám phá & Giám sát', icon: Search },
          { id: 'schedule', label: 'Lịch đăng & Cooldown', icon: Calendar, badge: stats.scheduled },
          { id: 'campaigns', label: 'Chiến dịch', icon: Layers },
          { id: 'analytics', label: 'Phân tích & Thống kê', icon: BarChart3 },
          { id: 'settings', label: 'Cài đặt & Nhật ký', icon: Sliders }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-3 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                isActive
                  ? 'border-purple-500 text-purple-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1.5 px-2 py-0.5 text-[10px] rounded-full bg-purple-600/30 text-purple-300 border border-purple-500/40 font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: APPROVAL QUEUE */}
      {activeTab === 'approval' && (
        <div className="space-y-4">
          {/* Filters & Bulk Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'pending', label: 'Chờ duyệt' },
                { id: 'high_relevance', label: 'Điểm phù hợp cao (>=80)' },
                { id: 'approved', label: 'Đã duyệt' },
                { id: 'scheduled', label: 'Đã lên lịch' },
                { id: 'published', label: 'Đã đăng' },
                { id: 'rejected', label: 'Đã từ chối' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    filterType === f.id
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Bulk Operations */}
            <div className="flex items-center space-x-2">
              <button
                disabled={selectedIds.length === 0}
                onClick={() => handleBulkAction('approve')}
                className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Duyệt đã chọn ({selectedIds.length})
              </button>
              <button
                disabled={selectedIds.length === 0}
                onClick={() => handleBulkAction('reject')}
                className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-xs font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Từ chối ({selectedIds.length})
              </button>
            </div>
          </div>

          {/* Suggestions List */}
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-xs">Đang tải danh sách đề xuất bình luận...</div>
          ) : suggestions.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
              <MessageSquareText className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm">Không có bình luận nào trong bộ lọc này.</p>
              <button
                onClick={() => setActiveTab('discovery')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl"
              >
                Khám phá bài viết mới
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedSuggestions.paginatedItems.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                const scoreColor = item.relevance_score >= 80 
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                  : item.relevance_score >= 70
                    ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                    : 'text-rose-400 bg-rose-500/10 border-rose-500/30';

                return (
                  <div
                    key={item.id}
                    className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all shadow-lg ${
                      isSelected ? 'border-purple-500/60 ring-1 ring-purple-500/40' : 'border-slate-800'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="bg-slate-950/60 p-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds([...selectedIds, item.id]);
                            else setSelectedIds(selectedIds.filter(id => id !== item.id));
                          }}
                          className="rounded border-slate-700 text-purple-600 focus:ring-purple-500 bg-slate-800 w-4 h-4"
                        />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-200">
                              {item.post?.group_name || 'Cộng đồng Thẩm mỹ'}
                            </span>
                            <span className="text-xs text-slate-500">•</span>
                            <span className="text-xs text-slate-400">{item.post?.author_name || 'Tác giả'}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            ID: {item.post?.external_post_id} • Hội nghị: <span className="text-purple-300 font-medium">{item.conference_name}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${scoreColor}`}>
                          Điểm phù hợp: {item.relevance_score}/100
                        </span>

                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                          item.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          item.status === 'REJECTED' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                          item.status === 'SCHEDULED' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                          item.status === 'PUBLISHED' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' :
                          'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                    </div>

                    {/* Content Body */}
                    <div className="p-5 space-y-4">
                      {/* Original Post Excerpt */}
                      <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/60 text-xs text-slate-300">
                        <span className="text-slate-500 font-semibold uppercase text-[10px] block mb-1">Nội dung bài viết thảo luận:</span>
                        <p className="line-clamp-3 leading-relaxed italic">"{item.post?.post_text}"</p>
                      </div>

                      {/* Reason & Angle */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                          <span className="text-slate-400 font-semibold block mb-0.5">Lý do phù hợp:</span>
                          <p className="text-slate-200">{item.relevance_reason}</p>
                        </div>
                        <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                          <span className="text-slate-400 font-semibold block mb-0.5">Góc độ tiếp cận (Angle):</span>
                          <p className="text-purple-300 font-medium capitalize">{item.angle}</p>
                        </div>
                      </div>

                      {/* AI Generated Suggestion Options */}
                      <div>
                        <span className="text-xs font-semibold text-slate-300 block mb-2">Đề xuất bình luận (Chọn phương án tốt nhất):</span>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {['casual', 'expert', 'curious'].map((optKey) => {
                            const optText = item[`suggestion_${optKey}`];
                            if (!optText) return null;
                            const isChosen = item.selected_comment === optText;

                            return (
                              <div
                                key={optKey}
                                onClick={() => {
                                  setSuggestions(suggestions.map(s => s.id === item.id ? { ...s, selected_comment: optText } : s));
                                }}
                                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                                  isChosen 
                                    ? 'bg-purple-950/40 border-purple-500/80 text-purple-200 ring-1 ring-purple-500/50' 
                                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between font-bold uppercase text-[10px] mb-1 text-slate-400">
                                  <span>{optKey === 'casual' ? 'Thân thiện' : optKey === 'expert' ? 'Chuyên gia' : 'Hỏi đáp'}</span>
                                  {isChosen && <Check className="w-3.5 h-3.5 text-purple-400" />}
                                </div>
                                <p className="line-clamp-4 leading-relaxed">{optText}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Action Toolbar */}
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
                        <button
                          onClick={() => setEditingItem({ ...item })}
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl flex items-center space-x-1.5 border border-slate-700"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Chỉnh sửa</span>
                        </button>

                        <button
                          onClick={() => handleReject(item.id)}
                          className="px-3 py-2 bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 text-xs font-semibold rounded-xl flex items-center space-x-1.5 border border-rose-800/40"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Từ chối (Reject)</span>
                        </button>

                        <button
                          onClick={() => setSchedulingItem(item)}
                          className="px-3 py-2 bg-amber-950/30 hover:bg-amber-900/40 text-amber-300 text-xs font-semibold rounded-xl flex items-center space-x-1.5 border border-amber-800/40"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Lên lịch (Schedule)</span>
                        </button>

                        <button
                          onClick={() => handleApprove(item.id, item.selected_comment)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-md shadow-emerald-600/20"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Duyệt bình luận (Approve)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
                <Pagination
                  totalItems={paginatedSuggestions.totalItems}
                  currentPage={paginatedSuggestions.currentPage}
                  pageSize={paginatedSuggestions.pageSize}
                  onPageChange={paginatedSuggestions.setCurrentPage}
                  onPageSizeChange={paginatedSuggestions.setPageSize}
                  darkMode={true}
                />
              </div>
            </div>
          )}

        </div>
      )}

      {/* TAB 2: DISCOVERY & MONITORING */}
      {activeTab === 'discovery' && (
        <div className="space-y-6">
          {/* Discovery Trigger Control */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Khám phá bài viết cộng đồng (Post Discovery)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sử dụng MockPostDiscoveryProvider (chế độ demo an toàn, không scraping).
                </p>
              </div>
              <button
                onClick={() => setShowNewRuleModal(true)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-purple-400 text-xs font-semibold rounded-xl flex items-center space-x-1.5 border border-slate-700"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm quy tắc giám sát</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Quy tắc giám sát áp dụng</label>
                <select
                  value={selectedRuleId}
                  onChange={(e) => setSelectedRuleId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  {rules.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Tên hội nghị truyền thông</label>
                <input
                  type="text"
                  value={discoveryConference}
                  onChange={(e) => setDiscoveryConference(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Đường dẫn đăng ký / Thông tin</label>
                <input
                  type="text"
                  value={discoveryUrl}
                  onChange={(e) => setDiscoveryUrl(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                disabled={loading}
                onClick={handleTriggerDiscovery}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl flex items-center space-x-2 shadow-lg shadow-purple-600/30"
              >
                <Search className="w-4 h-4" />
                <span>{loading ? 'Đang phân tích...' : 'Bắt đầu quét & phân tích AI'}</span>
              </button>
            </div>
          </div>

          {/* Discovered Posts List */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Danh sách bài viết đã phát hiện ({discoveredPosts.length})
              </h4>
            </div>

            <div className="divide-y divide-slate-800">
              {paginatedDiscovered.totalItems === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">Chưa có bài viết nào được quét. Bấm "Bắt đầu quét & phân tích AI" ở trên.</div>
              ) : (
                paginatedDiscovered.paginatedItems.map(p => (
                  <div key={p.id} className="p-4 hover:bg-slate-800/30 transition-colors space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white">{p.group_name || 'Nhóm'}</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-400">{p.author_name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                          p.status === 'RELEVANT' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {p.status} ({p.relevance_score}/100)
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-2 italic">"{p.post_text}"</p>
                    <p className="text-[11px] text-slate-500">Lý do: {p.relevance_reason}</p>
                  </div>
                ))
              )}
            </div>

            <Pagination
              totalItems={paginatedDiscovered.totalItems}
              currentPage={paginatedDiscovered.currentPage}
              pageSize={paginatedDiscovered.pageSize}
              onPageChange={paginatedDiscovered.setCurrentPage}
              onPageSizeChange={paginatedDiscovered.setPageSize}
              darkMode={true}
            />
          </div>
        </div>
      )}


      {/* TAB 3: SCHEDULER & COOLDOWN */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
              <div className="text-xs text-slate-400 font-semibold uppercase">Quy tắc Cooldown Nhóm</div>
              <div className="text-2xl font-bold text-amber-400">24 Giờ</div>
              <p className="text-xs text-slate-400">
                Không gửi 2 bình luận liên tiếp vào cùng một nhóm trong vòng 24 giờ để chống spam.
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
              <div className="text-xs text-slate-400 font-semibold uppercase">Giới hạn theo giờ</div>
              <div className="text-2xl font-bold text-blue-400">Tối đa 5 bài/giờ</div>
              <p className="text-xs text-slate-400">
                Tự động hoãn sang giờ tiếp theo nếu chạm ngưỡng giới hạn an toàn.
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
              <div className="text-xs text-slate-400 font-semibold uppercase">Chống trùng lặp nội dung</div>
              <div className="text-2xl font-bold text-emerald-400">Similarity &gt; 80%</div>
              <p className="text-xs text-slate-400">
                Chặn bình luận giống hoặc gần giống với bình luận đã đăng trước đó.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Lịch bình luận ({schedules.length})
              </h4>
            </div>

            <div className="divide-y divide-slate-800">
              {paginatedSchedules.totalItems === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">Chưa có bình luận nào được lên lịch.</div>
              ) : (
                paginatedSchedules.paginatedItems.map(s => (
                  <div key={s.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="font-bold text-white">Lịch: {new Date(s.scheduled_at).toLocaleString('vi-VN')}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          s.status === 'PUBLISHED' ? 'bg-emerald-500/20 text-emerald-300' :
                          s.status === 'SCHEDULED' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {s.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 italic">"{s.comment_text}"</p>
                    </div>

                    {s.status === 'SCHEDULED' && (
                      <button
                        onClick={() => handlePublishNow(s.id)}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg flex items-center space-x-1.5 whitespace-nowrap self-start md:self-auto"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Đăng ngay (Demo)</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <Pagination
              totalItems={paginatedSchedules.totalItems}
              currentPage={paginatedSchedules.currentPage}
              pageSize={paginatedSchedules.pageSize}
              onPageChange={paginatedSchedules.setCurrentPage}
              onPageSizeChange={paginatedSchedules.setPageSize}
              darkMode={true}
            />
          </div>
        </div>
      )}

      {/* TAB 4: CAMPAIGNS */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-white">Chiến dịch truyền thông hội nghị (Outreach Campaigns)</h3>
            <button
              onClick={() => setShowNewCampModal(true)}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo chiến dịch mới</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedCampaigns.paginatedItems.map(c => (
              <div key={c.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white">{c.name}</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    {c.status}
                  </span>
                </div>
                <p className="text-xs text-purple-300 font-medium">Hội nghị: {c.conference_name}</p>
                <div className="text-xs text-slate-400 space-y-1">
                  <div>Chủ đề: <span className="text-slate-200">{c.monitoring_topics}</span></div>
                  <div>Mục tiêu: <span className="text-slate-200">{c.target_groups}</span></div>
                  <div>Hạn mức ngày: <span className="text-slate-200">{c.daily_limit} bình luận/ngày</span></div>
                  <div>Chế độ duyệt: <span className="text-amber-300 font-semibold">{c.approval_mode}</span></div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
            <Pagination
              totalItems={paginatedCampaigns.totalItems}
              currentPage={paginatedCampaigns.currentPage}
              pageSize={paginatedCampaigns.pageSize}
              onPageChange={paginatedCampaigns.setCurrentPage}
              onPageSizeChange={paginatedCampaigns.setPageSize}
              darkMode={true}
            />
          </div>
        </div>
      )}


      {/* TAB 5: ANALYTICS */}
      {activeTab === 'analytics' && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div className="text-xs text-slate-400">Phản hồi nhận được (ước tính)</div>
              <div className="text-2xl font-bold text-purple-400 mt-1">{analytics.metrics.replies_received}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div className="text-xs text-slate-400">Lượt click link hội nghị</div>
              <div className="text-2xl font-bold text-blue-400 mt-1">{analytics.metrics.clicks}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div className="text-xs text-slate-400">Chuyển đổi đăng ký (CME)</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">{analytics.metrics.conversions}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div className="text-xs text-slate-400">Tỷ lệ duyệt thành công</div>
              <div className="text-2xl font-bold text-teal-400 mt-1">94.2%</div>
            </div>
          </div>

          {/* Simple HTML/CSS Chart Representations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Bình luận xuất bản 7 ngày qua</h4>
              <div className="flex items-end space-x-3 h-40 pt-4">
                {analytics.charts.comments_by_day.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <div
                      style={{ height: `${Math.max((d.count / 10) * 100, 10)}%` }}
                      className="w-full bg-purple-600 rounded-t-lg transition-all"
                    />
                    <span className="text-[10px] text-slate-400">{d.date}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Phân bổ theo nhóm cộng đồng</h4>
              <div className="space-y-3">
                {analytics.charts.comments_by_group.map((g, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>{g.group}</span>
                      <span className="font-bold text-purple-400">{g.count}</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-purple-500 h-full rounded-full" style={{ width: `${Math.min(g.count * 20, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: SETTINGS & LOGS */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {settings && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-5">
              <h3 className="text-sm font-bold text-white">Cấu hình Trợ lý bình luận (Admin Settings)</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <div>
                    <div className="text-xs font-semibold text-white">Tự động hóa toàn cục</div>
                    <div className="text-[11px] text-slate-400">Cho phép hệ thống xử lý đề xuất và lên lịch</div>
                  </div>
                  <button
                    onClick={() => handleToggleAutomation(!settings.automation_enabled)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      settings.automation_enabled ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {settings.automation_enabled ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                  </button>
                </div>

                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-1">
                  <div className="text-xs font-semibold text-white">Ngưỡng điểm phù hợp (Relevance Threshold)</div>
                  <div className="text-[11px] text-slate-400">Mặc định: {settings.default_relevance_threshold}/100</div>
                </div>

                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-1">
                  <div className="text-xs font-semibold text-white">Giới hạn ngày: {settings.daily_limit} bình luận</div>
                  <div className="text-[11px] text-slate-400">Giới hạn giờ: {settings.hourly_limit} bình luận</div>
                </div>

                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-1">
                  <div className="text-xs font-semibold text-white">Giãn cách nhóm (Group Cooldown)</div>
                  <div className="text-[11px] text-slate-400">{settings.group_cooldown_hours} giờ / nhóm</div>
                </div>
              </div>
            </div>
          )}

          {/* Audit Logs Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Nhật ký kiểm toán (Audit Logs)
              </h4>
            </div>

            <div className="divide-y divide-slate-800">
              {paginatedLogs.totalItems === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">Chưa có nhật ký hoạt động.</div>
              ) : (
                paginatedLogs.paginatedItems.map(l => (
                  <div key={l.id} className="p-3 text-xs flex items-center justify-between hover:bg-slate-800/40">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        l.action === 'EMERGENCY_STOP' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                        l.action === 'COMMENT_PUBLISHED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-purple-500/20 text-purple-300'
                      }`}>
                        {l.action}
                      </span>
                      <span className="text-slate-300">{l.message}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 whitespace-nowrap ml-4">
                      {new Date(l.created_at).toLocaleTimeString('vi-VN')}
                    </span>
                  </div>
                ))
              )}
            </div>

            <Pagination
              totalItems={paginatedLogs.totalItems}
              currentPage={paginatedLogs.currentPage}
              pageSize={paginatedLogs.pageSize}
              onPageChange={paginatedLogs.setCurrentPage}
              onPageSizeChange={paginatedLogs.setPageSize}
              darkMode={true}
            />
          </div>
        </div>
      )}


      {/* MODAL: Edit Comment */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">Chỉnh sửa nội dung bình luận</h3>
            <textarea
              rows={5}
              value={editingItem.selected_comment}
              onChange={(e) => setEditingItem({ ...editingItem, selected_comment: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white"
            />
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-400 flex items-center space-x-2">
                <span>Nhãn minh bạch (Disclosure):</span>
                <select
                  value={editingItem.disclosure_mode}
                  onChange={(e) => setEditingItem({ ...editingItem, disclosure_mode: e.target.value })}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                >
                  <option value="OFF">Tắt</option>
                  <option value="OPTIONAL">Tùy chọn</option>
                  <option value="REQUIRED">Bắt buộc</option>
                </select>
              </label>
              <div className="flex space-x-2">
                <button
                  onClick={() => setEditingItem(null)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Schedule Comment */}
      {schedulingItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">Lên lịch đăng bình luận</h3>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Thời gian đăng (Timezone: Asia/Ho_Chi_Minh)</label>
              <input
                type="datetime-local"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setSchedulingItem(null)}
                className="px-3 py-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs"
              >
                Hủy
              </button>
              <button
                onClick={handleScheduleSubmit}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs"
              >
                Xác nhận lên lịch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: New Monitoring Rule */}
      {showNewRuleModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">Tạo quy tắc giám sát bài viết mới</h3>
            <form onSubmit={handleCreateRule} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Tên quy tắc</label>
                <input
                  required
                  type="text"
                  placeholder="Ví dụ: Theo dõi công nghệ RF & Exosome"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Từ khóa cần tìm (phân cách bằng dấu phẩy)</label>
                <input
                  required
                  type="text"
                  placeholder="RF, Exosome, trẻ hóa da, hội thảo, spa, clinic"
                  value={newRule.keywords}
                  onChange={(e) => setNewRule({ ...newRule, keywords: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Từ khóa loại trừ (Excluded Keywords)</label>
                <input
                  type="text"
                  placeholder="bán xe, nhà đất, bóc phốt, lừa đảo"
                  value={newRule.excluded_keywords}
                  onChange={(e) => setNewRule({ ...newRule, excluded_keywords: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Nhóm mục tiêu</label>
                <input
                  type="text"
                  placeholder="Hội Bác Sĩ Da Liễu, Cộng Đồng Chủ Spa"
                  value={newRule.target_groups}
                  onChange={(e) => setNewRule({ ...newRule, target_groups: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewRuleModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs"
                >
                  Tạo quy tắc
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: New Campaign */}
      {showNewCampModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">Tạo chiến dịch truyền thông mới</h3>
            <form onSubmit={handleCreateCampaign} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Tên chiến dịch</label>
                <input
                  required
                  type="text"
                  placeholder="RF & Exosome Conference Outreach"
                  value={newCamp.name}
                  onChange={(e) => setNewCamp({ ...newCamp, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Hội nghị liên quan</label>
                <input
                  required
                  type="text"
                  value={newCamp.conference_name}
                  onChange={(e) => setNewCamp({ ...newCamp, conference_name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Hạn mức comment mỗi ngày</label>
                <input
                  type="number"
                  value={newCamp.daily_limit}
                  onChange={(e) => setNewCamp({ ...newCamp, daily_limit: parseInt(e.target.value) || 20 })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCampModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs"
                >
                  Tạo chiến dịch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
