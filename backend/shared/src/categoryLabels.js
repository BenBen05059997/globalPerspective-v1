'use strict';

// Display names of the twelve story categories the pipeline writes (lower-case key -> label), as the Dev.to digest, the LinkedIn/Bluesky
// posts and the RSS feed show them. Callers keep their own fallback for an unknown category ('General' in the digest, 'World' elsewhere).

const CATEGORY_LABEL = {
  politics: 'Politics',
  economy: 'Economy',
  military: 'Military',
  conflict: 'Conflict',
  disaster: 'Disaster',
  technology: 'Technology',
  health: 'Health',
  business: 'Business',
  society: 'Society',
  energy: 'Energy',
  climate: 'Climate',
  science: 'Science',
};

module.exports = { CATEGORY_LABEL };
