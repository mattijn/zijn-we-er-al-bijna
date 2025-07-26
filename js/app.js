/**
 * Main Application Module
 * Coordinates all modules and handles user interactions
 */

class TripApp {
    constructor() {
        this.isInitialized = false;
        this.loadingOverlay = null;
        this.startButton = null;
        this.stopButton = null;
        this.resetButton = null;
        this.destinationInput = null;
        this.nextStopInput = null;
        this.wakeLock = null;
        this.nextStopStatItem = document.querySelector('.stat-item:has(#next-stop-time)');
        this.updateNextStopVisibility();
        
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
            this.setupViewportHeight();
            
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
        this.stopButton = document.getElementById('stop-trip');
        this.resetButton = document.getElementById('reset-trip');
        this.backToSetupButton = document.getElementById('back-to-setup');
        this.destinationInput = document.getElementById('final-destination');
        this.nextStopInput = document.getElementById('next-stop');
        this.updateNextStopButton = document.getElementById('update-next-stop');
        
        // Get the next stop stat item
        this.nextStopStatItem = document.querySelector('.status-stats .stat-item:has(#next-stop-time)');

        if (!this.startButton || !this.stopButton || !this.resetButton || !this.backToSetupButton || !this.destinationInput) {
            throw new Error('Required DOM elements not found');
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Start trip button
        this.startButton.addEventListener('click', () => this.handleStartTrip());
        
        // Stop trip button
        this.stopButton.addEventListener('click', () => this.handleStopTrip());
        
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
        
        // Set cursor to beginning and scroll to start when input is focused
        this.destinationInput.addEventListener('focus', () => {
            // Use setTimeout to ensure the focus event is fully processed
            setTimeout(() => {
                this.destinationInput.setSelectionRange(0, 0);
                this.destinationInput.scrollLeft = 0; // Scroll to beginning of text
            }, 0);
        });
        
        this.nextStopInput.addEventListener('focus', () => {
            // Use setTimeout to ensure the focus event is fully processed
            setTimeout(() => {
                this.nextStopInput.setSelectionRange(0, 0);
                this.nextStopInput.scrollLeft = 0; // Scroll to beginning of text
            }, 0);
        });
        
        // Update next stop button
        if (this.updateNextStopButton) {
            this.updateNextStopButton.addEventListener('click', () => this.handleUpdateNextStop());
        }
        
        // Enable/disable update button based on next stop input and trip status
        this.nextStopInput.addEventListener('input', () => {
            if (this.updateNextStopButton) {
                const hasNextStop = this.nextStopInput.value.trim();
                const isTripActive = window.progressTracker.isTripActive();
                this.updateNextStopButton.disabled = !hasNextStop || !isTripActive;
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
        
        // Initial status section visibility check
        this.updateStatusSectionVisibility();
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

        // Direct UI updaten
        this.updateUIForActiveTrip();
        this.showInfo('🔄 Locatie ophalen...');

        try {
            const tripData = await window.progressTracker.startTrip(destination, nextStop);
            
            // Request wake lock to prevent device sleep
            await this.requestWakeLock();
            
            // Update next stop visibility
            this.updateNextStopVisibility();
            
            this.showSuccess('🚀 Reis gestart!');
            
        } catch (error) {
            console.error('Error starting trip:', error);
            
            // UI terugzetten naar originele staat
            this.updateUIForStoppedTrip();
            
            if (error.message.includes('Adres niet gevonden')) {
                this.showError(error.message);
            } else if (error.message.includes('timed out')) {
                this.showError('Het ophalen van de locatie duurde te lang. Controleer je internetverbinding en probeer opnieuw.');
            } else if (error.message.includes('Geolocation is not supported')) {
                this.showError('Je browser ondersteunt geen locatie tracking. Gebruik een moderne browser.');
            } else if (error.message.includes('PERMISSION_DENIED')) {
                this.showError('Locatie toegang geweigerd. Controleer je browser instellingen.');
            } else if (error.message.includes('POSITION_UNAVAILABLE')) {
                this.showError('Locatie informatie is niet beschikbaar. Controleer of GPS is ingeschakeld.');
            } else if (error.message.includes('TIMEOUT')) {
                this.showError('Het ophalen van je locatie duurde te lang. Probeer opnieuw.');
            } else {
                this.showError('Er is een fout opgetreden bij het starten van de reis. Probeer opnieuw.');
            }
        }
    }

    /**
     * Handle stop trip button click
     */
    handleStopTrip() {
        if (window.progressTracker.isTripActive()) {
            window.progressTracker.stopTrip();
            this.releaseWakeLock();
            this.updateUIForStoppedTrip(); // Preserve input values when stopping
            this.showSuccess('Reis gestopt');
        }
    }

    /**
     * Handle reset trip button click
     */
    handleResetTrip() {
        if (window.progressTracker.isTripActive()) {
            if (confirm('Weet je zeker dat je de reis wilt resetten? Dit verwijdert alle voortgang.')) {
                window.progressTracker.resetTrip();
                this.releaseWakeLock();
                this.updateUIForInactiveTrip(); // Clear input fields for reset
                window.tripStorage.clearTripData();
                window.tripStorage.clearTripHistory();
                this.showSuccess('Reis gereset');
            }
        } else {
            // If no active trip, this is a true reset - clear everything
            window.progressTracker.resetTrip();
            this.releaseWakeLock();
            this.updateUIForInactiveTrip(); // Clear input fields for reset
            window.tripStorage.clearTripData();
            window.tripStorage.clearTripHistory();
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
            this.updateNextStopVisibility(); // Add this line
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
        const statusSection = document.getElementById('status-section');
        const isCollapsed = addressSection.classList.contains('collapsed');
        
        if (isCollapsed) {
            // Show address section
            addressSection.classList.remove('collapsed');
            this.backToSetupButton.classList.add('active');
            
            // Hide status section to save space
            if (statusSection) {
                statusSection.classList.add('hidden');
            }
            
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
        
        // Update status section visibility
        this.updateStatusSectionVisibility();
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
    }

    /**
     * Update UI for active trip
     */
    updateUIForActiveTrip() {
        // Hide address section
        const addressSection = document.getElementById('address-section');
        if (addressSection) {
            addressSection.classList.add('collapsed');
        }
        
        // Show trip controls
        this.stopButton.classList.remove('hidden');
        this.resetButton.classList.remove('hidden');
        this.backToSetupButton.classList.remove('hidden');
        
        // Show status section when address section is collapsed
        const statusSection = document.querySelector('.status-section');
        if (statusSection) {
            statusSection.classList.remove('hidden');
        }
        
        // Make progress section compact
        const progressSection = document.getElementById('progress-section');
        if (progressSection) {
            progressSection.classList.add('compact');
        }
        
        // Update next stop visibility
        this.updateNextStopVisibility();
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
        
        // Hide status section when address section is expanded
        const statusSection = document.getElementById('status-section');
        if (statusSection) {
            statusSection.classList.add('hidden');
        }
        
        // Ensure progress section is full size
        const progressSection = document.getElementById('progress-section');
        if (progressSection) {
            progressSection.classList.remove('compact');
        }
        
        // Disable update button when trip is stopped
        if (this.updateNextStopButton) {
            this.updateNextStopButton.disabled = true;
        }
        
        // Update status section visibility
        this.updateStatusSectionVisibility();
        
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
        
        // Hide status section when address section is expanded
        const statusSection = document.getElementById('status-section');
        if (statusSection) {
            statusSection.classList.add('hidden');
        }
        
        // Ensure progress section is full size
        const progressSection = document.getElementById('progress-section');
        if (progressSection) {
            progressSection.classList.remove('compact');
        }
        
        // Disable update button when trip is inactive
        if (this.updateNextStopButton) {
            this.updateNextStopButton.disabled = true;
        }
        
        // Update status section visibility
        this.updateStatusSectionVisibility();
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
        this.showToast(message, 'error', '⚠️', 5000);
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        this.showToast(message, 'success', '✅', 3000);
    }

    /**
     * Show info message
     */
    showInfo(message) {
        this.showToast(message, 'info', 'ℹ️', 3000);
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', icon = 'ℹ️', duration = 3000) {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">${message}</div>
            <div class="toast-close">×</div>
        `;

        // Add to container
        toastContainer.appendChild(toast);

        // Show animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Close button handler
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            });
        }

        // Auto remove after duration
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
    }

    /**
     * Handle location errors
     */
    handleLocationError(error) {
        console.error('Location tracking error:', error);
        this.showError('Locatie probleem: ' + error.message);
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
     * Setup dynamic viewport height for Safari compatibility
     */
    setupViewportHeight() {
        const setViewportHeight = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
            console.log('Viewport height updated:', vh * 100, 'px');
        };

        // Set initial viewport height
        setViewportHeight();

        // Update on resize and orientation change
        window.addEventListener('resize', setViewportHeight);
        window.addEventListener('orientationchange', () => {
            // Delay to ensure orientation change is complete
            setTimeout(setViewportHeight, 100);
        });

        // Update on Safari-specific events
        if ('visualViewport' in window) {
            window.visualViewport.addEventListener('resize', setViewportHeight);
        }
    }

    /**
     * Update status section visibility based on address section state
     */
    updateStatusSectionVisibility() {
        const addressSection = document.getElementById('address-section');
        const statusSection = document.getElementById('status-section');
        
        if (addressSection && statusSection) {
            const isAddressCollapsed = addressSection.classList.contains('collapsed');
            
            if (isAddressCollapsed) {
                // Address section is collapsed (trip active), show status
                statusSection.classList.remove('hidden');
            } else {
                // Address section is expanded (editing), hide status
                statusSection.classList.add('hidden');
            }
        }
    }

    /**
     * Update next stop visibility based on trip data
     */
    updateNextStopVisibility() {
        if (this.nextStopStatItem) {
            const tripData = window.progressTracker.getTripData();
            const hasStopover = tripData && tripData.nextStop;
            this.nextStopStatItem.classList.toggle('hidden', !hasStopover);
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
            wakeLockActive: this.wakeLock !== null,
            viewportHeight: window.innerHeight,
            cssViewportHeight: getComputedStyle(document.documentElement).getPropertyValue('--vh')
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