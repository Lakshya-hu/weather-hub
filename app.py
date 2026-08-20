"""
WeatherHub - Flask Backend
Developer: Lakshya Vijay Singh

This file contains:
 - Flask app setup
 - Route handlers (/, /search, /location, /weather)
 - API helper functions (geocoding, weather, air quality)
 - Weather code to text/icon mapping
 - Error handling for all API calls
"""

from flask import Flask, render_template, request, jsonify
import requests

# ─────────────────────────────────────────────
# Flask App Initialization
# ─────────────────────────────────────────────
app = Flask(__name__)


# ─────────────────────────────────────────────
# Weather Code Mapping
# Maps Open-Meteo WMO codes → (description, icon class)
# ─────────────────────────────────────────────
def get_weather_description(code):
    """
    Convert an Open-Meteo WMO weather code into a
    human-readable description and a Font Awesome icon class.

    Returns a tuple: (description_string, icon_class_string)
    """
    weather_codes = {
        0:  ("Clear Sky",              "fa-sun"),
        1:  ("Mainly Clear",           "fa-sun"),
        2:  ("Partly Cloudy",          "fa-cloud-sun"),
        3:  ("Overcast",               "fa-cloud"),
        45: ("Foggy",                  "fa-smog"),
        48: ("Icy Fog",                "fa-smog"),
        51: ("Light Drizzle",          "fa-cloud-drizzle"),
        53: ("Moderate Drizzle",       "fa-cloud-drizzle"),
        55: ("Heavy Drizzle",          "fa-cloud-drizzle"),
        56: ("Freezing Drizzle",       "fa-cloud-drizzle"),
        57: ("Heavy Freezing Drizzle", "fa-cloud-drizzle"),
        61: ("Slight Rain",            "fa-cloud-rain"),
        63: ("Moderate Rain",          "fa-cloud-rain"),
        65: ("Heavy Rain",             "fa-cloud-showers-heavy"),
        66: ("Freezing Rain",          "fa-cloud-rain"),
        67: ("Heavy Freezing Rain",    "fa-cloud-showers-heavy"),
        71: ("Slight Snowfall",        "fa-snowflake"),
        73: ("Moderate Snowfall",      "fa-snowflake"),
        75: ("Heavy Snowfall",         "fa-snowflake"),
        77: ("Snow Grains",            "fa-snowflake"),
        80: ("Slight Showers",         "fa-cloud-rain"),
        81: ("Moderate Showers",       "fa-cloud-showers-heavy"),
        82: ("Violent Showers",        "fa-cloud-showers-heavy"),
        85: ("Slight Snow Showers",    "fa-snowflake"),
        86: ("Heavy Snow Showers",     "fa-snowflake"),
        95: ("Thunderstorm",           "fa-bolt"),
        96: ("Thunderstorm w/ Hail",   "fa-bolt"),
        99: ("Heavy Thunderstorm",     "fa-bolt"),
    }

    # If the exact code isn't in the dictionary, return a default
    if code in weather_codes:
        return weather_codes[code]
    else:
        return ("Unknown", "fa-question")


def get_aqi_label(aqi_value):
    """
    Convert a numeric AQI value into a human-readable label.
    Based on the US EPA AQI scale.
    """
    if aqi_value is None:
        return "N/A"
    aqi = int(aqi_value)
    if aqi <= 50:
        return "Good"
    elif aqi <= 100:
        return "Moderate"
    elif aqi <= 150:
        return "Unhealthy for Sensitive Groups"
    elif aqi <= 200:
        return "Unhealthy"
    elif aqi <= 300:
        return "Very Unhealthy"
    else:
        return "Hazardous"


def get_wind_direction(degrees):
    """
    Convert a wind direction in degrees (0-360) into
    a compass direction abbreviation like N, NE, E, etc.
    """
    if degrees is None:
        return "N/A"

    directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]

    # Each direction covers 22.5 degrees
    index = round(degrees / 22.5) % 16
    return directions[index]


# ─────────────────────────────────────────────
# Geocoding Helper
# ─────────────────────────────────────────────
def geocode_city(city_name):
    """
    Use Open-Meteo Geocoding API to convert a city name
    into latitude, longitude, city name, and country.

    Returns a dict with location info, or None if city not found.
    """
    url = "https://geocoding-api.open-meteo.com/v1/search"

    try:
        response = requests.get(
            url,
            params={
                "name": city_name,
                "count": 1,
                "language": "en",
                "format": "json"
            },
            timeout=10  # Wait max 10 seconds for a response
        )

        data = response.json()

        # Check if any results came back
        if "results" not in data or len(data["results"]) == 0:
            return None

        # Take the first (best matching) result
        result = data["results"][0]

        return {
            "latitude":  result.get("latitude"),
            "longitude": result.get("longitude"),
            "city":      result.get("name", "Unknown"),
            "country":   result.get("country", "Unknown"),
            "country_code": result.get("country_code", ""),
            "admin1":    result.get("admin1", ""),  # State/province
        }

    except requests.exceptions.Timeout:
        return None
    except requests.exceptions.RequestException:
        return None
    except Exception:
        return None


