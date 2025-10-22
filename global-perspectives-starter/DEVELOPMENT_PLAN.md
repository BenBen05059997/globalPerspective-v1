# Global Perspectives News Aggregator - Development Plan

## Project Overview

**Global Perspectives** is an AI-agent-driven news aggregator that provides today-only news coverage with a unique perspective-based approach. The system fetches real-time news, processes and classifies articles as "local" vs "foreign" based on publisher country vs story origin country, and presents comparative viewpoints on the same events.

### Key Features
- **Today-only focus**: Current day news only
- **Perspective-based grouping**: Local vs international coverage comparison
- **Multi-language support**: Built-in language parameter support
- **Geographic classification**: Story origin country identification
- **AI-powered processing**: Ready for LLM integration
- **Deduplication**: Fuzzy matching to remove similar articles

### Current Tech Stack
- **Backend**: FastAPI + Pydantic
- **Agent**: Simple orchestrator coordinating news processing pipeline
- **Tools**: Modular tools (fetch, normalize, classify, summarize, present)
- **AI/ML**: Meta LLaMA (via AWS Bedrock) for intelligent summarization and analysis
- **Dependencies**: httpx, spaCy, geopy, rapidfuzz, boto3 (for AWS Bedrock integration)

---

## Development Stages

### 🚀 Stage 1: Project Setup & Environment
**Priority**: High | **Status**: Pending

**Goal**: Establish solid development foundation and verify baseline functionality

#### Tasks:
- [ ] Set up Python virtual environment
- [ ] Install dependencies from requirements.txt
- [ ] Create `.env` file with API keys
  - NewsAPI key for real news data
  - Google Geocoding key (optional)
  - AWS Bedrock configuration (for Stage 5)

### Environment Configuration
```env
NEWSAPI_KEY=your_newsapi_key_here
GOOGLE_GEOCODING_KEY=your_google_geocoding_key_here
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=meta.llama3-2-8b-instruct-v1:0
BEDROCK_MAX_TOKENS=4096
```
- [ ] Test backend API endpoints
- [ ] Verify mock data functionality works
- [ ] Run existing test suite
- [ ] Document setup process

#### Acceptance Criteria:
- Backend API responds to `/healthz` and `/api/search` endpoints
- Mock data returns when no API keys provided
- All tests pass successfully

---

### 🎨 Stage 2: Frontend Foundation
**Priority**: High | **Status**: Pending

**Goal**: Create modern React frontend that consumes the backend API

#### Tasks:
- [ ] Initialize React + Vite project in frontend directory
- [ ] Set up project structure and routing (React Router)
- [ ] Configure build tools and development server
- [ ] Install and configure styling framework (Tailwind CSS)
- [ ] Create basic layout components
  - Header with branding
  - Search bar component
  - Main content area
  - Footer
- [ ] Implement API client for backend communication
- [ ] Create responsive grid system
- [ ] Add basic error boundaries

#### Acceptance Criteria:
- Frontend development server runs successfully
- Basic routing works between pages
- API integration established
- Responsive layout adapts to different screen sizes

---

### 📱 Stage 3: Core UI Components
**Priority**: High | **Status**: Pending

**Goal**: Build essential user interface components for news consumption

#### Tasks:
- [ ] **Search Interface**
  - Real-time search input with debouncing
  - Query suggestions and autocomplete
  - Language selection dropdown
  - Search history
- [ ] **Article Cards**
  - Clean, readable article display
  - Source information and credibility indicators
  - Publication timestamp
  - Summary phrases display
  - Click-through to original articles
- [ ] **Perspective Comparison View**
  - Side-by-side local vs foreign coverage
  - Country flags and source indicators
  - Expandable/collapsible sections
- [ ] **Country Grouping Display**
  - Organized tabs or sections by origin country
  - Article count indicators
  - Filtering and sorting options
- [ ] **Loading States & Skeletons**
  - Skeleton screens during data loading
  - Progress indicators for long operations
  - Smooth transitions
