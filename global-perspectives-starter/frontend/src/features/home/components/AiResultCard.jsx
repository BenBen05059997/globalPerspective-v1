import { useEffect, useRef } from 'react';
import AiUnavailable from '@/features/home/components/AiUnavailable';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';
import Button from '@/shared/ui/Button.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import '@/features/home/AIComponents.css';

// AiResultCard — the one frame for a story's Summary / Prediction / Trace result on /today (and in
// the archive modal): loading (BootLoader), the honest unavailable state, or a titled card whose
// body can be hidden. The card scrolls itself into view when it loads, opens or fails.
//   title      section label        loadingText  the one honest line while loading
//   what       name used by AiUnavailable          hasResult    there is a result to show
export default function AiResultCard({
  title, loadingText, what, hasResult, isLoading, error, onRetry, onClear,
  isCollapsed = false, onToggleCollapse, lastActive, children,
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    if ((isLoading || ((hasResult || error) && !isCollapsed)) && containerRef.current) {
      setTimeout(() => containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
  }, [isLoading, hasResult, error, isCollapsed, lastActive]);

  if (isLoading) {
    return (
      <div ref={containerRef} className="ai-result-card">
        <BootLoader variant="inline" className="gp-boot--tight" label={loadingText} text={loadingText} />
      </div>
    );
  }

  if (error) {
    return <AiUnavailable error={error} containerRef={containerRef} what={what} onRetry={onRetry} onClear={onClear} />;
  }

  if (!hasResult) return null;

  return (
    <section ref={containerRef} className="ai-result-card">
      <SectionHeader as="h4" className="ai-result-header" label={title}>
        <Button compact aria-expanded={!isCollapsed} onClick={onToggleCollapse}>
          {isCollapsed ? 'Show' : 'Hide'}
        </Button>
      </SectionHeader>
      {!isCollapsed && children}
    </section>
  );
}