def reverse_geocode(latitude, longitude):
    """
    Use Open-Meteo's geocoding API to find what city is
    at the given coordinates (reverse geocoding).

    We do this by querying the Open-Meteo geocoding API is not
    directly available for reverse geocoding, so we use
    the Big Data Cloud / Nominatim reverse geocoder (free, no key needed).
    """
    url = "https://nominatim.openstreetmap.org/reverse"

    try:
        response = requests.get(
            url,
            params={
                "lat": latitude,
                "lon": longitude,
                "format": "json",
                "zoom": 10,  # City level detail
            },
            headers={
                # Nominatim requires a User-Agent header
                "User-Agent": "WeatherHub/1.0 (student project)"
            },
            timeout=10
        )

        data = response.json()

        address = data.get("address", {})

        # Try to get the most specific city-level name available
        city = (
            address.get("city") or
            address.get("town") or
            address.get("village") or
            address.get("municipality") or
            address.get("county") or
            "Unknown Location"
        )

        country = address.get("country", "Unknown")
        country_code = address.get("country_code", "").upper()

        return {
            "city":         city,
            "country":      country,
            "country_code": country_code,
            "admin1":       address.get("state", ""),
        }

    except Exception:
        # If reverse geocoding fails, just return generic labels
        return {
            "city":         "Your Location",
            "country":      "",
            "country_code": "",
            "admin1":       "",
        }


# ─────────────────────────────────────────────
# Weather Data Helper
# ─────────────────────────────────────────────
def get_weather_data(latitude, longitude):
    """
    Call Open-Meteo Forecast API with the given coordinates.
    Requests current, hourly, and daily weather data.

    Returns the parsed JSON response or None on error.
    """
    url = "https://api.open-meteo.com/v1/forecast"

    try:
        response = requests.get(
            url,
            params={
                "latitude":  latitude,
                "longitude": longitude,
                "timezone":  "auto",  # Auto-detect timezone from coordinates

                # Current conditions we want
                "current": ",".join([
                    "temperature_2m",
                    "apparent_temperature",
                    "relative_humidity_2m",
                    "precipitation",
                    "rain",
                    "weather_code",
                    "cloud_cover",
                    "surface_pressure",
                    "wind_speed_10m",
                    "wind_direction_10m",
                    "visibility",
                    "uv_index",
                ]),

                # Hourly data for next 24 hours
                "hourly": ",".join([
                    "temperature_2m",
                    "weather_code",
                    "precipitation_probability",
                    "relative_humidity_2m",
                    "wind_speed_10m",
                    "uv_index",
                ]),

                # Daily data for 7-day forecast
                "daily": ",".join([
                    "temperature_2m_max",
                    "temperature_2m_min",
                    "weather_code",
                    "precipitation_probability_max",
                    "sunrise",
                    "sunset",
                    "uv_index_max",
                ]),

                "forecast_days": 7,  # We want 7-day forecast
            },
            timeout=15
        )

        return response.json()

    except requests.exceptions.Timeout:
        return None
    except requests.exceptions.RequestException:
        return None
    except Exception:
        return None


# ─────────────────────────────────────────────
# Air Quality Helper
# ─────────────────────────────────────────────
def get_air_quality(latitude, longitude):
    """
    Call Open-Meteo Air Quality API to get AQI, PM2.5, PM10.
    Returns a dict with air quality data, or None on failure.
    """
    url = "https://air-quality-api.open-meteo.com/v1/air-quality"

    try:
        response = requests.get(
            url,
            params={
                "latitude":  latitude,
                "longitude": longitude,
                "current": ",".join([
                    "us_aqi",
                    "pm2_5",
                    "pm10",
                    "european_aqi",
                ]),
            },
            timeout=10
        )

        data = response.json()
        current = data.get("current", {})

        return {
            "aqi":    current.get("us_aqi"),
            "pm2_5":  current.get("pm2_5"),
            "pm10":   current.get("pm10"),
        }

    except Exception:
        # Air quality is optional — don't crash if it fails
        return {
            "aqi":   None,
            "pm2_5": None,
            "pm10":  None,
        }


