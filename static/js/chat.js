/**
 * COCO Chat Module
 * WebSocket 기반 실시간 번역 채팅
 */
const ChatModule = (() => {
    let ws = null;
    let currentSessionId = null;
    let onMessageCallback = null;

    function connect(sessionId, userId, language, nickname) {
        if (ws) disconnect();
        currentSessionId = sessionId;

        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        const encodedNickname = encodeURIComponent(nickname);
        const url = `${proto}://${location.host}/ws/chat/${sessionId}?user_id=${userId}&language=${language}&nickname=${encodedNickname}`;

        ws = new WebSocket(url);

        ws.onopen = () => {
            console.log('Chat connected:', sessionId);
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (onMessageCallback) {
                onMessageCallback(data);
            }
        };

        ws.onclose = () => {
            console.log('Chat disconnected');
            ws = null;
        };

        ws.onerror = (err) => {
            console.error('Chat WebSocket error:', err);
        };
    }

    function disconnect() {
        if (ws) {
            ws.close();
            ws = null;
        }
        currentSessionId = null;
    }

    function send(text) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: 'send', text }));
        }
    }

    function onMessage(callback) {
        onMessageCallback = callback;
    }

    function isConnected() {
        return ws !== null && ws.readyState === WebSocket.OPEN;
    }

    function getSessionId() {
        return currentSessionId;
    }

    return { connect, disconnect, send, onMessage, isConnected, getSessionId };
})();
