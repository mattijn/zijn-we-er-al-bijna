/**
 * Main Application Module
 * Coordinates all modules and handles user interactions
 */

class TripApp {
    constructor() {
        this.isInitialized = false;
        this.loadingOverlay = null;
        this.startButton = null;
        this.resetButton = null;
        this.destinationInput = null;
        this.nextStopInput = null;
        this.wakeLock = null;
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            this.setupElements();
            this.setupEventListeners();
            this.setupCallbacks();
            this.checkGeolocationSupport();
            this.loadSavedTrip();
            
            this.isInitialized = true;
            console.log('Trip app initialized successfully');
            
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showError('Er is een fout opgetreden bij het starten van de app');
        }
    }

    /**
     * Setup DOM element references
     */
    setupElements() {
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.startButton = document.getElementById('start-trip');
        this.resetButton = document.getElementById('reset-trip');
        this.backToSetupButton = document.getElementById('back-to-setup');
        this.destinationInput = document.getElementById('final-destination');
        this.nextStopInput = document.getElementById('next-stop');
        this.updateNextStopButton = document.getElementById('update-next-stop');

        if (!this.startButton || !this.resetButton || !this.backToSetupButton || !this.destinationInput) {
            throw new Error('Required DOM elements not found');
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Start trip button
        this.startButton.addEventListener('click', () => this.handleStartTrip());
        
        // Reset trip button
        this.resetButton.addEventListener('click', () => this.handleResetTrip());
        
        // Back to setup button
        this.backToSetupButton.addEventListener('click', () => this.handleBackToSetup());
        
        // Input field events
        this.destinationInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleStartTrip();
            }
        });
        
        this.nextStopInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleStartTrip();
            }
        });
        
        // Update next stop button
        if (this.updateNextStopButton) {
            this.updateNextStopButton.addEventListener('click', () => this.handleUpdateNextStop());
        }
        
        // Enable/disable update button based on next stop input
        this.nextStopInput.addEventListener('input', () => {
            if (this.updateNextStopButton) {
                this.updateNextStopButton.disabled = !this.nextStopInput.value.trim();
            }
        });

        // Handle page visibility changes (pause/resume tracking)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.handlePageHidden();
            } else {
                this.handlePageVisible();
            }
        });

        // Handle beforeunload (save trip data)
        window.addEventListener('beforeunload', () => {
            this.saveCurrentTrip();
        });
    }

    /**
     * Setup callback functions
     */
    setupCallbacks() {
        // Progress update callback
        window.progressTracker.setProgressCallback((progressData) => {
            this.handleProgressUpdate(progressData);
        });

        // Trip complete callback
        window.progressTracker.setTripCompleteCallback((tripData) => {
            this.handleTripComplete(tripData);
        });
    }

    /**
     * Check if geolocation is supported
     */
    checkGeolocationSupport() {
        if (!window.geolocationManager.isSupported()) {
            this.showError('Je browser ondersteunt geen locatie services. Probeer een andere browser.');
            this.startButton.disabled = true;
        }
    }

    /**
     * Load saved trip data
     */
    loadSavedTrip() {
        const savedTrip = window.tripStorage.loadTripData();
        if (savedTrip && savedTrip.isActive) {
            // Restore saved trip
            window.progressTracker.tripData = savedTrip;
            this.updateUIForActiveTrip();
        }
    }

    /**
     * Handle start trip button click
     */
    async handleStartTrip() {
        const destination = this.destinationInput.value.trim();
        const nextStop = this.nextStopInput.value.trim();

        if (!destination) {
            this.showError('Voer een eindbestemming in');
            this.destinationInput.focus();
            return;
        }

        if (window.progressTracker.isTripActive()) {
            this.showError('Er is al een actieve reis bezig');
            return;
        }

        try {
            this.showLoading('Locatie ophalen...');
            
            await window.progressTracker.startTrip(destination, nextStop);
            
            // Request wake lock to prevent device sleep
            await this.requestWakeLock();
            
            this.hideLoading();
            this.updateUIForActiveTrip();
            this.showSuccess('Reis gestart! Je locatie wordt nu bijgehouden.');
            
        } catch (error) {
            this.hideLoading();
            this.showError(error.message);
        }
    }

    /**
     * Handle reset trip button click
     */
    handleResetTrip() {
        if (window.progressTracker.isTripActive()) {
            if (confirm('Weet je zeker dat je de reis wilt stoppen?')) {
                window.progressTracker.stopTrip();
                this.releaseWakeLock();
                this.updateUIForStoppedTrip(); // Preserve input values when stopping
            } else {
                return;
            }
        } else {
            // If no active trip, this is a true reset - clear everything
            window.progressTracker.resetTrip();
            this.releaseWakeLock();
            this.updateUIForInactiveTrip(); // Clear input fields for reset
            window.tripStorage.clearTripData();
            this.showSuccess('Reis gereset');
        }
    }

    /**
     * Handle update next stop button click
     */
    async handleUpdateNextStop() {
        const nextStop = this.nextStopInput.value.trim();

        if (!nextStop) {
            this.showError('Voer een volgende stop in');
            this.nextStopInput.focus();
            return;
        }

        if (!window.progressTracker.isTripActive()) {
            this.showError('Er is geen actieve reis bezig');
            return;
        }

        try {
            this.showLoading('Volgende stop bijwerken...');
            
            await window.progressTracker.updateNextStop(nextStop);
            
            this.hideLoading();
            this.showSuccess('Volgende stop bijgewerkt!');
            
        } catch (error) {
            this.hideLoading();
            this.showError(error.message);
        }
    }

    /**
     * Handle back to setup button click (toggle functionality)
     */
    handleBackToSetup() {
        const addressSection = document.getElementById('address-section');
        const progressSection = document.getElementById('progress-section');
        const isCollapsed = addressSection.classList.contains('collapsed');
        
        if (isCollapsed) {
            // Show address section
            addressSection.classList.remove('collapsed');
            this.backToSetupButton.classList.add('active');
            
            // Make progress section compact
            if (progressSection) {
                progressSection.classList.add('compact');
            }
            
            // Re-enable destination input with current value
            this.destinationInput.disabled = false;
            // Next stop input stays enabled for updates
            
            // Show current destination in input
            const tripData = window.progressTracker.getTripData();
            if (tripData.destination && tripData.destination.displayName) {
                this.destinationInput.value = tripData.destination.displayName;
            }
            if (tripData.nextStop && tripData.nextStop.displayName) {
                this.nextStopInput.value = tripData.nextStop.displayName;
            }
            
            // Focus on destination input for better UX
            setTimeout(() => {
                this.destinationInput.focus();
            }, 100);
            
        } else {
            // Hide address section
            addressSection.classList.add('collapsed');
            this.backToSetupButton.classList.remove('active');
            
            // Make progress section full size
            if (progressSection) {
                progressSection.classList.remove('compact');
            }
        }
    }

    /**
     * Handle progress updates
     */
    handleProgressUpdate(progressData) {
        // Save trip data periodically
        if (progressData.progressPercentage % 10 === 0) { // Every 10%
            this.saveCurrentTrip();
        }
    }

    /**
     * Handle trip completion
     */
    handleTripComplete(tripData) {
        // Save to history
        window.tripStorage.saveToHistory(tripData);
        
        // Clear current trip data
        window.tripStorage.clearTripData();
        
        // Release wake lock
        this.releaseWakeLock();
        
        // Update UI
        this.updateUIForInactiveTrip();
        
        // Show completion message
        this.showSuccess('🎉 Gefeliciteerd! Je bent aangekomen op je bestemming!');
        
        // Play completion sound if available
        this.playCompletionSound();
    }

    /**
     * Update UI for active trip
     */
    updateUIForActiveTrip() {
        this.startButton.disabled = true;
        this.startButton.textContent = '🚗 Reis Actief';
        this.destinationInput.disabled = true;
        // Keep next stop input enabled for updates
        this.nextStopInput.disabled = false;
        this.resetButton.textContent = '⏹️ Stop Reis';
        this.backToSetupButton.classList.remove('hidden');
        
        // Collapse address section
        const addressSection = document.getElementById('address-section');
        if (addressSection) {
            addressSection.classList.add('collapsed');
        }
        
        // Ensure progress section is full size
        const progressSection = document.getElementById('progress-section');
        if (progressSection) {
            progressSection.classList.remove('compact');
        }
    }

    /**
     * Update UI for stopped trip (preserves input values)
     */
    updateUIForStoppedTrip() {
        this.startButton.disabled = false;
        this.startButton.textContent = '🚀 Start Reis';
        this.destinationInput.disabled = false;
        this.nextStopInput.disabled = false;
        this.resetButton.textContent = '🔄 Reset';
        this.backToSetupButton.classList.add('hidden');
        this.backToSetupButton.classList.remove('active');
        
        // Preserve input values (don't clear them)
        // this.destinationInput.value = ''; // Keep current value
        // this.nextStopInput.value = ''; // Keep current value
        
        // Expand address section
        const addressSection = document.getElementById('address-section');
        if (addressSection) {
            addressSection.classList.remove('collapsed');
        }
        
        // Ensure progress section is full size
        const progressSection = document.getElementById('progress-section');
        if (progressSection) {
            progressSection.classList.remove('compact');
        }
        
        this.showSuccess('Reis gestopt');
    }

    /**
     * Update UI for inactive trip (clears input values)
     */
    updateUIForInactiveTrip() {
        this.startButton.disabled = false;
        this.startButton.textContent = '🚀 Start Reis';
        this.destinationInput.disabled = false;
        this.nextStopInput.disabled = false;
        this.resetButton.textContent = '🔄 Reset';
        this.backToSetupButton.classList.add('hidden');
        this.backToSetupButton.classList.remove('active');
        
        // Clear input fields
        this.destinationInput.value = '';
        this.nextStopInput.value = '';
        
        // Expand address section
        const addressSection = document.getElementById('address-section');
        if (addressSection) {
            addressSection.classList.remove('collapsed');
        }
        
        // Ensure progress section is full size
        const progressSection = document.getElementById('progress-section');
        if (progressSection) {
            progressSection.classList.remove('compact');
        }
    }

    /**
     * Handle page becoming hidden
     */
    handlePageHidden() {
        // Save current trip data when page is hidden
        this.saveCurrentTrip();
    }

    /**
     * Handle page becoming visible
     */
    handlePageVisible() {
        // Resume tracking if trip was active
        if (window.progressTracker.isTripActive()) {
            // Restart location tracking
            window.geolocationManager.startTracking(
                (position) => window.progressTracker.updateProgress(position),
                (error) => window.progressTracker.handleLocationError(error)
            );
            
            // Re-request wake lock if it was lost
            if (!this.wakeLock) {
                this.requestWakeLock();
            }
        }
    }

    /**
     * Save current trip data
     */
    saveCurrentTrip() {
        if (window.progressTracker.isTripActive()) {
            const tripData = window.progressTracker.getTripData();
            window.tripStorage.saveTripData(tripData);
        }
    }

    /**
     * Show loading overlay
     */
    showLoading(message = 'Laden...') {
        if (this.loadingOverlay) {
            const loadingText = this.loadingOverlay.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = message;
            }
            this.loadingOverlay.classList.add('active');
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.remove('active');
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const statusCard = document.getElementById('status-card');
        if (statusCard) {
            const statusIcon = statusCard.querySelector('.status-icon');
            const statusText = statusCard.querySelector('.status-text');
            
            statusIcon.textContent = '⚠️';
            statusText.textContent = message;
            
            // Auto-clear error after 5 seconds
            setTimeout(() => {
                if (statusText.textContent === message) {
                    statusIcon.textContent = '📍';
                    statusText.textContent = 'Klaar om te beginnen!';
                }
            }, 5000);
        }
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        const statusCard = document.getElementById('status-card');
        if (statusCard) {
            const statusIcon = statusCard.querySelector('.status-icon');
            const statusText = statusCard.querySelector('.status-text');
            
            statusIcon.textContent = '✅';
            statusText.textContent = message;
            
            // Auto-clear success after 3 seconds
            setTimeout(() => {
                if (statusText.textContent === message) {
                    statusIcon.textContent = '📍';
                    statusText.textContent = 'Klaar om te beginnen!';
                }
            }, 3000);
        }
    }

    /**
     * Play completion sound (if supported)
     */
    playCompletionSound() {
        try {
            // Create a simple beep sound using Web Audio API
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            // Sound not supported, ignore
            console.log('Audio not supported');
        }
    }

    /**
     * Request wake lock to prevent device sleep
     */
    async requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake lock acquired');
                
                // Handle wake lock release
                this.wakeLock.addEventListener('release', () => {
                    console.log('Wake lock released');
                    this.wakeLock = null;
                });
            }
        } catch (error) {
            console.log('Wake lock not supported or denied:', error);
        }
    }

    /**
     * Release wake lock
     */
    releaseWakeLock() {
        if (this.wakeLock) {
            this.wakeLock.release();
            this.wakeLock = null;
            console.log('Wake lock released manually');
        }
    }

    /**
     * Get app status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isTripActive: window.progressTracker.isTripActive(),
            hasGeolocation: window.geolocationManager.isSupported(),
            currentPosition: window.geolocationManager.getCurrentPositionSync(),
            wakeLockActive: this.wakeLock !== null
        };
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.tripApp = new TripApp();
});

// Handle service worker for PWA capabilities (only if sw.js exists)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Check if service worker file exists before registering
        fetch('/sw.js', { method: 'HEAD' })
            .then(response => {
                if (response.ok) {
                    return navigator.serviceWorker.register('/sw.js');
                } else {
                    throw new Error('Service worker file not found');
                }
            })
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration skipped: ', registrationError.message);
            });
    });
} 