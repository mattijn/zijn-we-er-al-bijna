# 🚗 Zijn we er al bijna?

**De eeuwige vraag van kinderen op de achterbank tijdens lange autoreizen naar de vakantiebestemming.**

Een kindvriendelijke reisvoortgang-app specifiek ontworpen voor kinderen van 4-12 jaar die nog niet kunnen klokkijken of afstanden begrijpen, maar wel graag willen weten hoe ver ze nog moeten reizen.

## 🎯 Doelgroep & Probleemstelling

**Doelgroep:** Kinderen op de achterbank van de auto tijdens lange autoreizen (zomer- en wintervakanties, weekendtrips)

**Het Probleem:**
- Kinderen kunnen nog niet goed klokkijken of afstanden inschatten
- Standaard navigatie-apps zijn te complex en volwassen-georiënteerd
- Ouders worden constant gevraagd "zijn we er al bijna?" en "hoe lang duurt het nog?"
- Kinderen hebben behoefte aan visuele feedback die ze kunnen begrijpen

**De Oplossing:**
Een kindvriendelijke reisvoortgang-app die:
- **Visuele progress bars** toont met herkenbare iconen (🚗, 🏁, 📍)
- **Eenvoudige statistieken** gebruikt die kinderen begrijpen
- **Grote, duidelijke getallen** toont die makkelijk leesbaar zijn
- **Speelse animaties** heeft die de reis leuker maken
- **Tussenstops** ondersteunt voor toiletpauzes en tankstops

## ✨ Features

### 🎨 Kindvriendelijk Design
- **Grote knoppen** en touch targets (minimaal 44px)
- **Helder contrast** en leesbare fonts
- **Intuïtieve iconen** in plaats van complexe tekst
- **Directe feedback** bij elke actie
- **Veilige kleuren** die niet te fel of afleidend zijn

### 📱 Mobile-First & PWA
- **Progressive Web App** - installeerbaar op alle apparaten
- **Offline capable** - werkt ook zonder internetverbinding
- **Wake Lock API** - voorkomt scherm uitval tijdens reis
- **Responsive design** - werkt op alle schermformaten
- **Touch-optimized** - perfect voor tablets en smartphones

### 🗺️ Slimme Navigatie
- **Automatische GPS tracking** - geen handmatige updates nodig
- **Real-time voortgang** - live updates van je positie
- **Tussenstop ondersteuning** - voor toiletpauzes en tankstops
- **Betrouwbare route-berekeningen** - gebaseerd op echte data
- **Fallback geocoding** - meerdere services voor betrouwbaarheid

### 📊 Eenvoudige Statistieken
- **⏰ Tijd resterend** - in uren en minuten
- **🚗 Gereisd** - afstand vanaf start
- **📊 Voortgang** - percentage van totale reis
- **📏 Afstand resterend** - kilometers naar bestemming
- **⏸️ Volgende stop over** - tijd naar tussenstop

## 🚀 Snel Starten

