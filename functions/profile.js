window.Profile = {
    view: (uid) => {
        if(!uid) return;
        db.ref('users/'+uid).once('value', s => {
            const u = s.val();
            if(!u) return console.error("User not found");
            const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
            const setSrc = (id, val) => { const el = document.getElementById(id); if(el) el.src = val; };
            const setBg = (id, val) => { const el = document.getElementById(id); if(el) el.style.backgroundImage = val; };

            setBg('u-banner', u.banner ? `url(${u.banner})` : 'none');
            setSrc('u-avi', u.avatar || 'https://via.placeholder.com/100');
            setVal('u-name', u.displayName);
            setVal('u-id', u.shortId);
            
            const prefContainer = document.getElementById('u-prefix-container');
            if(prefContainer) {
                if (u.prefix) { prefContainer.innerHTML = `<span style="font-size:0.8rem; font-weight:700; color:${u.prefixColor || '#fff'}; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px;">${u.prefix}</span>`; } 
                else { prefContainer.innerHTML = ''; }
            }
            
            const bioEl = document.getElementById('u-bio');
            if(bioEl) {
                if(u.bio && u.bio.trim() !== "") {
                    bioEl.innerText = u.bio;
                    bioEl.style.display = "block";
                } else {
                    bioEl.style.display = "none";
                }
            }

            const dot = document.getElementById('u-status-indicator');
            if(dot) dot.className = u.status === 'online' ? `p-status-dot online` : `p-status-dot`;
            
            let rName = 'USER';
            if(u.role === 'admin') rName = 'ADMINISTRATOR';
            if(u.role === 'super') rName = 'ROOT ACCESS';
            setVal('u-role', rName);
            
            const regEl = document.getElementById('u-reg-date');
            if(regEl) { if(u.createdAt) { const d = new Date(u.createdAt); regEl.innerText = d.toLocaleDateString(); } else { regEl.innerText = "N/A"; } }
            
            const lsEl = document.getElementById('u-last-seen');
            if(lsEl) {
                if(u.status === 'online') { lsEl.innerText = "Online Now"; lsEl.style.color = "#00ff9d"; } 
                else { const ls = u.lastSeen ? new Date(u.lastSeen).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : 'Unknown'; lsEl.innerText = ls; lsEl.style.color = "#ccc"; }
            }

            const badgesEl = document.getElementById('u-badges');
            if(badgesEl) {
                badgesEl.innerHTML = '';
                const addBadge = (icon, color, title) => { badgesEl.innerHTML += `<div class="p-badge-box" title="${title}" style="color:${color}; border-color:${color}40"><i class="${icon}"></i></div>`; };
                addBadge('fas fa-id-card', '#00e5ff', 'Resident');
                if(u.role === 'admin' || u.role === 'super') addBadge('fas fa-shield-alt', '#ff0055', 'Staff');
                if(u.role === 'super') addBadge('fas fa-code', '#d600ff', 'Developer');
            }

            State.dmTarget = uid; 
            if(window.Block && window.Block.check) { Block.check(uid).then(b => { const btn = document.getElementById('btn-block'); if(btn) btn.innerText = b ? "UNBLOCK" : "BLOCK"; }); }
            const modal = document.getElementById('modal-user'); if(modal) modal.classList.add('open');
        });
    }
};