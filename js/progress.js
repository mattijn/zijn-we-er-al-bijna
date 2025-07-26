/**
 * Progress Tracking Module
 * Handles trip progress calculations and visual updates
 */

class ProgressTracker {
    constructor() {
        this.tripData = {
            origin: null,
            destination: null,
            nextStop: null,
            startTime: null,
            totalDistance: 0,
            distanceTraveled: 0,
            isActive: false
        };
        
        this.onProgressUpdate = null;
        this.onTripComplete = null;
    }

    /**
     * Initialize a new trip
     */
    async startTrip(destinationAddress, nextStopAddress = null) {
        try {
            // Debug: Log the addresses being used
            console.log('🔍 DEBUG - startTrip called with:');
            console.log('Destination address:', destinationAddress);
            console.log('Next stop address:', nextStopAddress);
            
            // Get current location as origin
            const origin = await window.geolocationManager.getCurrentPosition();
            
            // Geocode destination
            const destination = await window.geolocationManager.geocodeAddress(destinationAddress);
            
            // Geocode next stop if provided
            let nextStop = null;
            if (nextStopAddress && nextStopAddress.trim() !== '') {
                nextStop = await window.geolocationManager.geocodeAddress(nextStopAddress);
            }

            // Debug: Log the geocoding results
            console.log('🔍 DEBUG - Geocoding results:');
            console.log('Origin:', origin);
            console.log('Destination:', destination);
            console.log('Next stop:', nextStop);

            // Get route information using OSRM for better calculations
            const routeInfo = await window.geolocationManager.getRouteInfo(origin, destination);
            
            // Debug: Log the route information
            console.log('🔍 DEBUG - Route info:');
            console.log('OSRM distance:', routeInfo.distance, 'km');
            console.log('OSRM duration:', routeInfo.duration, 'min');
            console.log('OSRM average speed:', routeInfo.averageSpeed, 'km/h');

            this.tripData = {
                origin: origin,
                destination: destination,
                nextStop: nextStop,
                nextStopOrigin: nextStop ? origin : null,
                startTime: Date.now(),
                totalDistance: routeInfo.distance,
                distanceTraveled: 0,
                isActive: true,
                routeInfo: routeInfo, // Store OSRM route data
                speedHistory: [], // Track speed history for better calculations
                lastUpdateTime: Date.now()
            };

            // Start location tracking
            window.geolocationManager.startTracking(
                (position) => this.updateProgress(position),
                (error) => this.handleLocationError(error)
            );

            // Get current position and do initial progress update
            const currentPosition = await window.geolocationManager.getCurrentPosition();
            await this.updateProgress(currentPosition);
            
            return this.tripData;

        } catch (error) {
            console.error('Error starting trip:', error);
            throw error;
        }
    }

    /**
     * Update progress based on current position
     */
    async updateProgress(currentPosition) {
        if (!this.tripData.isActive || !this.tripData.origin || !this.tripData.destination) {
            return;
        }

        try {
            const now = Date.now();
            const timeSinceLastUpdate = (now - this.tripData.lastUpdateTime) / 1000; // seconds

            // Get updated route info from current position
            const currentRouteInfo = await window.geolocationManager.getRouteInfo(
                currentPosition,
                this.tripData.destination
            );

            // Store the updated route info for time calculations
            this.tripData.routeInfo = currentRouteInfo;

            // Calculate progress based on OSRM route distances
            const distanceFromOrigin = this.tripData.totalDistance - currentRouteInfo.distance;
            const progressPercentage = Math.min(100, Math.max(0, 
                (distanceFromOrigin / this.tripData.totalDistance) * 100
            ));

            // Update display with new progress
            await this.updateDisplay(progressPercentage, currentRouteInfo.distance);

            // Check if we've reached the destination (within 50 meters)
            if (currentRouteInfo.distance <= 0.05) {
                this.completeTrip();
            }

            // Store last update time
            this.tripData.lastUpdateTime = now;

            // Call progress callback if set
            if (this.onProgressUpdate) {
                this.onProgressUpdate({
                    progressPercentage,
                    distanceTraveled: distanceFromOrigin,
                    remainingDistance: currentRouteInfo.distance,
                    totalDistance: this.tripData.totalDistance
                });
            }
        } catch (error) {
            console.error('Error updating progress:', error);
            this.handleLocationError(error);
        }
    }

