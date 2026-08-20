# WeatherHub 🌤️

A **modern, real-time weather dashboard** built with Python and Flask. Automatically detects your location on first load, shows current conditions, a 7-day forecast, a 24-hour timeline, air quality data, and an interactive map.

> **Developer:** Lakshya Vijay Singh  
> **Stack:** Python · Flask · HTML · CSS · Vanilla JavaScript  
> **APIs:** Open-Meteo (weather + geocoding + air quality) · OpenStreetMap (map tiles via Leaflet.js)

---

## Features

- 🌍 **Automatic location detection** — browser requests your GPS and loads weather instantly
- 🔍 **City search** — search any city worldwide (Jaipur, Delhi, Tokyo, New York, etc.)
- 🌡️ **Current weather** — temperature, feels like, humidity, wind, UV index, pressure, visibility, cloud cover
- 📅 **7-day forecast** — daily high/low, condition, rain probability (horizontally scrollable on mobile)
- ⏱️ **24-hour timeline** — hourly temperature and rain probability in a scrollable row
- 💨 **Air Quality** — AQI, PM2.5, PM10, quality label
- 🗺️ **Interactive map** — Leaflet.js + OpenStreetMap, updates with each city
- 🌙 **Dark / Light mode** — toggle, saved in browser storage
- 🕐 **Live digital clock** — updates every second
- 🔄 **Refresh button** — reloads data without a full page reload
- 📱 **Responsive design** — works on desktop, tablet, and mobile
- ❌ **No API key required** — Open-Meteo is completely free and open

---

## How It Works

1. When the page opens, JavaScript asks the browser for your GPS coordinates.
2. If permission is granted, the coordinates are sent to `/location` on the Flask backend.
3. Flask calls the **Nominatim reverse geocoding API** to find your city name.
4. Flask calls the **Open-Meteo Forecast API** for current, hourly, and daily weather.
5. Flask calls the **Open-Meteo Air Quality API** for AQI, PM2.5, PM10.
6. All data is returned as JSON and JavaScript fills the dashboard.
7. If location is denied, you can search any city using the search bar — this hits `/search`.

---

## APIs Used

| API | Purpose | Key Required? |
|-----|---------|---------------|
| [Open-Meteo Forecast](https://open-meteo.com/) | Weather data | ❌ No |
| [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) | City name → coordinates | ❌ No |
| [Open-Meteo Air Quality](https://open-meteo.com/en/docs/air-quality-api) | AQI, PM2.5, PM10 | ❌ No |
| [Nominatim (OpenStreetMap)](https://nominatim.org/) | Coordinates → city name | ❌ No |
| [Leaflet.js + OpenStreetMap](https://leafletjs.com/) | Interactive map | ❌ No |

---

## Project Structure

```
weather_app/
│
├── app.py                 # Flask backend — all routes and API helpers
├── requirements.txt       # Python packages
├── .gitignore             # Files excluded from Git
├── README.md              # This file
│
├── templates/
│   └── index.html         # Main HTML page
│
└── static/
    ├── style.css          # All styling, dark/light mode variables
    └── script.js          # All JavaScript — location, search, rendering, map
```

---

## Installation & Setup

### 1. Clone or download the project

```bash
git clone <your-repo-url>
cd weather_app
```

### 2. Create a virtual environment

```powershell
py -m venv venv
```

### 3. Install dependencies

> **Note for PowerShell users:** If `.\venv\Scripts\Activate.ps1` gives an error about execution policy, you can skip activation entirely and just call the Python interpreter directly:

```powershell
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

Or if using Command Prompt:
```cmd
venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 4. Run the application

```powershell
.\venv\Scripts\python.exe app.py
```

Or with activation (if PowerShell policy allows):
```powershell
.\venv\Scripts\Activate.ps1
python app.py
```

### 5. Open in browser — on this PC

```
http://127.0.0.1:5000
```

---

## 📱 Accessing WeatherHub from Your Phone (Same Wi-Fi)

The app is configured to listen on **all network interfaces** (`host="0.0.0.0"`), so any device on your local Wi-Fi network can reach it.

### Step 1 — Start Flask

```powershell
.\venv\Scripts\python.exe app.py
```

You should see output like:
```
 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:5000
 * Running on http://192.168.x.x:5000
```

### Step 2 — Find your PC's IPv4 address

Open a new PowerShell or Command Prompt window and run:

```powershell
ipconfig
```

Look for the **Wi-Fi adapter** section and note the **IPv4 Address**. Example:

```
Wireless LAN adapter Wi-Fi:
   IPv4 Address. . . . . . : 192.168.1.5
```

### Step 3 — Open on your phone

On your phone, connected to the **same Wi-Fi network**, open a browser and go to:

```
http://<YOUR_PC_IPv4>:5000
```

For example:
```
http://192.168.1.5:5000
```

> ⚠️ **Both your PC and phone must be on the same Wi-Fi network.**  
> The app will NOT be accessible from a different network or via mobile data.

---

## 🔥 Windows Firewall — Allow Port 5000

If your phone cannot reach the app, Windows Firewall may be blocking the connection.
Run the following command **once** in PowerShell as Administrator to create an inbound rule:

```powershell
netsh advfirewall firewall add rule name="WeatherHub Flask 5000" dir=in action=allow protocol=TCP localport=5000 profile=private
```

This creates a **Private network only** rule — it will NOT expose port 5000 to the internet or public networks.

To **remove** the rule later:
```powershell
netsh advfirewall firewall delete rule name="WeatherHub Flask 5000"
```

---

## Browser Location Permission

When you open the app for the first time:

- Your browser will ask: **"Allow this site to access your location?"**
- Click **Allow** to get automatic weather for your current location.
- Click **Block** if you prefer — the search bar will appear so you can type any city.

> **Note:** Location permission in Chrome/Edge only works on `localhost` or HTTPS. It will not work over plain HTTP on a remote server.

---

## Searching Cities

Type any city name in the search bar at the top and press **Enter** or click the search button.

Supported examples:
- `Jaipur`
- `Delhi`
- `Mumbai`
- `London`
- `New York`
- `Tokyo`
- `Dubai`
- Any valid city worldwide

---

## GitHub Configuration

To link to your GitHub profile:

1. Open `templates/index.html`
2. Find the comment that says:
   ```html
   <!-- CONFIGURE YOUR GITHUB URL BELOW -->
   ```
3. Change the `href="#"` on the `<a>` tag to your actual GitHub URL:
   ```html
   href="https://github.com/your-username"
   ```

---

## Requirements

```
Flask==3.1.3
requests==2.34.2
```

---

## GitHub Ready?

Yes. The `.gitignore` excludes:

- `venv/` — never commit the virtual environment
- `__pycache__/` and `*.pyc` — Python bytecode
- `.env` — secrets file (not used in this project, but good practice)
- `.vscode/` — editor settings

---

## License

This project was built as a college learning project.  
Feel free to use, modify, and learn from it.

---

*Built with ❤️ by Lakshya Vijay Singh*