- [ ] **Error Handling UI**
  - User-friendly error messages
  - Retry mechanisms
  - Fallback content

#### Acceptance Criteria:
- Users can search for news topics effectively
- Articles display clearly with all relevant information
- Perspective comparison is intuitive and informative
- Loading and error states provide good user experience

---

### 📊 Stage 4: Data Enhancement
**Priority**: Medium | **Status**: Pending

**Goal**: Improve data quality, classification accuracy, and content richness

#### Tasks:
- [ ] **Expand Publisher-Country Mapping**
  - Create comprehensive CSV/JSON database
  - Include major international news sources
  - Add source credibility scoring
  - Implement easy update mechanism
- [ ] **Enhance Country Detection**
  - Improve regex patterns for location detection
  - Add city-to-country mapping
  - Handle multiple countries in single article
  - Add confidence scoring
- [ ] **Google Geocoding Integration**
  - Implement real geocoding for location extraction
  - Cache geocoding results to reduce API calls
  - Handle rate limiting gracefully
  - Add coordinate data for mapping
- [ ] **Trending Topics Detection**
  - Analyze article frequency and clustering
  - Implement trending algorithm
  - Create `/api/topics/trending` endpoint
  - Add time-based trending analysis
- [ ] **Advanced Deduplication**
  - Improve fuzzy matching algorithms
  - Add image similarity detection
  - Handle different languages of same story
  - Preserve best version of duplicate articles

#### Acceptance Criteria:
- Classification accuracy significantly improved
- Geographic data enriches articles with location context
- Trending topics accurately reflect current news patterns
- Duplicate detection reduces noise in results

---

### 🤖 Stage 5: AWS Bedrock AI Integration
**Priority**: Medium | **Status**: Pending

**Goal**: Replace basic text processing with AWS Bedrock-powered Meta LLaMA intelligent features

#### Tasks:
- [ ] **AWS Bedrock Setup & Configuration**
  - Configure AWS Bedrock credentials and IAM permissions
  - Set up Meta LLaMA 3.2 or LLaMA 3.1 model access via Bedrock
  - Configure environment variables for AWS Bedrock endpoints
  - Implement connection pooling and request management
  - Set up cost monitoring and usage limits
  - Add graceful fallback to extractive summarization
- [ ] **LLaMA-Powered Summarization via AWS Bedrock**
  - Replace extractive phrases with Meta LLaMA intelligent summaries
  - Design prompts for consistent, concise news summarization
  - Implement summary length control (50-150 words)
  - Add quality validation and retry mechanisms
  - Maintain extractive fallback for reliability
  - Optimize prompt engineering for news summarization
- [ ] **LLaMA Sentiment Analysis via AWS Bedrock**
  - Leverage LLaMA's natural language understanding for sentiment detection
  - Implement multi-dimensional sentiment analysis (tone, emotion, bias)
  - Create sentiment comparison across different news sources
  - Add sentiment trend tracking over time
  - Visualize sentiment differences in frontend
  - Batch processing for cost optimization
- [ ] **LLaMA Topic Clustering & Classification via AWS Bedrock**
  - Use LLaMA's semantic understanding for intelligent topic grouping
  - Implement hierarchical topic classification
  - Create dynamic topic discovery from article content
  - Enable semantic similarity-based article clustering
  - Add topic-based navigation and filtering
  - Efficient embedding generation and caching
- [ ] **LLaMA Bias Detection & Analysis via AWS Bedrock**
  - Utilize LLaMA's reasoning capabilities for editorial bias detection
  - Identify loaded language and framing differences
  - Compare perspective framing across international sources
  - Generate bias indicators and confidence scores
  - Provide explanations for detected bias patterns
  - Structured bias reporting with confidence scores
- [ ] **LLaMA Comparative Perspective Analysis via AWS Bedrock**
  - Generate intelligent insights on coverage differences
  - Identify unique angles and missing perspectives
  - Create automated perspective summaries
  - Highlight coverage gaps between local and foreign sources
  - Generate comparative analysis reports
  - Cross-article relationship mapping

