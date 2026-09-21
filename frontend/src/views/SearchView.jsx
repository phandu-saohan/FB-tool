import React, { useState } from 'react';
import { 
  Search, 
  Users, 
  Flag, 
  Loader2, 
  ExternalLink, 
  CheckSquare, 
  Square, 
  PlusCircle, 
  AlertCircle 
} from 'lucide-react';
import { searchGroups, searchPages, bulkSelectGroups, bulkSelectPages } from '../api';

export default function SearchView({ setActiveTab }) {
  const [searchType, setSearchType] = useState('groups'); // groups | pages
  const [keyword, setKeyword] = useState('');
  const [maxResults, setMaxResults] = useState(50);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [statusMessage, setStatusMessage] = useState('');

  const sampleKeywords = [
    'phẫu thuật thẩm mỹ',
    'bác sĩ thẩm mỹ',
    'thẩm mỹ Việt Nam',
    'spa Việt Nam',
    'chăm sóc da',
    'filler botox',
    'bệnh viện thẩm mỹ'
  ];

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!keyword.trim()) {
      alert('Vui lòng nhập từ khóa tìm kiếm.');
      return;
    }

    setLoading(true);
    setStatusMessage('Searching Facebook...');
    setResults([]);
    setSelectedItems(new Set());

    try {
      if (searchType === 'groups') {
        const res = await searchGroups(keyword.trim(), Number(maxResults));
        setResults(res.data.results || []);
        setStatusMessage(`Đã tìm thấy ${res.data.results?.length || 0} nhóm phù hợp.`);
      } else {
        const res = await searchPages(keyword.trim(), Number(maxResults));
        setResults(res.data.results || []);
        setStatusMessage(`Đã tìm thấy ${res.data.results?.length || 0} trang phù hợp.`);
      }
    } catch (err) {
      console.error(err);
      setStatusMessage('Tìm kiếm thất bại: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (url) => {
    const next = new Set(selectedItems);
    if (next.has(url)) next.delete(url);
    else next.add(url);
    setSelectedItems(next);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === results.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(results.map(r => r.url)));
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Tìm kiếm Facebook Groups & Pages</h2>
          <p className="text-slate-400 text-sm mt-1">Tìm kiếm mục tiêu tự động bằng browser-use & Playwright.</p>
        </div>
        
        {/* Toggle Type */}
        <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => { setSearchType('groups'); setResults([]); }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              searchType === 'groups' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Facebook Groups</span>
          </button>
          <button
            onClick={() => { setSearchType('pages'); setResults([]); }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              searchType === 'pages' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flag className="w-4 h-4" />
            <span>Facebook Pages</span>
          </button>
        </div>
      </div>

      {/* Search Input Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-8">
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Từ khóa (Keyword)</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="VD: phẫu thuật thẩm mỹ, spa Việt Nam, chăm sóc da..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              disabled={loading}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Số lượng tối đa</label>
            <input
              type="number"
              min="5"
              max="200"
              value={maxResults}
              onChange={(e) => setMaxResults(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              disabled={loading}
            />
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[42px] inline-flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-600/20 transition"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang tìm...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Search Facebook</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Suggested keywords tag pills */}
        <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-slate-800/80">
          <span className="text-xs text-slate-400">Từ khóa gợi ý:</span>
          {sampleKeywords.map((kw, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setKeyword(kw)}
              className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
            >
              {kw}
            </button>
          ))}
        </div>
      </div>

      {/* Progress / Status banner */}
      {loading && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center space-x-3 text-blue-300">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="font-medium">Searching Facebook... Tự động mở tìm kiếm và bóc tách dữ liệu theo thời gian thực.</span>
        </div>
      )}

      {statusMessage && !loading && (
        <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
          <span>{statusMessage}</span>
          <button 
            onClick={() => setActiveTab(searchType === 'groups' ? 'groups' : 'pages')}
            className="text-blue-400 hover:underline font-medium ml-2"
          >
            Xem toàn bộ trong Database &rarr;
          </button>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleSelectAll}
                className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition"
              >
                {selectedItems.size === results.length ? (
                  <>
                    <CheckSquare className="w-4 h-4 text-blue-400" />
                    <span>Bỏ chọn tất cả</span>
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4" />
                    <span>Select All ({results.length})</span>
                  </>
                )}
              </button>
              <span className="text-xs text-slate-400">
                Đã chọn: <b className="text-white">{selectedItems.size}</b> {searchType === 'groups' ? 'nhóm' : 'trang'}
              </span>
            </div>

            <button
              onClick={() => setActiveTab(searchType === 'groups' ? 'groups' : 'pages')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium shadow transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Đi đến danh sách lưu trữ</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={selectedItems.size === results.length && results.length > 0}
                      onChange={handleSelectAll}
                      className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
                    />
                  </th>
                  <th className="p-4">{searchType === 'groups' ? 'Group Name' : 'Page Name'}</th>
                  <th className="p-4">{searchType === 'groups' ? 'Members' : 'Followers'}</th>
                  {searchType === 'groups' && <th className="p-4">Privacy</th>}
                  <th className="p-4">Keyword</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">URL / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {results.map((item, idx) => {
                  const isSelected = selectedItems.has(item.url);
                  return (
                    <tr key={idx} className="hover:bg-slate-800/40 transition">
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.url)}
                          className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
                        />
                      </td>
                      <td className="p-4 font-medium text-white max-w-xs truncate" title={item.name}>
                        {item.name}
                      </td>
                      <td className="p-4 text-slate-400">
                        {searchType === 'groups' ? (item.members || 'N/A') : (item.followers || 'N/A')}
                      </td>
                      {searchType === 'groups' && (
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            item.privacy === 'Public' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-300'
                          }`}>
                            {item.privacy || 'Public'}
                          </span>
                        </td>
                      )}
                      <td className="p-4 text-xs text-blue-400">{item.keyword}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {item.status || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 hover:underline"
                        >
                          <span>Mở FB</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
