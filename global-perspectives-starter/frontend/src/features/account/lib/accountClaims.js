// The true, today-only claims about what a Global Perspectives account gives a reader.
// Shared between the signed-out account screen (Account.jsx's SignedOutDesk) and the sign-in
// screen (SignIn.jsx) so the two never drift — add a benefit here only once it actually works,
// and never list a membership-only feature (e.g. following countries) as free.
export const ACCOUNT_CLAIMS = [
  'Saved stories, countries, and daily briefs, kept in one list',
  'An Analysis Studio key, stored only in this browser',
  'Alert settings for the emails that are live today',
];

export const ACCOUNT_NOTE = 'Following countries is part of membership.';
