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

            // Get route information using OSRM for better calculations
            const routeInfo = await window.geolocationManager.getRouteInfo(origin, destination);

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

            // Get current position immediately for initial display
            const currentPosition = await window.geolocationManager.getCurrentPosition();
            // Initialize display without counting as a measurement
            this.updateDisplay(0, window.geolocationManager.calculateDistance(
                currentPosition.lat, currentPosition.lng,
                destination.lat, destination.lng
            ));
            
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

        const now = Date.now();
        const timeSinceLastUpdate = (now - this.tripData.lastUpdateTime) / 1000; // seconds

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

        // Calculate current speed if we have previous data and there's actual movement
        if (this.tripData.lastUpdateTime && timeSinceLastUpdate > 0) {
            const distanceTraveled = distanceFromOrigin - this.tripData.distanceTraveled;
            
            // Only add to speed history if there's actual movement (more than 1 meter)
            if (distanceTraveled > 0.001) {
                const currentSpeed = (distanceTraveled / timeSinceLastUpdate) * 3600; // km/h
                
                // Only add realistic speeds to history
                if (currentSpeed > 0 && currentSpeed < 200) {
                    this.tripData.speedHistory.push({
                        speed: currentSpeed,
                        timestamp: now
                    });
                    
                    // Keep only last 10 speed measurements
                    if (this.tripData.speedHistory.length > 10) {
                        this.tripData.speedHistory.shift();
                    }
                }
            }
        }

        // Update trip data
        this.tripData.distanceTraveled = distanceFromOrigin;
        this.tripData.lastUpdateTime = now;
        const remainingDistance = distanceToDestination;

        // Calculate progress percentage based on remaining distance to destination
        // This ensures progress reaches 100% when we arrive, regardless of route taken
        // Require at least 2 measurements for accurate progress calculation
        let progressPercentage = 0;
        if (this.tripData.speedHistory.length >= 2) {
            progressPercentage = Math.min(100, Math.max(0, 
                ((this.tripData.totalDistance - remainingDistance) / this.tripData.totalDistance) * 100
            ));
        }

        // Check if we've reached the destination (within 50 meters)
        if (remainingDistance <= 0.05) {
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
            
            // Add debug info in console for development
            if (this.tripData.routeInfo && this.tripData.routeInfo.roadTypes) {
                console.log('🚗 Route Info:', {
                    totalDistance: this.tripData.totalDistance.toFixed(1) + ' km',
                    remainingDistance: remainingDistance.toFixed(1) + ' km',
                    progressPercentage: Math.round(progressPercentage) + '%',
                    speedHistoryLength: this.tripData.speedHistory.length,
                    roadTypes: this.tripData.routeInfo.roadTypes,
                    expectedSpeed: window.geolocationManager.getExpectedSpeed(this.tripData.routeInfo.roadTypes) + ' km/h',
                    recentSpeeds: this.tripData.speedHistory.length + ' measurements',
                    timeRemaining: timeRemaining
                });
            }
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

        // Use OSRM route data if available, otherwise fallback to simple calculation
        let totalDistanceToNextStop = 0;
        if (this.tripData.nextStopRouteInfo) {
            totalDistanceToNextStop = this.tripData.nextStopRouteInfo.distance;
        } else {
            totalDistanceToNextStop = window.geolocationManager.calculateDistance(
                nextStopStartPoint.lat, nextStopStartPoint.lng,
                this.tripData.nextStop.lat, this.tripData.nextStop.lng
            );
        }

        // Calculate current distance to next stop
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

        // Check if we've reached the next stop (within 50 meters)
        if (distanceToNextStop <= 0.05) {
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
     * Calculate time remaining using improved algorithm with OSRM data
     */
    calculateTimeRemaining(remainingDistance) {
        if (!this.tripData.startTime || this.tripData.distanceTraveled === 0) {
            return '--';
        }

        let expectedSpeed = 80; // Default fallback speed

        // Method 1: Use OSRM route data if available
        if (this.tripData.routeInfo && this.tripData.routeInfo.roadTypes) {
            expectedSpeed = window.geolocationManager.getExpectedSpeed(this.tripData.routeInfo.roadTypes);
        }

        // Method 2: Use weighted average of recent speeds
        if (this.tripData.speedHistory && this.tripData.speedHistory.length > 0) {
            const recentSpeeds = this.tripData.speedHistory
                .filter(entry => entry.timestamp > Date.now() - 300000) // Last 5 minutes
                .map(entry => entry.speed);
            
            if (recentSpeeds.length > 0) {
                // Calculate weighted average (more recent speeds have higher weight)
                let totalWeight = 0;
                let weightedSum = 0;
                
                recentSpeeds.forEach((speed, index) => {
                    const weight = index + 1; // More recent = higher weight
                    weightedSum += speed * weight;
                    totalWeight += weight;
                });
                
                const weightedAverageSpeed = weightedSum / totalWeight;
                
                // Blend OSRM expected speed with actual recent speed
                if (this.tripData.routeInfo && this.tripData.routeInfo.roadTypes) {
                    expectedSpeed = (expectedSpeed * 0.4) + (weightedAverageSpeed * 0.6);
                } else {
                    expectedSpeed = weightedAverageSpeed;
                }
            }
        }

        // Method 3: Fallback to simple average speed calculation
        if (expectedSpeed === 80 && this.tripData.distanceTraveled > 0) {
            const elapsedTime = (Date.now() - this.tripData.startTime) / 1000 / 60; // minutes
            const averageSpeed = this.tripData.distanceTraveled / (elapsedTime / 60); // km/h
            
            if (averageSpeed >= 20 && averageSpeed <= 120) {
                expectedSpeed = averageSpeed;
            }
        }

        // Apply road type adjustments based on remaining distance
        if (remainingDistance > 50) {
            // Long distance - likely highway
            expectedSpeed = Math.max(expectedSpeed, 80);
        } else if (remainingDistance > 10) {
            // Medium distance - mixed roads
            expectedSpeed = Math.max(expectedSpeed, 60);
        } else {
            // Short distance - likely city driving
            expectedSpeed = Math.min(expectedSpeed, 50);
        }

        const timeRemainingHours = remainingDistance / expectedSpeed;
        
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
            
            // Get route information for next stop using OSRM
            const nextStopRouteInfo = await window.geolocationManager.getRouteInfo(currentPosition, nextStop);
            
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
            }
            
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

 