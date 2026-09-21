import React, { useState, useEffect } from 'react';
import { 
  Flag, 
  ExternalLink, 
  Trash2, 
  CheckSquare, 
  Square, 
  Search, 
  RefreshCw,
  PenSquare
} from 'lucide-react';
import { getPages, updatePage, deletePage, selectAllPages } from '../api';
import Pagination, { usePagination } from '../components/Pagination';

export default function PagesView({ setActiveTab }) {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keywordFilter, setKeywordFilter] = useState('');

  const {
    currentPage,
    pageSize,
    totalItems,
    paginatedItems,
    setCurrentPage,
    setPageSize
  } = usePagination(pages, 15);

  useEffect(() => {
    loadPages();
  }, [keywordFilter]);

  const loadPages = async () => {
    try {
      setLoading(true);
      const res = await getPages({
        keyword: keywordFilter || undefined,
      });
      setPages(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
    } catch (err) {
      alert('Lỗi xóa: ' + err.message);
    }
  };

  const selectedCount = pages.filter(p => p.selected).length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quản lý Facebook Pages</h2>
          <p className="text-slate-500 text-sm mt-1">Danh sách các trang đã thu thập từ tìm kiếm.</p>
        </div>

        <button
          onClick={() => setActiveTab('create-post')}
          disabled={selectedCount === 0}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow transition"
        >
          <PenSquare className="w-4 h-4" />
          <span>Đăng bài lên {selectedCount} trang đã chọn</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center space-x-3 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Lọc theo tên trang hoặc từ khóa..."
              value={keywordFilter}
              onChange={(e) => setKeywordFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>

          <button
            onClick={loadPages}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition"
            title="Tải lại"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center space-x-3">
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
            <span>Bỏ chọn tất cả</span>
          </button>
          <span className="text-xs text-slate-500">
            Đã chọn: <b className="text-slate-900">{selectedCount}</b> / {pages.length}
          </span>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4 w-12 text-center">Chọn</th>
                <th className="p-4">Tên trang</th>
                <th className="p-4">Người theo dõi</th>
                <th className="p-4">Danh mục</th>
                <th className="p-4">Từ khóa</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pages.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-500">
                    {loading ? 'Đang tải danh sách trang...' : 'Chưa có trang nào. Hãy vào mục "Tìm kiếm" để tìm các trang mới.'}
                  </td>
                </tr>
              ) : (
                paginatedItems.map((pg) => (
                  <tr key={pg.id} className="hover:bg-slate-50/70 transition">
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={pg.selected}
                        onChange={() => handleToggleSelect(pg)}
                        className="rounded bg-slate-50 border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                    </td>
                    <td className="p-4 font-semibold text-slate-900 max-w-sm truncate" title={pg.name}>
                      {pg.name}
                    </td>
                    <td className="p-4 text-slate-500">{pg.followers || 'N/A'}</td>
                    <td className="p-4 text-slate-500">{pg.category || 'Page'}</td>
                    <td className="p-4 text-xs text-blue-600 font-medium">{pg.keyword || '—'}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {pg.status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-3">
                      <a
                        href={pg.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium"
                      >
                        <span>Mở FB</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        onClick={() => handleDelete(pg.id)}
                        className="text-slate-400 hover:text-rose-600 transition"
                        title="Xóa trang"
                      >
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))
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
    </div>
  );
}

