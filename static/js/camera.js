/**
 * COCO Camera Module
 * WebRTC 카메라 접근 및 사진 촬영
 */
const CameraModule = (() => {
    let stream = null;
    let facingMode = 'environment'; // 'user' or 'environment'
    const videoEl = document.getElementById('camera-preview');
    const canvasEl = document.getElementById('capture-canvas');

    async function start() {
        try {
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
            }
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false,
            });
            videoEl.srcObject = stream;
            return true;
        } catch (err) {
            console.error('Camera access failed:', err);
            return false;
        }
    }

    function stop() {
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            stream = null;
            videoEl.srcObject = null;
        }
    }

    function switchCamera() {
        facingMode = facingMode === 'environment' ? 'user' : 'environment';
        return start();
    }

    function capture() {
        if (!stream) return null;
        canvasEl.width = videoEl.videoWidth;
        canvasEl.height = videoEl.videoHeight;
        const ctx = canvasEl.getContext('2d');
        ctx.drawImage(videoEl, 0, 0);
        return canvasEl.toDataURL('image/jpeg', 0.8);
    }

    function isActive() {
        return stream !== null && stream.active;
    }

    return { start, stop, switchCamera, capture, isActive };
})();