# ─────────────────────────────────────────────
# Data Assembly Helper
# ─────────────────────────────────────────────
def assemble_weather_response(latitude, longitude, location_info):
    """
    Combine weather data and air quality data into a single
    structured dictionary ready to be sent to the frontend.

    This is the main function that prepares all dashboard data.
    """
    # Fetch both APIs (weather first, then air quality)
    weather_raw = get_weather_data(latitude, longitude)

    if weather_raw is None:
        return None, "Could not fetch weather data. Please try again."

    # Air quality is optional — we continue even if it fails
    air_quality = get_air_quality(latitude, longitude)

    # ── Current weather ──────────────────────────────────────────
    current_raw = weather_raw.get("current", {})

    weather_code = current_raw.get("weather_code", 0)
    description, icon = get_weather_description(weather_code)

    wind_degrees = current_raw.get("wind_direction_10m")
    wind_direction_label = get_wind_direction(wind_degrees)

    # Format visibility: API returns meters, convert to km
    visibility_m = current_raw.get("visibility")
    if visibility_m is not None:
        visibility_km = round(visibility_m / 1000, 1)
    else:
        visibility_km = None

    current = {
        "temperature":     current_raw.get("temperature_2m"),
        "feels_like":      current_raw.get("apparent_temperature"),
        "humidity":        current_raw.get("relative_humidity_2m"),
        "precipitation":   current_raw.get("precipitation"),
        "rain":            current_raw.get("rain"),
        "weather_code":    weather_code,
        "description":     description,
        "icon":            icon,
        "cloud_cover":     current_raw.get("cloud_cover"),
        "pressure":        current_raw.get("surface_pressure"),
        "wind_speed":      current_raw.get("wind_speed_10m"),
        "wind_direction":  wind_degrees,
        "wind_dir_label":  wind_direction_label,
        "visibility_km":   visibility_km,
        "uv_index":        current_raw.get("uv_index"),
        "time":            current_raw.get("time"),
    }

    # ── Hourly forecast (next 24 hours) ──────────────────────────
    hourly_raw = weather_raw.get("hourly", {})
    hourly_times      = hourly_raw.get("time", [])
    hourly_temps      = hourly_raw.get("temperature_2m", [])
    hourly_codes      = hourly_raw.get("weather_code", [])
    hourly_rain_prob  = hourly_raw.get("precipitation_probability", [])
    hourly_humidity   = hourly_raw.get("relative_humidity_2m", [])
    hourly_wind       = hourly_raw.get("wind_speed_10m", [])
    hourly_uv         = hourly_raw.get("uv_index", [])

    hourly_forecast = []
    # We take the next 24 entries
    for i in range(min(24, len(hourly_times))):
        code = hourly_codes[i] if i < len(hourly_codes) else 0
        desc, ico = get_weather_description(code)
        hourly_forecast.append({
            "time":      hourly_times[i] if i < len(hourly_times) else None,
            "temp":      hourly_temps[i] if i < len(hourly_temps) else None,
            "code":      code,
            "icon":      ico,
            "desc":      desc,
            "rain_prob": hourly_rain_prob[i] if i < len(hourly_rain_prob) else None,
            "humidity":  hourly_humidity[i] if i < len(hourly_humidity) else None,
            "wind":      hourly_wind[i] if i < len(hourly_wind) else None,
            "uv":        hourly_uv[i] if i < len(hourly_uv) else None,
        })

    # ── Daily forecast (7 days) ───────────────────────────────────
    daily_raw  = weather_raw.get("daily", {})
    day_times  = daily_raw.get("time", [])
    day_max    = daily_raw.get("temperature_2m_max", [])
    day_min    = daily_raw.get("temperature_2m_min", [])
    day_codes  = daily_raw.get("weather_code", [])
    day_rain   = daily_raw.get("precipitation_probability_max", [])
    day_rise   = daily_raw.get("sunrise", [])
    day_set    = daily_raw.get("sunset", [])
    day_uv     = daily_raw.get("uv_index_max", [])

    daily_forecast = []
    day_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    for i in range(min(7, len(day_times))):
        code = day_codes[i] if i < len(day_codes) else 0
        desc, ico = get_weather_description(code)

        # Parse the date string to get the day name
        date_str = day_times[i] if i < len(day_times) else ""
        try:
            from datetime import datetime
            date_obj = datetime.strptime(date_str, "%Y-%m-%d")
            day_name = day_names[date_obj.weekday()]
            # Sunday is index 6, we want Sunday=0 in our list:
            # Python's weekday(): Mon=0, Sun=6
            # Adjust: Sun=0 in our list
            py_weekday = date_obj.weekday()  # Mon=0, Sun=6
            day_name = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][py_weekday]
        except Exception:
            day_name = date_str

        daily_forecast.append({
            "date":      date_str,
            "day_name":  day_name,
            "max_temp":  day_max[i] if i < len(day_max) else None,
            "min_temp":  day_min[i] if i < len(day_min) else None,
            "code":      code,
            "icon":      ico,
            "desc":      desc,
            "rain_prob": day_rain[i] if i < len(day_rain) else None,
            "sunrise":   day_rise[i] if i < len(day_rise) else None,
            "sunset":    day_set[i] if i < len(day_set) else None,
            "uv_max":    day_uv[i] if i < len(day_uv) else None,
        })

    # ── Timezone info ─────────────────────────────────────────────
    timezone = weather_raw.get("timezone", "UTC")
    timezone_abbr = weather_raw.get("timezone_abbreviation", "")

    # ── AQI label ─────────────────────────────────────────────────
    aqi_label = get_aqi_label(air_quality.get("aqi"))

    # ── Put everything together ────────────────────────────────────
    result = {
        "location": {
            "city":         location_info.get("city", "Unknown"),
            "country":      location_info.get("country", ""),
            "country_code": location_info.get("country_code", ""),
            "admin1":       location_info.get("admin1", ""),
            "latitude":     latitude,
            "longitude":    longitude,
        },
        "current":  current,
        "hourly":   hourly_forecast,
        "daily":    daily_forecast,
        "air_quality": {
            "aqi":       air_quality.get("aqi"),
            "aqi_label": aqi_label,
            "pm2_5":     air_quality.get("pm2_5"),
            "pm10":      air_quality.get("pm10"),
        },
        "timezone":      timezone,
        "timezone_abbr": timezone_abbr,
    }

    return result, None


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.route("/")
def home():
    """
    Main page route — just renders the HTML template.
    Actual data loading is done via JavaScript + /location or /search.
    """
    return render_template("index.html")


