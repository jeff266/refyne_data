"""
Industry Taxonomy Mapping for MPLC Enrichment

Maps friendly industry names to:
- NAICS codes (4-digit primary, 6-digit subcategories)
- Apollo keyword tags
- ZoomInfo/GraphiqAI use NAICS codes directly

Focused on B2B industries relevant for media licensing.
"""

from typing import Dict, List, Optional, Any


INDUSTRY_TAXONOMY: Dict[str, Dict[str, Any]] = {
    # ==========================================================================
    # HOSPITALITY
    # ==========================================================================
    "hotels": {
        "display_name": "Hotels & Lodging",
        "naics_4": "7211",
        "naics_6": ["721110", "721120", "721191", "721199"],
        "apollo_keywords": ["hotel", "lodging", "hospitality", "resort", "motel"],
        "description": "Hotels, motels, resorts, bed & breakfasts, vacation rentals"
    },
    "restaurants": {
        "display_name": "Restaurants",
        "naics_4": "7225",
        "naics_6": ["722511", "722513", "722514", "722515"],
        "apollo_keywords": ["restaurant", "dining", "food service", "eatery"],
        "description": "Full-service restaurants, limited-service, cafeterias"
    },
    "bars_nightclubs": {
        "display_name": "Bars & Nightclubs",
        "naics_4": "7224",
        "naics_6": ["722410"],
        "apollo_keywords": ["bar", "nightclub", "pub", "tavern", "lounge"],
        "description": "Drinking places, bars, nightclubs, taverns"
    },
    "catering": {
        "display_name": "Catering & Food Services",
        "naics_4": "7223",
        "naics_6": ["722310", "722320"],
        "apollo_keywords": ["catering", "food service", "event catering"],
        "description": "Catering services, food service contractors"
    },
    "coffee_shops": {
        "display_name": "Coffee Shops & Cafes",
        "naics_4": "7225",
        "naics_6": ["722515"],
        "apollo_keywords": ["coffee shop", "cafe", "coffeehouse", "espresso bar"],
        "description": "Coffee shops, cafes, snack and nonalcoholic beverage bars"
    },

    # ==========================================================================
    # HEALTHCARE
    # ==========================================================================
    "hospitals": {
        "display_name": "Hospitals",
        "naics_4": "6221",
        "naics_6": ["622110", "622210", "622310"],
        "apollo_keywords": ["hospital", "medical center", "healthcare"],
        "description": "General medical, surgical, psychiatric hospitals"
    },
    "medical_clinics": {
        "display_name": "Medical Clinics & Offices",
        "naics_4": "6211",
        "naics_6": ["621111", "621112", "621493", "621498"],
        "apollo_keywords": ["medical clinic", "physician office", "doctor office", "healthcare"],
        "description": "Physician offices, clinics, urgent care, outpatient centers"
    },
    "dental": {
        "display_name": "Dental Practices",
        "naics_4": "6212",
        "naics_6": ["621210"],
        "apollo_keywords": ["dental", "dentist", "orthodontics", "dental office"],
        "description": "Dental offices, orthodontists, dental clinics"
    },
    "senior_living": {
        "display_name": "Senior Living & Nursing",
        "naics_4": "6231",
        "naics_6": ["623110", "623311", "623312"],
        "apollo_keywords": ["senior living", "nursing home", "assisted living", "retirement"],
        "description": "Nursing homes, assisted living, retirement communities"
    },
    "veterinary": {
        "display_name": "Veterinary Services",
        "naics_4": "5419",
        "naics_6": ["541940"],
        "apollo_keywords": ["veterinary", "animal hospital", "pet clinic", "vet"],
        "description": "Veterinary clinics, animal hospitals"
    },
    "physical_therapy": {
        "display_name": "Physical Therapy & Rehab",
        "naics_4": "6213",
        "naics_6": ["621340"],
        "apollo_keywords": ["physical therapy", "PT clinic", "rehabilitation", "physiotherapy"],
        "description": "Physical therapy, occupational therapy, rehabilitation centers"
    },

    # ==========================================================================
    # FITNESS & RECREATION
    # ==========================================================================
    "fitness_centers": {
        "display_name": "Fitness Centers & Gyms",
        "naics_4": "7139",
        "naics_6": ["713940"],
        "apollo_keywords": ["fitness", "gym", "health club", "fitness center"],
        "description": "Gyms, health clubs, fitness studios, workout facilities"
    },
    "spas_wellness": {
        "display_name": "Spas & Wellness Centers",
        "naics_4": "8121",
        "naics_6": ["812111", "812199"],
        "apollo_keywords": ["spa", "wellness", "massage", "beauty spa"],
        "description": "Day spas, wellness centers, massage therapy"
    },
    "golf_country_clubs": {
        "display_name": "Golf & Country Clubs",
        "naics_4": "7139",
        "naics_6": ["713910"],
        "apollo_keywords": ["golf course", "country club", "golf club"],
        "description": "Golf courses, country clubs, private clubs"
    },
    "recreation_centers": {
        "display_name": "Recreation & Sports Centers",
        "naics_4": "7139",
        "naics_6": ["713940", "713950", "713990"],
        "apollo_keywords": ["recreation center", "sports facility", "athletic club"],
        "description": "Recreation centers, bowling, sports complexes"
    },

    # ==========================================================================
    # RETAIL
    # ==========================================================================
    "retail_clothing": {
        "display_name": "Clothing & Apparel Stores",
        "naics_4": "4481",
        "naics_6": ["448110", "448120", "448130", "448140", "448150"],
        "apollo_keywords": ["clothing store", "apparel", "fashion retail", "boutique"],
        "description": "Clothing stores, shoe stores, accessories, boutiques"
    },
    "retail_grocery": {
        "display_name": "Grocery & Supermarkets",
        "naics_4": "4451",
        "naics_6": ["445110", "445120", "445230"],
        "apollo_keywords": ["grocery", "supermarket", "food store", "grocery store"],
        "description": "Supermarkets, grocery stores, specialty food stores"
    },
    "retail_electronics": {
        "display_name": "Electronics & Appliance Stores",
        "naics_4": "4431",
        "naics_6": ["443141", "443142"],
        "apollo_keywords": ["electronics store", "appliance store", "consumer electronics"],
        "description": "Electronics stores, appliance stores, computer stores"
    },
    "retail_home_garden": {
        "display_name": "Home & Garden Stores",
        "naics_4": "4441",
        "naics_6": ["444110", "444120", "444130"],
        "apollo_keywords": ["home improvement", "hardware store", "garden center"],
        "description": "Home improvement, hardware, garden centers, nurseries"
    },
    "retail_general": {
        "display_name": "General Merchandise & Department Stores",
        "naics_4": "4521",
        "naics_6": ["452210", "452311", "452319"],
        "apollo_keywords": ["department store", "general merchandise", "retail"],
        "description": "Department stores, general merchandise, variety stores"
    },

    # ==========================================================================
    # PROFESSIONAL SERVICES
    # ==========================================================================
    "legal_services": {
        "display_name": "Law Firms & Legal Services",
        "naics_4": "5411",
        "naics_6": ["541110", "541191", "541199"],
        "apollo_keywords": ["law firm", "legal services", "attorney", "lawyer"],
        "description": "Law firms, attorneys, legal services"
    },
    "accounting": {
        "display_name": "Accounting & Tax Services",
        "naics_4": "5412",
        "naics_6": ["541211", "541213", "541214", "541219"],
        "apollo_keywords": ["accounting", "CPA", "tax services", "bookkeeping"],
        "description": "Accounting firms, CPAs, tax preparation, bookkeeping"
    },
    "real_estate": {
        "display_name": "Real Estate Services",
        "naics_4": "5312",
        "naics_6": ["531210", "531311", "531312", "531320"],
        "apollo_keywords": ["real estate", "property management", "realtor", "broker"],
        "description": "Real estate agencies, property management, brokers"
    },
    "insurance": {
        "display_name": "Insurance Agencies",
        "naics_4": "5242",
        "naics_6": ["524210", "524291", "524292"],
        "apollo_keywords": ["insurance agency", "insurance broker", "insurance"],
        "description": "Insurance agencies, brokers, agents"
    },
    "marketing_agencies": {
        "display_name": "Marketing & Advertising Agencies",
        "naics_4": "5418",
        "naics_6": ["541810", "541820", "541830", "541840", "541850", "541860", "541870", "541890"],
        "apollo_keywords": ["marketing agency", "advertising agency", "digital marketing", "PR agency"],
        "description": "Marketing, advertising, PR, and related services"
    },

    # ==========================================================================
    # EDUCATION
    # ==========================================================================
    "k12_schools": {
        "display_name": "K-12 Schools",
        "naics_4": "6111",
        "naics_6": ["611110"],
        "apollo_keywords": ["school", "K-12", "elementary school", "high school", "education"],
        "description": "Elementary schools, middle schools, high schools"
    },
    "universities": {
        "display_name": "Colleges & Universities",
        "naics_4": "6113",
        "naics_6": ["611310"],
        "apollo_keywords": ["university", "college", "higher education"],
        "description": "Colleges, universities, higher education institutions"
    },
    "training_centers": {
        "display_name": "Training & Education Centers",
        "naics_4": "6116",
        "naics_6": ["611610", "611620", "611630", "611691", "611699"],
        "apollo_keywords": ["training center", "vocational", "professional training"],
        "description": "Vocational training, professional development, tutoring"
    },
    "childcare": {
        "display_name": "Childcare & Preschools",
        "naics_4": "6244",
        "naics_6": ["624410"],
        "apollo_keywords": ["childcare", "daycare", "preschool", "child care"],
        "description": "Daycare centers, preschools, childcare facilities"
    },

    # ==========================================================================
    # AUTOMOTIVE
    # ==========================================================================
    "auto_dealers": {
        "display_name": "Auto Dealerships",
        "naics_4": "4411",
        "naics_6": ["441110", "441120", "441228"],
        "apollo_keywords": ["auto dealer", "car dealership", "automotive dealer"],
        "description": "New car dealers, used car dealers, RV dealers"
    },
    "auto_repair": {
        "display_name": "Auto Repair & Service",
        "naics_4": "8111",
        "naics_6": ["811111", "811112", "811113", "811118", "811121"],
        "apollo_keywords": ["auto repair", "car service", "mechanic", "automotive service"],
        "description": "Auto repair shops, oil change, tire shops, body shops"
    },
    "auto_parts": {
        "display_name": "Auto Parts & Accessories",
        "naics_4": "4413",
        "naics_6": ["441310", "441320"],
        "apollo_keywords": ["auto parts", "car parts", "automotive parts"],
        "description": "Auto parts stores, tire dealers, accessories"
    },

    # ==========================================================================
    # ENTERTAINMENT & VENUES
    # ==========================================================================
    "movie_theaters": {
        "display_name": "Movie Theaters",
        "naics_4": "5121",
        "naics_6": ["512131", "512132"],
        "apollo_keywords": ["movie theater", "cinema", "film exhibition"],
        "description": "Movie theaters, cinemas, drive-in theaters"
    },
    "performing_arts": {
        "display_name": "Performing Arts Venues",
        "naics_4": "7111",
        "naics_6": ["711110", "711120", "711130", "711190"],
        "apollo_keywords": ["theater", "performing arts", "concert venue", "live entertainment"],
        "description": "Theaters, concert halls, performing arts centers"
    },
    "amusement_parks": {
        "display_name": "Amusement & Theme Parks",
        "naics_4": "7131",
        "naics_6": ["713110", "713120"],
        "apollo_keywords": ["amusement park", "theme park", "water park", "attraction"],
        "description": "Amusement parks, theme parks, water parks"
    },
    "museums_zoos": {
        "display_name": "Museums & Zoos",
        "naics_4": "7121",
        "naics_6": ["712110", "712120", "712130", "712190"],
        "apollo_keywords": ["museum", "zoo", "aquarium", "botanical garden"],
        "description": "Museums, zoos, aquariums, botanical gardens"
    },
    "event_venues": {
        "display_name": "Event & Convention Centers",
        "naics_4": "5319",
        "naics_6": ["531120", "711310"],
        "apollo_keywords": ["event venue", "convention center", "banquet hall", "event space"],
        "description": "Convention centers, banquet halls, event spaces"
    },

    # ==========================================================================
    # PERSONAL SERVICES
    # ==========================================================================
    "hair_salons": {
        "display_name": "Hair Salons & Barbershops",
        "naics_4": "8121",
        "naics_6": ["812111", "812112"],
        "apollo_keywords": ["hair salon", "barbershop", "beauty salon"],
        "description": "Hair salons, barbershops, beauty salons"
    },
    "nail_salons": {
        "display_name": "Nail Salons",
        "naics_4": "8121",
        "naics_6": ["812113"],
        "apollo_keywords": ["nail salon", "manicure", "pedicure"],
        "description": "Nail salons, nail spas"
    },
    "pet_services": {
        "display_name": "Pet Services",
        "naics_4": "8129",
        "naics_6": ["812910"],
        "apollo_keywords": ["pet grooming", "pet boarding", "dog daycare", "pet services"],
        "description": "Pet grooming, boarding, daycare services"
    },

    # ==========================================================================
    # OTHER B2B SERVICES
    # ==========================================================================
    "cleaning_services": {
        "display_name": "Cleaning & Janitorial Services",
        "naics_4": "5617",
        "naics_6": ["561720"],
        "apollo_keywords": ["cleaning service", "janitorial", "commercial cleaning", "maid service"],
        "description": "Janitorial services, commercial cleaning, building maintenance"
    },
    "it_services": {
        "display_name": "IT Services & Support",
        "naics_4": "5415",
        "naics_6": ["541511", "541512", "541513", "541519"],
        "apollo_keywords": ["IT services", "managed IT", "computer services", "tech support"],
        "description": "IT services, managed services, computer support"
    },
}


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_industries() -> List[Dict[str, str]]:
    """
    Returns list of industries for dropdown selection.

    Returns:
        List of dicts with 'key' and 'display_name' for each industry
    """
    return [
        {"key": key, "display_name": data["display_name"]}
        for key, data in sorted(INDUSTRY_TAXONOMY.items(), key=lambda x: x[1]["display_name"])
    ]


