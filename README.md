# 🚗 Zijn we er al bijna?

Een mobiele web-app voor kinderen om hun voortgang tijdens autoritten te volgen. Perfect voor lange reizen naar vakantiebestemmingen!

## 🌟 Features

- **📍 Real-time locatie tracking** - Volg je positie tijdens de reis
- **🏁 Eindbestemming invoer** - Voer je vakantiebestemming in
- **⏸️ Optionele tussenstops** - Voeg tussenstops toe aan je route
- **📊 Visuele voortgangsbalk** - Zie hoe ver je bent gekomen
- **📱 Mobiel-geoptimaliseerd** - Perfect voor gebruik in de auto
- **💾 Automatisch opslaan** - Je reis wordt automatisch opgeslagen
- **🎉 Reis voltooiing** - Viering wanneer je aankomt
- **🌙 Dark mode ondersteuning** - Automatische aanpassing aan je voorkeuren

## 🚀 Hoe te gebruiken

### 1. Start een reis
- Open de app op je mobiele apparaat
- Voer je eindbestemming in (bijv. "Efteling, Kaatsheuvel")
- Optioneel: voer een tussenstop in
- Klik op "🚀 Start Reis"

### 2. Volg je voortgang
- De app vraagt om toegang tot je locatie
- De verticale balk toont je voortgang
- Zie real-time informatie over afstand en tijd
- De auto-emoji beweegt mee met je positie

### 3. Reis voltooid
- Wanneer je binnen 500 meter van je bestemming bent, wordt de reis automatisch voltooid
- Je krijgt een feestelijke melding
- De reis wordt opgeslagen in je geschiedenis

## 🛠️ Technische Details

### Gebruikte technologieën
- **HTML5/CSS3/JavaScript** - Moderne web standaarden
- **Geolocation API** - Voor real-time locatie tracking
- **OpenStreetMap Nominatim API** - Gratis adres geocoding
- **Haversine formule** - Nauwkeurige afstandsberekeningen
- **Local Storage** - Opslaan van reisgegevens

### Bestandsstructuur
```
zijnweeralbijna/
├── index.html          # Hoofdpagina
├── css/
│   ├── style.css       # Hoofdstijlen
│   └── mobile.css      # Mobiele optimalisaties
├── js/
│   ├── app.js          # Hoofdapplicatie
│   ├── geolocation.js  # Locatie services
│   ├── progress.js     # Voortgang tracking
│   └── storage.js      # Data opslag
└── README.md           # Deze documentatie
```

## 📱 Browser Ondersteuning

De app werkt het beste op moderne mobiele browsers:
- ✅ Chrome (Android)
- ✅ Safari (iOS)
- ✅ Firefox (Android)
- ✅ Edge (Windows)

**Vereisten:**
- HTTPS verbinding (vereist voor locatie services)
- Locatie toegang toestaan
- JavaScript ingeschakeld

## 🔧 Installatie

### Lokale ontwikkeling
1. Clone of download dit project
2. Open `index.html` in een lokale webserver
3. Voor locatie services, gebruik HTTPS (vereist)

### Productie deployment
1. Upload alle bestanden naar je webserver
2. Zorg voor HTTPS certificaat
3. De app is klaar voor gebruik!

## 🎨 Aanpassingen

### Kleuren wijzigen
Bewerk `css/style.css` en zoek naar de CSS variabelen:
```css
/* Hoofdkleuren */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

### Teksten aanpassen
Alle teksten staan in `index.html` en de JavaScript bestanden. Zoek naar Nederlandse teksten en pas ze aan naar wens.

## 🔒 Privacy

- **Geen externe tracking** - Alle data blijft lokaal op je apparaat
- **OpenStreetMap** - Gebruikt gratis, open-source geocoding
- **Geen persoonlijke data** - Alleen reisgegevens worden opgeslagen
- **Lokale opslag** - Geen data wordt naar externe servers gestuurd

## 🐛 Problemen oplossen

### Locatie werkt niet
- Controleer of je browser locatie toegang heeft
- Zorg dat je HTTPS gebruikt
- Probeer de pagina te verversen

### Adres niet gevonden
- Probeer een meer specifiek adres
- Voeg postcode toe
- Controleer de spelling

### App laadt niet
- Controleer je internetverbinding
- Probeer een andere browser
- Controleer of JavaScript is ingeschakeld

## 🤝 Bijdragen

Verbeteringen en bug fixes zijn welkom! 

### Ontwikkeling
1. Fork het project
2. Maak een feature branch
3. Commit je wijzigingen
4. Push naar de branch
5. Maak een Pull Request

## 📄 Licentie

Dit project is open source en beschikbaar onder de MIT licentie.

## 🙏 Dank

- OpenStreetMap voor gratis geocoding services
- Inter font familie voor de mooie typografie
- Alle testers en gebruikers voor feedback

---

**Veel plezier met je reizen! 🚗✨** 