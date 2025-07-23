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
            // Get current location as origin
            const origin = await window.geolocationManager.getCurrentPosition();
            
            // Geocode destination
            const destination = await window.geolocationManager.geocodeAddress(destinationAddress);
            
            // Geocode next stop if provided
            let nextStop = null;
            if (nextStopAddress && nextStopAddress.trim() !== '') {
                nextStop = await window.geolocationManager.geocodeAddress(nextStopAddress);
            }

            // Calculate total distance
            const totalDistance = window.geolocationManager.calculateDistance(
                origin.lat, origin.lng,
                destination.lat, destination.lng
            );

            this.tripData = {
                origin: origin,
                destination: destination,
                nextStop: nextStop,
                nextStopOrigin: nextStop ? origin : null, // Initialize nextStopOrigin for next stop progress
                startTime: Date.now(),
                totalDistance: totalDistance,
                distanceTraveled: 0,
                isActive: true
            };

            // Start location tracking
            window.geolocationManager.startTracking(
                (position) => this.updateProgress(position),
                (error) => this.handleLocationError(error)
            );

            this.updateDisplay();
            return this.tripData;

        } catch (error) {
            console.error('Error starting trip:', error);
            throw error;
        }
    }

    /**
     * Update progress based on current position
     */
    updateProgress(currentPosition) {
        if (!this.tripData.isActive || !this.tripData.origin || !this.tripData.destination) {
            return;
        }

        // Calculate distance from origin to current position
        const distanceFromOrigin = window.geolocationManager.calculateDistance(
            this.tripData.origin.lat, this.tripData.origin.lng,
            currentPosition.lat, currentPosition.lng
        );

        // Calculate distance from current position to destination
        const distanceToDestination = window.geolocationManager.calculateDistance(
            currentPosition.lat, currentPosition.lng,
            this.tripData.destination.lat, this.tripData.destination.lng
        );

        // Update trip data
        this.tripData.distanceTraveled = distanceFromOrigin;
        const remainingDistance = distanceToDestination;

        // Calculate progress percentage
        const progressPercentage = Math.min(100, Math.max(0, 
            (this.tripData.distanceTraveled / this.tripData.totalDistance) * 100
        ));

        // Check if we've reached the destination (within 500 meters)
        if (remainingDistance <= 0.5) {
            this.completeTrip();
        }

        // Update display
        this.updateDisplay(progressPercentage, remainingDistance);

        // Check for achievements
        this.checkAchievements(progressPercentage, remainingDistance);

        // Call progress update callback
        if (this.onProgressUpdate) {
            this.onProgressUpdate({
                progressPercentage,
                distanceTraveled: this.tripData.distanceTraveled,
                remainingDistance,
                totalDistance: this.tripData.totalDistance
            });
        }
    }

    /**
     * Update the visual display
     */
    updateDisplay(progressPercentage = 0, remainingDistance = this.tripData.totalDistance) {
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
            const nextStopProgress = document.getElementById('next-stop-progress');
            if (nextStopProgress) {
                nextStopProgress.classList.remove('visible');
            }
        }

        // Update distance information
        const remainingDistanceEl = document.getElementById('remaining-distance');
        const distanceTraveledEl = document.getElementById('distance-traveled');
        const progressPercentageEl = document.getElementById('progress-percentage');
        const timeRemainingEl = document.getElementById('time-remaining');

        if (remainingDistanceEl) {
            remainingDistanceEl.textContent = `${remainingDistance.toFixed(1)} km`;
        }

        if (distanceTraveledEl) {
            distanceTraveledEl.textContent = `${this.tripData.distanceTraveled.toFixed(1)} km`;
        }

        if (progressPercentageEl) {
            progressPercentageEl.textContent = `${Math.round(progressPercentage)}%`;
        }

        // Calculate and update time remaining
        if (timeRemainingEl && this.tripData.startTime) {
            const timeRemaining = this.calculateTimeRemaining(remainingDistance);
            timeRemainingEl.textContent = timeRemaining;
        }

        // Update status
        this.updateStatus(progressPercentage, remainingDistance);
    }

    /**
     * Update next stop progress bar
     */
    updateNextStopProgress() {
        if (!this.tripData.nextStop) {
            return;
        }

        // Show next stop progress bar
        const nextStopProgress = document.getElementById('next-stop-progress');
        if (nextStopProgress) {
            nextStopProgress.classList.add('visible');
        }

        // Use nextStopOrigin if available (for updates), otherwise use original origin
        const nextStopStartPoint = this.tripData.nextStopOrigin || this.tripData.origin;
        if (!nextStopStartPoint) {
            return;
        }

        // Calculate total distance to next stop
        const totalDistanceToNextStop = window.geolocationManager.calculateDistance(
            nextStopStartPoint.lat, nextStopStartPoint.lng,
            this.tripData.nextStop.lat, this.tripData.nextStop.lng
        );

        // Calculate current distance to next stop
        const currentPosition = window.geolocationManager.getCurrentPositionSync();
        if (!currentPosition) {
            return;
        }

        const distanceToNextStop = window.geolocationManager.calculateDistance(
            currentPosition.lat, currentPosition.lng,
            this.tripData.nextStop.lat, this.tripData.nextStop.lng
        );

        // Calculate progress percentage to next stop
        const progressToNextStop = Math.min(100, Math.max(0, 
            ((totalDistanceToNextStop - distanceToNextStop) / totalDistanceToNextStop) * 100
        ));

        // Update next stop progress bar
        const progressFillNextStop = document.getElementById('progress-fill-nextstop');
        const progressIndicatorNextStop = document.getElementById('progress-indicator-nextstop');
        
        if (progressFillNextStop && progressIndicatorNextStop) {
            progressFillNextStop.style.height = `${progressToNextStop}%`;
            progressIndicatorNextStop.style.bottom = `${progressToNextStop}%`;
        }

        // Check if we've reached the next stop (within 500 meters)
        if (distanceToNextStop <= 0.5) {
            this.handleNextStopReached();
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
     * Calculate time remaining based on average speed
     */
    calculateTimeRemaining(remainingDistance) {
        if (!this.tripData.startTime || this.tripData.distanceTraveled === 0) {
            return '--';
        }

        // Calculate average speed from traveled distance
        const elapsedTime = (Date.now() - this.tripData.startTime) / 1000 / 60; // minutes
        const averageSpeed = this.tripData.distanceTraveled / (elapsedTime / 60); // km/h

        // Use average speed or default to 80 km/h if too slow/fast
        let speed = averageSpeed;
        if (speed < 20 || speed > 120) {
            speed = 80; // Default highway speed
        }

        const timeRemainingHours = remainingDistance / speed;
        
        if (timeRemainingHours >= 1) {
            const hours = Math.floor(timeRemainingHours);
            const minutes = Math.round((timeRemainingHours - hours) * 60);
            if (hours >= 2) {
                return `${hours} uur`;
            } else {
                return `${hours}u ${minutes}m`;
            }
        } else {
            const minutes = Math.round(timeRemainingHours * 60);
            if (minutes <= 5) {
                return 'Bijna daar!';
            } else if (minutes <= 15) {
                return `${minutes} minuten`;
            } else {
                return `${minutes}m`;
            }
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
            this.playAchievementSound();
            this.showAchievement(progressPercentage);
        }

        // Distance milestones
        if (remainingDistance <= 1 && remainingDistance > 0.5) {
            this.playAchievementSound();
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
     * Play achievement sound
     */
    playAchievementSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Achievement sound: ascending notes
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.2);
            oscillator.frequency.setValueAtTime(1500, audioContext.currentTime + 0.3);
            
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.4);
        } catch (error) {
            // Sound not supported, ignore
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
            
            // Geocode the new next stop
            const nextStop = await window.geolocationManager.geocodeAddress(nextStopAddress);
            
            // Update trip data
            this.tripData.nextStop = nextStop;
            
            // Update the origin for next stop progress to current position
            // (but keep original origin for main destination progress)
            this.tripData.nextStopOrigin = currentPosition;
            
            // Update display
            this.updateNextStopProgress();
            
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
            startTime: null,
            totalDistance: 0,
            distanceTraveled: 0,
            isActive: false
        };

        window.geolocationManager.stopTracking();
        this.updateDisplay();
        this.resetStatus();
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
        const distanceTraveledEl = document.getElementById('distance-traveled');
        const progressPercentageEl = document.getElementById('progress-percentage');
        const timeRemainingEl = document.getElementById('time-remaining');

        if (remainingDistanceEl) remainingDistanceEl.textContent = '-- km';
        if (distanceTraveledEl) distanceTraveledEl.textContent = '-- km';
        if (progressPercentageEl) progressPercentageEl.textContent = '0%';
        if (timeRemainingEl) timeRemainingEl.textContent = '--';
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
}

// Create global instance
window.progressTracker = new ProgressTracker(); 