#### Technical Implementation:
- [ ] **AWS Bedrock Service Layer**
  - Create `backend/services/bedrock_service.py` for Bedrock integration
  - Implement async request handling for better performance
  - Add request queuing and rate limiting
  - Create prompt templates for different AI tasks
  - Cost optimization with request batching and caching
- [ ] **Enhanced API Endpoints**
  - Extend `/api/search` with LLaMA-powered features
  - Add `/api/analysis/sentiment` for sentiment analysis
  - Create `/api/analysis/bias` for bias detection
  - Implement `/api/topics/semantic` for LLaMA topic clustering
- [ ] **Frontend Integration**
  - Add sentiment visualization components
  - Create bias indicator displays
  - Implement topic clustering views
  - Add comparative analysis dashboard

#### Acceptance Criteria:
- LLaMA integration provides coherent and informative summaries
- Sentiment analysis delivers meaningful insights with confidence scores
- Topic clustering improves content organization using semantic similarity
- Bias detection helps users understand different editorial perspectives
- Comparative analysis generates valuable insights on coverage differences
- System maintains reliability with proper fallback mechanisms
- Cost optimization ensures sustainable AWS Bedrock usage

---

### 🌍 Stage 6: Advanced Features
**Priority**: Medium | **Status**: Pending

**Goal**: Add sophisticated interactive features for enhanced user experience

#### Tasks:
- [ ] **Interactive World Map**
  - Display story origins with markers
  - Show coverage density by region
  - Interactive country selection
  - Zoom and pan functionality
  - Integration with article filtering
- [ ] **Real-time Updates**
  - WebSocket integration for live news feeds
  - Push notifications for breaking news
  - Auto-refresh mechanisms
  - Real-time article counters
- [ ] **Personalization System**
  - User preference settings
  - Reading history tracking
  - Personalized recommendations
  - Custom topic following
  - Saved searches
- [ ] **Export Functionality**
  - PDF report generation
  - CSV data export
  - Email digest creation
  - Print-friendly formats
  - API data export
- [ ] **Social Features**
  - Share interesting perspective comparisons
  - Social media integration
  - Comment system (optional)
  - Article rating system
- [ ] **Bookmarking System**
  - Save articles for later reading
  - Organize bookmarks by topics
  - Export bookmark collections
  - Bookmark sharing

#### Acceptance Criteria:
- Map provides intuitive geographic context
- Real-time features keep content fresh
- Personalization improves user engagement
- Export features support research and sharing needs

---

### ⚡ Stage 7: Performance & Scalability
**Priority**: Low | **Status**: Pending

**Goal**: Optimize for production use and handle increased scale

#### Tasks:
- [ ] **Redis Caching Implementation**
  - Cache API responses
  - Cache processed article data
  - Implement cache invalidation strategies
  - Add cache warming mechanisms
- [ ] **Background Job Processing**
  - Set up Celery for async tasks
  - Move heavy processing to background
  - Implement job queues and workers
  - Add job monitoring and retry logic
- [ ] **Database Persistence**
  - Set up PostgreSQL for historical data
  - Design efficient database schema
  - Implement data archiving strategies
  - Add database migrations
- [ ] **Rate Limiting & API Management**
  - Implement rate limiting for external APIs
  - Add API key management system
  - Monitor API usage and costs
  - Implement graceful degradation
- [ ] **CDN & Static Asset Optimization**
  - Set up CDN for frontend assets
  - Optimize images and static files
  - Implement asset versioning
  - Add compression and minification
- [ ] **Monitoring & Logging**
  - Set up application monitoring
  - Implement structured logging
  - Add performance metrics
  - Create alerting systems

#### Acceptance Criteria:
- Application handles increased traffic gracefully
- Response times remain fast under load
- System reliability and uptime improved
- Monitoring provides actionable insights

