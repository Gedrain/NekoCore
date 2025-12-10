window.Settings = {
    croppedData: { avi: null, ban: null },
    pickerTarget: null,
    pickerColor: '#ffffff',

    config: {
        accent: '#d600ff',
        bg: '#05000a',
        panel: '#0e0e12',
        text: '#ffffff',
        msgText: '#ffffff',
        msgSize: '1', 
        radius: '0' 
    },

    presets: {
        'default': { name: 'Neko Core', accent: '#d600ff', bg: '#05000a', panel: '#0e0e12', text: '#ffffff', msgText: '#ffffff' },
        'matrix':  { name: 'Matrix',    accent: '#00ff9d', bg: '#001100', panel: '#002200', text: '#e0ffe0', msgText: '#00ff9d' },
        'cyber':   { name: 'Cyberpunk', accent: '#fcee0a', bg: '#0b0b10', panel: '#1a1a24', text: '#ffffff', msgText: '#1a1a24' },
        'red':     { name: 'Arasaka',   accent: '#ff003c', bg: '#000000', panel: '#140000', text: '#ffcccc', msgText: '#ffffff' },
        'ice':     { name: 'Ice Wall',  accent: '#00e5ff', bg: '#081014', panel: '#0d1b24', text: '#dfffff', msgText: '#000000' },
        'white':   { name: 'Lab White', accent: '#333333', bg: '#e0e0e0', panel: '#ffffff', text: '#000000', msgText: '#000000' },
    },

    init: () => {
        const localTheme = localStorage.getItem('neko_theme_config');
        if (localTheme) {
            try { Settings.config = JSON.parse(localTheme); Settings.applyTheme(Settings.config); } catch(e){}
        }

        if(State.user && State.user.themeConfig) {
            Settings.config = State.user.themeConfig;
            Settings.applyTheme(Settings.config);
        }
        
        window.handleFileUpload = (input, type) => {
            const file = input.files[0];
            if (!file) return;
            const ratio = type === 'avi' ? 1 : 2.5;
            if (file.type.toLowerCase().includes('gif')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    Settings.croppedData[type] = e.target.result;
                    Settings.updateProfilePreview(type, e.target.result);
                };
                reader.readAsDataURL(file);
            } else {
                UI.Crop.start(file, ratio, (base64) => {
                    Settings.croppedData[type] = base64;
                    Settings.updateProfilePreview(type, base64);
                    input.value = '';
                });
            }
        };
    },

    openPicker: (targetId, initialColor) => {
        Settings.pickerTarget = targetId;
        Settings.pickerColor = initialColor || '#ffffff';
        const modal = document.getElementById('modal-color-picker');
        const preview = document.getElementById('picker-preview-box');
        const hexIn = document.getElementById('picker-hex-in');
        const presetsDiv = document.getElementById('picker-presets');

        preview.style.backgroundColor = Settings.pickerColor;
        hexIn.value = Settings.pickerColor;

        const presets = ['#d600ff', '#bc13fe', '#8a00d4', '#ff0055', '#ff003c', '#00ff9d', '#00e5ff', '#00aaff', '#fcee0a', '#ff9900', '#ffffff', '#888888', '#111111', '#000000'];
        presetsDiv.innerHTML = '';
        presets.forEach(c => {
            const d = document.createElement('div');
            d.className = 'picker-swatch';
            d.style.backgroundColor = c;
            d.onclick = () => Settings.updateFromHex(c);
            presetsDiv.appendChild(d);
        });
        modal.classList.add('open');
    },

    updateFromHex: (hex) => {
        Settings.pickerColor = hex;
        document.getElementById('picker-preview-box').style.backgroundColor = hex;
        document.getElementById('picker-hex-in').value = hex;
    },

    pickSpectrum: (e) => {
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const hue = Math.floor((x / rect.width) * 360);
        const color = `hsl(${hue}, 100%, 50%)`;
        const temp = document.createElement('div');
        temp.style.color = color;
        document.body.appendChild(temp);
        const rgb = window.getComputedStyle(temp).color.match(/\d+/g).map(Number);
        document.body.removeChild(temp);
        const hex = "#" + rgb.map(x => x.toString(16).padStart(2,'0')).join('');
        Settings.updateFromHex(hex);
    },

    confirmColor: () => {
        if(Settings.pickerTarget) {
            const btn = document.getElementById('btn-color-' + Settings.pickerTarget);
            if(btn) btn.style.backgroundColor = Settings.pickerColor;
            
            if(Settings.pickerTarget === 'prefix') {
                document.getElementById('set-prefix-color-val').value = Settings.pickerColor;
            } else {
                const input = document.getElementById(Settings.pickerTarget);
                if(input) {
                    input.value = Settings.pickerColor;
                    Settings.liveUpdate();
                }
            }
        }
        document.getElementById('modal-color-picker').classList.remove('open');
    },

    updateProfilePreview: (type, src) => {
        if(type === 'avi') {
            const el = document.getElementById('preview-avi');
            if(el) el.src = src;
        } else {
            const el = document.getElementById('preview-banner');
            if(el) el.style.backgroundImage = `url(${src})`;
        }
    },

    renderMainMenu: () => {
        const container = document.getElementById('settings-dynamic-area');
        if(!container) return;
        
        container.innerHTML = `
            <div class="settings-menu-grid">
                <div class="set-menu-card" onclick="Settings.renderProfileEditor()"><i class="fas fa-id-card"></i><span>IDENTITY</span><div class="sm-desc">Avatar, Banner, Bio</div></div>
                <div class="set-menu-card" onclick="Settings.renderAppearanceEditor()"><i class="fas fa-paint-brush"></i><span>APPEARANCE</span><div class="sm-desc">Colors, Fonts, UI</div></div>
                <div class="set-menu-card" onclick="Settings.renderVoiceSettings()"><i class="fas fa-microphone-lines"></i><span>AUDIO / VOICE</span><div class="sm-desc">Inputs, Outputs, Volume</div></div>
                <div class="set-menu-card" onclick="Settings.renderPrivacySettings()"><i class="fas fa-user-shield"></i><span>PRIVACY</span><div class="sm-desc">Blocklist, DMs, Calls</div></div>
                <div class="set-menu-card" onclick="Settings.renderInfo()"><i class="fas fa-info-circle"></i><span>INFO / ABOUT</span><div class="sm-desc">Developer & Project</div></div>
            </div>
            <div style="margin-top:30px; text-align:center; opacity:0.3; font-size:0.7rem; font-family:monospace;">NEKO CORE v70.0 STABLE</div>
        `;
    },

    renderInfo: () => {
        const container = document.getElementById('settings-dynamic-area');
        if(!container) return;

        container.innerHTML = `
            <div class="set-header-nav"><button class="btn-text" onclick="Settings.renderMainMenu()"><i class="fas fa-arrow-left"></i> BACK</button><h3>PROJECT INFO</h3></div>
            <div class="scroll-area-set" style="display:flex; flex-direction:column; align-items:center; height:100%; overflow-y:auto; padding-bottom:50px;">
                <div class="info-card-container">
                    <h1 class="info-title glitch-text-anim">NEKO CORE</h1>
                    <div class="info-text-block">
                        <p class="anim-line delay-1">Проект разрабатывается одним разработчиком — <span class="dev-name">GedRain</span></p>
                        <p class="anim-line delay-2">На данный момент проект нацелен на полностью <span class="highlight">бесплатное базирование</span> и является отечественным аналогом другим мессенеджерам.</p>
                        <p class="anim-line delay-3" style="margin-top:15px; color:#aaa;">System Status: <span style="color:#00ff9d">ONLINE</span></p>
                    </div>
                    <a href="https://t.me/GedRain" target="_blank" class="tg-connect-btn anim-line delay-4">
                        <i class="fab fa-telegram-plane"></i> TELEGRAM @GedRain
                    </a>
                </div>
                <div class="info-image-container anim-line delay-5">
                    <img src="info.jpg" alt="Project Info Image" class="info-image">
                    <div class="info-image-filter"></div>
                </div>
            </div>
        `;
    },

    renderProfileEditor: () => {
        const container = document.getElementById('settings-dynamic-area');
        const profile = State.profile || {};

        let roleName = 'USER';
        let roleColor = '#666';
        if(profile.role === 'admin') { roleName = 'ADMIN'; roleColor = '#ff0055'; }
        if(profile.role === 'super') { roleName = 'ROOT'; roleColor = '#d600ff'; }

        container.innerHTML = `
            <div class="set-header-nav"><button class="btn-text" onclick="Settings.renderMainMenu()"><i class="fas fa-arrow-left"></i> BACK</button><h3>PROFILE DATA</h3></div>
            <div class="scroll-area-set">
                <div class="profile-edit-header">
                    <div id="preview-banner" class="set-banner-preview" style="background-image: url('${profile.banner || ''}')">
                        <label for="banner-in" class="upload-btn-banner"><i class="fas fa-image"></i> EDIT COVER</label>
                    </div>
                    <div class="set-avi-wrapper">
                        <img id="preview-avi" src="${profile.avatar || 'https://via.placeholder.com/100'}" class="set-avi-preview">
                        <label for="avi-in" class="upload-btn-mini"><i class="fas fa-camera"></i></label>
                    </div>
                    <div class="set-meta-info">
                        <div class="meta-chip">ID: ${profile.shortId || '????'}</div>
                        <div class="meta-chip" style="color:${roleColor}; border-color:${roleColor}40;">${roleName}</div>
                    </div>
                </div>

                <input type="file" id="avi-in" hidden onchange="handleFileUpload(this, 'avi')">
                <input type="file" id="banner-in" hidden onchange="handleFileUpload(this, 'ban')">

                <div class="input-group" style="margin-top:10px;"><input type="text" id="my-nick" placeholder=" " value="${profile.displayName || ''}"><label>DISPLAY NAME</label><div class="input-line"></div></div>

                <div class="input-group">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="flex:1; position:relative;"><input type="text" id="set-prefix" placeholder=" " value="${profile.prefix || ''}"><label>CLAN / PREFIX</label><div class="input-line"></div></div>
                        <div id="btn-color-prefix" class="color-circle-btn" style="background-color: ${profile.prefixColor || '#ffffff'};" onclick="Settings.openPicker('prefix', '${profile.prefixColor || '#ffffff'}')"></div>
                        <input type="hidden" id="set-prefix-color-val" value="${profile.prefixColor || '#ffffff'}">
                    </div>
                </div>

                <div class="input-group"><textarea id="my-bio" placeholder=" " rows="3" style="resize:none;">${profile.bio || ''}</textarea><label>BIO / STATUS</label><div class="input-line"></div></div>
                <button class="btn-solid" onclick="Settings.saveProfile()">SAVE PROFILE</button>
            </div>
        `;
    },

    renderAppearanceEditor: () => {
        const container = document.getElementById('settings-dynamic-area');
        const c = Settings.config; 
        const colorBtn = (id, val) => `<div id="btn-color-${id}" class="color-circle-btn" style="background-color:${val}" onclick="Settings.openPicker('${id}', '${val}')"></div><input type="hidden" id="${id}" value="${val}">`;

        container.innerHTML = `
            <div class="set-header-nav"><button class="btn-text" onclick="Settings.renderMainMenu()"><i class="fas fa-arrow-left"></i> BACK</button><h3>VISUALS & UI</h3></div>
            <div class="scroll-area-set">
                <div class="ui-preview-box" id="ui-preview"><div class="preview-msg other"><div class="p-bubble">System check...</div></div><div class="preview-msg mine"><div class="p-bubble">Style updated!</div></div></div>
                <div class="set-group-title">THEME PRESETS</div>
                <div id="theme-presets" class="theme-grid"></div>
                <div class="set-group-title">GEOMETRY & TEXT</div>
                <div class="control-row"><span>Message Size</span><input type="range" id="set-font-size" min="0.8" max="1.5" step="0.1" value="${c.msgSize}" oninput="Settings.liveUpdate()"></div>
                <div class="control-row"><span>Roundness</span><input type="range" id="set-radius" min="0" max="20" step="1" value="${c.radius}" oninput="Settings.liveUpdate()"></div>
                <div class="set-group-title">PALETTE CONFIG</div>
                <div class="color-grid">
                    <div class="color-item"><label>Accent</label>${colorBtn('set-accent', c.accent)}</div>
                    <div class="color-item"><label>Background</label>${colorBtn('set-bg', c.bg)}</div>
                    <div class="color-item"><label>Panel Base</label>${colorBtn('set-panel', c.panel)}</div>
                    <div class="color-item"><label>Msg Text</label>${colorBtn('set-msg-text', c.msgText)}</div>
                </div>
                <button class="btn-solid" style="margin-top:20px" onclick="Settings.saveTheme()">APPLY & SAVE THEME</button>
            </div>
        `;
        Settings.renderPresets();
        Settings.liveUpdate(); 
    },

    renderPresets: () => {
        const container = document.getElementById('theme-presets');
        if(!container) return;
        Object.keys(Settings.presets).forEach(key => {
            const p = Settings.presets[key];
            const div = document.createElement('div');
            div.className = 'theme-preset-card';
            div.onclick = () => Settings.loadPreset(key);
            div.innerHTML = `<div class="preset-preview" style="background:${p.bg}; border-color:${p.accent}"><div style="width:100%; height:50%; background:${p.panel}"></div><div style="width:20px; height:20px; background:${p.accent}; border-radius:50%; position:absolute; bottom:5px; right:5px; box-shadow:0 0 5px ${p.accent}"></div></div><div class="preset-name">${p.name}</div>`;
            container.appendChild(div);
        });
    },

    loadPreset: (key) => {
        const p = Settings.presets[key];
        const updateField = (id, val) => {
            const inp = document.getElementById(id);
            const btn = document.getElementById('btn-color-' + id);
            if(inp) inp.value = val;
            if(btn) btn.style.backgroundColor = val;
        };
        updateField('set-accent', p.accent);
        updateField('set-bg', p.bg);
        updateField('set-panel', p.panel);
        updateField('set-msg-text', p.msgText);
        Settings.liveUpdate();
    },

    liveUpdate: () => {
        const accent = document.getElementById('set-accent').value;
        const bg = document.getElementById('set-bg').value;
        const panel = document.getElementById('set-panel').value;
        const msgText = document.getElementById('set-msg-text').value;
        const size = document.getElementById('set-font-size').value;
        const radius = document.getElementById('set-radius').value;

        Settings.config = { accent, bg, panel, text: '#fff', msgText, msgSize: size, radius };

        const previewBox = document.getElementById('ui-preview');
        if(previewBox) {
            previewBox.style.backgroundColor = panel;
            previewBox.style.borderColor = accent;
            const bubbles = previewBox.querySelectorAll('.p-bubble');
            bubbles.forEach(b => {
                b.style.fontSize = size + 'rem';
                if(b.parentElement.classList.contains('mine')) {
                    b.style.backgroundColor = Settings.hexToRgba(accent, 0.15);
                    b.style.borderColor = accent;
                    b.style.color = '#fff'; 
                    b.style.borderRadius = `${radius}px`;
                    if(radius == 0) b.style.clipPath = 'polygon(0 0, 100% 0, 100% 100%, 10px 100%, 0 calc(100% - 10px))';
                    else b.style.clipPath = 'none';
                } else {
                    b.style.backgroundColor = '#222';
                    b.style.color = msgText;
                    b.style.borderRadius = `${radius}px`;
                    if(radius == 0) b.style.clipPath = 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)';
                    else b.style.clipPath = 'none';
                }
            });
        }
    },

    saveProfile: () => {
        const n = document.getElementById('my-nick').value.trim();
        const bio = document.getElementById('my-bio').value.trim();
        const prefix = document.getElementById('set-prefix').value.trim();
        const prefixColor = document.getElementById('set-prefix-color-val').value;
        
        if(!n) return UI.toast("Name required", "error");
        
        const update = { displayName: n, bio: bio, prefix: prefix, prefixColor: prefixColor };
        if(Settings.croppedData.avi) update.avatar = Settings.croppedData.avi;
        if(Settings.croppedData.ban) update.banner = Settings.croppedData.ban;

        db.ref('users/'+State.user.uid).update(update).then(()=>{
            UI.toast("PROFILE UPDATED","success");
            Settings.croppedData = { avi: null, ban: null };
            Settings.renderMainMenu();
        });
    },

    saveTheme: () => {
        localStorage.setItem('neko_theme_config', JSON.stringify(Settings.config));
        
        Settings.applyTheme(Settings.config);
        
        db.ref('users/'+State.user.uid+'/themeConfig').set(Settings.config).then(() => {
            UI.toast("THEME SAVED", "success");
        });
    },

    applyTheme: (t) => {
        if(!t) t = Settings.config;
        const styleEl = document.getElementById('theme-style');
        if(!styleEl) return;

        const primaryDim = Settings.hexToRgba(t.accent, 0.15);
        const isCyber = t.radius == 0;
        const msgClipMine = isCyber ? 'polygon(0 0, 100% 0, 100% 100%, 10px 100%, 0 calc(100% - 10px))' : 'none';
        const msgClipOther = isCyber ? 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)' : 'none';
        
        styleEl.innerHTML = `
            :root { 
                --bg: ${t.bg}; 
                --primary: ${t.accent}; 
                --primary-dim: ${primaryDim};
                --secondary: ${t.accent}; 
                --panel: ${t.panel};
                --msg-text: ${t.msgText};
                --msg-size: ${t.msgSize}rem;
                --radius: ${t.radius}px;
                --dim: #8b8b9b;
                --text: #ffffff;
                --font-head: 'Exo 2', sans-serif;
                --font-body: 'Inter', sans-serif;
            }
            body, #bg-canvas { background-color: var(--bg) !important; }
            .sidebar { background: var(--panel) !important; border-right: 1px solid rgba(255,255,255,0.05); }
            .sidebar-header span, .top-title, .nav-item.active, .nav-item.active i, .btn-text, .ch-name i, .accent-text { color: var(--primary) !important; }
            .nav-item.active { border-left-color: var(--primary); background: linear-gradient(90deg, var(--primary-dim), transparent); }
            .btn-solid, .btn-danger, .input-group input, .auth-card, .modal-box, .channel-card { border-radius: var(--radius) !important; }
            .bubble { font-size: var(--msg-size) !important; border-radius: var(--radius) !important; clip-path: ${msgClipOther} !important; color: var(--msg-text) !important; }
            .msg.mine .bubble { background: var(--primary-dim) !important; border-color: var(--primary) !important; color: #fff !important; clip-path: ${msgClipMine} !important; }
            .panel-box, .channel-card, .auth-card, .modal-box { background: var(--panel); border-color: rgba(255,255,255,0.05); }
            .top-bar { background: var(--panel); border-bottom-color: rgba(255,255,255,0.05); }
            input, textarea { background: rgba(0,0,0,0.3) !important; border-color: #333 !important; }
            input:focus, textarea:focus { border-color: var(--primary) !important; }
        `;
    },

    hexToRgba: (hex, alpha) => {
        let r = 0, g = 0, b = 0;
        if (hex.length === 4) {
            r = parseInt(hex[1] + hex[1], 16); g = parseInt(hex[2] + hex[2], 16); b = parseInt(hex[3] + hex[3], 16);
        } else if (hex.length === 7) {
            r = parseInt(hex.slice(1, 3), 16); g = parseInt(hex.slice(3, 5), 16); b = parseInt(hex.slice(5, 7), 16);
        }
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },

    renderPrivacySettings: async () => {
        const container = document.getElementById('settings-dynamic-area');
        if(!container) return;

        const snap = await db.ref('users/' + State.user.uid + '/privacy').once('value');
        const privacy = snap.val() || {};
        const allowDMs = privacy.allowDMs !== false; 
        const allowCalls = privacy.allowCalls !== false; 

        container.innerHTML = `
            <div class="set-header-nav"><button class="btn-text" onclick="Settings.renderMainMenu()"><i class="fas fa-arrow-left"></i> BACK</button><h3>PRIVACY & SECURITY</h3></div>
            <div class="scroll-area-set">
                <div class="set-group-title">INTERACTIONS</div>
                <div class="control-row">
                    <span>Allow Private Messages (DMs)</span>
                    <label class="toggle-wrapper" style="margin:0;">
                        <input type="checkbox" class="toggle-checkbox" id="priv-dm-toggle" ${allowDMs ? 'checked' : ''} onchange="Settings.savePrivacy()">
                        <div class="toggle-switch"></div>
                    </label>
                </div>
                <div class="control-row">
                    <span>Allow Incoming Calls</span>
                    <label class="toggle-wrapper" style="margin:0;">
                        <input type="checkbox" class="toggle-checkbox" id="priv-call-toggle" ${allowCalls ? 'checked' : ''} onchange="Settings.savePrivacy()">
                        <div class="toggle-switch"></div>
                    </label>
                </div>
                <div class="set-group-title" style="margin-top:30px;">BLACKLIST (BLOCKED USERS)</div>
                <div id="blacklist-container" class="list-container" style="min-height: 100px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                    <div style="text-align:center; padding:20px; color:#666;">Loading blocklist...</div>
                </div>
            </div>
        `;
        Settings.renderBlacklist();
    },

    renderBlacklist: async () => {
        const list = document.getElementById('blacklist-container');
        if(!list) return;

        const snap = await db.ref('users/' + State.user.uid + '/blocked').once('value');
        const blockedObj = snap.val();

        if(!blockedObj) {
            list.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">No blocked users.</div>';
            return;
        }

        list.innerHTML = '';
        const blockedUids = Object.keys(blockedObj);

        for (const uid of blockedUids) {
            const userSnap = await db.ref('users/' + uid).once('value');
            const u = userSnap.val();
            const name = u ? u.displayName : 'Unknown User';
            const avi = u ? u.avatar : 'https://via.placeholder.com/50';

            const row = document.createElement('div');
            row.className = 'control-row';
            row.style.padding = '10px 15px';
            row.style.marginBottom = '5px';
            
            row.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${avi}" style="width:30px; height:30px; border-radius:50%;">
                    <span>${name}</span>
                </div>
                <button class="btn-text" style="color:#ff0055; border-color:#ff0055;" onclick="Settings.unblockUser('${uid}')">UNBLOCK</button>
            `;
            list.appendChild(row);
        }
    },

    unblockUser: (uid) => {
        Block.remove(uid);
        setTimeout(() => Settings.renderBlacklist(), 200);
    },

    savePrivacy: () => {
        const allowDMs = document.getElementById('priv-dm-toggle').checked;
        const allowCalls = document.getElementById('priv-call-toggle').checked;

        db.ref('users/' + State.user.uid + '/privacy').update({
            allowDMs: allowDMs,
            allowCalls: allowCalls
        }).then(() => UI.toast("Privacy Settings Saved", "msg"));
    },

    renderVoiceSettings: async () => {
        const container = document.getElementById('settings-dynamic-area');
        if(!window.Voice) return UI.toast("Voice module not ready", "error");

        container.innerHTML = `
             <div class="set-header-nav"><button class="btn-text" onclick="Settings.renderMainMenu()"><i class="fas fa-arrow-left"></i> BACK</button><h3>AUDIO CONFIG</h3></div>
             <div class="scroll-area-set" id="voice-settings-box">
                <div style="text-align:center; padding:20px; color:#666;">Scanning hardware...</div>
             </div>
        `;

        const devices = await Voice.getDevices();
        const mics = devices.mics || [];
        const speakers = devices.speakers || [];
        
        const box = document.getElementById('voice-settings-box');
        
        let micOptions = mics.map(m => `<option value="${m.deviceId}" ${Voice.currentMicId === m.deviceId ? 'selected' : ''}>${m.label || 'Unknown Microphone'}</option>`).join('');
        let spkOptions = speakers.map(s => `<option value="${s.deviceId}" ${Voice.currentSpeakerId === s.deviceId ? 'selected' : ''}>${s.label || 'Unknown Speaker'}</option>`).join('');

        if(speakers.length === 0) spkOptions = '<option disabled selected>Default System Output</option>';

        box.innerHTML = `
            <div class="set-group-title">INPUT DEVICE (MICROPHONE)</div>
            <select id="set-mic-select" class="neko-select" onchange="Voice.setMicDevice(this.value)">
                ${micOptions}
            </select>
            <div class="control-row" style="margin-top:10px;">
                <span>Input Gain (Volume)</span>
                <input type="range" min="0" max="200" value="${Voice.localVolume}" oninput="Voice.setLocalVolume(this.value)">
            </div>
            <div class="control-row">
                <span>Push to Talk Mode</span>
                <label class="toggle-wrapper" style="margin:0;">
                    <input type="checkbox" class="toggle-checkbox" id="set-ptt-toggle" ${Voice.pttEnabled ? 'checked' : ''} onchange="Voice.setPushToTalk(this.checked)">
                    <div class="toggle-switch"></div>
                </label>
            </div>
            <div class="control-row" style="margin-top:5px;">
                <span>PTT Key Binding</span>
                <button class="btn-text" style="font-family:monospace; min-width:80px;" onclick="Voice.bindPttKey(this)">${Voice.formatKeyName(Voice.pttKey)}</button>
            </div>
            <div class="set-group-title" style="margin-top:30px;">OUTPUT DEVICE (SPEAKERS)</div>
            <select id="set-spk-select" class="neko-select" onchange="Voice.setSpeakerDevice(this.value)">
                ${spkOptions}
            </select>
            <div class="control-row" style="margin-top:10px;">
                <span>Master Output Volume</span>
                <input type="range" min="0" max="100" value="${Voice.masterVolume}" oninput="Voice.setMasterVolume(this.value)">
            </div>
            <div class="set-group-title" style="margin-top:30px;">MIC TEST</div>
            <div style="background:#000; padding:15px; border-radius:12px; border:1px solid #333; display:flex; align-items:center; gap:15px;">
                <button class="btn-icon-sm" id="btn-mic-test" onclick="Voice.toggleMicTest()">START TEST</button>
                <div style="flex:1; height:6px; background:#222; border-radius:3px; overflow:hidden;">
                    <div id="mic-test-bar" style="width:0%; height:100%; background:var(--primary); transition: width 0.05s;"></div>
                </div>
            </div>
        `;
    }
};

document.addEventListener('DOMContentLoaded', () => { Settings.init(); });