def get_industry_keys() -> List[str]:
    """
    Returns list of industry keys for programmatic use.

    Returns:
        List of industry key strings
    """
    return sorted(INDUSTRY_TAXONOMY.keys())


def get_naics_for_industry(industry_key: str) -> Optional[Dict[str, Any]]:
    """
    Returns NAICS codes for a given industry.

    Args:
        industry_key: The industry key (e.g., 'fitness_centers')

    Returns:
        Dict with 'naics_4' (str) and 'naics_6' (list) or None if not found
    """
    if industry_key not in INDUSTRY_TAXONOMY:
        return None

    industry = INDUSTRY_TAXONOMY[industry_key]
    return {
        "naics_4": industry["naics_4"],
        "naics_6": industry["naics_6"]
    }


def get_apollo_keywords(industry_key: str) -> Optional[List[str]]:
    """
    Returns Apollo keyword tags for a given industry.

    Args:
        industry_key: The industry key (e.g., 'fitness_centers')

    Returns:
        List of Apollo keyword strings or None if not found
    """
    if industry_key not in INDUSTRY_TAXONOMY:
        return None

    return INDUSTRY_TAXONOMY[industry_key]["apollo_keywords"]


def get_all_mappings() -> List[Dict[str, Any]]:
    """
    Returns full mapping data for display in a table.

    Returns:
        List of dicts with all industry mapping data
    """
    mappings = []
    for key, data in sorted(INDUSTRY_TAXONOMY.items(), key=lambda x: x[1]["display_name"]):
        mappings.append({
            "key": key,
            "display_name": data["display_name"],
            "naics_4": data["naics_4"],
            "naics_6": ", ".join(data["naics_6"]),
            "apollo_keywords": ", ".join(data["apollo_keywords"]),
            "description": data["description"]
        })
    return mappings