    /**
     * Update display with current progress
     */
    async updateDisplay(progressPercentage = 0, remainingDistance = this.tripData.totalDistance) {
        // Update destination progress bar
        const progressFillDestination = document.getElementById('progress-fill-destination');
        const progressIndicatorDestination = document.getElementById('progress-indicator-destination');
        
        if (progressFillDestination && progressIndicatorDestination) {
            progressFillDestination.style.height = `${progressPercentage}%`;
            progressIndicatorDestination.style.bottom = `${progressPercentage}%`;
        }

        // Update next stop progress bar if exists
        if (this.tripData.nextStop) {
            this.updateNextStopProgress();
        } else {
            // Hide next stop progress bar
            const nextStopProgress = document.getElementById('progress-nextstop');
            if (nextStopProgress) {
                nextStopProgress.style.display = 'none';
            }
        }

        // Update remaining time
        const remainingTimeEl = document.getElementById('remaining-time');
        if (remainingTimeEl) {
            const remainingTime = await this.calculateTimeRemaining(remainingDistance);
            if (remainingTime) {
                remainingTimeEl.textContent = remainingTime;
            } else {
                remainingTimeEl.textContent = '--:--';
            }
        }

        // Update next stop time if available
        const nextStopTimeEl = document.getElementById('next-stop-time');
        if (nextStopTimeEl) {
            if (this.tripData.nextStop && this.tripData.startTime) {
                const nextStopTime = await this.calculateTimeToNextStop();
                if (nextStopTime) {
                    nextStopTimeEl.textContent = nextStopTime;
                } else {
                    nextStopTimeEl.textContent = '--:--';
                }
            } else {
                nextStopTimeEl.textContent = '--:--';
            }
        }

        // Update remaining distance
        const remainingDistanceEl = document.getElementById('remaining-distance');
        if (remainingDistanceEl) {
            remainingDistanceEl.textContent = `${remainingDistance.toFixed(1)} km`;
        }

        // Update traveled distance
        const traveledDistanceEl = document.getElementById('traveled-distance');
        if (traveledDistanceEl) {
            const traveledDistance = Math.max(0, this.tripData.totalDistance - remainingDistance);
            traveledDistanceEl.textContent = `${traveledDistance.toFixed(1)} km`;
        }

        // Update progress percentage
        const progressEl = document.getElementById('progress');
        if (progressEl) {
            progressEl.textContent = `${Math.round(progressPercentage)}%`;
        }

        // Update status
        this.updateStatus(progressPercentage, remainingDistance);

        // Check achievements
        this.checkAchievements(progressPercentage, remainingDistance);
    }

