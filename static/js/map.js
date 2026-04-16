/**
 * COCO Map Module
 * Leaflet.js 기반 지도 + 흔적 마커
 */
const MapModule = (() => {
    let map = null;
    let myLocationMarker = null;
    let traceMarkers = [];
    let currentFilter = 'all';

    // 커스텀 마커 아이콘
    const icons = {
        mine: L.divIcon({
            className: 'custom-marker',
            html: '<div style="background:#4A90D9;width:28px;height:28px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">📸</div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14],
        }),
        friends: L.divIcon({
            className: 'custom-marker',
            html: '<div style="background:#FF9F43;width:28px;height:28px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">👥</div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14],
        }),
        public: L.divIcon({
            className: 'custom-marker',
            html: '<div style="background:#4ECDC4;width:28px;height:28px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">🌍</div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14],
        }),
        me: L.divIcon({
            className: 'custom-marker',
            html: '<div style="background:#FF6B9D;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 12px rgba(255,107,157,0.6);"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
        }),
    };

    function init(containerId) {
        if (map) return;
        map = L.map(containerId, {
            zoomControl: false,
            attributionControl: false,
        }).setView([37.5665, 126.978], 14);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
        }).addTo(map);

        // Zoom control - top right
        L.control.zoom({ position: 'topright' }).addTo(map);
    }

    function invalidateSize() {
        if (map) {
            setTimeout(() => map.invalidateSize(), 200);
        }
    }

    function setMyLocation(lat, lng) {
        if (!map) return;
        if (myLocationMarker) {
            myLocationMarker.setLatLng([lat, lng]);
        } else {
            myLocationMarker = L.marker([lat, lng], { icon: icons.me }).addTo(map);
            myLocationMarker.bindPopup('<b>내 위치</b>');
        }
    }

    function panToMyLocation(lat, lng) {
        if (map) {
            map.setView([lat, lng], 15, { animate: true });
        }
    }

    function clearTraceMarkers() {
        traceMarkers.forEach(m => map.removeLayer(m));
        traceMarkers = [];
    }

    function addTraceMarker(trace, type) {
        if (!map) return;
        const icon = type === 'mine' ? icons.mine : type === 'friends' ? icons.friends : icons.public;

        let popupHtml = '<div class="trace-popup">';
        if (trace.photo_data) {
            popupHtml += `<img src="${trace.photo_data}" alt="trace photo">`;
        }
        if (trace.caption) {
            popupHtml += `<div class="popup-caption">${escapeHtml(trace.caption)}</div>`;
        }
        popupHtml += `<div class="popup-meta">📍 ${trace.nickname || '알 수 없음'} · ${formatDate(trace.created_at)}</div>`;
        popupHtml += '</div>';

        const marker = L.marker([trace.lat, trace.lng], { icon }).addTo(map);
        marker.bindPopup(popupHtml, { maxWidth: 260 });
        traceMarkers.push(marker);
    }

    function setFilter(filter) {
        currentFilter = filter;
    }

    function getFilter() {
        return currentFilter;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDate(isoStr) {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function addExploreMarker(lat, lng, emoji, label, reason) {
        if (!map) return null;
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="
                background: linear-gradient(135deg, #FF6B9D, #a855f7);
                width: 36px; height: 36px; border-radius: 50%;
                border: 3px solid #fff;
                display: flex; align-items: center; justify-content: center;
                font-size: 18px;
                box-shadow: 0 0 0 3px rgba(255,107,157,0.4), 0 4px 16px rgba(0,0,0,0.4);
                animation: explorePulse 2s infinite;
            ">${emoji}</div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
        });
        const marker = L.marker([lat, lng], { icon }).addTo(map);
        marker.bindPopup(`
            <div style="font-size:13px;line-height:1.5;">
                <b>${escapeHtml(emoji)} ${escapeHtml(label)}</b><br>
                <span style="color:#888;">${escapeHtml(reason)}</span>
            </div>
        `, { maxWidth: 220 });
        marker.openPopup();
        return marker;
    }

    function removeLayer(marker) {
        if (map && marker) map.removeLayer(marker);
    }

    return { init, invalidateSize, setMyLocation, panToMyLocation, clearTraceMarkers, addTraceMarker, setFilter, getFilter, addExploreMarker, removeLayer };
})();