def get_industry_by_naics(naics_code: str) -> Optional[str]:
    """
    Reverse lookup: find industry key by NAICS code (4 or 6 digit).

    Args:
        naics_code: NAICS code to look up

    Returns:
        Industry key or None if not found
    """
    for key, data in INDUSTRY_TAXONOMY.items():
        if data["naics_4"] == naics_code:
            return key
        if naics_code in data["naics_6"]:
            return key
    return None


def get_industries_by_category() -> Dict[str, List[Dict[str, str]]]:
    """
    Returns industries grouped by category for organized display.

    Returns:
        Dict with category names as keys and lists of industries as values
    """
    categories = {
        "Hospitality": ["hotels", "restaurants", "bars_nightclubs", "catering", "coffee_shops"],
        "Healthcare": ["hospitals", "medical_clinics", "dental", "senior_living", "veterinary", "physical_therapy"],
        "Fitness & Recreation": ["fitness_centers", "spas_wellness", "golf_country_clubs", "recreation_centers"],
        "Retail": ["retail_clothing", "retail_grocery", "retail_electronics", "retail_home_garden", "retail_general"],
        "Professional Services": ["legal_services", "accounting", "real_estate", "insurance", "marketing_agencies"],
        "Education": ["k12_schools", "universities", "training_centers", "childcare"],
        "Automotive": ["auto_dealers", "auto_repair", "auto_parts"],
        "Entertainment & Venues": ["movie_theaters", "performing_arts", "amusement_parks", "museums_zoos", "event_venues"],
        "Personal Services": ["hair_salons", "nail_salons", "pet_services"],
        "Other B2B Services": ["cleaning_services", "it_services"],
    }

    result = {}
    for category, keys in categories.items():
        result[category] = [
            {"key": key, "display_name": INDUSTRY_TAXONOMY[key]["display_name"]}
            for key in keys if key in INDUSTRY_TAXONOMY
        ]
    return result


