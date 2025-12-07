import React, { useState, useMemo, useEffect, useRef } from 'react';
import './AIComponents.css';

/**
 * TraceCauseDisplay Component
 * Displays AI-generated Trace Cause (Past) Context
 */
const TraceCauseDisplay = ({
    traceCause,
    isLoading,
    error,
    onRetry,
    onClear,
    isCollapsed = false,
    onToggleCollapse,
    lastActive
}) => {
    const containerRef = useRef(null);
    const [activeTab, setActiveTab] = useState('context'); // 'context', 'perspectives', 'timeline'

    // Auto-scroll logic
    useEffect(() => {
        if ((isLoading || ((traceCause || error) && !isCollapsed)) && containerRef.current) {
            setTimeout(() => {
                containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }, [isLoading, traceCause, error, isCollapsed, lastActive]);

    // Parse the raw markdown into structured sections
    const parsedContent = useMemo(() => {
        if (!traceCause?.content) return null;

        const text = traceCause.content;
        const sections = {
            context: [],
            perspectives: [],
            timeline: [],
            score: null
        };

        let currentSection = 'context';
        const lines = text.split('\n');

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;

            // Detect Impact Score
            if (trimmed.includes('Impact Score') || trimmed.includes('Score (')) {
                const match = trimmed.match(/(\d+)\/10/);
                if (match) sections.score = match[1];
            }

            // Detect Section Headers to switch tabs
            const lower = trimmed.toLowerCase();
            if (lower.includes('context') || lower.includes('how we got here') || lower.includes('origin')) {
                currentSection = 'context';
            } else if (lower.includes('perspective') || lower.includes('echo chamber') || lower.includes('bias')) {
                currentSection = 'perspectives';
            } else if (lower.includes('timeline') || lower.includes('verdict') || lower.includes('so what')) {
                currentSection = 'timeline';
            }

            // Add line to current section
            sections[currentSection].push(trimmed);
        });

        return sections;
    }, [traceCause]);

    // Simple Markdown Renderer (Headers, Bold, Lists)
    const renderMarkdown = (lines) => {
        return lines.map((line, idx) => {
            // Header ###
            if (line.startsWith('###')) {
                return <h4 key={idx} style={{ margin: '16px 0 8px', color: '#111827', fontSize: '1.05em', fontWeight: 600 }}>{line.replace(/###/g, '').trim()}</h4>;
            }
            // Bold **text**
            const processBold = (text) => {
                const parts = text.split(/(\*\*.*?\*\*)/);
                return parts.map((part, i) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={i} style={{ color: '#1f2937' }}>{part.slice(2, -2)}</strong>;
                    }
                    return part;
                });
            };

            // List Item -
            if (line.startsWith('- ') || line.startsWith('• ')) {
                return (
                    <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '8px', paddingLeft: '4px' }}>
                        <span style={{ color: 'var(--ai-accent-trace)', fontSize: '1.2em', lineHeight: '1' }}>•</span>
                        <span style={{ lineHeight: '1.6', color: '#4b5563' }}>{processBold(line.substring(2))}</span>
                    </div>
                );
            }

            // Standard Paragraph
            return <p key={idx} style={{ margin: '0 0 12px', lineHeight: '1.6', color: '#4b5563' }}>{processBold(line)}</p>;
        });
    };

    if (isLoading) {
        return (
            <div ref={containerRef} className="ai-result-card" style={{ padding: '24px', textAlign: 'center' }}>
                <div className="ai-spinner" style={{ position: 'relative', left: 'auto', margin: '0 auto 12px', width: '24px', height: '24px', color: 'var(--ai-accent-trace)' }}></div>
                <div className="loading-text">
                    <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Tracing origins & timeline...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div ref={containerRef} className="ai-result-card" style={{ borderColor: '#fca5a5' }}>
                <div className="ai-result-header" style={{ background: '#fef2f2' }}>
                    <div className="ai-result-title" style={{ color: '#991b1b' }}>Trace Failed</div>
                    <div className="ai-result-actions">
                        <button className="ai-btn" onClick={onRetry} style={{ height: '28px', fontSize: '12px', background: '#fff' }}>Retry</button>
                        <button className="ai-btn" onClick={onClear} style={{ height: '28px', fontSize: '12px', background: '#fff' }}>Close</button>
                    </div>
                </div>
                <div className="ai-result-content">
                    <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p>
                </div>
            </div>
        );
    }

    if (!traceCause) return null;

    return (
        <div ref={containerRef} className="ai-result-card">
            {/* Header */}
            <div className="ai-result-header" onClick={onToggleCollapse} style={{ cursor: 'pointer' }}>
                <div className="ai-result-title" style={{ color: 'var(--ai-accent-trace)' }}>
                    Trace Cause & Context
                </div>

                {/* Impact Score Badge - Styled to fit header */}
                {parsedContent?.score && (
                    <div style={{
                        backgroundColor: parsedContent.score >= 8 ? '#ffebee' : parsedContent.score >= 5 ? '#fff3e0' : '#e8f5e9',
                        color: parsedContent.score >= 8 ? '#c62828' : parsedContent.score >= 5 ? '#ef6c00' : '#2e7d32',
                        padding: '2px 10px',
                        borderRadius: '99px',
                        fontSize: '11px',
                        fontWeight: '600',
                        border: '1px solid currentColor',
                        marginLeft: 'auto',
                        marginRight: '12px'
                    }}>
                        Impact: {parsedContent.score}/10
                    </div>
                )}

                <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                    {isCollapsed ? 'Show' : 'Hide'}
                </div>
            </div>

            {!isCollapsed && parsedContent && (
                <>
                    {/* Tabs */}
                    <div className="ai-tabs">
                        <button
                            onClick={() => setActiveTab('context')}
                            className={`ai-tab ${activeTab === 'context' ? 'active' : ''}`}
                            style={{ flex: 1 }}
                        >
                            History
                        </button>
                        <button
                            onClick={() => setActiveTab('perspectives')}
                            className={`ai-tab ${activeTab === 'perspectives' ? 'active' : ''}`}
                            style={{ flex: 1 }}
                        >
                            Perspectives
                        </button>
                        <button
                            onClick={() => setActiveTab('timeline')}
                            className={`ai-tab ${activeTab === 'timeline' ? 'active' : ''}`}
                            style={{ flex: 1 }}
                        >
                            Timeline
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="ai-result-content">
                        {renderMarkdown(parsedContent[activeTab])}
                        {parsedContent[activeTab].length === 0 && (
                            <p style={{ color: '#9ca3af', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                                No specific data for this section.
                            </p>
                        )}
                        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: '#9ca3af' }}>Deep Context Agent v1.2</span>
                            <div className="ai-result-actions">
                                <div className="ai-action-icon" onClick={onClear} title="Close">✕</div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default TraceCauseDisplay;
