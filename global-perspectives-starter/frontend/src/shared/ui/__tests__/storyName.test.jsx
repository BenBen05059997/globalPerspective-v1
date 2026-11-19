import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { storyName, StoryName, StorySteps } from '@/shared/ui/StoryCard.jsx';
import { NAME_NOTE } from '@/shared/ui/JudgmentTip.jsx';

describe('story name (SPEC §6b)', () => {
  it('a name shows as stamped; none, empty or one matching the headline (case, spacing, punctuation aside) is no name', () => {
    expect(storyName('Harbour expansion plan', 'Council votes on harbour plan')).toBe('Harbour expansion plan');
    expect(storyName(null, 'x')).toBeNull();
    expect(storyName('  ', 'x')).toBeNull();
    expect(storyName('Council votes, on harbour plan!', 'council votes on  harbour plan')).toBeNull();
  });

  it('the name carries the MODEL JUDGMENT tag; a tap opens its line, a second tap closes it', () => {
    render(<StoryName name="Harbour expansion plan" />);
    const tag = screen.getByRole('button', { name: `Model judgment: ${NAME_NOTE}` });
    expect(tag).toHaveTextContent('MODEL JUDGMENT');
    fireEvent.click(tag);
    expect(screen.getByRole('tooltip')).toHaveTextContent(NAME_NOTE);
    fireEvent.click(tag);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('inside a row the tag is not a control: its line is the title', () => {
    render(<StoryName name="Harbour expansion plan" interactive={false} small />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(document.querySelector('.gp-jtip')).toHaveAttribute('title', NAME_NOTE);
  });

  it('a named card ends its steps with the bright newest step', () => {
    const story = { stepCount: 6, firstStep: { date: '2026-11-06', title: 'Council proposes', role: 'start' }, newestStep: { date: '2026-11-17' } };
    render(<StorySteps role="move" story={story} newest={{ date: '2026-11-17', title: 'Plan passes its first reading' }} />);
    const items = [...document.querySelectorAll('.gp-scard__steps li')].map((li) => li.textContent);
    expect(items.at(-1)).toBe('Nov 17 Newest step: Plan passes its first reading');
    expect(items).toHaveLength(3);
  });
});
