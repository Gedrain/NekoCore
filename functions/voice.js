const AGORA_APP_ID = "YOUR_AGORA_APP_ID"; 

window.Voice = {
    client: null,
    localAudioTrack: null,
    remoteUsers: {},
    currentChannel: null,
    
    isMuted: false,       
    isDeafened: false,
    
    pttEnabled: false,    
    isPttActive: false,   
    pttKey: 'Space',

    croppedBanner: null,
    listListener: null,
    
    currentMicId: null,
    currentSpeakerId: null,
    localVolume: 100,     
    masterVolume: 100,    
    remoteVolumes: {},    
    
    isTestRunning: false,
    testTrack: null,
    testInterval: null,

    pendingCallData: null,
    currentCallRef: null,
    activeRemoteUid: null,

    isOverlayFull: true,

    init: async () => {
        const banIn = document.getElementById('new-v-banner');
        if(banIn) {
            banIn.onchange = e => {
                const file = e.target.files[0];
                if (!file) return;
                UI.Crop.start(file, 2.5, (base64) => {
                    Voice.croppedBanner = base64;
                    document.getElementById('new-v-banner-prev').style.backgroundImage = `url(${base64})`;
                    banIn.value = '';
                });
            };
        }
        
        if(window.AgoraRTC) {
            Voice.client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
            Voice.setupAgoraListeners();
            
            Voice.currentMicId = localStorage.getItem('neko_mic_id');
            Voice.currentSpeakerId = localStorage.getItem('neko_spk_id');
            
            const savedMicVol = localStorage.getItem('neko_mic_vol');
            if(savedMicVol) Voice.localVolume = parseInt(savedMicVol);
            
            const savedMasterVol = localStorage.getItem('neko_master_vol');
            if(savedMasterVol) Voice.masterVolume = parseInt(savedMasterVol);

            const savedPtt = localStorage.getItem('neko_ptt_enabled');
            Voice.pttEnabled = savedPtt === 'true';

            const savedKey = localStorage.getItem('neko_ptt_key');
            if(savedKey) Voice.pttKey = savedKey;

            try { await AgoraRTC.getDevices(); } catch(e) { console.warn("Permissions pending"); }

            document.addEventListener('keydown', Voice.handlePttDown);
            document.addEventListener('keyup', Voice.handlePttUp);

        } else {
            console.error("Agora SDK not loaded!");
        }

        Voice.load();
        setTimeout(() => Voice.listenForIncoming(), 2000); 
    },

    setupAgoraListeners: () => {
        Voice.client.on("user-published", async (user, mediaType) => {
            await Voice.client.subscribe(user, mediaType);
            
            if (mediaType === "audio") {
                const remoteAudioTrack = user.audioTrack;
                Voice.remoteUsers[user.uid] = user;

                Voice.applyUserVolume(user.uid);

                if(!Voice.isDeafened) {
                    remoteAudioTrack.play();
                }
                
                if(Voice.currentChannel && Voice.currentChannel.startsWith('dm_')) {
                    Voice.activeRemoteUid = user.uid;
                    document.getElementById('ci-status-text').innerText = "CONNECTED";
                    document.getElementById('ci-status-text').style.color = "#00ff9d";
                    
                    const vol = Voice.remoteVolumes[user.uid] !== undefined ? Voice.remoteVolumes[user.uid] : 100;
                    document.getElementById('ci-remote-vol').value = vol;
                }
            }

            if (mediaType === "video") {
                if(window.Video) Video.renderRemote(user);
            }
        });

        Voice.client.on("user-unpublished", (user, mediaType) => {
            if (mediaType === "audio") {
                delete Voice.remoteUsers[user.uid];
                if(Voice.activeRemoteUid === user.uid) {
                    document.getElementById('ci-status-text').innerText = "WAITING...";
                    document.getElementById('ci-status-text').style.color = "#ffcc00";
                }
            }
            if (mediaType === "video") {
                const vidDiv = document.getElementById(`vid-${user.uid}`);
                if(vidDiv) vidDiv.remove();
                
                const stage = document.getElementById('video-remote-container');
                if(stage && stage.children.length === 0 && (!window.Video || !Video.isVideoEnabled)) {
                    document.getElementById('call-interface').classList.remove('video-active');
                }
            }
        });
    },

    bindPttKey: (btnElement) => {
        btnElement.innerText = "PRESS ANY KEY...";
        btnElement.classList.add('active');

        const handler = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const code = e.code;
            if(code === 'Escape') {
                document.removeEventListener('keydown', handler, true);
                btnElement.innerText = Voice.formatKeyName(Voice.pttKey);
                btnElement.classList.remove('active');
                return;
            }

            Voice.pttKey = code;
            localStorage.setItem('neko_ptt_key', code);
            
            btnElement.innerText = Voice.formatKeyName(code);
            btnElement.classList.remove('active');
            
            UI.toast(`PTT Key set to: ${Voice.formatKeyName(code)}`, "success");
            document.removeEventListener('keydown', handler, true);
        };
        document.addEventListener('keydown', handler, true);
    },

    formatKeyName: (code) => {
        if(!code) return "Space";
        return code.replace('Key', '').replace('Digit', '');
    },

    handlePttDown: (e) => {
        if(!Voice.pttEnabled || !Voice.localAudioTrack || Voice.isPttActive) return;
        if(e.code !== Voice.pttKey) return; 

        const tag = document.activeElement.tagName;
        const isInput = (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable);
        const isSpecialKey = e.code.includes('Control') || e.code.includes('Alt') || e.code.includes('Shift') || e.code.includes('F');
        
        if(isInput && !isSpecialKey) return;

        e.preventDefault(); 
        Voice.isPttActive = true;
        Voice.updateMicState();
        UI.toast("Transmitting...", "msg");
    },

    handlePttUp: (e) => {
        if(!Voice.pttEnabled || !Voice.localAudioTrack) return;
        if(e.code !== Voice.pttKey) return;

        Voice.isPttActive = false;
        Voice.updateMicState();
    },

    setPushToTalk: (enabled) => {
        Voice.pttEnabled = enabled;
        localStorage.setItem('neko_ptt_enabled', enabled);
        Voice.updateMicState(); 
    },

    updateMicState: async () => {
        if(!Voice.localAudioTrack) return;

        let shouldBeEnabled = true;
        if(Voice.pttEnabled) {
            shouldBeEnabled = Voice.isPttActive;
        } else {
            shouldBeEnabled = !Voice.isMuted;
        }

        await Voice.localAudioTrack.setEnabled(shouldBeEnabled);
        
        const icon = shouldBeEnabled ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
        
        const btnOverlay = document.getElementById('btn-ci-mute');
        if(btnOverlay) { 
            btnOverlay.innerHTML = icon; 
            btnOverlay.classList.toggle('active', !shouldBeEnabled); 
            if(!shouldBeEnabled) btnOverlay.classList.add('danger');
            else btnOverlay.classList.remove('danger');
        }

        if(Voice.currentChannel && !Voice.currentChannel.startsWith('dm_')) {
            db.ref(`voice_channels/${Voice.currentChannel}/users/${State.user.uid}`).update({isMuted: !shouldBeEnabled});
        }
    },

    setMasterVolume: (val) => {
        Voice.masterVolume = parseInt(val);
        localStorage.setItem('neko_master_vol', val);
        Object.keys(Voice.remoteUsers).forEach(uid => Voice.applyUserVolume(uid));
    },

    setRemoteVolume: (uid, val) => {
        Voice.remoteVolumes[uid] = parseInt(val);
        Voice.applyUserVolume(uid);
    },

    applyUserVolume: (uid) => {
        const user = Voice.remoteUsers[uid];
        if(!user || !user.audioTrack) return;

        const userVol = Voice.remoteVolumes[uid] !== undefined ? Voice.remoteVolumes[uid] : 100;
        const masterFactor = Voice.masterVolume / 100;
        const finalVol = userVol * masterFactor;
        
        user.audioTrack.setVolume(finalVol);
    },

    updateActiveRemoteVolume: (val) => {
        if(Voice.activeRemoteUid) {
            Voice.setRemoteVolume(Voice.activeRemoteUid, val);
        } else {
            Voice.setMasterVolume(val);
        }
    },

    setMicDevice: (deviceId) => {
        Voice.currentMicId = deviceId;
        localStorage.setItem('neko_mic_id', deviceId);
        if(Voice.localAudioTrack) Voice.localAudioTrack.setDevice(deviceId);
    },

    setSpeakerDevice: (deviceId) => {
        Voice.currentSpeakerId = deviceId;
        localStorage.setItem('neko_spk_id', deviceId);
    },

    setLocalVolume: (val) => {
        Voice.localVolume = parseInt(val);
        localStorage.setItem('neko_mic_vol', val);
        if(Voice.localAudioTrack) Voice.localAudioTrack.setVolume(Voice.localVolume);
    },

    getDevices: async () => {
        try {
            const devices = await AgoraRTC.getDevices();
            const mics = devices.filter(d => d.kind === 'audioinput');
            const speakers = devices.filter(d => d.kind === 'audiooutput');
            return { mics, speakers };
        } catch(e) {
            console.error(e);
            return { mics: [], speakers: [] };
        }
    },

    toggleMicTest: async () => {
        const btn = document.getElementById('btn-mic-test');
        const bar = document.getElementById('mic-test-bar');
        
        if(Voice.isTestRunning) {
            Voice.isTestRunning = false;
            if(Voice.testTrack) { Voice.testTrack.close(); Voice.testTrack = null; }
            if(Voice.testInterval) clearInterval(Voice.testInterval);
            if(btn) btn.innerText = "START TEST";
            if(bar) bar.style.width = '0%';
        } else {
            try {
                Voice.testTrack = await AgoraRTC.createMicrophoneAudioTrack({ microphoneId: Voice.currentMicId });
                Voice.isTestRunning = true;
                if(btn) btn.innerText = "STOP TEST";
                
                Voice.testInterval = setInterval(() => {
                    const level = Voice.testTrack.getVolumeLevel();
                    if(bar) bar.style.width = (level * 100 * 1.5) + '%';
                }, 100);
            } catch(e) {
                UI.toast("Mic access failed", "error");
            }
        }
    },

    create: () => {
        const n = document.getElementById('new-v-name').value;
        const isPriv = document.getElementById('new-v-priv').checked;
        const pass = isPriv ? document.getElementById('new-v-pass').value : null;
        
        if(!n) return UI.toast("Name required", "error");
        
        const data = {
            name: n,
            pass: pass,
            creator: State.user.uid,
            banner: Voice.croppedBanner || null,
            users: {} 
        };
        
        db.ref('voice_channels').push(data).then(() => {
            UI.toast("Voice Channel Created", "success");
            document.getElementById('modal-create-voice').classList.remove('open');
            document.getElementById('new-v-name').value = '';
            document.getElementById('new-v-pass').value = '';
            document.getElementById('new-v-banner-prev').style.backgroundImage = 'none';
            Voice.croppedBanner = null;
        });
    },

    delete: (key) => {
        UI.confirm("DELETE ROOM", "Are you sure?", () => {
            db.ref('voice_channels/' + key).remove().then(() => {
                UI.toast("Room deleted", "success");
                if(Voice.currentChannel === key) Voice.leave();
            });
        });
    },

    load: () => {
        const l = document.getElementById('voice-list');
        if(!l) return;
        
        if (Voice.listListener) db.ref('voice_channels').off('value', Voice.listListener);
        
        Voice.listListener = db.ref('voice_channels').on('value', s => {
            l.innerHTML = '';
            const val = s.val();
            if(!val) { l.innerHTML = '<div style="text-align:center; padding:20px; color:#555;">No active voice channels.</div>'; return; }
            
            Object.keys(val).forEach(key => {
                const v = val[key];
                const count = v.users ? Object.keys(v.users).length : 0;
                
                const div = document.createElement('div');
                div.className = 'voice-card';
                if(Voice.currentChannel === key) div.classList.add('active');

                if(v.banner) {
                    div.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.9)), url('${v.banner}')`;
                    div.style.backgroundSize = 'cover';
                    div.style.backgroundPosition = 'center';
                }

                const lockIcon = v.pass ? '<i class="fas fa-lock" style="color:#ffcc00; margin-right:8px; font-size:0.8rem;"></i>' : '';
                
                let usersHtml = '';
                if(v.users) {
                    usersHtml = '<div class="voice-users-preview">';
                    let i = 0;
                    Object.values(v.users).forEach(u => {
                        if(i < 5) usersHtml += `<img src="${u.avatar}" title="${u.name}" class="v-mini-avi">`;
                        i++;
                    });
                    if(count > 5) usersHtml += `<span style="font-size:0.8rem; color:#888; align-self:center;">+${count-5}</span>`;
                    usersHtml += '</div>';
                }

                let controlsHtml = `<div class="v-card-controls">
                    <button class="btn-icon-sm" onclick="event.stopPropagation(); Voice.viewMembers('${key}')"><i class="fas fa-users"></i> Users</button>
                `;
                
                if(v.creator === State.user.uid || (State.profile && State.profile.role === 'super')) {
                    controlsHtml += `<button class="btn-icon-sm danger" onclick="event.stopPropagation(); Voice.delete('${key}')"><i class="fas fa-trash"></i></button>`;
                }
                controlsHtml += `</div>`;

                div.innerHTML = `
                    <div class="v-card-head">
                        <div class="v-card-title">${lockIcon}${v.name}</div>
                        <div class="v-card-count"><i class="fas fa-signal"></i> ${count}</div>
                    </div>
                    ${usersHtml}
                    ${controlsHtml}
                `;
                div.onclick = () => Voice.attemptJoin(key, v);
                l.appendChild(div);
            });
        });
    },

    viewMembers: (key) => {
        const list = document.getElementById('members-list');
        list.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Loading...</div>';
        document.getElementById('modal-members').classList.add('open');

        db.ref('voice_channels/'+key+'/users').once('value', snap => {
            list.innerHTML = '';
            if(!snap.exists()) {
                list.innerHTML = '<div style="text-align:center; color:#555;">No active members</div>';
                return;
            }
            const users = snap.val();
            Object.keys(users).forEach(uid => {
                const u = users[uid];
                const micStatus = u.isMuted ? '<i class="fas fa-microphone-slash" style="color:#ff0055;"></i>' : '<i class="fas fa-microphone" style="color:#00ff9d;"></i>';
                
                const card = document.createElement('div');
                card.className = 'member-card';
                card.innerHTML = `
                    <div class="member-avi-wrap"><img src="${u.avatar || 'https://via.placeholder.com/50'}" class="member-avi"></div>
                    <div class="member-info">
                        <div class="member-name">${u.name}</div>
                        <div class="member-seen">Voice Connected ${micStatus}</div>
                    </div>
                    <button class="btn-text" style="padding:5px 10px; border:1px solid #333;" onclick="window.Profile.view('${uid}')">PROFILE</button>
                `;
                list.appendChild(card);
            });
        });
    },

    attemptJoin: (key, data) => {
        if(Voice.currentChannel === key) return; 
        if(Voice.currentChannel) Voice.leave(); 

        if(data.pass) {
            State.pendingVoice = { id: key, pass: data.pass };
            document.getElementById('modal-voice-pass').classList.add('open');
        } else {
            const banner = data.banner || "https://via.placeholder.com/150/000000/ffffff?text=Voice";
            Voice.join(key, false, data.name, banner);
        }
    },

    authAndJoin: () => {
        const inp = document.getElementById('voice-auth-pass');
        if(inp.value === State.pendingVoice.pass) {
            document.getElementById('modal-voice-pass').classList.remove('open');
            inp.value = '';
            db.ref('voice_channels/' + State.pendingVoice.id).once('value', snap => {
                const v = snap.val();
                const banner = v.banner || "https://via.placeholder.com/150/000000/ffffff?text=Voice";
                Voice.join(State.pendingVoice.id, false, v.name, banner);
            });
        } else {
            UI.toast("Wrong Password", "error");
        }
    },

    termLog: (txt, color="#d600ff") => {
        const box = document.getElementById('vt-content');
        if(!box) return;
        const p = document.createElement('div');
        p.className = 'vt-line';
        p.innerHTML = `<span style="color:${color}">></span> ${txt}`;
        box.appendChild(p);
        box.scrollTop = box.scrollHeight;
    },

    join: async (channelName, isDM = false, displayLabel = "Unknown", avatar = null) => {
        const overlay = document.getElementById('voice-overlay');
        const content = document.getElementById('vt-content');
        content.innerHTML = '';
        overlay.classList.remove('hidden');

        const sleep = ms => new Promise(r => setTimeout(r, ms));

        try {
            Voice.termLog("Initializing Audio Subsystem...");
            await sleep(400);

            const uid = State.user.uid; 
            
            Voice.termLog("Target Frequency: " + channelName);
            await sleep(300);

            Voice.termLog("Handshaking AgoraRTC Network...", "#00ff9d");
            await sleep(400);

            await Voice.client.join(AGORA_APP_ID, channelName, null, uid);

            Voice.termLog("Uplink Established.");
            await sleep(200);
            
            Voice.termLog("Activating Input Device...", "#fcee0a");
            const config = Voice.currentMicId ? { microphoneId: Voice.currentMicId } : {};
            Voice.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack(config);
            Voice.localAudioTrack.setVolume(Voice.localVolume);

            await Voice.client.publish([Voice.localAudioTrack]);
            
            Voice.termLog("Audio Stream Active. Connected.", "#00ff9d");
            Voice.updateMicState();

            await sleep(500);

            Voice.currentChannel = channelName;
            
            Voice.renderCallInterface(true, displayLabel, avatar);

            if(!isDM) {
                const myData = {
                    name: State.profile.displayName,
                    avatar: State.profile.avatar,
                    uid: State.user.uid,
                    isMuted: Voice.isMuted, 
                    isDeaf: false
                };
                const ref = db.ref(`voice_channels/${channelName}/users/${State.user.uid}`);
                await ref.set(myData);
                ref.onDisconnect().remove();
            }
            
            overlay.classList.add('hidden');
            UI.toast(isDM ? "Call Connected" : "Joined Channel", "success");

        } catch (e) {
            console.error(e);
            Voice.termLog("FATAL ERROR: " + e.message, "#ff0055");
            await sleep(2000);
            overlay.classList.add('hidden');
            UI.toast("Connection Failed", "error");
            Voice.leave();
        }
    },

    leave: async () => {
        if(!Voice.currentChannel) return;
        
        if(window.Video) await Video.cleanup();

        if(!Voice.currentChannel.startsWith('dm_')) {
            db.ref(`voice_channels/${Voice.currentChannel}/users/${State.user.uid}`).remove();
        }
        
        if(Voice.currentCallRef) {
            Voice.currentCallRef.remove(); 
            Voice.currentCallRef = null;
        }

        if(Voice.localAudioTrack) {
            Voice.localAudioTrack.stop();
            Voice.localAudioTrack.close();
            Voice.localAudioTrack = null;
        }

        await Voice.client.leave();

        Voice.currentChannel = null;
        Voice.activeRemoteUid = null;
        
        Voice.renderCallInterface(false);
        UI.toast("Disconnected", "msg");
    },

    toggleMute: async () => {
        if(Voice.pttEnabled) {
             UI.toast("PTT Enabled: Use Assigned Key", "msg");
             return;
        }
        Voice.isMuted = !Voice.isMuted;
        Voice.updateMicState();
    },

    toggleDeafen: () => {
        Voice.isDeafened = !Voice.isDeafened;
        
        Object.values(Voice.remoteUsers).forEach(user => {
            if(user.audioTrack) {
                if(Voice.isDeafened) user.audioTrack.stop();
                else user.audioTrack.play();
            }
        });

        const icon = Voice.isDeafened ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-headphones"></i>';
        
        const btnOverlay = document.getElementById('btn-ci-deaf');
        if(btnOverlay) { 
            btnOverlay.innerHTML = icon; 
            btnOverlay.classList.toggle('active', Voice.isDeafened);
            if(Voice.isDeafened) btnOverlay.classList.add('danger');
            else btnOverlay.classList.remove('danger');
        }
        
        if(Voice.isDeafened) UI.toast("Sound Disabled", "msg");
        else UI.toast("Sound Enabled", "msg");
        
        if(Voice.currentChannel && !Voice.currentChannel.startsWith('dm_')) {
            db.ref(`voice_channels/${Voice.currentChannel}/users/${State.user.uid}`).update({isDeaf: Voice.isDeafened});
        }
    },

    toggleOverlaySize: () => {
        Voice.isOverlayFull = !Voice.isOverlayFull;
        Voice.updateOverlayState();
    },

    updateOverlayState: () => {
        const el = document.getElementById('call-interface');
        const icon = document.getElementById('icon-resize');
        
        if(Voice.isOverlayFull) {
            el.classList.remove('mini-mode');
            el.classList.add('full-mode');
            if(icon) icon.className = "fas fa-compress-alt"; 
        } else {
            el.classList.remove('full-mode');
            el.classList.add('mini-mode');
            if(icon) icon.className = "fas fa-expand-alt"; 
        }
    },

    renderCallInterface: (isActive, name = "Unknown", avatar = null) => {
        const overlay = document.getElementById('call-interface');
        
        if(isActive) {
            overlay.classList.remove('hidden');
            
            Voice.isOverlayFull = true;
            Voice.updateOverlayState();

            document.getElementById('ci-name').innerText = name;
            document.getElementById('ci-status-text').innerText = "CONNECTED";
            document.getElementById('ci-status-text').style.color = "#00ff9d";
            
            const aviEl = document.getElementById('ci-avi');
            if(avatar) aviEl.src = avatar;
            else aviEl.src = "https://via.placeholder.com/150";
            
            Voice.updateMicState(); 

        } else {
            overlay.classList.add('hidden');
        }
    },

    listenForIncoming: () => {
        if(!State.user) return;
        const myCallRef = db.ref('calls/' + State.user.uid);
        myCallRef.on('value', snap => {
            const val = snap.val();
            if(val) {
                Block.isBlockedByMe(val.from).then(isBlocked => {
                    if(!isBlocked) {
                        Voice.pendingCallData = val;
                        Voice.showIncomingModal(val);
                    }
                });
            } else {
                document.getElementById('modal-incoming-call').classList.remove('open');
                Voice.pendingCallData = null;
            }
        });
    },

    callUser: async (targetUid) => {
        if(Voice.currentChannel) {
            UI.toast("Disconnect first", "error");
            return;
        }

        const check = await Privacy.check(targetUid, 'call');
        if(!check.allowed) {
            UI.toast(check.error || "Call rejected", "error");
            return;
        }

        UI.toast("Calling...", "msg");

        db.ref('users/' + targetUid).once('value', snap => {
            const u = snap.val();
            const targetName = u ? u.displayName : 'Unknown';
            const targetAvi = u ? u.avatar : 'https://via.placeholder.com/80';

            const channelId = `dm_${State.user.uid}_${targetUid}`;
            const callData = {
                from: State.user.uid,
                fromName: State.profile.displayName,
                fromAvi: State.profile.avatar,
                channel: channelId,
                ts: Date.now()
            };
            
            Voice.currentCallRef = db.ref('calls/' + targetUid);
            Voice.currentCallRef.set(callData);
            Voice.currentCallRef.onDisconnect().remove();

            Voice.join(channelId, true, targetName, targetAvi);
        });
    },

    showIncomingModal: (data) => {
        if(Voice.currentChannel) return;
        document.getElementById('inc-call-name').innerText = data.fromName || "Unknown";
        document.getElementById('inc-call-avi').src = data.fromAvi || "https://via.placeholder.com/100";
        document.getElementById('modal-incoming-call').classList.add('open');
        
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3'); 
        audio.volume = 0.5;
        audio.play().catch(e=>{});
        Voice.ringtone = audio;
    },

    acceptCall: () => {
        if(!Voice.pendingCallData) return;
        if(Voice.ringtone) { Voice.ringtone.pause(); Voice.ringtone = null; }
        const data = Voice.pendingCallData;
        document.getElementById('modal-incoming-call').classList.remove('open');
        
        Voice.join(data.channel, true, data.fromName, data.fromAvi);
        Voice.currentCallRef = db.ref('calls/' + State.user.uid);
    },

    rejectCall: () => {
        if(Voice.ringtone) { Voice.ringtone.pause(); Voice.ringtone = null; }
        document.getElementById('modal-incoming-call').classList.remove('open');
        if(Voice.pendingCallData) {
            db.ref('calls/' + State.user.uid).remove();
            Voice.pendingCallData = null;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => { if(window.Voice) Voice.init(); });