---

### ✨ Stage 8: Polish & Production
**Priority**: Low | **Status**: Pending

**Goal**: Production-ready deployment with excellent user experience

#### Tasks:
- [ ] **Comprehensive Error Handling**
  - Graceful error recovery
  - User-friendly error messages
  - Error reporting and tracking
  - Fallback mechanisms
- [ ] **Theme System**
  - Dark/light theme toggle
  - Theme persistence
  - Smooth theme transitions
  - Accessibility compliance
- [ ] **Mobile Optimization**
  - Touch-friendly interfaces
  - Mobile-specific layouts
  - Gesture support
  - Performance optimization for mobile
- [ ] **Accessibility Features**
  - ARIA labels and roles
  - Keyboard navigation support
  - Screen reader compatibility
  - Color contrast compliance
  - Focus management
- [ ] **Deployment & DevOps**
  - Docker containerization
  - CI/CD pipeline setup
  - Environment configuration
  - Health checks and monitoring
  - Backup and recovery procedures
- [ ] **Analytics & Tracking**
  - User behavior analytics
  - Performance tracking
  - A/B testing framework
  - Conversion funnel analysis
- [ ] **Documentation**
  - API documentation
  - User guides
  - Developer documentation
  - Deployment guides

#### Acceptance Criteria:
- Application meets production quality standards
- Excellent user experience across all devices
- Comprehensive documentation available
- Deployment process is automated and reliable

---

## Success Metrics

### Technical Metrics
- **API Response Time**: < 500ms for search queries
- **Frontend Load Time**: < 2 seconds initial load
- **Test Coverage**: > 80% code coverage
- **Uptime**: > 99.5% availability

### User Experience Metrics
- **Search Accuracy**: Users find relevant articles > 90% of the time
- **Perspective Value**: Users report finding perspective comparison valuable
- **Engagement**: Average session duration > 5 minutes
- **Return Rate**: > 40% of users return within a week

### Content Quality Metrics
- **Classification Accuracy**: > 85% correct local/foreign classification
- **Deduplication Effectiveness**: < 5% duplicate articles in results
- **Summary Quality**: Summaries rated as helpful by users
- **Coverage Completeness**: Major stories covered from multiple perspectives

---

## Risk Mitigation

### Technical Risks
- **API Rate Limits**: Implement caching and fallback mechanisms
- **Data Quality**: Multiple validation layers and manual review processes
- **Performance**: Load testing and optimization at each stage
- **Security**: Regular security audits and best practices

### Business Risks
- **API Costs**: Monitor usage and implement cost controls
- **Content Accuracy**: Clear disclaimers and source attribution
- **User Adoption**: Regular user feedback and iterative improvements
- **Competition**: Focus on unique perspective-based value proposition

---

## Timeline Estimate

- **Stage 1-3** (Foundation): 2-3 weeks
- **Stage 4** (Data Enhancement): 2-3 weeks
- **Stage 5** (AWS Bedrock AI Integration): 3-4 weeks
- **Stage 6** (Advanced Features): 2-3 weeks
- **Stage 7-8** (Production): 2-3 weeks

**Total Estimated Timeline**: 11-16 weeks

### Stage 5 Detailed Timeline:
- **Week 1**: AWS Bedrock setup, configuration, and basic summarization
- **Week 2**: Sentiment analysis and topic clustering implementation
- **Week 3**: Bias detection and comparative analysis features
- **Week 4**: Frontend integration, cost optimization, and comprehensive testing

---

## Next Steps

1. **Immediate**: Begin Stage 1 - Project Setup & Environment
2. **Week 1**: Complete backend verification and start frontend foundation
3. **Week 2**: Build core UI components and basic functionality
4. **Week 3**: Enhance data quality and add AI features
5. **Monthly Reviews**: Assess progress and adjust priorities based on feedback

---

*Last Updated: [Current Date]*
*Project Lead: [Your Name]*
*Status: Planning Phase*