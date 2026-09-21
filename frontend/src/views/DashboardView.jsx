import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Flag, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  PlayCircle, 
  Search, 
  PenSquare,
  ShieldCheck
} from 'lucide-react';
import { getGroups, getPages, getPosts, getQueueStatus } from '../api';

export default function DashboardView({ setActiveTab, browserStatus }) {
  const [stats, setStats] = useState({
    totalGroups: 0,
    selectedGroups: 0,
    totalPages: 0,
    selectedPages: 0,
    totalPosts: 0,
    completedPosts: 0,
  });
  const [queueStatus, setQueueStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const [groupsRes, pagesRes, postsRes, queueRes] = await Promise.all([
        getGroups(),
        getPages(),
        getPosts(),
        getQueueStatus()
      ]);

      const groups = groupsRes.data || [];
      const pages = pagesRes.data || [];
      const posts = postsRes.data || [];

      setStats({
        totalGroups: groups.length,
        selectedGroups: groups.filter(g => g.selected).length,
        totalPages: pages.length,
        selectedPages: pages.filter(p => p.selected).length,
        totalPosts: posts.length,
        completedPosts: posts.filter(p => p.status === 'COMPLETED').length,
      });

      setQueueStatus(queueRes.data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-900/50 to-indigo-900/50 border border-blue-700/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-white mb-2">Hệ thống Tự động hóa Facebook Pro</h2>
          <p className="text-slate-300 text-sm max-w-2xl">
            Tự động tìm kiếm hội nhóm/trang Facebook, quản lý phiên đăng nhập bền vững (Persistent Context),
            sáng tạo nội dung với AI Studio và lập lịch đăng bài an toàn tuân thủ rate limits.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => setActiveTab('search')}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium shadow-md transition"
            >
              <Search className="w-4 h-4" />
              <span>Tìm Group / Page mới</span>
            </button>
            <button
              onClick={() => setActiveTab('create-post')}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-sm font-medium border border-slate-700 transition"
            >
              <PenSquare className="w-4 h-4" />
              <span>Soạn bài viết với AI</span>
            </button>
            <button
              onClick={() => setActiveTab('queue')}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-sm font-medium border border-slate-700 transition"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Xem Hàng đợi</span>
            </button>
          </div>
        </div>
      </div>

      {/* Checkpoint Banner if detected */}
      {browserStatus?.checkpoint_detected && (
        <div className="bg-red-500/20 border-2 border-red-500 rounded-2xl p-5 flex items-start space-x-4 animate-pulse">
          <AlertTriangle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-base font-bold text-red-200">Phát hiện Yêu cầu Xác minh (Facebook Checkpoint)!</h3>
            <p className="text-sm text-red-300 mt-1">
              Hệ thống đã tự động dừng các tác vụ tự động hóa để bảo vệ an toàn cho tài khoản.
              Vui lòng bấm <b>"Mở Facebook đăng nhập"</b> ở thanh tiêu đề và hoàn tất xác minh trên cửa sổ trình duyệt.
            </p>
          </div>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Groups */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Tổng số Nhóm</div>
            <div className="text-3xl font-extrabold text-white mt-1">{stats.totalGroups}</div>
            <div className="text-xs text-blue-400 mt-1">Đã chọn: {stats.selectedGroups} nhóm</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Pages */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Tổng số Trang</div>
            <div className="text-3xl font-extrabold text-white mt-1">{stats.totalPages}</div>
            <div className="text-xs text-emerald-400 mt-1">Đã chọn: {stats.selectedPages} trang</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Flag className="w-6 h-6" />
          </div>
        </div>

        {/* Posts */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Bài viết đã tạo</div>
            <div className="text-3xl font-extrabold text-white mt-1">{stats.totalPosts}</div>
            <div className="text-xs text-indigo-400 mt-1">Đã hoàn thành: {stats.completedPosts}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        {/* Queue State */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Trạng thái Hàng đợi</div>
            <div className="text-lg font-bold text-white mt-1">
              {queueStatus?.status === 'RUNNING' ? 'ĐANG CHẠY' : queueStatus?.status === 'PAUSED' ? 'TẠM DỪNG' : 'ĐANG RẢNH'}
            </div>
            <div className="text-xs text-slate-400 mt-1 truncate max-w-[160px]">{queueStatus?.message || 'Chưa có tác vụ'}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <PlayCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Safety & Architecture Pillars */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-4">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h3 className="text-base font-bold text-white">Chính sách Bảo mật & Vận hành Bền vững</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-300">
          <div className="p-4 rounded-lg bg-slate-950/50 border border-slate-800">
            <div className="font-semibold text-blue-400 mb-1">Persistent Browser Profile</div>
            <p className="text-xs text-slate-400">Lưu session Facebook vào thư mục cục bộ. Đăng nhập thủ công lần đầu, các lần sau tự động tái sử dụng phiên.</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-950/50 border border-slate-800">
            <div className="font-semibold text-amber-400 mb-1">Cơ chế Checkpoint Guard</div>
            <p className="text-xs text-slate-400">Tự động phát hiện khi gặp CAPTCHA/xác minh, lập tức dừng lại để người dùng tự xử lý an toàn.</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-950/50 border border-slate-800">
            <div className="font-semibold text-emerald-400 mb-1">Giãn cách & Rate Limiting</div>
            <p className="text-xs text-slate-400">Giãn cách ngẫu nhiên 60-180 giây giữa mỗi bài đăng, giới hạn tối đa 10 bài/phiên nhằm bảo vệ tài khoản.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
