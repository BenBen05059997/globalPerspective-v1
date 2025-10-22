"""
Enhanced Publisher-Country Mapping Service

This module provides comprehensive publisher-country mapping with credibility scoring,
bias detection, and advanced classification capabilities.
"""

import json
import os
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import re
from urllib.parse import urlparse

@dataclass
class PublisherInfo:
    """Publisher information with metadata"""
    country: str
    credibility_score: int
    type: str
    bias_rating: str
    factual_reporting: str
    description: str

@dataclass
class CountryInfo:
    """Country information with metadata"""
    name: str
    region: str
    continent: str
    timezone: str
    language: str
    flag: str
    major_cities: List[str]

class PublisherMappingService:
    """Enhanced publisher mapping service with comprehensive database"""
    
    def __init__(self):
        self.publishers: Dict[str, PublisherInfo] = {}
        self.countries: Dict[str, CountryInfo] = {}
        self.wire_services: List[str] = []
        self.state_controlled: List[str] = []
        self.high_credibility_threshold: int = 85
        self.low_credibility_threshold: int = 60
        self.regions: Dict[str, List[str]] = {}
        self.languages: Dict[str, List[str]] = {}
        
        # Domain to publisher mapping for URL-based detection
        self.domain_mapping: Dict[str, str] = {}
        
        self._load_data()
        self._build_domain_mapping()
    
    def _load_data(self):
        """Load publisher and country data from JSON files"""
        try:
            # Load publishers data
            publishers_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'publishers.json')
            with open(publishers_path, 'r', encoding='utf-8') as f:
                publishers_data = json.load(f)
            
            # Parse publishers
            for name, data in publishers_data['publishers'].items():
                self.publishers[name] = PublisherInfo(**data)
            
            self.wire_services = publishers_data.get('wire_services', [])
            self.state_controlled = publishers_data.get('state_controlled', [])
            self.high_credibility_threshold = publishers_data.get('high_credibility_threshold', 85)
            self.low_credibility_threshold = publishers_data.get('low_credibility_threshold', 60)
            
            # Load countries data
            countries_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'countries.json')
            with open(countries_path, 'r', encoding='utf-8') as f:
                countries_data = json.load(f)
            
            # Parse countries
            for code, data in countries_data['countries'].items():
                self.countries[code] = CountryInfo(**data)
            
            self.regions = countries_data.get('regions', {})
            self.languages = countries_data.get('languages', {})
            
        except Exception as e:
            print(f"Warning: Could not load publisher/country data: {e}")
            # Fallback to basic mapping
            self._load_fallback_data()
    
    def _load_fallback_data(self):
        """Fallback data if JSON files are not available"""
        basic_publishers = {
            "Reuters": PublisherInfo("GB", 95, "wire_service", "center", "very_high", "International news agency"),
            "Associated Press": PublisherInfo("US", 94, "wire_service", "center", "very_high", "American news agency"),
            "BBC News": PublisherInfo("GB", 92, "public_broadcaster", "center_left", "very_high", "British public broadcaster")
        }
        self.publishers = basic_publishers
        
        basic_countries = {
            "US": CountryInfo("United States", "North America", "North America", "UTC-5 to UTC-10", "en", "🇺🇸", ["New York", "Los Angeles"]),
            "GB": CountryInfo("United Kingdom", "Western Europe", "Europe", "UTC+0", "en", "🇬🇧", ["London", "Birmingham"]),
            "JP": CountryInfo("Japan", "East Asia", "Asia", "UTC+9", "ja", "🇯🇵", ["Tokyo", "Osaka"])
        }
        self.countries = basic_countries
    
    def _build_domain_mapping(self):
        """Build domain to publisher mapping for URL-based detection"""
        domain_mappings = {
            "reuters.com": "Reuters",
            "apnews.com": "Associated Press",
            "bbc.com": "BBC News",
            "bbc.co.uk": "BBC News",
            "theguardian.com": "The Guardian",
            "nytimes.com": "The New York Times",
            "washingtonpost.com": "The Washington Post",
            "wsj.com": "The Wall Street Journal",
            "ft.com": "Financial Times",
            "lemonde.fr": "Le Monde",
            "lefigaro.fr": "Le Figaro",
            "spiegel.de": "Der Spiegel",
            "zeit.de": "Die Zeit",
            "faz.net": "Frankfurter Allgemeine Zeitung",
            "japantimes.co.jp": "The Japan Times",
            "asahi.com": "Asahi Shimbun",
            "nikkei.com": "Nikkei",
            "chinadaily.com.cn": "China Daily",
            "scmp.com": "South China Morning Post",
            "timesofindia.indiatimes.com": "The Times of India",
            "thehindu.com": "The Hindu",
            "aljazeera.com": "Al Jazeera",
            "rt.com": "RT",
            "sputniknews.com": "Sputnik",
            "smh.com.au": "The Sydney Morning Herald",
            "theaustralian.com.au": "The Australian",
            "theglobeandmail.com": "Globe and Mail",
            "thestar.com": "Toronto Star",
            "elpais.com": "El País",
            "repubblica.it": "La Repubblica",
            "corriere.it": "Corriere della Sera",
            "nrc.nl": "NRC Handelsblad",
            "folha.uol.com.br": "Folha de S.Paulo",
            "oglobo.globo.com": "O Globo",
            "haaretz.com": "Haaretz",
            "jpost.com": "The Jerusalem Post"
        }
        self.domain_mapping = domain_mappings
    
    def get_publisher_info(self, source_name: str) -> Optional[PublisherInfo]:
        """Get publisher information by name"""
        # Direct match
        if source_name in self.publishers:
            return self.publishers[source_name]
        
        # Case-insensitive search
        for publisher, info in self.publishers.items():
            if publisher.lower() == source_name.lower():
                return info
        
        # Partial match
        source_lower = source_name.lower()
        for publisher, info in self.publishers.items():
            if source_lower in publisher.lower() or publisher.lower() in source_lower:
                return info
        
        return None
    
    def get_publisher_by_url(self, url: str) -> Optional[str]:
        """Get publisher name from URL"""
        try:
            domain = urlparse(url).netloc.lower()
            # Remove www. prefix
            domain = re.sub(r'^www\.', '', domain)
            
            # Direct domain match
            if domain in self.domain_mapping:
                return self.domain_mapping[domain]
            
            # Partial domain match
            for mapped_domain, publisher in self.domain_mapping.items():
                if mapped_domain in domain or domain in mapped_domain:
                    return publisher
            
            return None
        except:
            return None
    
    def get_country_info(self, country_code: str) -> Optional[CountryInfo]:
        """Get country information by ISO code"""
        return self.countries.get(country_code)
    
    def get_credibility_category(self, score: int) -> str:
        """Categorize credibility score"""
        if score >= self.high_credibility_threshold:
            return "high"
        elif score >= self.low_credibility_threshold:
            return "medium"
        else:
            return "low"
    
    def is_wire_service(self, publisher: str) -> bool:
        """Check if publisher is a wire service"""
        return publisher in self.wire_services
    
    def is_state_controlled(self, publisher: str) -> bool:
        """Check if publisher is state-controlled"""
        return publisher in self.state_controlled
    
    def get_publishers_by_country(self, country_code: str) -> List[str]:
        """Get all publishers from a specific country"""
        return [name for name, info in self.publishers.items() if info.country == country_code]
    
    def get_publishers_by_region(self, region: str) -> List[str]:
        """Get all publishers from a specific region"""
        countries_in_region = self.regions.get(region, [])
        publishers = []
        for country in countries_in_region:
            publishers.extend(self.get_publishers_by_country(country))
        return publishers
    
    def get_high_credibility_publishers(self) -> List[str]:
        """Get publishers with high credibility scores"""
        return [name for name, info in self.publishers.items() 
                if info.credibility_score >= self.high_credibility_threshold]
    
    def analyze_source_diversity(self, sources: List[str]) -> Dict:
        """Analyze diversity of news sources"""
        countries = set()
        regions = set()
        credibility_scores = []
        wire_services = 0
        state_controlled = 0
        
        for source in sources:
            info = self.get_publisher_info(source)
            if info:
                countries.add(info.country)
                country_info = self.get_country_info(info.country)
                if country_info:
                    regions.add(country_info.region)
                credibility_scores.append(info.credibility_score)
                
                if self.is_wire_service(source):
                    wire_services += 1
                if self.is_state_controlled(source):
                    state_controlled += 1
        
        avg_credibility = sum(credibility_scores) / len(credibility_scores) if credibility_scores else 0
        
        return {
            "unique_countries": len(countries),
            "unique_regions": len(regions),
            "average_credibility": round(avg_credibility, 1),
            "wire_services": wire_services,
            "state_controlled": state_controlled,
            "total_sources": len(sources),
            "countries": list(countries),
            "regions": list(regions)
        }
    
    def suggest_additional_sources(self, current_sources: List[str], target_country: str = None) -> List[str]:
        """Suggest additional high-quality sources for better coverage"""
        current_countries = set()
        for source in current_sources:
            info = self.get_publisher_info(source)
            if info:
                current_countries.add(info.country)
        
        # Get high credibility publishers not already included
        suggestions = []
        for name, info in self.publishers.items():
            if (name not in current_sources and 
                info.credibility_score >= self.high_credibility_threshold):
                
                # If target country specified, prioritize that country
                if target_country and info.country == target_country:
                    suggestions.insert(0, name)
                # Otherwise, prioritize countries not yet covered
                elif info.country not in current_countries:
                    suggestions.append(name)
        
        return suggestions[:5]  # Return top 5 suggestions

# Global instance
publisher_service = PublisherMappingService()