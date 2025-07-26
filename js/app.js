/**
 * TripApp - Main application module
 * Coordinates all other modules and handles user interactions
 */

class TripApp {
    constructor() {
        // Initialize managers
        this.storageManager = new StorageManager();
        this.geolocationManager = new GeolocationManager();
        this.progressTracker = new ProgressTracker();
        
        // Set up cross-module references
        this.progressTracker.setGeolocationManager(this.geolocationManager);
        
        // App state
        this.isActive = false;
        this.wakeLock = null;
        
        // DOM elements
        this.elements = {
            // Input elements
            destinationInput: document.getElementById('destination-input'),
            nextStopInput: document.getElementById('next-stop-input'),
            
            // Buttons
            startTripBtn: document.getElementById('start-trip-btn'),
            updateStopBtn: document.getElementById('update-stop-btn'),
            stopTripBtn: document.getElementById('stop-trip-btn'),
            resetTripBtn: document.getElementById('reset-trip-btn'),
            backToSetupBtn: document.getElementById('back-to-setup'),
            
            // Sections
            addressSection: document.getElementById('address-section'),
            progressSection: document.getElementById('progress-section'),
            
            // Toast container
            toastContainer: document.getElementById('toast-container')
        };
        
        // Initialize the app
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Set up event listeners
            this.setupEventListeners();
            
            // Fix viewport height for Safari
            this.fixViewportHeight();
            
            // Check for existing trip
            await this.checkForExistingTrip();
            
            // Request wake lock if supported
            this.requestWakeLock();
            
            console.log('🚗 Zijn we er al bijna? App initialized successfully!');
            
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showToast('Er is een fout opgetreden bij het starten van de app', 'error');
        }
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Start trip button
        this.elements.startTripBtn.addEventListener('click', () => {
            this.handleStartTrip();
        });

        // Update stop button
        this.elements.updateStopBtn.addEventListener('click', () => {
            this.handleUpdateStop();
        });

        // Stop trip button
        this.elements.stopTripBtn.addEventListener('click', () => {
            this.handleStopTrip();
        });

        // Reset trip button
        this.elements.resetTripBtn.addEventListener('click', () => {
            this.handleResetTrip();
        });

        // Settings button (toggle between setup and active trip view)
        this.elements.backToSetupBtn.addEventListener('click', () => {
            console.log('Settings button clicked!');
            console.log('isActive:', this.isActive);
            console.log('addressSection collapsed:', this.elements.addressSection.classList.contains('collapsed'));
            console.log('button visible:', !this.elements.backToSetupBtn.classList.contains('hidden'));
            console.log('button text:', this.elements.backToSetupBtn.textContent);
            
            if (this.isActive && !this.elements.addressSection.classList.contains('collapsed')) {
                // If we're in active trip and setup is visible, go back to active trip
                console.log('Going back to active trip');
                this.handleBackToActiveTrip();
            } else if (this.isActive) {
                // If we're in active trip and setup is hidden, go to setup
                console.log('Going to setup');
                this.handleBackToSetup();
            }
        });

