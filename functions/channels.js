window.Channels = {
    editingId: null, listListener: null, croppedData: { newAvi: null, newBan: null, editAvi: null, editBan: null },

    initListeners: () => {
        const handleUpload = (file, ratio, callback) => {
            if (!file) return;
            if (file.type.match('image/gif')) {
                const reader = new FileReader(); reader.onload = (e) => callback(e.target.result); reader.readAsDataURL(file);
            } else { UI.Crop.start(file, ratio, (base64) => callback(base64), () => { if(document.activeElement) document.activeElement.value = ''; }); }
        };
        const newAviIn = document.getElementById('new-ch-avi'); if(newAviIn) newAviIn.onchange = e => handleUpload(e.target.files[0], 1, base64 => { Channels.croppedData.newAvi = base64; document.getElementById('new-ch-avi-prev').src = base64; newAviIn.value = ''; });
        const newBanIn = document.getElementById('new-ch-banner'); if(newBanIn) newBanIn.onchange = e => handleUpload(e.target.files[0], 2.5, base64 => { Channels.croppedData.newBan = base64; document.getElementById('new-ch-banner-prev').style.backgroundImage = `url(${base64})`; newBanIn.value = ''; });
        const editAviIn = document.getElementById('edit-ch-avi'); if(editAviIn) editAviIn.onchange = e => handleUpload(e.target.files[0], 1, base64 => { Channels.croppedData.editAvi = base64; document.getElementById('edit-ch-avi-prev').src = base64; editAviIn.value = ''; });
        const editBanIn = document.getElementById('edit-ch-banner'); if(editBanIn) editBanIn.onchange = e => handleUpload(e.target.files[0], 2.5, base64 => { Channels.croppedData.editBan = base64; document.getElementById('edit-ch-banner-prev').style.backgroundImage = `url(${base64})`; editBanIn.value = ''; });
    },

    create: () => {
        const nameInput = document.getElementById('new-ch-name');
        const n = nameInput ? nameInput.value : '';
        
        const privEl = document.getElementById('new-ch-priv');
        const passEl = document.getElementById('new-ch-pass');
        
        const isPriv = privEl ? privEl.checked : false; 
        const pass = (isPriv && passEl) ? passEl.value : null;

        if(!n) return UI.toast("Name required", "error");
        
        const data = { 
            name: n, 
            pass: pass, 
            creator: State.user.uid, 
            image: Channels.croppedData.newAvi || null, 
            banner: Channels.croppedData.newBan || null, 
            membersCount: 1 
        };
        
        const newRef = db.ref('channels').push(); 
        
        newRef.set(data)
            .then(() => {
                return Channels.join(newRef.key, true);
            })
            .then(() => {
                document.getElementById('modal-create').classList.remove('open'); 
                if(nameInput) nameInput.value = ''; 
                document.getElementById('new-ch-avi-prev').src = 'https://via.placeholder.com/100/000000/ffffff?text=+';
                document.getElementById('new-ch-banner-prev').style.backgroundImage = '';
                Channels.croppedData.newAvi = null; 
                Channels.croppedData.newBan = null;
                UI.toast("Channel created!", "success");
            })
            .catch(error => {
                console.error(error);
                UI.toast("Creation failed: " + error.message, "error");
            });
    },

    join: (chid, isCreator = false) => {
        const uid = State.user.uid; const updates = {}; updates[`users_channels/${uid}/${chid}`] = true; updates[`channels_members/${chid}/${uid}`] = true;
        return db.ref().update(updates).then(() => { 
            if(!isCreator) { 
                db.ref(`channels/${chid}/membersCount`).transaction(c => (c || 0) + 1); 
                UI.toast("Joined Channel", "success"); 
            } 
            Channels.openChat(chid); 
        });
    },

    leave: (chid) => {
        UI.confirm("LEAVE CHANNEL", "Are you sure you want to leave this channel?", () => {
            const uid = State.user.uid; const updates = {}; updates[`users_channels/${uid}/${chid}`] = null; updates[`channels_members/${chid}/${uid}`] = null;
            db.ref().update(updates).then(() => { db.ref(`channels/${chid}/membersCount`).transaction(c => (c || 1) - 1); UI.toast("Left Channel", "success"); Channels.load(); document.getElementById('modal-channel-settings').classList.remove('open'); if(State.chatMode === 'channel') Route('channels'); });
        });
    },
    
    leaveFromSettings: () => { if(Channels.editingId) Channels.leave(Channels.editingId); },

    openChat: (key) => {
        db.ref('channels/'+key).once('value', s => {
            const v = s.val(); if(!v) return;
            const titleEl = document.getElementById('chat-title');
            titleEl.innerText = '# ' + v.name;
            titleEl.classList.remove('clickable-header');
            titleEl.onclick = null; 

            State.chatMode = 'channel'; State.currentChannelId = key;
            const headerBtn = document.getElementById('chat-top-right'); if(headerBtn) headerBtn.innerHTML = `<i class="fas fa-users" style="cursor:pointer; color:var(--primary); font-size:1.2rem; transition:0.2s;" onclick="Channels.viewMembers('${key}')"></i>`;
            Route('chat'); Chat.listen(db.ref('channels_msg/'+key), 'chat-feed');
        });
    },

    viewMembers: (chid) => {
        if(!chid) return;
        const list = document.getElementById('members-list'); list.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Loading...</div>'; document.getElementById('modal-members').classList.add('open');
        db.ref('channels_members/'+chid).once('value', async snap => {
            list.innerHTML = ''; if(!snap.exists()) { list.innerHTML = '<div style="text-align:center; color:#555;">No members found</div>'; return; }
            const uids = Object.keys(snap.val()); const promises = uids.map(uid => db.ref('users/'+uid).once('value')); const usersSnaps = await Promise.all(promises);
            const users = usersSnaps.map(s => ({...s.val(), uid: s.key})).filter(u => u.displayName); users.sort((a, b) => (b.status === 'online') - (a.status === 'online'));
            users.forEach(u => {
                const isOnline = u.status === 'online'; let lastSeenText = 'Offline';
                if(isOnline) lastSeenText = '<span style="color:#00ff9d; font-weight:bold;">Online</span>';
                else if(u.lastSeen) { const diff = Date.now() - u.lastSeen; const min = Math.floor(diff/60000); const hr = Math.floor(min/60); const days = Math.floor(hr/24); if(min < 1) lastSeenText = 'Just now'; else if(min < 60) lastSeenText = `${min}m ago`; else if(hr < 24) lastSeenText = `${hr}h ago`; else lastSeenText = `${days}d ago`; }
                let roleColor = '#666'; let roleBorder = '1px solid rgba(255,255,255,0.1)';
                if(u.role === 'admin') { roleColor = '#ff0055'; roleBorder = '1px solid rgba(255,0,85,0.4)'; }
                if(u.role === 'super') { roleColor = '#d600ff'; roleBorder = '1px solid rgba(214,0,255,0.4)'; }
                const roleName = u.role === 'user' ? 'USER' : u.role.toUpperCase();
                const card = document.createElement('div'); card.className = 'member-card';
                card.innerHTML = `<div class="member-avi-wrap"><img src="${u.avatar || 'https://via.placeholder.com/50'}" class="member-avi"><div class="member-status ${isOnline ? 'online' : ''}"></div></div><div class="member-info"><div class="member-name">${u.displayName}</div><div class="member-seen">${lastSeenText}</div></div><div class="member-role" style="color:${roleColor}; border:${roleBorder};">${roleName}</div>`;
                card.onclick = () => window.Profile.view(u.uid); list.appendChild(card);
            });
        });
    },

    load: () => {
        const uid = State.user.uid; const l = document.getElementById('channel-list'); if(!l) return;
        if(Channels.listListener) db.ref('users_channels/' + uid).off('value', Channels.listListener);
        Channels.listListener = db.ref('users_channels/' + uid).on('value', async snap => {
            l.innerHTML = ''; if(!snap.exists()) { l.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">No channels yet.<br>Use Search to find by ID.</div>'; return; }
            const myChannels = Object.keys(snap.val()); const promises = myChannels.map(key => db.ref('channels/' + key).once('value')); const snapshots = await Promise.all(promises);
            snapshots.forEach(s => {
                const v = s.val(); if(!v) return; const key = s.key;
                const d = document.createElement('div'); d.className = 'channel-card';
                const img = v.image || 'https://via.placeholder.com/60/000/fff?text=%23'; const bannerStyle = v.banner ? `background-image: url('${v.banner}');` : ''; const lock = v.pass ? '<i class="fas fa-lock" style="color:#ffcc00; margin-right:5px;"></i>' : ''; const shortId = key.substr(-4); const members = v.membersCount || 1;
                let settings = ''; if(v.creator === State.user.uid || State.profile.role === 'super') settings = `<i class="fas fa-cog ch-settings" onclick="event.stopPropagation(); Channels.openSettings('${key}')"></i>`; else settings = `<i class="fas fa-sign-out-alt ch-settings" style="color:#ff0055" onclick="event.stopPropagation(); Channels.leave('${key}')"></i>`;
                const badgeId = `ch-badge-${key}`;
                d.innerHTML = `<div class="ch-card-banner" style="${bannerStyle}"></div><div class="ch-card-body"><img src="${img}" class="ch-card-avi"><div class="ch-card-info"><div class="ch-name">${lock}${v.name}</div><div class="ch-meta"><span>ID: ${shortId}</span> &bull; <span style="color:#00ff9d"><i class="fas fa-users"></i> ${members}</span></div></div><div class="ch-controls"><span id="${badgeId}" class="badge-count">0</span>${settings}</div></div>`;
                d.onclick = () => {
                    document.getElementById(badgeId).classList.remove('visible');
                    if(v.pass && !State.unlockedChannels.has(key)) { State.pendingCh = {id:key, name:v.name, pass:v.pass}; document.getElementById('modal-pass').classList.add('open'); } else Channels.openChat(key);
                };
                l.appendChild(d);
                db.ref('channels_msg/'+key).limitToLast(1).on('child_added', snap => {
                    const msg = snap.val(); const isFresh = (Date.now() - msg.ts) < 5000; const isActive = document.getElementById('tab-chat').classList.contains('active') && document.getElementById('chat-title').innerText === '# '+v.name;
                    if (isFresh && msg.uid !== State.user.uid && !isActive) { const b = document.getElementById(badgeId); if(b) { let count = parseInt(b.innerText) || 0; count++; b.innerText = count; b.classList.add('visible'); } }
                });
            });
        });
    },

    auth: () => {
        const inp = document.getElementById('ch-auth-pass');
        if(inp.value === State.pendingCh.pass) {
            State.unlockedChannels.add(State.pendingCh.id); document.getElementById('modal-pass').classList.remove('open'); inp.value = '';
            db.ref(`users_channels/${State.user.uid}/${State.pendingCh.id}`).once('value', snap => {
                if(snap.exists()) Channels.openChat(State.pendingCh.id); else Channels.join(State.pendingCh.id);
            });
        } else { UI.toast("Wrong Pass", "error"); inp.classList.add('error'); setTimeout(() => inp.classList.remove('error'), 300); }
    },

    openSettings: (key) => {
        Channels.editingId = key;
        db.ref('channels/'+key).once('value', s => {
            const v = s.val(); document.getElementById('edit-ch-name').value = v.name;
            const avi = v.image || 'https://via.placeholder.com/100/000000/ffffff?text=+'; const ban = v.banner || 'none';
            document.getElementById('edit-ch-avi-prev').src = avi; document.getElementById('edit-ch-banner-prev').style.backgroundImage = ban === 'none' ? 'none' : `url(${ban})`;
            document.getElementById('modal-channel-settings').classList.add('open'); Channels.croppedData.editAvi = null; Channels.croppedData.editBan = null;
        });
    },

    saveSettings: () => {
        const key = Channels.editingId; const name = document.getElementById('edit-ch-name').value;
        if(!name) return UI.toast("Name required", "error");
        const update = { name: name }; if(Channels.croppedData.editAvi) update.image = Channels.croppedData.editAvi; if(Channels.croppedData.editBan) update.banner = Channels.croppedData.editBan;
        db.ref('channels/'+key).update(update); document.getElementById('modal-channel-settings').classList.remove('open');
        document.getElementById('edit-ch-avi').value = ''; document.getElementById('edit-ch-banner').value = ''; Channels.croppedData.editAvi = null; Channels.croppedData.editBan = null;
    },

    del: () => { if(!Channels.editingId) return; UI.confirm("DELETE", "Delete channel?", () => { db.ref('channels/'+Channels.editingId).remove(); document.getElementById('modal-channel-settings').classList.remove('open'); }); }
};
document.addEventListener('DOMContentLoaded', () => { Channels.initListeners(); });