import { browser } from 'wxt/browser';
import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { DEFAULT_SETTINGS, type TranslationSettings } from '@/lib/types';

function App() {
  const [settings, setSettings] = useState<TranslationSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    browser.runtime
      .sendMessage({ type: 'GET_SETTINGS' })
      .then((value) => setSettings(value as TranslationSettings))
      .catch((error) => setStatus(String(error)));
  }, []);

  const maskedApiKey = useMemo(() => {
    if (!settings.apiKey) return '未填写';
    if (settings.apiKey.length <= 10) return '已填写';
    return `${settings.apiKey.slice(0, 6)}...${settings.apiKey.slice(-4)}`;
  }, [settings.apiKey]);

  async function persist() {
    setSaving(true);
    setStatus('');
    try {
      await browser.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: settings });
      setStatus(`已保存到本地喵 · API Key ${maskedApiKey}`);
    } catch (error) {
      setStatus(`保存失败：${String(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function translateCurrentPage() {
    setTranslating(true);
    setStatus('');
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) throw new Error('找不到当前标签页');
      await browser.tabs.sendMessage(tab.id, { type: 'TOGGLE_TRANSLATE_PAGE' });
      setStatus('已触发页面翻译，再点一次会清空译文喵。');
    } catch (error) {
      setStatus(`翻译失败：${String(error)}`);
    } finally {
      setTranslating(false);
    }
  }

  async function openLogsPage() {
    await browser.runtime.openOptionsPage();
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Myna</p>
          <h1>沉浸式网页翻译</h1>
          <p className="subtitle">先接 OpenRouter，后面再扩更多 AI API。</p>
        </div>
      </header>

      <section className="panel">
        <label>
          <span>API Provider</span>
          <input value="OpenRouter" disabled />
        </label>
        <label>
          <span>API Key</span>
          <input
            type="password"
            value={settings.apiKey}
            placeholder="sk-or-v1-..."
            onChange={(event) => setSettings({ ...settings, apiKey: event.target.value })}
          />
        </label>
        <label>
          <span>Base URL</span>
          <input
            value={settings.baseUrl}
            onChange={(event) => setSettings({ ...settings, baseUrl: event.target.value })}
          />
        </label>
        <label>
          <span>Model</span>
          <input
            value={settings.model}
            onChange={(event) => setSettings({ ...settings, model: event.target.value })}
          />
        </label>
        <div className="row two-col">
          <label>
            <span>源语言</span>
            <input
              value={settings.sourceLanguage}
              onChange={(event) =>
                setSettings({ ...settings, sourceLanguage: event.target.value })
              }
            />
          </label>
          <label>
            <span>目标语言</span>
            <input
              value={settings.targetLanguage}
              onChange={(event) =>
                setSettings({ ...settings, targetLanguage: event.target.value })
              }
            />
          </label>
        </div>
      </section>

      <section className="panel actions">
        <button className="primary" onClick={persist} disabled={saving}>
          {saving ? '保存中...' : '保存配置'}
        </button>
        <button className="secondary" onClick={translateCurrentPage} disabled={translating}>
          {translating ? '翻译中...' : '翻译当前页面'}
        </button>
        <button className="secondary ghost" onClick={() => void openLogsPage()}>
          查看完整日志
        </button>
      </section>

      <section className="panel hints">
        <p>当前 API Key：{maskedApiKey}</p>
        <ul>
          <li>自动翻译会优先命中本页缓存，并对相同内容做请求去重。</li>
          <li>开启后会更主动地预热附近未翻译内容，不只等滚动到眼前。</li>
          <li>悬浮球仍支持拖动吸边，点一下即可开关自动翻译。</li>
        </ul>
      </section>

      {status ? <p className="status">{status}</p> : null}
    </main>
  );
}

export default App;