@app.route("/search", methods=["POST"])
def search():
    """
    Handle city search requests from the frontend.

    Expects JSON body: { "city": "Jaipur" }
    Returns JSON with full weather data or an error message.
    """
    data = request.get_json()

    if not data or "city" not in data:
        return jsonify({"error": "No city provided."}), 400

    city_name = data["city"].strip()

    # Basic validation — don't allow empty or very long strings
    if not city_name or len(city_name) > 100:
        return jsonify({"error": "Invalid city name."}), 400

    # Step 1: Geocode the city
    location = geocode_city(city_name)

    if location is None:
        return jsonify({"error": f"City '{city_name}' not found. Please try another city."}), 404

    # Step 2: Get weather for those coordinates
    weather, error = assemble_weather_response(
        location["latitude"],
        location["longitude"],
        location
    )

    if error:
        return jsonify({"error": error}), 500

    return jsonify(weather)


@app.route("/location", methods=["POST"])
def location():
    """
    Handle automatic location requests from the browser.

    Expects JSON body: { "latitude": 26.9, "longitude": 75.8 }
    Returns JSON with full weather data.
    """
    data = request.get_json()

    if not data:
        return jsonify({"error": "No location data received."}), 400

    try:
        lat = float(data.get("latitude"))
        lon = float(data.get("longitude"))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid coordinates."}), 400

    # Validate coordinate ranges
    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        return jsonify({"error": "Coordinates out of valid range."}), 400

    # Step 1: Reverse geocode to find the city name
    location_info = reverse_geocode(lat, lon)

    # Step 2: Get weather data
    weather, error = assemble_weather_response(lat, lon, location_info)

    if error:
        return jsonify({"error": error}), 500

    return jsonify(weather)


# ─────────────────────────────────────────────
# Run the App
# ─────────────────────────────────────────────
if __name__ == "__main__":
    # host="0.0.0.0" makes Flask listen on ALL network interfaces,
    # not just 127.0.0.1 (localhost). This allows other devices on
    # the same Wi-Fi (e.g. your phone) to access the app using
    # your PC's LAN IP address, e.g. http://192.168.1.5:5000
    #
    # Find your PC's LAN IP by running:  ipconfig
    # Look for the Wi-Fi adapter's "IPv4 Address".
    #
    # SECURITY: This is fine on a trusted home/college network.
    # Do NOT run with debug=True on a public or shared network.
    app.run(host="0.0.0.0", port=5000, debug=True)