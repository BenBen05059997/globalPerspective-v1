import { useState, useEffect, useRef } from 'react';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import StoryRow from '@/shared/ui/StoryRow.jsx';
import { KIND_WORD } from '@/shared/ui/EntryRole.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import { crisisDotVar } from '@/shared/lib/crisisHue';
import { getTopicId, sortRegions } from '@/features/home/lib/topics.js';
import '@/features/home/components/TopicNav.css';

// TopicNav — the /today right rail (inside EditorialShell): every topic grouped by region, the one
// in view marked as the selected row; a click scrolls to it.
function TopicNav({ topics, categorizedTopics, kindOf = (t) => t.role }) {
  const [activeTopicId, setActiveTopicId] = useState(null);
  const observerRef = useRef(null);

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

  const sortedRegions = sortRegions(categorizedTopics);

  return (
    <div className="topic-nav-rail">
      <SectionHeader label="This edition by region" count={topics.length} />
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
                  meta={(KIND_WORD[kindOf(topic)] || topic.x_trending) ? (
                    <>
                      {KIND_WORD[kindOf(topic)] ? <span className="topic-nav-rail-kind">{KIND_WORD[kindOf(topic)]}</span> : null}
                      {topic.x_trending ? <span className="topic-nav-rail-trend">Trending on X</span> : null}
                    </>
                  ) : null}
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
