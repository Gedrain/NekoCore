const Auth = {
    init: () => {
        auth.onAuthStateChanged(u => {
            const loader = document.getElementById('loader');
            const viewAuth = document.getElementById('view-auth');
            const viewMain = document.getElementById('view-main');

            if (u) {
                window.currentUser = u; 
                State.user = u;
                
                if(viewAuth) viewAuth.classList.add('hidden');
                if(loader) loader.classList.remove('hidden');

                const myStatus = db.ref('users/' + u.uid + '/status'); 
                const myLastSeen = db.ref('users/' + u.uid + '/lastSeen');
                db.ref('.info/connected').on('value', (snap) => { 
                    if (snap.val() === true) { 
                        myStatus.onDisconnect().set('offline'); 
                        myLastSeen.onDisconnect().set(firebase.database.ServerValue.TIMESTAMP); 
                        myStatus.set('online'); 
                    } 
                });
                
                db.ref('users/'+u.uid).on('value', s => {
                    if(loader) loader.classList.add('hidden');

                    if(!s.exists()) {
                        console.warn("Profile missing for authenticated user. Logging out.");
                        auth.signOut();
                        return; 
                    }

                    const v = s.val(); 
                    State.profile = v;
                    
                    if(v.isBanned) { 
                        if(viewMain) viewMain.classList.add('hidden');
                        if(viewAuth) viewAuth.classList.add('hidden');
                        document.getElementById('view-pending').classList.add('hidden');
                        Auth.renderBanScreen(v.banReason || "No Reason Specified");
                        return; 
                    } else {
                        document.getElementById('view-ban').classList.add('hidden');
                    }

                    if (v.isApproved === false && v.role !== 'admin' && v.role !== 'super') {
                        if(viewMain) viewMain.classList.add('hidden');
                        if(viewAuth) viewAuth.classList.add('hidden');
                        document.getElementById('view-pending').classList.remove('hidden');
                        return;
                    } else {
                        document.getElementById('view-pending').classList.add('hidden');
                    }

                    if(viewAuth) viewAuth.classList.add('hidden'); 
                    if(viewMain) viewMain.classList.remove('hidden');
                    
                    if(v.role==='admin'||v.role==='super') {
                        const navAdmin = document.getElementById('nav-admin');
                        if(navAdmin) navAdmin.classList.remove('hidden');
                    }

                    if(!document.querySelector('.tab-pane.active')) Route('channels');
                    
                    if(typeof Channels !== 'undefined') Channels.load(); 
                    if((v.role==='admin'||v.role==='super') && typeof Admin !== 'undefined') Admin.load();
                    
                    if(v.themeConfig && typeof Settings !== 'undefined') { 
                        localStorage.setItem('neko_theme_config', JSON.stringify(v.themeConfig)); 
                        Settings.config = v.themeConfig; 
                        Settings.applyTheme(v.themeConfig); 
                    }
                });
            } else { 
                window.currentUser = null;
                State.user = null;

                if(loader) loader.classList.add('hidden');
                if(viewMain) viewMain.classList.add('hidden');
                if(viewAuth) viewAuth.classList.remove('hidden'); 
            }
        });
    },
    
    renderBanScreen: (reason) => {
        const screen = document.getElementById('view-ban');
        const consoleEl = document.getElementById('ban-console');
        const msg = document.getElementById('ban-message');
        const reasonText = document.getElementById('ban-reason-text');
        
        screen.classList.remove('hidden');
        consoleEl.innerHTML = '';
        msg.classList.add('hidden');
        reasonText.innerText = reason.toUpperCase();

        const logs = [
            "Initiating session...",
            "Verifying identity signature...",
            "Decrypting user profile...",
            "Accessing NekoNet database...",
            "Checking blacklist status...",
            "<span style='color:#ff0055'>[ALERT]</span> SECURITY FLAG DETECTED",
            "<span style='color:#ff0055'>[CRITICAL]</span> ACCOUNT SUSPENDED"
        ];

        let i = 0;
        const printLog = () => {
            if(i < logs.length) {
                const div = document.createElement('div');
                div.className = 'log-entry';
                div.innerHTML = `> ${logs[i]}`;
                consoleEl.appendChild(div);
                i++;
                setTimeout(printLog, 300);
            } else {
                setTimeout(() => {
                    msg.classList.remove('hidden');
                }, 500);
            }
        };
        printLog();
    },

    setMode: (isReg) => {
        State.isReg = isReg; 
        const container = document.querySelector('.auth-switch-container'); 
        const nickGroup = document.getElementById('group-nick'); 
        const btnText = document.querySelector('.btn-cyber .btn-content'); 
        const tabLogin = document.getElementById('tab-login'); 
        const tabReg = document.getElementById('tab-reg');
        
        if (isReg) { 
            container.classList.add('reg-mode'); 
            nickGroup.classList.remove('collapsed'); 
            btnText.innerText = "REGISTER_NEKO_ID"; 
            tabLogin.classList.remove('active'); 
            tabReg.classList.add('active'); 
        } else { 
            container.classList.remove('reg-mode'); 
            nickGroup.classList.add('collapsed'); 
            btnText.innerText = "INITIALIZE_SESSION"; 
            tabLogin.classList.add('active'); 
            tabReg.classList.remove('active'); 
        }
    },

    togglePassVisibility: (el) => {
        const input = document.getElementById('auth-pass');
        if (input.type === 'password') { 
            input.type = 'text'; 
            el.classList.replace('fa-eye', 'fa-eye-slash'); 
            el.style.color = 'var(--secondary)'; 
        } else { 
            input.type = 'password'; 
            el.classList.replace('fa-eye-slash', 'fa-eye'); 
            el.style.color = ''; 
        }
    },

    submit: () => {
        const e = document.getElementById('auth-email').value; 
        const p = document.getElementById('auth-pass').value; 
        const n = document.getElementById('auth-nick').value;
        
        if (!e || !p) return UI.toast("CREDENTIALS MISSING", "error");
        
        const btn = document.querySelector('.btn-cyber'); 
        const originalText = btn.querySelector('.btn-content').innerText; 
        btn.querySelector('.btn-content').innerText = "PROCESSING...";
        
        if (State.isReg) {
            if (!n) { 
                btn.querySelector('.btn-content').innerText = originalText; 
                return UI.toast("CODENAME REQUIRED", "error"); 
            }
            auth.createUserWithEmailAndPassword(e, p).then(c => {
                c.user.sendEmailVerification(); 
                const sid = '#' + c.user.uid.substr(0, 5).toUpperCase();
                const defaultTheme = { accent: '#d600ff', bg: '#05000a', panel: '#0e0e12', text: '#ffffff', msgText: '#ffffff', msgSize: '1', radius: '0' };
                
                db.ref('users/' + c.user.uid).set({ 
                    displayName: n, 
                    email: e, 
                    avatar: `https://robohash.org/${c.user.uid}`, 
                    shortId: sid, 
                    role: 'user', 
                    isApproved: false, 
                    themeConfig: defaultTheme, 
                    createdAt: firebase.database.ServerValue.TIMESTAMP 
                });
            }).catch(err => { 
                UI.alert("ACCESS DENIED", err.message); 
                btn.querySelector('.btn-content').innerText = originalText; 
            });
        } else { 
            auth.signInWithEmailAndPassword(e, p).catch(err => { 
                UI.alert("AUTH FAILED", err.message); 
                btn.querySelector('.btn-content').innerText = originalText; 
            }); 
        }
    },

    reset: () => { 
        const e = document.getElementById('auth-email').value; 
        if (e) auth.sendPasswordResetEmail(e).then(() => UI.toast("RECOVERY LINK SENT", "success")); 
        else UI.toast("ENTER EMAIL FIRST", "info"); 
    },

    logout: () => auth.signOut().then(() => location.reload())
};