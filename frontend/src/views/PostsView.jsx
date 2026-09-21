import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Send, 
  Trash2, 
  ExternalLink, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Plus
} from 'lucide-react';
import { getPosts, deletePost, publishPost } from '../api';
import Pagination, { usePagination } from '../components/Pagination';

export default function PostsView({ setActiveTab }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const {
    currentPage,
    pageSize,
    totalItems,
    paginatedItems,
    setCurrentPage,
    setPageSize
  } = usePagination(posts, 10);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const res = await getPosts();
      setPosts(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (id) => {
    if (!confirm('Bạn có chắc muốn bắt đầu đăng bài viết này?')) return;
    try {
      await publishPost(id);
      alert('Đã đưa bài viết vào hàng đợi đăng bài!');
      setActiveTab('queue');
    } catch (err) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa bài viết này?')) return;
    try {
      await deletePost(id);
      setPosts(posts.filter(p => p.id !== id));
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">HOÀN THÀNH</span>;
      case 'PROCESSING':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">ĐANG ĐĂNG</span>;
      case 'QUEUED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">ĐÃ LÊN QUEUE</span>;
      case 'PARTIALLY_FAILED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">LỖI 1 PHẦN</span>;
      case 'FAILED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">THẤT BẠI</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">BẢN NHÁP</span>;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Danh sách bài viết & Lịch sử</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý nội dung bài viết, mục tiêu đăng và trạng thái xuất bản.</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadPosts}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition"
            title="Tải lại"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setActiveTab('create-post')}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow transition"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo bài viết mới</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center text-slate-500 shadow-2xs">
            {loading ? 'Đang tải danh sách bài viết...' : 'Chưa có bài viết nào. Hãy bấm "Tạo bài viết mới" để bắt đầu.'}
          </div>
        ) : (
          <>
            {paginatedItems.map(post => (
              <div key={post.id} className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-bold text-slate-900">{post.title}</h3>
                      {getStatusBadge(post.status)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Tạo lúc: {new Date(post.created_at).toLocaleString('vi-VN')} • {post.targets?.length || 0} mục tiêu
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePublish(post.id)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Đăng ngay (Queue)</span>
                    </button>
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="p-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-lg transition border border-slate-200"
                      title="Xóa bài viết"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Content preview */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap max-h-36 overflow-y-auto">
                  {post.content}
                </div>

                {/* Targets Breakdown */}
                {post.targets && post.targets.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Tiến độ theo từng mục tiêu:</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {post.targets.map(t => (
                        <div key={t.id} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs flex items-center justify-between">
                          <div className="min-w-0 pr-2">
                            <div className="font-semibold text-slate-800 truncate">{t.target_url}</div>
                            <div className="text-[10px] text-slate-500 capitalize">{t.target_type}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            t.status === 'FAILED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                            t.status === 'ACTION_REQUIRED' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-slate-200 text-slate-600'
                          }`}>
                            {t.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <Pagination
                totalItems={totalItems}
                currentPage={currentPage}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                darkMode={false}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