    /**
     * Update next stop progress bar
     */
    async updateNextStopProgress() {
        if (!this.tripData.nextStop) {
            return;
        }

        try {
            // Show next stop progress bar
            const nextStopProgress = document.getElementById('next-stop-progress');
            if (nextStopProgress) {
                nextStopProgress.classList.add('visible');
            }

            // For progress calculation, determine if this is an original or updated next stop
            const isUpdatedNextStop = this.tripData.nextStopOrigin && 
                (this.tripData.nextStopOrigin.lat !== this.tripData.origin.lat || 
                 this.tripData.nextStopOrigin.lng !== this.tripData.origin.lng);
            
            // Use nextStopOrigin if this is an updated next stop, otherwise use original origin
            const nextStopStartPoint = isUpdatedNextStop ? this.tripData.nextStopOrigin : this.tripData.origin;
            if (!nextStopStartPoint) {
                return;
            }

            // Get current position
            const currentPosition = window.geolocationManager.getCurrentPositionSync();
            if (!currentPosition) {
                // If no current position available, show 0% progress but keep the bar visible
                const progressFillNextStop = document.getElementById('progress-fill-nextstop');
                const progressIndicatorNextStop = document.getElementById('progress-indicator-nextstop');
                
                if (progressFillNextStop && progressIndicatorNextStop) {
                    progressFillNextStop.style.height = '0%';
                    progressIndicatorNextStop.style.bottom = '0%';
                }
                return;
            }

            // Get route info for next stop
            const currentToNextStop = await window.geolocationManager.getRouteInfo(
                currentPosition,
                this.tripData.nextStop
            );

            // Store route info for time calculations
            this.tripData.nextStopRouteInfo = currentToNextStop;

            // Calculate progress based on OSRM route distances
            const startToNextStop = await window.geolocationManager.getRouteInfo(
                nextStopStartPoint,
                this.tripData.nextStop
            );

            const totalDistanceToNextStop = startToNextStop.distance;
            const distanceToNextStop = currentToNextStop.distance;
            const distanceTraveled = totalDistanceToNextStop - distanceToNextStop;
            
            // Calculate progress percentage
            const progressToNextStop = Math.min(100, Math.max(0, 
                (distanceTraveled / totalDistanceToNextStop) * 100
            ));

            // Update next stop progress bar
            const progressFillNextStop = document.getElementById('progress-fill-nextstop');
            const progressIndicatorNextStop = document.getElementById('progress-indicator-nextstop');
            
            if (progressFillNextStop && progressIndicatorNextStop) {
                progressFillNextStop.style.height = `${progressToNextStop}%`;
                progressIndicatorNextStop.style.bottom = `${progressToNextStop}%`;
            }

            // Check if we've reached the next stop (within 50 meters)
            if (distanceToNextStop <= 0.05) {
                this.handleNextStopReached();
            }
        } catch (error) {
            console.error('Error updating next stop progress:', error);
            // Don't show error to user, just log it
        }
    }

    /**
     * Handle when next stop is reached
     */
    handleNextStopReached() {
        // Show achievement for reaching next stop
        this.showAchievement('nextStop');
        
        // Update status
        const statusCard = document.getElementById('status-card');
        if (statusCard) {
            const statusIcon = statusCard.querySelector('.status-icon');
            const statusText = statusCard.querySelector('.status-text');
            
            statusIcon.textContent = '⏸️';
            statusText.textContent = 'Je bent aangekomen bij je volgende stop!';
        }
    }

    /**
     * Calculate time to next stop using OSRM route data
     */
    async calculateTimeToNextStop() {
        if (!this.tripData.nextStop || !this.tripData.startTime) {
            return null;
        }

        try {
            // Get current position
            const currentPosition = window.geolocationManager.getCurrentPositionSync();
            if (!currentPosition) {
                return null;
            }

            // Get fresh route info from current position to next stop
            const currentToNextStop = await window.geolocationManager.getRouteInfo(
                currentPosition,
                this.tripData.nextStop
            );

            if (!currentToNextStop || !currentToNextStop.duration) {
                return null;
            }

            // Use the duration directly from OSRM
            const timeRemaining = currentToNextStop.duration; // minutes
            
            // Format time remaining
            if (timeRemaining >= 60) {
                const hours = Math.floor(timeRemaining / 60);
                const minutes = Math.round(timeRemaining % 60);
                if (hours >= 2) {
                    return `${hours} uur`;
                } else {
                    return `${hours}u ${minutes}m`;
                }
            } else {
                const minutes = Math.round(timeRemaining);
                return `${minutes} min`;
            }
        } catch (error) {
            console.error('Error calculating time to next stop:', error);
            return null;
        }
    }

    /**
     * Calculate remaining time using OSRM route data
     */
    async calculateTimeRemaining(remainingDistance) {
        if (!this.tripData.isActive || !this.tripData.startTime) {
            return null;
        }

        try {
            // Get current position
            const currentPosition = window.geolocationManager.getCurrentPositionSync();
            if (!currentPosition) {
                return null;
            }

            // Get fresh route info from current position to destination
            const currentToDestination = await window.geolocationManager.getRouteInfo(
                currentPosition,
                this.tripData.destination
            );

            if (!currentToDestination || !currentToDestination.duration) {
                return null;
            }

            // Use the duration directly from OSRM
            const timeRemaining = currentToDestination.duration; // minutes
            
            // Format time remaining
            if (timeRemaining >= 60) {
                const hours = Math.floor(timeRemaining / 60);
                const minutes = Math.round(timeRemaining % 60);
                if (hours >= 2) {
                    return `${hours} uur`;
                } else {
                    return `${hours}u ${minutes}m`;
                }
            } else {
                const minutes = Math.round(timeRemaining);
                return `${minutes} min`;
            }
        } catch (error) {
            console.error('Error calculating remaining time:', error);
            return null;
        }
    }