### Online Gebruiken
1. Ga naar [de app](https://jouw-domein.nl) in je browser
2. Voer je eindbestemming in
3. Klik op "🚗 Start Reis"
4. Geef locatie-toegang toe
5. Geniet van je reis! 🎉

### Installeren als App
1. Open de app in Chrome/Safari
2. Klik op "Installer" of "Toevoegen aan startscherm"
3. De app wordt geïnstalleerd als een native app
4. Start de app vanaf je startscherm

### Lokaal Draaien
```bash
# Clone de repository
git clone https://github.com/jouw-username/zijnweeralbijna.git
cd zijnweeralbijna

# Start een lokale server (Python 3)
python -m http.server 8000

# Of met Node.js
npx serve .

# Open in browser
open http://localhost:8000
```

## 📖 Gebruik

### Nieuwe Reis Starten
1. **Voer eindbestemming in** - bijvoorbeeld "Efteling" of "Amsterdam Centraal"
2. **Optioneel: voeg tussenstop toe** - voor toiletpauzes of tankstops
3. **Klik "🚗 Start Reis"** - de app vraagt om locatie-toegang
4. **Geef toegang toe** - voor real-time tracking
5. **Reis wordt gestart** - progress bars en statistieken worden actief

### Tijdens de Reis
- **Progress bars** tonen je voortgang visueel
- **Statistieken** worden elke 30 seconden bijgewerkt
- **Tussenstop info** is beschikbaar als je er een hebt ingesteld
- **App blijft actief** in de achtergrond

### Tussenstop Toevoegen
1. **Klik op "⚙️"** om terug te gaan naar setup
2. **Voer tussenstop in** - bijvoorbeeld "Tankstation"
3. **Klik "🔄 Update Stop"**
4. **Nieuwe progress bar** verschijnt voor tussenstop

### Reis Beëindigen
- **"⏹️ Stop Reis"** - pauzeert de reis
- **"🔄 Reset"** - wist alle data en start opnieuw

## 🏗️ Technische Architectuur

### Core Modules
- **TripApp** - Hoofdmodule, coördineert alles
- **GeolocationManager** - GPS tracking en geocoding
- **ProgressTracker** - Voortgang berekeningen
- **StorageManager** - Data persistentie

### External APIs
- **OSRM** - Route berekeningen
- **Nominatim** - Geocoding (hoofdservice)
- **Maps.co** - Geocoding (fallback)

### Browser APIs
- **Geolocation API** - GPS tracking
- **Screen Wake Lock API** - Voorkom scherm uitval
- **Local Storage API** - Data opslag
- **Viewport API** - Dynamic height

## 🎨 Design Filosofie

### Companion Device Concept
- **Naast de satnav** - geen vervanging, maar aanvulling
- **Glance-able interface** - alle info in één oogopslag zichtbaar
- **Geen scrolling** - alles past op één scherm

### Kinderen-First Design
- **Grote knoppen** en touch targets (minimaal 44px)
- **Helder contrast** en leesbare fonts
- **Intuïtieve iconen** in plaats van complexe tekst
- **Directe feedback** bij elke actie
- **Veilige kleuren** die niet te fel of afleidend zijn

### Ouders-Vriendelijk
- **Eenvoudige setup** - alleen eindbestemming invoeren
- **Automatische GPS tracking** - geen handmatige updates nodig
- **Tussenstop ondersteuning** - voor toiletpauzes en tankstops
- **Betrouwbare data** - gebaseerd op echte route-berekeningen
- **Non-intrusive** - geen afleiding van het rijden

## 🔧 Ontwikkeling

### Project Structuur
```
zijnweeralbijna/
├── index.html          # Hoofdbestand
├── styles.css          # Styling
├── manifest.json       # PWA manifest
├── plan.md            # Architectuur documentatie
├── README.md          # Deze file
├── js/
│   ├── app.js         # Hoofdmodule (TripApp)
│   ├── geolocation.js # GPS & geocoding
│   ├── progress.js    # Voortgang tracking
│   └── storage.js     # Data persistentie
└── .gitignore         # Git ignore regels
```

### Browser Ondersteuning
- **Chrome** 80+ (volledig ondersteund)
- **Safari** 13+ (volledig ondersteund)
- **Firefox** 75+ (volledig ondersteund)
- **Edge** 80+ (volledig ondersteund)

### Performance
- **Lazy loading** - alleen laden wat nodig is
- **Efficient DOM** - minimale reflows
- **Debounced updates** - voorkom te veel API calls
- **Cached positions** - hergebruik recente GPS data

## 🤝 Bijdragen

We verwelkomen bijdragen! Hier zijn enkele manieren om te helpen:

### Bug Reports
- Gebruik de GitHub Issues
- Beschrijf het probleem duidelijk
- Voeg screenshots toe indien mogelijk

### Feature Requests
- Open een GitHub Issue
- Beschrijf de gewenste functionaliteit
- Leg uit waarom het nuttig zou zijn

### Code Bijdragen
1. Fork de repository
2. Maak een feature branch
3. Commit je wijzigingen
4. Push naar je fork
5. Open een Pull Request

### Lokale Ontwikkeling
```bash
# Setup
git clone https://github.com/jouw-username/zijnweeralbijna.git
cd zijnweeralbijna

# Start development server
python -m http.server 8000

# Open in browser
open http://localhost:8000
```

## 📄 Licentie

Dit project is gelicenseerd onder de MIT License - zie het [LICENSE](LICENSE) bestand voor details.

## 🙏 Dankbetuigingen

- **OSRM** - Voor route berekeningen
- **OpenStreetMap** - Voor geocoding services
- **Maps.co** - Voor fallback geocoding
- **Google Fonts** - Voor de Inter font
- **Alle testers** - Voor feedback en bug reports

## 📞 Contact

- **GitHub Issues**: [Project Issues](https://github.com/jouw-username/zijnweeralbijna/issues)
- **Email**: jouw-email@example.com
- **Website**: https://jouw-domein.nl

---

**Gemaakt met ❤️ voor alle kinderen op de achterbank die willen weten "zijn we er al bijna?"** 🚗💨 