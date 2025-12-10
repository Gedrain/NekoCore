window.Admin = {
    usersCache: [],

    load: () => {
        if (State.profile.role !== 'admin' && State.profile.role !== 'super') return;

        if (State.profile.role === 'super') {
            document.getElementById('super-admin-controls').classList.remove('hidden');
        }

        db.ref('users').on('value', s => {
            const users = [];
            s.forEach(c => {
                const u = c.val();
                if (c.key !== State.user.uid) { 
                    u.uid = c.key;
                    users.push(u);
                }
            });
            Admin.usersCache = users;
            Admin.renderList(users);
            
            const countEl = document.getElementById('admin-count-total');
            if(countEl) countEl.innerText = users.length + ' Users';
        });
    },

    renderList: (users) => {
        const list = document.getElementById('admin-list');
        if (!list) return;
        list.innerHTML = '';

        users.forEach(u => {
            const isPending = u.isApproved === false && u.role !== 'super' && u.role !== 'admin';
            let cardClass = `adm-card-new ${u.isBanned ? 'banned' : ''}`;
            if(isPending) cardClass += ' pending';

            const card = document.createElement('div');
            card.className = cardClass;
            
            if(isPending) card.style.borderLeftColor = '#ffcc00';

            const isOnline = u.status === 'online';
            const statusClass = isOnline ? 'adm-status-dot online' : 'adm-status-dot';
            
            let roleBadge = '';
            if(u.role === 'admin') roleBadge = `<span class="adm-badge admin">ADMIN</span>`;
            if(u.role === 'super') roleBadge = `<span class="adm-badge super">ROOT</span>`;
            if(isPending) roleBadge += ` <span class="adm-badge" style="color:#000; background:#ffcc00;">WAITING</span>`;

            let actions = '';
            
            if(isPending) {
                 actions += `<button class="adm-btn-icon" title="Approve User" onclick="Admin.approve('${u.uid}')" style="border-color:#ffcc00; color:#ffcc00;"><i class="fas fa-check"></i></button>`;
            }

            if(u.isBanned) {
                actions += `<button class="adm-btn-icon" title="Unban" onclick="Admin.ban('${u.uid}', false)"><i class="fas fa-lock-open" style="color:#00ff9d"></i></button>`;
            } else {
                actions += `<button class="adm-btn-icon danger" title="Ban User" onclick="Admin.ban('${u.uid}', true)"><i class="fas fa-ban"></i></button>`;
            }

            if (State.profile.role === 'super') {
                if (u.role !== 'admin') {
                    actions += `<button class="adm-btn-icon" title="Promote to Admin" onclick="Admin.role('${u.uid}','admin')"><i class="fas fa-shield-alt" style="color:#00e5ff"></i></button>`;
                } else {
                    actions += `<button class="adm-btn-icon danger" title="Demote" onclick="Admin.role('${u.uid}','user')"><i class="fas fa-user-minus"></i></button>`;
                }
                actions += `<button class="adm-btn-icon" title="Change ID" onclick="Admin.changeId('${u.uid}')"><i class="fas fa-id-badge"></i></button>`;
                actions += `<button class="adm-btn-icon danger" title="Delete User" onclick="Admin.rm('${u.uid}')"><i class="fas fa-trash"></i></button>`;
            }

            card.innerHTML = `
                <img src="${u.avatar}" class="adm-avi">
                <div class="adm-info">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div class="adm-name">${u.displayName}</div>
                        <div class="${statusClass}"></div>
                    </div>
                    <div class="adm-meta">
                        <span>${u.shortId}</span>
                        ${roleBadge}
                    </div>
                    ${u.isBanned ? `<div style="font-size:0.7rem; color:#ff0055; margin-top:5px;">BANNED: ${u.banReason || 'N/A'}</div>` : ''}
                    <div class="adm-actions-row">
                        ${actions}
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    },

    filter: () => {
        const query = document.getElementById('admin-search').value.toLowerCase();
        const filtered = Admin.usersCache.filter(u => {
            return (u.displayName && u.displayName.toLowerCase().includes(query)) || 
                   (u.shortId && u.shortId.toLowerCase().includes(query));
        });
        Admin.renderList(filtered);
    },

    approve: (uid) => {
        UI.confirm("APPROVE USER", "Grant access to NekoCore?", () => {
             db.ref('users/'+uid).update({ isApproved: true }).then(() => {
                 UI.toast("User Approved", "success");
             });
        });
    },

    ban: (uid, shouldBan) => {
        if (shouldBan) {
            const modal = document.getElementById('modal-prompt');
            document.getElementById('prompt-title').innerText = "BAN HAMMER";
            document.getElementById('prompt-desc').innerText = "Enter reason for account suspension (Visible to user):";
            document.getElementById('prompt-label').innerText = "BAN REASON";
            const inp = document.getElementById('prompt-input');
            inp.value = '';
            
            modal.classList.add('open');
            inp.focus();

            const confirmBtn = document.getElementById('btn-prompt-confirm');
            const newBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

            newBtn.onclick = () => {
                const reason = inp.value.trim();
                if (reason) {
                    db.ref('users/'+uid).update({
                        isBanned: true,
                        banReason: reason
                    }).then(() => {
                        UI.toast("User Banned", "success");
                        modal.classList.remove('open');
                    });
                } else {
                    UI.toast("Reason required", "error");
                    inp.classList.add('error');
                    setTimeout(() => inp.classList.remove('error'), 300);
                }
            };
        } else {
            UI.confirm(
                "LIFT SUSPENSION", 
                "Are you sure you want to unban this user?", 
                () => {
                    db.ref('users/'+uid).update({
                        isBanned: false,
                        banReason: null
                    }).then(() => UI.toast("User Unbanned", "success"));
                }
            );
        }
    },

    mod: (u,k,v) => db.ref('users/'+u).update({[k]:v}),
    role: (u,r) => db.ref('users/'+u).update({role:r}),
    rm: (u) => UI.confirm("DELETE", "Irreversible action.", () => db.ref('users/'+u).remove()),
    changeId: (u) => {
        const newId = prompt("Enter New ID:");
        if (newId && newId.trim() !== "") {
            db.ref('users/'+u).update({shortId: newId.trim()});
        }
    }
};