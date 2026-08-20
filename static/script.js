/**
 * WeatherHub — script.js
 * Developer: Lakshya Vijay Singh
 *
 * Handles:
 *  - Auto-location detection via browser GPS
 *  - City search
 *  - Dashboard rendering (current, hourly, daily, AQI, map, details)
 *  - Leaflet interactive map
 *  - Dark / Light mode toggle (saved in localStorage)
 *  - Live digital clock
 *  - Refresh button
 *  - Scroll-to-top button
 */

"use strict";

// ─────────────────────────────────────────────
// State — remembers the current city/location
// so the Refresh button knows what to reload.
// ─────────────────────────────────────────────
const state = {
    currentCity:      null,   // "Jaipur" — set when a city is searched
    currentLat:       null,   // numeric latitude
    currentLon:       null,   // numeric longitude
    usingGeoLocation: false,  // true = loaded from browser GPS
    map:              null,   // Leaflet map instance
    marker:           null,   // Leaflet marker instance
};


// ─────────────────────────────────────────────
// DOM References — everything we update on the page
// ─────────────────────────────────────────────
const dom = {
    loadingOverlay:  document.getElementById("loading-overlay"),
    loadingText:     document.getElementById("loading-text"),
    errorBanner:     document.getElementById("error-banner"),
    errorMessage:    document.getElementById("error-message"),
    errorCloseBtn:   document.getElementById("error-close-btn"),
    locationDenied:  document.getElementById("location-denied"),
    dashboard:       document.getElementById("dashboard"),
    scrollTopBtn:    document.getElementById("scroll-top-btn"),

    searchInput:     document.getElementById("search-input"),
    searchBtn:       document.getElementById("search-btn"),

    digitalClock:    document.getElementById("digital-clock"),
    themeToggleBtn:  document.getElementById("theme-toggle-btn"),
    themeIcon:       document.getElementById("theme-icon"),
    refreshBtn:      document.getElementById("refresh-btn"),

    // Current weather
    cityName:        document.getElementById("city-name"),
    weatherDate:     document.getElementById("weather-date"),
    lastUpdated:     document.getElementById("last-updated"),
    mainWeatherIcon: document.getElementById("main-weather-icon"),
    currentTemp:     document.getElementById("current-temp"),
    weatherDesc:     document.getElementById("weather-description"),
    feelsLike:       document.getElementById("feels-like"),

    // Badge pills
    badgeAqi:        document.getElementById("badge-aqi"),
    badgeWind:       document.getElementById("badge-wind"),
    badgeHumidity:   document.getElementById("badge-humidity"),
    badgeUv:         document.getElementById("badge-uv"),
    badgePressure:   document.getElementById("badge-pressure"),
    badgeVisibility: document.getElementById("badge-visibility"),
    badgeCloud:      document.getElementById("badge-cloud"),
    badgeWindDir:    document.getElementById("badge-wind-dir"),

    // Map
    mapLat:          document.getElementById("map-lat"),
    mapLon:          document.getElementById("map-lon"),

    // Air Quality
    aqiLabelBadge:   document.getElementById("aqi-label-badge"),
    aqAqi:           document.getElementById("aq-aqi"),
    aqPm25:          document.getElementById("aq-pm25"),
    aqPm10:          document.getElementById("aq-pm10"),
    aqStatus:        document.getElementById("aq-status"),

    // Forecast containers
    dailyGrid:       document.getElementById("daily-forecast-grid"),
    hourlyRow:       document.getElementById("hourly-forecast-row"),

    // Weather detail items
    dHumidity:  document.getElementById("d-humidity"),
    dPressure:  document.getElementById("d-pressure"),
    dWind:      document.getElementById("d-wind"),
    dWindDir:   document.getElementById("d-wind-dir"),
    dVisibility:document.getElementById("d-visibility"),
    dCloud:     document.getElementById("d-cloud"),
    dUv:        document.getElementById("d-uv"),
    dSunrise:   document.getElementById("d-sunrise"),
    dSunset:    document.getElementById("d-sunset"),
};


// ─────────────────────────────────────────────
// Formatting Helpers
// ─────────────────────────────────────────────

/**
 * Format a number to a string. Returns "N/A" if null/undefined.
 * Use decimals > 0 to fix decimal places.
 */
function fmt(value, decimals = 0) {
    if (value === null || value === undefined) return "N/A";
    if (typeof value === "number") {
        return decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();
    }
    return String(value);
}

/**
 * Convert API datetime string "YYYY-MM-DDTHH:MM" → "6:00 PM"
 */