def search_industries(query: str) -> List[Dict[str, str]]:
    """
    Search industries by keyword in display name, description, or Apollo keywords.

    Args:
        query: Search string

    Returns:
        List of matching industries with key and display_name
    """
    query_lower = query.lower()
    matches = []

    for key, data in INDUSTRY_TAXONOMY.items():
        searchable = f"{data['display_name']} {data['description']} {' '.join(data['apollo_keywords'])}".lower()
        if query_lower in searchable:
            matches.append({
                "key": key,
                "display_name": data["display_name"],
                "description": data["description"]
            })

    return sorted(matches, key=lambda x: x["display_name"])


def get_industry_data(industry_key: str) -> Optional[Dict[str, Any]]:
    """
    Get the full data for a specific industry.

    Args:
        industry_key: The industry key (e.g., 'fitness_centers')

    Returns:
        Full industry data dict or None if not found
    """
    return INDUSTRY_TAXONOMY.get(industry_key)


# =============================================================================
# CONVENIENCE EXPORTS
# =============================================================================

# List of all NAICS 4-digit codes for bulk queries
ALL_NAICS_4 = list(set(data["naics_4"] for data in INDUSTRY_TAXONOMY.values()))

# List of all NAICS 6-digit codes for detailed queries
ALL_NAICS_6 = []
for data in INDUSTRY_TAXONOMY.values():
    ALL_NAICS_6.extend(data["naics_6"])
ALL_NAICS_6 = list(set(ALL_NAICS_6))


if __name__ == "__main__":
    # Quick test/demo
    print("=" * 60)
    print("MPLC Industry Taxonomy")
    print("=" * 60)
    print(f"\nTotal industries: {len(INDUSTRY_TAXONOMY)}")
    print(f"Total unique NAICS-4 codes: {len(ALL_NAICS_4)}")
    print(f"Total unique NAICS-6 codes: {len(ALL_NAICS_6)}")

    print("\n" + "-" * 60)
    print("Industries by Category:")
    print("-" * 60)
    for category, industries in get_industries_by_category().items():
        print(f"\n{category}:")
        for ind in industries:
            print(f"  - {ind['display_name']} ({ind['key']})")

    print("\n" + "-" * 60)
    print("Sample Lookup: fitness_centers")
    print("-" * 60)
    print(f"NAICS: {get_naics_for_industry('fitness_centers')}")
    print(f"Apollo Keywords: {get_apollo_keywords('fitness_centers')}")
