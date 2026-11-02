'use strict';

const { CATEGORY_LABEL } = require('./_shared/categoryLabels');

function formatDisplayDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day))
    .toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
    });
}

module.exports = {
  formatDisplayDate,
  CATEGORY_LABEL,
};