function fmtTime(datetimeStr) {
    if (!datetimeStr) return "N/A";
    try {
        const timePart = datetimeStr.split("T")[1];
        if (!timePart) return datetimeStr;

        const [hourStr, minuteStr] = timePart.split(":");
        let hour = parseInt(hourStr, 10);
        const ampm = hour >= 12 ? "PM" : "AM";
        hour = hour % 12 || 12;
        return `${String(hour).padStart(2, "0")}:${minuteStr} ${ampm}`;
    } catch (e) {
        return datetimeStr;
    }
}

/**
 * Convert "YYYY-MM-DD" → "Monday, 19 Aug 2026"
 */
function fmtDate(dateStr) {
    if (!dateStr) return "N/A";
    try {
        const [year, month, day] = dateStr.split("-").map(Number);
        const d = new Date(year, month - 1, day);
        return d.toLocaleDateString("en-US", {
            weekday: "long", day: "numeric", month: "short", year: "numeric"
        });
    } catch (e) {
        return dateStr;
    }
}

/** Return a CSS color string based on AQI value for visual feedback */
function getAqiColor(aqi) {
    if (aqi === null || aqi === undefined) return "#94A3B8";
    if (aqi <= 50)  return "#34D399"; // Good
    if (aqi <= 100) return "#FBBF24"; // Moderate
    if (aqi <= 150) return "#FB923C"; // Unhealthy for Sensitive
    if (aqi <= 200) return "#F87171"; // Unhealthy
    return "#C084FC";                 // Very Unhealthy / Hazardous
}


// ─────────────────────────────────────────────
// Loading & Error UI
// ─────────────────────────────────────────────

function showLoading(message = "Loading weather...") {
    dom.loadingText.textContent = message;
    dom.loadingOverlay.classList.remove("hidden");
    // Spin the refresh icon
    dom.refreshBtn.querySelector("i").classList.add("refreshing");
}

function hideLoading() {
    dom.loadingOverlay.classList.add("hidden");
    dom.refreshBtn.querySelector("i").classList.remove("refreshing");
}

function showError(message) {
    dom.errorMessage.textContent = message;
    dom.errorBanner.classList.remove("hidden");
    // Auto-dismiss after 6 seconds
    setTimeout(() => dom.errorBanner.classList.add("hidden"), 6000);
}

function showLocationDenied() {
    dom.locationDenied.classList.remove("hidden");
}

function hideLocationDenied() {
    dom.locationDenied.classList.add("hidden");
}


// ─────────────────────────────────────────────
// Leaflet Map
// ─────────────────────────────────────────────

/** Initialize or update the Leaflet map.
 * IMPORTANT: Always call this AFTER the map container is visible.
 * Leaflet reads the container's computed pixel size at creation time.
 * If the container has display:none, Leaflet gets 0×0 and tiles won't load.
 */
function initMap(lat, lon, cityLabel) {
    if (state.map) {
        updateMap(lat, lon, cityLabel);
        return;
    }

    // Create the map centered at given coordinates
    state.map = L.map("map", {
        center: [lat, lon],
        zoom: 10,
        zoomControl: true,
    });

    // OpenStreetMap tile layer (free, no API key needed)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
    }).addTo(state.map);

    // Add a marker with a popup
    state.marker = L.marker([lat, lon])
        .addTo(state.map)
        .bindPopup(`<strong>${cityLabel}</strong>`)
        .openPopup();

    // Force Leaflet to recalculate the container size.
    // This is the key fix: even after requestAnimationFrame, some browsers
    // need an explicit nudge to repaint tile positions correctly.
    setTimeout(function () {
        if (state.map) {
            state.map.invalidateSize();
        }
    }, 100);
}

/** Pan the map to a new location and update the marker */
function updateMap(lat, lon, cityLabel) {
    if (!state.map) {
        initMap(lat, lon, cityLabel);
        return;
    }

    state.map.setView([lat, lon], 10);

    if (state.marker) {
        state.marker.setLatLng([lat, lon]);
        state.marker.getPopup().setContent(`<strong>${cityLabel}</strong>`);
        state.marker.openPopup();
    } else {
        state.marker = L.marker([lat, lon])
            .addTo(state.map)
            .bindPopup(`<strong>${cityLabel}</strong>`)
            .openPopup();
    }

    dom.mapLat.textContent = lat.toFixed(4);
    dom.mapLon.textContent = lon.toFixed(4);

    // Also invalidate on update (e.g. city search after map is visible)
    setTimeout(function () {
        if (state.map) {
            state.map.invalidateSize();
        }
    }, 50);
}


