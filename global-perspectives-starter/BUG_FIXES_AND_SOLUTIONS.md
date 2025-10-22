# Bug Fixes and Solutions - Global Perspectives News App

## Session Summary
This document records all the critical bug fixes implemented to resolve TypeError issues and Lambda service integration problems in the Global Perspectives News application.

## Issues Resolved

### 1. TypeError in SearchResults.jsx - `results.map()` Issue

**Problem**: 
- `TypeError: results.map is not a function` at line 207 in `SearchResults.jsx`
- The error occurred because `results` was an object, not an array

**Root Cause**:
```javascript
// Incorrect code at line 207
const uniqueCountries = new Set(results.map(article => article.country).filter(Boolean));
```
- `results` was an object containing `{articles: [...], total: number}` structure
- Trying to call `.map()` on an object instead of the `articles` array

**Solution**:
```javascript
// Fixed code at line 207
const uniqueCountries = new Set(articles.map(article => article.country).filter(Boolean));
```

**Files Modified**:
- `frontend/src/components/SearchResults.jsx` (line 207)

**Status**: ✅ **RESOLVED** - Search functionality now works without TypeErrors

---

### 2. Lambda Summary Service - 405 Method Not Allowed

**Problem**: 
- "405 Method Not Allowed" error when generating summaries
- Frontend making GET requests to `/api/lambda/summary` endpoint
- Backend expecting POST requests

**Root Cause**:
- HTTP method mismatch between frontend and backend
- Backend API defined POST endpoint at `/api/lambda/summary`
- Frontend `useSummary.js` was making GET requests with query parameters

**Solution**:
1. **Frontend Fix** - Updated `frontend/src/hooks/useSummary.js`:
   ```javascript
   // Changed from GET to POST
   const response = await fetch(`${API_BASE_URL}/api/lambda/summary`, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/x-www-form-urlencoded',
     },
     body: new URLSearchParams({
       title: title,
       description: description
     })
   });
   ```

2. **Backend Fix** - Updated `backend/api.py`:
   ```python
   # Added Form import
   from fastapi import FastAPI, HTTPException, Query, Form
   
   # Updated endpoint to handle form data
   async def generate_lambda_summary(
       title: str = Form(...),
       description: str = Form(...)
   ):
   ```

3. **Dependency Installation**:
   ```bash
   pip3 install python-multipart
   ```
   - Required for FastAPI to handle form data

**Files Modified**:
- `frontend/src/hooks/useSummary.js`
- `backend/api.py`

**Status**: ✅ **RESOLVED** - HTTP method mismatch fixed, endpoint accessible

---

### 3. Lambda Service Response Parsing Issue

**Problem**: 
- Lambda service returning placeholder text "Summary generated via Lambda"
- Real AI-generated summaries not being displayed
- Response parsing logic not handling Lambda function response structure

**Root Cause**:
Lambda function returns responses in this structure:
```json
{
  "statusCode": 200,
  "headers": {...},
  "body": "{\"model_response\":\"[ACTUAL AI SUMMARY HERE]\"}"
}
```

The parsing logic was looking for direct keys like `summary` or `response`, falling back to placeholder text when not found.

**Solution**:
Updated `backend/services/lambda_service.py` in the `generate_summary` method:
```python
# Handle Lambda response structure: {statusCode, headers, body}
if 'body' in response:
    try:
        body = json.loads(response['body']) if isinstance(response['body'], str) else response['body']
        if 'model_response' in body:
            return body['model_response']
    except json.JSONDecodeError:
        logger.error(f"Failed to parse Lambda response body: {response['body']}")

# Fallback to other response formats
if 'summary' in response:
    return response['summary']
elif 'response' in response:
    return response['response']
elif isinstance(response, str):
    return response
else:
    logger.warning(f"Unexpected summary response format: {response}")
    return "Summary generated via Lambda"
```

**Files Modified**:
- `backend/services/lambda_service.py`

**Status**: ✅ **RESOLVED** - Real AI-generated summaries now displayed

---

## Testing Results

### Before Fixes:
- ❌ Search functionality crashed with TypeError
- ❌ Lambda summary returned "405 Method Not Allowed"
- ❌ AI summaries showed placeholder text only

