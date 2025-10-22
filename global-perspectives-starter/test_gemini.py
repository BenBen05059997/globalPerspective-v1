#!/usr/bin/env python3
"""
Test script to verify Google Gemini API connectivity
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

try:
    import google.generativeai as genai
    print("✓ Google Generative AI library imported successfully")
except ImportError as e:
    print(f"✗ Failed to import Google Generative AI library: {e}")
    sys.exit(1)

def test_gemini_api():
    """Test basic Gemini API functionality"""
    
    # Check for API key
    api_key = os.getenv('GOOGLE_GEMINI_API_KEY')
    if not api_key:
        print("✗ GOOGLE_GEMINI_API_KEY environment variable not found")
        return False
    
    print("✓ Google Gemini API key found")
    
    try:
        # Configure Gemini
        genai.configure(api_key=api_key)
        print("✓ Gemini API configured")
        
        # List available models
        print("\n📋 Available models:")
        for model_info in genai.list_models():
            if 'generateContent' in model_info.supported_generation_methods:
                print(f"  - {model_info.name}")
        
        # Initialize model
        model = genai.GenerativeModel('gemini-2.0-flash')
        print("✓ Gemini 2.0 Flash model initialized")
        
        # Test simple generation
        print("\n🧪 Testing simple content generation...")
        response = model.generate_content("Say hello and confirm you're working")
        
        if response and response.text:
            print(f"✓ Gemini response: {response.text.strip()}")
            return True
        else:
            print("✗ No response from Gemini")
            return False
            
    except Exception as e:
        print(f"✗ Gemini API test failed: {e}")
        return False

if __name__ == "__main__":
    print("🔍 Testing Google Gemini API connectivity...\n")
    
    success = test_gemini_api()
    
    if success:
        print("\n✅ Gemini API test completed successfully!")
    else:
        print("\n❌ Gemini API test failed!")
        sys.exit(1)