// ─────────────────────────────────────────────
// Dashboard Rendering
// All data comes from the Flask JSON response.
// ─────────────────────────────────────────────

function renderDashboard(data) {
    const { location, current, hourly, daily, air_quality } = data;

    // ── Location ─────────────────────────────────────────────────
    const city    = location.city    || "Unknown";
    const country = location.country || "";
    const admin1  = location.admin1  || "";

    // Format: "Jaipur, <span class='country-inline'>India</span>"
    const countryDisplay = country
        ? `, <span class="country-inline">${country}</span>`
        : "";
    dom.cityName.innerHTML = city + countryDisplay;

    // ── Date ─────────────────────────────────────────────────────
    // Use current real date
    const now = new Date();
    const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
    const dayNum  = now.getDate();
    const month   = now.toLocaleDateString("en-US", { month: "short" });
    const year    = now.getFullYear();
    dom.weatherDate.textContent = `${dayName}, ${dayNum} ${month} ${year}`;

    // Last updated time from API
    if (current.time) {
        dom.lastUpdated.textContent = `Updated: ${fmtTime(current.time)}`;
    }

    // ── Temperature & Condition ───────────────────────────────────
    dom.currentTemp.textContent = fmt(current.temperature);
    dom.weatherDesc.textContent = current.description || "--";
    dom.feelsLike.textContent   = fmt(current.feels_like) + "°";

    // Update the big weather icon class
    dom.mainWeatherIcon.className = `fa-solid ${current.icon} weather-icon-large`;

    // ── Badge Pills ───────────────────────────────────────────────
    const aqiVal = air_quality.aqi;
    dom.badgeAqi.textContent = aqiVal !== null && aqiVal !== undefined ? aqiVal : "N/A";
    dom.badgeWind.textContent = fmt(current.wind_speed);
    dom.badgeHumidity.textContent = fmt(current.humidity);
    dom.badgeUv.textContent = current.uv_index !== null && current.uv_index !== undefined
        ? Number(current.uv_index).toFixed(2)
        : "N/A";
    dom.badgePressure.textContent = current.pressure !== null && current.pressure !== undefined
        ? Number(current.pressure).toFixed(1)
        : "N/A";
    dom.badgeVisibility.textContent = current.visibility_km !== null
        ? Number(current.visibility_km).toFixed(1)
        : "N/A";
    dom.badgeCloud.textContent  = fmt(current.cloud_cover);
    dom.badgeWindDir.textContent = current.wind_dir_label || "N/A";



    // ── Air Quality ───────────────────────────────────────────────
    dom.aqAqi.textContent   = aqiVal !== null && aqiVal !== undefined ? aqiVal : "N/A";
    dom.aqPm25.textContent  = air_quality.pm2_5 !== null && air_quality.pm2_5 !== undefined
        ? Number(air_quality.pm2_5).toFixed(1) + " μg/m³"
        : "N/A";
    dom.aqPm10.textContent  = air_quality.pm10 !== null && air_quality.pm10 !== undefined
        ? Number(air_quality.pm10).toFixed(1) + " μg/m³"
        : "N/A";
    dom.aqStatus.textContent = air_quality.aqi_label || "N/A";
    dom.aqiLabelBadge.textContent = air_quality.aqi_label || "N/A";

    // Color the AQI badge dynamically
    if (aqiVal !== null && aqiVal !== undefined) {
        const c = getAqiColor(aqiVal);
        dom.aqiLabelBadge.style.color       = c;
        dom.aqiLabelBadge.style.borderColor = c + "55";
        dom.aqiLabelBadge.style.background  = c + "22";
    }

    // ── Forecasts ─────────────────────────────────────────────────
    renderDailyForecast(daily);
    renderHourlyForecast(hourly);

    // ── Weather Details ───────────────────────────────────────────
    dom.dHumidity.textContent  = fmt(current.humidity) + "%";
    dom.dPressure.textContent  = (current.pressure !== null && current.pressure !== undefined)
        ? Number(current.pressure).toFixed(1) + " hPa"
        : "N/A";
    dom.dWind.textContent      = fmt(current.wind_speed) + " km/h";
    dom.dWindDir.textContent   = "Direction: " + (current.wind_dir_label || "N/A");
    dom.dVisibility.textContent = (current.visibility_km !== null)
        ? Number(current.visibility_km).toFixed(1) + " km"
        : "N/A";
    dom.dCloud.textContent = fmt(current.cloud_cover) + "%";
    dom.dUv.textContent    = (current.uv_index !== null && current.uv_index !== undefined)
        ? Number(current.uv_index).toFixed(2)
        : "N/A";

    // Sunrise & Sunset from the first daily entry
    if (daily.length > 0) {
        dom.dSunrise.textContent = fmtTime(daily[0].sunrise);
        dom.dSunset.textContent  = fmtTime(daily[0].sunset);
    } else {
        dom.dSunrise.textContent = "N/A";
        dom.dSunset.textContent  = "N/A";
    }

    // ── Show the dashboard FIRST so the map container has real dimensions ──
    // Leaflet measures the container size at init time.
    // If the container is still display:none, it gets 0×0 and renders broken.
    dom.dashboard.classList.remove("hidden");

    // ── Map ───────────────────────────────────────────────────────────────
    const lat = location.latitude;
    const lon = location.longitude;
    dom.mapLat.textContent = lat.toFixed(4);
    dom.mapLon.textContent = lon.toFixed(4);

    // Use requestAnimationFrame so the browser paints the revealed dashboard
    // before Leaflet reads the container's pixel size.
    requestAnimationFrame(function () {
        initMap(lat, lon, city);
    });
}


