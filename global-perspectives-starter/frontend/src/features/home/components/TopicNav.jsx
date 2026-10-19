import React, { useState, useEffect, useRef } from 'react';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import StoryRow from '@/shared/ui/StoryRow.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import { crisisDotVar } from '@/shared/lib/crisisHue';
import '@/features/home/components/TopicNav.css';

// TopicNav — the /today right rail (inside EditorialShell): every topic grouped by region, the one
// in view marked as the selected row; a click scrolls to it.
function TopicNav({ topics, categorizedTopics }) {
  const [activeTopicId, setActiveTopicId] = useState(null);
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

  if (!topics || topics.length === 0) return null;

  const sortedRegions = Object.entries(categorizedTopics)
    .filter(([, rt]) => rt.length > 0)
    .sort((a, b) => {
      if (a[0] === 'World') return 1;
      if (b[0] === 'World') return -1;
      return b[1].length - a[1].length;
    });

  return (
    <div className="topic-nav-rail">
      <SectionHeader label="Topics" count={topics.length} />
      {sortedRegions.map(([region, regionTopics]) => (
        <div key={region} className="topic-nav-rail-region">
          <SectionHeader as="h3" label={region} count={regionTopics.length} />
          <ul className="topic-nav-rail-list">
            {regionTopics.map((topic) => {
              const globalIdx = topics.indexOf(topic);
              const id = getTopicId(topic, globalIdx);
              const category = topic.category || 'general';
              return (
                <StoryRow
                  key={id}
                  title={topic.title}
                  hue={crisisDotVar(category)}
                  chip={<CategoryTag category={category} />}
                  meta={topic.x_trending ? <span className="topic-nav-rail-trend">Trending</span> : null}
                  active={activeTopicId === `topic-${id}`}
                  onClick={() => scrollToTopic(id)}
                />
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default TopicNav;
