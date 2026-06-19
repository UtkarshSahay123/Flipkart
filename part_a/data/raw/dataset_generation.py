from pathlib import Path

import pandas as pd
import numpy as np
import random

# Set seed for reproducibility
np.random.seed(42)
random.seed(42)

NUM_SAMPLES = 1000

# Base categories based on your workflow specs
events = ['Political Rally', 'Festival', 'Sports', 'Construction', 'Concert']
locations = ['MG Road', 'Silk Board', 'Indiranagar', 'Whitefield']
road_issues = ['Potholes', 'Waterlogging', 'Fallen Trees', 'Accidents', 'Broken Signals']
issue_weights = [28, 18, 16, 22, 16]


def issue_severity(issue_type):
    return {
        'Potholes': 1,
        'Waterlogging': 2,
        'Fallen Trees': 2,
        'Accidents': 3,
        'Broken Signals': 2,
    }.get(issue_type, 1)


def issue_congestion(issue_type):
    return {
        'Potholes': 'Medium',
        'Waterlogging': 'High',
        'Fallen Trees': 'High',
        'Accidents': 'Very High',
        'Broken Signals': 'Medium',
    }.get(issue_type, 'Low')


def severity_rank(level):
    return {
        'Low': 0,
        'Medium': 1,
        'High': 2,
        'Very High': 3,
    }.get(level, 0)


def merge_congestion(base_level, issue_level):
    return base_level if severity_rank(base_level) >= severity_rank(issue_level) else issue_level

data = []

for _ in range(NUM_SAMPLES):
    event_type = random.choice(events)
    location = random.choice(locations)
    road_issue = random.choices(road_issues, weights=issue_weights, k=1)[0]
    hour_of_day = random.randint(0, 23)
    day_of_week = random.randint(0, 6)
    is_weekend = True if day_of_week in [5, 6] else False
    
    # Base crowd generation logic
    if event_type == 'Political Rally':
        expected_crowd = random.randint(2000, 25000)
    elif event_type == 'Festival':
        expected_crowd = random.randint(5000, 20000)
    elif event_type == 'Sports':
        expected_crowd = random.randint(10000, 35000)
    elif event_type == 'Concert':
        expected_crowd = random.randint(3000, 15000)
    else:  # Construction
        expected_crowd = random.randint(10, 100)

    # Initialize targets
    congestion_level = 'Low'
    delay_minutes = random.randint(0, 5)
    affected_radius_km = round(random.uniform(0.1, 0.5), 1)
    risk_score = random.randint(0, 20)

    # Time conditions
    is_evening_peak = 17 <= hour_of_day <= 20
    is_morning_peak = 8 <= hour_of_day <= 10

    # Rule 1: Rallies + crowds > 10,000 + peak hours (5–8 PM) -> Very High, 25-40 min delay
    if event_type == 'Political Rally' and expected_crowd > 10000 and is_evening_peak:
        congestion_level = 'Very High'
        delay_minutes = random.randint(25, 45)
        affected_radius_km = round(random.uniform(2.5, 4.5), 1)
        risk_score = random.randint(85, 100)
        
    # Rule 2: Festivals on weekends -> High congestion
    elif event_type == 'Festival' and is_weekend:
        congestion_level = 'High'
        delay_minutes = random.randint(15, 30)
        affected_radius_km = round(random.uniform(1.5, 3.0), 1)
        risk_score = random.randint(65, 85)
        
    # Rule 3: Construction during weekday morning (8-10 AM) -> Medium congestion
    elif event_type == 'Construction' and is_morning_peak and not is_weekend:
        congestion_level = 'Medium'
        delay_minutes = random.randint(10, 20)
        affected_radius_km = round(random.uniform(0.8, 1.5), 1)
        risk_score = random.randint(40, 65)
        
    # Rule 4: Small concerts on weekday afternoons -> Low/Medium
    elif event_type == 'Concert' and not is_weekend and 12 <= hour_of_day <= 16:
        congestion_level = random.choice(['Low', 'Medium'])
        delay_minutes = random.randint(5, 15)
        affected_radius_km = round(random.uniform(0.5, 1.0), 1)
        risk_score = random.randint(20, 45)
        
    # General Logic for all other combinations (Adding realistic noise)
    else:
        # Scale impact by crowd size and time of day
        impact_multiplier = (expected_crowd / 10000) + (0.5 if is_evening_peak or is_morning_peak else 0)
        
        if impact_multiplier > 2.5:
            congestion_level = 'Very High'
            delay_minutes = random.randint(20, 35)
            risk_score = random.randint(75, 95)
        elif impact_multiplier > 1.5:
            congestion_level = 'High'
            delay_minutes = random.randint(12, 25)
            risk_score = random.randint(55, 80)
        elif impact_multiplier > 0.8:
            congestion_level = 'Medium'
            delay_minutes = random.randint(8, 15)
            risk_score = random.randint(30, 60)
        else:
            congestion_level = 'Low'
            delay_minutes = random.randint(2, 8)
            risk_score = random.randint(5, 35)
            
        affected_radius_km = round(risk_score / 30 + random.uniform(-0.2, 0.2), 1)
        affected_radius_km = max(0.2, affected_radius_km) # Keep radius positive

    # Road-issue effects based on citizen reports
    issue_level = issue_congestion(road_issue)
    congestion_level = merge_congestion(congestion_level, issue_level)
    severity = issue_severity(road_issue)

    if road_issue == 'Potholes':
        delay_minutes += random.randint(3, 10)
        affected_radius_km += random.uniform(0.2, 0.7)
        risk_score += random.randint(8, 22)
    elif road_issue == 'Waterlogging':
        delay_minutes += random.randint(8, 18)
        affected_radius_km += random.uniform(0.6, 1.4)
        risk_score += random.randint(18, 35)
    elif road_issue == 'Fallen Trees':
        delay_minutes += random.randint(10, 22)
        affected_radius_km += random.uniform(0.8, 1.8)
        risk_score += random.randint(22, 42)
    elif road_issue == 'Accidents':
        delay_minutes += random.randint(18, 35)
        affected_radius_km += random.uniform(1.0, 2.2)
        risk_score += random.randint(35, 60)
    elif road_issue == 'Broken Signals':
        delay_minutes += random.randint(6, 16)
        affected_radius_km += random.uniform(0.4, 1.1)
        risk_score += random.randint(15, 32)

    if severity >= 3:
        congestion_level = 'Very High'
    elif severity == 2 and congestion_level == 'Low':
        congestion_level = 'Medium'

    delay_minutes = max(0, delay_minutes)
    affected_radius_km = round(max(0.2, affected_radius_km), 1)
    risk_score = max(0, min(100, risk_score))

    # Injecting intentional noise (approx 5% chance of anomalies)
    if random.random() < 0.05:
        risk_score = max(0, min(100, risk_score + random.randint(-15, 15)))
        delay_minutes = max(0, delay_minutes + random.randint(-10, 10))

    data.append([
        event_type, location, road_issue, hour_of_day, day_of_week, 
        is_weekend, expected_crowd, congestion_level, 
        delay_minutes, affected_radius_km, risk_score
    ])

# Create DataFrame
columns = [
    'event_type', 'location', 'road_issue', 'hour_of_day', 'day_of_week', 
    'is_weekend', 'expected_crowd', 'congestion_level', 
    'delay_minutes', 'affected_radius_km', 'risk_score'
]
df = pd.DataFrame(data, columns=columns)

# Save to CSV
output_path = Path(__file__).with_name('traffic_events.csv')
df.to_csv(output_path, index=False)
print(f"Successfully generated {NUM_SAMPLES} rows and saved to {output_path}")