    /**
     * Update status message with fun Dutch content
     */
    updateStatus(progressPercentage, remainingDistance) {
        const statusCard = document.getElementById('status-card');
        if (!statusCard) return;

        const statusIcon = statusCard.querySelector('.status-icon');
        const statusText = statusCard.querySelector('.status-text');

        if (remainingDistance <= 0.5) {
            statusIcon.textContent = '🎉';
            statusText.textContent = this.getFunnyStatus('arrival');
        } else if (remainingDistance <= 5) {
            statusIcon.textContent = '🏁';
            statusText.textContent = this.getFunnyStatus('near', remainingDistance);
        } else if (remainingDistance <= 20) {
            statusIcon.textContent = '🚗';
            statusText.textContent = this.getFunnyStatus('close', remainingDistance);
        } else {
            statusIcon.textContent = '🛣️';
            statusText.textContent = this.getFunnyStatus('far', remainingDistance);
        }
    }

    /**
     * Get funny status messages in Dutch
     */
    getFunnyStatus(type, distance = 0) {
        const messages = {
            arrival: [
                '🎉 Je bent er! Welkom op je bestemming!',
                '🎊 Gefeliciteerd! Je hebt de reis voltooid!',
                '🏆 Achievement unlocked: Reis voltooid!',
                '🎯 Bullseye! Je bent aangekomen!',
                '🌟 Super! Je bent er eindelijk!'
            ],
            near: [
                `🏁 Bijna daar! Nog ${distance.toFixed(1)} km te gaan!`,
                `🎯 Zo dichtbij! Nog ${distance.toFixed(1)} km!`,
                `⚡ Bijna klaar! Nog ${distance.toFixed(1)} km!`,
                `🎪 Bijna in de circus! Nog ${distance.toFixed(1)} km!`,
                `🍕 Pizza is bijna klaar! Nog ${distance.toFixed(1)} km!`
            ],
            close: [
                `🚗 Nog ${distance.toFixed(1)} km te gaan!`,
                `🎮 Level bijna voltooid! Nog ${distance.toFixed(1)} km!`,
                `🎵 Bijna bij het refrein! Nog ${distance.toFixed(1)} km!`,
                `🍦 IJsje bijna bereikt! Nog ${distance.toFixed(1)} km!`,
                `🎨 Schilderij bijna af! Nog ${distance.toFixed(1)} km!`
            ],
            far: [
                `🛣️ Reis in volle gang! Nog ${distance.toFixed(1)} km`,
                `🎪 Nog een hele circus te gaan! ${distance.toFixed(1)} km`,
                `🏰 Kasteel in zicht! Nog ${distance.toFixed(1)} km`,
                `🚀 Raket onderweg! Nog ${distance.toFixed(1)} km`,
                `🐉 Draak verslaan! Nog ${distance.toFixed(1)} km`
            ]
        };

        const typeMessages = messages[type] || messages.far;
        return typeMessages[Math.floor(Math.random() * typeMessages.length)];
    }

    /**
     * Check for achievements and play sounds
     */
    checkAchievements(progressPercentage, remainingDistance) {
        // Achievement milestones
        const milestones = [10, 25, 50, 75, 90];
        
        if (milestones.includes(Math.floor(progressPercentage))) {
            this.showAchievement(progressPercentage);
        }

        // Distance milestones
        if (remainingDistance <= 1 && remainingDistance > 0.5) {
            this.showAchievement('final');
        }
    }