/** Build the 7-day forecast day cards */
function renderDailyForecast(daily) {
    dom.dailyGrid.innerHTML = "";

    daily.forEach(function (day, index) {
        const card = document.createElement("div");
        card.className = "day-card" + (index === 0 ? " today" : "");

        const dayLabel = index === 0 ? "Today" : day.day_name;

        const maxTemp = day.max_temp !== null ? Math.round(day.max_temp) : "--";
        const minTemp = day.min_temp !== null ? Math.round(day.min_temp) : "--";

        const rainHTML = (day.rain_prob !== null && day.rain_prob !== undefined)
            ? `<span class="day-rain">
                   <i class="fa-solid fa-droplet"></i>
                   ${Math.round(day.rain_prob)}%
               </span>`
            : "";

        card.innerHTML = `
            <p class="day-name">${dayLabel}</p>
            <i class="fa-solid ${day.icon} day-icon"></i>
            <p class="day-temp-range">
                <span class="temp-min">${minTemp}°</span>
                &nbsp;
                <span class="temp-max">${maxTemp}°</span>
            </p>
            ${rainHTML}
        `;

        dom.dailyGrid.appendChild(card);
    });
}


/** Build the 24-hour forecast scrollable row */
function renderHourlyForecast(hourly) {
    dom.hourlyRow.innerHTML = "";

    hourly.forEach(function (hour, index) {
        const item = document.createElement("div");

        // Mark the first entry (nearest to now) as current hour
        const isCurrent = (index === 0);
        item.className = "hourly-item" + (isCurrent ? " current-hour" : "");

        const timeLabel = hour.time ? fmtTime(hour.time) : "--";
        const temp      = hour.temp !== null ? Math.round(hour.temp) : "--";

        const rainHTML = (hour.rain_prob !== null && hour.rain_prob !== undefined)
            ? `<span class="hourly-rain">
                   <i class="fa-solid fa-droplet"></i>${Math.round(hour.rain_prob)}%
               </span>`
            : `<span class="hourly-rain">--</span>`;

        item.innerHTML = `
            <p class="hourly-time">${timeLabel}</p>
            <i class="fa-solid ${hour.icon} hourly-icon"></i>
            <p class="hourly-temp">${temp}°</p>
            ${rainHTML}
        `;

        dom.hourlyRow.appendChild(item);
    });
}


// ─────────────────────────────────────────────
// API Fetch Functions
// These talk to our Flask backend.
// ─────────────────────────────────────────────

/**
 * POST /search — fetch weather by city name
 */
async function fetchWeatherByCity(cityName) {
    showLoading(`Getting weather for ${cityName}...`);
    hideLocationDenied();

    try {
        const response = await fetch("/search", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ city: cityName }),
        });

        const data = await response.json();

        if (!response.ok) {
            showError(data.error || "Failed to get weather. Please try again.");
            return;
        }

        // Save state for refresh
        state.currentCity      = cityName;
        state.currentLat       = data.location.latitude;
        state.currentLon       = data.location.longitude;
        state.usingGeoLocation = false;

        renderDashboard(data);

    } catch (err) {
        showError("Network error. Please check your internet connection.");
    } finally {
        hideLoading();
    }
}


/**
 * POST /location — fetch weather by GPS coordinates
 */
