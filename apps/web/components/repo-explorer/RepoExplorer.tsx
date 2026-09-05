import React, { useState, useEffect } from 'react';

export interface RepoExplorerProps {
  initialRepoId?: string;
  apiBaseUrl?: string;
}

export const RepoExplorer: React.FC<RepoExplorerProps> = ({ initialRepoId, apiBaseUrl = 'http://localhost:3001/api/repo-intelligence' }) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'ready' | 'failed'>('idle');
  const [repoData, setRepoData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'symbols' | 'apis' | 'database' | 'tests' | 'git' | 'showcase'>('overview');
  const [activeShowcase, setActiveShowcase] = useState<number | null>(null);
  const [showcaseData, setShowcaseData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentRepoId = repoData?.repository?.id || initialRepoId;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl) return;
    setStatus('analyzing');
    setErrorMessage(null);

    try {
      const resp = await fetch(`${apiBaseUrl}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: repoUrl, branch }),
      });
      const data = await resp.json();

      if (!resp.ok || !data.success) {
        setStatus('failed');
        setErrorMessage(data.error || 'Failed to connect repository.');
        return;
      }

      setStatus('ready');
      setRepoData(data);
      // Fetch full snapshot details
      fetchSnapshot(data.repository.id);
    } catch (err: any) {
      setStatus('failed');
      setErrorMessage(`Connection failed: ${err.message || String(err)}`);
    }
  };

  const fetchSnapshot = async (repoId: string) => {
    try {
      const resp = await fetch(`${apiBaseUrl}/${repoId}`);
      if (resp.ok) {
        const fullSnapshot = await resp.json();
        setRepoData(fullSnapshot);
      }
    } catch {}
  };

  const handleRunShowcase = async (id: number) => {
    if (!currentRepoId) {
      setErrorMessage('Please connect a repository first to run showcase flows.');
      return;
    }

    setActiveShowcase(id);
    setShowcaseData(null);

    try {
      const resp = await fetch(`${apiBaseUrl}/${currentRepoId}/showcase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showcaseId: id }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setShowcaseData(data);
      } else {
        setErrorMessage(data.error || 'Showcase query failed.');
      }
    } catch (err: any) {
      setErrorMessage(`Showcase error: ${err.message}`);
    }
  };

  const snapshot = repoData;
  const metrics = snapshot?.repository?.metadata || {
    fileCount: snapshot?.files?.length || 0,
    symbolCount: snapshot?.symbols?.length || 0,
    relationshipCount: snapshot?.relationships?.length || 0,
    apiCount: snapshot?.apis?.length || 0,
    databaseModelCount: snapshot?.databases?.length || 0,
    testCount: snapshot?.tests?.length || 0,
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#0b0f19', color: '#f3f4f6', minHeight: '100vh' }}>
      {/* Header Banner */}
      <div style={{ marginBottom: '24px', borderRadius: '16px', background: 'linear-gradient(135deg, #1e1b4b 0%, #311b92 50%, #4c1d95 100%)', padding: '28px', border: '1px solid rgba(139, 92, 246, 0.3)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRadius: '9999px', backgroundColor: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(167, 139, 250, 0.3)', color: '#c4b5fd', fontSize: '12px', fontWeight: 600, marginBottom: '12px' }}>
              <span>● AEGIS REPOSITORY INTELLIGENCE ENGINE</span>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0, color: '#ffffff' }}>Repository Intelligence Explorer</h1>
            <p style={{ color: '#cbd5e1', marginTop: '6px', fontSize: '14px', maxWidth: '640px' }}>
              Construct persistent AST symbol graphs, provenanced relationships, API handler flows, database schemas, and change impact evidence.
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ display: 'inline-block', padding: '6px 16px', borderRadius: '8px', backgroundColor: status === 'ready' ? '#065f46' : status === 'analyzing' ? '#854d0e' : status === 'failed' ? '#991b1b' : '#1f2937', color: status === 'ready' ? '#34d399' : status === 'analyzing' ? '#fde047' : status === 'failed' ? '#fca5a5' : '#9ca3af', fontWeight: 600, fontSize: '13px' }}>
              {status === 'ready' ? '● Repository Ready' : status === 'analyzing' ? '⏳ Ingesting & Analyzing...' : status === 'failed' ? '⚠ Connection Failed' : '○ Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div style={{ backgroundColor: '#7f1d1d', color: '#fecaca', padding: '14px 18px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #991b1b', fontSize: '14px' }}>
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Connection Bar */}
      <form onSubmit={handleConnect} style={{ display: 'flex', gap: '12px', marginBottom: '24px', backgroundColor: '#111827', padding: '16px', borderRadius: '12px', border: '1px solid #1f2937' }}>
        <input
          type="text"
          placeholder="Enter GitHub URL or local path (e.g. https://github.com/company/project or d:/code/myrepo)"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          style={{ flex: 1, backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '14px' }}
        />
        <input
          type="text"
          placeholder="Branch (default: main)"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          style={{ width: '160px', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '14px' }}
        />
        <button
          type="submit"
          disabled={status === 'analyzing'}
          style={{ backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontWeight: 600, cursor: status === 'analyzing' ? 'not-allowed' : 'pointer', opacity: status === 'analyzing' ? 0.7 : 1 }}
        >
          {status === 'analyzing' ? 'Analyzing Repository...' : 'Connect Repository'}
        </button>
      </form>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Files Discovered', value: metrics.fileCount || 0, sub: `${metrics.sourceFileCount || 0} source files` },
          { label: 'AST Symbols', value: metrics.symbolCount || 0, sub: 'Classes, Methods, Types' },
          { label: 'Relationships', value: metrics.relationshipCount || 0, sub: 'Line provenance graph' },
          { label: 'API Routes', value: metrics.apiCount || 0, sub: 'Express & Next.js' },
          { label: 'DB Models', value: metrics.databaseModelCount || 0, sub: 'Prisma, ORM & SQL' },
          { label: 'Test Suites', value: metrics.testCount || 0, sub: 'Unit & integration' },
        ].map((m, idx) => (
          <div key={idx} style={{ backgroundColor: '#111827', padding: '16px', borderRadius: '12px', border: '1px solid #1f2937' }}>
            <div style={{ color: '#9ca3af', fontSize: '12px', fontWeight: 500 }}>{m.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#f3f4f6', margin: '4px 0' }}>{m.value}</div>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #1f2937', marginBottom: '24px', paddingBottom: '8px' }}>
        {[
          { id: 'overview', label: 'Overview & Structure' },
          { id: 'symbols', label: 'AST Symbols' },
          { id: 'apis', label: 'API Routes' },
          { id: 'database', label: 'Database Models' },
          { id: 'tests', label: 'Test Coverage' },
          { id: 'git', label: 'Git Timeline' },
          { id: 'showcase', label: '🚀 Showcase Query Flows' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === tab.id ? '#3730a3' : 'transparent',
              color: activeTab === tab.id ? '#ffffff' : '#9ca3af',
              fontWeight: activeTab === tab.id ? 600 : 500,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Showcase Query Tab View */}
      {activeTab === 'showcase' && (
        <div style={{ backgroundColor: '#111827', borderRadius: '12px', padding: '24px', border: '1px solid #1f2937' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Showcase Intelligence Queries</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <button
              onClick={() => handleRunShowcase(1)}
              style={{ padding: '16px', borderRadius: '12px', backgroundColor: activeShowcase === 1 ? '#1e1b4b' : '#1f2937', border: activeShowcase === 1 ? '1px solid #6366f1' : '1px solid #374151', color: '#fff', textAlign: 'left', cursor: 'pointer' }}
            >
              <div style={{ color: '#818cf8', fontWeight: 600, marginBottom: '4px' }}>Query 1 — Tracing</div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>Where is authentication handled?</div>
              <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '6px' }}>Traces Auth routes, controllers, AuthService, and JWT utilities.</p>
            </button>

            <button
              onClick={() => handleRunShowcase(2)}
              style={{ padding: '16px', borderRadius: '12px', backgroundColor: activeShowcase === 2 ? '#1e1b4b' : '#1f2937', border: activeShowcase === 2 ? '1px solid #6366f1' : '1px solid #374151', color: '#fff', textAlign: 'left', cursor: 'pointer' }}
            >
              <div style={{ color: '#34d399', fontWeight: 600, marginBottom: '4px' }}>Query 2 — Execution Flow</div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>What happens when a user creates a project?</div>
              <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '6px' }}>Traces POST /projects endpoint down to ORM models & database.</p>
            </button>

            <button
              onClick={() => handleRunShowcase(3)}
              style={{ padding: '16px', borderRadius: '12px', backgroundColor: activeShowcase === 3 ? '#1e1b4b' : '#1f2937', border: activeShowcase === 3 ? '1px solid #6366f1' : '1px solid #374151', color: '#fff', textAlign: 'left', cursor: 'pointer' }}
            >
              <div style={{ color: '#f472b6', fontWeight: 600, marginBottom: '4px' }}>Query 3 — Impact Analysis</div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>If I change UserService, what could be affected?</div>
              <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '6px' }}>Computes direct dependents, API impact, and affected test suites.</p>
            </button>
          </div>

          {showcaseData && (
            <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#38bdf8', marginTop: 0 }}>{showcaseData.title}</h3>
              <div style={{ backgroundColor: '#1e293b', padding: '14px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '13px', color: '#f1f5f9', marginBottom: '16px' }}>
                {showcaseData.flowDiagram}
              </div>

              {showcaseData.result?.evidence && (
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>Line-Level Evidence Provenance:</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {showcaseData.result.evidence.slice(0, 8).map((item: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#1e1b4b', padding: '10px 14px', borderRadius: '6px', fontSize: '13px' }}>
                        <span style={{ color: '#a5b4fc', fontFamily: 'monospace' }}>{item.filePath} {item.startLine ? `(Line ${item.startLine})` : ''}</span>
                        <span style={{ color: '#cbd5e1' }}>{item.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Overview & Structure View */}
      {activeTab === 'overview' && (
        <div style={{ backgroundColor: '#111827', borderRadius: '12px', padding: '24px', border: '1px solid #1f2937' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>Repository Structure & Intelligence Map</h2>
          {snapshot?.files ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
              {snapshot.files.slice(0, 30).map((file: any) => (
                <div key={file.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#1f2937', borderRadius: '6px', fontSize: '13px' }}>
                  <span style={{ fontFamily: 'monospace', color: '#818cf8' }}>{file.path}</span>
                  <span style={{ color: '#9ca3af' }}>{file.category} ({file.lines} lines)</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#9ca3af', fontSize: '14px' }}>
              Connect a repository using the form above to explore live intelligence metadata.
            </p>
          )}
        </div>
      )}

      {/* AST Symbols View */}
      {activeTab === 'symbols' && (
        <div style={{ backgroundColor: '#111827', borderRadius: '12px', padding: '24px', border: '1px solid #1f2937' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>AST Symbol Table</h2>
          {snapshot?.symbols ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto' }}>
              {snapshot.symbols.slice(0, 40).map((sym: any) => (
                <div key={sym.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#1f2937', borderRadius: '6px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#34d399', fontWeight: 600, marginRight: '8px' }}>[{sym.kind}]</span>
                    <span style={{ color: '#f3f4f6', fontWeight: 600 }}>{sym.name}</span>
                    <span style={{ color: '#9ca3af', marginLeft: '12px', fontSize: '12px' }}>in {sym.filePath} (L{sym.startLine}-L{sym.endLine})</span>
                  </div>
                  <span style={{ color: sym.exported ? '#60a5fa' : '#6b7280', fontSize: '12px' }}>{sym.exported ? 'Exported' : 'Internal'}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#9ca3af' }}>No AST symbols loaded.</p>
          )}
        </div>
      )}

      {/* API Routes View */}
      {activeTab === 'apis' && (
        <div style={{ backgroundColor: '#111827', borderRadius: '12px', padding: '24px', border: '1px solid #1f2937' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>API Route Matrix</h2>
          {snapshot?.apis && snapshot.apis.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {snapshot.apis.map((api: any) => (
                <div key={api.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#1f2937', borderRadius: '8px', fontSize: '14px' }}>
                  <div>
                    <span style={{ backgroundColor: api.method === 'GET' ? '#047857' : api.method === 'POST' ? '#4338ca' : '#b45309', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '12px', marginRight: '12px' }}>
                      {api.method}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{api.path}</span>
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '13px' }}>
                    Handler: <span style={{ color: '#a5b4fc' }}>{api.handlerName}</span> ({api.filePath})
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#9ca3af' }}>No API routes detected.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default RepoExplorer;
