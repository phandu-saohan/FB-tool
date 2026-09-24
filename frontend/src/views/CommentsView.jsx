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
  updateCommentSettings,
  createCustomComment,
  generateCustomCommentAI
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

  // Custom Comment State
  const [showCustomCommentModal, setShowCustomCommentModal] = useState(false);
  const [isGeneratingCustomAI, setIsGeneratingCustomAI] = useState(false);
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');
  const [customComment, setCustomComment] = useState({
    post_url: '',
    group_name: '',
    author_name: '',
    post_text: '',
    comment_text: '',
    conference_name: 'Hội Nghị Khoa Học Thẩm Mỹ Quốc Tế 2026',
    registration_url: 'https://aesthetichub.vn/hoi-nghi-2026',
    tone: 'Professional',
    disclosure_mode: 'OPTIONAL',
    disclosure_text: 'Thông tin chương trình do BTC cung cấp.',
    action: 'pending',
    scheduled_at: ''
  });

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

  // Custom Comment AI Generator
  const handleGenerateCustomAI = async () => {
    if (!aiCustomPrompt.trim()) {
      alert('Vui lòng nhập ý tưởng/yêu cầu cho bình luận.');
      return;
    }
    setIsGeneratingCustomAI(true);
    try {
      const res = await generateCustomCommentAI({
        prompt: aiCustomPrompt,
        post_text: customComment.post_text,
        conference_name: customComment.conference_name,
        registration_url: customComment.registration_url,
        tone: customComment.tone
      });
      if (res.data?.comment_text) {
        setCustomComment(prev => ({ ...prev, comment_text: res.data.comment_text }));
      }
    } catch (err) {
      alert('Lỗi tạo bình luận bằng AI: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsGeneratingCustomAI(false);
    }
  };

  // Submit Custom Comment
  const handleSubmitCustomComment = async (e) => {
    e.preventDefault();
    if (!customComment.comment_text.trim()) {
      alert('Vui lòng nhập nội dung bình luận.');
      return;
    }
    if (customComment.action === 'schedule' && !customComment.scheduled_at) {
      alert('Vui lòng chọn thời gian lên lịch đăng.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...customComment,
        scheduled_at: customComment.scheduled_at ? new Date(customComment.scheduled_at).toISOString() : null
      };
      const res = await createCustomComment(payload);
      alert(res.data.message || 'Đã tạo bình luận theo ý muốn thành công!');
      setShowCustomCommentModal(false);
      setCustomComment({
        post_url: '',
        group_name: '',
        author_name: '',
        post_text: '',
        comment_text: '',
        conference_name: 'Hội Nghị Khoa Học Thẩm Mỹ Quốc Tế 2026',
        registration_url: 'https://aesthetichub.vn/hoi-nghi-2026',
        tone: 'Professional',
        disclosure_mode: 'OPTIONAL',
        disclosure_text: 'Thông tin chương trình do BTC cung cấp.',
        action: 'pending',
        scheduled_at: ''
      });
      setAiCustomPrompt('');
      await loadStats();
      if (activeTab === 'approval') await loadSuggestions();
      else if (activeTab === 'schedule') await loadSchedules();
      else if (activeTab === 'discovery') await loadDiscoveryData();
    } catch (err) {
      alert('Lỗi tạo bình luận: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/80 p-6 rounded-2xl shadow-2xs">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
            <MessageSquareText className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-slate-900">Comment Assistant — Trợ lý bình luận</h1>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                stats.automation_enabled 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {stats.automation_enabled ? '● TỰ ĐỘNG HÓA BẬT' : '○ TỰ ĐỘNG HÓA TẮT'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Truyền thông hội nghị thẩm mỹ chuẩn y khoa • Phân tích AI • Bắt buộc người dùng duyệt trước khi đăng (Human Review)
            </p>
          </div>
        </div>

        {/* Action Buttons: Custom Comment, Refresh, Emergency Stop */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowCustomCommentModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-purple-600/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo bình luận theo ý muốn</span>
          </button>

          <button
            onClick={loadStats}
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 transition-colors border border-slate-200 shadow-2xs"
            title="Tải lại thống kê"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleEmergencyStop}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-rose-600/20 active:scale-95"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Dừng khẩn cấp tự động hóa</span>
          </button>
        </div>
      </div>


      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Bài phát hiện</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.posts_found}</div>
          <div className="text-[11px] text-blue-600 mt-1 font-semibold">Posts Found</div>
        </div>
        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Bài phù hợp</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{stats.relevant_posts}</div>
          <div className="text-[11px] text-emerald-600 mt-1 font-semibold">Relevant Posts</div>
        </div>
        <div className="bg-purple-50/40 border border-purple-200 p-4 rounded-xl shadow-2xs">
          <div className="text-xs text-purple-700 font-medium">Chờ duyệt</div>
          <div className="text-2xl font-bold text-purple-700 mt-1">{stats.comments_pending}</div>
          <div className="text-[11px] text-purple-600 mt-1 font-semibold">Pending Review</div>
        </div>
        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Đã duyệt</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{stats.approved}</div>
          <div className="text-[11px] text-slate-500 mt-1 font-semibold">Approved</div>
        </div>
        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Đã lên lịch</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{stats.scheduled}</div>
          <div className="text-[11px] text-amber-600 mt-1 font-semibold">Scheduled</div>
        </div>
        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Đã xuất bản</div>
          <div className="text-2xl font-bold text-teal-600 mt-1">{stats.published}</div>
          <div className="text-[11px] text-teal-600 mt-1 font-semibold">Published</div>
        </div>
        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Hạn ngạch ngày</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.daily_used}/{stats.daily_limit}</div>
          <div className="text-[11px] text-slate-500 mt-1 font-semibold">Daily Limit</div>
        </div>
      </div>

      {statusNotice && (
        <div className="bg-purple-50 border border-purple-200 text-purple-800 px-4 py-3 rounded-xl text-xs flex items-center space-x-2 shadow-2xs">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 space-x-2 overflow-x-auto pb-1">
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
                  ? 'border-purple-600 text-purple-700 bg-white shadow-2xs font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1.5 px-2 py-0.5 text-[10px] rounded-full bg-purple-100 text-purple-700 border border-purple-200 font-bold">
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
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
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
                      ? 'bg-purple-600 text-white shadow-xs font-semibold'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Bulk Operations & Custom Comment */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowCustomCommentModal(true)}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tạo bình luận theo ý muốn</span>
              </button>

              <button
                disabled={selectedIds.length === 0}
                onClick={() => handleBulkAction('approve')}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Duyệt đã chọn ({selectedIds.length})
              </button>
              <button
                disabled={selectedIds.length === 0}
                onClick={() => handleBulkAction('reject')}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Từ chối ({selectedIds.length})
              </button>
            </div>
          </div>


          {/* Suggestions List */}
          {loading ? (
            <div className="text-center py-12 text-slate-500 text-xs">Đang tải danh sách đề xuất bình luận...</div>
          ) : suggestions.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center text-slate-500 space-y-3 shadow-2xs">
              <MessageSquareText className="w-10 h-10 mx-auto text-slate-400" />
              <p className="text-sm">Không có bình luận nào trong bộ lọc này.</p>
              <button
                onClick={() => setActiveTab('discovery')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl shadow transition"
              >
                Khám phá bài viết mới
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedSuggestions.paginatedItems.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                const scoreColor = item.relevance_score >= 80 
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : item.relevance_score >= 70
                    ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : 'text-rose-700 bg-rose-50 border-rose-200';

                return (
                  <div
                    key={item.id}
                    className={`bg-white border rounded-2xl overflow-hidden transition-all shadow-2xs ${
                      isSelected ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-slate-200/80'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="bg-slate-50 p-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds([...selectedIds, item.id]);
                            else setSelectedIds(selectedIds.filter(id => id !== item.id));
                          }}
                          className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 bg-white w-4 h-4 cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-900">
                              {item.post?.group_name || 'Cộng đồng Thẩm mỹ'}
                            </span>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs text-slate-500">{item.post?.author_name || 'Tác giả'}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            ID: {item.post?.external_post_id} • Hội nghị: <span className="text-purple-700 font-semibold">{item.conference_name}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${scoreColor}`}>
                          Điểm phù hợp: {item.relevance_score}/100
                        </span>

                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                          item.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          item.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          item.status === 'SCHEDULED' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          item.status === 'PUBLISHED' ? 'bg-teal-50 text-teal-700 border border-teal-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                    </div>

                    {/* Content Body */}
                    <div className="p-5 space-y-4">
                      {/* Original Post Excerpt */}
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700">
                        <span className="text-slate-500 font-semibold uppercase text-[10px] block mb-1">Nội dung bài viết thảo luận:</span>
                        <p className="line-clamp-3 leading-relaxed italic">"{item.post?.post_text}"</p>
                      </div>

                      {/* Reason & Angle */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <span className="text-slate-500 font-semibold block mb-0.5">Lý do phù hợp:</span>
                          <p className="text-slate-800">{item.relevance_reason}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <span className="text-slate-500 font-semibold block mb-0.5">Góc độ tiếp cận (Angle):</span>
                          <p className="text-purple-700 font-medium capitalize">{item.angle}</p>
                        </div>
                      </div>

                      {/* AI Generated Suggestion Options */}
                      <div>
                        <span className="text-xs font-semibold text-slate-800 block mb-2">Đề xuất bình luận (Chọn phương án tốt nhất):</span>
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
                                    ? 'bg-purple-50/70 border-purple-400 text-purple-900 ring-2 ring-purple-400/30' 
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center justify-between font-bold uppercase text-[10px] mb-1 text-slate-500">
                                  <span>{optKey === 'casual' ? 'Thân thiện' : optKey === 'expert' ? 'Chuyên gia' : 'Hỏi đáp'}</span>
                                  {isChosen && <Check className="w-3.5 h-3.5 text-purple-600" />}
                                </div>
                                <p className="line-clamp-4 leading-relaxed">{optText}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Action Toolbar */}
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => setEditingItem({ ...item })}
                          className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl flex items-center space-x-1.5 border border-slate-200 shadow-2xs transition"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Chỉnh sửa</span>
                        </button>

                        <button
                          onClick={() => handleReject(item.id)}
                          className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl flex items-center space-x-1.5 border border-rose-200 transition"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Từ chối (Reject)</span>
                        </button>

                        <button
                          onClick={() => setSchedulingItem(item)}
                          className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded-xl flex items-center space-x-1.5 border border-amber-200 transition"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Lên lịch (Schedule)</span>
                        </button>

                        <button
                          onClick={() => handleApprove(item.id, item.selected_comment)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Duyệt bình luận (Approve)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <Pagination
                  totalItems={paginatedSuggestions.totalItems}
                  currentPage={paginatedSuggestions.currentPage}
                  pageSize={paginatedSuggestions.pageSize}
                  onPageChange={paginatedSuggestions.setCurrentPage}
                  onPageSizeChange={paginatedSuggestions.setPageSize}
                  darkMode={false}
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
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Khám phá bài viết cộng đồng (Post Discovery)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sử dụng MockPostDiscoveryProvider (chế độ demo an toàn, không scraping).
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowCustomCommentModal(true)}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 shadow transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo bình luận theo ý muốn</span>
                </button>
                <button
                  onClick={() => setShowNewRuleModal(true)}
                  className="px-3 py-2 bg-white hover:bg-slate-50 text-purple-700 text-xs font-semibold rounded-xl flex items-center space-x-1.5 border border-slate-200 shadow-2xs transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm quy tắc giám sát</span>
                </button>
              </div>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">Quy tắc giám sát áp dụng</label>
                <select
                  value={selectedRuleId}
                  onChange={(e) => setSelectedRuleId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white transition"
                >
                  {rules.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">Tên hội nghị truyền thông</label>
                <input
                  type="text"
                  value={discoveryConference}
                  onChange={(e) => setDiscoveryConference(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white transition"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">Đường dẫn đăng ký / Thông tin</label>
                <input
                  type="text"
                  value={discoveryUrl}
                  onChange={(e) => setDiscoveryUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                disabled={loading}
                onClick={handleTriggerDiscovery}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl flex items-center space-x-2 shadow transition"
              >
                <Search className="w-4 h-4" />
                <span>{loading ? 'Đang phân tích...' : 'Bắt đầu quét & phân tích AI'}</span>
              </button>
            </div>
          </div>

          {/* Discovered Posts List */}
          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Danh sách bài viết đã phát hiện ({discoveredPosts.length})
              </h4>
            </div>

            <div className="divide-y divide-slate-100">
              {paginatedDiscovered.totalItems === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">Chưa có bài viết nào được quét. Bấm "Bắt đầu quét & phân tích AI" ở trên.</div>
              ) : (
                paginatedDiscovered.paginatedItems.map(p => (
                  <div key={p.id} className="p-4 hover:bg-slate-50/70 transition-colors space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900">{p.group_name || 'Nhóm'}</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-500">{p.author_name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${
                          p.status === 'RELEVANT' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {p.status} ({p.relevance_score}/100)
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-700 line-clamp-2 italic">"{p.post_text}"</p>
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
              darkMode={false}
            />
          </div>
        </div>
      )}


      {/* TAB 3: SCHEDULER & COOLDOWN */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl space-y-2 shadow-2xs">
              <div className="text-xs text-slate-500 font-semibold uppercase">Quy tắc Cooldown Nhóm</div>
              <div className="text-2xl font-bold text-amber-600">24 Giờ</div>
              <p className="text-xs text-slate-600">
                Không gửi 2 bình luận liên tiếp vào cùng một nhóm trong vòng 24 giờ để chống spam.
              </p>
            </div>
            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl space-y-2 shadow-2xs">
              <div className="text-xs text-slate-500 font-semibold uppercase">Giới hạn theo giờ</div>
              <div className="text-2xl font-bold text-blue-600">Tối đa 5 bài/giờ</div>
              <p className="text-xs text-slate-600">
                Tự động hoãn sang giờ tiếp theo nếu chạm ngưỡng giới hạn an toàn.
              </p>
            </div>
            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl space-y-2 shadow-2xs">
              <div className="text-xs text-slate-500 font-semibold uppercase">Chống trùng lặp nội dung</div>
              <div className="text-2xl font-bold text-emerald-700">Similarity &gt; 80%</div>
              <p className="text-xs text-slate-600">
                Chặn bình luận giống hoặc gần giống với bình luận đã đăng trước đó.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Lịch bình luận ({schedules.length})
              </h4>
            </div>

            <div className="divide-y divide-slate-100">
              {paginatedSchedules.totalItems === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">Chưa có bình luận nào được lên lịch.</div>
              ) : (
                paginatedSchedules.paginatedItems.map(s => (
                  <div key={s.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/70 transition">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="font-bold text-slate-900">Lịch: {new Date(s.scheduled_at).toLocaleString('vi-VN')}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          s.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          s.status === 'SCHEDULED' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {s.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 italic">"{s.comment_text}"</p>
                    </div>

                    {s.status === 'SCHEDULED' && (
                      <button
                        onClick={() => handlePublishNow(s.id)}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 whitespace-nowrap self-start md:self-auto shadow transition"
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
              darkMode={false}
            />
          </div>
        </div>
      )}

      {/* TAB 4: CAMPAIGNS */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900">Chiến dịch truyền thông hội nghị (Outreach Campaigns)</h3>
            <button
              onClick={() => setShowNewCampModal(true)}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 shadow transition"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo chiến dịch mới</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedCampaigns.paginatedItems.map(c => (
              <div key={c.id} className="bg-white border border-slate-200/80 p-5 rounded-2xl space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900">{c.name}</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                    {c.status}
                  </span>
                </div>
                <p className="text-xs text-purple-700 font-semibold">Hội nghị: {c.conference_name}</p>
                <div className="text-xs text-slate-500 space-y-1">
                  <div>Chủ đề: <span className="text-slate-800 font-medium">{c.monitoring_topics}</span></div>
                  <div>Mục tiêu: <span className="text-slate-800 font-medium">{c.target_groups}</span></div>
                  <div>Hạn mức ngày: <span className="text-slate-800 font-medium">{c.daily_limit} bình luận/ngày</span></div>
                  <div>Chế độ duyệt: <span className="text-amber-700 font-semibold">{c.approval_mode}</span></div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <Pagination
              totalItems={paginatedCampaigns.totalItems}
              currentPage={paginatedCampaigns.currentPage}
              pageSize={paginatedCampaigns.pageSize}
              onPageChange={paginatedCampaigns.setCurrentPage}
              onPageSizeChange={paginatedCampaigns.setPageSize}
              darkMode={false}
            />
          </div>
        </div>
      )}


      {/* TAB 5: ANALYTICS */}
      {activeTab === 'analytics' && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
              <div className="text-xs text-slate-500 font-medium">Phản hồi nhận được (ước tính)</div>
              <div className="text-2xl font-bold text-purple-700 mt-1">{analytics.metrics.replies_received}</div>
            </div>
            <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
              <div className="text-xs text-slate-500 font-medium">Lượt click link hội nghị</div>
              <div className="text-2xl font-bold text-blue-600 mt-1">{analytics.metrics.clicks}</div>
            </div>
            <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
              <div className="text-xs text-slate-500 font-medium">Chuyển đổi đăng ký (CME)</div>
              <div className="text-2xl font-bold text-emerald-700 mt-1">{analytics.metrics.conversions}</div>
            </div>
            <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
              <div className="text-xs text-slate-500 font-medium">Tỷ lệ duyệt thành công</div>
              <div className="text-2xl font-bold text-teal-600 mt-1">94.2%</div>
            </div>
          </div>

          {/* Simple HTML/CSS Chart Representations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl space-y-4 shadow-2xs">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Bình luận xuất bản 7 ngày qua</h4>
              <div className="flex items-end space-x-3 h-40 pt-4">
                {analytics.charts.comments_by_day.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <div
                      style={{ height: `${Math.max((d.count / 10) * 100, 10)}%` }}
                      className="w-full bg-purple-600 rounded-t-lg transition-all"
                    />
                    <span className="text-[10px] text-slate-500 font-medium">{d.date}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl space-y-4 shadow-2xs">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Phân bổ theo nhóm cộng đồng</h4>
              <div className="space-y-3">
                {analytics.charts.comments_by_group.map((g, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>{g.group}</span>
                      <span className="font-bold text-purple-700">{g.count}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                      <div className="bg-purple-600 h-full rounded-full" style={{ width: `${Math.min(g.count * 20, 100)}%` }} />
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
            <div className="bg-white border border-slate-200/80 p-6 rounded-2xl space-y-5 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900">Cấu hình Trợ lý bình luận (Admin Settings)</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <div className="text-xs font-semibold text-slate-900">Tự động hóa toàn cục</div>
                    <div className="text-[11px] text-slate-500">Cho phép hệ thống xử lý đề xuất và lên lịch</div>
                  </div>
                  <button
                    onClick={() => handleToggleAutomation(!settings.automation_enabled)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      settings.automation_enabled ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {settings.automation_enabled ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                  </button>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="text-xs font-semibold text-slate-900">Ngưỡng điểm phù hợp (Relevance Threshold)</div>
                  <div className="text-[11px] text-slate-500">Mặc định: {settings.default_relevance_threshold}/100</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="text-xs font-semibold text-slate-900">Giới hạn ngày: {settings.daily_limit} bình luận</div>
                  <div className="text-[11px] text-slate-500">Giới hạn giờ: {settings.hourly_limit} bình luận</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="text-xs font-semibold text-slate-900">Giãn cách nhóm (Group Cooldown)</div>
                  <div className="text-[11px] text-slate-500">{settings.group_cooldown_hours} giờ / nhóm</div>
                </div>
              </div>
            </div>
          )}

          {/* Audit Logs Table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Nhật ký kiểm toán (Audit Logs)
              </h4>
            </div>

            <div className="divide-y divide-slate-100">
              {paginatedLogs.totalItems === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">Chưa có nhật ký hoạt động.</div>
              ) : (
                paginatedLogs.paginatedItems.map(l => (
                  <div key={l.id} className="p-3 text-xs flex items-center justify-between hover:bg-slate-50/70 transition">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        l.action === 'EMERGENCY_STOP' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        l.action === 'COMMENT_PUBLISHED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                      }`}>
                        {l.action}
                      </span>
                      <span className="text-slate-700">{l.message}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap ml-4">
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
              darkMode={false}
            />
          </div>
        </div>
      )}


      {/* MODAL: Edit Comment */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900">Chỉnh sửa nội dung bình luận</h3>
            <textarea
              rows={5}
              value={editingItem.selected_comment}
              onChange={(e) => setEditingItem({ ...editingItem, selected_comment: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white transition"
            />
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-600 flex items-center space-x-2 font-medium">
                <span>Nhãn minh bạch (Disclosure):</span>
                <select
                  value={editingItem.disclosure_mode}
                  onChange={(e) => setEditingItem({ ...editingItem, disclosure_mode: e.target.value })}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white transition"
                >
                  <option value="OFF">Tắt</option>
                  <option value="OPTIONAL">Tùy chọn</option>
                  <option value="REQUIRED">Bắt buộc</option>
                </select>
              </label>
              <div className="flex space-x-2">
                <button
                  onClick={() => setEditingItem(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-medium transition"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow transition"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900">Lên lịch đăng bình luận</h3>
            <div>
              <label className="text-xs text-slate-600 font-medium block mb-1">Thời gian đăng (Timezone: Asia/Ho_Chi_Minh)</label>
              <input
                type="datetime-local"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white transition"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setSchedulingItem(null)}
                className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-medium transition"
              >
                Hủy
              </button>
              <button
                onClick={handleScheduleSubmit}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow transition"
              >
                Xác nhận lên lịch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: New Monitoring Rule */}
      {showNewRuleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900">Tạo quy tắc giám sát bài viết mới</h3>
            <form onSubmit={handleCreateRule} className="space-y-3">
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">Tên quy tắc</label>
                <input
                  required
                  type="text"
                  placeholder="Ví dụ: Theo dõi công nghệ RF & Exosome"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white transition"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">Từ khóa cần tìm (phân cách bằng dấu phẩy)</label>
                <input
                  required
                  type="text"
                  placeholder="RF, Exosome, trẻ hóa da, hội thảo, spa, clinic"
                  value={newRule.keywords}
                  onChange={(e) => setNewRule({ ...newRule, keywords: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white transition"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">Từ khóa loại trừ (Excluded Keywords)</label>
                <input
                  type="text"
                  placeholder="bán xe, nhà đất, bóc phốt, lừa đảo"
                  value={newRule.excluded_keywords}
                  onChange={(e) => setNewRule({ ...newRule, excluded_keywords: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white transition"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">Nhóm mục tiêu</label>
                <input
                  type="text"
                  placeholder="Hội Bác Sĩ Da Liễu, Cộng Đồng Chủ Spa"
                  value={newRule.target_groups}
                  onChange={(e) => setNewRule({ ...newRule, target_groups: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white transition"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewRuleModal(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-medium transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow transition"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900">Tạo chiến dịch truyền thông mới</h3>
            <form onSubmit={handleCreateCampaign} className="space-y-3">
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">Tên chiến dịch</label>
                <input
                  required
                  type="text"
                  placeholder="RF & Exosome Conference Outreach"
                  value={newCamp.name}
                  onChange={(e) => setNewCamp({ ...newCamp, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white transition"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">Hội nghị liên quan</label>
                <input
                  required
                  type="text"
                  value={newCamp.conference_name}
                  onChange={(e) => setNewCamp({ ...newCamp, conference_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white transition"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">Hạn mức comment mỗi ngày</label>
                <input
                  type="number"
                  value={newCamp.daily_limit}
                  onChange={(e) => setNewCamp({ ...newCamp, daily_limit: parseInt(e.target.value) || 20 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white transition"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCampModal(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-medium transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow transition"
                >
                  Tạo chiến dịch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Tạo bình luận theo ý muốn (Custom Comment) */}
      {showCustomCommentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                  <MessageSquareText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Tạo bình luận theo ý muốn</h3>
                  <p className="text-xs text-slate-500">Tự do soạn nội dung hoặc dùng AI viết hộ theo yêu cầu cụ thể</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomCommentModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCustomComment} className="space-y-4">
              {/* Post Target Info */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  1. Thông tin bài viết mục tiêu (Facebook Post)
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 font-medium block mb-1">
                      Link bài viết Facebook (hoặc Post ID)
                    </label>
                    <input
                      type="text"
                      placeholder="https://facebook.com/groups/.../posts/123456"
                      value={customComment.post_url}
                      onChange={(e) => setCustomComment({ ...customComment, post_url: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-600 font-medium block mb-1">
                      Tên nhóm / Tác giả bài viết
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Tên nhóm (tùy chọn)"
                        value={customComment.group_name}
                        onChange={(e) => setCustomComment({ ...customComment, group_name: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 transition"
                      />
                      <input
                        type="text"
                        placeholder="Tác giả (tùy chọn)"
                        value={customComment.author_name}
                        onChange={(e) => setCustomComment({ ...customComment, author_name: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 transition"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-600 font-medium block mb-1">
                    Trích đoạn nội dung bài viết gốc (để tiện theo dõi ngữ cảnh)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ví dụ: Bác sĩ vừa thực hiện ca nâng mũi cấu trúc sụn sườn..."
                    value={customComment.post_text}
                    onChange={(e) => setCustomComment({ ...customComment, post_text: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 transition"
                  />
                </div>
              </div>

              {/* AI Helper Bar */}
              <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Trợ lý AI viết bình luận theo ý tưởng</span>
                  </span>
                  <span className="text-[11px] text-purple-700">Gemini 2.5 / Fallback</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nhập ý tưởng: Khen ngợi kết quả đẹp mắt, mời tham dự Hội nghị 108..."
                    value={aiCustomPrompt}
                    onChange={(e) => setAiCustomPrompt(e.target.value)}
                    className="flex-1 bg-white border border-purple-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 transition"
                  />
                  <button
                    type="button"
                    disabled={isGeneratingCustomAI || !aiCustomPrompt.trim()}
                    onClick={handleGenerateCustomAI}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isGeneratingCustomAI ? 'Đang viết...' : 'AI Viết ngay'}</span>
                  </button>
                </div>
              </div>

              {/* Comment Content Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    2. Nội dung bình luận theo ý muốn *
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {customComment.comment_text.length} ký tự
                  </span>
                </div>
                <textarea
                  required
                  rows={4}
                  placeholder="Nhập chính xác nội dung bình luận bạn muốn đăng (hoặc dùng AI gợi ý ở trên)..."
                  value={customComment.comment_text}
                  onChange={(e) => setCustomComment({ ...customComment, comment_text: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white transition leading-relaxed"
                />
              </div>

              {/* Action Choice: Pending, Approve, Schedule, Publish Now */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  3. Hành động thực thi sau khi tạo
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'pending', label: '📥 Chờ duyệt', desc: 'Lưu vào hàng đợi' },
                    { id: 'approve', label: '✅ Duyệt ngay', desc: 'Sẵn sàng đăng' },
                    { id: 'schedule', label: '⏱️ Lên lịch', desc: 'Hẹn giờ đăng' },
                    { id: 'publish_now', label: '🚀 Đăng ngay', desc: 'Xuất bản tức thì' }
                  ].map((act) => (
                    <div
                      key={act.id}
                      onClick={() => setCustomComment({ ...customComment, action: act.id })}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex flex-col justify-between ${
                        customComment.action === act.id
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100/80'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>{act.label}</span>
                        {customComment.action === act.id && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <span className={`text-[10px] mt-1 ${customComment.action === act.id ? 'text-purple-100' : 'text-slate-400'}`}>
                        {act.desc}
                      </span>
                    </div>
                  ))}
                </div>

                {customComment.action === 'schedule' && (
                  <div className="pt-2 border-t border-slate-200/80 space-y-1">
                    <label className="text-xs text-slate-600 font-medium block">
                      Thời gian đăng dự kiến (Asia/Ho_Chi_Minh) *
                    </label>
                    <input
                      required
                      type="datetime-local"
                      value={customComment.scheduled_at}
                      onChange={(e) => setCustomComment({ ...customComment, scheduled_at: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-purple-500 transition"
                    />
                  </div>
                )}
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCustomCommentModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={loading || !customComment.comment_text.trim()}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{loading ? 'Đang xử lý...' : 'Xác nhận tạo bình luận'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

