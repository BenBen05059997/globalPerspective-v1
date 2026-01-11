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
            },
            impactBreakdown: []
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

            // Parse Impact Breakdown (Human Impact, Economic Reach, Geopolitical Stability)
            const impactTypes = [
                { pattern: /\*?\*?Human Impact\*?\*?/i, category: 'People', icon: '👥' },
                { pattern: /\*?\*?Economic (Reach|Impact)\*?\*?/i, category: 'Economy', icon: '💰' },
                { pattern: /\*?\*?Geopolitical (Stability|Impact)\*?\*?/i, category: 'Regional', icon: '🌍' }
            ];

            impactTypes.forEach(({ pattern, category, icon }) => {
                if (pattern.test(trimmed)) {
                    // Extract score (e.g., "9/10")
                    const scoreMatch = trimmed.match(/(\d+)\/10/);
                    // Extract explanation from parentheses
                    const explanationMatch = trimmed.match(/\(([^)]+)\)/);

                    if (scoreMatch) {
                        const score = parseInt(scoreMatch[1], 10);
                        const explanation = explanationMatch ? explanationMatch[1].trim() : '';

                        sections.impactBreakdown.push({
                            category,
                            icon,
                            score,
                            explanation
                        });
                    }
                }
            });

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

            // Skip lines that are part of impact score breakdown or verdict (already parsed separately)
            const shouldSkipLine =
                lower.includes('impact score') ||
                lower.includes('human impact') ||
                lower.includes('economic reach') ||
                lower.includes('economic impact') ||
                lower.includes('geopolitical stability') ||
                lower.includes('geopolitical impact') ||
                (lower.includes('verdict:') && lower.includes('true signal'));

            if (shouldSkipLine) {
                return;
            }

            // Remove ** artifacts from beginning and add line to current section
            const cleanedLine = trimmed.replace(/^\*\*:?\s*/, '').replace(/\*\*$/, '');
            sections[currentSection].push(cleanedLine);
        });

        // Calculate verdict from impact breakdown (stricter criteria)
        if (sections.impactBreakdown.length > 0) {
            const scores = sections.impactBreakdown.map(item => item.score);
            const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
            const highCount = scores.filter(s => s >= 8).length;
            const maxScore = Math.max(...scores);

            // Combine all explanations for keyword detection
            const allExplanations = sections.impactBreakdown.map(item => item.explanation).join(' ').toLowerCase();

            // True Signal: High scores + global keywords (strict)
            const globalKeywords = ['global', 'worldwide', 'multiple countries', 'international',
                                   'war', 'invasion', 'pandemic', 'supply chain', 'trade disruption',
                                   'energy crisis', 'financial crisis', 'collapse'];
            const hasGlobalKeyword = globalKeywords.some(kw => allExplanations.includes(kw));

            if (avgScore >= 8 && highCount >= 2 && hasGlobalKeyword) {
                sections.verdict.classification = 'True Signal';
                sections.verdict.explanation = 'High-impact event with global implications affecting multiple countries.';
            }
            // Worth Watching: Moderate scores or regional keywords
            else {
                const regionalKeywords = ['regional', 'neighboring', 'spillover', 'tensions',
                                        'escalate', 'sanctions', 'drought', 'migration', 'refugees',
                                        'border', 'instability', 'could affect'];
                const hasRegionalKeyword = regionalKeywords.some(kw => allExplanations.includes(kw));

                if (avgScore >= 5 && (maxScore >= 7 || hasRegionalKeyword)) {
                    sections.verdict.classification = 'Worth Watching';
                    sections.verdict.explanation = 'Moderate-impact event that could escalate or spread regionally.';
                } else {
                    sections.verdict.classification = 'Noise';
                    sections.verdict.explanation = 'Low-impact event with limited consequences beyond local scope.';
                }
            }
        }
        // Fallback: Infer verdict from score if no impact breakdown available
        else if (!sections.verdict.classification && sections.score) {
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

    // Parse timeline events from markdown
    const parseTimelineEvents = (lines) => {
        const events = [];
        let currentEvent = null;

        lines.forEach(line => {
            // Skip headers and empty lines
            if (!line || line.startsWith('###')) return;

            // Strip bullet prefix for parsing
            const cleanLine = line.replace(/^[-•]\s*/, '').trim();

            // Look for year pattern anywhere in line (e.g., "2020", "2022-01", "Jan 2024")
            const yearMatch = cleanLine.match(/\b(\d{4}(?:[-\/]\d{1,2}(?:[-\/]\d{1,2})?)?)\b|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/i);

            if (yearMatch) {
                // Save previous event
                if (currentEvent) {
                    events.push(currentEvent);
                }

                const dateStr = yearMatch[0];
                const dateIndex = cleanLine.indexOf(dateStr);

                // Extract title: everything after the date, skip common prefixes
                let title = cleanLine.substring(dateIndex + dateStr.length).trim();

                // Clean up title: remove leading separators and common words
                title = title
                    .replace(/^[-:,\s]+/, '')  // Remove separators
                    .replace(/^(in|by|on|at|the)\s+/i, '')  // Remove leading prepositions
                    .trim();

                // If no title after date, try text before date
                if (!title && dateIndex > 0) {
                    title = cleanLine.substring(0, dateIndex).trim()
                        .replace(/^(in|by|on|at|the)\s+/i, '');
                }

                currentEvent = {
                    date: dateStr,
                    title: title || 'Event',
                    description: []
                };
            } else if (currentEvent) {
                // Add to description if not empty and doesn't contain 'timeline' header text
                if (cleanLine && !cleanLine.toLowerCase().match(/^timeline\s*$/)) {
                    // If title is still generic, try to use first description line as title
                    if (currentEvent.title === 'Event' && currentEvent.description.length === 0) {
                        currentEvent.title = cleanLine;
                    } else {
                        currentEvent.description.push(cleanLine);
                    }
                }
            }
        });

        // Push last event
        if (currentEvent) {
            events.push(currentEvent);
        }

        return events;
    };

    // Determine event color stage based on position and keywords
    const getEventStage = (event, index, total) => {
        const text = (event.title + ' ' + event.description.join(' ')).toLowerCase();

        // Keyword detection
        const startKeywords = ['began', 'started', 'initial', 'origin', 'first', 'launch'];
        const resultKeywords = ['now', 'today', 'current', 'resulted', 'led to', 'culminat', 'recent'];

        if (startKeywords.some(kw => text.includes(kw))) {
            return 'start';
        }
        if (resultKeywords.some(kw => text.includes(kw))) {
            return 'result';
        }

        // Position-based fallback
        const ratio = index / (total - 1 || 1);
        if (ratio < 0.33) return 'start';
        if (ratio > 0.66) return 'result';
        return 'evolve';
    };

    // Render timeline visualization
    const renderTimeline = (lines) => {
        const events = parseTimelineEvents(lines);

        // Fallback to markdown rendering if no date-based events detected
        if (events.length === 0) {
            return renderMarkdown(lines);
        }

        return (
            <div className="timeline-container">
                {events.map((event, idx) => {
                    const stage = getEventStage(event, idx, events.length);

                    return (
                        <div key={idx} className="timeline-item">
                            {/* Timeline line with dot */}
                            <div className="timeline-line">
                                <div className="timeline-dot"></div>
                                <div className="timeline-connector"></div>
                            </div>

                            {/* Event content */}
                            <div className="timeline-content">
                                <div className="timeline-date">{event.date}</div>
                                <div className="timeline-event-card">
                                    <div className={`timeline-event-title ${stage}`}>
                                        {event.title}
                                    </div>
                                    {event.description.length > 0 && (
                                        <div className="timeline-event-description">
                                            {event.description.join(' ')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    // Render Impact Breakdown visualization
    const renderImpactBreakdown = (impactData) => {
        if (!impactData || impactData.length === 0) return null;

        // Helper: Convert score to level and bar width
        const getImpactLevel = (score) => {
            if (score >= 8) return { level: 'High', className: 'high', width: '90%' };
            if (score >= 5) return { level: 'Moderate', className: 'moderate', width: '60%' };
            return { level: 'Low', className: 'low', width: '30%' };
        };

        return (
            <div className="impact-breakdown-container">
                <div className="impact-breakdown-title">Impact Breakdown</div>
                {impactData.map((item, idx) => {
                    const { level, className, width } = getImpactLevel(item.score);
                    return (
                        <div key={idx} className="impact-item">
                            <div className="impact-header">
                                <span className="impact-icon">{item.icon}</span>
                                <span className="impact-label">{item.category}</span>
                                <div className="impact-bar-container">
                                    <div className={`impact-bar-fill ${className}`} style={{ width }}></div>
                                </div>
                                <span className="impact-level">{level}</span>
                            </div>
                            {item.explanation && (
                                <div className="impact-explanation">{item.explanation}</div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    // Simple Markdown Renderer (Headers, Bold, Lists) - for context/perspectives tabs
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

                    {/* Impact Breakdown */}
                    {parsedContent.impactBreakdown.length > 0 && renderImpactBreakdown(parsedContent.impactBreakdown)}

                    {/* Tabs */}
                    <div className="ai-tabs">
                        <button
                            onClick={() => setActiveTab('context')}
                            className={`ai-tab ${activeTab === 'context' ? 'active' : ''}`}
                        >
                            History
                        </button>
                        <button
                            onClick={() => setActiveTab('perspectives')}
                            className={`ai-tab ${activeTab === 'perspectives' ? 'active' : ''}`}
                        >
                            Perspectives
                        </button>
                        <button
                            onClick={() => setActiveTab('timeline')}
                            className={`ai-tab ${activeTab === 'timeline' ? 'active' : ''}`}
                        >
                            Timeline
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="ai-result-content">
                        {activeTab === 'timeline'
                            ? renderTimeline(parsedContent[activeTab])
                            : renderMarkdown(parsedContent[activeTab])
                        }
                        {activeTab !== 'timeline' && parsedContent[activeTab].length === 0 && (
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
