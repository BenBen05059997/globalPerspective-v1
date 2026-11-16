import Tabs, { tabIds, tabPanelProps } from '@/shared/ui/Tabs.jsx';

// PhoneTabs — the phone pattern's single tab switch. A thin wrapper:
// <Tabs variant="phone">. New code uses <Tabs> directly; these names stay for the current callers.
export const phoneTabIds = tabIds;
export const phonePanelProps = tabPanelProps;

export default function PhoneTabs(props) {
  return <Tabs variant="phone" {...props} />;
}
