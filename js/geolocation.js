/**
 * Model Retry class for handling retries with exponential backoff
 */
class ModelRetry {
    constructor(maxAttempts = 3, retryDelay = 1000, failDelay = 30000) {
        this.maxAttempts = maxAttempts;
        this.retryDelay = retryDelay;
        this.failDelay = failDelay;
        this.attempts = 0;
        this.isWaiting = false;
        this.totalAttempts = 0;
    }

    async execute(operation) {
        while (true) { // Keep trying indefinitely
            try {
                const result = await operation();
                this.reset();
                return result;
            } catch (error) {
                this.attempts++;
                this.totalAttempts++;
                
                if (this.attempts >= this.maxAttempts) {
                    this.isWaiting = true;
                    console.warn(`❌ Alle ${this.maxAttempts} pogingen gefaald (totaal: ${this.totalAttempts}), ${this.failDelay/1000}s wachten voor nieuwe pogingen...`);
                    await new Promise(resolve => setTimeout(resolve, this.failDelay));
                    this.attempts = 0; // Reset attempts but keep totalAttempts
                    this.isWaiting = false;
                    console.warn('🔄 Opnieuw proberen...');
                    continue; // Start new batch of attempts
                }
                
                console.warn(`❌ Poging ${this.attempts} gefaald (totaal: ${this.totalAttempts}), opnieuw proberen over ${this.retryDelay/1000}s`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            }
        }
    }

    reset() {
        this.attempts = 0;
        this.totalAttempts = 0;
        this.isWaiting = false;
    }

    isRetrying() {
        return this.attempts > 0;
    }
}

/**
 * Geolocation Module
 * Handles current location tracking and address geocoding using OpenStreetMap Nominatim API
 */

class GeolocationManager {
    constructor() {
        this.currentPosition = null;
        this.watchId = null;
        this.isTracking = false;
        this.onLocationUpdate = null;
        this.onError = null;
        this.modelRetry = new ModelRetry();
    }

    /**
     * Check and request geolocation permissions
     */
    async requestPermission() {
        if (!navigator.permissions || !navigator.permissions.query) {
            // Fallback for browsers that don't support permissions API
            return new Promise((resolve) => {
                navigator.geolocation.getCurrentPosition(
                    () => resolve(true),
                    () => resolve(false),
                    { timeout: 10000 }
                );
            });
        }

        try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            if (result.state === 'granted') {
                return true;
            } else if (result.state === 'prompt') {
                // Request permission by getting position
                return new Promise((resolve) => {
                    navigator.geolocation.getCurrentPosition(
                        () => resolve(true),
                        () => resolve(false),
                        { timeout: 10000 }
                    );
                });
            }
            return result.state === 'granted';
        } catch (error) {
            console.warn('Could not query geolocation permission:', error);
            return false;
        }
    }

