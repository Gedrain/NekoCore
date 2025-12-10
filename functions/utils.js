function showImg(s){ document.getElementById('full-img').src=s; document.getElementById('modal-img').classList.add('open'); }
function safe(t){ return t ? t.replace(/</g,'&lt;') : ''; }

function resizeImage(file, callback) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const maxDim = 1024; 
            let w = img.width; let h = img.height;
            if (w > h) { if (w > maxDim) { h *= maxDim / w; w = maxDim; } } 
            else { if (h > maxDim) { w *= maxDim / h; h = maxDim; } }
            canvas.width = w; canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);
            callback(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function blobToBase64(blob, callback) {
    const reader = new FileReader();
    reader.onload = () => {
        const dataUrl = reader.result;
        callback(dataUrl);
    };
    reader.readAsDataURL(blob);
}

window.Notifications = {
    init: () => {
        if ("Notification" in window && Notification.permission !== "granted") {
            Notification.requestPermission();
        }
    },
    send: (title, body, icon) => {
        if (Notification.permission === "granted" && document.hidden) {
            new Notification(title, {
                body: body,
                icon: icon || 'https://cdn-icons-png.flaticon.com/512/733/733585.png'
            });
        }
    }
};

window.Block = {
    toggle: () => {
        if(!State.dmTarget) return;
        const ref = db.ref('users/'+State.user.uid+'/blocked/'+State.dmTarget);
        ref.once('value', s => {
            if(s.exists()){ ref.remove(); UI.toast("Unblocked"); document.getElementById('btn-block').innerText="BLOCK"; }
            else { ref.set(true); UI.toast("Blocked"); document.getElementById('btn-block').innerText="UNBLOCK"; }
        });
    },
    remove: (targetUid) => {
        db.ref('users/'+State.user.uid+'/blocked/'+targetUid).remove()
          .then(() => UI.toast("User unblocked"));
    },
    check: (targetUid) => {
        return db.ref('users/'+targetUid+'/blocked/'+State.user.uid).once('value').then(s => s.exists());
    },
    isBlockedByMe: (targetUid) => {
        return db.ref('users/'+State.user.uid+'/blocked/'+targetUid).once('value').then(s => s.exists());
    }
};

window.Privacy = {
    check: async (targetUid, type) => {
        try {
            const snap = await db.ref('users/' + targetUid).once('value');
            const user = snap.val();
            if (!user) return { allowed: false, error: "User not found" };

            if (user.blocked && user.blocked[State.user.uid]) {
                return { allowed: false, error: "You are blocked by this user." };
            }

            const privacy = user.privacy || {};
            
            const allowDMs = privacy.allowDMs !== false; 
            const allowCalls = privacy.allowCalls !== false;

            if (type === 'dm' && !allowDMs) return { allowed: false, error: "This user has disabled DMs." };
            if (type === 'call' && !allowCalls) return { allowed: false, error: "This user is not accepting calls." };

            return { allowed: true };
        } catch (e) {
            console.error(e);
            return { allowed: false, error: "Connection error" };
        }
    }
};