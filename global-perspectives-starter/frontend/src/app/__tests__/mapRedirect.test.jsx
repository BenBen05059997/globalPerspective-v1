import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import MapRedirect from '@/app/MapRedirect';

function Where() {
  const { pathname, search } = useLocation();
  return <div data-testid="where">{pathname}{search}</div>;
}

describe('/map redirect (S6 home swap)', () => {
  it('sends /map to / and keeps the query params', () => {
    render(
      <MemoryRouter initialEntries={['/map?layer=risk&country=Iran&story=t1&focus=s9']}>
        <Routes>
          <Route path="/" element={<Where />} />
          <Route path="/map" element={<MapRedirect />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('where').textContent).toBe('/?layer=risk&country=Iran&story=t1&focus=s9');
  });
});
