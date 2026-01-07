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
            score: null,
            verdict: {
                classification: null,
                explanation: null
            }
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

            // Detect Verdict
            if (trimmed.includes('Verdict') && trimmed.includes(':')) {
                const verdictText = trimmed.substring(trimmed.indexOf(':') + 1).trim();

                // Classification detection (case-insensitive, partial match)
                const lowerVerdict = verdictText.toLowerCase();
                if (lowerVerdict.includes('true signal') || lowerVerdict.includes('truesignal') ||
                    (lowerVerdict.includes('signal') && !lowerVerdict.includes('noise'))) {
                    sections.verdict.classification = 'True Signal';
                } else if (lowerVerdict.includes('worth watching') || lowerVerdict.includes('watching')) {
                    sections.verdict.classification = 'Worth Watching';
                } else if (lowerVerdict.includes('noise') || lowerVerdict.includes('just noise') ||
                           lowerVerdict.includes('pure noise')) {
                    sections.verdict.classification = 'Noise';
                }

                // Extract explanation (the sentence after verdict keyword)
                const cleaned = verdictText
                    .replace(/\*\*/g, '')  // Remove bold
                    .replace(/^[-•]\s*/, '')  // Remove list markers
                    .trim();

                // Find the explanation (everything after classification keyword)
                if (sections.verdict.classification) {
                    const classificationIndex = cleaned.toLowerCase()
                        .indexOf(sections.verdict.classification.toLowerCase());
                    if (classificationIndex !== -1) {
                        const afterClassification = cleaned
                            .substring(classificationIndex + sections.verdict.classification.length)
                            .replace(/^[:\-–—.\s]+/, '')  // Remove separators
                            .trim();
                        if (afterClassification) {
                            sections.verdict.explanation = afterClassification;
                        }
                    }
                }

                // Fallback: if no classification found but have text, use entire text as explanation
                if (!sections.verdict.classification && cleaned) {
                    sections.verdict.explanation = cleaned;
                    // Try to infer classification from keywords in explanation
                    if (cleaned.match(/\b(significant|critical|major|important|shapes)\b/i)) {
                        sections.verdict.classification = 'True Signal';
                    } else if (cleaned.match(/\b(minor|limited|minimal|localized)\b/i)) {
                        sections.verdict.classification = 'Noise';
                    } else {
                        sections.verdict.classification = 'Worth Watching';
                    }
                }
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

        // Fallback: Infer verdict from score if verdict not found
        if (!sections.verdict.classification && sections.score) {
            const numScore = parseInt(sections.score, 10);
            if (numScore >= 8) {
                sections.verdict.classification = 'True Signal';
                sections.verdict.explanation = 'High-impact event with significant global implications.';
            } else if (numScore >= 5) {
                sections.verdict.classification = 'Worth Watching';
                sections.verdict.explanation = 'Moderate-impact event that warrants continued monitoring.';
            } else {
                sections.verdict.classification = 'Noise';
                sections.verdict.explanation = 'Low-impact event with limited lasting consequences.';
            }
        }

        return sections;
    }, [traceCause]);

    // Helper: Get verdict color scheme
    const getVerdictColor = (classification) => {
        switch(classification) {
            case 'True Signal':
                return { bg: '#ffebee', text: '#c62828', border: '#c62828' };
            case 'Worth Watching':
                return { bg: '#fff3e0', text: '#ef6c00', border: '#ef6c00' };
            case 'Noise':
                return { bg: '#e8f5e9', text: '#2e7d32', border: '#2e7d32' };
            default:
                return { bg: '#f5f5f5', text: '#616161', border: '#9e9e9e' };
        }
    };

    // Helper: Get verdict icon
    const getVerdictIcon = (classification) => {
        switch(classification) {
            case 'True Signal':
                return '🔴';
            case 'Worth Watching':
                return '🟠';
            case 'Noise':
                return '🟢';
            default:
                return '⚪';
        }
    };

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

                {/* Impact Score Badge - Fallback if verdict not available */}
                {parsedContent?.score && !parsedContent?.verdict?.classification && (
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
                    {/* Verdict Banner */}
                    {parsedContent?.verdict?.classification && (
                        <div style={{
                            padding: '16px 20px',
                            backgroundColor: getVerdictColor(parsedContent.verdict.classification).bg,
                            borderBottom: `2px solid ${getVerdictColor(parsedContent.verdict.classification).border}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                        }}>
                            {/* Classification Label */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <span style={{ fontSize: '16px' }}>
                                    {getVerdictIcon(parsedContent.verdict.classification)}
                                </span>
                                <span style={{
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    letterSpacing: '0.5px',
                                    textTransform: 'uppercase',
                                    color: getVerdictColor(parsedContent.verdict.classification).text
                                }}>
                                    {parsedContent.verdict.classification}
                                </span>
                            </div>

                            {/* Explanation */}
                            {parsedContent.verdict.explanation && (
                                <p style={{
                                    margin: 0,
                                    fontSize: '14px',
                                    lineHeight: '1.5',
                                    color: getVerdictColor(parsedContent.verdict.classification).text,
                                    opacity: 0.9,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {parsedContent.verdict.explanation}
                                </p>
                            )}
                        </div>
                    )}

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
