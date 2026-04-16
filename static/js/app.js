/**
 * COCO Main App Controller
 * 모듈 통합 및 UI 이벤트 관리
 */
const App = (() => {
    // ---- State ----
    let currentUser = null;     // { id, nickname, language, profile_visibility }
    let currentView = 'camera';
    let nearbyUsers = [];

    // ---- DOM refs ----
    const authScreen = document.getElementById('auth-screen');
    const appScreen = document.getElementById('app-screen');
    const nicknameInput = document.getElementById('nickname-input');
    const languageSelect = document.getElementById('language-select');
    const registerBtn = document.getElementById('register-btn');
    const loginBtn = document.getElementById('login-btn');

    const headerTitle = document.getElementById('header-title');
    const headerUserName = document.getElementById('header-user-name');

    const views = {
        camera: document.getElementById('camera-view'),
        map: document.getElementById('map-view'),
        chat: document.getElementById('chat-view'),
        profile: document.getElementById('profile-view'),
    };
    const navBtns = document.querySelectorAll('.nav-btn');

    const captureReview = document.getElementById('capture-review');
    const capturedImage = document.getElementById('captured-image');
    const traceCaption = document.getElementById('trace-caption');
    const traceVisibility = document.getElementById('trace-visibility');

    const nearbyOverlay = document.getElementById('nearby-users-overlay');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const chatPartnerName = document.getElementById('chat-partner-name');
    const chatLanguageBadge = document.getElementById('chat-language-badge');

    const profileNickname = document.getElementById('profile-nickname');
    const profileLanguage = document.getElementById('profile-language');
    const profileVisibility = document.getElementById('profile-visibility');
    const pendingConnections = document.getElementById('pending-connections');
    const friendsList = document.getElementById('friends-list');

    const modal = document.getElementById('connection-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalConfirm = document.getElementById('modal-confirm');
    const modalCancel = document.getElementById('modal-cancel');

    // ---- API helper ----
    async function api(method, path, body = null) {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(path, opts);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `HTTP ${res.status}`);
        }
        return res.json();
    }

    // ---- Toast ----
    function toast(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = msg;
        container.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }

    // ---- Auth ----
    async function register() {
        const nickname = nicknameInput.value.trim();
        if (!nickname) return toast('닉네임을 입력하세요', 'error');
        try {
            currentUser = await api('POST', '/api/auth/register', {
                nickname,
                language: languageSelect.value,
            });
            onLogin();
        } catch (e) {
            toast(e.message, 'error');
        }
    }

    async function login() {
        const nickname = nicknameInput.value.trim();
        if (!nickname) return toast('닉네임을 입력하세요', 'error');
        try {
            currentUser = await api('POST', '/api/auth/login', { nickname });
            onLogin();
        } catch (e) {
            toast(e.message, 'error');
        }
    }

    function onLogin() {
        authScreen.classList.remove('active');
        appScreen.classList.add('active');
        headerUserName.textContent = `🌸 ${currentUser.nickname}`;
        toast(`${currentUser.nickname}님, 환영합니다!`, 'success');

        // Start camera + nearby discovery
        CameraModule.start();
        NearbyModule.connect(currentUser.id);

        loadProfile();
        loadConnections();

        // Auto-set avatar using DiceBear (free)
        if (!currentUser.avatar_data) {
            generateDefaultAvatar();
        } else {
            renderProfileAvatar();
        }
    }

    // ---- View Navigation ----
    function switchView(viewName) {
        currentView = viewName;
        Object.entries(views).forEach(([name, el]) => {
            el.classList.toggle('active', name === viewName);
        });
        navBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });

        const titles = { camera: '카메라', map: '지도', chat: '채팅', profile: '프로필' };
        headerTitle.textContent = titles[viewName] || '';

        if (viewName === 'map') {
            MapModule.init('map-container');
            setTimeout(() => {
                MapModule.invalidateSize();
                loadTraces();
            }, 50);
        }
        if (viewName === 'profile') {
            loadConnections();
        }
        if (viewName === 'camera' && !CameraModule.isActive()) {
            CameraModule.start();
        }
        if (viewName === 'chat') {
            const noSession = document.getElementById('chat-no-session');
            if (!ChatModule.isConnected()) {
                noSession.style.display = 'flex';
            }
        }
    }

    // ---- Camera ----
    function capturePhoto() {
        const dataUrl = CameraModule.capture();
        if (!dataUrl) return toast('카메라가 활성화되지 않았습니다', 'error');
        capturedImage.src = dataUrl;
        captureReview.classList.remove('hidden');
        traceCaption.value = '';
    }

    async function saveTrace() {
        const loc = NearbyModule.getLocation();
        if (!loc.lat) {
            toast('위치 정보를 가져올 수 없습니다', 'error');
            return;
        }
        try {
            await api('POST', `/api/traces?user_id=${currentUser.id}`, {
                photo_data: capturedImage.src,
                lat: loc.lat,
                lng: loc.lng,
                caption: traceCaption.value.trim(),
                visibility: traceVisibility.value,
            });
            captureReview.classList.add('hidden');
            toast('흔적이 저장되었습니다! 🌸', 'success');
        } catch (e) {
            toast(e.message, 'error');
        }
    }

    function discardCapture() {
        captureReview.classList.add('hidden');
    }

    // ---- Nearby Users → AR Avatar Overlay ----
    function bearingTo(lat1, lng1, lat2, lng2) {
        const toRad = d => d * Math.PI / 180;
        const dLng = toRad(lng2 - lng1);
        const y = Math.sin(dLng) * Math.cos(toRad(lat2));
        const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
                  Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }

    function renderNearbyUsers(users) {
        nearbyUsers = users;
        nearbyOverlay.innerHTML = '';
        if (!users.length) return;

        const myLoc = NearbyModule.getLocation();
        const myHeading = NearbyModule.getHeading(); // null if compass unavailable

        users.forEach(u => {
            const avatar = document.createElement('div');
            avatar.className = 'ar-avatar';
            avatar.dataset.userId = u.user_id;

            // Calculate horizontal position (0–100%) based on relative bearing
            let leftPct = 50; // default center
            if (myLoc.lat !== null && myHeading !== null) {
                const bearing = bearingTo(myLoc.lat, myLoc.lng, u.lat, u.lng);
                let relAngle = ((bearing - myHeading + 540) % 360) - 180; // -180 to +180
                // Map -60°~+60° FOV to 5%~95% of screen
                leftPct = Math.max(3, Math.min(97, 50 + (relAngle / 60) * 45));
            } else {
                // No compass: spread evenly
                const idx = users.indexOf(u);
                leftPct = users.length === 1 ? 50 : 10 + (idx / (users.length - 1)) * 80;
            }

            const imgHtml = u.avatar_data
                ? `<img src="${u.avatar_data}" class="ar-avatar-img" alt="${escapeHtml(u.nickname)}">`
                : `<div class="ar-avatar-emoji">🌸</div>`;

            avatar.innerHTML = `
                ${imgHtml}
                <div class="ar-avatar-name">${escapeHtml(u.nickname)}</div>
                <div class="ar-avatar-dist">${u.distance_m}m</div>
                <div class="ar-avatar-mode">${modeLabel(u.mode)}</div>
            `;
            avatar.style.left = `${leftPct}%`;
            avatar.addEventListener('click', () => onNearbyUserClick(u));
            nearbyOverlay.appendChild(avatar);
        });
    }

    function modeLabel(mode) {
        const labels = { normal: '📷', penpal: '✉️ 펜팔', explore: '🧭 탐험' };
        return labels[mode] || mode;
    }

    function onNearbyUserClick(user) {
        modalTitle.textContent = '연결 요청';
        modalMessage.textContent = `${user.nickname}님에게 연결 요청을 보내시겠습니까?`;

        const confirmHandler = async () => {
            try {
                await api('POST', `/api/connections/request?user_id=${currentUser.id}`, {
                    target_id: user.user_id,
                    type: user.mode === 'penpal' ? 'temporary' : 'friend',
                });
                toast('연결 요청을 보냈습니다', 'success');

                // If penpal mode, start chat directly
                if (user.mode === 'penpal') {
                    startChat(user.user_id, user.nickname);
                }
            } catch (e) {
                toast(e.message, 'error');
            }
            closeModal();
        };

        showModal(confirmHandler);
    }

    // ---- Map / Traces ----
    async function loadTraces() {
        const loc = NearbyModule.getLocation();
        const filter = MapModule.getFilter();

        MapModule.clearTraceMarkers();

        if (loc.lat) {
            MapModule.setMyLocation(loc.lat, loc.lng);
        }

        try {
            if (filter === 'all' || filter === 'mine') {
                const mine = await api('GET', `/api/traces?user_id=${currentUser.id}`);
                mine.forEach(t => MapModule.addTraceMarker(t, 'mine'));
            }
            if (filter === 'all' || filter === 'friends') {
                const friends = await api('GET', `/api/traces/friends?user_id=${currentUser.id}`);
                friends.forEach(t => MapModule.addTraceMarker(t, 'friends'));
            }
            if (filter === 'all') {
                if (loc.lat) {
                    const nearby = await api('GET', `/api/traces/nearby?lat=${loc.lat}&lng=${loc.lng}&radius=5000`);
                    nearby.forEach(t => {
                        if (t.user_id !== currentUser.id) {
                            MapModule.addTraceMarker(t, 'public');
                        }
                    });
                }
            }
        } catch (e) {
            console.error('Failed to load traces:', e);
        }
    }

    // ---- AI Explore (탐험 큐레이션) ----
    let exploreMarkers = [];

    function openExplorePanel() {
        const panel = document.getElementById('explore-panel');
        panel.classList.remove('hidden');
        loadExploreRecommendations();
    }

    function closeExplorePanel() {
        document.getElementById('explore-panel').classList.add('hidden');
        clearExploreMarkers();
    }

    function clearExploreMarkers() {
        exploreMarkers.forEach(m => MapModule.removeLayer(m));
        exploreMarkers = [];
    }

    async function loadExploreRecommendations() {
        const loc = NearbyModule.getLocation();
        if (!loc.lat) {
            toast('위치 정보가 필요합니다', 'error');
            return;
        }

        const loading = document.getElementById('explore-loading');
        const results = document.getElementById('explore-results');
        loading.classList.remove('hidden');
        results.innerHTML = '';
        clearExploreMarkers();

        try {
            const recs = await api('GET',
                `/api/explore/recommend?user_id=${currentUser.id}&lat=${loc.lat}&lng=${loc.lng}`
            );
            loading.classList.add('hidden');
            renderExploreResults(recs, loc);
        } catch (e) {
            loading.classList.add('hidden');
            results.innerHTML = `<div class="explore-error">추천 생성 실패: ${escapeHtml(e.message)}</div>`;
        }
    }

    const exploreTypeIcon = { my_style: '🌸', friend_vibe: '👥', mood: '✨' };

    function renderExploreResults(recs, myLoc) {
        const results = document.getElementById('explore-results');
        results.innerHTML = '';

        recs.forEach((rec, ri) => {
            const section = document.createElement('div');
            section.className = 'explore-section';

            const suggestionsHtml = rec.suggestions.map((s, si) => `
                <div class="explore-suggestion" data-lat="${s.lat}" data-lng="${s.lng}">
                    <span class="explore-emoji">${s.emoji || '📍'}</span>
                    <div class="explore-suggestion-info">
                        <div class="explore-place">${escapeHtml(s.label)}</div>
                        <div class="explore-reason">${escapeHtml(s.reason)}</div>
                    </div>
                    <button class="explore-go-btn" data-lat="${s.lat}" data-lng="${s.lng}">지도</button>
                </div>
            `).join('');

            section.innerHTML = `
                <div class="explore-section-header">
                    <span class="explore-type-icon">${exploreTypeIcon[rec.type] || '🧭'}</span>
                    <div>
                        <div class="explore-title">${escapeHtml(rec.title)}</div>
                        <div class="explore-desc">${escapeHtml(rec.description)}</div>
                    </div>
                </div>
                <div class="explore-suggestions">${suggestionsHtml}</div>
            `;
            results.appendChild(section);

            // 지도에 마커 추가
            rec.suggestions.forEach(s => {
                const marker = MapModule.addExploreMarker(s.lat, s.lng, s.emoji || '📍', s.label, s.reason);
                if (marker) exploreMarkers.push(marker);
            });
        });

        // 버튼 이벤트
        results.querySelectorAll('.explore-go-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lat = parseFloat(btn.dataset.lat);
                const lng = parseFloat(btn.dataset.lng);
                MapModule.panToMyLocation(lat, lng);
                closeExplorePanel();
            });
        });

        // 첫 추천 장소로 지도 이동
        if (recs.length > 0 && recs[0].suggestions.length > 0) {
            const first = recs[0].suggestions[0];
            MapModule.panToMyLocation(first.lat, first.lng);
        }
    }

    // ---- Chat ----
    function startChat(partnerId, partnerName) {
        // Create a unique session id from sorted user ids
        const ids = [currentUser.id, partnerId].sort();
        const sessionId = ids.join('-').substring(0, 36);

        chatPartnerName.textContent = partnerName;
        chatLanguageBadge.textContent = currentUser.language.toUpperCase();
        chatMessages.innerHTML = '';

        document.getElementById('chat-no-session').style.display = 'none';
        ChatModule.connect(sessionId, currentUser.id, currentUser.language, currentUser.nickname);
        switchView('chat');
    }

    function renderChatMessage(data) {
        if (data.type === 'system') {
            const el = document.createElement('div');
            el.className = 'chat-system';
            el.textContent = data.message;
            chatMessages.appendChild(el);
        } else if (data.type === 'message') {
            const isSent = data.sender_id === currentUser.id;
            const bubble = document.createElement('div');
            bubble.className = `chat-bubble ${isSent ? 'sent' : 'received'}`;

            let html = '';
            if (!isSent) {
                html += `<div class="bubble-sender">${escapeHtml(data.sender_nickname)}</div>`;
            }
            html += `<div class="bubble-original">${escapeHtml(data.original_text)}</div>`;
            if (data.translated_text && data.translated_text !== data.original_text) {
                html += `<div class="bubble-translated">🌐 ${escapeHtml(data.translated_text)}</div>`;
            }
            bubble.innerHTML = html;
            chatMessages.appendChild(bubble);
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function sendChatMessage() {
        const text = chatInput.value.trim();
        if (!text) return;
        if (!ChatModule.isConnected()) {
            toast('대화 상대를 먼저 선택해주세요', 'error');
            return;
        }
        ChatModule.send(text);
        chatInput.value = '';
    }

    // ---- Profile & Connections ----
    function loadProfile() {
        if (!currentUser) return;
        profileNickname.textContent = currentUser.nickname;
        profileLanguage.textContent = langLabel(currentUser.language);
        profileVisibility.value = currentUser.profile_visibility;
        renderProfileAvatar();
    }

    function renderProfileAvatar() {
        const container = document.getElementById('profile-avatar-container');
        if (!container) return;
        if (currentUser.avatar_data) {
            container.innerHTML = `<img src="${currentUser.avatar_data}" class="profile-avatar-img" alt="아바타">`;
        } else {
            container.innerHTML = `<div class="profile-avatar-placeholder">🌸</div>`;
        }
    }

    async function generateDefaultAvatar() {
        try {
            const updated = await api('POST', `/api/users/${currentUser.id}/default-avatar`);
            currentUser.avatar_data = updated.avatar_data;
            renderProfileAvatar();
        } catch (e) {
            console.warn('Default avatar failed:', e.message);
        }
    }

    async function generateAvatar(showToast = true) {
        const btn = document.getElementById('generate-avatar-btn');
        if (btn) { btn.disabled = true; btn.textContent = '✨ 생성 중...'; }
        if (showToast) toast('AI 아바타를 생성하고 있습니다...', 'info');
        try {
            const updated = await api('POST', `/api/users/${currentUser.id}/generate-avatar`);
            currentUser.avatar_data = updated.avatar_data;
            renderProfileAvatar();
            if (showToast) toast('AI 아바타가 생성되었습니다! 🎨', 'success');
        } catch (e) {
            if (showToast) toast(`아바타 생성 실패: ${e.message}`, 'error');
            else console.warn('Avatar generation failed (silent):', e.message);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '✨ AI 아바타 재생성'; }
        }
    }

    async function loadConnections() {
        if (!currentUser) return;
        try {
            const conns = await api('GET', `/api/connections?user_id=${currentUser.id}`);

            // Pending requests (where I'm the target)
            const pending = conns.filter(c => c.status === 'pending' && c.target_id === currentUser.id);
            pendingConnections.innerHTML = '';
            if (pending.length === 0) {
                pendingConnections.innerHTML = '<div class="empty-state">새로운 연결 요청이 없습니다</div>';
            } else {
                pending.forEach(c => {
                    const card = document.createElement('div');
                    card.className = 'connection-card';
                    card.innerHTML = `
                        <div class="conn-info">
                            <span class="conn-name">🌸 ${escapeHtml(c.requester_nickname)}</span>
                            <span class="conn-status">${c.type === 'temporary' ? '임시 연결' : '친구 요청'}</span>
                        </div>
                        <div class="conn-actions">
                            <button class="btn btn-primary btn-sm accept-btn">수락</button>
                            <button class="btn btn-danger btn-sm reject-btn">거절</button>
                        </div>
                    `;
                    card.querySelector('.accept-btn').addEventListener('click', () => acceptConn(c.id));
                    card.querySelector('.reject-btn').addEventListener('click', () => rejectConn(c.id));
                    pendingConnections.appendChild(card);
                });
            }

            // Friends (accepted)
            const friends = conns.filter(c => c.status === 'accepted');
            friendsList.innerHTML = '';
            if (friends.length === 0) {
                friendsList.innerHTML = '<div class="empty-state">아직 친구가 없습니다. 카메라로 주변 사용자와 연결해보세요!</div>';
            } else {
                friends.forEach(c => {
                    const isRequester = c.requester_id === currentUser.id;
                    const friendName = isRequester ? c.target_nickname : c.requester_nickname;
                    const friendId = isRequester ? c.target_id : c.requester_id;

                    const card = document.createElement('div');
                    card.className = 'friend-card';
                    card.innerHTML = `
                        <span class="friend-name">🌸 ${escapeHtml(friendName)}</span>
                        <button class="friend-chat-btn">💬 채팅</button>
                    `;
                    card.querySelector('.friend-chat-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        startChat(friendId, friendName);
                    });
                    friendsList.appendChild(card);
                });
            }
        } catch (e) {
            console.error('Failed to load connections:', e);
        }
    }

    async function acceptConn(connId) {
        try {
            await api('PUT', `/api/connections/${connId}/accept`);
            toast('연결을 수락했습니다 🌸', 'success');
            loadConnections();
        } catch (e) {
            toast(e.message, 'error');
        }
    }

    async function rejectConn(connId) {
        try {
            await api('PUT', `/api/connections/${connId}/reject`);
            toast('연결을 거절했습니다', 'info');
            loadConnections();
        } catch (e) {
            toast(e.message, 'error');
        }
    }

    async function updateProfileVisibility() {
        if (!currentUser) return;
        try {
            currentUser = await api('PUT', `/api/users/${currentUser.id}`, {
                profile_visibility: profileVisibility.value,
            });
            toast('공개 범위가 변경되었습니다', 'success');
        } catch (e) {
            toast(e.message, 'error');
        }
    }

    // ---- Modal ----
    let modalConfirmHandler = null;

    function showModal(onConfirm) {
        modalConfirmHandler = onConfirm;
        modal.classList.remove('hidden');
    }

    function closeModal() {
        modal.classList.add('hidden');
        modalConfirmHandler = null;
    }

    // ---- Utilities ----
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function langLabel(code) {
        const labels = { ko: '한국어', en: 'English', ja: '日本語', zh: '中文', es: 'Español', fr: 'Français' };
        return labels[code] || code;
    }

    // ---- Init ----
    function init() {
        // Auth events
        registerBtn.addEventListener('click', register);
        loginBtn.addEventListener('click', login);
        nicknameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') register();
        });

        // Nav events
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => switchView(btn.dataset.view));
        });

        // Camera events
        document.getElementById('capture-btn').addEventListener('click', capturePhoto);
        document.getElementById('switch-camera-btn').addEventListener('click', () => CameraModule.switchCamera());
        document.getElementById('save-trace-btn').addEventListener('click', saveTrace);
        document.getElementById('discard-btn').addEventListener('click', discardCapture);
        document.getElementById('gallery-btn').addEventListener('click', () => switchView('map'));

        // Mode selector
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Map events
        document.getElementById('map-my-location').addEventListener('click', () => {
            const loc = NearbyModule.getLocation();
            if (loc.lat) MapModule.panToMyLocation(loc.lat, loc.lng);
        });
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                MapModule.setFilter(btn.dataset.filter);
                loadTraces();
            });
        });
        document.getElementById('explore-ai-btn').addEventListener('click', openExplorePanel);
        document.getElementById('explore-panel-close').addEventListener('click', closeExplorePanel);

        // Chat events
        document.getElementById('chat-send-btn').addEventListener('click', sendChatMessage);
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
        document.getElementById('chat-back-btn').addEventListener('click', () => {
            ChatModule.disconnect();
            switchView('camera');
        });

        // Profile events
        profileVisibility.addEventListener('change', updateProfileVisibility);
        document.getElementById('generate-avatar-btn')?.addEventListener('click', () => generateAvatar(true));

        // Modal events
        modalConfirm.addEventListener('click', () => {
            if (modalConfirmHandler) modalConfirmHandler();
        });
        modalCancel.addEventListener('click', closeModal);

        // Nearby module callback
        NearbyModule.onNearbyUpdate(renderNearbyUsers);

        // Chat module callback
        ChatModule.onMessage(renderChatMessage);
    }

    // Boot
    document.addEventListener('DOMContentLoaded', init);

    return { switchView, startChat };
})();
