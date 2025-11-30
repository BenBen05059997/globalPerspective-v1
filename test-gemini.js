// Test script to call the simplified Gemini handler
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('fs').promises = require('fs').promises');

const API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
const MODEL_NAME = 'gemini-2.5-flash';

async function testSimplifiedHandler() {
  console.log('🧪 Testing simplified Gemini handler...');
  
  if (!API_KEY) {
    console.error('❌ No Google Gemini API key configured');
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    
    const currentDateString = new Date().toISOString().split('T')[0];
    
    // Test with a simple Google News simulation
    const testPrompt = `Analyze today's top headlines for ${currentDateString}`;
    
    const result = await model.generateContent(testPrompt);
    const text = result?.response?.text?.() || '';
    
    console.log('📊 Test response received:');
    console.log('📄 Response type:', typeof result);
    console.log('📄 Full response preview:');
    console.log(text.slice(0, 1000));
    
    console.log('✅ Test completed');
    return text;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return null;
  }
}

// Run test
(async () => {
  const response = await testSimplifiedHandler();
  console.log('Response length:', response);
  if (response && response.length > 0) {
    console.log('✅ Test successful! Gemini responded with:', response.substring(0, 200));
    return;
  }
  console.log('❌ Test failed - no response from Gemini');
})();

// Uncomment the test run
// testSimplifiedHandler();
