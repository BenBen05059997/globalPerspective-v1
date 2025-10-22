
import spacy
import json
import re
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LocationDetector:
    def __init__(self):
        self.nlp = None
        self.cities_data = {}
        self.countries_data = {}
        self.location_patterns = {}
        self.region_mapping = {}
        self._load_data()
        self._load_spacy_model()
    
    def _load_data(self):
        """Load cities and countries data from JSON files"""
        try:
            # Load cities data
            cities_path = Path(__file__).parent.parent / "data" / "cities.json"
            with open(cities_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.cities_data = data.get("cities", {})
                self.location_patterns = data.get("location_patterns", {})
                self.region_mapping = data.get("region_mapping", {})
            
            # Load countries data
            countries_path = Path(__file__).parent.parent / "data" / "countries.json"
            with open(countries_path, 'r', encoding='utf-8') as f:
                countries_json = json.load(f)
                self.countries_data = countries_json.get("countries", {})
            
            logger.info(f"Loaded {len(self.cities_data)} cities and {len(self.countries_data)} countries")
        except Exception as e:
            logger.error(f"Error loading location data: {e}")
            self.cities_data = {}
            self.countries_data = {}
    
    def _load_spacy_model(self):
        """Load spaCy model for NER"""
        try:
            # Try to load the English model
            self.nlp = spacy.load("en_core_web_sm")
            logger.info("Loaded spaCy English model successfully")
        except OSError:
            logger.warning("spaCy English model not found. Install with: python -m spacy download en_core_web_sm")
            self.nlp = None
    
    def extract_locations_from_text(self, text: str) -> Dict[str, List[Dict]]:
        """Extract locations from text using multiple methods"""
        locations = {
            "cities": [],
            "countries": [],
            "regions": [],
            "coordinates": []
        }
        
        if not text:
            return locations
        
        # Method 1: spaCy NER
        if self.nlp:
            locations.update(self._extract_with_spacy(text))
        
        # Method 2: Pattern matching
        pattern_locations = self._extract_with_patterns(text)
        for key in locations:
            locations[key].extend(pattern_locations.get(key, []))
        
        # Method 3: City/Country name matching
        name_locations = self._extract_with_name_matching(text)
        for key in locations:
            locations[key].extend(name_locations.get(key, []))
        
        # Remove duplicates and sort by confidence
        for key in locations:
            locations[key] = self._deduplicate_locations(locations[key])
        
        return locations
    
    def _extract_with_spacy(self, text: str) -> Dict[str, List[Dict]]:
        """Extract locations using spaCy NER"""
        locations = {"cities": [], "countries": [], "regions": [], "coordinates": []}
        
        try:
            doc = self.nlp(text)
            for ent in doc.ents:
                if ent.label_ in ["GPE", "LOC"]:  # Geopolitical entity or location
                    location_info = self._classify_location(ent.text)
                    if location_info:
                        location_type = location_info["type"]
                        if location_type in locations:
                            locations[location_type].append({
                                "name": ent.text,
                                "confidence": 0.8,
                                "method": "spacy_ner",
                                "start": ent.start_char,
                                "end": ent.end_char,
                                **location_info
                            })
        except Exception as e:
            logger.error(f"Error in spaCy NER: {e}")
        
        return locations
    
    def _extract_with_patterns(self, text: str) -> Dict[str, List[Dict]]:
        """Extract locations using pattern matching"""
        locations = {"cities": [], "countries": [], "regions": [], "coordinates": []}
        
        # Country patterns
        country_patterns = self.location_patterns.get("country_indicators", [])
        for country_code, country_info in self.countries_data.items():
            country_name = country_info.get("name", "")
            for pattern in country_patterns:
                pattern_regex = pattern.replace("{country}", re.escape(country_name))
                matches = re.finditer(pattern_regex, text, re.IGNORECASE)
                for match in matches:
                    locations["countries"].append({
                        "name": country_name,
                        "code": country_code,
                        "confidence": 0.7,
                        "method": "pattern_matching",
                        "start": match.start(),
                        "end": match.end(),
                        "type": "countries",
                        **country_info
                    })
        
        # City patterns
        city_patterns = self.location_patterns.get("city_indicators", [])
        for city_name, city_info in self.cities_data.items():
            for pattern in city_patterns:
                pattern_regex = pattern.replace("{city}", re.escape(city_name))
                matches = re.finditer(pattern_regex, text, re.IGNORECASE)
                for match in matches:
                    country_info = self.countries_data.get(city_info["country"], {})
                    locations["cities"].append({
                        "name": city_name,
                        "confidence": 0.7,
                        "method": "pattern_matching",
                        "start": match.start(),
                        "end": match.end(),
                        "type": "cities",
                        "country_code": city_info["country"],
                        "country_name": country_info.get("name", ""),
                        **city_info
                    })
        
        return locations
    
    def _extract_with_name_matching(self, text: str) -> Dict[str, List[Dict]]:
        """Extract locations by direct name matching"""
        locations = {"cities": [], "countries": [], "regions": [], "coordinates": []}
        
        # Match country names
        for country_code, country_info in self.countries_data.items():
            country_name = country_info.get("name", "")
            if country_name and len(country_name) > 3:  # Avoid short matches
                pattern = r'\b' + re.escape(country_name) + r'\b'
                matches = re.finditer(pattern, text, re.IGNORECASE)
                for match in matches:
                    locations["countries"].append({
                        "name": country_name,
                        "code": country_code,
                        "confidence": 0.6,
                        "method": "name_matching",
                        "start": match.start(),
                        "end": match.end(),
                        "type": "countries",
                        **country_info
                    })
        
        # Match city names
        for city_name, city_info in self.cities_data.items():
            if len(city_name) > 4:  # Avoid short city names that might be common words
                pattern = r'\b' + re.escape(city_name) + r'\b'
                matches = re.finditer(pattern, text, re.IGNORECASE)
                for match in matches:
                    country_info = self.countries_data.get(city_info["country"], {})
                    locations["cities"].append({
                        "name": city_name,
                        "confidence": 0.6,
                        "method": "name_matching",
                        "start": match.start(),
                        "end": match.end(),
                        "type": "cities",
                        "country_code": city_info["country"],
                        "country_name": country_info.get("name", ""),
                        **city_info
                    })
        
        return locations
    
    def _classify_location(self, location_name: str) -> Optional[Dict]:
        """Classify a location as city, country, or region"""
        logger.debug(f"Classifying location: '{location_name}'")
        
        # Check if it's a known city
        if location_name in self.cities_data:
            city_info = self.cities_data[location_name]
            country_info = self.countries_data.get(city_info["country"], {})
            logger.debug(f"Found city: {location_name} -> {city_info['country']} -> {country_info.get('name', '')}")
            return {
                "type": "cities",
                "country_code": city_info["country"],
                "country_name": country_info.get("name", ""),
                **city_info
            }
        
        # Check if it's a known country
        for country_code, country_info in self.countries_data.items():
            if country_info.get("name", "").lower() == location_name.lower():
                logger.debug(f"Found country: {location_name} -> {country_code}")
                return {
                    "type": "countries",
                    "code": country_code,
                    **country_info
                }
        
        # Check if it's a region
        for region, countries in self.region_mapping.items():
            if region.lower() == location_name.lower():
                logger.debug(f"Found region: {location_name} -> {region}")
                return {
                    "type": "regions",
                    "region": region,
                    "countries": countries
                }
        
        logger.debug(f"Location not classified: '{location_name}'")
        return None
    
    def _deduplicate_locations(self, locations: List[Dict]) -> List[Dict]:
        """Remove duplicate locations and sort by confidence"""
        seen = set()
        unique_locations = []
        
        # Sort by confidence (highest first)
        locations.sort(key=lambda x: x.get("confidence", 0), reverse=True)
        
        for location in locations:
            # Create a unique key based on name and type
            key = (location.get("name", "").lower(), location.get("type", ""))
            if key not in seen:
                seen.add(key)
                unique_locations.append(location)
        
        return unique_locations
    
    def analyze_geographic_focus(self, locations: Dict[str, List[Dict]]) -> Dict[str, Any]:
        """Analyze the geographic focus of detected locations"""
        analysis = {
            "primary_countries": [],
            "primary_regions": [],
            "geographic_scope": "unknown",
            "location_diversity": 0,
            "confidence_score": 0
        }
        
        all_countries = set()
        all_regions = set()
        total_confidence = 0
        location_count = 0
        
        # Collect countries from cities and direct country mentions
        for city in locations.get("cities", []):
            if city.get("country_code"):
                all_countries.add(city["country_code"])
                total_confidence += city.get("confidence", 0)
                location_count += 1
        
        for country in locations.get("countries", []):
            if country.get("code"):
                all_countries.add(country["code"])
                total_confidence += country.get("confidence", 0)
                location_count += 1
        
        # Determine regions
        for country_code in all_countries:
            for region, countries in self.region_mapping.items():
                if country_code in countries:
                    all_regions.add(region)
        
        # Calculate metrics
        analysis["location_diversity"] = len(all_countries)
        analysis["confidence_score"] = total_confidence / max(location_count, 1)
        
        # Determine geographic scope
        if len(all_regions) == 0:
            analysis["geographic_scope"] = "unknown"
        elif len(all_regions) == 1:
            analysis["geographic_scope"] = "regional"
        elif len(all_regions) <= 3:
            analysis["geographic_scope"] = "multi-regional"
        else:
            analysis["geographic_scope"] = "global"
        
        # Get primary countries and regions
        country_counts = {}
        for country_code in all_countries:
            country_info = self.countries_data.get(country_code, {})
            country_counts[country_code] = {
                "code": country_code,
                "name": country_info.get("name", ""),
                "count": 1  # Could be enhanced to count actual mentions
            }
        
        analysis["primary_countries"] = list(country_counts.values())[:5]  # Top 5
        analysis["primary_regions"] = list(all_regions)
        
        return analysis

# Global instance
location_detector = LocationDetector()

def add_locations(articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Add location information to articles using enhanced location detection.
    """
    if not articles:
        return articles
    
    enhanced_articles = []
    
    for article in articles:
        try:
            # Extract text for analysis
            text_content = ""
            if article.get("title"):
                text_content += article["title"] + " "
            if article.get("description"):
                text_content += article["description"] + " "
            if article.get("content"):
                text_content += article["content"]
            
            # Debug logging
            logger.info(f"Processing article: {article.get('title', 'No title')[:50]}...")
            logger.info(f"Text content length: {len(text_content)}")
            logger.info(f"Text content preview: {text_content[:200]}...")
            
            # Extract locations
            locations = location_detector.extract_locations_from_text(text_content)
            logger.info(f"Extracted locations: {locations}")
            
            # Analyze geographic focus
            geographic_analysis = location_detector.analyze_geographic_focus(locations)
            logger.info(f"Geographic analysis: {geographic_analysis}")
            
            # Add location data to article
            enhanced_article = article.copy()
            enhanced_article.update({
                "detected_locations": locations,
                "geographic_analysis": geographic_analysis,
                "location_extraction_timestamp": "2024-01-01T00:00:00Z"  # Could use actual timestamp
            })
            
            enhanced_articles.append(enhanced_article)
            
        except Exception as e:
            logger.error(f"Error processing article for locations: {e}")
            # Return original article if processing fails
            enhanced_articles.append(article)
    
    logger.info(f"Enhanced {len(enhanced_articles)} articles with location data")
    return enhanced_articles
