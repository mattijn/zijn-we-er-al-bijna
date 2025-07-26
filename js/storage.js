/**
 * StorageManager - Handles data persistence using localStorage
 * Responsible for saving/loading trip data and settings
 */

class StorageManager {
    constructor() {
        this.storageKey = 'zijnweeralbijna_trip_data';
        this.settingsKey = 'zijnweeralbijna_settings';
    }

    /**
     * Save trip data to localStorage
     * @param {Object} tripData - The trip data to save
     */
    saveTripData(tripData) {
        try {
            const data = {
                ...tripData,
                timestamp: Date.now()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving trip data:', error);
        }
    }

    /**
     * Load trip data from localStorage
     * @returns {Object|null} The loaded trip data or null if not found/invalid
     */
    loadTripData() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (!data) return null;

            const tripData = JSON.parse(data);
            
            // Validate the data structure
            if (!this.validateTripData(tripData)) {
                console.warn('Invalid trip data found, clearing...');
                this.clearTripData();
                return null;
            }

            return tripData;
        } catch (error) {
            console.error('Error loading trip data:', error);
            this.clearTripData();
            return null;
        }
    }

    /**
     * Clear trip data from localStorage
     */
    clearTripData() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (error) {
            console.error('Error clearing trip data:', error);
        }
    }

    /**
     * Save settings to localStorage
     * @param {Object} settings - The settings to save
     */
    saveSettings(settings) {
        try {
            const data = {
                ...settings,
                timestamp: Date.now()
            };
            localStorage.setItem(this.settingsKey, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    /**
     * Load settings from localStorage
     * @returns {Object} The loaded settings or default settings
     */
    loadSettings() {
        try {
            const data = localStorage.getItem(this.settingsKey);
            if (!data) return this.getDefaultSettings();

            const settings = JSON.parse(data);
            return { ...this.getDefaultSettings(), ...settings };
        } catch (error) {
            console.error('Error loading settings:', error);
            return this.getDefaultSettings();
        }
    }

    /**
     * Get default settings
     * @returns {Object} Default settings object
     */
    getDefaultSettings() {
        return {
            updateInterval: 30000, // 30 seconds
            wakeLockEnabled: true,
            soundEnabled: false,
            theme: 'default'
        };
    }

    /**
     * Validate trip data structure
     * @param {Object} data - The data to validate
     * @returns {boolean} True if valid, false otherwise
     */
    validateTripData(data) {
        if (!data || typeof data !== 'object') return false;

        // Check for required fields
        const requiredFields = ['startTime', 'destination', 'startLocation'];
        for (const field of requiredFields) {
            if (!(field in data)) return false;
        }

        // Validate startTime
        if (typeof data.startTime !== 'number' || data.startTime <= 0) return false;

        // Validate destination
        if (!data.destination || typeof data.destination !== 'object') return false;
        if (!data.destination.address || typeof data.destination.address !== 'string') return false;

        // Validate startLocation
        if (!data.startLocation || typeof data.startLocation !== 'object') return false;
        if (typeof data.startLocation.lat !== 'number' || typeof data.startLocation.lng !== 'number') return false;

        // Validate optional fields if present
        if (data.nextStop) {
            if (!data.nextStop.address || typeof data.nextStop.address !== 'string') return false;
        }
        
        // Validate nextStopStartLocation if present
        if (data.nextStopStartLocation) {
            if (typeof data.nextStopStartLocation.lat !== 'number' || typeof data.nextStopStartLocation.lng !== 'number') return false;
        }

        return true;
    }

    /**
     * Check if there's an active trip (less than 24 hours old)
     * @returns {boolean} True if there's an active trip
     */
    hasActiveTrip() {
        const tripData = this.loadTripData();
        if (!tripData) return false;

        // Check if trip is less than 24 hours old
        const twentyFourHours = 24 * 60 * 60 * 1000;
        const isRecent = (Date.now() - tripData.startTime) < twentyFourHours;

        return isRecent;
    }

    /**
     * Get storage usage information
     * @returns {Object} Storage usage stats
     */
    getStorageInfo() {
        try {
            const tripDataSize = localStorage.getItem(this.storageKey)?.length || 0;
            const settingsSize = localStorage.getItem(this.settingsKey)?.length || 0;
            const totalSize = tripDataSize + settingsSize;

            return {
                tripDataSize,
                settingsSize,
                totalSize,
                totalSizeKB: (totalSize / 1024).toFixed(2)
            };
        } catch (error) {
            console.error('Error getting storage info:', error);
            return { tripDataSize: 0, settingsSize: 0, totalSize: 0, totalSizeKB: '0.00' };
        }
    }
}

// Export for use in other modules
window.StorageManager = StorageManager; 