window.Video = {
    localVideoTrack: null,
    localScreenTrack: null,
    isVideoEnabled: false,
    isScreenSharing: false,
    
    init: () => {
        console.log("Video Module Loaded");
    },

    toggleCamera: async () => {
        if (!window.Voice || !Voice.client || !Voice.currentChannel) {
            UI.toast("Connect to voice first", "error");
            return;
        }

        if (Video.isScreenSharing) await Video.toggleScreenShare();

        try {
            if (Video.isVideoEnabled) {
                if (Video.localVideoTrack) {
                    await Voice.client.unpublish(Video.localVideoTrack);
                    Video.localVideoTrack.stop();
                    Video.localVideoTrack.close();
                    Video.localVideoTrack = null;
                }
                
                Video.isVideoEnabled = false;
                Video.updateUI();
                UI.toast("Camera Disabled", "msg");
                
                document.getElementById('video-local-preview').innerHTML = '';
                document.getElementById('video-local-preview').classList.add('hidden');
                document.getElementById('call-interface').classList.remove('video-active');

            } else {
                Video.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
                await Voice.client.publish([Video.localVideoTrack]);
                
                Video.isVideoEnabled = true;
                Video.updateUI();
                UI.toast("Camera Enabled", "success");

                const localDiv = document.getElementById('video-local-preview');
                localDiv.classList.remove('hidden');
                Video.localVideoTrack.play(localDiv);
                
                document.getElementById('call-interface').classList.add('video-active');
            }
        } catch (e) {
            console.error("Camera Error:", e);
            UI.toast("Camera Error: " + (e.message || "Denied"), "error");
        }
    },

    toggleScreenShare: async () => {
        if (!window.Voice || !Voice.client || !Voice.currentChannel) {
            UI.toast("Connect to voice first", "error");
            return;
        }

        if (Video.isVideoEnabled) await Video.toggleCamera(); 

        try {
            if (Video.isScreenSharing) {
                if (Video.localScreenTrack) {
                    await Voice.client.unpublish(Video.localScreenTrack);
                    if(Array.isArray(Video.localScreenTrack)) Video.localScreenTrack.forEach(t => { t.stop(); t.close(); });
                    else { Video.localScreenTrack.stop(); Video.localScreenTrack.close(); }
                    Video.localScreenTrack = null;
                }
                Video.isScreenSharing = false;
                Video.updateUI();
                
                document.getElementById('video-remote-container').innerHTML = '';
                document.getElementById('call-interface').classList.remove('video-active');
                UI.toast("Screen Share Stopped", "msg");

            } else {
                const screenTracks = await AgoraRTC.createScreenVideoTrack({
                    encoderConfig: "1080p_1", optimizationMode: "detail"
                });

                if (Array.isArray(screenTracks)) Video.localScreenTrack = screenTracks[0];
                else Video.localScreenTrack = screenTracks;

                Video.localScreenTrack.on("track-ended", () => { if(Video.isScreenSharing) Video.toggleScreenShare(); });

                await Voice.client.publish([Video.localScreenTrack]);
                
                Video.isScreenSharing = true;
                Video.updateUI();
                UI.toast("Screen Share Active", "success");
                
                const container = document.getElementById('video-remote-container');
                container.innerHTML = ''; 
                
                const vidDiv = document.createElement('div');
                vidDiv.className = 'remote-video-card';
                container.appendChild(vidDiv);
                
                Video.localScreenTrack.play(vidDiv);
                document.getElementById('call-interface').classList.add('video-active');
            }

        } catch (e) {
            console.warn("Screen share error", e);
            if (e.code !== "PERMISSION_DENIED") UI.toast("Share Failed", "error");
            Video.isScreenSharing = false;
            Video.updateUI();
        }
    },

    updateUI: () => {
        const camBtn = document.getElementById('btn-ci-cam');
        const screenBtn = document.getElementById('btn-ci-screen');
        if(camBtn) {
            camBtn.innerHTML = Video.isVideoEnabled ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
            camBtn.classList.toggle('active', Video.isVideoEnabled);
        }
        if(screenBtn) {
            screenBtn.classList.toggle('active', Video.isScreenSharing);
            screenBtn.style.color = Video.isScreenSharing ? '#000' : '#fff';
        }
    },

    renderRemote: (user) => {
        const container = document.getElementById('video-remote-container');
        if(!container) return;

        if(Video.isScreenSharing) return;

        const vidId = `vid-${user.uid}`;
        let vidDiv = document.getElementById(vidId);
        
        if(!vidDiv) {
            vidDiv = document.createElement('div');
            vidDiv.id = vidId;
            vidDiv.className = 'remote-video-card'; 
            container.appendChild(vidDiv);
        }

        user.videoTrack.play(vidDiv);
        document.getElementById('call-interface').classList.add('video-active');

        if(window.Voice && !Voice.isOverlayFull) {
            Voice.toggleOverlaySize();
            UI.toast("Incoming Video Feed", "msg");
        }
    },

    cleanup: async () => {
        if (Video.localVideoTrack) { Video.localVideoTrack.stop(); Video.localVideoTrack.close(); }
        if (Video.localScreenTrack) {
            if(Array.isArray(Video.localScreenTrack)) Video.localScreenTrack.forEach(t => t.close());
            else { Video.localScreenTrack.stop(); Video.localScreenTrack.close(); }
        }
        Video.localVideoTrack = null;
        Video.localScreenTrack = null;
        Video.isVideoEnabled = false;
        Video.isScreenSharing = false;
        Video.updateUI();
        document.getElementById('video-remote-container').innerHTML = '';
        document.getElementById('video-local-preview').innerHTML = '';
        document.getElementById('video-local-preview').classList.add('hidden');
        document.getElementById('call-interface').classList.remove('video-active');
    }
};
document.addEventListener('DOMContentLoaded', Video.init);