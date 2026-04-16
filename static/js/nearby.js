/**
 * COCO Nearby Discovery Module
 * WebSocket 기반 주변 사용자 실시간 탐지
 */
const NearbyModule = (() => {
    let ws = null;
    let locationWatchId = null;
    let currentLat = null;
    let currentLng = null;
    let currentHeading = null;
    let onNearbyUpdateCallback = null;
    let updateInterval = null;

    function connect(userId) {
        if (ws) disconnect();

        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        const url = `${proto}://${location.host}/ws/nearby/${userId}`;

        ws = new WebSocket(url);

        ws.onopen = () => {
            console.log('Nearby discovery connected');
            startLocationWatch();
            startCompassWatch();
            // Periodic updates
            updateInterval = setInterval(() => {
                if (currentLat !== null) {
                    sendLocationUpdate();
                }
            }, 5000);
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'nearby_users' && onNearbyUpdateCallback) {
                onNearbyUpdateCallback(data.users);
            }
        };

        ws.onclose = () => {
            console.log('Nearby discovery disconnected');
            stopLocationWatch();
            stopCompassWatch();
            ws = null;
        };

        ws.onerror = (err) => {
            console.error('Nearby WebSocket error:', err);
        };
    }

    function disconnect() {
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }
        stopLocationWatch();
        stopCompassWatch();
        if (ws) {
            ws.close();
            ws = null;
        }
    }

    function startLocationWatch() {
        if (!navigator.geolocation) {
            console.warn('Geolocation not supported');
            return;
        }
        locationWatchId = navigator.geolocation.watchPosition(
            (pos) => {
                currentLat = pos.coords.latitude;
                currentLng = pos.coords.longitude;
                sendLocationUpdate();
            },
            (err) => {
                console.warn('Geolocation error:', err.message);
            },
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
        );
    }

    function stopLocationWatch() {
        if (locationWatchId !== null) {
            navigator.geolocation.clearWatch(locationWatchId);
            locationWatchId = null;
        }
    }

    function sendLocationUpdate() {
        if (ws && ws.readyState === WebSocket.OPEN && currentLat !== null) {
            ws.send(JSON.stringify({
                action: 'update_location',
                lat: currentLat,
                lng: currentLng,
                heading: currentHeading,
                mode: getCurrentMode(),
            }));
        }
    }

    function getCurrentMode() {
        const activeBtn = document.querySelector('.mode-btn.active');
        return activeBtn ? activeBtn.dataset.mode : 'normal';
    }

    function onNearbyUpdate(callback) {
        onNearbyUpdateCallback = callback;
    }

    function getLocation() {
        return { lat: currentLat, lng: currentLng };
    }

    function getHeading() {
        return currentHeading;
    }

    // ---- Compass (DeviceOrientationEvent) ----
    let compassHandler = null;

    function startCompassWatch() {
        // iOS 13+ requires permission
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(state => { if (state === 'granted') _listenOrientation(); })
                .catch(() => {});
        } else if (typeof DeviceOrientationEvent !== 'undefined') {
            _listenOrientation();
        }
    }

    function _listenOrientation() {
        compassHandler = (e) => {
            // webkitCompassHeading: iOS, alpha: Android (0=North on some devices)
            if (e.webkitCompassHeading != null) {
                currentHeading = e.webkitCompassHeading;
            } else if (e.absolute && e.alpha != null) {
                currentHeading = (360 - e.alpha) % 360;
            }
        };
        window.addEventListener('deviceorientationabsolute', compassHandler, true);
        window.addEventListener('deviceorientation', compassHandler, true);
    }

    function stopCompassWatch() {
        if (compassHandler) {
            window.removeEventListener('deviceorientationabsolute', compassHandler, true);
            window.removeEventListener('deviceorientation', compassHandler, true);
            compassHandler = null;
        }
    }

    return { connect, disconnect, onNearbyUpdate, getLocation, getHeading };
})();
