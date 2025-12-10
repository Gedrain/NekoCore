const Search = {
    timer: null, currentFilter: 'all', searchCounter: 0, isInit: false,

    init: () => {
        if (Search.isInit) return;
        const input = document.getElementById('search-in');
        if (!input) return;
        const wrapper = input.parentElement; 
        if (wrapper) {
            wrapper.style.position = 'relative'; wrapper.style.display = 'block'; input.style.paddingRight = '45px';
            const oldBtn = wrapper.querySelector('.search-filter-wrapper'); if(oldBtn) oldBtn.remove();
            const btnWrap = document.createElement('div'); btnWrap.className = 'search-filter-wrapper';
            const btn = document.createElement('button'); btn.className = 'search-filter-btn'; btn.innerHTML = '<i class="fas fa-filter"></i>';
            btn.onclick = (e) => { e.stopPropagation(); Search.toggleFilterMenu(); };
            const dropdown = document.createElement('div'); dropdown.id = 'search-filter-dropdown'; dropdown.className = 'filter-dropdown';
            const options = [{ id: 'all', label: 'All Results', icon: 'fa-globe' }, { id: 'users', label: 'Users Only', icon: 'fa-user' }, { id: 'channels', label: 'Channels Only', icon: 'fa-broadcast-tower' }];
            options.forEach(opt => {
                const item = document.createElement('div'); item.className = 'filter-option';
                if(opt.id === 'all') item.classList.add('selected');
                item.dataset.val = opt.id; item.innerHTML = `<i class="fas ${opt.icon}"></i> ${opt.label}`;
                item.onclick = (e) => { e.stopPropagation(); Search.setFilter(opt.id, item); };
                dropdown.appendChild(item);
            });
            btnWrap.appendChild(btn); btnWrap.appendChild(dropdown); wrapper.appendChild(btnWrap);
            document.addEventListener('click', () => { const dd = document.getElementById('search-filter-dropdown'); if(dd) dd.classList.remove('open'); });
        }
        Search.isInit = true;
    },

    toggleFilterMenu: () => { document.getElementById('search-filter-dropdown').classList.toggle('open'); },

    setFilter: (type, el) => {
        Search.currentFilter = type;
        const opts = document.querySelectorAll('#search-filter-dropdown .filter-option');
        opts.forEach(o => o.classList.remove('selected')); if(el) el.classList.add('selected');
        const btnIcon = document.querySelector('.search-filter-btn i');
        if(btnIcon) {
            if(type === 'all') btnIcon.className = 'fas fa-filter';
            if(type === 'users') btnIcon.className = 'fas fa-user';
            if(type === 'channels') btnIcon.className = 'fas fa-broadcast-tower';
        }
        document.getElementById('search-filter-dropdown').classList.remove('open'); Search.run();
    },

    run: () => { Search.init(); clearTimeout(Search.timer); Search.timer = setTimeout(() => { Search.performSearch(); }, 300); },

    performSearch: () => {
        const input = document.getElementById('search-in'); if (!input) return;
        const q = input.value.toLowerCase().trim();
        const list = document.getElementById('search-results');
        if (q.length < 1) { list.innerHTML = ''; return; }
        Search.searchCounter++; const currentSearchId = Search.searchCounter;
        list.innerHTML = `<div style="text-align:center; padding:20px; width:100%; color:#555;"><i class="fas fa-circle-notch fa-spin"></i> SCANNING...</div>`;
        const pUsers = db.ref('users').once('value'); const pChannels = db.ref('channels').once('value'); const pMySubs = db.ref(`users_channels/${State.user.uid}`).once('value');
        Promise.all([pUsers, pChannels, pMySubs]).then(snapshots => {
            if (Search.searchCounter !== currentSearchId) return;
            const usersSnap = snapshots[0]; const channelsSnap = snapshots[1]; const mySubsSnap = snapshots[2];
            const mySubs = mySubsSnap.val() || {}; let hasResults = false;
            const fragment = document.createDocumentFragment();

            if (Search.currentFilter === 'all' || Search.currentFilter === 'users') {
                usersSnap.forEach(c => {
                    const u = c.val(); const uid = c.key;
                    if (u.displayName.toLowerCase().includes(q) || (u.shortId && u.shortId.toLowerCase().includes(q))) {
                        hasResults = true;
                        let roleHtml = '<span style="color:#777; font-size:0.7rem; font-weight:700;">USER</span>';
                        if (u.role === 'admin') roleHtml = '<span style="color:#ff0055; font-size:0.7rem; font-weight:800;">ADMIN</span>';
                        else if (u.role === 'super') roleHtml = '<span style="color:#d600ff; font-size:0.7rem; font-weight:800;">ROOT</span>';
                        const bannerStyle = u.banner ? `background-image: url('${u.banner}')` : ''; const avatar = u.avatar || 'https://via.placeholder.com/100';
                        const el = document.createElement('div'); el.className = 'channel-card';
                        el.innerHTML = `<div class="ch-card-banner" style="${bannerStyle}"></div><div class="ch-card-body"><img src="${avatar}" class="ch-card-avi"><div class="ch-card-info"><div class="ch-name">${u.displayName}</div><div class="ch-meta">${roleHtml} &bull; <span style="font-family:monospace">#${u.shortId}</span></div></div></div>`;
                        el.onclick = () => window.Profile.view(uid); fragment.appendChild(el);
                    }
                });
            }

            if (Search.currentFilter === 'all' || Search.currentFilter === 'channels') {
                channelsSnap.forEach(c => {
                    const ch = c.val(); const chId = c.key;
                    if (ch.name.toLowerCase().includes(q) || chId === q) {
                        hasResults = true;
                        const bannerStyle = ch.banner ? `background-image: url('${ch.banner}')` : '';
                        const img = ch.image || 'https://via.placeholder.com/100/000000/ffffff?text=+';
                        const members = ch.membersCount || 0; const isMember = mySubs.hasOwnProperty(chId);
                        let actionBtn = isMember ? `<span style="color:#00ff9d; font-size:0.7rem; font-weight:900; letter-spacing:1px;">JOINED <i class="fas fa-check"></i></span>` : `<button class="btn-solid" style="padding:6px 12px; font-size:0.7rem; width:auto; border-radius:4px;" onclick="event.stopPropagation(); Search.joinChannel('${chId}', '${ch.pass ? ch.pass.replace(/'/g, "\\'") : ''}')">JOIN</button>`;
                        const el = document.createElement('div'); el.className = 'channel-card';
                        el.innerHTML = `<div class="ch-card-banner" style="${bannerStyle}"></div><div class="ch-card-body"><img src="${img}" class="ch-card-avi" style="border-radius:10px;"><div class="ch-card-info"><div class="ch-name">${ch.name}</div><div class="ch-meta"><i class="fas fa-users"></i> ${members} &bull; Channel</div></div><div style="display:flex; align-items:center;">${actionBtn}</div></div>`;
                        el.onclick = () => { if(isMember) Channels.openChat(chId); else if(ch.pass) Search.joinChannel(chId, ch.pass); else Channels.join(chId); };
                        fragment.appendChild(el);
                    }
                });
            }
            list.innerHTML = '';
            if (!hasResults) list.innerHTML = `<div style="grid-column:1/-1; display:flex; flex-direction:column; align-items:center; color:#555; margin-top:40px;"><i class="fas fa-ghost" style="font-size:3rem; margin-bottom:15px; opacity:0.3;"></i><span style="font-family:monospace; letter-spacing:2px;">NO DATA FOUND</span></div>`;
            else list.appendChild(fragment);
        });
    },

    joinChannel: (chid, pass) => {
        if (pass && pass.trim() !== '') {
            State.pendingCh = { id: chid, pass: pass };
            const modal = document.getElementById('modal-pass');
            const input = document.getElementById('ch-auth-pass');
            input.value = ''; modal.classList.add('open');
            setTimeout(() => input.focus(), 100);
        } else {
            Channels.join(chid);
        }
    }
};