### After Fixes:
- ✅ Search functionality works without errors
- ✅ Lambda summary endpoint responds correctly
- ✅ Real AI-generated summaries displayed
- ✅ No more console errors or warnings

### Test Commands Used:
```bash
# Test Lambda summary endpoint
curl -X POST "http://localhost:8000/api/lambda/summary" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "title=Test Article&description=This is a test article about global conflicts and their impact on international relations."

# Response: {"summary":"Summary: This test article examines global conflicts and their effects on international relations.","service":"lambda_graphql"}
```

---

## Technical Architecture

### Lambda Service Integration:
- **GraphQL Endpoint**: AWS AppSync at `https://tclg7e6uuna75pyob6pzxqrpua.appsync-api.ap-northeast-1.amazonaws.com/graphql`
- **Authentication**: API Key based
- **Flow**: Frontend → FastAPI → GraphQL → Lambda → AI Model → Response Chain

### Services Status:
- ✅ **Frontend**: React + Vite development server running on `http://localhost:5173`
- ✅ **Backend**: FastAPI server running on `http://localhost:8000`
- ✅ **Lambda Service**: Connected via GraphQL, generating real AI summaries
- ✅ **NER/Geo Tools**: Location data enhancement working
- ✅ **Search**: Article search and filtering functional

---

## Dependencies Added:
- `python-multipart`: Required for FastAPI form data handling

## Key Learnings:
1. Always check data structure before calling array methods like `.map()`
2. HTTP method consistency between frontend and backend is critical
3. Lambda function responses need proper parsing for nested JSON structures
4. FastAPI requires `python-multipart` for form data handling
5. Server restart may be needed after installing new Python packages

---

### 3. WorldMap Geographic Mapping - Missing Country Detection

**Problem**: 
- Articles about Gaza, Sudan, Myanmar, and other regions were not appearing on the world map
- Backend geographic analysis was failing to detect countries for many articles
- Only Ukraine, China, and Turkey were being mapped correctly
- Articles were being categorized as "Unknown" locations

**Root Cause**:
- Backend `detected_locations.countries` and `geographic_analysis.primary_countries` fields were empty for many articles
- The existing country detection relied solely on backend analysis which was incomplete
- Missing country coordinates in `COUNTRY_COORDINATES` object for some regions

**Solution**:
1. **Implemented Geocoding Service** - Created `frontend/src/utils/geocoding.js`:
   ```javascript
   // Smart location extraction from article titles
   export function extractLocationFromTitle(title) {
     const locationPatterns = [
       /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:crisis|war|conflict|attack|violence)/i,
       /\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
       /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:government|military|forces)/i
     ];
     // Returns extracted location names
   }

   // OpenStreetMap Nominatim API integration
   export async function geocodeLocation(locationName) {
     const response = await fetch(
       `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}&limit=1`
     );
     // Returns coordinates {lat, lng} or null
   }
   ```

2. **Updated WorldMap Component** - Modified `frontend/src/components/WorldMap.jsx`:
   ```javascript
   // New geocoding-based article processing
   useEffect(() => {
     const geocodeArticles = async () => {
       setIsGeocoding(true);
       const geocoded = [];
       
       for (const article of articles) {
         await delay(100); // Rate limiting for API calls
         const result = await geocodeArticle(article);
         geocoded.push(result);
       }
       
       setGeocodedArticles(geocoded);
       setIsGeocoding(false);
     };
     
     if (articles.length > 0) {
       geocodeArticles();
     }
   }, [articles]);
   ```

3. **Fallback System**:
   - Primary: Geocoding API for precise location detection
   - Secondary: Original backend analysis (`geographic_analysis.primary_countries`)
   - Tertiary: Country-level coordinates from `COUNTRY_COORDINATES`

4. **Visual Indicators**:
   - **Color Coding**: Based on article coverage density (not geocoding status)
     - 🔵 Blue: Low coverage (1-5 articles)
     - 🟠 Orange: Medium coverage (6-10 articles) 
     - 🔴 Red: High coverage (10+ articles)
   - **Info Windows**: Show geocoding status as additional information

**Files Modified**:
- `frontend/src/utils/geocoding.js` (new file)
- `frontend/src/components/WorldMap.jsx` (major refactor)

