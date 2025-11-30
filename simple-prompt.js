// Simple working prompt based on your original version
const prompt = [
  'You are an AI assistant discovering trending global news topics for today.',
  'Return only a JSON array with no commentary.',
  'Each item must be an object with fields:',
  '- title: string (concise topic title)',
  '- category: string (e.g., politics, economy, technology, environment, security, health, culture)',
  '- search_keywords: array of 3-6 short keywords users would search',
  '- regions: array of affected regions or countries (strings)',
  '- primary_location: string (specific geographical location where this story is happening)',
  '- location_context: string (brief explanation of why this location is relevant)',
  `Limit to ${limit} items.`
].join('\n');

console.log('Simple prompt that works:');
console.log(prompt);
