'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Download, Loader2 } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { ACTION_DISPLAY, getActionDisplay, getDiff } from '@/types/audit';
import { getDateLabel, formatTimestamp } from '@/lib/utils/date';
import type { AuditLogEvent, ActivityLogResponse, GroupedEvents } from '@/types/audit';

export default function ActivityLogPage() {
  // State
  const [events, setEvents] = useState<AuditLogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Filter state
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('last30days');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  // Load events when filters or page changes
  useEffect(() => {
    loadEvents();
  }, [actionFilter, actorFilter, dateRange, customDateFrom, customDateTo, page]);

  async function loadEvents() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '50');

      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (actorFilter !== 'all') params.set('actor', actorFilter);

      // Calculate date range
      if (dateRange === 'custom') {
        if (customDateFrom) params.set('date_from', customDateFrom);
        if (customDateTo) params.set('date_to', customDateTo);
      } else if (dateRange !== 'alltime') {
        const now = new Date();
        let daysAgo = 30;
        if (dateRange === 'last7days') daysAgo = 7;
        else if (dateRange === 'last90days') daysAgo = 90;

        const fromDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        params.set('date_from', fromDate.toISOString());
      }

      const res = await fetch(`/api/settings/activity?${params}`);
      if (!res.ok) {
        throw new Error('Failed to load activity log');
      }

      const data: ActivityLogResponse = await res.json();
      setEvents(data.events);
      setTotal(data.pagination.total);
      setHasNextPage(data.pagination.hasNextPage);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  }

  async function exportCSV() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (actorFilter !== 'all') params.set('actor', actorFilter);

      if (dateRange === 'custom') {
        if (customDateFrom) params.set('date_from', customDateFrom);
        if (customDateTo) params.set('date_to', customDateTo);
      } else if (dateRange !== 'alltime') {
        const now = new Date();
        let daysAgo = 30;
        if (dateRange === 'last7days') daysAgo = 7;
        else if (dateRange === 'last90days') daysAgo = 90;

        const fromDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        params.set('date_from', fromDate.toISOString());
      }

      window.open(`/api/settings/activity/export?${params}`, '_blank');
    } finally {
      setExporting(false);
    }
  }

  function toggleRow(eventId: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }

  function handleFilterChange() {
    // Reset to page 1 when filters change
    setPage(1);
  }

  // Group events by date
  const groupedEvents: GroupedEvents[] = useMemo(() => {
    const groups = new Map<string, AuditLogEvent[]>();

    events.forEach((event) => {
      const label = getDateLabel(event.created_at);
      if (!groups.has(label)) {
        groups.set(label, []);
      }
      groups.get(label)!.push(event);
    });

    return Array.from(groups.entries()).map(([dateLabel, events]) => ({
      dateLabel,
      events,
    }));
  }, [events]);

  // Get unique action types for filter dropdown (grouped by category)
  const actionOptions = useMemo(() => {
    const options: Array<{ value: string; label: string; group?: string }> = [
      { value: 'all', label: 'All actions' },
    ];

    const categories: Record<string, Array<{ value: string; label: string }>> = {
      Harmonies: [],
      Dedup: [],
      Normalize: [],
      Enrichment: [],
      Settings: [],
    };

    Object.entries(ACTION_DISPLAY).forEach(([action, display]) => {
      const [category] = action.split('.');
      if (category === 'harmony') {
        categories.Harmonies.push({ value: action, label: display.label });
      } else if (category === 'dedup' || action.includes('dedup')) {
        categories.Dedup.push({ value: action, label: display.label });
      } else if (category === 'normalize') {
        categories.Normalize.push({ value: action, label: display.label });
      } else if (category.includes('enrich')) {
        categories.Enrichment.push({ value: action, label: display.label });
      } else {
        categories.Settings.push({ value: action, label: display.label });
      }
    });

    // Add grouped options
    Object.entries(categories).forEach(([group, items]) => {
      if (items.length > 0) {
        options.push(...items.map((item) => ({ ...item, group })));
      }
    });

    return options;
  }, []);

  // Empty state
  if (!loading && events.length === 0 && page === 1 && actionFilter === 'all') {
    return (
      <div style={{ padding: '28px 32px', fontFamily: F.sans }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 8 }}>
          Activity
        </h1>
        <p style={{ fontSize: 13, color: C.text2, marginBottom: 32 }}>
          A log of all actions taken in your workspace
        </p>

        <div
          style={{
            textAlign: 'center',
            padding: '64px 32px',
            color: C.text3,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>
            No activity yet
          </div>
          <div style={{ fontSize: 13 }}>
            Actions like normalizing records, merging duplicates, and updating harmonies will appear here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', fontFamily: F.sans }}>
      {/* Header */}
      <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 8 }}>
        Activity
      </h1>
      <p style={{ fontSize: 13, color: C.text2, marginBottom: 24 }}>
        A log of all actions taken in your workspace
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Action filter */}
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            handleFilterChange();
          }}
          style={{
            padding: '8px 12px',
            fontSize: 13,
            border: `1px solid ${C.border}`,
            background: C.surface,
            color: C.text,
            borderRadius: 4,
            fontFamily: F.sans,
          }}
        >
          {actionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.group ? `${option.group}: ${option.label}` : option.label}
            </option>
          ))}
        </select>

        {/* Date range filter */}
        <select
          value={dateRange}
          onChange={(e) => {
            setDateRange(e.target.value);
            handleFilterChange();
          }}
          style={{
            padding: '8px 12px',
            fontSize: 13,
            border: `1px solid ${C.border}`,
            background: C.surface,
            color: C.text,
            borderRadius: 4,
            fontFamily: F.sans,
          }}
        >
          <option value="last7days">Last 7 days</option>
          <option value="last30days">Last 30 days</option>
          <option value="last90days">Last 90 days</option>
          <option value="alltime">All time</option>
          <option value="custom">Custom range...</option>
        </select>

        {/* Custom date range inputs */}
        {dateRange === 'custom' && (
          <>
            <input
              type="date"
              value={customDateFrom}
              onChange={(e) => {
                setCustomDateFrom(e.target.value);
                handleFilterChange();
              }}
              style={{
                padding: '8px 12px',
                fontSize: 13,
                border: `1px solid ${C.border}`,
                background: C.surface,
                color: C.text,
                borderRadius: 4,
                fontFamily: F.sans,
              }}
            />
            <span style={{ color: C.text3 }}>to</span>
            <input
              type="date"
              value={customDateTo}
              onChange={(e) => {
                setCustomDateTo(e.target.value);
                handleFilterChange();
              }}
              style={{
                padding: '8px 12px',
                fontSize: 13,
                border: `1px solid ${C.border}`,
                background: C.surface,
                color: C.text,
                borderRadius: 4,
                fontFamily: F.sans,
              }}
            />
          </>
        )}

        {/* Export button */}
        <button
          onClick={exportCSV}
          disabled={exporting}
          style={{
            marginLeft: 'auto',
            padding: '8px 16px',
            fontSize: 13,
            border: `1px solid ${C.border}`,
            background: C.surface,
            color: C.text,
            borderRadius: 4,
            cursor: exporting ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: F.sans,
          }}
        >
          {exporting ? <Loader2 size={16} /> : <Download size={16} />}
          Export CSV
        </button>
      </div>

      {/* Loading state */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: C.text3 }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* Event list grouped by date */}
          {groupedEvents.map((group) => (
            <div key={group.dateLabel} style={{ marginBottom: 32 }}>
              {/* Date header */}
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: C.text3,
                  marginBottom: 12,
                  paddingBottom: 8,
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                {group.dateLabel}
              </div>

              {/* Events */}
              {group.events.map((event) => {
                const isExpanded = expandedRows.has(event.id);
                const display = getActionDisplay(event.action);
                const hasStateChange = event.before_state || event.after_state;
                const diff = hasStateChange ? getDiff(event.before_state, event.after_state) : [];

                return (
                  <div
                    key={event.id}
                    style={{
                      borderBottom: `1px solid ${C.border}`,
                      paddingBottom: 12,
                      marginBottom: 12,
                    }}
                  >
                    {/* Collapsed row */}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      {/* Expand/collapse button */}
                      {hasStateChange && (
                        <button
                          onClick={() => toggleRow(event.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleRow(event.id);
                            }
                          }}
                          aria-expanded={isExpanded}
                          aria-controls={`event-detail-${event.id}`}
                          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} event details`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 4,
                            color: C.text3,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      )}

                      {/* Icon */}
                      <div
                        style={{
                          fontSize: 16,
                          color: display.color,
                          lineHeight: 1,
                          paddingTop: hasStateChange ? 0 : 4,
                          marginLeft: hasStateChange ? 0 : 28, // Align with expanded rows
                        }}
                      >
                        {display.icon}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
                              {event.object_label || display.label}
                            </div>
                            <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>
                              {event.actor_email?.split('@')[0] || 'Unknown user'} · {display.label.toLowerCase()}
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: C.text3, whiteSpace: 'nowrap' }}>
                            {formatTimestamp(event.created_at)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded state diff */}
                    {isExpanded && hasStateChange && (
                      <div
                        id={`event-detail-${event.id}`}
                        role="region"
                        style={{
                          marginTop: 12,
                          marginLeft: 44,
                          padding: 16,
                          background: C.surface2,
                          borderRadius: 4,
                          fontSize: 12,
                          fontFamily: F.mono,
                        }}
                      >
                        {diff.length > 0 ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div>
                              <div style={{ fontSize: 11, color: C.text3, marginBottom: 8, fontFamily: F.sans }}>
                                BEFORE
                              </div>
                              {diff.map((change) => (
                                <div key={change.key} style={{ marginBottom: 8 }}>
                                  <div style={{ color: C.text3, fontSize: 11 }}>{change.key}:</div>
                                  <div style={{ color: change.after !== null ? C.red : C.text2 }}>
                                    {change.before !== null ? JSON.stringify(change.before) : '(empty)'}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: C.text3, marginBottom: 8, fontFamily: F.sans }}>
                                AFTER
                              </div>
                              {diff.map((change) => (
                                <div key={change.key} style={{ marginBottom: 8 }}>
                                  <div style={{ color: C.text3, fontSize: 11 }}>{change.key}:</div>
                                  <div style={{ color: change.before !== null ? C.green : C.text2 }}>
                                    {change.after !== null ? JSON.stringify(change.after) : '(empty)'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div style={{ color: C.text3, fontFamily: F.sans }}>No state changes recorded</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Pagination */}
          {hasNextPage && (
            <button
              onClick={() => setPage(page + 1)}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: 13,
                border: `1px solid ${C.border}`,
                background: C.surface,
                color: C.text,
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: F.sans,
              }}
            >
              Load more
            </button>
          )}

          {/* Result count */}
          <div style={{ marginTop: 16, fontSize: 12, color: C.text3, textAlign: 'center' }}>
            Showing {events.length} of {total} events
          </div>
        </>
      )}

      {/* Screen reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {loading ? 'Loading events...' : `${events.length} events found`}
      </div>
    </div>
  );
}