    /**
     * Get current position once
     */
    async getCurrentPosition() {
        return new Promise(async (resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by this browser'));
                return;
            }

            // First check/request permission
            const hasPermission = await this.requestPermission();
            if (!hasPermission) {
                reject(new Error('Locatie toegang geweigerd. Controleer je browser instellingen en geef toestemming voor locatie.'));
                return;
            }

            const options = {
                enableHighAccuracy: true,
                timeout: 20000, // Increased timeout for mobile
                maximumAge: 30000 // Reduced cache time
            };

            // Try to get cached position first
            const cachedPosition = this.getCurrentPositionSync();
            if (cachedPosition && (Date.now() - cachedPosition.timestamp) < options.maximumAge) {
                resolve(cachedPosition);
                return;
            }

            let timeoutId = setTimeout(() => {
                timeoutId = null;
                reject(new Error('Locatie ophalen duurde te lang. Controleer je GPS signaal.'));
            }, options.timeout);

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        this.currentPosition = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                            accuracy: position.coords.accuracy,
                            timestamp: position.timestamp
                        };
                        resolve(this.currentPosition);
                    }
                },
                (error) => {
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        const errorMessage = this.getErrorMessage(error);
                        console.error('Geolocation error:', {
                            code: error.code,
                            message: error.message,
                            userMessage: errorMessage
                        });
                        reject(new Error(errorMessage));
                    }
                },
                options
            );
        });
    }

    /**
     * Start continuous location tracking
     */
    startTracking(onUpdate, onError) {
        if (this.isTracking) {
            return;
        }

        if (!navigator.geolocation) {
            if (onError) onError(new Error('Geolocation is not supported by this browser'));
            return;
        }

        this.requestPermission().then(hasPermission => {
            if (!hasPermission) {
                if (onError) onError(new Error('Locatie toegang geweigerd. Controleer je browser instellingen en geef toestemming voor locatie.'));
                return;
            }

            this.onLocationUpdate = onUpdate;
            this.onError = onError;
            this.isTracking = true;

            const options = {
                enableHighAccuracy: true,
                timeout: 20000, // Increased timeout for mobile
                maximumAge: 15000 // Reduced cache time for more frequent updates
            };

            // Get initial position
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentPosition = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp
                    };
                    
                    if (this.onLocationUpdate) {
                        this.onLocationUpdate(this.currentPosition);
                    }

                    // Start watching after initial position
                    this.watchId = navigator.geolocation.watchPosition(
                        (position) => {
                            this.currentPosition = {
                                lat: position.coords.latitude,
                                lng: position.coords.longitude,
                                accuracy: position.coords.accuracy,
                                timestamp: position.timestamp
                            };
                            
                            if (this.onLocationUpdate) {
                                this.onLocationUpdate(this.currentPosition);
                            }
                        },
                        (error) => {
                            const errorMessage = this.getErrorMessage(error);
                            console.error('Geolocation watch error:', {
                                code: error.code,
                                message: error.message,
                                userMessage: errorMessage
                            });
                            if (this.onError) {
                                this.onError(new Error(errorMessage));
                            }
                        },
                        options
                    );
                },
                (error) => {
                    const errorMessage = this.getErrorMessage(error);
                    console.error('Initial geolocation error:', {
                        code: error.code,
                        message: error.message,
                        userMessage: errorMessage
                    });
                    if (this.onError) {
                        this.onError(new Error(errorMessage));
                    }
                },
                options
            );
        });
    }

    /**
     * Reset all state
     */
    reset() {
        this.stopTracking();
        this.currentPosition = null;
        this.modelRetry.reset();
    }

    /**
     * Stop location tracking
     */
    stopTracking() {
        if (this.watchId && navigator.geolocation) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        this.isTracking = false;
        this.onLocationUpdate = null;
        this.onError = null;
        this.modelRetry.reset(); // Reset retry state
    }

    /**
     * Geocode an address using a reliable geocoding service
     */
    async geocodeAddress(address) {
        if (!address || address.trim() === '') {
            throw new Error('Address is required');
        }

        // Get current position for better local search (optional)
        let searchArea = null;
        try {
            const position = await this.getCurrentPosition();
            if (position) {
                searchArea = {
                    lat: position.lat,
                    lon: position.lng
                };
            }
        } catch (error) {
            console.warn('Could not get current position for local search:', error);
        }

        return this.modelRetry.execute(async () => {
            const encodedAddress = encodeURIComponent(address.trim());
            
            // Try multiple geocoding services for better reliability
            const services = [
                // Service 1: OpenStreetMap Nominatim API (most reliable for international addresses)
                {
                    url: `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=1${
                        searchArea ? `&lat=${searchArea.lat}&lon=${searchArea.lon}` : ''
                    }`,
                    parser: async (data) => {
                        if (!data || data.length === 0) throw new Error(`Adres niet gevonden: ${address}`);
                        const result = data[0];
                        return {
                            lat: parseFloat(result.lat),
                            lng: parseFloat(result.lon),
                            displayName: result.display_name,
                            address: result.address,
                            countryCode: result.address?.country_code?.toUpperCase() || null
                        };
                    }
                },
                // Service 2: Alternative geocoding service (maps.co)
                {
                    url: `https://geocode.maps.co/search?q=${encodedAddress}&api_key=6884e5765d15b402837211woq4549eb${
                        searchArea ? `&lat=${searchArea.lat}&lon=${searchArea.lon}` : ''
                    }`,
                    parser: async (data) => {
                        if (!data || data.length === 0) throw new Error(`Adres niet gevonden: ${address}`);
                        const result = data[0];
                        return {
                            lat: parseFloat(result.lat),
                            lng: parseFloat(result.lon),
                            displayName: result.display_name || address,
                            address: result.address || address,
                            countryCode: null
                        };
                    }
                }
            ];

            // Try each service with timeout
            const timeout = 10000; // 10 seconds timeout
            let lastError = null;
            let serviceErrors = [];

            for (const service of services) {
                try {
                    console.log('🔍 Trying geocoding service:', {
                        service: service.url,
                        address: address,
                        searchArea: searchArea
                    });

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), timeout);

                    const response = await fetch(service.url, {
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'ZijnWeErAlBijna/1.0 (https://mattijn.github.io/zijn-we-er-al-bijna/)'
                        },
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const data = await response.json();
                    if (!data) {
                        throw new Error('Invalid response data');
                    }

                    const result = await service.parser(data);
                    
                    // Valideer alleen de basis coördinaten
                    if (!result.lat || !result.lng || 
                        result.lat < -90 || result.lat > 90 || 
                        result.lng < -180 || result.lng > 180) {
                        throw new Error('Ongeldige coördinaten ontvangen');
                    }
                    
                    console.log('✅ Geocoding successful:', {
                        address: address,
                        result: result,
                        service: service.url,
                        searchArea: searchArea
                    });
                    return result;

                } catch (error) {
                    console.warn('❌ Geocoding service failed:', {
                        service: service.url,
                        error: error.message,
                        address: address,
                        searchArea: searchArea
                    });
                    
                    serviceErrors.push({
                        service: service.url,
                        error: error.message
                    });
                    
                    if (error.name === 'AbortError') {
                        lastError = new Error(`Geocoding request timed out voor "${address}". Controleer je internetverbinding.`);
                    } else {
                        lastError = error;
                    }
                    continue; // Try next service
                }
            }

            // If all services fail, throw a detailed error
            console.error('❌ All geocoding services failed:', {
                address: address,
                errors: serviceErrors,
                searchArea: searchArea
            });
            
            throw new Error(`Kon het adres "${address}" niet vinden. Controleer het adres of je internetverbinding.`);
        });
    }

    /**
     * Calculate distance between two points using OSRM with retry logic
     */
    async calculateDistance(lat1, lng1, lat2, lng2) {
        try {
            const origin = { lat: lat1, lng: lng1 };
            const destination = { lat: lat2, lng: lng2 };
            const routeInfo = await this.modelRetry.execute(async () => {
                const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false&annotations=true`;
                
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error('OSRM route request failed');
                }
                
                const data = await response.json();
                
                if (data.routes && data.routes.length > 0) {
                    const route = data.routes[0];
                    const leg = route.legs[0];
                    
                    return {
                        distance: route.distance / 1000, // Convert to kilometers
                        duration: route.duration / 60, // Convert to minutes
                        averageSpeed: (route.distance / 1000) / (route.duration / 3600), // km/h
                        roadTypes: this.analyzeRoadTypes(leg.annotation?.speed || []),
                        waypoints: leg.annotation?.speed || []
                    };
                } else {
                    throw new Error('No route found');
                }
            });
            return routeInfo.distance;
        } catch (error) {
            console.error('OSRM distance calculation failed:', error);
            throw new Error('Could not calculate distance. Please check your internet connection.');
        }
    }

    /**
     * Get route information using OSRM with retry logic
     */
    async getRouteInfo(origin, destination) {
        return this.modelRetry.execute(async () => {
            const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false&annotations=true`;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('OSRM route request failed');
            }
            
            const data = await response.json();
            
            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                const leg = route.legs[0];
                
                return {
                    distance: route.distance / 1000, // Convert to kilometers
                    duration: route.duration / 60, // Convert to minutes
                    averageSpeed: (route.distance / 1000) / (route.duration / 3600), // km/h
                    roadTypes: this.analyzeRoadTypes(leg.annotation?.speed || []),
                    waypoints: leg.annotation?.speed || []
                };
            } else {
                throw new Error('No route found');
            }
        });
    }

    /**
     * Analyze road types from OSRM speed data
     */
    analyzeRoadTypes(speedData) {
        if (!speedData || !Array.isArray(speedData) || speedData.length === 0) {
            console.warn('No speed data available from OSRM');
            return null;
        }
        
        const roadTypes = {
            highway: 0,    // Snelweg (> 100 km/h)
            primary: 0,    // Provinciale weg (80-100 km/h)
            secondary: 0,  // Secundaire weg (70-80 km/h)
            residential: 0 // Woonwijk (30-50 km/h)
        };
        
        // Categorize road types based on speed data (convert m/s to km/h)
        speedData.forEach(speed => {
            if (!speed || speed <= 0) return; // Skip invalid speeds
            
            // Convert m/s to km/h: speed * 3.6
            const speedKmh = speed * 3.6;
            
            if (speedKmh > 100) roadTypes.highway++;
            else if (speedKmh > 80) roadTypes.primary++;
            else if (speedKmh > 50) roadTypes.secondary++;
            else roadTypes.residential++;
        });
        
        return roadTypes;
    }

    /**
     * Get expected speed based on road type
     */
    getExpectedSpeed(roadTypes) {
        if (!roadTypes) return 80; // Default fallback
        
        const total = Object.values(roadTypes).reduce((sum, distance) => sum + distance, 0);
        if (total === 0) return 80;
        
        // Weighted average based on road type distribution (distance-weighted)
        const weightedSpeed = (
            (roadTypes.highway * 120) +
            (roadTypes.primary * 90) +
            (roadTypes.secondary * 75) +
            (roadTypes.residential * 40)
        ) / total;
        
        return Math.round(weightedSpeed);
    }

    /**
     * Convert degrees to radians
     */
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Get user-friendly error message
     */
    getErrorMessage(error) {
        switch (error.code) {
            case error.PERMISSION_DENIED:
                return 'Locatie toegang geweigerd. Controleer je browser instellingen en geef toestemming voor locatie.';
            case error.POSITION_UNAVAILABLE:
                return 'Locatie informatie is niet beschikbaar. Controleer of GPS is ingeschakeld.';
            case error.TIMEOUT:
                return 'Locatie ophalen duurde te lang. Controleer je GPS signaal en internetverbinding.';
            default:
                return `Er is een fout opgetreden bij het ophalen van je locatie: ${error.message}`;
        }
    }

    /**
     * Check if geolocation is supported and available
     */
    isSupported() {
        return !!navigator.geolocation;
    }

    /**
     * Get current position if available
     */
    getCurrentPositionSync() {
        return this.currentPosition;
    }
}

// Create global instance
window.geolocationManager = new GeolocationManager(); 