import Tabs, { tabIds, tabPanelProps } from '@/shared/ui/Tabs.jsx';

// PhoneTabs — the phone pattern's single tab switch (REDESIGN_MASTER_PLAN §3.1 P1). A thin wrapper:
// <Tabs variant="phone">. New code uses <Tabs> directly; these names stay for the current callers.
export const phoneTabIds = tabIds;
export const phonePanelProps = tabPanelProps;

export default function PhoneTabs(props) {
  return <Tabs variant="phone" {...props} />;
}
