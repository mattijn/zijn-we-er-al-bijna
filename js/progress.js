/**
 * ProgressTracker - Calculates and displays trip progress and statistics
 * Handles progress bar updates, statistics calculations, and achievement tracking
 */

class ProgressTracker {
    constructor() {
        this.tripData = null;
        this.currentPosition = null;
        this.updateInterval = null;
        this.lastUpdateTime = 0;
        
        // DOM elements
        this.elements = {
            progressFillDestination: document.getElementById('progress-fill-destination'),
            progressFillNextStop: document.getElementById('progress-fill-nextstop'),
            nextStopProgress: document.getElementById('next-stop-progress'),
            nextStopStat: document.getElementById('next-stop-stat'),
            remainingTime: document.getElementById('remaining-time'),
            traveledDistance: document.getElementById('traveled-distance'),
            progress: document.getElementById('progress'),
            remainingDistance: document.getElementById('remaining-distance'),
            nextStopTime: document.getElementById('next-stop-time')
        };
    }

    /**
     * Start a new trip
     * @param {Object} tripData - Trip data object
     */
    startTrip(tripData) {
        this.tripData = tripData;
        this.lastUpdateTime = Date.now();
        
        // Show next stop progress if available
        this.updateNextStopVisibility();
        
        // Start periodic updates
        this.startPeriodicUpdates();
        
        // Initial update
        this.updateDisplay();
    }

    /**
     * Update progress with new position
     * @param {Object} position - Current GPS position
     */
    async updateProgress(position) {
        if (!this.tripData || !position) return;

        this.currentPosition = position;
        this.lastUpdateTime = Date.now();

        // Calculate new progress
        await this.calculateProgress();
        
        // Update display
        this.updateDisplay();
        
        // Save updated trip data
        this.saveTripData();
    }

    /**
     * Calculate current progress
     */
    async calculateProgress() {
        if (!this.tripData || !this.currentPosition) return;

        try {
            // Calculate distance to destination using OSRM
            const distanceToDestination = await this.geolocationManager.getDistance(
                this.currentPosition,
                this.tripData.destination
            );

            // Calculate total distance (from start to destination)
            const totalDistance = await this.geolocationManager.getDistance(
                this.tripData.startLocation,
                this.tripData.destination
            );

            // Calculate traveled distance
            const traveledDistance = await this.geolocationManager.getDistance(
                this.tripData.startLocation,
                this.currentPosition
            );

            // Calculate progress percentage
            const progressPercentage = Math.min(100, Math.max(0, (traveledDistance / totalDistance) * 100));

            // Update trip data
            this.tripData.currentPosition = this.currentPosition;
            this.tripData.distanceToDestination = distanceToDestination;
            this.tripData.traveledDistance = traveledDistance;
            this.tripData.progressPercentage = progressPercentage;

            // Calculate time remaining
            this.calculateTimeRemaining();

            // Calculate next stop progress if available
            if (this.tripData.nextStop) {
                await this.calculateNextStopProgress();
            }
        } catch (error) {
            console.error('Error calculating progress:', error);
        }
    }

    /**
     * Calculate time remaining to destination
     */
    calculateTimeRemaining() {
        if (!this.tripData || !this.tripData.distanceToDestination) return;

        // Use average speed from route calculation or default
        const averageSpeed = this.tripData.averageSpeed || 80; // km/h default
        const timeInHours = this.tripData.distanceToDestination / averageSpeed;
        const timeInMinutes = Math.round(timeInHours * 60);

        this.tripData.timeRemaining = timeInMinutes;
    }