    /**
     * Show achievement notification
     */
    showAchievement(type) {
        const achievements = {
            10: '🎯 10% voltooid! Je bent op weg!',
            25: '🎮 Kwart van de reis! Goed bezig!',
            50: '🎪 Halverwege! Je bent een held!',
            75: '🏆 Bijna klaar! Je kunt het!',
            90: '⚡ Zo dichtbij! Laatste sprint!',
            final: '🎊 Bijna daar! Laatste meters!'
        };

        const message = achievements[type] || '🎉 Achievement unlocked!';
        
        // Update status with achievement
        const statusCard = document.getElementById('status-card');
        if (statusCard) {
            const statusIcon = statusCard.querySelector('.status-icon');
            const statusText = statusCard.querySelector('.status-text');
            
            statusIcon.textContent = '🏆';
            statusText.textContent = message;
            
            // Reset after 3 seconds
            setTimeout(() => {
                const currentProgress = (this.tripData.distanceTraveled / this.tripData.totalDistance) * 100;
                const currentRemaining = this.tripData.totalDistance - this.tripData.distanceTraveled;
                this.updateStatus(currentProgress, currentRemaining);
            }, 3000);
        }
    }

    /**
     * Complete the trip
     */
    completeTrip() {
        this.tripData.isActive = false;
        window.geolocationManager.stopTracking();

        if (this.onTripComplete) {
            this.onTripComplete(this.tripData);
        }

        // Update status to completion
        this.updateStatus(100, 0);
    }

    /**
     * Stop the current trip
     */
    stopTrip() {
        this.tripData.isActive = false;
        window.geolocationManager.stopTracking();
        this.updateDisplay();
    }

    /**
     * Update next stop with new address
     */
    async updateNextStop(nextStopAddress) {
        if (!this.tripData.isActive) {
            throw new Error('Geen actieve reis bezig');
        }

        try {
            // Get current position as new origin for next stop
            const currentPosition = await window.geolocationManager.getCurrentPosition();
            
            console.log('🔍 DEBUG - updateNextStop: Using current position as new origin:', {
                lat: currentPosition.lat,
                lng: currentPosition.lng
            });
            
            // Geocode the new next stop
            const nextStop = await window.geolocationManager.geocodeAddress(nextStopAddress);
            
            console.log('🔍 DEBUG - updateNextStop: New next stop geocoded:', {
                address: nextStopAddress,
                lat: nextStop.lat,
                lng: nextStop.lng
            });
            
            // Get route information for next stop using OSRM
            const nextStopRouteInfo = await window.geolocationManager.getRouteInfo(currentPosition, nextStop);
            
            console.log('🔍 DEBUG - updateNextStop: New route info:', {
                distance: nextStopRouteInfo.distance + ' km',
                duration: nextStopRouteInfo.duration + ' min'
            });
            
            // Update trip data
            this.tripData.nextStop = nextStop;
            this.tripData.nextStopOrigin = currentPosition;
            this.tripData.nextStopRouteInfo = nextStopRouteInfo; // Store OSRM data for next stop
            
            // Reset next stop progress bar to 0% since we're starting from new origin
            const progressFillNextStop = document.getElementById('progress-fill-nextstop');
            const progressIndicatorNextStop = document.getElementById('progress-indicator-nextstop');
            
            if (progressFillNextStop && progressIndicatorNextStop) {
                progressFillNextStop.style.height = '0%';
                progressIndicatorNextStop.style.bottom = '0%';
                console.log('🔍 DEBUG - updateNextStop: Progress bar reset to 0%');
            }
            
            // Update display to show the reset progress
            this.updateNextStopProgress();
            
            // Also update the main display to refresh the next stop time calculation
            this.updateDisplay();
            
            // Force update of the main display to refresh next stop time
            const syncPosition = window.geolocationManager.getCurrentPositionSync();
            if (syncPosition) {
                this.updateProgress(syncPosition);
            }
            
            return this.tripData;
            
        } catch (error) {
            console.error('Error updating next stop:', error);
            throw error;
        }
    }