async function fetchWeatherByCoords(lat, lon) {
    showLoading("Detecting your location...");

    try {
        const response = await fetch("/location", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ latitude: lat, longitude: lon }),
        });

        const data = await response.json();

        if (!response.ok) {
            showError(data.error || "Could not get weather for your location.");
            showLocationDenied();
            return;
        }

        // Save state for refresh
        state.currentLat       = lat;
        state.currentLon       = lon;
        state.usingGeoLocation = true;
        state.currentCity      = data.location.city;

        renderDashboard(data);

    } catch (err) {
        showError("Network error. Please check your internet connection.");
        showLocationDenied();
    } finally {
        hideLoading();
    }
}


// ─────────────────────────────────────────────
// Automatic Location Detection
// Asks the browser for GPS coordinates.
// ─────────────────────────────────────────────

function detectLocation() {
    if (!navigator.geolocation) {
        // Browser doesn't support geolocation at all
        hideLoading();
        showLocationDenied();
        return;
    }

    showLoading("Detecting your location...");

    navigator.geolocation.getCurrentPosition(
        // Success — we have coordinates
        function (position) {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            fetchWeatherByCoords(lat, lon);
        },

        // Error — user denied or timed out
        function (error) {
            hideLoading();
            showLocationDenied();
            console.warn("Geolocation error:", error.message);
        },

        {
            timeout:            10000,   // 10 second timeout
            maximumAge:         300000,  // Accept a cached position up to 5 min old
            enableHighAccuracy: false    // Don't need GPS precision for weather
        }
    );
}


// ─────────────────────────────────────────────
// Refresh
// ─────────────────────────────────────────────

function refreshWeather() {
    if (state.usingGeoLocation && state.currentLat !== null) {
        // Re-fetch using last GPS coordinates
        fetchWeatherByCoords(state.currentLat, state.currentLon);
    } else if (state.currentCity) {
        // Re-fetch using last searched city
        fetchWeatherByCity(state.currentCity);
    } else {
        // Nothing loaded yet — try auto-detect
        detectLocation();
    }
}


// ─────────────────────────────────────────────
// Live Digital Clock
// Updates every second
// ─────────────────────────────────────────────

function updateClock() {
    const now   = new Date();
    let hours   = now.getHours();
    const mins  = String(now.getMinutes()).padStart(2, "0");
    const secs  = String(now.getSeconds()).padStart(2, "0");
    const ampm  = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    dom.digitalClock.textContent = `${String(hours).padStart(2,"0")}:${mins}:${secs} ${ampm}`;
}

updateClock();
setInterval(updateClock, 1000);


// ─────────────────────────────────────────────
// Dark / Light Mode
// ─────────────────────────────────────────────

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    dom.themeIcon.className = theme === "dark"
        ? "fa-solid fa-moon"
        : "fa-solid fa-sun";
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next    = current === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem("weatherhub-theme", next);
}

function loadSavedTheme() {
    const saved = localStorage.getItem("weatherhub-theme") || "dark";
    applyTheme(saved);
}


// ─────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────

function handleSearch() {
    const city = dom.searchInput.value.trim();
    if (!city) {
        showError("Please enter a city name.");
        dom.searchInput.focus();
        return;
    }
    dom.searchInput.value = "";
    fetchWeatherByCity(city);
}


// ─────────────────────────────────────────────
// Scroll-to-Top Button
// ─────────────────────────────────────────────

function handleScroll() {
    if (window.scrollY > 300) {
        dom.scrollTopBtn.classList.add("visible");
    } else {
        dom.scrollTopBtn.classList.remove("visible");
    }
}

dom.scrollTopBtn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener("scroll", handleScroll);

// Debounced resize handler — calls Leaflet's invalidateSize() so the map
// repaints correctly when the browser window is resized or the phone is rotated.
let _resizeTimer = null;
window.addEventListener("resize", function () {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(function () {
        if (state.map) {
            state.map.invalidateSize();
        }
    }, 200);
});



// ─────────────────────────────────────────────
// Event Listeners
// ─────────────────────────────────────────────

dom.searchBtn.addEventListener("click", handleSearch);

dom.searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") handleSearch();
});

dom.errorCloseBtn.addEventListener("click", function () {
    dom.errorBanner.classList.add("hidden");
});

dom.refreshBtn.addEventListener("click", refreshWeather);
dom.themeToggleBtn.addEventListener("click", toggleTheme);


// ─────────────────────────────────────────────
// Page Initialization
// ─────────────────────────────────────────────

function init() {
    loadSavedTheme();    // Apply stored dark/light preference
    detectLocation();    // Try auto-detect location
}

document.addEventListener("DOMContentLoaded", init);
