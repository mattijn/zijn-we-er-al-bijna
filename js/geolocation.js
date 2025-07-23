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
    }

    /**
     * Get current position once
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
                maximumAge: 60000 // Cache for 1 minute
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
                    const errorMessage = this.getErrorMessage(error);
                    reject(new Error(errorMessage));
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

        this.onLocationUpdate = onUpdate;
        this.onError = onError;
        this.isTracking = true;

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000 // Cache for 30 seconds
        };

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
                if (this.onError) {
                    this.onError(new Error(errorMessage));
                }
            },
            options
        );
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
    }

    /**
     * Geocode an address using a reliable geocoding service
     */
    async geocodeAddress(address) {
        if (!address || address.trim() === '') {
            throw new Error('Address is required');
        }

        const encodedAddress = encodeURIComponent(address.trim());
        
        // Try multiple geocoding services for better reliability
        const services = [
            // Service 1: OpenStreetMap with a more reliable CORS proxy
            {
                url: `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=1`)}`,
                parser: (data) => {
                    if (data.length === 0) throw new Error('Address not found');
                    const result = data[0];
                    return {
                        lat: parseFloat(result.lat),
                        lng: parseFloat(result.lon),
                        displayName: result.display_name,
                        address: result.address
                    };
                }
            },
            // Service 2: Alternative geocoding service
            {
                url: `https://geocode.maps.co/search?q=${encodedAddress}`,
                parser: (data) => {
                    if (data.length === 0) throw new Error('Address not found');
                    const result = data[0];
                    return {
                        lat: parseFloat(result.lat),
                        lng: parseFloat(result.lon),
                        displayName: result.display_name || `${address}, Netherlands`,
                        address: result.address || address
                    };
                }
            }
        ];

        // Try each service until one works
        for (const service of services) {
            try {
                const response = await fetch(service.url, {
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (!response.ok) {
                    continue; // Try next service
                }

                const data = await response.json();
                const result = service.parser(data);
                
                console.log('Geocoding successful:', result);
                return result;
                
            } catch (error) {
                console.log(`Geocoding service failed:`, error.message);
                continue; // Try next service
            }
        }

        // If all services fail, throw an error
        throw new Error(`Could not find address: ${address}. Please try a different address or check your internet connection.`);
    }

    /**
     * Calculate distance between two points using Haversine formula
     */
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(lat2 - lat1);
        const dLng = this.toRadians(lng2 - lng1);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        
        return distance;
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
                return 'Locatie toegang geweigerd. Controleer je browser instellingen.';
            case error.POSITION_UNAVAILABLE:
                return 'Locatie informatie is niet beschikbaar.';
            case error.TIMEOUT:
                return 'Locatie ophalen duurde te lang. Probeer opnieuw.';
            default:
                return 'Er is een onbekende fout opgetreden bij het ophalen van je locatie.';
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