    /**
     * Reset trip data
     */
    resetTrip() {
        this.tripData = {
            origin: null,
            destination: null,
            nextStop: null,
            nextStopOrigin: null,
            nextStopRouteInfo: null,
            startTime: null,
            totalDistance: 0,
            distanceTraveled: 0,
            isActive: false,
            routeInfo: null,
            speedHistory: [],
            lastUpdateTime: null
        };

        window.geolocationManager.stopTracking();
        this.updateDisplay();
        this.resetStatus();
        
        // Hide next stop time item
        const nextStopTimeItem = document.getElementById('next-stop-time-item');
        if (nextStopTimeItem) {
            nextStopTimeItem.style.display = 'none';
        }
    }

    /**
     * Reset status to initial state
     */
    resetStatus() {
        const statusCard = document.getElementById('status-card');
        if (statusCard) {
            const statusIcon = statusCard.querySelector('.status-icon');
            const statusText = statusCard.querySelector('.status-text');
            
            statusIcon.textContent = '📍';
            statusText.textContent = 'Klaar om te beginnen!';
        }

        // Reset destination progress bar
        const progressFillDestination = document.getElementById('progress-fill-destination');
        const progressIndicatorDestination = document.getElementById('progress-indicator-destination');
        
        if (progressFillDestination) progressFillDestination.style.height = '0%';
        if (progressIndicatorDestination) progressIndicatorDestination.style.bottom = '0%';

        // Reset next stop progress bar
        const progressFillNextStop = document.getElementById('progress-fill-nextstop');
        const progressIndicatorNextStop = document.getElementById('progress-indicator-nextstop');
        
        if (progressFillNextStop) progressFillNextStop.style.height = '0%';
        if (progressIndicatorNextStop) progressIndicatorNextStop.style.bottom = '0%';

        // Hide next stop progress bar
        const nextStopProgress = document.getElementById('next-stop-progress');
        if (nextStopProgress) {
            nextStopProgress.classList.remove('visible');
        }

        // Reset distance info
        const remainingDistanceEl = document.getElementById('remaining-distance');
        const distanceTraveledEl = document.getElementById('traveled-distance');
        const progressPercentageEl = document.getElementById('progress');
        const timeRemainingEl = document.getElementById('remaining-time');

        if (remainingDistanceEl) remainingDistanceEl.textContent = '-- km';
        if (distanceTraveledEl) distanceTraveledEl.textContent = '-- km';
        if (progressPercentageEl) progressPercentageEl.textContent = '0%';
        if (timeRemainingEl) timeRemainingEl.textContent = '--:--';
        
        // Reset next stop time
        const nextStopTimeEl = document.getElementById('next-stop-time');
        if (nextStopTimeEl) nextStopTimeEl.textContent = '--:--';
    }

    /**
     * Handle location errors
     */
    handleLocationError(error) {
        console.error('Location tracking error:', error);
        
        const statusCard = document.getElementById('status-card');
        if (statusCard) {
            const statusIcon = statusCard.querySelector('.status-icon');
            const statusText = statusCard.querySelector('.status-text');
            
            statusIcon.textContent = '⚠️';
            statusText.textContent = 'Locatie probleem: ' + error.message;
        }
    }

    /**
     * Get current trip data
     */
    getTripData() {
        return { ...this.tripData };
    }

    /**
     * Check if trip is active
     */
    isTripActive() {
        return this.tripData.isActive;
    }

    /**
     * Set progress update callback
     */
    setProgressCallback(callback) {
        this.onProgressUpdate = callback;
    }

    /**
     * Set trip complete callback
     */
    setTripCompleteCallback(callback) {
        this.onTripComplete = callback;
    }

    setTripData(origin, destination, nextStop = null) {
        this.tripData = {
            origin,
            destination,
            nextStop,
            nextStopOrigin: nextStop ? origin : null,
            nextStopRouteInfo: null,
            startTime: Date.now(),
            totalDistance: 0, // This will be set by startTrip
            distanceTraveled: 0, // This will be set by updateProgress
            isActive: true,
            routeInfo: null, // This will be set by startTrip
            speedHistory: [], // This will be set by updateProgress
            lastUpdateTime: Date.now()
        };
        if (window.app) {
            window.app.updateNextStopVisibility();
        }
    }
}

// Create global instance
window.progressTracker = new ProgressTracker();

 