**Results**:
- ✅ Gaza articles now mapped to Palestine coordinates
- ✅ Sudan articles now mapped to Sudan coordinates  
- ✅ Myanmar, Armenia-Azerbaijan, Mali articles now properly located
- ✅ Maintained original color scheme based on coverage density
- ✅ Added fallback system for robust location detection
- ✅ Rate-limited API calls to respect OpenStreetMap usage policies

**Status**: ✅ **RESOLVED** - Geographic mapping now works for all article locations

---

### 4. WorldMap Marker Labels - Missing Article Count Display

**Problem**: 
- After implementing geocoding and fixing marker colors, the article count labels disappeared from map markers
- Users could not see how many articles were associated with each location without clicking on markers
- Both Google Maps and fallback map components were affected

**Root Cause**:
- Google Maps markers were created without the `label` property
- Fallback map component only showed labels on hover, not permanently

**Solution**:
1. **Google Maps Component** - Added permanent labels to markers:
   ```javascript
   const marker = new window.google.maps.Marker({
     // ... other properties
     label: {
       text: `${articleCount}`,
       color: 'white',
       fontWeight: 'bold',
       fontSize: '12px'
     }
   });
   ```

2. **Fallback Map Component** - Added permanent SVG text labels:
   ```javascript
   {/* Permanent article count label */}
   <text
     x={x}
     y={y + 4}
     textAnchor="middle"
     fill="white"
     fontSize="10"
     fontWeight="bold"
     style={{ pointerEvents: 'none' }}
   >
     {data.count}
   </text>
   ```

**Files Modified**:
- `frontend/src/components/WorldMap.jsx` (marker label additions)

**Results**:
- ✅ Article counts now visible on all map markers
- ✅ White text labels clearly readable against colored markers
- ✅ Consistent labeling between Google Maps and fallback components
- ✅ Maintained hover tooltips for additional information

**Status**: ✅ **RESOLVED** - Map markers now display article counts prominently

---

### 5. Prediction Display - Content Not Showing Despite Successful Generation

**Problem**: 
- Prediction functionality showed "Prediction generated successfully" message
- No actual prediction content was displayed in the PredictionDisplay component
- Only generic "AI Impact Prediction" header with confidence, timeline, and action buttons were visible
- Backend logs showed successful Lambda prediction requests (200 OK status)

**Root Cause**:
- Lambda service was returning detailed impact analysis content with escaped characters (`\\\\n`)
- The escaped newlines and other characters were not being processed properly
- Frontend PredictionDisplay component wasn't handling line breaks correctly
- Content contained detailed analysis but appeared as unformatted text blocks

**Investigation Process**:
1. **Backend API Response Check**: Confirmed Lambda service was returning structured data with `impact_analysis` field
2. **Frontend Processing Check**: Verified `usePrediction.js` was mapping `impact_analysis` to `content` correctly
3. **Lambda Service Debug**: Added logging to inspect actual response structure
4. **Content Format Analysis**: Discovered escaped characters (`\\\\n`, `\\\\t`, `\\"`) in response

**Solution**:
1. **Backend Content Processing** - Updated `backend/services/lambda_service.py`:
   ```python
   # Clean up escaped characters in impact analysis
   if isinstance(response, dict):
       impact_text = response.get('impact_analysis', response.get('response', str(response)))
       if isinstance(impact_text, str):
           # Clean up escaped newlines and other escape sequences
           impact_text = impact_text.replace('\\\\n', '\n').replace('\\n', '\n')
           impact_text = impact_text.replace('\\\\t', '\t').replace('\\t', '\t')
           impact_text = impact_text.replace('\\"', '"').replace("\\'", "'")
       
       structured_response = {
           'impact_analysis': impact_text,
           'confidence_score': response.get('confidence_score', 0.8),
           'timeline': response.get('timeline', 'Short to medium term'),
           'categories': response.get('categories', ['general'])
       }
   ```

2. **Frontend Display Enhancement** - Updated `frontend/src/components/PredictionDisplay.jsx`:
   ```javascript
   // Added proper text formatting for line breaks
   <div className="summary-text" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
     {prediction.content}
   </div>
   ```

**Files Modified**:
- `backend/services/lambda_service.py` (content processing logic)
- `frontend/src/components/PredictionDisplay.jsx` (text formatting)

**Results**:
- ✅ Prediction content now displays properly with formatted sections
- ✅ Content includes detailed analysis with:
  - Societal Impact
  - Economic Implications  
  - Political Ramifications
  - Timeline of Effects