    /**
     * Calculate next stop progress
     */
    async calculateNextStopProgress() {
        if (!this.tripData.nextStop || !this.currentPosition) return;

        try {
            // Calculate distance to next stop from current position
            const distanceToNextStop = await this.geolocationManager.getDistance(
                this.currentPosition,
                this.tripData.nextStop
            );

            // Determine the start location for next stop calculations
            // If nextStopStartLocation exists, use that (for updated stops)
            // Otherwise use the original start location
            const nextStopStartLocation = this.tripData.nextStopStartLocation || this.tripData.startLocation;

            // Calculate total distance to next stop (from the appropriate start location)
            const totalDistanceToNextStop = await this.geolocationManager.getDistance(
                nextStopStartLocation,
                this.tripData.nextStop
            );

            // Calculate traveled distance to next stop (from the appropriate start location)
            const traveledDistanceToNextStop = await this.geolocationManager.getDistance(
                nextStopStartLocation,
                this.currentPosition
            );

            // Calculate progress percentage to next stop
            const nextStopProgressPercentage = Math.min(100, Math.max(0, 
                (traveledDistanceToNextStop / totalDistanceToNextStop) * 100
            ));

            // Calculate time to next stop
            const averageSpeed = this.tripData.averageSpeed || 80;
            const timeToNextStopInHours = distanceToNextStop / averageSpeed;
            const timeToNextStopInMinutes = Math.round(timeToNextStopInHours * 60);

            // Update trip data
            this.tripData.distanceToNextStop = distanceToNextStop;
            this.tripData.nextStopProgressPercentage = nextStopProgressPercentage;
            this.tripData.timeToNextStop = timeToNextStopInMinutes;
        } catch (error) {
            console.error('Error calculating next stop progress:', error);
        }
    }

    /**
     * Update the display with current progress
     */
    updateDisplay() {
        if (!this.tripData) return;

        // Update progress bars
        this.updateProgressBars();
        
        // Update statistics
        this.updateStatistics();
    }

    /**
     * Update progress bars
     */
    updateProgressBars() {
        // Main destination progress
        if (this.elements.progressFillDestination) {
            const progress = this.tripData.progressPercentage || 0;
            this.elements.progressFillDestination.style.width = `${progress}%`;
        }

        // Next stop progress
        if (this.elements.progressFillNextStop && this.tripData.nextStop) {
            const progress = this.tripData.nextStopProgressPercentage || 0;
            this.elements.progressFillNextStop.style.width = `${progress}%`;
        }
    }

    /**
     * Update statistics display
     */
    updateStatistics() {
        // Time remaining
        if (this.elements.remainingTime) {
            const timeRemaining = this.tripData.timeRemaining || 0;
            this.elements.remainingTime.textContent = this.formatTime(timeRemaining);
        }

        // Traveled distance
        if (this.elements.traveledDistance) {
            const traveledDistance = this.tripData.traveledDistance || 0;
            this.elements.traveledDistance.textContent = `${traveledDistance.toFixed(1)} km`;
        }

        // Progress percentage
        if (this.elements.progress) {
            const progress = this.tripData.progressPercentage || 0;
            this.elements.progress.textContent = `${Math.round(progress)}%`;
        }

        // Remaining distance
        if (this.elements.remainingDistance) {
            const remainingDistance = this.tripData.distanceToDestination || 0;
            this.elements.remainingDistance.textContent = `${remainingDistance.toFixed(1)} km`;
        }

        // Next stop time (if available)
        if (this.elements.nextStopTime && this.tripData.nextStop) {
            const timeToNextStop = this.tripData.timeToNextStop || 0;
            this.elements.nextStopTime.textContent = this.formatTime(timeToNextStop);
        }
    }

    /**
     * Update next stop visibility
     */
    updateNextStopVisibility() {
        const hasNextStop = !!(this.tripData && this.tripData.nextStop);
        
        if (this.elements.nextStopProgress) {
            this.elements.nextStopProgress.style.display = hasNextStop ? 'block' : 'none';
        }
        
        if (this.elements.nextStopStat) {
            this.elements.nextStopStat.style.display = hasNextStop ? 'block' : 'none';
        }
    }

    /**
     * Update next stop progress (for when next stop is added/updated during trip)
     */
    async updateNextStopProgress() {
        if (!this.tripData) return;

        // Recalculate next stop progress
        if (this.tripData.nextStop) {
            await this.calculateNextStopProgress();
        }

        // Update visibility
        this.updateNextStopVisibility();
        
        // Update display
        this.updateDisplay();
    }

