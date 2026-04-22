import { browser } from 'wxt/browser';
import { useEffect, useMemo, useState } from 'react';
import type { TranslationLogEntry } from '@/lib/types';
import './App.css';

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="json-block">{JSON.stringify(value, null, 2)}</pre>;
}

function App() {
  const [logs, setLogs] = useState<TranslationLogEntry[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');

  async function loadLogs() {
    setLoading(true);
    const data = (await browser.runtime.sendMessage({
      type: 'GET_TRANSLATION_LOGS',
    })) as TranslationLogEntry[];
    setLogs(data);
    setActiveId((current) => current || data[0]?.id || '');
    setLoading(false);
  }

  useEffect(() => {
    void loadLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    if (statusFilter === 'all') return logs;
    return logs.filter((item) => item.status === statusFilter);
  }, [logs, statusFilter]);

  const activeLog = filteredLogs.find((item) => item.id === activeId) ?? filteredLogs[0];

  async function clearLogs() {
    await browser.runtime.sendMessage({ type: 'CLEAR_TRANSLATION_LOGS' });
    await loadLogs();
  }

  return (
    <main className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <p className="eyebrow">Myna</p>
            <h1>请求日志</h1>
          </div>
          <div className="sidebar-actions">
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as 'all' | 'success' | 'error')
              }
            >
              <option value="all">全部</option>
              <option value="success">成功</option>
              <option value="error">失败</option>
            </select>
            <button onClick={() => void loadLogs()}>刷新</button>
            <button className="danger" onClick={() => void clearLogs()}>
              清空
            </button>
          </div>
        </div>

        <div className="log-list">
          {loading ? <p className="empty">加载中…</p> : null}
          {!loading && !filteredLogs.length ? <p className="empty">还没有日志喵。</p> : null}
          {filteredLogs.map((log) => (
            <button
              key={log.id}
              className={`log-row ${activeLog?.id === log.id ? 'active' : ''}`}
              onClick={() => setActiveId(log.id)}
            >
              <div className="row-top">
                <span className={`badge ${log.status}`}>{log.status}</span>
                <span className="time">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
              <p className="title">{log.pageTitle || 'Untitled page'}</p>
              <p className="meta">{log.model}</p>
            </button>
          ))}
        </div>
      </aside>

      <section className="detail">
        {!activeLog ? (
          <div className="empty detail-empty">选一条日志看完整请求喵。</div>
        ) : (
          <>
            <header className="detail-header">
              <div>
                <p className="eyebrow">{activeLog.provider}</p>
                <h2>{activeLog.pageTitle || 'Untitled page'}</h2>
                <a href={activeLog.pageUrl} target="_blank" rel="noreferrer">
                  {activeLog.pageUrl}
                </a>
              </div>
              <div className="summary-grid">
                <div>
                  <span>状态</span>
                  <strong>{activeLog.status}</strong>
                </div>
                <div>
                  <span>模型</span>
                  <strong>{activeLog.model}</strong>
                </div>
                <div>
                  <span>时间</span>
                  <strong>{new Date(activeLog.createdAt).toLocaleString()}</strong>
                </div>
              </div>
            </header>

            <div className="detail-grid">
              <section className="panel">
                <h3>Request</h3>
                <JsonBlock value={activeLog.request} />
              </section>

              <section className="panel">
                <h3>Response</h3>
                {activeLog.response ? <JsonBlock value={activeLog.response} /> : <p className="empty">无响应体</p>}
              </section>
            </div>

            <section className="panel">
              <h3>Error</h3>
              {activeLog.error ? <pre className="error-block">{activeLog.error}</pre> : <p className="empty">无错误</p>}
            </section>
          </>
        )}
      </section>
    </main>
  );
}

export default App;