- ✅ Proper line breaks and formatting preserved
- ✅ No more generic placeholder text
- ✅ Full Lambda-generated impact analysis visible to users

**Test Results**:
```bash
# Test prediction endpoint
curl -X POST http://localhost:8000/api/lambda/predictions \
  -H "Content-Type: application/json" \
  -d '{"title": "Climate Change Impact", "description": "New study reveals accelerating ice melt in Antarctica", "url": "http://test.com"}'

# Response includes detailed formatted analysis with proper newlines
```

**Status**: ✅ **RESOLVED** - Prediction functionality now displays complete AI-generated impact analysis

---

## Next Steps:
- All critical bugs resolved
- Application ready for Phase 2 development
- Lambda AI integration fully functional
- Search, summary, and prediction features working as expected
- Geographic mapping enhanced with geocoding service

---

## Recent Updates (UI & Map Stability)

### 6. Home Page Actions – Alignment, Colors, and Hover States

**Problem**:
- Action buttons ("View sources", "Summarize", "Predict") lacked clear alignment and consistent visual hierarchy.
- "Predict" hover state was indistinguishable on a pure black base.
- Border radius styling was inconsistent across action variants.

**Solution**:
- Aligned actions into a single row with left/right grouping:
  - "View sources" stays on the left.
  - "Summarize" and "Predict" are right-aligned as primary actions.
- Standardized colors and shapes:
  - "Summarize": grey button (`.btn-summarize` uses `var(--bg-tertiary)`) with rounded pill shape.
  - "Predict": black button (`.btn-predict` uses `var(--text-primary)`) with white text and rounded pill shape.
  - "View sources": link-style button (`.btn-link`) now has matching rounded pill border radius.
- Added a distinct hover effect for "Predict": invert to white background, black text, and black border.
- Increased topic title font size and spacing to improve readability and rhythm.

**Files Modified**:
- `frontend/src/components/Home.jsx`
  - Grouped actions into a flex row with `margin-left: auto` to right-align "Summarize"/"Predict".
  - Increased topic title font size (`1.25rem`) and bottom margin (`1rem`).
  - Added extra top margin (`1rem`) to the actions row.
- `frontend/src/index.css`
  - `.btn-summarize`: grey background, pill radius, consistent hover.
  - `.btn-predict`: black background, white text; hover inverts to white background/black text.
  - `.btn-link`: added pill-shaped `border-radius: 9999px` for visual consistency.

**Results**:
- ✅ Clear separation: source exploration on the left; AI actions on the right.
- ✅ Stronger visual hierarchy and more accessible hover feedback.
- ✅ Consistent rounded shapes across all action variants.
- ✅ Improved title readability and spacing for each topic card.

**Status**: ✅ RESOLVED – Actions aligned, styles standardized, hover states improved.

---

### 7. WorldMap Stability – Guard Against Invalid Marker Coordinates

**Problem**:
- Google Maps occasionally threw `InvalidValueError: setPosition` when marker coordinates included strings or non-finite values.

**Root Cause**:
- Some upstream data (including geocoding results) returned coordinates as strings or contained invalid numbers, which were passed directly to marker creation.

**Solution**:
- Defensive validation in both geocoding and map rendering layers:
  1. `frontend/src/utils/geocoding.js` – `geocodeLocation` now parses `lat`/`lng` to numbers and returns `null` if values are not finite.
  2. `frontend/src/components/WorldMap.jsx` – converts incoming `lat`/`lng` to numbers and skips marker creation when either is non-finite.

**Files Modified**:
- `frontend/src/utils/geocoding.js`
- `frontend/src/components/WorldMap.jsx`

**Results**:
- ✅ No `InvalidValueError: setPosition` during map rendering.
- ✅ Robustness against mixed or malformed coordinate input without UI regressions.

**Status**: ✅ RESOLVED – Map stability improved via coordinate guards.

---

## Latest Updates (2025-10-09)
- Restored direct Amplify AppSync configuration in the frontend; removed Vite env usage for AppSync.
- Added root `.gitignore` and sanitized `.env.example` files (root).
- Improved Google News matching by shortening topic titles and adding location hints.
- Unified source link builder across Home and Map; kept daily window.
- Removed article list below the map per request.
