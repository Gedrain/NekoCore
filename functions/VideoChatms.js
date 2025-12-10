window.VideoChat = {
    recorder: null,
    chunks: [],
    
    activeStream: null,
    audioStream: null,
    
    canvas: null,
    ctx: null,
    
    isPreviewing: false,
    isRecording: false,
    timerInterval: null,
    currentFacingMode: 'user',

    canvasSize: 320, 
    frameRate: 20, 

    openRecorder: async () => {
        try {
            if (!VideoChat.audioStream) {
                VideoChat.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }
            await VideoChat.startCameraStream();

            if (!VideoChat.canvas) {
                VideoChat.canvas = document.createElement('canvas');
                VideoChat.canvas.width = VideoChat.canvasSize;
                VideoChat.canvas.height = VideoChat.canvasSize;
                VideoChat.ctx = VideoChat.canvas.getContext('2d', { alpha: false });
            }

            VideoChat.startDrawingLoop();
            VideoChat.isPreviewing = true;
            document.getElementById('video-recording-overlay').classList.remove('hidden');

        } catch (e) {
            console.error(e);
            UI.toast("Camera Access Error", "error");
        }
    },

    startCameraStream: async () => {
        if (VideoChat.activeStream) VideoChat.activeStream.getTracks().forEach(t => t.stop());

        const constraints = {
            video: { 
                width: { ideal: 640 }, 
                height: { ideal: 480 },
                facingMode: VideoChat.currentFacingMode
            }
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            VideoChat.activeStream = stream;
            const videoEl = document.getElementById('v-rec-live-feed');
            videoEl.srcObject = stream;
            await videoEl.play();
            
            videoEl.style.transform = VideoChat.currentFacingMode === 'user' ? 'scaleX(-1)' : 'none';
        } catch(err) {
            console.error("Stream Error:", err);
            UI.toast("Camera Error", "error");
        }
    },

    startDrawingLoop: () => {
        const videoEl = document.getElementById('v-rec-live-feed');
        const draw = () => {
            if (!VideoChat.isPreviewing) return;
            
            if (VideoChat.ctx && videoEl.readyState >= videoEl.HAVE_METADATA) {
                const vw = videoEl.videoWidth;
                const vh = videoEl.videoHeight;
                
                if (vw > 0 && vh > 0) {
                    const size = Math.min(vw, vh);
                    const sx = (vw - size) / 2;
                    const sy = (vh - size) / 2;
                    VideoChat.ctx.drawImage(videoEl, sx, sy, size, size, 0, 0, VideoChat.canvasSize, VideoChat.canvasSize);
                }
            }
            requestAnimationFrame(draw);
        };
        draw();
    },

    switchCamera: async () => {
        VideoChat.currentFacingMode = (VideoChat.currentFacingMode === 'user') ? 'environment' : 'user';
        await VideoChat.startCameraStream();
    },

    closeRecorder: () => {
        if (VideoChat.activeStream) { VideoChat.activeStream.getTracks().forEach(t => t.stop()); VideoChat.activeStream = null; }
        if (VideoChat.audioStream) { VideoChat.audioStream.getTracks().forEach(t => t.stop()); VideoChat.audioStream = null; }

        VideoChat.isPreviewing = false;
        VideoChat.isRecording = false;
        VideoChat.chunks = [];
        clearInterval(VideoChat.timerInterval);

        const videoEl = document.getElementById('v-rec-live-feed');
        if(videoEl) videoEl.srcObject = null;

        document.getElementById('video-recording-overlay').classList.add('hidden');
        document.getElementById('btn-v-shoot').classList.remove('recording');
        const previewBox = document.querySelector('.v-rec-preview-box');
        if(previewBox) previewBox.classList.remove('recording');
        document.getElementById('v-rec-timer').innerText = "0:00";
    },

    toggleRecord: () => {
        if (VideoChat.isRecording) VideoChat.stopAndSend();
        else VideoChat.startRecording();
    },

    getSupportedMimeType: () => {
        const types = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) return type;
        }
        return 'video/webm';
    },

    startRecording: () => {
        if (!VideoChat.canvas || !VideoChat.audioStream) return;
        VideoChat.chunks = [];
        
        const canvasStream = VideoChat.canvas.captureStream(VideoChat.frameRate); 
        const audioTrack = VideoChat.audioStream.getAudioTracks()[0];
        if (audioTrack) canvasStream.addTrack(audioTrack);

        const mimeType = VideoChat.getSupportedMimeType();
        const options = { mimeType: mimeType, videoBitsPerSecond: 150000 };

        try {
            VideoChat.recorder = new MediaRecorder(canvasStream, options);
        } catch (e) {
            console.warn("Fallback recorder");
            VideoChat.recorder = new MediaRecorder(canvasStream);
        }

        VideoChat.recorder.ondataavailable = (e) => {
            if (e.data.size > 0) VideoChat.chunks.push(e.data);
        };

        VideoChat.recorder.start(1000);
        VideoChat.isRecording = true;

        document.getElementById('btn-v-shoot').classList.add('recording');
        document.querySelector('.v-rec-preview-box').classList.add('recording');
        
        let sec = 0;
        const timerEl = document.getElementById('v-rec-timer');
        VideoChat.timerInterval = setInterval(() => {
            sec++;
            const m = Math.floor(sec / 60);
            const s = sec % 60;
            timerEl.innerText = `${m}:${s < 10 ? '0'+s : s}`;
            if(sec >= 60) VideoChat.stopAndSend();
        }, 1000);
    },

    stopAndSend: () => {
        if (!VideoChat.recorder || !VideoChat.isRecording) return;
        
        VideoChat.recorder.onstop = () => {
            const blob = new Blob(VideoChat.chunks, { type: VideoChat.recorder.mimeType });
            
            if (blob.size > 3 * 1024 * 1024) {
                UI.toast("Video too large!", "error");
                VideoChat.closeRecorder();
                return;
            }

            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                Chat.pushMessage(null, '', null, reader.result);
                UI.toast("Video Sent", "success");
                VideoChat.closeRecorder();
            };
        };

        VideoChat.recorder.stop();
        VideoChat.isRecording = false;
        clearInterval(VideoChat.timerInterval);
    }
};