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
     * Get route information using OSRM for better time calculations
     */
    async getRouteInfo(origin, destination) {
        try {
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
        } catch (error) {
            console.warn('OSRM route calculation failed, falling back to Haversine:', error.message);
            // Fallback to simple distance calculation
            const distance = this.calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng);
            return {
                distance: distance,
                duration: null, // Will be calculated by progress tracker
                averageSpeed: null,
                roadTypes: null,
                waypoints: null
            };
        }
    }

    /**
     * Analyze road types from OSRM speed data
     */
    analyzeRoadTypes(speedData) {
        if (!speedData || speedData.length === 0) return null;
        
        const roadTypes = {
            highway: 0,    // Snelweg (> 100 km/h)
            primary: 0,    // Provinciale weg (80-100 km/h)
            secondary: 0,  // Secundaire weg (70-80 km/h)
            residential: 0 // Woonwijk (30-50 km/h)
        };
        
        speedData.forEach(speed => {
            if (speed > 100) roadTypes.highway++;
            else if (speed > 80) roadTypes.primary++;
            else if (speed > 50) roadTypes.secondary++;
            else roadTypes.residential++;
        });
        
        return roadTypes;
    }

    /**
     * Get expected speed based on road type
     */
    getExpectedSpeed(roadTypes) {
        if (!roadTypes) return 80; // Default fallback
        
        const total = Object.values(roadTypes).reduce((sum, count) => sum + count, 0);
        if (total === 0) return 80;
        
        // Weighted average based on road type distribution
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