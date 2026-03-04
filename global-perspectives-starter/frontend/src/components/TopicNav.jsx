import React, { useState, useEffect, useRef } from 'react';
import './TopicNav.css';
import { useLang } from '../contexts/LanguageContext';
import { t, getLocalizedTitle } from '../utils/i18n';

function TopicNav({ topics, categorizedTopics }) {
  const { lang } = useLang();
  const [activeTopicId, setActiveTopicId] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const observerRef = useRef(null);

  // Get topic ID consistent with Home.jsx
  const getTopicId = (t, idx) => {
    const directId = t?.topicId || t?.topic_id || t?.id;
    if (directId != null) {
      const candidate = String(directId).trim();
      if (candidate.length > 0) return candidate;
    }
    const slug = `${t.title || 'topic'}-${idx}`.replace(/[^a-zA-Z0-9]/g, '-');
    return slug || `topic-${idx}`;
  };

  // Set up Intersection Observer to track which topic is in view
  useEffect(() => {
    if (!topics || topics.length === 0) return;

    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px', // Trigger when topic is in upper portion of viewport
      threshold: 0
    };

    const observerCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveTopicId(entry.target.id);
        }
      });
    };

    observerRef.current = new IntersectionObserver(observerCallback, observerOptions);

    // Observe all topic elements
    topics.forEach((topic, idx) => {
      const globalIdx = topics.indexOf(topic);
      const id = getTopicId(topic, globalIdx);
      const element = document.getElementById(`topic-${id}`);
      if (element) {
        observerRef.current.observe(element);
      }
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [topics]);

  // Scroll to topic when clicked
  const scrollToTopic = (topicId) => {
    const element = document.getElementById(`topic-${topicId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Get region for a topic
  const getTopicRegion = (topic) => {
    for (const [region, regionTopics] of Object.entries(categorizedTopics)) {
      if (regionTopics.includes(topic)) {
        return region;
      }
    }
    return null;
  };

  // Shorten region name for badge
  const getRegionBadge = (region) => {
    if (!region) return null;
    const regionMap = {
      'Asia & Pacific': 'Asia',
      'Europe': 'Europe',
      'Americas': 'Americas',
      'Middle East & Africa': 'MENA',
      'Global': 'Global'
    };
    return regionMap[region] || region.split(' ')[0];
  };

  // Truncate long titles
  const truncateTitle = (title, maxLength = 35) => {
    if (!title) return '';
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength - 3) + '...';
  };

  if (!topics || topics.length === 0) return null;

  return (
    <div className={`topic-nav ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="topic-nav-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <span className="topic-nav-title">{t('topics', lang)}</span>
        <span className="topic-nav-count">{topics.length}</span>
        <span className={`topic-nav-toggle ${isCollapsed ? 'collapsed' : ''}`}>
          {isCollapsed ? '◀' : '▶'}
        </span>
      </div>

      {!isCollapsed && (
        <div className="topic-nav-list">
          {Object.entries(categorizedTopics).map(([region, regionTopics]) => {
            if (regionTopics.length === 0) return null;

            return regionTopics.map((topic) => {
              const globalIdx = topics.indexOf(topic);
              const id = getTopicId(topic, globalIdx);
              const regionBadge = getRegionBadge(region);
              const isActive = activeTopicId === `topic-${id}`;

              return (
                <div
                  key={id}
                  className={`topic-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => scrollToTopic(id)}
                >
                  <span className="topic-nav-item-title">
                    {truncateTitle(getLocalizedTitle(topic, lang))}
                  </span>
                  {regionBadge && (
                    <span className={`topic-nav-badge ${region?.toLowerCase().replace(/[^a-z]/g, '-')}`}>
                      {regionBadge}
                    </span>
                  )}
                </div>
              );
            });
          })}
        </div>
      )}
    </div>
  );
}

export default TopicNav;
