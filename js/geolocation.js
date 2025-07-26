/**
 * GeolocationManager - Handles GPS tracking, geocoding, and route calculations
 * Uses OSRM for routing, Nominatim + Maps.co for geocoding with retry mechanism
 */

class GeolocationManager {
    constructor() {
        this.currentPosition = null;
        this.watchId = null;
        this.isTracking = false;
        this.retry = new ModelRetry();
        
        // API endpoints
        this.osrmBaseUrl = 'https://router.project-osrm.org/route/v1/driving/';
        this.nominatimUrl = 'https://nominatim.openstreetmap.org/search';
        this.mapsCoUrl = 'https://geocode.maps.co/search';
        this.mapsCoApiKey = '6884e5765d15b402837211woq4549eb';
    }

    /**
     * Request GPS permission and get current position
     * @returns {Promise<Object>} Current position with lat/lng
     */
    async getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by this browser'));
                return;
            }

            const options = {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000 // 30 seconds cache
            };

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentPosition = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp
                    };
                    resolve(this.currentPosition);
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    reject(new Error(this.getGeolocationErrorMessage(error)));
                },
                options
            );
        });
    }

    /**
     * Start GPS tracking
     * @param {Function} onPositionUpdate - Callback for position updates
     * @param {Function} onError - Callback for errors
     */
    startTracking(onPositionUpdate, onError) {
        if (this.isTracking) {
            console.warn('GPS tracking already active');
            return;
        }

        if (!navigator.geolocation) {
            onError(new Error('Geolocation is not supported'));
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000
        };

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.currentPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                };
                this.isTracking = true;
                onPositionUpdate(this.currentPosition);
            },
            (error) => {
                console.error('GPS tracking error:', error);
                onError(new Error(this.getGeolocationErrorMessage(error)));
            },
            options
        );
    }

    /**
     * Stop GPS tracking
     */
    stopTracking() {
        if (this.watchId && navigator.geolocation) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
            this.isTracking = false;
        }
    }

    /**
     * Geocode address to coordinates using fallback services
     * @param {string} address - Address to geocode
     * @returns {Promise<Object>} Geocoded result with lat/lng and address
     */
    async geocodeAddress(address) {
        if (!address || typeof address !== 'string') {
            throw new Error('Invalid address provided');
        }

        // For local development, use simple service first to avoid CORS issues
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (isLocalhost) {
            console.log('Running on localhost - using simple geocoding service');
            const result = await this.geocodeWithSimpleService(address);
            if (result) return result;
        }

        // Try Nominatim first (primary service)
        try {
            const result = await this.geocodeWithNominatim(address);
            if (result) return result;
        } catch (error) {
            console.warn('Nominatim geocoding failed:', error);
        }

        // Fallback to Maps.co
        try {
            const result = await this.geocodeWithMapsCo(address);
            if (result) return result;
        } catch (error) {
            console.warn('Maps.co geocoding failed:', error);
        }

        // Final fallback: use a simple geocoding service
        try {
            const result = await this.geocodeWithSimpleService(address);
            if (result) return result;
        } catch (error) {
            console.warn('Simple geocoding failed:', error);
        }

        throw new Error('Geocoding failed for all services');
    }

    /**
     * Geocode using Nominatim (OpenStreetMap)
     * @param {string} address - Address to geocode
     * @returns {Promise<Object|null>} Geocoded result or null
     */
    async geocodeWithNominatim(address) {
        const params = new URLSearchParams({
            q: address,
            format: 'json',
            limit: '1',
            addressdetails: '1'
        });

        const response = await this.retry.fetch(`${this.nominatimUrl}?${params}`, {
            headers: {
                'User-Agent': 'ZijnWeErAlBijna/1.0 (Travel Progress App)'
            }
        });

        if (!response.ok) {
            throw new Error(`Nominatim API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data && data.length > 0) {
            const result = data[0];
            return {
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
                address: result.display_name,
                type: 'nominatim'
            };
        }

        return null;
    }

    /**
     * Geocode using Maps.co (fallback service)
     * @param {string} address - Address to geocode
     * @returns {Promise<Object|null>} Geocoded result or null
     */
    async geocodeWithMapsCo(address) {
        const params = new URLSearchParams({
            q: address,
            api_key: this.mapsCoApiKey
        });

        const response = await this.retry.fetch(`${this.mapsCoUrl}?${params}`);

        if (!response.ok) {
            throw new Error(`Maps.co API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data && data.length > 0) {
            const result = data[0];
            return {
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
                address: result.display_name || address,
                type: 'mapsco'
            };
        }

        return null;
    }

    /**
     * Geocode using a simple service (fallback)
     * @param {string} address - Address to geocode
     * @returns {Promise<Object|null>} Geocoded result or null
     */
    async geocodeWithSimpleService(address) {
        // For development/testing, use some common Dutch locations
        const commonLocations = {
            'amsterdam': { lat: 52.3676, lng: 4.9041, name: 'Amsterdam' },
            'rotterdam': { lat: 51.9225, lng: 4.4792, name: 'Rotterdam' },
            'den haag': { lat: 52.0705, lng: 4.3007, name: 'Den Haag' },
            'utrecht': { lat: 52.0907, lng: 5.1214, name: 'Utrecht' },
            'eindhoven': { lat: 51.4416, lng: 5.4697, name: 'Eindhoven' },
            'groningen': { lat: 53.2194, lng: 6.5665, name: 'Groningen' },
            'tilburg': { lat: 51.5719, lng: 5.0672, name: 'Tilburg' },
            'almere': { lat: 52.3508, lng: 5.2647, name: 'Almere' },
            'breda': { lat: 51.5719, lng: 4.7683, name: 'Breda' },
            'nijmegen': { lat: 51.8425, lng: 5.8533, name: 'Nijmegen' },
            'hardenberg': { lat: 52.5758, lng: 6.6197, name: 'Hardenberg' },
            'zwolle': { lat: 52.5168, lng: 6.0830, name: 'Zwolle' },
            'deventer': { lat: 52.2555, lng: 6.1601, name: 'Deventer' },
            'enschede': { lat: 52.2215, lng: 6.8937, name: 'Enschede' },
            'apeldoorn': { lat: 52.2112, lng: 5.9699, name: 'Apeldoorn' },
            'arnhem': { lat: 51.9851, lng: 5.8987, name: 'Arnhem' },
            'amersfoort': { lat: 52.1561, lng: 5.3878, name: 'Amersfoort' },
            'leiden': { lat: 52.1601, lng: 4.4970, name: 'Leiden' },
            'haarlem': { lat: 52.3873, lng: 4.6462, name: 'Haarlem' },
            'zaandam': { lat: 52.4389, lng: 4.8295, name: 'Zaandam' },
            'efteling': { lat: 51.6500, lng: 5.0500, name: 'Efteling' },
            'walibi': { lat: 52.4333, lng: 5.2167, name: 'Walibi Holland' },
            'duinrell': { lat: 52.2167, lng: 4.3667, name: 'Duinrell' },
            'slagharen': { lat: 52.6167, lng: 6.5667, name: 'Slagharen' }
        };

        const searchTerm = address.toLowerCase().trim();
        
        // Check for exact matches first
        for (const [key, location] of Object.entries(commonLocations)) {
            if (searchTerm.includes(key)) {
                return {
                    lat: location.lat,
                    lng: location.lng,
                    address: location.name,
                    type: 'simple'
                };
            }
        }

        // Check for partial matches
        for (const [key, location] of Object.entries(commonLocations)) {
            if (key.includes(searchTerm) || searchTerm.includes(key)) {
                return {
                    lat: location.lat,
                    lng: location.lng,
                    address: location.name,
                    type: 'simple'
                };
            }
        }

        return null;
    }

    /**
     * Get route information from OSRM
     * @param {Object} start - Start coordinates {lat, lng}
     * @param {Object} end - End coordinates {lat, lng}
     * @param {Object} via - Optional via coordinates {lat, lng}
     * @returns {Promise<Object>} Route information
     */
    async getRouteInfo(start, end, via = null) {
        if (!start || !end) {
            throw new Error('Start and end coordinates are required');
        }

        let coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;
        
        if (via) {
            coordinates = `${start.lng},${start.lat};${via.lng},${via.lat};${end.lng},${end.lat}`;
        }

        const params = new URLSearchParams({
            overview: 'false',
            steps: 'false',
            annotations: 'false'
        });

        const response = await this.retry.fetch(`${this.osrmBaseUrl}${coordinates}?${params}`);

        if (!response.ok) {
            throw new Error(`OSRM API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            throw new Error('No route found');
        }

        const route = data.routes[0];
        return {
            distance: route.distance / 1000, // Convert to kilometers
            duration: route.duration, // Duration in seconds
            averageSpeed: (route.distance / 1000) / (route.duration / 3600), // km/h
            totalDistance: route.distance / 1000 // Total route distance
        };
    }

    /**
     * Get distance between two points using OSRM API
     * @param {Object} point1 - First point {lat, lng}
     * @param {Object} point2 - Second point {lat, lng}
     * @returns {Promise<number>} Distance in kilometers
     */
    async getDistance(point1, point2) {
        // For local development, use simple calculation to avoid CORS issues
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (isLocalhost) {
            console.log('Running on localhost - using simple distance calculation');
            return this.calculateSimpleDistance(point1, point2);
        }

        // Use OSRM for accurate distance calculation
        const routeInfo = await this.getRouteInfo(point1, point2);
        return routeInfo.distance;
    }

    /**
     * Simple distance calculation for localhost development only
     * @param {Object} point1 - First point {lat, lng}
     * @param {Object} point2 - Second point {lat, lng}
     * @returns {number} Approximate distance in kilometers
     */
    calculateSimpleDistance(point1, point2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = (point2.lat - point1.lat) * (Math.PI / 180);
        const dLng = (point2.lng - point1.lng) * (Math.PI / 180);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(point1.lat * (Math.PI / 180)) * Math.cos(point2.lat * (Math.PI / 180)) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Get user-friendly geolocation error message
     * @param {Object} error - Geolocation error object
     * @returns {string} User-friendly error message
     */
    getGeolocationErrorMessage(error) {
        switch (error.code) {
            case error.PERMISSION_DENIED:
                return 'Locatie toegang geweigerd. Controleer je browser instellingen.';
            case error.POSITION_UNAVAILABLE:
                return 'Locatie informatie niet beschikbaar. Probeer het opnieuw.';
            case error.TIMEOUT:
                return 'Locatie tijd overschreden. Controleer je internetverbinding.';
            default:
                return 'Er is een fout opgetreden bij het ophalen van je locatie.';
        }
    }

    /**
     * Request GPS permission explicitly
     * @returns {Promise<boolean>} True if permission granted
     */
    async requestPermission() {
        try {
            await this.getCurrentPosition();
            return true;
        } catch (error) {
            console.error('GPS permission denied:', error);
            return false;
        }
    }

    /**
     * Get current tracking status
     * @returns {Object} Tracking status information
     */
    getTrackingStatus() {
        return {
            isTracking: this.isTracking,
            hasPosition: !!this.currentPosition,
            position: this.currentPosition,
            watchId: this.watchId
        };
    }
}

/**
 * ModelRetry - Retry mechanism for API calls
 */
class ModelRetry {
    constructor(maxAttempts = 3, retryDelay = 1000, failDelay = 30000) {
        this.maxAttempts = maxAttempts;
        this.retryDelay = retryDelay;
        this.failDelay = failDelay;
        this.failedAttempts = 0;
        this.lastFailureTime = 0;
    }

    /**
     * Fetch with retry mechanism
     * @param {string} url - URL to fetch
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>} Fetch response
     */
    async fetch(url, options = {}) {
        // Check if we're in a failure delay period
        if (this.failedAttempts >= this.maxAttempts) {
            const timeSinceLastFailure = Date.now() - this.lastFailureTime;
            if (timeSinceLastFailure < this.failDelay) {
                const remainingDelay = this.failDelay - timeSinceLastFailure;
                throw new Error(`API temporarily unavailable. Try again in ${Math.ceil(remainingDelay / 1000)} seconds.`);
            }
            // Reset after delay period
            this.failedAttempts = 0;
        }

        try {
            const response = await fetch(url, options);
            
            if (response.ok) {
                // Reset on success
                this.failedAttempts = 0;
                return response;
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            this.failedAttempts++;
            this.lastFailureTime = Date.now();

            if (this.failedAttempts >= this.maxAttempts) {
                throw new Error(`API request failed after ${this.maxAttempts} attempts: ${error.message}`);
            }

            // Wait before retry
            await this.delay(this.retryDelay);
            return this.fetch(url, options); // Recursive retry
        }
    }

    /**
     * Delay helper
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Promise that resolves after delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export for use in other modules
window.GeolocationManager = GeolocationManager;
window.ModelRetry = ModelRetry; 