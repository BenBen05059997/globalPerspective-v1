import React, { useState, useEffect, useRef } from 'react';
import './TopicNav.css';

function TopicNav({ topics, categorizedTopics }) {
  const [activeTopicId, setActiveTopicId] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [collapsedRegions, setCollapsedRegions] = useState({});
  const observerRef = useRef(null);

  const getTopicId = (t, idx) => {
    const directId = t?.topicId || t?.topic_id || t?.id;
    if (directId != null) {
      const candidate = String(directId).trim();
      if (candidate.length > 0) return candidate;
    }
    const slug = `${t.title || 'topic'}-${idx}`.replace(/[^a-zA-Z0-9]/g, '-');
    return slug || `topic-${idx}`;
  };

  useEffect(() => {
    if (!topics || topics.length === 0) return;

    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
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

    topics.forEach((topic) => {
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

  const scrollToTopic = (topicId) => {
    const element = document.getElementById(`topic-${topicId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const toggleRegion = (region) => {
    setCollapsedRegions(prev => ({ ...prev, [region]: !prev[region] }));
  };

  if (!topics || topics.length === 0) return null;

  const sortedRegions = Object.entries(categorizedTopics)
    .filter(([, rt]) => rt.length > 0)
    .sort((a, b) => {
      if (a[0] === 'World') return 1;
      if (b[0] === 'World') return -1;
      return b[1].length - a[1].length;
    });

  return (
    <div className={`topic-nav ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="topic-nav-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <span className="topic-nav-title">Topics</span>
        <span className="topic-nav-count">{topics.length}</span>
        <span className="topic-nav-toggle">{isCollapsed ? '◀' : '▶'}</span>
      </div>

      {!isCollapsed && (
        <div className="topic-nav-list">
          {sortedRegions.map(([region, regionTopics]) => {
            const isRegionCollapsed = collapsedRegions[region];
            return (
              <div key={region} className="topic-nav-region">
                <div
                  className="topic-nav-region-header"
                  onClick={() => toggleRegion(region)}
                >
                  <span className="topic-nav-region-label">{region}</span>
                  <span className="topic-nav-region-count">{regionTopics.length}</span>
                  <span className="topic-nav-region-toggle">{isRegionCollapsed ? '▶' : '▼'}</span>
                </div>

                {!isRegionCollapsed && regionTopics.map((topic) => {
                  const globalIdx = topics.indexOf(topic);
                  const id = getTopicId(topic, globalIdx);
                  const isActive = activeTopicId === `topic-${id}`;

                  return (
                    <div
                      key={id}
                      className={`topic-nav-item ${isActive ? 'active' : ''}`}
                      onClick={() => scrollToTopic(id)}
                    >
                      <span className="topic-nav-item-title">{topic.title}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TopicNav;
