/**
 * Storage Module
 * Handles saving and loading trip data using localStorage
 */

class TripStorage {
    constructor() {
        this.storageKey = 'zijnweeralbijna_trip_data';
        this.historyKey = 'zijnweeralbijna_trip_history';
    }

    /**
     * Save current trip data
     */
    saveTripData(tripData) {
        try {
            const dataToSave = {
                ...tripData,
                savedAt: Date.now()
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(dataToSave));
            return true;
        } catch (error) {
            console.error('Error saving trip data:', error);
            return false;
        }
    }

    /**
     * Load saved trip data
     */
    loadTripData() {
        try {
            const savedData = localStorage.getItem(this.storageKey);
            if (savedData) {
                return JSON.parse(savedData);
            }
            return null;
        } catch (error) {
            console.error('Error loading trip data:', error);
            return null;
        }
    }

    /**
     * Clear saved trip data
     */
    clearTripData() {
        try {
            localStorage.removeItem(this.storageKey);
            return true;
        } catch (error) {
            console.error('Error clearing trip data:', error);
            return false;
        }
    }

    /**
     * Save completed trip to history
     */
    saveToHistory(tripData) {
        try {
            const history = this.getTripHistory();
            
            const tripRecord = {
                ...tripData,
                completedAt: Date.now(),
                duration: tripData.startTime ? Date.now() - tripData.startTime : 0
            };

            // Add to beginning of history (most recent first)
            history.unshift(tripRecord);

            // Keep only last 10 trips
            if (history.length > 10) {
                history.splice(10);
            }

            localStorage.setItem(this.historyKey, JSON.stringify(history));
            return true;
        } catch (error) {
            console.error('Error saving to history:', error);
            return false;
        }
    }

    /**
     * Get trip history
     */
    getTripHistory() {
        try {
            const history = localStorage.getItem(this.historyKey);
            return history ? JSON.parse(history) : [];
        } catch (error) {
            console.error('Error loading trip history:', error);
            return [];
        }
    }

    /**
     * Clear trip history
     */
    clearTripHistory() {
        try {
            localStorage.removeItem(this.historyKey);
            return true;
        } catch (error) {
            console.error('Error clearing trip history:', error);
            return false;
        }
    }

    /**
     * Check if there's saved trip data
     */
    hasSavedTrip() {
        return this.loadTripData() !== null;
    }

    /**
     * Get saved addresses for autocomplete
     */
    getSavedAddresses() {
        try {
            const history = this.getTripHistory();
            const addresses = new Set();

            history.forEach(trip => {
                if (trip.destination && trip.destination.displayName) {
                    addresses.add(trip.destination.displayName);
                }
                if (trip.nextStop && trip.nextStop.displayName) {
                    addresses.add(trip.nextStop.displayName);
                }
            });

            return Array.from(addresses);
        } catch (error) {
            console.error('Error getting saved addresses:', error);
            return [];
        }
    }

    /**
     * Format trip duration for display
     */
    formatDuration(milliseconds) {
        const hours = Math.floor(milliseconds / (1000 * 60 * 60));
        const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}u ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    /**
     * Format date for display
     */
    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString('nl-NL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Export trip data as JSON
     */
    exportTripData() {
        try {
            const currentTrip = this.loadTripData();
            const history = this.getTripHistory();
            
            const exportData = {
                currentTrip,
                history,
                exportedAt: new Date().toISOString()
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `trip-data-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            return true;
        } catch (error) {
            console.error('Error exporting trip data:', error);
            return false;
        }
    }

    /**
     * Import trip data from JSON
     */
    async importTripData(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (data.currentTrip) {
                localStorage.setItem(this.storageKey, JSON.stringify(data.currentTrip));
            }
            
            if (data.history && Array.isArray(data.history)) {
                localStorage.setItem(this.historyKey, JSON.stringify(data.history));
            }
            
            return true;
        } catch (error) {
            console.error('Error importing trip data:', error);
            return false;
        }
    }

    /**
     * Get storage usage information
     */
    getStorageInfo() {
        try {
            const currentTrip = this.loadTripData();
            const history = this.getTripHistory();
            
            return {
                hasCurrentTrip: !!currentTrip,
                historyCount: history.length,
                totalStorage: this.getStorageSize()
            };
        } catch (error) {
            console.error('Error getting storage info:', error);
            return null;
        }
    }

    /**
     * Calculate storage size
     */
    getStorageSize() {
        try {
            let total = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    total += localStorage[key].length + key.length;
                }
            }
            return total;
        } catch (error) {
            return 0;
        }
    }
}

// Create global instance
window.tripStorage = new TripStorage(); 