        // Enter key support for inputs
        this.elements.destinationInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleStartTrip();
            }
        });

        this.elements.nextStopInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleUpdateStop();
            }
        });

        // Clear next stop when input is cleared
        this.elements.nextStopInput.addEventListener('input', (e) => {
            if (e.target.value.trim() === '' && this.isActive && this.progressTracker.tripData.nextStop) {
                this.handleClearNextStop();
            }
        });

        // Handle visibility change (app goes to background)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isActive) {
                this.showToast('App gaat naar achtergrond, maar blijft je locatie volgen', 'info');
            }
        });

        // Handle beforeunload (user leaves page)
        window.addEventListener('beforeunload', () => {
            if (this.isActive) {
                this.geolocationManager.stopTracking();
                this.progressTracker.stopPeriodicUpdates();
            }
        });
    }

    /**
     * Handle start trip action
     */
    async handleStartTrip() {
        try {
            const destination = this.elements.destinationInput.value.trim();
            const nextStop = this.elements.nextStopInput.value.trim();

            if (!destination) {
                this.showToast('Voer een eindbestemming in', 'error');
                return;
            }

            // Show loading state
            this.elements.startTripBtn.disabled = true;
            this.elements.startTripBtn.textContent = '🔄 Bezig...';

            // Request GPS permission
            this.showToast('Locatie toegang aanvragen...', 'info');
            const hasPermission = await this.geolocationManager.requestPermission();
            
            if (!hasPermission) {
                this.showToast('Locatie toegang is vereist voor deze app', 'error');
                this.resetStartButton();
                return;
            }

            // Get current position
            this.showToast('Huidige locatie ophalen...', 'info');
            const currentPosition = await this.geolocationManager.getCurrentPosition();

            // Geocode destination
            this.showToast('Bestemming zoeken...', 'info');
            const destinationCoords = await this.geolocationManager.geocodeAddress(destination);

            // Geocode next stop if provided
            let nextStopCoords = null;
            if (nextStop) {
                this.showToast('Tussenstop zoeken...', 'info');
                try {
                    nextStopCoords = await this.geolocationManager.geocodeAddress(nextStop);
                } catch (error) {
                    this.showToast('Tussenstop niet gevonden, wordt overgeslagen', 'warning');
                }
            }

            // Get route information
            this.showToast('Route berekenen...', 'info');
            const routeInfo = await this.geolocationManager.getRouteInfo(
                currentPosition,
                destinationCoords,
                nextStopCoords
            );

            // Create trip data
            const tripData = {
                startTime: Date.now(),
                startLocation: currentPosition,
                destination: destinationCoords,
                nextStop: nextStopCoords,
                routeInfo: routeInfo,
                averageSpeed: routeInfo.averageSpeed,
                destinationAddress: destination,
                nextStopAddress: nextStop || null
            };

            // Start the trip
            this.startTrip(tripData);

        } catch (error) {
            console.error('Error starting trip:', error);
            this.showToast(`Fout bij starten reis: ${error.message}`, 'error');
            this.resetStartButton();
        }
    }

    /**
     * Handle clear next stop action
     */
    handleClearNextStop() {
        // Clear next stop data
        this.progressTracker.tripData.nextStop = null;
        this.progressTracker.tripData.nextStopAddress = null;
        this.progressTracker.tripData.nextStopStartLocation = null;

        // Update progress
        this.progressTracker.updateNextStopProgress();

        // Save to storage
        this.progressTracker.saveTripData();

        this.showToast('Tussenstop verwijderd', 'info');
    }

    /**
     * Handle update stop action
     */
    async handleUpdateStop() {
        try {
            const nextStop = this.elements.nextStopInput.value.trim();

            if (!nextStop) {
                this.showToast('Voer een tussenstop in', 'error');
                return;
            }

            // Show loading state
            this.elements.updateStopBtn.disabled = true;
            this.elements.updateStopBtn.textContent = '🔄 Bezig...';

            // Geocode next stop
            this.showToast('Tussenstop zoeken...', 'info');
            const nextStopCoords = await this.geolocationManager.geocodeAddress(nextStop);

            // Update trip data
            this.progressTracker.tripData.nextStop = nextStopCoords;
            this.progressTracker.tripData.nextStopAddress = nextStop;
            
            // Update the next stop start location to current position
            if (this.geolocationManager.currentPosition) {
                this.progressTracker.tripData.nextStopStartLocation = this.geolocationManager.currentPosition;
            }

            // Update progress
            await this.progressTracker.updateNextStopProgress();

            // Save to storage
            this.progressTracker.saveTripData();

            this.showToast('Tussenstop bijgewerkt!', 'success');
            this.resetUpdateButton();

        } catch (error) {
            console.error('Error updating stop:', error);
            this.showToast(`Fout bij bijwerken tussenstop: ${error.message}`, 'error');
            this.resetUpdateButton();
        }
    }

    /**
     * Handle stop trip action
     */
    handleStopTrip() {
        this.isActive = false;
        
        // Stop GPS tracking
        this.geolocationManager.stopTracking();
        
        // Stop periodic updates
        this.progressTracker.stopPeriodicUpdates();
        
        // Update UI for stopped trip
        this.updateUIForStoppedTrip();
        
        this.showToast('Reis gestopt', 'info');
    }

    /**
     * Handle reset trip action
     */
    handleResetTrip() {
        // Stop everything
        this.geolocationManager.stopTracking();
        this.progressTracker.resetTrip();
        
        // Reset app state
        this.isActive = false;
        
        // Update UI for setup
        this.updateUIForSetup();
        
        // Release wake lock
        this.releaseWakeLock();
        
        this.showToast('Reis gereset', 'info');
    }

    /**
     * Handle back to setup action
     */
    handleBackToSetup() {
        this.updateUIForSetup();
        
        // Populate inputs with existing trip data if available
        if (this.progressTracker.tripData) {
            if (this.progressTracker.tripData.destinationAddress) {
                this.elements.destinationInput.value = this.progressTracker.tripData.destinationAddress;
            }
            if (this.progressTracker.tripData.nextStopAddress) {
                this.elements.nextStopInput.value = this.progressTracker.tripData.nextStopAddress;
            }
        }
    }

    /**
     * Handle back to active trip action
     */
    handleBackToActiveTrip() {
        this.updateUIForActiveTrip();
    }

    /**
     * Start a new trip
     * @param {Object} tripData - Trip data object
     */
    startTrip(tripData) {
        // Start GPS tracking
        this.geolocationManager.startTracking(
            async (position) => {
                await this.progressTracker.updateProgress(position);
            },
            (error) => {
                this.showToast(`GPS fout: ${error.message}`, 'error');
            }
        );

        // Start progress tracking
        this.progressTracker.startTrip(tripData);

        // Update app state
        this.isActive = true;

        // Update UI for active trip
        this.updateUIForActiveTrip();

        // Reset button state
        this.resetStartButton();

        this.showToast('Reis gestart! 🚗', 'success');
    }

    /**
     * Check for existing trip on app load
     */
    async checkForExistingTrip() {
        const existingTrip = this.progressTracker.loadTripData();
        
        if (existingTrip) {
            // Check if trip is recent (less than 24 hours)
            const twentyFourHours = 24 * 60 * 60 * 1000;
            const isRecent = (Date.now() - existingTrip.startTime) < twentyFourHours;
            
            if (isRecent) {
                // Resume the trip
                this.showToast('Vorige reis gevonden, wordt hervat...', 'info');
                
                // Get current position
                try {
                    const currentPosition = await this.geolocationManager.getCurrentPosition();
                    await this.progressTracker.updateProgress(currentPosition);
                } catch (error) {
                    console.warn('Could not get current position for existing trip:', error);
                }
                
                // Start tracking
                this.geolocationManager.startTracking(
                    async (position) => {
                        await this.progressTracker.updateProgress(position);
                    },
                    (error) => {
                        this.showToast(`GPS fout: ${error.message}`, 'error');
                    }
                );
                
                this.progressTracker.startPeriodicUpdates();
                this.isActive = true;
                this.updateUIForActiveTrip();
                
            } else {
                // Trip is too old, clear it
                this.progressTracker.resetTrip();
                this.updateUIForSetup();
            }
        } else {
            // No existing trip, show setup
            this.updateUIForSetup();
        }
    }

    /**
     * Update UI for active trip
     */
    updateUIForActiveTrip() {
        // Hide address section
        this.elements.addressSection.classList.add('collapsed');
        
        // Show progress section in compact mode
        this.elements.progressSection.classList.add('compact');
        
        // Show control buttons
        this.elements.stopTripBtn.classList.remove('hidden');
        this.elements.resetTripBtn.classList.remove('hidden');
        this.elements.backToSetupBtn.classList.remove('hidden');
        
        // Update settings button text
        this.elements.backToSetupBtn.textContent = '⚙️';
        
        // Hide start button
        this.elements.startTripBtn.classList.add('hidden');
        this.elements.updateStopBtn.classList.add('hidden');
    }

    /**
     * Update UI for stopped trip
     */
    updateUIForStoppedTrip() {
        // Show address section
        this.elements.addressSection.classList.remove('collapsed');
        
        // Show progress section in normal mode
        this.elements.progressSection.classList.remove('compact');
        
        // Show update stop button
        this.elements.updateStopBtn.classList.remove('hidden');
        
        // Hide stop button
        this.elements.stopTripBtn.classList.add('hidden');
        
        // Update settings button text
        this.elements.backToSetupBtn.textContent = '⚙️';
    }

    /**
     * Update UI for setup mode
     */
    updateUIForSetup() {
        // Show address section
        this.elements.addressSection.classList.remove('collapsed');
        
        // Show progress section in normal mode
        this.elements.progressSection.classList.remove('compact');
        
        // Show appropriate buttons based on trip state
        if (this.isActive) {
            // Active trip - show update and stop buttons
            this.elements.startTripBtn.classList.add('hidden');
            this.elements.updateStopBtn.classList.remove('hidden');
            this.elements.stopTripBtn.classList.remove('hidden');
            this.elements.resetTripBtn.classList.remove('hidden');
            this.elements.backToSetupBtn.classList.remove('hidden');
            
            // Update settings button text to show "back to trip"
            this.elements.backToSetupBtn.textContent = '🔙 Terug naar Reis';
            this.elements.backToSetupBtn.classList.remove('hidden');
        } else {
            // No active trip - show start button
            this.elements.startTripBtn.classList.remove('hidden');
            this.elements.updateStopBtn.classList.add('hidden');
            this.elements.stopTripBtn.classList.add('hidden');
            this.elements.resetTripBtn.classList.add('hidden');
            this.elements.backToSetupBtn.classList.add('hidden');
        }
    }

    /**
     * Reset start button state
     */
    resetStartButton() {
        this.elements.startTripBtn.disabled = false;
        this.elements.startTripBtn.textContent = '🚗 Start Reis';
    }

    /**
     * Reset update button state
     */
    resetUpdateButton() {
        this.elements.updateStopBtn.disabled = false;
        this.elements.updateStopBtn.textContent = '🔄 Update Stop';
    }

    /**
     * Show toast notification
     * @param {string} message - Message to display
     * @param {string} type - Toast type (success, error, info, warning)
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = this.getToastIcon(type);
        
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-content">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        this.elements.toastContainer.appendChild(toast);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 3000);
    }

    /**
     * Get toast icon based on type
     * @param {string} type - Toast type
     * @returns {string} Icon emoji
     */
    getToastIcon(type) {
        switch (type) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            case 'info': return 'ℹ️';
            default: return 'ℹ️';
        }
    }

    /**
     * Request wake lock to prevent screen sleep
     */
    async requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake lock acquired');
            }
        } catch (error) {
            console.warn('Wake lock not supported or denied:', error);
        }
    }

    /**
     * Release wake lock
     */
    releaseWakeLock() {
        if (this.wakeLock) {
            this.wakeLock.release();
            this.wakeLock = null;
            console.log('Wake lock released');
        }
    }

    /**
     * Fix viewport height for Safari
     */
    fixViewportHeight() {
        const setVH = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };

        setVH();
        window.addEventListener('resize', setVH);
        window.addEventListener('orientationchange', setVH);
    }

    /**
     * Get app status for debugging
     * @returns {Object} App status information
     */
    getAppStatus() {
        return {
            isActive: this.isActive,
            wakeLock: !!this.wakeLock,
            tripStatus: this.progressTracker.getTripStatus(),
            trackingStatus: this.geolocationManager.getTrackingStatus(),
            storageInfo: this.storageManager.getStorageInfo()
        };
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.tripApp = new TripApp();
});

// Export for debugging
window.TripApp = TripApp; 