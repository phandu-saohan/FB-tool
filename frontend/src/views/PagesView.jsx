import React, { useState, useEffect } from 'react';
import { 
  Flag, 
  ExternalLink, 
  Trash2, 
  CheckSquare, 
  Square, 
  Search, 
  RefreshCw,
  PenSquare,
  Plus,
  Compass,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FileText,
  Sparkles,
  ShieldCheck,
  Globe
} from 'lucide-react';
import { 
  getPages, 
  createPage, 
  batchCreatePages, 
  syncManagedPages, 
  searchPages, 
  updatePage, 
  deletePage, 
  selectAllPages 
} from '../api';
import Pagination, { usePagination } from '../components/Pagination';

export default function PagesView({ setActiveTab }) {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keywordFilter, setKeywordFilter] = useState('');
  const [categoryTab, setCategoryTab] = useState('ALL'); // 'ALL' | 'MANAGED' | 'DISCOVERED'
  
  // Status message / toast
  const [notice, setNotice] = useState({ type: '', text: '' });
  
  // Loading actions
  const [syncingManaged, setSyncingManaged] = useState(false);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState('single'); // 'single' | 'batch'
  const [singleForm, setSingleForm] = useState({ url: '', name: '', category: 'Trang của tôi' });
  const [batchUrls, setBatchUrls] = useState('');
  const [batchCategory, setBatchCategory] = useState('Trang của tôi');
  const [addingLoading, setAddingLoading] = useState(false);

  // Search Modal
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchMaxResults, setSearchMaxResults] = useState(30);
  const [searchingLoading, setSearchingLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  // Filtered pages
  const filteredPages = pages.filter(pg => {
    const matchesKeyword = !keywordFilter.trim() || 
      pg.name?.toLowerCase().includes(keywordFilter.toLowerCase()) || 
      pg.url?.toLowerCase().includes(keywordFilter.toLowerCase()) ||
      pg.keyword?.toLowerCase().includes(keywordFilter.toLowerCase());

    const isManaged = pg.category === 'Trang của tôi' || (pg.keyword || '').toLowerCase().includes('managed');
    const matchesTab = 
      categoryTab === 'ALL' ? true :
      categoryTab === 'MANAGED' ? isManaged :
      !isManaged;

    return matchesKeyword && matchesTab;
  });

  const {
    currentPage,
    pageSize,
    totalItems,
    paginatedItems,
    setCurrentPage,
    setPageSize
  } = usePagination(filteredPages, 15);

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    try {
      setLoading(true);
      const res = await getPages();
      setPages(res.data || []);
    } catch (err) {
      console.error(err);
      showToast('error', 'Không thể tải danh sách trang: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type, text) => {
    setNotice({ type, text });
    setTimeout(() => {
      setNotice({ type: '', text: '' });
    }, 6000);
  };

  const handleSyncManaged = async () => {
    try {
      setSyncingManaged(true);
      showToast('info', 'Đang kết nối Facebook để đồng bộ danh sách Trang bạn quản lý...');
      const res = await syncManagedPages(100);
      showToast('success', res.data.message || 'Đồng bộ trang quản lý thành công!');
      await loadPages();
      setCategoryTab('MANAGED');
    } catch (err) {
      console.error(err);
      showToast('error', 'Lỗi đồng bộ trang quản lý: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSyncingManaged(false);
    }
  };

  const handleToggleSelect = async (page) => {
    try {
      const nextVal = !page.selected;
      await updatePage(page.id, { selected: nextVal });
      setPages(pages.map(p => p.id === page.id ? { ...p, selected: nextVal } : p));
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }
  };

  const handleSelectAll = async (selected) => {
    try {
      await selectAllPages(selected);
      setPages(pages.map(p => ({ ...p, selected })));
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa trang này khỏi danh sách?')) return;
    try {
      await deletePage(id);
      setPages(pages.filter(p => p.id !== id));
      showToast('success', 'Đã xóa trang khỏi hệ thống.');
    } catch (err) {
      alert('Lỗi xóa: ' + err.message);
    }
  };

  const handleAddSingle = async (e) => {
    e.preventDefault();
    if (!singleForm.url.trim()) {
      alert('Vui lòng nhập đường link URL của Trang.');
      return;
    }
    setAddingLoading(true);
    try {
      await createPage({
        url: singleForm.url.trim(),
        name: singleForm.name.trim() || undefined,
        category: singleForm.category || 'Trang của tôi',
        selected: true
      });
      showToast('success', 'Đã thêm trang mới thành công!');
      setShowAddModal(false);
      setSingleForm({ url: '', name: '', category: 'Trang của tôi' });
      await loadPages();
    } catch (err) {
      alert('Lỗi thêm trang: ' + (err.response?.data?.detail || err.message));
    } finally {
      setAddingLoading(false);
    }
  };

  const handleAddBatch = async (e) => {
    e.preventDefault();
    const urls = batchUrls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0);

    if (urls.length === 0) {
      alert('Vui lòng nhập ít nhất một URL.');
      return;
    }

    setAddingLoading(true);
    try {
      const res = await batchCreatePages({
        urls,
        category: batchCategory || 'Trang của tôi',
        keyword: 'Nạp thủ công'
      });
      showToast('success', res.data.message || `Đã nạp ${urls.length} trang vào hệ thống.`);
      setShowAddModal(false);
      setBatchUrls('');
      await loadPages();
    } catch (err) {
      alert('Lỗi nạp danh sách: ' + (err.response?.data?.detail || err.message));
    } finally {
      setAddingLoading(false);
    }
  };

  const handleSearchPagesSubmit = async (e) => {
    e.preventDefault();
    if (!searchKeyword.trim()) {
      alert('Vui lòng nhập từ khóa tìm kiếm.');
      return;
    }

    setSearchingLoading(true);
    setSearchResults([]);
    try {
      const res = await searchPages(searchKeyword.trim(), Number(searchMaxResults));
      const results = res.data.results || [];
      setSearchResults(results);
      showToast('success', `Tìm kiếm hoàn tất! Đã thu thập và lưu ${results.length} trang mới.`);
      await loadPages();
    } catch (err) {
      alert('Lỗi tìm kiếm: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSearchingLoading(false);
    }
  };

  const handlePostDirectly = async (page) => {
    try {
      // Select only this page
      await selectAllPages(false);
      await updatePage(page.id, { selected: true });
      setActiveTab('create-post');
    } catch (err) {
      console.error(err);
      setActiveTab('create-post');
    }
  };

  const selectedCount = pages.filter(p => p.selected).length;
  const managedCount = pages.filter(p => p.category === 'Trang của tôi' || (p.keyword || '').toLowerCase().includes('managed')).length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {notice.text && (
        <div className={`p-4 rounded-xl flex items-center justify-between shadow-sm border transition-all ${
          notice.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
          notice.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' :
          'bg-blue-50 text-blue-800 border-blue-200'
        }`}>
          <div className="flex items-center space-x-2">
            {notice.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> :
             notice.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-600" /> :
             <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />}
            <span className="text-sm font-medium">{notice.text}</span>
          </div>
          <button onClick={() => setNotice({ type: '', text: '' })} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header with Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <Flag className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Quản lý Facebook Pages</h2>
              <p className="text-slate-500 text-sm mt-0.5">
                Quản lý các Fanpage bạn sở hữu để đăng bài tự động và theo dõi trang mục tiêu.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sync Managed Pages */}
          <button
            onClick={handleSyncManaged}
            disabled={syncingManaged}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
            title="Tự động mở Facebook và nạp tất cả Fanpage tài khoản đang quản lý"
          >
            {syncingManaged ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            <span>{syncingManaged ? 'Đang đồng bộ...' : 'Đồng bộ Trang của tôi'}</span>
          </button>

          {/* Add Page Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition"
          >
            <Plus className="w-4 h-4 text-emerald-600" />
            <span>Thêm trang mới</span>
          </button>

          {/* Search Pages Button */}
          <button
            onClick={() => setShowSearchModal(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition"
          >
            <Compass className="w-4 h-4 text-blue-600" />
            <span>Tìm kiếm từ khóa</span>
          </button>

          {/* Post to Selected */}
          <button
            onClick={() => setActiveTab('create-post')}
            disabled={selectedCount === 0}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <PenSquare className="w-4 h-4" />
            <span>Đăng bài ({selectedCount})</span>
          </button>
        </div>
      </div>

      {/* Info Tip Banner */}
      <div className="bg-gradient-to-r from-emerald-50/80 to-blue-50/80 border border-emerald-200/70 rounded-2xl p-4 flex items-start space-x-3 text-xs text-slate-700">
        <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-900">
            Hướng dẫn đăng bài lên Facebook Page (Fanpage):
          </p>
          <p className="text-slate-600 leading-relaxed">
            Khác với Facebook Group, để đăng bài trực tiếp lên tường một Fanpage, tài khoản Facebook của bạn cần là <b>Quản trị viên (Admin)</b> hoặc <b>Biên tập viên (Editor)</b> của Trang đó. Hãy bấm <b>"Đồng bộ Trang của tôi"</b> để hệ thống tự động nhận diện các trang bạn có quyền đăng bài!
          </p>
        </div>
      </div>

      {/* Filter and Tab Controls */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        {/* Category Tabs */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setCategoryTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              categoryTab === 'ALL'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả ({pages.length})
          </button>
          <button
            onClick={() => setCategoryTab('MANAGED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center space-x-1 transition ${
              categoryTab === 'MANAGED'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs'
                : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Trang quản lý ({managedCount})</span>
          </button>
          <button
            onClick={() => setCategoryTab('DISCOVERED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              categoryTab === 'DISCOVERED'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Trang tìm kiếm ({pages.length - managedCount})
          </button>
        </div>

        {/* Search input */}
        <div className="flex items-center space-x-3 flex-1 min-w-[260px] max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Lọc nhanh theo tên hoặc đường link..."
              value={keywordFilter}
              onChange={(e) => setKeywordFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
            {keywordFilter && (
              <button
                onClick={() => setKeywordFilter('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={loadPages}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Selection toggles */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleSelectAll(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 rounded-lg border border-slate-200 shadow-2xs transition"
          >
            <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
            <span>Chọn tất cả</span>
          </button>
          <button
            onClick={() => handleSelectAll(false)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 rounded-lg border border-slate-200 shadow-2xs transition"
          >
            <Square className="w-3.5 h-3.5 text-slate-400" />
            <span>Bỏ chọn</span>
          </button>
          <span className="text-xs text-slate-500 ml-2">
            Đã chọn: <b className="text-slate-900">{selectedCount}</b> / {pages.length}
          </span>
        </div>
      </div>

      {/* Pages Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4 w-12 text-center">Chọn</th>
                <th className="p-4">Tên Facebook Page</th>
                <th className="p-4">Phân loại</th>
                <th className="p-4">Người theo dõi</th>
                <th className="p-4">Từ khóa / Nguồn</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPages.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Flag className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-slate-800 text-base">
                        {loading ? 'Đang tải danh sách trang...' : 'Chưa có Facebook Page nào'}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {loading 
                          ? 'Vui lòng chờ trong giây lát...' 
                          : 'Hãy đồng bộ Fanpage bạn quản lý hoặc thêm trang mới để bắt đầu đăng bài tự động.'}
                      </p>
                      {!loading && (
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                          <button
                            onClick={handleSyncManaged}
                            disabled={syncingManaged}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                          >
                            Đồng bộ Trang quản lý
                          </button>
                          <button
                            onClick={() => setShowAddModal(true)}
                            className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition"
                          >
                            Thêm trang thủ công
                          </button>
                          <button
                            onClick={() => setShowSearchModal(true)}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-xs font-semibold transition"
                          >
                            Tìm kiếm trang mới
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((pg) => {
                  const isManaged = pg.category === 'Trang của tôi' || (pg.keyword || '').toLowerCase().includes('managed');
                  return (
                    <tr key={pg.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={pg.selected}
                          onChange={() => handleToggleSelect(pg)}
                          className="rounded bg-slate-50 border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className="p-4 font-semibold text-slate-900 max-w-sm">
                        <div className="flex items-center space-x-2">
                          <span className="truncate" title={pg.name}>{pg.name}</span>
                          {isManaged && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              Quản lý
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                          {pg.url}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          isManaged 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold' 
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {pg.category || 'Page'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 font-medium">
                        {pg.followers || 'N/A'}
                      </td>
                      <td className="p-4 text-xs text-blue-600 font-medium">
                        {pg.keyword || '—'}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {pg.status}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => handlePostDirectly(pg)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium transition"
                          title="Đăng bài ngay lên trang này"
                        >
                          <PenSquare className="w-3 h-3" />
                          <span>Đăng bài</span>
                        </button>
                        <a
                          href={pg.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 px-2 py-1 text-xs text-slate-600 hover:text-blue-600 font-medium"
                          title="Mở Facebook"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => handleDelete(pg.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition"
                          title="Xóa trang khỏi DB"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <Pagination
          totalItems={totalItems}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          darkMode={false}
        />
      </div>

      {/* MODAL: THÊM TRANG MỚI */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                  <Plus className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900">Thêm Facebook Page vào hệ thống</h3>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAddMode('single')}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  addMode === 'single' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Thêm 1 trang
              </button>
              <button
                type="button"
                onClick={() => setAddMode('batch')}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  addMode === 'batch' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Dán nhiều liên kết (Batch)
              </button>
            </div>

            {addMode === 'single' ? (
              <form onSubmit={handleAddSingle} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Đường link URL Facebook Page <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: https://www.facebook.com/thammyviensaohan"
                    value={singleForm.url}
                    onChange={(e) => setSingleForm({ ...singleForm, url: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Tên hiển thị của Trang (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    placeholder="Hệ thống sẽ tự trích xuất nếu để trống..."
                    value={singleForm.name}
                    onChange={(e) => setSingleForm({ ...singleForm, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Phân loại
                  </label>
                  <select
                    value={singleForm.category}
                    onChange={(e) => setSingleForm({ ...singleForm, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                  >
                    <option value="Trang của tôi">Trang của tôi (Trang bạn quản lý)</option>
                    <option value="Đối thủ / Tham khảo">Đối thủ / Tham khảo</option>
                    <option value="Cộng đồng">Cộng đồng</option>
                    <option value="Page">Khác</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={addingLoading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-xl font-semibold shadow-xs"
                  >
                    {addingLoading ? 'Đang thêm...' : 'Thêm trang'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAddBatch} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Danh sách liên kết (Mỗi dòng một URL) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={6}
                    required
                    placeholder="https://www.facebook.com/thammyviensaohan&#10;https://www.facebook.com/spasaigon&#10;https://www.facebook.com/profile.php?id=100083928192"
                    value={batchUrls}
                    onChange={(e) => setBatchUrls(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Phân loại cho danh sách này
                  </label>
                  <select
                    value={batchCategory}
                    onChange={(e) => setBatchCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                  >
                    <option value="Trang của tôi">Trang của tôi (Trang bạn quản lý)</option>
                    <option value="Đối thủ / Tham khảo">Đối thủ / Tham khảo</option>
                    <option value="Cộng đồng">Cộng đồng</option>
                    <option value="Page">Khác</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={addingLoading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-xl font-semibold shadow-xs"
                  >
                    {addingLoading ? 'Đang nạp...' : 'Xác nhận nạp danh sách'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: TÌM KIẾM TRANG THEO TỪ KHÓA */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                  <Compass className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900">Tìm kiếm Facebook Pages tự động</h3>
              </div>
              <button 
                onClick={() => setShowSearchModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Trình duyệt sẽ tự động tìm kiếm trên Facebook theo từ khóa và lưu các Fanpage tìm thấy vào cơ sở dữ liệu.
            </p>

            <form onSubmit={handleSearchPagesSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Từ khóa tìm kiếm <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: thẩm mỹ viện, spa chăm sóc da, nha khoa uy tín..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Số lượng kết quả tối đa
                </label>
                <select
                  value={searchMaxResults}
                  onChange={(e) => setSearchMaxResults(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                >
                  <option value={15}>15 trang</option>
                  <option value={30}>30 trang</option>
                  <option value={50}>50 trang</option>
                  <option value={100}>100 trang</option>
                </select>
              </div>

              {searchResults.length > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold">
                  Đã tìm thấy và lưu {searchResults.length} trang vào hệ thống!
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowSearchModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={searchingLoading}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl font-semibold shadow-xs"
                >
                  {searchingLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang tìm trên Facebook...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span>Bắt đầu tìm kiếm</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
