"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, CheckCircle2, AlertTriangle, XCircle, Settings,
  Download, ArrowLeft, ChevronDown, ChevronRight, RefreshCw, Layers
} from 'lucide-react';
import Link from 'next/link';

interface RouteNode {
  id: string
  path: string
  type: string
  status: 'allowed' | 'blocked' | 'system' | 'staged'
  depth: number
  parent: string | null
  children: string[]
  created: string
  modified: string
}

interface Metadata {
  site: string
  mode: string
  last_updated: string
  total_routes: number
  allowed: number
  blocked: number
}

export default function RouteGovernanceDashboard() {
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [routes, setRoutes] = useState<RouteNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actioningMode, setActioningMode] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'route-homepage': true,
    'route-blog': true,
    'route-daily': true,
    'route-entities': true,
    'route-weekly-edition': true
  });
  const [selectedRoute, setSelectedRoute] = useState<RouteNode | null>(null);

  const fetchRouteTree = useCallback(async () => {
    try {
      const res = await fetch('/api/internal/route-tree');
      if (res.ok) {
        const data = await res.json();
        setMetadata(data.metadata);
        setRoutes(data.routes);
      }
    } catch (e) {
      console.error('Failed to load route tree:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRouteTree();
  }, [fetchRouteTree]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRouteTree();
  };

  const handleSetMode = async (mode: string) => {
    setActioningMode(mode);
    try {
      const res = await fetch('/api/internal/set-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      if (res.ok) {
        await fetchRouteTree();
      }
    } catch (e) {
      console.error('Failed to set mode:', e);
    } finally {
      setActioningMode(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDownload = async (format: 'json' | 'opml') => {
    if (format === 'json') {
      const payload = { metadata, routes };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `route_tree_${metadata?.mode || 'lockout'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      try {
        const res = await fetch('/api/internal/route-tree?format=opml');
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `route_tree_${metadata?.mode || 'lockout'}.opml`;
          a.click();
          URL.revokeObjectURL(url);
        }
      } catch (e) {
        console.error('Failed to download OPML:', e);
      }
    }
  };

  // Render a specific node recursively
  const renderTreeNode = (node: RouteNode) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = !!expandedNodes[node.id];
    const childNodes = routes.filter(r => r.parent === node.id);

    // Status styling
    let statusIcon = '🔘';
    let statusColor = 'var(--text-muted)';
    if (node.status === 'allowed') {
      statusIcon = '✅';
      statusColor = '#22c55e';
    } else if (node.status === 'blocked') {
      statusIcon = '❌';
      statusColor = '#ef4444';
    } else if (node.status === 'staged') {
      statusIcon = '⏸️';
      statusColor = '#eab308';
    }

    return (
      <div key={node.id} style={{ marginLeft: `${node.depth * 16}px`, marginTop: '8px' }}>
        <div 
          onClick={() => setSelectedRoute(node)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            background: selectedRoute?.id === node.id ? 'var(--primary-glow)' : 'var(--bg-secondary)',
            border: `1px solid ${selectedRoute?.id === node.id ? 'var(--primary)' : 'var(--border-color)'}`,
            cursor: 'pointer',
            boxShadow: 'var(--glass-shadow)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            {hasChildren ? (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(node.id);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {isExpanded ? <ChevronDown style={{ width: '16px', height: '16px' }} /> : <ChevronRight style={{ width: '16px', height: '16px' }} />}
              </button>
            ) : (
              <div style={{ width: '16px' }} />
            )}
            <span style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.path}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '100px', background: 'var(--bg-primary)', color: 'var(--text-muted)', fontWeight: 700 }}>
              {node.type}
            </span>
            <span style={{ color: statusColor, fontSize: '14px', display: 'flex', alignItems: 'center' }}>
              {statusIcon}
            </span>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div style={{ marginTop: '4px' }}>
            {childNodes.map(child => renderTreeNode(child))}
          </div>
        )}
      </div>
    );
  };

  const rootNode = routes.find(r => r.parent === null);

  return (
    <div className="container" style={{ padding: '24px 16px 80px 16px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Back to Admin */}
      <div style={{ marginBottom: '20px' }}>
        <Link 
          href="/admin"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}
        >
          <ArrowLeft style={{ width: '14px', height: '14px' }} />
          <span>Back to Command Bridge</span>
        </Link>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield style={{ color: 'var(--primary)', width: '28px', height: '28px' }} />
            Route Governance
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Emergency publication controls and real-time route visualization
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '12px' }}
        >
          <RefreshCw style={{ width: '14px', height: '14px' }} className={refreshing ? 'animate-spin' : ''} />
          <span>Sync</span>
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <RefreshCw className="animate-spin" style={{ width: '32px', height: '32px', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Emergency Kill Switch Module */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', boxShadow: 'var(--glass-shadow)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Settings style={{ width: '16px', height: '16px', color: 'var(--primary)' }} />
              Emergency Kill Switches
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Site Mode Status</span>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {metadata?.mode === 'live' && <span style={{ color: '#22c55e' }}>🟢 Live</span>}
                  {metadata?.mode === 'lockout' && <span style={{ color: '#ef4444' }}>🔴 Full Lockout</span>}
                  {metadata?.mode === 'rollback_24h' && <span style={{ color: '#eab308' }}>⏪ Rollback 24h</span>}
                  {metadata?.mode === 'kill_latest_issue' && <span style={{ color: '#f97316' }}>🗑 Issue Lockout</span>}
                </div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Allow / Block Summary</span>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                  <span style={{ color: '#22c55e' }}>{metadata?.allowed} Allowed</span>
                  <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>/</span>
                  <span style={{ color: '#ef4444' }}>{metadata?.blocked} Blocked</span>
                </div>
              </div>
            </div>

            {/* Switch Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
              <button
                disabled={actioningMode !== null}
                onClick={() => handleSetMode('live')}
                style={{
                  padding: '12px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #16a34a',
                  background: metadata?.mode === 'live' ? '#22c55e' : 'transparent',
                  color: metadata?.mode === 'live' ? '#fff' : '#22c55e',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                🟢 Live Mode
              </button>
              <button
                disabled={actioningMode !== null}
                onClick={() => handleSetMode('lockout')}
                style={{
                  padding: '12px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #dc2626',
                  background: metadata?.mode === 'lockout' ? '#ef4444' : 'transparent',
                  color: metadata?.mode === 'lockout' ? '#fff' : '#ef4444',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                🔴 Lockout Mode
              </button>
              <button
                disabled={actioningMode !== null}
                onClick={() => handleSetMode('rollback_24h')}
                style={{
                  padding: '12px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #ca8a04',
                  background: metadata?.mode === 'rollback_24h' ? '#eab308' : 'transparent',
                  color: metadata?.mode === 'rollback_24h' ? '#fff' : '#eab308',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                ⏪ Rollback 24h
              </button>
              <button
                disabled={actioningMode !== null}
                onClick={() => handleSetMode('kill_latest_issue')}
                style={{
                  padding: '12px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #ea580c',
                  background: metadata?.mode === 'kill_latest_issue' ? '#f97316' : 'transparent',
                  color: metadata?.mode === 'kill_latest_issue' ? '#fff' : '#f97316',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                🗑 Kill Issue
              </button>
            </div>
          </div>

          {/* Visualization & Actions Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Phase 1: Route Tree Map (Collapsible List)
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleDownload('json')}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px' }}
              >
                <Download style={{ width: '14px', height: '14px' }} />
                <span>JSON</span>
              </button>
              <button
                onClick={() => handleDownload('opml')}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px' }}
              >
                <Download style={{ width: '14px', height: '14px' }} />
                <span>OPML</span>
              </button>
            </div>
          </div>

          {/* Tree View Structure */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', background: 'var(--bg-secondary)' }}>
            {rootNode ? renderTreeNode(rootNode) : <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No routes defined</div>}
          </div>

          {/* Route Metadata Inspector Panel */}
          {selectedRoute && (
            <div className="animate-fade-in" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', boxShadow: 'var(--glass-shadow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>Route Details Inspector</span>
                <button 
                  onClick={() => setSelectedRoute(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}
                >
                  Clear Selection
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Path:</span>{' '}
                  <code style={{ background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-primary)' }}>{selectedRoute.path}</code>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Type:</span>{' '}
                  <span style={{ textTransform: 'capitalize' }}>{selectedRoute.type}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Governor Status:</span>{' '}
                  <span style={{
                    fontWeight: 700,
                    color: selectedRoute.status === 'allowed' ? '#22c55e' : (selectedRoute.status === 'blocked' ? '#ef4444' : '#eab308')
                  }}>
                    {selectedRoute.status.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Nesting Depth:</span> {selectedRoute.depth}
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Created:</span> {new Date(selectedRoute.created).toLocaleString()}
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Last Modified:</span> {new Date(selectedRoute.modified).toLocaleString()}
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