    /**
     * Start periodic updates
     */
    startPeriodicUpdates() {
        // Clear existing interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        // Start new interval (update every 30 seconds)
        this.updateInterval = setInterval(async () => {
            if (this.tripData && this.currentPosition) {
                await this.updateProgress(this.currentPosition);
            }
        }, 30000);
    }

    /**
     * Stop periodic updates
     */
    stopPeriodicUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Format time in minutes to HH:MM format
     * @param {number} minutes - Time in minutes
     * @returns {string} Formatted time string
     */
    formatTime(minutes) {
        if (minutes < 0) return '--:--';
        
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}`;
        } else {
            return `${mins} min`;
        }
    }

    /**
     * Save trip data to storage
     */
    saveTripData() {
        if (this.tripData && window.storageManager) {
            window.storageManager.saveTripData(this.tripData);
        }
    }

    /**
     * Load trip data from storage
     * @returns {Object|null} Loaded trip data or null
     */
    loadTripData() {
        if (window.storageManager) {
            const tripData = window.storageManager.loadTripData();
            if (tripData) {
                this.tripData = tripData;
                this.updateDisplay();
                this.updateNextStopVisibility();
                return tripData;
            }
        }
        return null;
    }

    /**
     * Reset trip data
     */
    resetTrip() {
        this.tripData = null;
        this.currentPosition = null;
        this.stopPeriodicUpdates();
        
        // Reset display
        this.resetDisplay();
        
        // Clear storage
        if (window.storageManager) {
            window.storageManager.clearTripData();
        }
    }

    /**
     * Reset display to initial state
     */
    resetDisplay() {
        // Reset progress bars
        if (this.elements.progressFillDestination) {
            this.elements.progressFillDestination.style.width = '0%';
        }
        if (this.elements.progressFillNextStop) {
            this.elements.progressFillNextStop.style.width = '0%';
        }

        // Reset statistics
        if (this.elements.remainingTime) this.elements.remainingTime.textContent = '--:--';
        if (this.elements.traveledDistance) this.elements.traveledDistance.textContent = '0 km';
        if (this.elements.progress) this.elements.progress.textContent = '0%';
        if (this.elements.remainingDistance) this.elements.remainingDistance.textContent = '0 km';
        if (this.elements.nextStopTime) this.elements.nextStopTime.textContent = '--:--';

        // Hide next stop elements
        this.updateNextStopVisibility();
    }

    /**
     * Get current trip status
     * @returns {Object} Trip status information
     */
    getTripStatus() {
        return {
            isActive: !!this.tripData,
            tripData: this.tripData,
            currentPosition: this.currentPosition,
            lastUpdateTime: this.lastUpdateTime,
            hasNextStop: !!(this.tripData && this.tripData.nextStop)
        };
    }

    /**
     * Set geolocation manager reference
     * @param {GeolocationManager} geolocationManager - Geolocation manager instance
     */
    setGeolocationManager(geolocationManager) {
        this.geolocationManager = geolocationManager;
    }

    /**
     * Get achievement progress (for future use)
     * @returns {Object} Achievement progress data
     */
    getAchievementProgress() {
        if (!this.tripData) return {};

        const traveledDistance = this.tripData.traveledDistance || 0;
        const progressPercentage = this.tripData.progressPercentage || 0;

        return {
            distanceMilestones: {
                '5km': traveledDistance >= 5,
                '10km': traveledDistance >= 10,
                '25km': traveledDistance >= 25,
                '50km': traveledDistance >= 50,
                '100km': traveledDistance >= 100
            },
            progressMilestones: {
                '25%': progressPercentage >= 25,
                '50%': progressPercentage >= 50,
                '75%': progressPercentage >= 75,
                '90%': progressPercentage >= 90,
                '100%': progressPercentage >= 100
            }
        };
    }
}

// Export for use in other modules
window.ProgressTracker = ProgressTracker; 